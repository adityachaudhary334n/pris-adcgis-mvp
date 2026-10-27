// Shared contract types. Swagger at http://localhost:8000/docs is the live source of truth;
// every field beyond the identifiers is optional so null/missing data never breaks the UI.
export type Lang = "en" | "hi";
export type Level = "state" | "district" | "block" | "village";

export interface SearchResult {
  path?: string | null; block?: string | null;
  id: string; name: string; name_hi?: string | null; level: Level;
  district?: string | null; centroid?: [number, number] | null; // [lon, lat]
  bbox?: [number, number, number, number] | null; // [w, s, e, n]
}
export interface HierarchyNode { id: string; name: string; name_hi?: string | null; level: Level }
export interface AirVolumeAsset {
  airspace_class?: string | null; max_usable_height_m?: number | null; solar_irradiance?: number | null;
  drone_corridor_score?: number | null; heritage_sensitivity?: string | number | null; agrivoltaic_suitability?: number | string | null;
  wind_class?: string | null; wind_speed_avg_ms?: number | null; pollution_load_index?: number | null; carbon_potential?: number | string | null; notes?: string | null; source?: string | null;
}
export interface AdminSummary {
  level: string; area_sqkm?: number; population?: number; counts?: Record<string, number>; codes?: Record<string, unknown>;
  gram_panchayat?: string; tehsil?: string; tehsils?: string[]; block?: string; district?: string; assembly_constituency_no?: number;
  name_in_survey_records?: string; lgd_code_missing?: boolean; source?: string;
}
export interface UnitProfile {
  admin_summary?: AdminSummary | null;
  unit_id: string; name?: string; level?: Level; computed?: boolean; unit?: { geometry?: GeoJSON.Geometry | null } | null; message?: string | null;
  profiles?: Record<string, Record<string, unknown> | null> | null;
  indices?: Record<string, number | null> | null;
  air_volume_asset?: AirVolumeAsset | null;
  provenance?: { source?: string; measured_at?: string; method?: string } | null;
}
export interface Opportunity {
  id: string | number; title: string; title_hi?: string | null; category?: string | null; description?: string | null; score?: number | null;
  factors?: Record<string, number | string> | string[] | null; image_url?: string | null;
  setup_steps?: Array<string | { step?: string; step_number?: number; title?: string; title_hi?: string | null; description?: string; description_hi?: string | null }> | null;
}
export interface PaiChatResponse {
  answer: string; sources?: Array<string | { title?: string; source?: string }> | null;
  data_available?: boolean | null; nearest_available?: string | null; opportunities?: Opportunity[] | null;
}
export interface PlantResult {
  common_name?: string | null; scientific_name?: string | null; matched?: boolean | null;
  cultivation_advice?: string | string[] | null; spatial_context?: string | null;
  highlight_geojson?: GeoJSON.FeatureCollection | null; message?: string | null;
}
export interface ChatMessage { role: "user" | "system"; text: string; meta?: PaiChatResponse }
