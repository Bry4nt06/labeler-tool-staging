"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { AuthStore, verifyPassword } = require("./server");

const ROOT_DIR = __dirname;
const DEFAULT_PORT = Number(process.env.PORT || 3000);
const SESSION_COOKIE = "servoforge_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 6;
const SUPABASE_URL = String(process.env.SUPABASE_URL || "https://dtdewgbfckwvldceussa.supabase.co").replace(/\/$/, "");
const SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const AUTH_API_KEY = String(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || SERVICE_ROLE_KEY);
const LEGACY_IMPORT = String(process.env.SERVOFORGE_LEGACY_AUTH_IMPORT || "false").toLowerCase() === "true";
const SOURCE_ENVIRONMENT = String(process.env.SERVOFORGE_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_NAME || "unknown");
const ACCOUNT_LIBRARY_KEY = "account-library-v1";

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
const PUBLIC_ROOT_FILES = new Set(["app.js", "styles.css", "mobile.css", "auth.css", "manifest.webmanifest", "release-notes.json", "update-manifest.json", "fault-config.json"]);
const PUBLIC_PREFIXES = ["app/", "assets/", "config/", "drivers/"];

function nowIso() { return new Date().toISOString(); }
function normalizeUsername(value) { return String(value || "").trim().toLowerCase(); }
function validUsername(value) { return /^[a-z0-9][a-z0-9._-]{2,63}$/.test(value); }
function safeText(value, max = 160) { return String(value || "").trim().slice(0, max); }
function sessionTokenHash(token) { return crypto.createHash("sha256").update(String(token || "")).digest("hex"); }
function syntheticEmail(username) { return `${normalizeUsername(username)}@auth.servoforge.app`; }
function isAdmin(user) { return user?.role === "owner" || user?.role === "admin"; }

function assertSupabaseConfigured() {
  if (!SERVICE_ROLE_KEY) {
    throw Object.assign(new Error("SUPABASE_SERVICE_ROLE_KEY is required for shared ServoForge authentication."), { statusCode: 503 });
  }
}

async function requestJson(url, { method = "GET", body, headers = {}, key = SERVICE_ROLE_KEY } = {}) {
  assertSupabaseConfigured();
  const response = await fetch(url, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text || null; }
  if (!response.ok) {
    const message = payload?.msg || payload?.message || payload?.error_description || payload?.error || `Supabase request failed (${response.status}).`;
    const error = Object.assign(new Error(String(message)), { statusCode: response.status >= 500 ? 502 : response.status, supabaseStatus: response.status, payload });
    throw error;
  }
  return payload;
}

function rest(table, query = "") {
  return `${SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ""}`;
}

async function selectRows(table, query) {
  const rows = await requestJson(rest(table, query));
  return Array.isArray(rows) ? rows : [];
}

async function getProfileByUsername(username) {
  const rows = await selectRows("profiles", `username=eq.${encodeURIComponent(normalizeUsername(username))}&select=*`);
  return rows[0] || null;
}

async function getProfileById(id) {
  const rows = await selectRows("profiles", `id=eq.${encodeURIComponent(id)}&select=*`);
  return rows[0] || null;
}

function publicUser(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name || profile.username,
    role: profile.role || "user",
    active: profile.active !== false,
    createdAt: profile.created_at || null,
    createdBy: profile.created_by || null,
    lastLoginAt: profile.last_login_at || null,
    loginCount: Number(profile.login_count || 0)
  };
}

async function patchProfile(id, patch) {
  const rows = await requestJson(rest("profiles", `id=eq.${encodeURIComponent(id)}`), {
    method: "PATCH",
    body: patch,
    headers: { Prefer: "return=representation" }
  });
  return Array.isArray(rows) ? rows[0] : null;
}

async function createSupabaseUser({ username, displayName, password, role, createdBy = null, legacyUserId = null }) {
  const normalized = normalizeUsername(username);
  if (!validUsername(normalized)) throw Object.assign(new Error("Username must be 3-64 characters using letters, numbers, dots, underscores, or hyphens."), { statusCode: 400 });
  if (String(password || "").length < 10) throw Object.assign(new Error("Password must contain at least 10 characters."), { statusCode: 400 });
  const allowedRoles = new Set(["owner", "admin", "user"]);
  if (!allowedRoles.has(role)) throw Object.assign(new Error("Invalid role."), { statusCode: 400 });

  const result = await requestJson(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    body: {
      email: syntheticEmail(normalized),
      password: String(password),
      email_confirm: true,
      user_metadata: { username: normalized, display_name: safeText(displayName || normalized, 100) },
      app_metadata: { role }
    }
  });
  const authUser = result?.user || result;
  if (!authUser?.id) throw Object.assign(new Error("Supabase did not return a user id."), { statusCode: 502 });
  const profile = await patchProfile(authUser.id, {
    username: normalized,
    display_name: safeText(displayName || normalized, 100),
    role,
    active: true,
    created_by: createdBy,
    legacy_user_id: legacyUserId
  });
  return profile || getProfileById(authUser.id);
}

async function signInSupabase(username, password) {
  if (!AUTH_API_KEY) throw Object.assign(new Error("Supabase authentication key is not configured."), { statusCode: 503 });
  try {
    const data = await requestJson(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      key: AUTH_API_KEY,
      body: { email: syntheticEmail(username), password: String(password || "") }
    });
    return data?.user || null;
  } catch (error) {
    if ([400, 401].includes(error.supabaseStatus)) return null;
    throw error;
  }
}

async function createAppSession(profile, requestMeta) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = sessionTokenHash(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await requestJson(rest("app_sessions"), {
    method: "POST",
    body: { token_hash: tokenHash, user_id: profile.id, expires_at: expiresAt, ip: requestMeta.ip, user_agent: requestMeta.userAgent },
    headers: { Prefer: "return=minimal" }
  });
  return { token, tokenHash, expiresAt };
}

async function currentAuth(req) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = sessionTokenHash(token);
  const sessions = await selectRows("app_sessions", `token_hash=eq.${encodeURIComponent(tokenHash)}&select=*`);
  const session = sessions[0];
  if (!session) return null;
  if (Date.parse(session.expires_at) <= Date.now()) {
    await requestJson(rest("app_sessions", `token_hash=eq.${encodeURIComponent(tokenHash)}`), { method: "DELETE" });
    return null;
  }
  const profile = await getProfileById(session.user_id);
  if (!profile || profile.active === false) return null;
  return { token, tokenHash, session, user: profile };
}

async function deleteSession(token) {
  if (!token) return;
  await requestJson(rest("app_sessions", `token_hash=eq.${encodeURIComponent(sessionTokenHash(token))}`), { method: "DELETE" });
}

async function recordSignIn({ username, user = null, success, reason, requestMeta }) {
  const occurredAt = nowIso();
  await requestJson(rest("auth_sign_ins"), {
    method: "POST",
    body: {
      occurred_at: occurredAt,
      user_id: user?.id || null,
      username: normalizeUsername(username),
      display_name: user?.display_name || user?.username || null,
      success: Boolean(success),
      reason: safeText(reason || (success ? "success" : "failed"), 60),
      ip: requestMeta.ip,
      user_agent: requestMeta.userAgent
    },
    headers: { Prefer: "return=minimal" }
  });
  if (success && user) {
    const updated = await patchProfile(user.id, { last_login_at: occurredAt, login_count: Number(user.login_count || 0) + 1 });
    if (updated) Object.assign(user, updated);
  }
}

async function findLegacyUser(username, legacyStore) {
  const local = legacyStore.getUserByUsername(username);
  if (local) return { ...local, source: "local" };
  const rows = await selectRows("legacy_auth_users", `username=eq.${encodeURIComponent(normalizeUsername(username))}&select=*`);
  const row = rows[0];
  if (!row || row.migrated_user_id) return null;
  return {
    id: row.legacy_user_id,
    username: row.username,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    role: row.role,
    active: row.active,
    createdAt: row.created_at,
    createdBy: row.created_by,
    lastLoginAt: row.last_login_at,
    loginCount: row.login_count,
    source: "shared_legacy"
  };
}

async function markLegacyMigrated(username, userId) {
  await requestJson(rest("legacy_auth_users", `username=eq.${encodeURIComponent(normalizeUsername(username))}`), {
    method: "PATCH",
    body: { migrated_user_id: userId, migrated_at: nowIso() },
    headers: { Prefer: "return=minimal" }
  });
}

async function syncLegacyUsers(legacyStore) {
  if (!LEGACY_IMPORT || !legacyStore.data.users.length) return;
  const rows = legacyStore.data.users.map((user) => ({
    username: normalizeUsername(user.username),
    display_name: user.displayName || user.username,
    password_hash: user.passwordHash,
    role: user.role || "user",
    active: user.active !== false,
    legacy_user_id: user.id || null,
    created_at: user.createdAt || null,
    created_by: user.createdBy || null,
    last_login_at: user.lastLoginAt || null,
    login_count: Number(user.loginCount || 0),
    source_environment: SOURCE_ENVIRONMENT,
    synced_at: nowIso()
  }));
  await requestJson(rest("legacy_auth_users", "on_conflict=username"), {
    method: "POST",
    body: rows,
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }
  });
  console.log(`[ServoForge Auth] synced ${rows.length} legacy user record(s) from ${SOURCE_ENVIRONMENT}`);
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
  return {
    ip: safeText((forwarded ? forwarded.split(",")[0] : req.socket.remoteAddress) || "unknown", 80),
    userAgent: safeText(req.headers["user-agent"] || "unknown", 300)
  };
}

function requestOrigin(req) {
  const proto = safeText(req.headers["x-forwarded-proto"] || (req.socket.encrypted ? "https" : "http"), 20).split(",")[0];
  return `${proto}://${req.headers.host}`;
}
function originAllowed(req) { return !req.headers.origin || req.headers.origin === requestOrigin(req); }
function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}
function sendJson(res, status, payload) {
  setSecurityHeaders(res); res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(payload));
}
function redirect(res, location) { setSecurityHeaders(res); res.statusCode = 302; res.setHeader("Location", location); res.setHeader("Cache-Control", "no-store"); res.end(); }

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (chunk) => { size += chunk.length; if (size > MAX_BODY_BYTES) { reject(Object.assign(new Error("Request body too large."), { statusCode: 413 })); req.destroy(); return; } chunks.push(chunk); });
    req.on("end", () => { try { const text = Buffer.concat(chunks).toString("utf8"); resolve(text ? JSON.parse(text) : {}); } catch { reject(Object.assign(new Error("Invalid JSON body."), { statusCode: 400 })); } });
    req.on("error", reject);
  });
}

function cookieForSession(req, token, expiresAt) {
  const parts = [`${SESSION_COOKIE}=${encodeURIComponent(token)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Expires=${new Date(expiresAt).toUTCString()}`, `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`];
  if (requestOrigin(req).startsWith("https://")) parts.push("Secure");
  return parts.join("; ");
}
function expiredSessionCookie(req) {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Expires=Thu, 01 Jan 1970 00:00:00 GMT", "Max-Age=0"];
  if (requestOrigin(req).startsWith("https://")) parts.push("Secure");
  return parts.join("; ");
}

function safeStaticPath(rootDir, pathname) {
  let decoded; try { decoded = decodeURIComponent(pathname); } catch { return null; }
  const relative = decoded.replace(/^\/+/, "");
  if (!relative || relative.includes("\0") || relative.split("/").includes("..")) return null;
  const allowed = PUBLIC_ROOT_FILES.has(relative) || PUBLIC_PREFIXES.some((prefix) => relative.startsWith(prefix));
  if (!allowed) return null;
  const absolute = path.resolve(rootDir, relative);
  return absolute.startsWith(`${path.resolve(rootDir)}${path.sep}`) ? absolute : null;
}

function serveFile(req, res, filePath, { cacheControl = "no-cache" } = {}) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return sendJson(res, 404, { error: "Not found." });
  setSecurityHeaders(res); res.statusCode = 200; res.setHeader("Content-Type", MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream"); res.setHeader("Cache-Control", cacheControl);
  if (req.method === "HEAD") res.end(); else fs.createReadStream(filePath).pipe(res);
}

function injectAuthenticatedUi(html) {
  let output = html;
  if (!output.includes("/auth.css")) output = output.replace("</head>", "  <link rel=\"stylesheet\" href=\"/auth.css\">\n</head>");
  if (!output.includes("/app/auth-client.js")) output = output.replace("</body>", "  <script src=\"/app/auth-client.js\"></script>\n</body>");
  return output;
}

function authSafeServiceWorker() {
  return `"use strict";\nconst AUTH_CACHE_PREFIX = "servoforge-labeler-";\nself.addEventListener("install", (event) => { event.waitUntil(self.skipWaiting()); });\nself.addEventListener("activate", (event) => { event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith(AUTH_CACHE_PREFIX)).map((name) => caches.delete(name)))).then(() => self.clients.claim())); });\nself.addEventListener("fetch", (event) => { if (event.request.method !== "GET") return; const url = new URL(event.request.url); if (url.origin !== self.location.origin) return; event.respondWith(fetch(event.request, { cache: "no-store" })); });\n`;
}

function createServer(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const dataDir = options.dataDir || process.env.SERVOFORGE_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(rootDir, "data");
  const legacyStore = options.legacyStore || new AuthStore(dataDir);
  const loginFailures = new Map();

  function failureState(req, username) {
    const key = `${getRequestMeta(req).ip}|${normalizeUsername(username)}`;
    const now = Date.now();
    const current = loginFailures.get(key);
    if (!current || current.startedAt + LOGIN_WINDOW_MS <= now) { const fresh = { count: 0, startedAt: now, key }; loginFailures.set(key, fresh); return fresh; }
    return { ...current, key };
  }

  async function requireApiUser(req, res) {
    const auth = await currentAuth(req);
    if (!auth) { sendJson(res, 401, { error: "Authentication required." }); return null; }
    return auth;
  }
  async function requireApiAdmin(req, res) {
    const auth = await requireApiUser(req, res); if (!auth) return null;
    if (!isAdmin(auth.user)) { sendJson(res, 403, { error: "Administrator access required." }); return null; }
    return auth;
  }

  async function getAccountLibraryRow(userId) {
    const query = `owner_user_id=eq.${encodeURIComponent(userId)}&scope=eq.private&entity_type=eq.user_setup&entity_key=eq.${encodeURIComponent(ACCOUNT_LIBRARY_KEY)}&select=id,payload,updated_at,source_environment&limit=1`;
    return (await selectRows("shared_entities", query))[0] || null;
  }

  async function saveAccountLibrary(userId, library) {
    if (!library || typeof library !== "object" || Array.isArray(library)) {
      throw Object.assign(new Error("Account library payload must be an object."), { statusCode: 400 });
    }
    const current = await getAccountLibraryRow(userId);
    if (current) {
      const rows = await requestJson(rest("shared_entities", `id=eq.${encodeURIComponent(current.id)}`), {
        method: "PATCH",
        body: { payload: library, updated_by: userId },
        headers: { Prefer: "return=representation" }
      });
      return Array.isArray(rows) ? rows[0] : null;
    }
    const rows = await requestJson(rest("shared_entities"), {
      method: "POST",
      body: {
        entity_type: "user_setup",
        entity_key: ACCOUNT_LIBRARY_KEY,
        name: "ServoForge account library",
        payload: library,
        owner_user_id: userId,
        scope: "private",
        source_environment: SOURCE_ENVIRONMENT,
        created_by: userId,
        updated_by: userId
      },
      headers: { Prefer: "return=representation" }
    });
    return Array.isArray(rows) ? rows[0] : null;
  }

  async function apiHandler(req, res, url) {
    const pathname = url.pathname; const method = req.method || "GET";
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && !originAllowed(req)) { sendJson(res, 403, { error: "Request origin rejected." }); return true; }

    if (pathname === "/api/auth/status" && method === "GET") {
      const auth = await currentAuth(req);
      const configured = (await selectRows("profiles", "select=id&limit=1")).length > 0 || legacyStore.data.users.length > 0;
      sendJson(res, 200, { configured, authenticated: Boolean(auth), user: auth ? publicUser(auth.user) : null, sharedAuth: true }); return true;
    }
    if (pathname === "/api/auth/me" && method === "GET") { const auth = await requireApiUser(req, res); if (auth) sendJson(res, 200, { user: publicUser(auth.user) }); return true; }

    if (pathname === "/api/user/library" && method === "GET") {
      const auth = await requireApiUser(req, res); if (!auth) return true;
      const row = await getAccountLibraryRow(auth.user.id);
      sendJson(res, 200, { library: row?.payload || null, updatedAt: row?.updated_at || null, sourceEnvironment: row?.source_environment || null }); return true;
    }

    if (pathname === "/api/user/library" && method === "PUT") {
      const auth = await requireApiUser(req, res); if (!auth) return true;
      const body = await readJsonBody(req);
      const row = await saveAccountLibrary(auth.user.id, body.library);
      sendJson(res, 200, { ok: true, updatedAt: row?.updated_at || nowIso() }); return true;
    }

    if (pathname === "/api/auth/setup" && method === "POST") {
      if ((await selectRows("profiles", "select=id&limit=1")).length > 0 || legacyStore.data.users.length > 0) { sendJson(res, 409, { error: "Owner setup has already been completed." }); return true; }
      const body = await readJsonBody(req);
      const profile = await createSupabaseUser({ username: body.username, displayName: body.displayName, password: body.password, role: "owner", createdBy: "initial-setup" });
      const requestMeta = getRequestMeta(req); await recordSignIn({ username: profile.username, user: profile, success: true, reason: "owner_setup", requestMeta });
      const session = await createAppSession(profile, requestMeta); res.setHeader("Set-Cookie", cookieForSession(req, session.token, session.expiresAt)); sendJson(res, 201, { user: publicUser(profile) }); return true;
    }

    if (pathname === "/api/auth/login" && method === "POST") {
      const body = await readJsonBody(req); const username = normalizeUsername(body.username); const state = failureState(req, username); const requestMeta = getRequestMeta(req);
      if (state.count >= LOGIN_MAX_FAILURES) { await recordSignIn({ username, success: false, reason: "rate_limited", requestMeta }); sendJson(res, 429, { error: "Too many failed sign-in attempts. Try again later." }); return true; }

      let profile = await getProfileByUsername(username);
      if (profile?.active === false) { state.count += 1; loginFailures.set(state.key, state); await recordSignIn({ username, user: profile, success: false, reason: "disabled", requestMeta }); sendJson(res, 401, { error: "Invalid username or password." }); return true; }

      let authUser = profile ? await signInSupabase(username, body.password) : null;
      if (!authUser) {
        const legacy = await findLegacyUser(username, legacyStore);
        const validLegacy = Boolean(legacy?.active) && verifyPassword(body.password, legacy?.passwordHash);
        if (!validLegacy) { state.count += 1; loginFailures.set(state.key, state); await recordSignIn({ username, user: profile, success: false, reason: legacy && !legacy.active ? "disabled" : "invalid_credentials", requestMeta }); sendJson(res, 401, { error: "Invalid username or password." }); return true; }
        profile = await createSupabaseUser({ username: legacy.username, displayName: legacy.displayName, password: body.password, role: legacy.role || "user", createdBy: legacy.createdBy || "legacy-migration", legacyUserId: legacy.id || null });
        await markLegacyMigrated(username, profile.id).catch(() => {});
        authUser = { id: profile.id };
      }

      if (!profile) profile = await getProfileById(authUser.id);
      loginFailures.delete(state.key); await recordSignIn({ username: profile.username, user: profile, success: true, reason: authUser ? "success" : "legacy_migrated", requestMeta });
      const session = await createAppSession(profile, requestMeta); res.setHeader("Set-Cookie", cookieForSession(req, session.token, session.expiresAt)); sendJson(res, 200, { user: publicUser(profile) }); return true;
    }

    if (pathname === "/api/auth/logout" && method === "POST") { await deleteSession(parseCookies(req.headers.cookie)[SESSION_COOKIE]); res.setHeader("Set-Cookie", expiredSessionCookie(req)); sendJson(res, 200, { ok: true }); return true; }

    if (pathname === "/api/admin/summary" && method === "GET") {
      const auth = await requireApiAdmin(req, res); if (!auth) return true;
      const users = await selectRows("profiles", "select=id,active"); const signIns = await selectRows("auth_sign_ins", "select=success");
      sendJson(res, 200, { user: publicUser(auth.user), totals: { users: users.length, activeUsers: users.filter((u) => u.active !== false).length, successfulSignIns: signIns.filter((r) => r.success).length, failedSignIns: signIns.filter((r) => !r.success).length } }); return true;
    }

    if (pathname === "/api/admin/users" && method === "GET") { const auth = await requireApiAdmin(req, res); if (!auth) return true; const users = await selectRows("profiles", "select=*&order=username.asc"); sendJson(res, 200, { users: users.map(publicUser) }); return true; }

    if (pathname === "/api/admin/users" && method === "POST") {
      const auth = await requireApiAdmin(req, res); if (!auth) return true; const body = await readJsonBody(req); const requestedRole = body.role === "admin" ? "admin" : "user";
      if (requestedRole === "admin" && auth.user.role !== "owner") { sendJson(res, 403, { error: "Only the owner can create administrator accounts." }); return true; }
      if (await getProfileByUsername(body.username)) { sendJson(res, 409, { error: "That username already exists." }); return true; }
      const profile = await createSupabaseUser({ username: body.username, displayName: body.displayName, password: body.password, role: requestedRole, createdBy: auth.user.id }); sendJson(res, 201, { user: publicUser(profile) }); return true;
    }

    const userMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (userMatch && method === "PATCH") {
      const auth = await requireApiAdmin(req, res); if (!auth) return true; const target = await getProfileById(userMatch[1]); if (!target) { sendJson(res, 404, { error: "User not found." }); return true; }
      if (auth.user.role !== "owner" && target.role !== "user") { sendJson(res, 403, { error: "Only the owner can manage administrator accounts." }); return true; }
      const body = await readJsonBody(req); const patch = {};
      if (Object.hasOwn(body, "displayName")) patch.display_name = safeText(body.displayName, 100);
      if (Object.hasOwn(body, "role")) { if (auth.user.role !== "owner") { sendJson(res, 403, { error: "Only the owner can change account roles." }); return true; } if (target.role === "owner") { sendJson(res, 400, { error: "The owner role cannot be changed." }); return true; } patch.role = body.role === "admin" ? "admin" : "user"; }
      if (Object.hasOwn(body, "active")) { const nextActive = Boolean(body.active); if (target.role === "owner" && !nextActive) { sendJson(res, 400, { error: "The owner account cannot be disabled." }); return true; } if (target.id === auth.user.id && !nextActive) { sendJson(res, 400, { error: "You cannot disable your own account." }); return true; } patch.active = nextActive; }
      const updated = await patchProfile(target.id, patch); sendJson(res, 200, { user: publicUser(updated || { ...target, ...patch }) }); return true;
    }

    const passwordMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/password$/);
    if (passwordMatch && method === "POST") {
      const auth = await requireApiAdmin(req, res); if (!auth) return true; const target = await getProfileById(passwordMatch[1]); if (!target) { sendJson(res, 404, { error: "User not found." }); return true; }
      if (auth.user.role !== "owner" && target.role !== "user") { sendJson(res, 403, { error: "Only the owner can reset administrator passwords." }); return true; }
      const body = await readJsonBody(req); if (String(body.password || "").length < 10) { sendJson(res, 400, { error: "Password must contain at least 10 characters." }); return true; }
      await requestJson(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(target.id)}`, { method: "PUT", body: { password: String(body.password) } });
      await requestJson(rest("app_sessions", `user_id=eq.${encodeURIComponent(target.id)}`), { method: "DELETE" }); sendJson(res, 200, { ok: true }); return true;
    }

    if (pathname === "/api/admin/sign-ins" && method === "GET") { const auth = await requireApiAdmin(req, res); if (!auth) return true; const requested = Number(url.searchParams.get("limit") || 100); const limit = Math.min(Math.max(Number.isFinite(requested) ? requested : 100, 1), 500); const rows = await selectRows("auth_sign_ins", `select=*&order=occurred_at.desc&limit=${limit}`); sendJson(res, 200, { signIns: rows.map((r) => ({ id: r.id, timestamp: r.occurred_at, userId: r.user_id, username: r.username, displayName: r.display_name, success: r.success, reason: r.reason, ip: r.ip, userAgent: r.user_agent })) }); return true; }

    return false;
  }

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", requestOrigin(req)); const pathname = url.pathname; const method = req.method || "GET";
      if (pathname === "/healthz") { sendJson(res, 200, { ok: true, sharedAuth: true }); return; }
      if (pathname.startsWith("/api/")) { const handled = await apiHandler(req, res, url); if (!handled) sendJson(res, 404, { error: "API route not found." }); return; }
      if (!["GET", "HEAD"].includes(method)) { sendJson(res, 405, { error: "Method not allowed." }); return; }
      if (pathname === "/service-worker.js") { setSecurityHeaders(res); res.statusCode = 200; res.setHeader("Content-Type", "text/javascript; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); if (method === "HEAD") res.end(); else res.end(authSafeServiceWorker()); return; }
      if (pathname === "/login.html" || pathname === "/login") { if (await currentAuth(req)) redirect(res, "/"); else serveFile(req, res, path.join(rootDir, "login.html"), { cacheControl: "no-store" }); return; }
      if (pathname === "/" || pathname === "/index.html") { const auth = await currentAuth(req); if (!auth) { redirect(res, "/login.html"); return; } const html = injectAuthenticatedUi(fs.readFileSync(path.join(rootDir, "index.html"), "utf8")); setSecurityHeaders(res); res.statusCode = 200; res.setHeader("Content-Type", "text/html; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); if (method === "HEAD") res.end(); else res.end(html); return; }
      if (pathname === "/admin.html" || pathname === "/admin") { const auth = await currentAuth(req); if (!auth) { redirect(res, "/login.html"); return; } if (!isAdmin(auth.user)) { redirect(res, "/"); return; } serveFile(req, res, path.join(rootDir, "admin.html"), { cacheControl: "no-store" }); return; }
      if (pathname === "/recovery.html") { if (!await currentAuth(req)) { redirect(res, "/login.html"); return; } serveFile(req, res, path.join(rootDir, "recovery.html"), { cacheControl: "no-store" }); return; }
      const staticPath = safeStaticPath(rootDir, pathname); if (!staticPath) { sendJson(res, 404, { error: "Not found." }); return; } serveFile(req, res, staticPath);
    } catch (error) {
      const status = Number(error.statusCode || 500); if (status >= 500) console.error("[ServoForge Supabase Auth]", error); if (!res.headersSent) sendJson(res, status, { error: status >= 500 ? "Internal server error." : error.message }); else res.end();
    }
  });
}

async function main() {
  const dataDir = process.env.SERVOFORGE_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(ROOT_DIR, "data");
  const legacyStore = new AuthStore(dataDir);
  await syncLegacyUsers(legacyStore);
  const server = createServer({ legacyStore, dataDir });
  server.listen(DEFAULT_PORT, "0.0.0.0", () => {
    console.log(`[ServoForge Auth] listening on port ${DEFAULT_PORT}`);
    console.log(`[ServoForge Auth] backend: Supabase ${SUPABASE_URL}`);
    console.log(`[ServoForge Auth] legacy migration import: ${LEGACY_IMPORT ? "enabled" : "disabled"}`);
  });
}

if (require.main === module) main().catch((error) => { console.error("[ServoForge Supabase Auth] startup failed", error); process.exitCode = 1; });

module.exports = { createServer, publicUser, syntheticEmail };
