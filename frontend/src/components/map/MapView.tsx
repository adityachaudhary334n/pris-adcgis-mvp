"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LAYERS } from "@/lib/layers";
import { getLayer } from "@/lib/api";
import { REF_DISTRICTS, REF_STATE, UP_BBOX, bboxOf, norm } from "@/lib/geo";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

export type LayerStatus = "loading" | "ready" | "missing";
export type BasemapId = "dark" | "street" | "satellite" | "terrain" | "plain";
export interface PickEvent { lat: number; lon: number; unitId?: string; name?: string; level?: string }
export interface FocusState { unitId: string; unit: GeoJSON.Feature; children: GeoJSON.FeatureCollection | null }
interface Props {
  lang: Lang;
  basemap: BasemapId;
  visible: Record<string, boolean>;
  onStatus: (id: string, s: LayerStatus) => void;
  flyTo: { centroid?: [number, number] | null; bbox?: [number, number, number, number] | null; nonce: number } | null;
  onPick: (p: PickEvent) => void;
  marker: [number, number] | null;
  highlight: GeoJSON.FeatureCollection | null;
  focus: FocusState | null; // null = full state map
  scores: Record<string, number>;
  panelOpen: boolean;
}

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
export const BASEMAPS: Record<BasemapId, { layer: string; bg: string }> = {
  dark: { layer: "bm-dark", bg: "#0B1220" }, street: { layer: "bm-street", bg: "#E5E7EB" }, satellite: { layer: "bm-sat", bg: "#0B1220" },
  terrain: { layer: "bm-terrain", bg: "#E5E7EB" }, plain: { layer: "", bg: "#0F172A" },
};
const BM_LAYERS = ["bm-dark", "bm-street", "bm-sat", "bm-terrain"];
const OSM = ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"];
const LEVEL_COLOR = ["match", ["get", "level"], "block", "#F59E0B", "village", "#38BDF8", "district", "#10B981", "#7DD3FC"];

function buildStyle(bm: BasemapId): maplibregl.StyleSpecification {
  const vis = (id: BasemapId) => ({ visibility: bm === id ? "visible" : "none" });
  const layers = [
    { id: "bg", type: "background", paint: { "background-color": BASEMAPS[bm].bg } },
    { id: "bm-dark", type: "raster", source: "osm", layout: vis("dark"), paint: { "raster-opacity": 0.6, "raster-saturation": -0.85, "raster-brightness-max": 0.5, "raster-contrast": 0.2 } },
    { id: "bm-street", type: "raster", source: "osm", layout: vis("street") },
    { id: "bm-sat", type: "raster", source: "esri", layout: vis("satellite") },
    { id: "bm-terrain", type: "raster", source: "topo", layout: vis("terrain") },
    { id: "ref-fill", type: "fill", source: "ref", paint: {
      "fill-color": ["case", ["has", "score"], ["interpolate", ["linear"], ["get", "score"], 0, "#334155", 50, "#0284C7", 100, "#10B981"], "#0284C7"],
      "fill-opacity": ["case", ["has", "score"], 0.55, 0.16] } },
    { id: "ref-hover", type: "fill", source: "ref", filter: ["==", ["get", "id"], ""], paint: { "fill-color": "#F59E0B", "fill-opacity": 0.3 } },
    { id: "ref-line", type: "line", source: "ref", paint: { "line-color": "#7DD3FC", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.7, 10, 1.6], "line-opacity": 0.75 } },
    { id: "state-glow", type: "line", source: "state", paint: { "line-color": "#38BDF8", "line-width": 7, "line-blur": 7, "line-opacity": 0.45 } },
    { id: "state-line", type: "line", source: "state", paint: { "line-color": "#BAE6FD", "line-width": 1.8 } },
  ] as unknown as maplibregl.LayerSpecification[];
  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      osm: { type: "raster", tiles: OSM, tileSize: 256, maxzoom: 19, attribution: "© OpenStreetMap contributors" },
      esri: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, maxzoom: 18, attribution: "Imagery © Esri, Maxar, Earthstar Geographics" },
      topo: { type: "raster", tiles: ["a", "b", "c"].map((s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`), tileSize: 256, maxzoom: 17, attribution: "© OpenStreetMap contributors, SRTM | © OpenTopoMap (CC-BY-SA)" },
      ref: { type: "geojson", data: REF_DISTRICTS },
      state: { type: "geojson", data: REF_STATE },
    },
    layers,
  };
}

const hasWebGL = () => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } };
const pad = (panelOpen: boolean) => {
  const wide = window.innerWidth >= 768;
  return { top: 96, left: 56, right: wide ? (panelOpen ? 470 : 70) : 24, bottom: wide ? 48 : panelOpen ? Math.round(window.innerHeight * 0.42) : 90 };
};

/** World polygon with the focused unit cut out: dims everything that is not the searched place. */
function maskFor(g: GeoJSON.Geometry | undefined): GeoJSON.FeatureCollection {
  if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) return EMPTY;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  const holes = polys.map((p) => p[0]);
  return { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], ...holes] } }] };
}

/** Popup content via textContent only (API strings are never injected as HTML). */
function popupFor(p: Record<string, unknown>): HTMLElement {
  const box = document.createElement("div");
  const h = document.createElement("strong"); h.textContent = String(p.title ?? p.common_name ?? p.species_name ?? p.indicator_type ?? p.name ?? "Feature"); box.appendChild(h);
  const row = (label: string, v: unknown) => { if (v == null || v === "") return; const d = document.createElement("div"); d.textContent = `${label}: ${v}`; box.appendChild(d); };
  row("Score", p.score != null ? Math.round(Number(p.score)) : null); row("Category", p.category); row("Type", p.type);
  if (p.value != null) row("Value", `${p.value}${p.unit ? " " + p.unit : ""}${p.quality_label ? " (" + p.quality_label + ")" : ""}`);
  row("Source", p.source); row("Confidence", p.confidence);
  return box;
}

/** No-WebGL fallback: the bundled district outline as SVG. */
function StaticMap({ onPick }: { onPick: (p: PickEvent) => void }) {
  const W = 1000, k = Math.cos((27 * Math.PI) / 180);
  const [w, s, e, n] = UP_BBOX; const H = ((n - s) / ((e - w) * k)) * W;
  const proj = (x: number, y: number) => `${((x - w) / (e - w)) * W},${((n - y) / (n - s)) * H}`;
  const paths = useMemo(() => REF_DISTRICTS.features.map((f) => {
    const g = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    return { id: String(f.properties?.id), name: String(f.properties?.name), bbox: bboxOf(g),
      d: polys.map((poly) => poly.map((ring) => "M" + ring.map((c) => proj(c[0], c[1])).join("L") + "Z").join("")).join("") };
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Uttar Pradesh districts">
      {paths.map((p) => <path key={p.id} d={p.d} tabIndex={0} role="button" aria-label={p.name} fill="#0284C7" fillOpacity={0.25} stroke="#7DD3FC" strokeWidth="1.2" className="cursor-pointer hover:fill-gold"
        onClick={() => p.bbox && onPick({ lon: (p.bbox[0] + p.bbox[2]) / 2, lat: (p.bbox[1] + p.bbox[3]) / 2, unitId: p.id, name: p.name, level: "district" })} />)}
    </svg>
  );
}

export default function MapView({ lang, basemap, visible, onStatus, flyTo, onPick, marker, highlight, focus, scores, panelOpen }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const pin = useRef<maplibregl.Marker | null>(null);
  const ready = useRef(false);
  const cb = useRef({ onPick, onStatus }); cb.current = { onPick, onStatus };
  const vis = useRef(visible); vis.current = visible;
  const focusId = useRef<string | null>(null); focusId.current = focus?.unitId ?? null;
  const panel = useRef(panelOpen); panel.current = panelOpen;
  const [phase, setPhase] = useState<"starting" | "ready" | "nogl" | "slow">("starting");
  const [basemapOff, setBasemapOff] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    if (!el.current) return;
    if (!hasWebGL()) { setPhase("nogl"); return; }
    let m: MLMap; let cancelled = false;
    try {
      m = new maplibregl.Map({ container: el.current, style: buildStyle(basemap), bounds: UP_BBOX, fitBoundsOptions: { padding: pad(true) }, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, maxBounds: [[66, 15], [96, 38]] });
    } catch { setPhase("nogl"); return; }
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    m.addControl(new maplibregl.ScaleControl({ maxWidth: 90 }), "bottom-left");
    const resize = () => { try { m.resize(); } catch { /* ignore */ } };
    [0, 80, 300, 900, 2000].forEach((d) => setTimeout(resize, d));
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null; ro?.observe(el.current);
    const slow = setTimeout(() => { if (!ready.current) setPhase((p) => (p === "starting" ? "slow" : p)); }, 9000);
    let tileErrors = 0;
    m.on("error", (ev) => { const e = ev as unknown as { sourceId?: string }; if (e.sourceId && ["osm", "esri", "topo"].includes(e.sourceId) && ++tileErrors > 8) setBasemapOff(true); });

    m.on("load", () => {
      if (cancelled) return;
      ready.current = true; setPhase("ready"); resize();
      const add = (spec: unknown) => m.addLayer(spec as maplibregl.LayerSpecification);
      m.addSource("mask", { type: "geojson", data: EMPTY });
      add({ id: "mask", type: "fill", source: "mask", paint: { "fill-color": "#0B1220", "fill-opacity": 0.86 } });
      m.addSource("children", { type: "geojson", data: EMPTY, promoteId: "id" });
      add({ id: "children-fill", type: "fill", source: "children", paint: { "fill-color": LEVEL_COLOR, "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.5, 0.22] } });
      add({ id: "children-line", type: "line", source: "children", paint: { "line-color": LEVEL_COLOR, "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.8, 12, 1.8], "line-opacity": 0.95 } });
      m.addSource("selected", { type: "geojson", data: EMPTY });
      add({ id: "selected-fill", type: "fill", source: "selected", paint: { "fill-color": "#F59E0B", "fill-opacity": 0.08 } });
      add({ id: "selected-line", type: "line", source: "selected", paint: { "line-color": "#F59E0B", "line-width": 3.5 } });
      const label = (id: string, src: string, minzoom: number, size: number) => add({ id, type: "symbol", source: src, minzoom,
        layout: { "text-field": ["get", "name"], "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"], "text-size": size, "text-max-width": 7, "text-padding": 3 },
        paint: { "text-color": "#FFFFFF", "text-halo-color": "#0B1220", "text-halo-width": 1.8 } });
      label("children-label", "children", 8, 13); label("selected-label", "selected", 5, 15);
      m.addSource("plant-highlight", { type: "geojson", data: EMPTY });
      add({ id: "plant-highlight", type: "circle", source: "plant-highlight", paint: { "circle-radius": 12, "circle-color": "#10B981", "circle-stroke-width": 3, "circle-stroke-color": "#fff" } });

      LAYERS.forEach(async (L) => {
        cb.current.onStatus(L.id, "loading");
        const all = await getLayer(L.endpoint);
        if (cancelled || m.getSource(L.id)) return;
        // the toggle is enabled only if the state has data; in focus mode the server clips each layer to the unit
        const data = focusId.current ? await getLayer(L.endpoint, focusId.current) : all;
        m.addSource(L.id, { type: "geojson", data });
        const layout = { visibility: (vis.current[L.id] ? "visible" : "none") as "visible" | "none" };
        if (L.kind === "fill") add({ id: L.id, type: "fill", source: L.id, layout, paint: { "fill-color": L.color, "fill-opacity": 0.35, "fill-outline-color": L.color } });
        else add({ id: L.id, type: "circle", source: L.id, layout, paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 6, 12, 11], "circle-color": L.color, "circle-stroke-width": 2.5, "circle-stroke-color": "#0F172A" } });
        cb.current.onStatus(L.id, all.features.length ? "ready" : "missing");
      });
    });

    const dataLayers = () => LAYERS.map((l) => l.id).filter((id) => m.getLayer(id) && vis.current[id]);
    const areaLayers = () => (focusId.current ? ["children-fill"] : ["ref-fill"]).filter((id) => m.getLayer(id));
    let hovered: string | number | undefined;
    m.on("mousemove", (e) => {
      const over = [...dataLayers(), ...areaLayers()];
      m.getCanvas().style.cursor = over.length && m.queryRenderedFeatures(e.point, { layers: over }).length ? "pointer" : "";
      const f = areaLayers().length ? m.queryRenderedFeatures(e.point, { layers: areaLayers() })[0] : undefined;
      const props = (f?.properties ?? {}) as Record<string, unknown>;
      if (!focusId.current) { m.setFilter("ref-hover", ["==", ["get", "id"], String(props.id ?? "")]); }
      else if (m.getSource("children")) {
        if (hovered !== undefined) m.setFeatureState({ source: "children", id: hovered }, { hover: false });
        hovered = f?.id; if (hovered !== undefined) m.setFeatureState({ source: "children", id: hovered }, { hover: true });
      }
      setHover(f ? String(props.name ?? "") : null);
    });
    m.on("mouseout", () => setHover(null));
    m.on("click", (e) => {
      const dl = dataLayers();
      const pt = dl.length ? m.queryRenderedFeatures(e.point, { layers: dl })[0] : undefined;
      if (pt) new maplibregl.Popup({ maxWidth: "260px", className: "pris-popup" }).setLngLat(e.lngLat).setDOMContent(popupFor((pt.properties ?? {}) as Record<string, unknown>)).addTo(m);
      const al = areaLayers();
      const a = al.length ? m.queryRenderedFeatures(e.point, { layers: al })[0] : undefined;
      const p = (a?.properties ?? {}) as Record<string, unknown>;
      cb.current.onPick({ lat: e.lngLat.lat, lon: e.lngLat.lng, unitId: p.id ? String(p.id) : undefined, name: p.name ? String(p.name) : undefined, level: p.level ? String(p.level) : focusId.current ? undefined : "district" });
    });
    return () => { cancelled = true; clearTimeout(slow); ro?.disconnect(); try { m.remove(); } catch { /* ignore */ } map.current = null; ready.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // base map switch
  useEffect(() => { const m = map.current; if (!m || !ready.current) return;
    BM_LAYERS.forEach((id) => m.setLayoutProperty(id, "visibility", BASEMAPS[basemap].layer === id ? "visible" : "none"));
    m.setPaintProperty("bg", "background-color", BASEMAPS[basemap].bg); setBasemapOff(false); }, [basemap, phase]);

  useEffect(() => { const m = map.current; if (!m || !ready.current) return;
    LAYERS.forEach((L) => { if (m.getLayer(L.id)) m.setLayoutProperty(L.id, "visibility", visible[L.id] ? "visible" : "none"); }); }, [visible, phase]);

  // state view <-> focus view
  useEffect(() => { const m = map.current; if (!m || !ready.current) return;
    const on = !!focus; const v = (x: boolean) => (x ? "visible" : "none");
    ["ref-fill", "ref-hover", "ref-line", "state-glow", "state-line"].forEach((id) => m.setLayoutProperty(id, "visibility", v(!on)));
    const set = (id: string, d: GeoJSON.FeatureCollection) => (m.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData(d);
    const lvl = (focus?.unit.properties as { level?: string } | undefined)?.level;
    set("mask", on && lvl !== "state" ? maskFor(focus?.unit.geometry) : EMPTY);
    set("selected", on ? { type: "FeatureCollection", features: [focus!.unit] } : EMPTY);
    set("children", focus?.children ?? EMPTY);
    // data layers: clip to the unit on the server (or restore the whole state)
    LAYERS.forEach(async (L) => { if (!m.getSource(L.id)) return; const d = await getLayer(L.endpoint, focus?.unitId); (m.getSource(L.id) as maplibregl.GeoJSONSource | undefined)?.setData(d); });
  }, [focus, phase]);

  useEffect(() => { const m = map.current; if (!m || !flyTo) return;
    try {
      if (flyTo.bbox) m.fitBounds([[flyTo.bbox[0], flyTo.bbox[1]], [flyTo.bbox[2], flyTo.bbox[3]]], { padding: pad(panel.current), duration: 1000, maxZoom: 14 });
      else if (flyTo.centroid) m.flyTo({ center: flyTo.centroid, zoom: 11, duration: 1000 });
    } catch { /* ignore */ } }, [flyTo]);

  useEffect(() => { const m = map.current; if (!m) return; pin.current?.remove(); pin.current = null;
    if (marker) pin.current = new maplibregl.Marker({ color: "#F59E0B" }).setLngLat(marker).addTo(m); }, [marker]);
  useEffect(() => { const m = map.current; if (!m || !ready.current) return;
    (m.getSource("plant-highlight") as maplibregl.GeoJSONSource | undefined)?.setData(highlight ?? EMPTY); }, [highlight, phase]);
  useEffect(() => { const m = map.current; if (!m) return;
    const src = m.getSource("ref") as maplibregl.GeoJSONSource | undefined; if (!src) return;
    const by = new Map(Object.entries(scores).map(([k, v]) => [norm(k), v]));
    src.setData({ ...REF_DISTRICTS, features: REF_DISTRICTS.features.map((f) => { const s = by.get(norm(String(f.properties?.name))); return s == null ? f : { ...f, properties: { ...f.properties, score: s } }; }) }); }, [scores, phase]);
  // keep the map correctly sized when the data panel opens/closes
  useEffect(() => { const id = setTimeout(() => { try { map.current?.resize(); } catch { /* ignore */ } }, 350); return () => clearTimeout(id); }, [panelOpen]);

  return (
    <div className="absolute inset-0 z-0 bg-[#0B1220]">
      <div ref={el} className={`absolute inset-0 ${phase === "nogl" ? "hidden" : ""}`} style={{ width: "100%", height: "100%" }} role="application" aria-label="Map of Uttar Pradesh" />
      {phase === "nogl" && <div className="absolute inset-0 flex flex-col items-center justify-center p-4 pt-28 md:pr-[30rem]"><p className="mb-3 max-w-md rounded-xl bg-obsidian/90 p-3 text-center font-semibold">{t("mapNoWebgl", lang)}</p><StaticMap onPick={onPick} /></div>}
      {phase === "starting" && <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="animate-pulse rounded-full bg-obsidian/80 px-5 py-3 font-semibold">{t("mapStarting", lang)}</div></div>}
      {phase === "slow" && <div className="absolute left-1/2 top-28 -translate-x-1/2 rounded-xl bg-gold px-4 py-2 font-bold text-obsidian">{t("mapSlow", lang)}</div>}
      {phase === "ready" && hover && <div className="pointer-events-none absolute bottom-24 left-1/2 hidden -translate-x-1/2 rounded-full bg-obsidian/90 px-4 py-2 font-semibold shadow-xl ring-1 ring-gold md:block">{hover} · <span className="text-gold">{t("hoverOpen", lang)}</span></div>}
      {basemapOff && <div className="pointer-events-none absolute bottom-24 left-3 max-w-xs rounded-lg bg-obsidian/90 px-3 py-2 text-sm text-slate-200 md:bottom-12">{t("basemapOff", lang)}</div>}
    </div>
  );
}
