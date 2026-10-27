"use client";
import { useEffect, useState } from "react";
import { getDistrictInfo, type DistrictInfo } from "@/lib/api";
import { t, type Key } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { Icon, Skeleton } from "@/components/ui";

const human = (k: string) => k.replace(/_/g, " ").replace(/\bsq km\b/i, "(km²)").replace(/^./, (c) => c.toUpperCase());
const fmt = (k: string, v: unknown) => typeof v === "number" ? (k.includes("area") ? `${v.toLocaleString("en-IN")} km²` : v.toLocaleString("en-IN")) : String(v ?? "");

/** Full-screen sheet with a district's descriptive profile. Sections/fields are rendered from the JSON itself,
 *  so anything you append to the data files appears here without code changes. */
export default function DistrictInfoSheet({ unitId, lang, onClose }: { unitId: string; lang: Lang; onClose: () => void }) {
  const [info, setInfo] = useState<DistrictInfo | null>(null); const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<string>(""); const [showGeneric, setShowGeneric] = useState(true);
  useEffect(() => {
    let live = true; setInfo(null); setErr(null);
    getDistrictInfo(unitId).then((d) => { if (!live) return; setInfo(d); setTab(Object.keys(d.sections)[0] ?? ""); }).catch(() => live && setErr(t("di_none", lang)));
    return () => { live = false; };
  }, [unitId, lang]);
  useEffect(() => { const f = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f); }, [onClose]);
  const generic = new Set(info?.generic_fields ?? []);
  const fields = info && tab ? Object.entries(info.sections[tab] ?? {}) : [];
  const label = (s: string) => { const k = `di_${s}` as Key; try { return t(k, lang) || human(s); } catch { return human(s); } };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-obsidian/70 p-0 backdrop-blur-sm md:items-center md:p-4" role="dialog" aria-modal="true" aria-label={t("di_title", lang)} onClick={onClose}>
      <div className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-obsidian shadow-2xl md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center gap-3 border-b border-white/10 bg-obsidian-700 p-4">
          <div className="min-w-0 flex-1"><div className="text-sm text-slate-300">{t("di_title", lang)}</div>
            <h2 className="truncate text-2xl font-extrabold">{info?.district ?? "…"}</h2>
            {info?.division && <div className="text-sm text-slate-300">{t("di_division", lang)}: {info.division}</div>}</div>
          <button onClick={onClose} aria-label={t("close", lang)} className="h-12 w-12 rounded-xl bg-obsidian hover:bg-obsidian-600"><Icon name="close" className="mx-auto h-5 w-5" /></button>
        </header>
        {!info && !err && <div className="space-y-3 p-4"><Skeleton className="h-14" /><Skeleton className="h-40" /></div>}
        {err && <p className="m-4 rounded-2xl border-2 border-gold/70 bg-gold/10 p-4">{err}</p>}
        {info && (<>
          <div role="tablist" className="flex gap-2 overflow-x-auto p-3">
            {Object.keys(info.sections).map((s) => <button key={s} role="tab" aria-selected={tab === s} onClick={() => setTab(s)}
              className={`min-h-12 shrink-0 rounded-full px-5 font-bold ${tab === s ? "bg-sov text-white" : "bg-obsidian-700 text-slate-200 hover:bg-obsidian-600"}`}>{label(s)}</button>)}
            <label className="ml-auto flex min-h-12 shrink-0 cursor-pointer items-center gap-2 px-2 text-sm text-slate-300"><input type="checkbox" checked={showGeneric} onChange={(e) => setShowGeneric(e.target.checked)} className="h-5 w-5" />{t("di_hide_generic", lang)}</label>
          </div>
          <div className="flex-1 space-y-2.5 overflow-y-auto p-3 pt-0">
            {fields.filter(([k]) => showGeneric || !generic.has(`${tab}.${k}`)).map(([k, v]) => { const g = generic.has(`${tab}.${k}`); return (
              <div key={k} className={`rounded-2xl p-4 ${g ? "border border-dashed border-white/20 bg-obsidian-700/50" : "bg-obsidian-700"}`}>
                <div className="flex items-center justify-between gap-3"><div className="text-sm font-semibold text-sky-200">{human(k)}</div>{g && <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-semibold text-gold">{t("di_generic", lang)}</span>}</div>
                <div className={`mt-1 text-lg leading-snug ${g ? "text-slate-300" : "font-semibold text-white"}`}>{fmt(k, v)}</div>
              </div>); })}
            {tab === "geography" && info.boundary_area_sqkm != null && <p className="px-1 text-sm text-slate-400">{t("di_boundary", lang)}: {info.boundary_area_sqkm.toLocaleString("en-IN", { maximumFractionDigits: 0 })} km²</p>}
            {info.source && <p className="px-1 pt-2 text-xs text-slate-400">{t("provenance", lang)}: {info.source}</p>}
          </div>
        </>)}
      </div>
    </div>
  );
}
