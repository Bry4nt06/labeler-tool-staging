"use strict";

const originalFetch = global.fetch;

function detectEnvironment() {
  const explicit = String(process.env.SERVOFORGE_ENVIRONMENT || "").trim().toLowerCase();
  if (explicit.includes("staging")) return "staging";
  if (explicit.includes("prod")) return "production";

  const service = String(process.env.RAILWAY_SERVICE_NAME || "").trim().toLowerCase();
  if (service.includes("staging")) return "staging";
  if (service.includes("prod") || service.includes("labeler-tool-app")) return "production";

  const railwayEnvironment = String(process.env.RAILWAY_ENVIRONMENT_NAME || "").trim().toLowerCase();
  if (railwayEnvironment.includes("staging")) return "staging";
  if (railwayEnvironment.includes("prod")) return "production";

  return "unknown";
}

const runtimeEnvironment = detectEnvironment();

function profileCanEnter(profile) {
  if (!profile || typeof profile !== "object") return false;
  if (profile.role === "owner") return true;
  if (runtimeEnvironment === "staging") return profile.staging_access === true;
  if (runtimeEnvironment === "production") return profile.production_access !== false;
  return true;
}

function isProtectedProfileLookup(input, init) {
  const method = String(init?.method || (typeof input === "object" && input?.method) || "GET").toUpperCase();
  if (method !== "GET") return false;

  const rawUrl = typeof input === "string" || input instanceof URL
    ? String(input)
    : String(input?.url || "");

  let url;
  try { url = new URL(rawUrl); } catch { return false; }
  if (!/\/rest\/v1\/profiles$/i.test(url.pathname)) return false;

  return url.searchParams.has("username") || url.searchParams.has("id");
}

if (typeof originalFetch === "function") {
  global.fetch = async function servoForgeEnvironmentAwareFetch(input, init) {
    const response = await originalFetch(input, init);
    if (!response.ok || !isProtectedProfileLookup(input, init)) return response;

    let rows;
    try { rows = await response.clone().json(); } catch { return response; }
    if (!Array.isArray(rows)) return response;

    const filtered = rows.filter(profileCanEnter);
    if (filtered.length === rows.length) return response;

    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    headers.delete("transfer-encoding");
    headers.set("content-type", "application/json; charset=utf-8");

    return new Response(JSON.stringify(filtered), {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  };
}

console.log(`[ServoForge Auth] environment access gate: ${runtimeEnvironment}`);

module.exports = Object.freeze({
  detectEnvironment,
  profileCanEnter,
  runtimeEnvironment
});
