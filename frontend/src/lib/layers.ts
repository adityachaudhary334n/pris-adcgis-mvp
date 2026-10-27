import type { Key } from "./i18n";
export type GroupId = "livelihood" | "industry" | "natural" | "conservation" | "infra" | "air";
export interface LayerDef { id: string; group: GroupId; label: Key; endpoint: string; kind: "circle" | "fill"; color: string }
export const GROUPS: { id: GroupId; label: Key }[] = [
  { id: "livelihood", label: "g_livelihood" }, { id: "industry", label: "g_industry" }, { id: "natural", label: "g_natural" },
  { id: "conservation", label: "g_conservation" }, { id: "infra", label: "g_infra" }, { id: "air", label: "g_air" },
];
// First three endpoints are in the backend contract; the rest are the "extend similarly" layers and
// degrade to a "No data yet" badge if the backend has not exposed them.
export const LAYERS: LayerDef[] = [
  { id: "opportunities", group: "livelihood", label: "l_opportunities", endpoint: "/api/spatial/layers/opportunities", kind: "circle", color: "#F59E0B" },
  { id: "industrial", group: "industry", label: "l_industrial", endpoint: "/api/spatial/layers/industrial", kind: "circle", color: "#94A3B8" },
  { id: "sustainable", group: "industry", label: "l_sustainable", endpoint: "/api/spatial/layers/sustainable", kind: "circle", color: "#34D399" },
  { id: "water-soil", group: "natural", label: "l_water_soil", endpoint: "/api/spatial/layers/water-soil", kind: "circle", color: "#0284C7" },
  { id: "flora-fauna", group: "natural", label: "l_flora_fauna", endpoint: "/api/spatial/layers/flora-fauna", kind: "circle", color: "#10B981" },
  { id: "conservation", group: "conservation", label: "l_conservation", endpoint: "/api/spatial/layers/conservation", kind: "fill", color: "#10B981" },
  { id: "infrastructure", group: "infra", label: "l_infra", endpoint: "/api/spatial/layers/infrastructure", kind: "circle", color: "#E2E8F0" },
  { id: "air", group: "air", label: "l_air", endpoint: "/api/spatial/layers/air", kind: "circle", color: "#38BDF8" },
];
export const UP_CENTER: [number, number] = [80.9462, 26.8467]; // Lucknow
