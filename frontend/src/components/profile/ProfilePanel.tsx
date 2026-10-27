"use client";
import { useEffect, useState, type ReactNode } from "react";
import { exportUrl } from "@/lib/api";
import { t, type Key } from "@/lib/i18n";
import type { AdminSummary, AirVolumeAsset, Lang, UnitProfile } from "@/lib/types";
import { Icon, ScoreRing, Skeleton } from "@/components/ui";

const TABS = ["soil", "water", "human_capital", "infrastructure", "climate_air", "land_livelihood", "flora_fauna", "industrial", "sustainable", "conservation"] as const;
const INDEX_KEYS = ["entrepreneurship", "industrial_suitability", "sustainability", "conservation_value"] as const;
const label = (k: string) => k.replace(/_/g, " ");
const isEmpty = (v: unknown) => v === null || v === undefined || v === "";
const pct = (v?: number | string | null) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(100, n <= 1 ? n * 100 : n)) : null; };

/** Renders any JSON value legibly: primitives inline, arrays joined, objects as nested rows. */
function Val({ v, lang, depth = 0 }: { v: unknown; lang: Lang; depth?: number }): ReactNode {
  if (isEmpty(v)) return <span className="text-slate-400">{t("noValue", lang)}</span>;
  if (typeof v === "number") return <span className="tabular-nums">{v.toLocaleString("en-IN")}</span>;
  if (typeof v === "boolean") return <span>{v ? "Yes" : "No"}</span>;
  if (Array.isArray(v)) return <span>{v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ")}</span>;
  if (typeof v === "object" && depth < 2) return (
    <dl className="mt-1 space-y-1 border-l-2 border-obsidian-600 pl-3">
      {Object.entries(v as Record<string, unknown>).map(([k, x]) => <div key={k} className="flex justify-between gap-3 text-[0.95rem]"><dt className="capitalize text-slate-400">{label(k)}</dt><dd className="text-right font-semibold"><Val v={x} lang={lang} depth={depth + 1} /></dd></div>)}
    </dl>);
  return <span>{String(typeof v === "object" ? JSON.stringify(v) : v)}</span>;
}

/** Real, derived facts (from the SOI/LGD boundary data) — shown for EVERY unit, even when no profile is computed. */
export function AdminFacts({ a, lang }: { a?: AdminSummary | null; lang: Lang }) {
  if (!a) return null;
  const rows: [string, string | number | null | undefined][] = [
    [t("f_district", lang), a.district], [t("f_block", lang), a.block], [t("f_tehsil", lang), a.tehsil ?? a.tehsils?.join(", ")],
    [t("f_gpname", lang), a.gram_panchayat], [t("f_area", lang), a.area_sqkm != null ? `${a.area_sqkm.toLocaleString("en-IN", { maximumFractionDigits: 2 })} km²` : null],
    [t("f_districts", lang), a.counts?.districts], [t("f_blocks", lang), a.counts?.blocks], [t("f_villages", lang), a.counts?.villages], [t("f_gp", lang), a.counts?.gram_panchayats],
    [t("f_pop", lang), a.population != null ? a.population.toLocaleString("en-IN") : null],
    [t("f_lgd", lang), (a.codes?.lgd_village ?? a.codes?.lgd_block ?? a.codes?.lgd_district) as number | undefined], [t("f_ac", lang), a.assembly_constituency_no],
    [t("f_soi", lang), a.name_in_survey_records],
  ];
  const shown = rows.filter(([, v]) => v != null && v !== "");
  if (!shown.length) return null;
  return (
    <section className="rounded-2xl bg-obsidian-700 p-4" aria-label={t("facts", lang)}>
      <h3 className="mb-2 text-lg font-extrabold">{t("facts", lang)}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {shown.map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-sm text-slate-400">{k}</dt><dd className="truncate text-lg font-bold tabular-nums">{typeof v === "number" ? v.toLocaleString("en-IN") : v}</dd></div>)}
      </dl>
      {a.source && <p className="mt-3 text-xs text-slate-400">{t("provenance", lang)}: {a.source}</p>}
    </section>
  );
}

/** Air Volume Asset: a height gauge (how high the usable air column is) plus solar, drone and heritage readings. */
export function AirVolumeCard({ air, lang }: { air?: AirVolumeAsset | null; lang: Lang }) {
  const h = air?.max_usable_height_m ?? null; const hp = h == null ? 0 : Math.min(100, (Number(h) / 400) * 100);
  const drone = pct(air?.drone_corridor_score), agri = pct(air?.agrivoltaic_suitability);
  const Bar = ({ v, color }: { v: number | null; color: string }) => <div className="mt-1.5 h-2.5 rounded-full bg-obsidian"><div className="h-2.5 rounded-full transition-all" style={{ width: `${v ?? 0}%`, background: color }} /></div>;
  const none = <span className="text-slate-400">{t("noValue", lang)}</span>;
  return (
    <section className="overflow-hidden rounded-2xl border border-sov/60 bg-gradient-to-b from-sov/25 to-obsidian-700" aria-label={t("air", lang)}>
      <h3 className="flex items-center gap-2 px-4 pt-4 text-xl font-extrabold"><Icon name="plane" className="h-6 w-6 text-sky-300" />{t("air", lang)}</h3>
      <div className="flex gap-4 p-4">
        <div className="flex w-16 shrink-0 flex-col items-center" role="img" aria-label={`${t("a_height", lang)}: ${h ?? "no data"}`}>
          <div className="relative h-36 w-7 overflow-hidden rounded-full bg-obsidian ring-1 ring-white/15">
            <div className="absolute inset-x-0 bottom-0 rounded-full bg-gradient-to-t from-sov to-sky-200 transition-all duration-700" style={{ height: `${hp}%` }} />
          </div>
          <div className="mt-2 text-center text-xl font-extrabold tabular-nums text-gold">{h ?? "–"}<span className="text-sm font-semibold text-slate-300">{h != null ? " m" : ""}</span></div>
        </div>
        <dl className="min-w-0 flex-1 space-y-3 text-base">
          <div><dt className="text-sm text-slate-300">{t("a_class", lang)}</dt><dd className="text-lg font-bold capitalize">{air?.airspace_class ?? none}</dd></div>
          <div><dt className="flex justify-between text-sm text-slate-300"><span>{t("a_solar", lang)}</span><span className="font-bold text-white">{air?.solar_irradiance != null ? `${air.solar_irradiance} kWh/m²/day` : none}</span></dt>
            <dd><Bar v={air?.solar_irradiance != null ? Math.min(100, (Number(air.solar_irradiance) / 7) * 100) : null} color="#F59E0B" /></dd></div>
          <div><dt className="flex justify-between text-sm text-slate-300"><span>{t("a_drone", lang)}</span><span className="font-bold text-white">{drone != null ? Math.round(drone) : none}</span></dt><dd><Bar v={drone} color="#38BDF8" /></dd></div>
          <div><dt className="flex justify-between text-sm text-slate-300"><span>{t("a_agri", lang)}</span><span className="font-bold text-white">{agri != null ? Math.round(agri) : none}</span></dt><dd><Bar v={agri} color="#10B981" /></dd></div>
          <div><dt className="text-sm text-slate-300">{t("a_heritage", lang)}</dt><dd className="text-lg font-bold capitalize">{isEmpty(air?.heritage_sensitivity) ? none : String(air?.heritage_sensitivity)}</dd></div>
        </dl>
      </div>
      {air && (air.wind_class || air.pollution_load_index != null) && (
        <p className="border-t border-white/10 px-4 py-3 text-sm text-slate-300">
          {air.wind_class && <span className="mr-4">{t("a_wind", lang)}: <b className="text-white">{air.wind_class}{air.wind_speed_avg_ms != null ? ` · ${air.wind_speed_avg_ms} m/s` : ""}</b></span>}
          {air.pollution_load_index != null && <span>{t("a_pollution", lang)}: <b className="text-white">{air.pollution_load_index}</b></span>}
        </p>)}
    </section>
  );
}

/** Always-visible footer so the download is never buried under scrolling content. */
export function DownloadBar({ unitId, lang }: { unitId: string | null; lang: Lang }) {
  const b = "flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-base font-bold";
  if (!unitId) return <p className="p-3 text-sm text-slate-300">{t("dlNeedsUnit", lang)}</p>;
  return (
    <div className="flex flex-wrap gap-2 p-3" role="group" aria-label={t("dlTitle", lang)}>
      <a className={`${b} basis-full bg-gold text-obsidian hover:brightness-110`} href={exportUrl(unitId, "pdf")} download><Icon name="down" className="h-5 w-5" />{t("dlPdf", lang)}</a>
      <a className={`${b} bg-sov text-white hover:brightness-110`} href={exportUrl(unitId, "csv")} download>{t("dlCsv", lang)}</a>
      <a className={`${b} bg-verdant text-obsidian hover:brightness-110`} href={exportUrl(unitId, "geojson")} download>{t("dlGeo", lang)}</a>
    </div>
  );
}

interface Props { profile: UnitProfile | null; loading: boolean; error: boolean; onRetry: () => void; lang: Lang }

/** Indices + profile tabs + Air Volume Asset. Missing data is always explained, never blank. */
export default function ProfilePanel({ profile, loading, error, onRetry, lang }: Props) {
  const have = TABS.filter((k) => profile?.profiles?.[k] && Object.keys(profile.profiles[k]!).length > 0);
  const [tab, setTab] = useState<(typeof TABS)[number]>("soil");
  useEffect(() => { if (have.length && !have.includes(tab)) setTab(have[0]); }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps
  if (loading) return <div className="space-y-3" aria-busy="true"><Skeleton className="h-28" /><Skeleton className="h-14" /><Skeleton className="h-40" /></div>;
  const computed = !error && !!profile && profile.computed !== false && (have.length > 0 || Object.values(profile.indices ?? {}).some((v) => v != null));
  const block = profile?.profiles?.[tab]; const entries = block ? Object.entries(block) : [];
  const idx = profile?.indices ?? {};
  return (
    <div className="space-y-4">
      <AdminFacts a={profile?.admin_summary} lang={lang} />
      {error && <div role="alert" className="rounded-2xl bg-red-900/60 p-4"><p className="font-semibold">{t("loadError", lang)}</p>
        <button onClick={onRetry} className="mt-2 min-h-12 rounded-xl bg-white px-5 font-bold text-obsidian">{t("retry", lang)}</button></div>}
      {!error && !computed && <p className="flex gap-3 rounded-2xl border-2 border-gold/70 bg-gold/10 p-4 text-base"><Icon name="info" className="mt-0.5 h-6 w-6 shrink-0 text-gold" />{t("noProfile", lang)}</p>}
      {computed && (
        <section className="rounded-2xl bg-obsidian-700 p-4">
          <div className="flex items-center gap-4">
            <ScoreRing value={idx.overall_opportunity} size={84} label={t("i_overall_opportunity", lang)} />
            <div><div className="text-lg font-extrabold leading-tight">{t("i_overall_opportunity", lang)}</div><div className="text-sm text-slate-300">0–100</div></div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            {INDEX_KEYS.map((k) => { const v = idx[k]; return (
              <div key={k}><div className="flex justify-between text-sm text-slate-300"><span>{t(`i_${k}` as Key, lang)}</span><span className="font-bold text-white tabular-nums">{v == null ? "–" : Math.round(v)}</span></div>
                <div className="mt-1 h-2 rounded-full bg-obsidian"><div className="h-2 rounded-full bg-verdant transition-all" style={{ width: `${Math.max(0, Math.min(100, v ?? 0))}%` }} /></div></div>); })}
          </div>
        </section>)}
      {!error && have.length > 0 && (<>
        <div role="tablist" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {have.map((k) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`min-h-12 shrink-0 rounded-full px-5 font-bold transition-colors ${tab === k ? "bg-sov text-white" : "bg-obsidian-700 text-slate-200 hover:bg-obsidian-600"}`}>{t(`t_${k}` as Key, lang)}</button>)}
        </div>
        <div role="tabpanel" className="rounded-2xl bg-obsidian-700 p-4">
          {entries.length === 0 ? <p className="text-slate-300">{t("tabsEmpty", lang)}</p> :
            <dl className="space-y-2.5">{entries.map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-white/5 pb-2 last:border-0"><dt className="capitalize text-slate-300">{label(k)}</dt><dd className="text-right font-semibold"><Val v={v} lang={lang} /></dd></div>)}</dl>}
          {profile?.provenance && (profile.provenance.source || profile.provenance.method) && <p className="mt-3 text-sm text-slate-400">{t("provenance", lang)}: {[profile.provenance.source, profile.provenance.method, profile.provenance.measured_at?.slice(0, 10)].filter(Boolean).join(" · ")}</p>}
        </div></>)}
      <AirVolumeCard air={profile?.air_volume_asset} lang={lang} />
    </div>
  );
}
