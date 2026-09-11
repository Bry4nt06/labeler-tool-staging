import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://bry4nt06.github.io",
  "https://labeler-tool-staging-production.up.railway.app",
  "https://labeler-tool-app-production.up.railway.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:8000",
  "http://127.0.0.1:8000"
]);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } }
);

function cors(origin: string | null) {
  const allowed = origin && (ALLOWED_ORIGINS.has(origin) || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"));
  return {
    "Access-Control-Allow-Origin": allowed ? origin! : "https://bry4nt06.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json"
  };
}

function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), { status, headers: cors(origin) });
}

function clean(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function locationCode(value: unknown) {
  return clean(value, 12).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
}

function packageMetadata(row: any) {
  const summary = row?.validation_summary && typeof row.validation_summary === "object" ? row.validation_summary : {};
  return {
    zone: locationCode(summary.communityZone || summary.communityLocation?.zone),
    site: locationCode(summary.communitySite || summary.communityLocation?.site),
    specs: [
      clean(summary.communityBottleSpecNumber, 80),
      clean(summary.communityBrandSpecNumber, 80)
    ].filter(Boolean)
  };
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function adminAuthorized(adminKey: string) {
  if (!adminKey) return false;
  const candidate = await sha256(adminKey);
  const { data, error } = await supabase.from("feedback_admin_config").select("admin_key_hash").eq("id", true).maybeSingle();
  if (error) throw error;
  return !!data?.admin_key_hash && data.admin_key_hash === candidate;
}

function payloadShape(type: string, payload: any) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "Configuration payload must be an object.";
  const size = new TextEncoder().encode(JSON.stringify(payload)).length;
  if (size > 300000) return "Configuration package is too large.";
  if (type === "map") {
    if (!payload.map || typeof payload.map !== "object") return "Map package is missing map data.";
    if (!clean(payload.map.name, 160)) return "Map package requires a map name.";
  } else if (type === "bottle") {
    if (!payload.bottle || typeof payload.bottle !== "object") return "Bottle package is missing bottle data.";
    if (!clean(payload.bottle.bottleType, 160)) return "Bottle package requires a bottle type.";
  } else if (type === "brand") {
    if (!payload.brand || typeof payload.brand !== "object") return "Brand package is missing brand data.";
    if (!clean(payload.brand.brand, 160)) return "Brand package requires a brand name.";
  } else if (type === "rpc_program") {
    const program = payload.rpcProgram;
    if (!program || typeof program !== "object" || Array.isArray(program)) return "RPC Program package is missing program data.";
    if (!clean(program.name, 80)) return "RPC Program requires a program name.";
    if (!program.simulation || typeof program.simulation !== "object" || Array.isArray(program.simulation)) return "RPC Program requires simulation settings.";
    if (!Array.isArray(program.simulation.turns) || !Array.isArray(program.simulation.rows) || !Array.isArray(program.simulation.deletedRows) || !Array.isArray(program.simulation.lines)) return "RPC Program simulation settings are incomplete.";
    if (program.simulation.turns.length > 1000 || program.simulation.rows.length > 1000 || program.simulation.deletedRows.length > 1000 || program.simulation.lines.length > 1000) return "RPC Program contains too many simulation rows.";
  } else return "Unknown package type.";
  return "";
}

function packageView(row: any, stats: any = {}, includePayload = false) {
  const item: any = {
    id: row.id,
    packageNumber: row.package_number,
    type: row.package_type,
    status: row.status,
    name: row.name,
    description: row.description,
    authorName: row.author_name,
    machineType: row.machine_type,
    application: row.application,
    brandName: row.brand_name,
    bottleName: row.bottle_name,
    schemaVersion: row.schema_version,
    servoforgeVersion: row.servoforge_version,
    validationSummary: row.validation_summary ?? {},
    rejectionReason: row.rejection_reason,
    downloadCount: Number(row.download_count || 0),
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ratingAverage: stats.average ?? 0,
    ratingCount: stats.count ?? 0,
    reviews: stats.reviews ?? []
  };
  if (includePayload) item.configPayload = row.config_payload;
  return item;
}

async function ratingStats(ids: string[], viewerHash = "") {
  const result: Record<string, any> = {};
  ids.forEach((id) => result[id] = { sum: 0, count: 0, average: 0, reviews: [], myRating: null });
  if (!ids.length) return result;
  const { data, error } = await supabase.from("community_package_ratings").select("package_id,rating,review,updated_at,owner_token_hash").in("package_id", ids).order("updated_at", { ascending: false });
  if (error) throw error;
  for (const row of data ?? []) {
    const stats = result[row.package_id] ||= { sum: 0, count: 0, average: 0, reviews: [], myRating: null };
    stats.sum += Number(row.rating || 0);
    stats.count += 1;
    if (row.review && stats.reviews.length < 5) stats.reviews.push({ rating: row.rating, review: row.review, updatedAt: row.updated_at });
    if (viewerHash && row.owner_token_hash === viewerHash) stats.myRating = { rating: row.rating, review: row.review };
  }
  Object.values(result).forEach((stats: any) => { stats.average = stats.count ? Math.round((stats.sum / stats.count) * 10) / 10 : 0; });
  return result;
}

async function ownedPackage(tokenHash: string, id: string) {
  const { data, error } = await supabase.from("community_packages").select("*").eq("id", id).eq("owner_token_hash", tokenHash).maybeSingle();
  if (error) throw error;
  return data;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin) && !origin.startsWith("http://localhost:") && !origin.startsWith("http://127.0.0.1:")) return json({ error: "Origin not allowed" }, 403, origin);

  try {
    const body = await req.json().catch(() => ({}));
    const action = clean(body?.action, 40);
    const token = clean(body?.token, 240);
    const adminKey = clean(body?.adminKey, 240);

    if (action.startsWith("admin")) {
      if (!(await adminAuthorized(adminKey))) return json({ error: "Unauthorized" }, 401, origin);
      if (action === "adminList") {
        const status = clean(body?.status, 30);
        let query = supabase.from("community_packages").select("*").order("updated_at", { ascending: false }).limit(250);
        if (["pending","published","rejected"].includes(status)) query = query.eq("status", status);
        const { data, error } = await query;
        if (error) throw error;
        const ids = (data ?? []).map((x: any) => x.id);
        const stats = await ratingStats(ids);
        return json({ packages: (data ?? []).map((row: any) => packageView(row, stats[row.id])) }, 200, origin);
      }
      if (action === "adminStatus") {
        const id = clean(body?.packageId, 80);
        const status = clean(body?.status, 20);
        const reason = clean(body?.reason, 500);
        if (!id || !["pending","published","rejected"].includes(status)) return json({ error: "Invalid package status" }, 400, origin);
        const patch: any = { status, rejection_reason: status === "rejected" ? (reason || "Not approved for publication.") : null };
        if (status === "published") patch.published_at = new Date().toISOString();
        const { error } = await supabase.from("community_packages").update(patch).eq("id", id);
        if (error) throw error;
        return json({ ok: true }, 200, origin);
      }
      if (action === "adminDelete") {
        const id = clean(body?.packageId, 80);
        if (!id) return json({ error: "Package is required" }, 400, origin);
        const { error } = await supabase.from("community_packages").delete().eq("id", id);
        if (error) throw error;
        return json({ ok: true }, 200, origin);
      }
      return json({ error: "Unknown admin action" }, 400, origin);
    }

    if (!token || token.length < 20) return json({ error: "Community identity is unavailable" }, 400, origin);
    const tokenHash = await sha256(token);

    if (action === "browse") {
      const type = clean(body?.type, 20);
      const search = clean(body?.search, 120).toLowerCase();
      const zone = locationCode(body?.zone);
      const site = locationCode(body?.site);
      const spec = clean(body?.spec, 80).toLowerCase();
      let query = supabase.from("community_packages").select("*").eq("status", "published").order("published_at", { ascending: false }).limit(200);
      if (["map","bottle","brand","bundle","rpc_program"].includes(type)) query = query.eq("package_type", type);
      const { data, error } = await query;
      if (error) throw error;
      let rows = data ?? [];
      if (search) rows = rows.filter((row: any) => {
        const metadata = packageMetadata(row);
        return [row.name,row.description,row.author_name,row.machine_type,row.application,row.brand_name,row.bottle_name,metadata.zone,metadata.site,...metadata.specs].some((v) => String(v ?? "").toLowerCase().includes(search));
      });
      if (zone || site || spec) rows = rows.filter((row: any) => {
        const metadata = packageMetadata(row);
        return (!zone || metadata.zone === zone)
          && (!site || metadata.site === site)
          && (!spec || metadata.specs.some((value) => value.toLowerCase() === spec));
      });
      const ids = rows.map((row: any) => row.id);
      const stats = await ratingStats(ids, tokenHash);
      return json({ packages: rows.map((row: any) => ({ ...packageView(row, stats[row.id]), myRating: stats[row.id]?.myRating ?? null })) }, 200, origin);
    }

    if (action === "download") {
      const id = clean(body?.packageId, 80);
      const { data: row, error } = await supabase.from("community_packages").select("*").eq("id", id).eq("status", "published").maybeSingle();
      if (error) throw error;
      if (!row) return json({ error: "Package not found" }, 404, origin);
      await supabase.from("community_packages").update({ download_count: Number(row.download_count || 0) + 1 }).eq("id", id);
      const stats = await ratingStats([id], tokenHash);
      return json({ package: { ...packageView({ ...row, download_count: Number(row.download_count || 0) + 1 }, stats[id], true), myRating: stats[id]?.myRating ?? null } }, 200, origin);
    }

    if (action === "my") {
      const { data, error } = await supabase.from("community_packages").select("*").eq("owner_token_hash", tokenHash).order("updated_at", { ascending: false }).limit(100);
      if (error) throw error;
      const ids = (data ?? []).map((row: any) => row.id);
      const stats = await ratingStats(ids, tokenHash);
      return json({ packages: (data ?? []).map((row: any) => ({ ...packageView(row, stats[row.id]), myRating: stats[row.id]?.myRating ?? null })) }, 200, origin);
    }

    if (action === "upload") {
      const type = clean(body?.type, 20);
      if (type === "bundle") return json({ error: "Complete Setup uploads are no longer supported." }, 400, origin);
      const payload = body?.configPayload;
      const shapeError = payloadShape(type, payload);
      if (shapeError) return json({ error: shapeError }, 400, origin);
      const name = clean(body?.name, 160);
      if (!name) return json({ error: "Package name is required" }, 400, origin);
      const authorName = clean(body?.authorName, 60);
      if (!authorName) return json({ error: "Display Name is required." }, 400, origin);
      const sourceSummary = body?.validationSummary && typeof body.validationSummary === "object" && !Array.isArray(body.validationSummary) ? body.validationSummary : {};
      const zone = locationCode(sourceSummary.communityZone || sourceSummary.communityLocation?.zone);
      const site = locationCode(sourceSummary.communitySite || sourceSummary.communityLocation?.site);
      if (zone.length < 2 || site.length < 2) return json({ error: "Zone and Site must be 2–3 characters." }, 400, origin);
      const validationSummary = {
        ...sourceSummary,
        communityZone: zone,
        communitySite: site,
        communityLocation: { zone, site },
        communityBottleSpecNumber: clean(sourceSummary.communityBottleSpecNumber, 80),
        communityBrandSpecNumber: clean(sourceSummary.communityBrandSpecNumber, 80)
      };
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count, error: countError } = await supabase.from("community_packages").select("id", { count: "exact", head: true }).eq("owner_token_hash", tokenHash).gte("created_at", since);
      if (countError) throw countError;
      if ((count ?? 0) >= 12) return json({ error: "Too many uploads. Try again later." }, 429, origin);
      const row = {
        owner_token_hash: tokenHash,
        package_type: type,
        status: "pending",
        name,
        description: clean(body?.description, 600),
        author_name: authorName,
        machine_type: clean(body?.machineType, 100) || null,
        application: clean(body?.application, 40) || null,
        brand_name: clean(body?.brandName, 160) || null,
        bottle_name: clean(body?.bottleName, 160) || null,
        schema_version: Math.max(1, Math.min(100, Number(body?.schemaVersion || 1))),
        servoforge_version: clean(body?.servoforgeVersion, 80) || null,
        config_payload: payload,
        validation_summary: validationSummary
      };
      const { data, error } = await supabase.from("community_packages").insert(row).select("*").single();
      if (error) throw error;
      return json({ package: packageView(data) }, 201, origin);
    }

    if (action === "deleteOwn") {
      const id = clean(body?.packageId, 80);
      const row = await ownedPackage(tokenHash, id);
      if (!row) return json({ error: "Package not found" }, 404, origin);
      if (row.status === "published") return json({ error: "Published packages must be removed by a Community Admin." }, 400, origin);
      const { error } = await supabase.from("community_packages").delete().eq("id", id).eq("owner_token_hash", tokenHash);
      if (error) throw error;
      return json({ ok: true }, 200, origin);
    }

    if (action === "rate") {
      const id = clean(body?.packageId, 80);
      const rating = Number(body?.rating);
      const review = clean(body?.review, 200);
      if (!id || !Number.isInteger(rating) || rating < 1 || rating > 5) return json({ error: "Rating must be 1–5" }, 400, origin);
      const { data: packageRow, error: packageError } = await supabase.from("community_packages").select("id").eq("id", id).eq("status", "published").maybeSingle();
      if (packageError) throw packageError;
      if (!packageRow) return json({ error: "Package not found" }, 404, origin);
      const { error } = await supabase.from("community_package_ratings").upsert({ package_id: id, owner_token_hash: tokenHash, rating, review }, { onConflict: "package_id,owner_token_hash" });
      if (error) throw error;
      return json({ ok: true }, 200, origin);
    }

    return json({ error: "Unknown action" }, 400, origin);
  } catch (error) {
    console.error(error);
    return json({ error: "Community Library service error" }, 500, origin);
  }
});
