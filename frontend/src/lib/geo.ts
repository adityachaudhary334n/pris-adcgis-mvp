import districts from "@/data/up-districts.json";
import state from "@/data/up-state.json";

/**
 * Bundled, simplified outline of the 75 Uttar Pradesh districts generated from the same SOI/LGD village data as the
 * database (scripts/build_up_admin.py). Feature ids equal the database ids, so a click can open a unit without any
 * lookup. It exists so the first frame is never empty, even before the API answers.
 */
export const REF_DISTRICTS = districts as unknown as GeoJSON.FeatureCollection;
export const REF_STATE = state as unknown as GeoJSON.FeatureCollection;
export const UP_BBOX: [number, number, number, number] = [77.05, 23.85, 84.7, 30.45];

type Pos = number[];
export function bboxOf(g?: GeoJSON.Geometry | null): [number, number, number, number] | null {
  if (!g || !("coordinates" in g)) return null;
  let w = 180, s = 90, e = -180, n = -90, any = false;
  const walk = (c: unknown): void => {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === "number") { const p = c as Pos; w = Math.min(w, p[0]); e = Math.max(e, p[0]); s = Math.min(s, p[1]); n = Math.max(n, p[1]); any = true; }
    else c.forEach(walk);
  };
  walk(g.coordinates);
  return any ? [w, s, e, n] : null;
}
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
export const findRefDistrict = (name: string) => REF_DISTRICTS.features.find((f) => norm(String(f.properties?.name)) === norm(name)) ?? null;
