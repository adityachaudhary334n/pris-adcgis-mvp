"use client";
import { useEffect, useState } from "react";
import { identifyPlant } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Icon } from "@/components/ui";
import type { Lang, PlantResult } from "@/lib/types";

/** Photo picker with preview, progress state and a results panel (advice + optional map highlight). */
export default function PlantUpload({ lang, onHighlight, onClose }: { lang: Lang; onHighlight: (g: GeoJSON.FeatureCollection | null) => void; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null); const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(false); const [res, setRes] = useState<PlantResult | null>(null);
  useEffect(() => { if (!file) { setUrl(null); return; } const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file]);
  const go = async () => {
    if (!file) return; setBusy(true); setErr(false); setRes(null);
    try { const r = await identifyPlant(file); setRes(r); onHighlight(r.highlight_geojson ?? null); } catch { setErr(true); } finally { setBusy(false); }
  };
  const advice = res?.cultivation_advice ? (Array.isArray(res.cultivation_advice) ? res.cultivation_advice : [res.cultivation_advice]) : [];
  return (
    <div className="flex h-full flex-col bg-obsidian/95 text-white backdrop-blur-md">
      <header className="flex items-center justify-between border-b border-obsidian-600 p-3">
        <h2 className="flex items-center gap-2 text-xl font-extrabold"><Icon name="leaf" className="h-6 w-6 text-verdant" />{t("plant", lang)}</h2>
        <button onClick={onClose} className="min-h-12 min-w-12 rounded-lg bg-obsidian-700 px-3" aria-label={t("close", lang)}><Icon name="close" className="mx-auto h-5 w-5" /></button>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-4 border-dashed border-verdant bg-obsidian-700 p-4 text-center text-lg font-bold focus-within:outline focus-within:outline-4 focus-within:outline-gold">
          {url ? <img src={url} alt="Selected plant" className="max-h-60 rounded-lg" /> : <Icon name="camera" className="h-14 w-14 text-verdant" />}
          <span>{t("plantCta", lang)}</span>
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRes(null); setErr(false); onHighlight(null); }} />
        </label>
        <button onClick={go} disabled={!file || busy} className="min-h-16 w-full rounded-xl bg-gold text-lg font-bold text-obsidian disabled:opacity-50">{busy ? t("thinking", lang) : t("plantGo", lang)}</button>
        {busy && <div role="progressbar" aria-busy className="h-3 overflow-hidden rounded bg-obsidian-700"><div className="h-3 w-1/3 animate-pulse rounded bg-verdant" /></div>}
        {err && <p role="alert" className="rounded-xl bg-red-900/60 p-4">{t("plantError", lang)}</p>}
        {res && (res.matched === false || (!res.common_name && advice.length === 0)) && <p className="rounded-xl border-2 border-gold p-4">{res.message ?? t("plantNone", lang)}</p>}
        {res && (res.common_name || advice.length > 0) && (
          <section className="rounded-xl bg-obsidian-700 p-4">
            {res.common_name && <h3 className="text-2xl font-bold text-verdant">{res.common_name}</h3>}
            {res.scientific_name && <p className="italic text-slate-300">{res.scientific_name}</p>}
            {res.spatial_context && <p className="mt-2 text-base text-sky-200">{res.spatial_context}</p>}
            {advice.length > 0 && <><h4 className="mt-3 text-lg font-bold text-gold">{t("plantAdvice", lang)}</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-base">{advice.map((a, i) => <li key={i}>{a}</li>)}</ul></>}
          </section>)}
      </div>
    </div>
  );
}
