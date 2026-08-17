"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createServer } = require("../server.js");

function cookieFrom(response) {
  return String(response.headers.get("set-cookie") || "").split(";")[0];
}

async function jsonRequest(base, route, { method = "GET", cookie = "", body } = {}) {
  const headers = { Origin: base };
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${base}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual"
  });
  const payload = (response.headers.get("content-type") || "").includes("application/json")
    ? await response.json()
    : null;
  return { response, payload };
}

test("local owner setup, account creation, sign-in tracking, and route protection", async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "servoforge-auth-"));
  const rootDir = path.resolve(__dirname, "..");
  const server = createServer({ dataDir, rootDir });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;

  let result = await jsonRequest(base, "/api/auth/status");
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.configured, false);
  assert.equal(result.payload.authenticated, false);

  result = await jsonRequest(base, "/api/auth/setup", {
    method: "POST",
    body: { username: "owner", displayName: "Servo Owner", password: "correct-horse-battery" }
  });
  assert.equal(result.response.status, 201);
  assert.equal(result.payload.user.role, "owner");
  const ownerCookie = cookieFrom(result.response);
  assert.match(ownerCookie, /^servoforge_session=/);

  result = await jsonRequest(base, "/api/auth/setup", {
    method: "POST",
    body: { username: "other", displayName: "Other", password: "another-password" }
  });
  assert.equal(result.response.status, 409, "owner setup must be one-time only");

  result = await jsonRequest(base, "/api/admin/users", {
    method: "POST",
    cookie: ownerCookie,
    body: { username: "operator.1", displayName: "Operator One", password: "temporary-password", role: "user" }
  });
  assert.equal(result.response.status, 201);
  assert.equal(result.payload.user.username, "operator.1");
  assert.equal(Object.hasOwn(result.payload.user, "passwordHash"), false);

  result = await jsonRequest(base, "/api/auth/login", {
    method: "POST",
    body: { username: "operator.1", password: "wrong-password" }
  });
  assert.equal(result.response.status, 401);

  result = await jsonRequest(base, "/api/auth/login", {
    method: "POST",
    body: { username: "operator.1", password: "temporary-password" }
  });
  assert.equal(result.response.status, 200);
  const operatorCookie = cookieFrom(result.response);
  assert.match(operatorCookie, /^servoforge_session=/);

  result = await jsonRequest(base, "/api/admin/sign-ins?limit=10", { cookie: ownerCookie });
  assert.equal(result.response.status, 200);
  assert.ok(result.payload.signIns.some((row) => row.username === "operator.1" && row.success === false));
  assert.ok(result.payload.signIns.some((row) => row.username === "operator.1" && row.success === true));

  result = await jsonRequest(base, "/api/admin/users", { cookie: operatorCookie });
  assert.equal(result.response.status, 403, "normal users must not access administration");

  const anonymousHome = await fetch(`${base}/`, { redirect: "manual" });
  assert.equal(anonymousHome.status, 302);
  assert.equal(anonymousHome.headers.get("location"), "/login.html");

  const protectedHome = await fetch(`${base}/`, { headers: { Cookie: ownerCookie }, redirect: "manual" });
  assert.equal(protectedHome.status, 200);
  const homeHtml = await protectedHome.text();
  assert.match(homeHtml, /app\/auth-client\.js/);
  assert.match(homeHtml, /auth\.css/);

  const worker = await fetch(`${base}/service-worker.js`);
  const workerText = await worker.text();
  assert.doesNotMatch(workerText, /cachedFallback/);
  assert.match(workerText, /cache:\s*"no-store"/);

  const stored = JSON.parse(fs.readFileSync(path.join(dataDir, "servoforge-auth.json"), "utf8"));
  assert.equal(stored.users.length, 2);
  assert.ok(stored.users.every((user) => user.passwordHash.startsWith("scrypt$")));
  assert.ok(stored.users.every((user) => !Object.hasOwn(user, "password")));
});
