"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT_DIR = __dirname;
const resetPassword = String(process.env.SERVOFORGE_OWNER_RESET_PASSWORD || "");
const requestedUsername = String(process.env.SERVOFORGE_OWNER_RESET_USERNAME || "").trim().toLowerCase();

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(String(password), salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

function verifyPassword(password, encoded) {
  try {
    const [scheme, saltHex, hashHex] = String(encoded || "").split("$");
    if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, "hex");
    const actual = crypto.scryptSync(String(password), Buffer.from(saltHex, "hex"), expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function fail(message) {
  console.error(`[ServoForge recovery] ${message}`);
  process.exitCode = 1;
}

if (!resetPassword) {
  process.exit(0);
}

if (resetPassword.length < 10) {
  fail("SERVOFORGE_OWNER_RESET_PASSWORD must contain at least 10 characters.");
} else {
  const dataDir = process.env.SERVOFORGE_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(ROOT_DIR, "data");
  const filePath = path.join(dataDir, "servoforge-auth.json");

  if (!fs.existsSync(filePath)) {
    fail(`Authentication database was not found at ${filePath}. Confirm the Railway volume is attached to the service.`);
  } else {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const users = Array.isArray(data.users) ? data.users : [];
      const owners = users.filter((user) => user?.role === "owner");
      let owner = null;

      if (requestedUsername) {
        owner = owners.find((user) => String(user.username || "").toLowerCase() === requestedUsername) || null;
        if (!owner) {
          throw new Error(`No owner account matched username ${requestedUsername}.`);
        }
      } else if (owners.length === 1) {
        owner = owners[0];
      } else if (owners.length === 0) {
        throw new Error("No owner account exists in the authentication database.");
      } else {
        throw new Error("Multiple owner accounts were found. Set SERVOFORGE_OWNER_RESET_USERNAME as well.");
      }

      if (verifyPassword(resetPassword, owner.passwordHash)) {
        console.log(`[ServoForge recovery] Owner password for ${owner.username} already matches the recovery password. No change was required.`);
      } else {
        owner.passwordHash = hashPassword(resetPassword);
        owner.passwordChangedAt = new Date().toISOString();
        data.sessions = (Array.isArray(data.sessions) ? data.sessions : []).filter((session) => session.userId !== owner.id);

        const tempPath = `${filePath}.${process.pid}.recovery.tmp`;
        fs.writeFileSync(tempPath, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
        fs.renameSync(tempPath, filePath);
        console.log(`[ServoForge recovery] Owner password reset completed for ${owner.username}. Remove SERVOFORGE_OWNER_RESET_PASSWORD from Railway after signing in.`);
      }
    } catch (error) {
      fail(error.message || String(error));
    }
  }
}
