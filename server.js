"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT_DIR = __dirname;
const DEFAULT_PORT = Number(process.env.PORT || 3000);
const SESSION_COOKIE = "servoforge_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_AUDIT_ROWS = 5000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 6;

const MIME_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json; charset=utf-8"
});

const PUBLIC_ROOT_FILES = new Set([
  "app.js",
  "styles.css",
  "mobile.css",
  "auth.css",
  "manifest.webmanifest",
  "release-notes.json",
  "update-manifest.json",
  "fault-config.json"
]);
const PUBLIC_PREFIXES = ["app/", "assets/", "config/", "drivers/"];

function nowIso() {
  return new Date().toISOString();
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function validUsername(value) {
  return /^[a-z0-9][a-z0-9._-]{2,63}$/.test(value);
}

function safeText(value, max = 160) {
  return String(value || "").trim().slice(0, max);
}

function makeId(prefix) {
  return `${prefix}_${crypto.randomBytes(12).toString("hex")}`;
}

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

function sessionTokenHash(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function defaultDatabase() {
  return {
    version: 1,
    users: [],
    sessions: [],
    signIns: []
  };
}

class AuthStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, "servoforge-auth.json");
    fs.mkdirSync(dataDir, { recursive: true });
    this.data = this.load();
    this.cleanupSessions(false);
  }

  load() {
    if (!fs.existsSync(this.filePath)) return defaultDatabase();
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      return {
        version: 1,
        users: Array.isArray(parsed.users) ? parsed.users : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        signIns: Array.isArray(parsed.signIns) ? parsed.signIns : []
      };
    } catch (error) {
      throw new Error(`Unable to read ServoForge authentication data: ${error.message}`);
    }
  }

  save() {
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    const payload = `${JSON.stringify(this.data, null, 2)}\n`;
    fs.writeFileSync(tempPath, payload, { encoding: "utf8", mode: 0o600 });
    fs.renameSync(tempPath, this.filePath);
  }

  cleanupSessions(save = true) {
    const now = Date.now();
    const before = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter((session) => Date.parse(session.expiresAt) > now);
    if (save && before !== this.data.sessions.length) this.save();
  }

  publicUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      active: Boolean(user.active),
      createdAt: user.createdAt,
      createdBy: user.createdBy || null,
      lastLoginAt: user.lastLoginAt || null,
      loginCount: Number(user.loginCount || 0)
    };
  }

  getUserById(id) {
    return this.data.users.find((user) => user.id === id) || null;
  }

  getUserByUsername(username) {
    const normalized = normalizeUsername(username);
    return this.data.users.find((user) => user.username === normalized) || null;
  }

  createUser({ username, displayName, password, role = "user", createdBy = null }) {
    const normalized = normalizeUsername(username);
    if (!validUsername(normalized)) {
      throw Object.assign(new Error("Username must be 3-64 characters using letters, numbers, dots, underscores, or hyphens."), { statusCode: 400 });
    }
    if (this.getUserByUsername(normalized)) {
      throw Object.assign(new Error("That username already exists."), { statusCode: 409 });
    }
    if (String(password || "").length < 10) {
      throw Object.assign(new Error("Password must contain at least 10 characters."), { statusCode: 400 });
    }
    const allowedRoles = new Set(["owner", "admin", "user"]);
    if (!allowedRoles.has(role)) {
      throw Object.assign(new Error("Invalid role."), { statusCode: 400 });
    }
    const user = {
      id: makeId("usr"),
      username: normalized,
      displayName: safeText(displayName || normalized, 100),
      passwordHash: hashPassword(password),
      role,
      active: true,
      createdAt: nowIso(),
      createdBy,
      lastLoginAt: null,
      loginCount: 0
    };
    this.data.users.push(user);
    this.save();
    return user;
  }

  updateUser(target, patch, actor) {
    if (!target) throw Object.assign(new Error("User not found."), { statusCode: 404 });
    if (!actor) throw Object.assign(new Error("Not authorized."), { statusCode: 403 });
    if (actor.role !== "owner" && target.role !== "user") {
      throw Object.assign(new Error("Only the owner can manage administrator accounts."), { statusCode: 403 });
    }

    if (Object.hasOwn(patch, "displayName")) {
      const displayName = safeText(patch.displayName, 100);
      if (!displayName) throw Object.assign(new Error("Display name cannot be empty."), { statusCode: 400 });
      target.displayName = displayName;
    }

    if (Object.hasOwn(patch, "role")) {
      const nextRole = String(patch.role || "");
      if (!new Set(["admin", "user"]).has(nextRole)) {
        throw Object.assign(new Error("Role must be admin or user."), { statusCode: 400 });
      }
      if (actor.role !== "owner") {
        throw Object.assign(new Error("Only the owner can change account roles."), { statusCode: 403 });
      }
      if (target.role === "owner") {
        throw Object.assign(new Error("The owner role cannot be changed."), { statusCode: 400 });
      }
      target.role = nextRole;
    }

    if (Object.hasOwn(patch, "active")) {
      const nextActive = Boolean(patch.active);
      if (target.role === "owner" && !nextActive) {
        throw Object.assign(new Error("The owner account cannot be disabled."), { statusCode: 400 });
      }
      if (target.id === actor.id && !nextActive) {
        throw Object.assign(new Error("You cannot disable your own account."), { statusCode: 400 });
      }
      target.active = nextActive;
      if (!nextActive) this.data.sessions = this.data.sessions.filter((session) => session.userId !== target.id);
    }

    this.save();
    return target;
  }

  setPassword(target, password, actor, actorSessionTokenHash = null) {
    if (!target) throw Object.assign(new Error("User not found."), { statusCode: 404 });
    if (String(password || "").length < 10) {
      throw Object.assign(new Error("Password must contain at least 10 characters."), { statusCode: 400 });
    }
    if (actor.role !== "owner" && target.role !== "user") {
      throw Object.assign(new Error("Only the owner can reset administrator passwords."), { statusCode: 403 });
    }
    target.passwordHash = hashPassword(password);
    this.data.sessions = this.data.sessions.filter((session) => session.userId !== target.id || session.tokenHash === actorSessionTokenHash);
    this.save();
  }

  createSession(user, requestMeta) {
    this.cleanupSessions(false);
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = sessionTokenHash(token);
    const createdAt = nowIso();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    this.data.sessions.push({
      id: makeId("ses"),
      tokenHash,
      userId: user.id,
      createdAt,
      expiresAt,
      ip: requestMeta.ip,
      userAgent: requestMeta.userAgent
    });
    this.save();
    return { token, tokenHash, expiresAt };
  }

  getSession(token) {
    if (!token) return null;
    const tokenHash = sessionTokenHash(token);
    const session = this.data.sessions.find((row) => row.tokenHash === tokenHash) || null;
    if (!session) return null;
    if (Date.parse(session.expiresAt) <= Date.now()) {
      this.data.sessions = this.data.sessions.filter((row) => row.tokenHash !== tokenHash);
      this.save();
      return null;
    }
    const user = this.getUserById(session.userId);
    if (!user || !user.active) return null;
    return { session, user, tokenHash };
  }

  deleteSession(token) {
    const tokenHash = sessionTokenHash(token);
    const before = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter((row) => row.tokenHash !== tokenHash);
    if (before !== this.data.sessions.length) this.save();
  }

  recordSignIn({ username, user = null, success, reason, requestMeta }) {
    const row = {
      id: makeId("log"),
      timestamp: nowIso(),
      userId: user?.id || null,
      username: normalizeUsername(username),
      displayName: user?.displayName || null,
      success: Boolean(success),
      reason: safeText(reason || (success ? "success" : "failed"), 60),
      ip: requestMeta.ip,
      userAgent: requestMeta.userAgent
    };
    this.data.signIns.push(row);
    if (this.data.signIns.length > MAX_AUDIT_ROWS) {
      this.data.signIns.splice(0, this.data.signIns.length - MAX_AUDIT_ROWS);
    }
    if (success && user) {
      user.lastLoginAt = row.timestamp;
      user.loginCount = Number(user.loginCount || 0) + 1;
    }
    this.save();
    return row;
  }
}

function parseCookies(header) {
  const result = {};
  String(header || "").split(";").forEach((part) => {
    const index = part.indexOf("=");
    if (index < 0) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
  });
  return result;
}

function getRequestMeta(req) {
  const forwarded = safeText(req.headers["x-forwarded-for"], 200);
  const ip = safeText((forwarded ? forwarded.split(",")[0] : req.socket.remoteAddress) || "unknown", 80);
  return {
    ip,
    userAgent: safeText(req.headers["user-agent"] || "unknown", 300)
  };
}

function requestOrigin(req) {
  const proto = safeText(req.headers["x-forwarded-proto"] || (req.socket.encrypted ? "https" : "http"), 20).split(",")[0];
  return `${proto}://${req.headers.host}`;
}

function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  return origin === requestOrigin(req);
}

function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

function sendJson(res, status, payload) {
  setSecurityHeaders(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function redirect(res, location) {
  setSecurityHeaders(res);
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.end();
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Request body too large."), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(text ? JSON.parse(text) : {});
      } catch {
        reject(Object.assign(new Error("Invalid JSON body."), { statusCode: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function cookieForSession(req, token, expiresAt) {
  const secure = requestOrigin(req).startsWith("https://");
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${new Date(expiresAt).toUTCString()}`,
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function expiredSessionCookie(req) {
  const secure = requestOrigin(req).startsWith("https://");
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0"
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function currentAuth(req, store) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  const match = store.getSession(token);
  return match ? { ...match, token } : null;
}

function isAdmin(user) {
  return user?.role === "owner" || user?.role === "admin";
}

function authSafeServiceWorker() {
  return `"use strict";\nconst AUTH_CACHE_PREFIX = "servoforge-labeler-";\nself.addEventListener("install", (event) => { event.waitUntil(self.skipWaiting()); });\nself.addEventListener("activate", (event) => {\n  event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith(AUTH_CACHE_PREFIX)).map((name) => caches.delete(name)))).then(() => self.clients.claim()));\n});\nself.addEventListener("fetch", (event) => {\n  if (event.request.method !== "GET") return;\n  const url = new URL(event.request.url);\n  if (url.origin !== self.location.origin) return;\n  event.respondWith(fetch(event.request, { cache: "no-store" }));\n});\n`;
}

function injectAuthenticatedUi(html) {
  let output = html;
  if (!output.includes("/auth.css")) {
    output = output.replace("</head>", "  <link rel=\"stylesheet\" href=\"/auth.css\">\n</head>");
  }
  if (!output.includes("/app/auth-client.js")) {
    output = output.replace("</body>", "  <script src=\"/app/auth-client.js\"></script>\n</body>");
  }
  return output;
}

function safeStaticPath(rootDir, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relative = decoded.replace(/^\/+/, "");
  if (!relative || relative.includes("\0") || relative.split("/").includes("..")) return null;
  const allowed = PUBLIC_ROOT_FILES.has(relative) || PUBLIC_PREFIXES.some((prefix) => relative.startsWith(prefix));
  if (!allowed) return null;
  const absolute = path.resolve(rootDir, relative);
  if (!absolute.startsWith(`${path.resolve(rootDir)}${path.sep}`)) return null;
  return absolute;
}

function serveFile(req, res, filePath, { cacheControl = "no-cache" } = {}) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendJson(res, 404, { error: "Not found." });
    return;
  }
  setSecurityHeaders(res);
  res.statusCode = 200;
  res.setHeader("Content-Type", MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream");
  res.setHeader("Cache-Control", cacheControl);
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  fs.createReadStream(filePath).pipe(res);
}

function createServer(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const dataDir = options.dataDir || process.env.SERVOFORGE_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(rootDir, "data");
  const store = options.store || new AuthStore(dataDir);
  const loginFailures = new Map();

  function failureKey(req, username) {
    return `${getRequestMeta(req).ip}|${normalizeUsername(username)}`;
  }

  function failureState(key) {
    const now = Date.now();
    const current = loginFailures.get(key);
    if (!current || current.startedAt + LOGIN_WINDOW_MS <= now) {
      const fresh = { count: 0, startedAt: now };
      loginFailures.set(key, fresh);
      return fresh;
    }
    return current;
  }

  function requireApiUser(req, res) {
    const auth = currentAuth(req, store);
    if (!auth) {
      sendJson(res, 401, { error: "Authentication required." });
      return null;
    }
    return auth;
  }

  function requireApiAdmin(req, res) {
    const auth = requireApiUser(req, res);
    if (!auth) return null;
    if (!isAdmin(auth.user)) {
      sendJson(res, 403, { error: "Administrator access required." });
      return null;
    }
    return auth;
  }

  async function apiHandler(req, res, url) {
    const pathname = url.pathname;
    const method = req.method || "GET";

    if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && !originAllowed(req)) {
      sendJson(res, 403, { error: "Request origin rejected." });
      return true;
    }

    if (pathname === "/api/auth/status" && method === "GET") {
      const auth = currentAuth(req, store);
      sendJson(res, 200, {
        configured: store.data.users.length > 0,
        authenticated: Boolean(auth),
        user: auth ? store.publicUser(auth.user) : null
      });
      return true;
    }

    if (pathname === "/api/auth/me" && method === "GET") {
      const auth = requireApiUser(req, res);
      if (!auth) return true;
      sendJson(res, 200, { user: store.publicUser(auth.user) });
      return true;
    }

    if (pathname === "/api/auth/setup" && method === "POST") {
      if (store.data.users.length > 0) {
        sendJson(res, 409, { error: "Owner setup has already been completed." });
        return true;
      }
      const body = await readJsonBody(req);
      const user = store.createUser({
        username: body.username,
        displayName: body.displayName,
        password: body.password,
        role: "owner",
        createdBy: "initial-setup"
      });
      const requestMeta = getRequestMeta(req);
      store.recordSignIn({ username: user.username, user, success: true, reason: "owner_setup", requestMeta });
      const session = store.createSession(user, requestMeta);
      res.setHeader("Set-Cookie", cookieForSession(req, session.token, session.expiresAt));
      sendJson(res, 201, { user: store.publicUser(user) });
      return true;
    }

    if (pathname === "/api/auth/login" && method === "POST") {
      if (store.data.users.length === 0) {
        sendJson(res, 409, { error: "ServoForge owner setup is required first.", code: "SETUP_REQUIRED" });
        return true;
      }
      const body = await readJsonBody(req);
      const username = normalizeUsername(body.username);
      const key = failureKey(req, username);
      const state = failureState(key);
      const requestMeta = getRequestMeta(req);
      if (state.count >= LOGIN_MAX_FAILURES) {
        store.recordSignIn({ username, success: false, reason: "rate_limited", requestMeta });
        sendJson(res, 429, { error: "Too many failed sign-in attempts. Try again later." });
        return true;
      }

      const user = store.getUserByUsername(username);
      const valid = Boolean(user?.active) && verifyPassword(body.password, user?.passwordHash);
      if (!valid) {
        state.count += 1;
        store.recordSignIn({
          username,
          user,
          success: false,
          reason: user && !user.active ? "disabled" : "invalid_credentials",
          requestMeta
        });
        sendJson(res, 401, { error: "Invalid username or password." });
        return true;
      }

      loginFailures.delete(key);
      store.recordSignIn({ username: user.username, user, success: true, reason: "success", requestMeta });
      const session = store.createSession(user, requestMeta);
      res.setHeader("Set-Cookie", cookieForSession(req, session.token, session.expiresAt));
      sendJson(res, 200, { user: store.publicUser(user) });
      return true;
    }

    if (pathname === "/api/auth/logout" && method === "POST") {
      const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
      if (token) store.deleteSession(token);
      res.setHeader("Set-Cookie", expiredSessionCookie(req));
      sendJson(res, 200, { ok: true });
      return true;
    }

    if (pathname === "/api/admin/summary" && method === "GET") {
      const auth = requireApiAdmin(req, res);
      if (!auth) return true;
      const activeUsers = store.data.users.filter((user) => user.active).length;
      const successfulSignIns = store.data.signIns.filter((row) => row.success).length;
      const failedSignIns = store.data.signIns.length - successfulSignIns;
      sendJson(res, 200, {
        user: store.publicUser(auth.user),
        totals: {
          users: store.data.users.length,
          activeUsers,
          successfulSignIns,
          failedSignIns
        }
      });
      return true;
    }

    if (pathname === "/api/admin/users" && method === "GET") {
      const auth = requireApiAdmin(req, res);
      if (!auth) return true;
      const users = store.data.users
        .map((user) => store.publicUser(user))
        .sort((a, b) => a.username.localeCompare(b.username));
      sendJson(res, 200, { users });
      return true;
    }

    if (pathname === "/api/admin/users" && method === "POST") {
      const auth = requireApiAdmin(req, res);
      if (!auth) return true;
      const body = await readJsonBody(req);
      const requestedRole = body.role === "admin" ? "admin" : "user";
      if (requestedRole === "admin" && auth.user.role !== "owner") {
        sendJson(res, 403, { error: "Only the owner can create administrator accounts." });
        return true;
      }
      const user = store.createUser({
        username: body.username,
        displayName: body.displayName,
        password: body.password,
        role: requestedRole,
        createdBy: auth.user.id
      });
      sendJson(res, 201, { user: store.publicUser(user) });
      return true;
    }

    const userMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (userMatch && method === "PATCH") {
      const auth = requireApiAdmin(req, res);
      if (!auth) return true;
      const body = await readJsonBody(req);
      const target = store.getUserById(userMatch[1]);
      const user = store.updateUser(target, body, auth.user);
      sendJson(res, 200, { user: store.publicUser(user) });
      return true;
    }

    const passwordMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/password$/);
    if (passwordMatch && method === "POST") {
      const auth = requireApiAdmin(req, res);
      if (!auth) return true;
      const body = await readJsonBody(req);
      const target = store.getUserById(passwordMatch[1]);
      store.setPassword(target, body.password, auth.user, auth.tokenHash);
      sendJson(res, 200, { ok: true });
      return true;
    }

    if (pathname === "/api/admin/sign-ins" && method === "GET") {
      const auth = requireApiAdmin(req, res);
      if (!auth) return true;
      const requested = Number(url.searchParams.get("limit") || 100);
      const limit = Math.min(Math.max(Number.isFinite(requested) ? requested : 100, 1), 500);
      const signIns = store.data.signIns.slice(-limit).reverse();
      sendJson(res, 200, { signIns });
      return true;
    }

    return false;
  }

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", requestOrigin(req));
      const pathname = url.pathname;
      const method = req.method || "GET";

      if (pathname === "/healthz") {
        sendJson(res, 200, { ok: true });
        return;
      }

      if (pathname.startsWith("/api/")) {
        const handled = await apiHandler(req, res, url);
        if (!handled) sendJson(res, 404, { error: "API route not found." });
        return;
      }

      if (!["GET", "HEAD"].includes(method)) {
        sendJson(res, 405, { error: "Method not allowed." });
        return;
      }

      if (pathname === "/service-worker.js") {
        setSecurityHeaders(res);
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/javascript; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        if (method === "HEAD") res.end();
        else res.end(authSafeServiceWorker());
        return;
      }

      if (pathname === "/login.html" || pathname === "/login") {
        const auth = currentAuth(req, store);
        if (auth) {
          redirect(res, "/");
          return;
        }
        serveFile(req, res, path.join(rootDir, "login.html"), { cacheControl: "no-store" });
        return;
      }

      if (pathname === "/" || pathname === "/index.html") {
        const auth = currentAuth(req, store);
        if (!auth) {
          redirect(res, "/login.html");
          return;
        }
        const filePath = path.join(rootDir, "index.html");
        const html = injectAuthenticatedUi(fs.readFileSync(filePath, "utf8"));
        setSecurityHeaders(res);
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        if (method === "HEAD") res.end();
        else res.end(html);
        return;
      }

      if (pathname === "/admin.html" || pathname === "/admin") {
        const auth = currentAuth(req, store);
        if (!auth) {
          redirect(res, "/login.html");
          return;
        }
        if (!isAdmin(auth.user)) {
          redirect(res, "/");
          return;
        }
        serveFile(req, res, path.join(rootDir, "admin.html"), { cacheControl: "no-store" });
        return;
      }

      if (pathname === "/recovery.html") {
        const auth = currentAuth(req, store);
        if (!auth) {
          redirect(res, "/login.html");
          return;
        }
        serveFile(req, res, path.join(rootDir, "recovery.html"), { cacheControl: "no-store" });
        return;
      }

      const staticPath = safeStaticPath(rootDir, pathname);
      if (!staticPath) {
        sendJson(res, 404, { error: "Not found." });
        return;
      }
      serveFile(req, res, staticPath);
    } catch (error) {
      const status = Number(error.statusCode || 500);
      if (status >= 500) console.error("[ServoForge Auth]", error);
      if (!res.headersSent) sendJson(res, status, { error: status >= 500 ? "Internal server error." : error.message });
      else res.end();
    }
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(DEFAULT_PORT, "0.0.0.0", () => {
    const dataDir = process.env.SERVOFORGE_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(ROOT_DIR, "data");
    console.log(`[ServoForge Auth] listening on port ${DEFAULT_PORT}`);
    console.log(`[ServoForge Auth] persistent data: ${dataDir}`);
  });
}

module.exports = {
  AuthStore,
  createServer,
  hashPassword,
  verifyPassword
};
