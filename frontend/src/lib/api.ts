import type { SearchResult, HierarchyNode, UnitProfile, Opportunity, PaiChatResponse, PlantResult } from "./types";

export const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${path}`, init);
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json() as Promise<T>;
}

const list = <T,>(d: unknown, key: string): T[] =>
  Array.isArray(d) ? (d as T[]) : Array.isArray((d as Record<string, unknown>)?.[key]) ? ((d as Record<string, T[]>)[key]) : [];

/** Normalize GeoJSON Point or [lon,lat] to [lon, lat]. */
function asLonLat(v: unknown): [number, number] | null {
  if (!v) return null;
  if (Array.isArray(v) && v.length >= 2 && Number.isFinite(Number(v[0])) && Number.isFinite(Number(v[1]))) {
    return [Number(v[0]), Number(v[1])];
  }
  if (typeof v === "object" && v !== null) {
    const g = v as { type?: string; coordinates?: number[] };
    if (g.coordinates && g.coordinates.length >= 2) {
      return [Number(g.coordinates[0]), Number(g.coordinates[1])];
    }
  }
  return null;
}

function asBbox(v: unknown): [number, number, number, number] | null {
  if (!v) return null;
  if (Array.isArray(v) && v.length >= 4) {
    return [Number(v[0]), Number(v[1]), Number(v[2]), Number(v[3])];
  }
  if (typeof v === "object" && v !== null) {
    const g = v as { type?: string; coordinates?: number[][][] };
    if (g.type === "Polygon" && g.coordinates?.[0]?.length) {
      const ring = g.coordinates[0];
      const xs = ring.map((p) => p[0]);
      const ys = ring.map((p) => p[1]);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    }
  }
  return null;
}

function normalizeSearch(r: Record<string, unknown>): SearchResult {
  return {
    ...(r as unknown as SearchResult),
    id: String(r.id),
    name: String(r.name ?? ""),
    level: r.level as SearchResult["level"],
    centroid: asLonLat(r.centroid),
    bbox: asBbox(r.bbox),
  };
}

export const searchPlaces = async (q: string, level?: string): Promise<SearchResult[]> => {
  const data = await j<Record<string, unknown>>(`/api/spatial/search?q=${encodeURIComponent(q)}&limit=20${level ? `&level=${level}` : ""}`);
  return list<Record<string, unknown>>(data, "results").map(normalizeSearch);
};

export const getHierarchy = async (id: string): Promise<HierarchyNode[]> => {
  const data = await j<Record<string, unknown>>(`/api/spatial/hierarchy/${encodeURIComponent(id)}`);
  // Prefer explicit hierarchy; fall back to parents + unit
  const h = list<HierarchyNode>(data, "hierarchy");
  if (h.length) return h;
  const parents = list<HierarchyNode>(data, "parents");
  const unit = data.unit as HierarchyNode | undefined;
  return unit ? [...parents, unit] : parents;
};

export const getProfile = async (id: string): Promise<UnitProfile> => {
  const raw = await j<Record<string, unknown>>(`/api/profiles/${encodeURIComponent(id)}`);
  // Already reshaped by backend; ensure safe defaults
  return {
    unit_id: String(raw.unit_id ?? id), unit: (raw.unit as UnitProfile["unit"]) ?? null, message: (raw.message as string) ?? null,
    name: raw.name as string | undefined,
    level: raw.level as UnitProfile["level"],
    computed: Boolean(raw.computed ?? raw.data_available),
    profiles: (raw.profiles as UnitProfile["profiles"]) ?? {},
    indices: (raw.indices as UnitProfile["indices"]) ?? {},
    air_volume_asset: (raw.air_volume_asset as UnitProfile["air_volume_asset"]) ?? null,
    provenance: (raw.provenance as UnitProfile["provenance"]) ?? null,
  };
};

export const getOpportunities = async (district?: string): Promise<Opportunity[]> => {
  const q = district ? `?district=${encodeURIComponent(district)}` : "";
  const data = await j<Record<string, unknown>>(`/api/opportunities/${q}`);
  // Map score_factors -> factors for cards
  return list<Record<string, unknown>>(data, "opportunities").map((o) => ({
    id: o.id as string | number,
    title: String(o.title ?? ""), title_hi: (o.title_hi as string) ?? null, category: (o.category as string) ?? null,
    description: (o.description as string) ?? null,
    score: (o.score as number) ?? null,
    factors: (o.factors as Opportunity["factors"]) ?? (o.score_factors as Opportunity["factors"]) ?? null,
    image_url: (o.image_url as string) ?? null,
    setup_steps: (o.setup_steps as Opportunity["setup_steps"]) ?? null,
  }));
};

export const getOpportunity = async (id: string | number): Promise<Opportunity> => {
  const o = await j<Record<string, unknown>>(`/api/opportunities/${id}`);
  const steps = o.setup_steps;
  return {
    id: o.id as string | number,
    title: String(o.title ?? ""), title_hi: (o.title_hi as string) ?? null, category: (o.category as string) ?? null,
    description: (o.description as string) ?? null,
    score: (o.score as number) ?? null,
    factors: (o.factors as Opportunity["factors"]) ?? (o.score_factors as Opportunity["factors"]) ?? null,
    image_url: (o.image_url as string) ?? null,
    setup_steps: Array.isArray(steps) ? (steps as Opportunity["setup_steps"]) : null,
  };
};

/** Layer GeoJSON. With unitId the server clips to that unit's polygon (focus mode). */
export const getLayer = async (endpoint: string, unitId?: string | null): Promise<GeoJSON.FeatureCollection> => {
  try {
    const data = await j<GeoJSON.FeatureCollection>(unitId ? `${endpoint}?unit_id=${encodeURIComponent(unitId)}` : endpoint);
    if (!data || !Array.isArray(data.features)) {
      return { type: "FeatureCollection", features: [] };
    }
    return data;
  } catch {
    return { type: "FeatureCollection", features: [] };
  }
};

export const askPai = (body: {
  message: string;
  lat?: number;
  lon?: number;
  district?: string;
  village?: string;
  language: "en" | "hi";
}) =>
  j<PaiChatResponse>("/api/pai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const identifyPlant = (file?: File, commonName?: string) => {
  const f = new FormData();
  if (file) f.append("file", file);
  if (commonName) f.append("common_name", commonName);
  return j<PlantResult>("/api/plant/identify", { method: "POST", body: f });
};

export const exportUrl = (id: string, kind: "pdf" | "csv" | "geojson" | "pack") =>
  `${API}/api/export/${encodeURIComponent(id)}/${kind}`;

/** District → overall opportunity score (0-100) for the choropleth. Empty when no profiles are computed yet. */
export const getDistrictScores = async (): Promise<Record<string, number>> => {
  try {
    const d = await j<{ units?: Array<{ name: string; overall_opportunity?: number | null }> }>("/api/profiles/?level=district&limit=200");
    const out: Record<string, number> = {};
    (d.units ?? []).forEach((u) => { if (u.overall_opportunity != null) out[u.name] = Number(u.overall_opportunity); });
    return out;
  } catch { return {}; }
};


/** Single admin unit with geometry + geotag (EPSG:4326). */
export type AdminUnit = {
  id: string;
  level: string;
  name: string;
  name_hi?: string | null;
  parent_id?: string | null;
  district_code?: string | null;
  geometry?: GeoJSON.Geometry | null;
  centroid?: [number, number] | null;
  bbox?: [number, number, number, number] | null;
  crs?: string;
  geotag?: { lon: number; lat: number; crs: string } | null;
  population?: number | null;
  area_sqkm?: number | null;
};

export const getUnit = (id: string) => j<AdminUnit>(`/api/spatial/unit/${encodeURIComponent(id)}`);

export const getChildren = (id: string, level?: string) =>
  j<GeoJSON.FeatureCollection>(
    `/api/spatial/unit/${encodeURIComponent(id)}/children${level ? `?level=${level}` : ""}`
  );

export const getBoundaries = (opts?: { level?: string; parent_id?: string }) => {
  const q = new URLSearchParams();
  if (opts?.level) q.set("level", opts.level);
  if (opts?.parent_id) q.set("parent_id", opts.parent_id);
  const s = q.toString();
  return j<GeoJSON.FeatureCollection>(`/api/spatial/layers/boundaries${s ? `?${s}` : ""}`);
};

/** Everything the map needs to show ONE place on its own (polygon, breadcrumb, children, per-layer counts). */
export type Focus = {
  unit: AdminUnit & { properties?: Record<string, unknown> | null };
  hierarchy: HierarchyNode[];
  children: GeoJSON.FeatureCollection;
  child_level: string | null;
  counts: Record<string, number>;
};
export const getFocus = (id: string) => j<Focus>(`/api/spatial/focus/${encodeURIComponent(id)}`);
export const getDistrictBoundaries = () => j<GeoJSON.FeatureCollection>("/api/spatial/layers/boundaries?level=district");

export type DistrictInfo = {
  unit_id: string; district: string; division?: string | null; source?: string | null; boundary_area_sqkm?: number | null;
  sections: Record<string, Record<string, unknown>>; generic_fields: string[]; updated_at?: string | null;
};
/** Accepts a district id or any unit inside it. */
export const getDistrictInfo = (id: string) => j<DistrictInfo>(`/api/profiles/district-info/${encodeURIComponent(id)}`);
