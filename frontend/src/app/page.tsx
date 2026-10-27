"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SearchBar from "@/components/SearchBar";
import Breadcrumb from "@/components/Breadcrumb";
import LayerControl from "@/components/map/LayerControl";
import type { BasemapId, FocusState, LayerStatus, PickEvent } from "@/components/map/MapView";
import ProfilePanel, { DownloadBar } from "@/components/profile/ProfilePanel";
import OpportunityCards from "@/components/opportunities/OpportunityCards";
import PaiChat from "@/components/chat/PaiChat";
import PlantUpload from "@/components/plant/PlantUpload";
import DistrictInfoSheet from "@/components/profile/DistrictInfoSheet";
import Onboarding from "@/components/Onboarding";
import { Icon, Panel, Pill, Skeleton } from "@/components/ui";
import { getDistrictScores, getFocus, getProfile, type Focus } from "@/lib/api";
import { REF_DISTRICTS, UP_BBOX } from "@/lib/geo";
import { t } from "@/lib/i18n";
import type { Lang, SearchResult, UnitProfile } from "@/lib/types";

const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 flex items-center justify-center bg-[#0B1220]"><Skeleton className="h-16 w-64" /></div>,
});
const STATE_ID = "00000000-0000-4000-8000-000000000001";
type Fly = { centroid?: [number, number] | null; bbox?: [number, number, number, number] | null; nonce: number };
const QUICK = ["Ayodhya", "Agra", "Kaushambi", "Lucknow", "Varanasi", "Gorakhpur"];
const DISTRICTS = REF_DISTRICTS.features.map((f) => ({ id: String(f.properties?.id), name: String(f.properties?.name) })).sort((a, b) => a.name.localeCompare(b.name));
const LEVEL_LABEL: Record<string, { en: string; hi: string }> = { state: { en: "State", hi: "राज्य" }, district: { en: "District", hi: "ज़िला" }, block: { en: "Block", hi: "ब्लॉक" }, village: { en: "Village", hi: "गाँव" } };
const CHILD_LABEL: Record<string, { en: string; hi: string }> = { district: { en: "Districts", hi: "ज़िले" }, block: { en: "Blocks", hi: "ब्लॉक" }, village: { en: "Villages", hi: "गाँव" } };

export default function Home() {
  const [lang, setLang] = useState<Lang>("en");
  const [welcome, setWelcome] = useState(true);
  const [basemap, setBasemap] = useState<BasemapId>("dark");
  const [visible, setVisible] = useState<Record<string, boolean>>({ opportunities: true });
  const [status, setStatus] = useState<Record<string, LayerStatus>>({});
  const [layersOpen, setLayersOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [sel, setSel] = useState<{ id: string; name: string } | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [focusErr, setFocusErr] = useState(false);
  const [profile, setProfile] = useState<UnitProfile | null>(null);
  const [pLoading, setPLoading] = useState(false); const [pErr, setPErr] = useState(false);
  const [fly, setFly] = useState<Fly | null>(null);
  const [pin, setPin] = useState<[number, number] | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [overlay, setOverlay] = useState<"chat" | "plant" | null>(null);
  const [highlight, setHighlight] = useState<GeoJSON.FeatureCollection | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState("");
  const [retry, setRetry] = useState(0);
  const [infoOpen, setInfoOpen] = useState(false);
  const token = useRef(0);

  useEffect(() => {
    try {
      if (localStorage.getItem("pris-seen")) setWelcome(false);
      const l = localStorage.getItem("pris-lang"); if (l === "hi" || l === "en") setLang(l);
      const b = localStorage.getItem("pris-basemap") as BasemapId | null; if (b && ["dark", "street", "satellite", "terrain", "plain"].includes(b)) setBasemap(b);
    } catch { /* private mode */ }
    setPanelOpen(window.innerWidth >= 768);
    getDistrictScores().then(setScores);
  }, []);
  const changeLang = (l: Lang) => { setLang(l); try { localStorage.setItem("pris-lang", l); } catch { /* ignore */ } };
  const changeBasemap = (b: BasemapId) => { setBasemap(b); try { localStorage.setItem("pris-basemap", b); } catch { /* ignore */ } };
  const dismissWelcome = () => { setWelcome(false); try { localStorage.setItem("pris-seen", "1"); } catch { /* ignore */ } };
  const flyTo = (f: Omit<Fly, "nonce">) => setFly({ ...f, nonce: Date.now() });

  /** Back to the full-state map. */
  const exitFocus = useCallback(() => {
    token.current++;
    setSel(null); setFocus(null); setProfile(null); setPin(null); setCoords(null); setFocusErr(false); setFilter("");
    setFly({ bbox: UP_BBOX, nonce: Date.now() });
  }, []);

  /** Show ONE place on its own: its polygon, its children, only its data. */
  const openUnit = useCallback(async (id: string, name?: string, at?: [number, number] | null) => {
    if (id === STATE_ID) { exitFocus(); return; }
    const my = ++token.current;
    setSel({ id, name: name ?? "…" }); setPanelOpen(true); setProfile(null); setFocusErr(false); setFilter("");
    if (at) { setPin(at); setCoords({ lat: at[1], lon: at[0] }); }
    try {
      const f = await getFocus(id);
      if (my !== token.current) return;
      setFocus(f); setSel({ id, name: f.unit.name });
      setFly({ bbox: f.unit.bbox, centroid: f.unit.centroid, nonce: Date.now() });
      const c = f.unit.centroid;
      if (c) { setCoords({ lat: c[1], lon: c[0] }); setPin(f.unit.level === "village" ? c : null); }
    } catch { if (my === token.current) { setFocus(null); setFocusErr(true); } }
  }, [exitFocus]);

  const onSearchSelect = useCallback((r: SearchResult) => { void openUnit(r.id, lang === "hi" && r.name_hi ? r.name_hi : r.name, null); }, [openUnit, lang]);
  const onPick = useCallback((p: PickEvent) => {
    if (p.unitId) void openUnit(p.unitId, p.name, null);
    else { setPin([p.lon, p.lat]); setCoords({ lat: p.lat, lon: p.lon }); }
  }, [openUnit]);

  useEffect(() => {
    if (!sel) { setPErr(false); setPLoading(false); return; }
    let live = true; setPLoading(true); setPErr(false);
    getProfile(sel.id).then((p) => live && setProfile(p)).catch(() => live && setPErr(true)).finally(() => live && setPLoading(false));
    return () => { live = false; };
  }, [sel?.id, retry]); // eslint-disable-line react-hooks/exhaustive-deps

  const mapFocus = useMemo<FocusState | null>(() => focus?.unit.geometry
    ? { unitId: focus.unit.id, children: focus.children, unit: { type: "Feature", geometry: focus.unit.geometry, properties: { id: focus.unit.id, name: focus.unit.name, level: focus.unit.level } } } : null, [focus]);
  const hier = focus?.hierarchy ?? [];
  const district = hier.find((h) => h.level === "district")?.name;
  const village = hier.find((h) => h.level === "village")?.name;
  const districtId = hier.find((h) => h.level === "district")?.id;
  const level = focus?.unit.level;
  const kids = useMemo(() => (focus?.children.features ?? []).map((f) => ({ id: String(f.properties?.id), name: String(f.properties?.name), area: Number(f.properties?.area_sqkm) })), [focus]);
  const shownKids = useMemo(() => { const q = filter.trim().toLowerCase(); return (q ? kids.filter((k) => k.name.toLowerCase().includes(q)) : kids).slice(0, 300); }, [kids, filter]);
  const fab = "flex min-h-16 items-center gap-2 rounded-full px-6 text-lg font-extrabold shadow-2xl transition-transform hover:scale-[1.03]";
  const rightEdge = panelOpen ? "md:right-[29rem]" : "md:right-16";

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#0B1220]">
      <MapView lang={lang} basemap={basemap} visible={visible} onStatus={(id, s) => setStatus((x) => ({ ...x, [id]: s }))} flyTo={fly} onPick={onPick}
        marker={pin} highlight={highlight} focus={mapFocus} scores={scores} panelOpen={panelOpen} />

      <header className={`absolute left-3 right-3 top-3 z-30 transition-all duration-300 ${rightEdge}`}>
        <Panel className="flex flex-wrap items-center gap-3 p-2 pl-3">
          <div className="flex items-center gap-2" aria-label="PRIS + adcGIS">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-inner"><img src="/icon.png" alt="PRIS" className="h-full w-full object-contain" /></span>
            <div className="leading-none"><div className="text-xl font-extrabold">PRIS<span className="text-gold"> + adcGIS</span></div><div className="hidden text-xs text-slate-300 sm:block">Prajna Regional Intelligence System</div></div>
          </div>
          <div className="order-3 w-full min-w-0 md:order-none md:w-auto md:flex-1"><SearchBar lang={lang} onSelect={onSearchSelect} /></div>
          <div className="ml-auto flex overflow-hidden rounded-xl ring-2 ring-sov" role="group" aria-label="Language">
            {(["en", "hi"] as const).map((l) => <button key={l} aria-pressed={lang === l} onClick={() => changeLang(l)} className={`min-h-14 min-w-14 px-4 text-lg font-extrabold ${lang === l ? "bg-sov text-white" : "bg-obsidian-700 text-slate-200 hover:bg-obsidian-600"}`}>{l === "en" ? "EN" : "हिं"}</button>)}
          </div>
        </Panel>
      </header>

      <LayerControl lang={lang} visible={visible} status={status} open={layersOpen} onOpen={setLayersOpen} onToggle={(id) => setVisible((v) => ({ ...v, [id]: !v[id] }))}
        basemap={basemap} onBasemap={changeBasemap} counts={focus ? focus.counts : null} />

      {focus && (
        <div className="absolute left-1/2 top-[8.75rem] z-20 -translate-x-1/2 md:top-[6.1rem]" style={{ maxWidth: "calc(100vw - 1.5rem)" }}>
          <button onClick={exitFocus} className="flex min-h-14 items-center gap-3 rounded-full bg-gold px-5 text-base font-extrabold text-obsidian shadow-2xl hover:brightness-110">
            <span className="hidden truncate sm:inline">{t("focusOnly", lang)}: {focus.unit.name}</span>
            <span className="rounded-full bg-obsidian px-3 py-1.5 text-sm text-gold">← {t("showState", lang)}</span>
          </button>
        </div>
      )}

      <button onClick={() => (focus ? setFly({ bbox: focus.unit.bbox, centroid: focus.unit.centroid, nonce: Date.now() }) : setFly({ bbox: UP_BBOX, nonce: Date.now() }))}
        title={t("resetView", lang)} aria-label={t("resetView", lang)}
        className={`absolute right-3 top-[8.75rem] z-20 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-obsidian/90 shadow-xl backdrop-blur-md transition-all duration-300 hover:bg-obsidian-700 md:top-24 ${rightEdge}`}>
        <Icon name="target" className="h-6 w-6 text-sky-300" />
      </button>

      <div className={`absolute left-3 z-20 flex flex-col gap-2 md:bottom-12 ${panelOpen ? "bottom-[calc(58%+0.75rem)]" : "bottom-20"}`}>
        <button onClick={() => setOverlay(overlay === "plant" ? null : "plant")} className={`${fab} bg-verdant text-obsidian`}><Icon name="leaf" className="h-6 w-6" />{t("plant", lang)}</button>
        <button onClick={() => setOverlay(overlay === "chat" ? null : "chat")} className={`${fab} bg-gold text-obsidian`}><Icon name="chat" className="h-6 w-6" />{t("chat", lang)}</button>
      </div>

      {!focus && (
        <div className="pointer-events-none absolute bottom-3 left-28 z-10 hidden gap-2 md:flex" aria-hidden>
          <span className="flex items-center gap-2 rounded-full bg-obsidian/85 px-3 py-1.5 text-sm"><span className="h-3 w-5 rounded-sm border border-sky-300 bg-sov/30" />{t("legendRef", lang)}</span>
        </div>
      )}

      {/* desktop collapse / expand handle — always reachable, so the map can use the whole screen */}
      <button onClick={() => setPanelOpen(!panelOpen)} aria-expanded={panelOpen} title={panelOpen ? t("panelClose", lang) : t("panelOpen", lang)} aria-label={panelOpen ? t("panelClose", lang) : t("panelOpen", lang)}
        className={`absolute top-1/2 z-30 hidden h-20 w-8 -translate-y-1/2 items-center justify-center rounded-l-2xl border border-r-0 border-white/15 bg-obsidian text-sky-200 shadow-2xl transition-all duration-300 hover:w-10 hover:bg-obsidian-700 md:flex ${panelOpen ? "right-[28rem]" : "right-0"}`}>
        <Icon name="chev" className={`h-6 w-6 ${panelOpen ? "-rotate-90" : "rotate-90"}`} />
      </button>

      <aside aria-label={t("unit", lang)}
        className={`absolute inset-x-0 bottom-0 z-20 flex flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-obsidian shadow-2xl transition-all duration-300 md:inset-y-0 md:left-auto md:right-0 md:w-[28rem] md:rounded-none md:border-y-0 md:border-r-0 ${panelOpen ? "h-[58%] md:h-auto md:translate-x-0" : "h-14 md:h-auto md:translate-x-full"}`}>
        <button onClick={() => setPanelOpen(!panelOpen)} aria-expanded={panelOpen} className="flex min-h-14 items-center gap-3 border-b border-white/10 bg-obsidian-700 px-4 text-left md:cursor-default">
          <div className="min-w-0 flex-1">
            <div className="truncate text-xl font-extrabold">{sel ? sel.name : t("startHere", lang)}</div>
            {sel && level && <Pill tone="cyan">{LEVEL_LABEL[level]?.[lang] ?? level}</Pill>}
          </div>
          <Icon name="chev" className={`h-6 w-6 md:hidden ${panelOpen ? "" : "rotate-180"}`} />
        </button>
        {sel && <button onClick={exitFocus} aria-label={t("close", lang)} className="absolute right-3 top-1.5 hidden h-11 w-11 items-center justify-center rounded-xl bg-obsidian text-slate-200 hover:bg-obsidian-600 md:flex"><Icon name="close" className="h-5 w-5" /></button>}

        <div className="flex-1 space-y-5 overflow-y-auto p-3">
          {!sel && (
            <section className="space-y-3">
              <p className="text-lg text-slate-200">{t("startHereBody", lang)}</p>
              <div className="flex flex-wrap gap-2">{QUICK.map((n) => { const d = DISTRICTS.find((x) => x.name === n); return d ? <button key={n} onClick={() => openUnit(d.id, d.name)} className="min-h-14 rounded-full bg-obsidian-700 px-5 text-lg font-bold text-sky-200 ring-1 ring-sov/50 hover:bg-obsidian-600">{n}</button> : null; })}</div>
              <details className="rounded-2xl bg-obsidian-700">
                <summary className="flex min-h-14 cursor-pointer items-center px-4 text-lg font-bold">{CHILD_LABEL.district[lang]} ({DISTRICTS.length})</summary>
                <div className="grid max-h-72 grid-cols-2 gap-1.5 overflow-y-auto p-2">{DISTRICTS.map((d) => <button key={d.id} onClick={() => openUnit(d.id, d.name)} className="min-h-12 truncate rounded-xl bg-obsidian px-3 text-left font-semibold hover:bg-obsidian-600">{d.name}</button>)}</div>
              </details>
            </section>)}
          {sel && <>
            {focus && <Breadcrumb nodes={hier} lang={lang} onSelect={(n) => (n.id === STATE_ID ? exitFocus() : void openUnit(n.id, n.name))} />}
            {districtId && (
              <button onClick={() => setInfoOpen(true)} className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-gold px-4 text-lg font-extrabold text-obsidian shadow-xl hover:brightness-110">
                <Icon name="info" className="h-6 w-6" />{t("di_button", lang)}{level !== "district" && district ? ` — ${district}` : ""}
              </button>)}
            {focusErr && <div role="alert" className="rounded-2xl bg-red-900/60 p-4"><p className="font-semibold">{t("loadError", lang)}</p><button onClick={() => openUnit(sel.id, sel.name)} className="mt-2 min-h-12 rounded-xl bg-white px-5 font-bold text-obsidian">{t("retry", lang)}</button></div>}
            <ProfilePanel profile={profile} loading={pLoading} error={pErr} onRetry={() => setRetry((n) => n + 1)} lang={lang} />
            {focus && kids.length > 0 && focus.child_level && (
              <section aria-label={t("inside", lang)} className="space-y-2">
                <h3 className="text-lg font-extrabold">{CHILD_LABEL[focus.child_level]?.[lang]} ({kids.length})</h3>
                {kids.length > 12 && <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t("search", lang)} aria-label={t("search", lang)} className="h-12 w-full rounded-xl bg-white px-4 font-semibold text-obsidian placeholder:text-slate-500" />}
                <div className="grid max-h-80 grid-cols-2 gap-1.5 overflow-y-auto">
                  {shownKids.map((k) => <button key={k.id} onClick={() => openUnit(k.id, k.name)} className="min-h-12 rounded-xl bg-obsidian-700 px-3 py-1 text-left font-semibold hover:bg-sov/60"><span className="block truncate">{k.name}</span>{Number.isFinite(k.area) && <span className="text-xs text-slate-400">{k.area.toFixed(1)} km²</span>}</button>)}
                </div>
              </section>)}
          </>}
          <OpportunityCards district={district} lang={lang} />
        </div>
        {sel && <div className="border-t border-white/10 bg-obsidian-700"><DownloadBar unitId={sel.id} lang={lang} /></div>}
      </aside>

      {overlay && (
        <div className={`absolute inset-0 z-40 overflow-hidden transition-all duration-300 md:inset-y-3 md:left-auto md:w-[26rem] md:rounded-3xl md:border md:border-white/10 md:shadow-2xl ${panelOpen ? "md:right-[28.75rem]" : "md:right-14"}`}>
          {overlay === "chat"
            ? <PaiChat lang={lang} ctx={{ lat: coords?.lat, lon: coords?.lon, district, village }} onClose={() => setOverlay(null)} />
            : <PlantUpload lang={lang} onHighlight={setHighlight} onClose={() => setOverlay(null)} />}
        </div>
      )}
      {infoOpen && districtId && <DistrictInfoSheet unitId={districtId} lang={lang} onClose={() => setInfoOpen(false)} />}
      {welcome && <Onboarding lang={lang} onStart={dismissWelcome} onTry={(n) => { dismissWelcome(); const d = DISTRICTS.find((x) => x.name === n); if (d) void openUnit(d.id, d.name); }} />}
    </div>
  );
}
