"use client";
import { GROUPS, LAYERS } from "@/lib/layers";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import type { BasemapId, LayerStatus } from "./MapView";
import { Icon, Panel } from "@/components/ui";

interface Props { lang: Lang; visible: Record<string, boolean>; status: Record<string, LayerStatus>; onToggle: (id: string) => void; open: boolean; onOpen: (o: boolean) => void;
  basemap: BasemapId; onBasemap: (b: BasemapId) => void; counts: Record<string, number> | null }
const BASEMAPS: { id: BasemapId; label: "bm_dark" | "bm_street" | "bm_sat" | "bm_terrain" | "bm_plain"; swatch: string }[] = [
  { id: "dark", label: "bm_dark", swatch: "linear-gradient(135deg,#0F172A,#334155)" }, { id: "street", label: "bm_street", swatch: "linear-gradient(135deg,#F3F4F6,#A7F3D0)" },
  { id: "satellite", label: "bm_sat", swatch: "linear-gradient(135deg,#14532D,#365314 60%,#78350F)" }, { id: "terrain", label: "bm_terrain", swatch: "linear-gradient(135deg,#D9F99D,#A8A29E)" },
  { id: "plain", label: "bm_plain", swatch: "#0F172A" },
];

/** Grouped layer toggles. 64px rows; layers without data stay visible but disabled, labelled "No data yet". */
export default function LayerControl({ lang, visible, status, onToggle, open, onOpen, basemap, onBasemap, counts }: Props) {
  const active = LAYERS.filter((l) => visible[l.id] && status[l.id] === "ready");
  return (
    <div className="absolute left-3 top-[8.75rem] z-20 w-[min(21rem,calc(100vw-1.5rem))] md:top-24">
      <button onClick={() => onOpen(!open)} aria-expanded={open}
        className="flex h-14 w-full items-center gap-3 rounded-2xl border border-white/10 bg-obsidian/90 px-4 text-lg font-bold shadow-xl backdrop-blur-md hover:bg-obsidian-700">
        <Icon name="layers" className="h-6 w-6 text-sky-300" />
        <span className="flex-1 text-left">{t("layers", lang)}</span>
        {active.length > 0 && <span className="rounded-full bg-gold px-2.5 py-0.5 text-sm font-extrabold text-obsidian">{active.length}</span>}
        <Icon name="chev" className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <Panel className="mt-2 max-h-[min(62vh,36rem)] overflow-y-auto p-3">
          <section className="mb-4" aria-label={t("basemap", lang)}>
            <h3 className="mb-1.5 px-1 text-base font-bold text-slate-300">{t("basemap", lang)}</h3>
            <div className="grid grid-cols-5 gap-1.5" role="radiogroup">
              {BASEMAPS.map((b) => (
                <button key={b.id} role="radio" aria-checked={basemap === b.id} onClick={() => onBasemap(b.id)}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl p-1 text-xs font-bold ${basemap === b.id ? "bg-sov text-white ring-2 ring-gold" : "bg-obsidian-700 text-slate-200 hover:bg-obsidian-600"}`}>
                  <span className="h-6 w-9 rounded-md border border-white/30" style={{ background: b.swatch }} />{t(b.label, lang)}
                </button>))}
            </div>
          </section>
          {GROUPS.map((g) => (
            <section key={g.id} className="mb-3 last:mb-0">
              <h3 className="mb-1.5 px-1 text-base font-bold text-slate-300">{t(g.label, lang)}</h3>
              {LAYERS.filter((l) => l.group === g.id).map((l) => {
                const s = status[l.id] ?? "loading"; const on = !!visible[l.id]; const off = s !== "ready";
                return (
                  <button key={l.id} role="switch" aria-checked={on} disabled={off} onClick={() => onToggle(l.id)}
                    className={`mb-1.5 flex h-16 w-full items-center gap-3 rounded-xl px-3 text-left font-semibold transition-colors last:mb-0 ${off ? "cursor-not-allowed bg-obsidian-700/40 text-slate-400" : on ? "bg-sov/90 text-white ring-2 ring-sky-300" : "bg-obsidian-700 text-white hover:bg-obsidian-600"}`}>
                    <span className="h-5 w-5 shrink-0 rounded-full border-2 border-white/80" style={{ background: l.color }} />
                    <span className="flex-1 leading-tight">{t(l.label, lang)}
                      {off && <span className="block text-sm font-normal">{s === "loading" ? t("layerLoading", lang) : t("layerMissing", lang)}</span>}
                      {!off && counts && <span className="block text-sm font-normal text-sky-100">{counts[l.id] ?? 0} {t("inUnit", lang)}</span>}</span>
                    <span aria-hidden className={`flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-all ${on ? "justify-end bg-white/30" : "justify-start bg-slate-600"}`}>
                      <span className={`h-6 w-6 rounded-full ${on ? "bg-gold" : "bg-slate-300"}`} />
                    </span>
                  </button>
                );
              })}
            </section>
          ))}
        </Panel>
      )}
    </div>
  );
}
