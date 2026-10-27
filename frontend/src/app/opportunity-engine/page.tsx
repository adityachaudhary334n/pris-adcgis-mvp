"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getDiagnostic, getDiagnosticDistricts, type DistrictDiagnostic } from "@/lib/api";
import { Icon, Pill, ScoreRing, Skeleton } from "@/components/ui";

function RadarChart({ labels, values, size = 300 }: { labels: string[]; values: number[]; size?: number }) {
  const n = labels.length;
  const cx = size / 2, cy = size / 2, r = size * 0.34;
  const angle = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const pt = (i: number, v: number) => {
    const a = angle(i);
    const rr = (Math.max(0, Math.min(100, v)) / 100) * r;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as const;
  };
  const poly = values.map((v, i) => pt(i, v).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[340px]" role="img" aria-label="Capability radar">
      {[25, 50, 75, 100].map((rv) => (
        <polygon key={rv} fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth="1"
          points={Array.from({ length: n }, (_, i) => pt(i, rv).join(",")).join(" ")} />
      ))}
      {labels.map((_, i) => {
        const [x, y] = pt(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(148,163,184,0.2)" />;
      })}
      <polygon points={poly} fill="rgba(2,132,199,0.35)" stroke="#38BDF8" strokeWidth="2.5" strokeLinejoin="round" />
      {values.map((v, i) => {
        const [x, y] = pt(i, v);
        return <circle key={i} cx={x} cy={y} r="4.5" fill="#F59E0B" stroke="#0B1220" strokeWidth="1.5" />;
      })}
      {labels.map((lab, i) => {
        const [x, y] = pt(i, 118);
        return (
          <text key={lab} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill="#E2E8F0" fontSize="11" fontWeight="600">
            {lab.split(" ").map((w, wi) => (
              <tspan key={wi} x={x} dy={wi === 0 ? 0 : 12}>{w}</tspan>
            ))}
          </text>
        );
      })}
    </svg>
  );
}

function HBar({ labels, values }: { labels: string[]; values: number[] }) {
  return (
    <div className="space-y-2.5">
      {labels.map((lab, i) => {
        const v = Math.max(0, Math.min(100, Number(values[i]) || 0));
        const col = v >= 70 ? "#10B981" : v >= 45 ? "#0284C7" : "#F59E0B";
        return (
          <div key={lab}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-slate-200">{lab}</span>
              <span className="font-bold tabular-nums text-white">{Math.round(v)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-obsidian-600">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${v}%`, background: col }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Quadrant({ readiness, need, label, color }: { readiness: number; need: number; label: string; color: string }) {
  const size = 280, pad = 40, plot = size - pad * 2;
  const x = pad + (Math.max(0, Math.min(100, readiness)) / 100) * plot;
  const y = pad + (1 - Math.max(0, Math.min(100, need)) / 100) * plot;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[320px]" role="img" aria-label="Need vs readiness">
      <rect x={pad} y={pad} width={plot / 2} height={plot / 2} fill="rgba(2,132,199,0.12)" />
      <rect x={pad + plot / 2} y={pad} width={plot / 2} height={plot / 2} fill="rgba(16,185,129,0.12)" />
      <rect x={pad} y={pad + plot / 2} width={plot / 2} height={plot / 2} fill="rgba(239,68,68,0.1)" />
      <rect x={pad + plot / 2} y={pad + plot / 2} width={plot / 2} height={plot / 2} fill="rgba(245,158,11,0.1)" />
      <line x1={pad + plot / 2} y1={pad} x2={pad + plot / 2} y2={pad + plot} stroke="rgba(148,163,184,0.4)" strokeDasharray="4 4" />
      <line x1={pad} y1={pad + plot / 2} x2={pad + plot} y2={pad + plot / 2} stroke="rgba(148,163,184,0.4)" strokeDasharray="4 4" />
      <rect x={pad} y={pad} width={plot} height={plot} fill="none" stroke="rgba(148,163,184,0.35)" />
      <circle cx={x} cy={y} r="11" fill={color} stroke="#0B1220" strokeWidth="2" />
      <text x={x} y={y - 18} textAnchor="middle" fill="#F8FAFC" fontSize="12" fontWeight="700">{label}</text>
      <text x={size / 2} y={size - 10} textAnchor="middle" fill="#94A3B8" fontSize="11">Infrastructure readiness →</text>
      <text x={14} y={size / 2} textAnchor="middle" fill="#94A3B8" fontSize="11" transform={`rotate(-90 14 ${size / 2})`}>← Development need</text>
    </svg>
  );
}

function IdeaImage({ idea }: { idea: DistrictDiagnostic["startup_ideas"][number] }) {
  const [src, setSrc] = useState(idea.image_url || "/startup_images/_placeholder.svg");
  const [stage, setStage] = useState(0);
  const onError = () => {
    if (stage === 0 && idea.image_url_api) {
      setStage(1);
      setSrc(idea.image_url_api);
    } else if (stage < 2) {
      setStage(2);
      setSrc("/startup_images/_placeholder.svg");
    }
  };
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" onError={onError} className="h-full w-full object-cover" />
  );
}

const INDEX_META: { key: keyof DistrictDiagnostic["indices"]; short: string }[] = [
  { key: "water_climate", short: "Water" },
  { key: "agro_economic", short: "Agro" },
  { key: "renewable_energy", short: "Energy" },
  { key: "labour_human_capital", short: "Labour" },
  { key: "infrastructure", short: "Infra" },
];

const CONTEXT_LABELS: Record<string, string> = {
  skill_level: "Skill Level", healthcare_gap_score: "Health Gap", education_gap_score: "Education Gap",
  industrial_base_score: "Industrial Base", tourism_potential_score: "Tourism Potential",
  pollution_level_score: "Pollution Risk", agro_strength_score: "Agro Strength",
  overall_readiness_score: "Overall Readiness", development_need_score: "Development Need",
  water_availability_score: "Water Availability", solar_potential_score: "Solar Potential",
  infrastructure_readiness_score: "Infra Readiness", labour_availability: "Labour Availability",
  mgnrega_dependency: "MGNREGA Dependency", security_risk_score: "Security Risk",
};

function EngineInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const qDistrict = sp.get("district") || "";
  const [districts, setDistricts] = useState<string[]>([]);
  const [district, setDistrict] = useState(qDistrict);
  const [data, setData] = useState<DistrictDiagnostic | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [barKey, setBarKey] = useState<keyof DistrictDiagnostic["indices"]>("infrastructure");
  const [tab, setTab] = useState<"phase1" | "phase2" | "phase3">("phase1");

  useEffect(() => {
    getDiagnosticDistricts().then((r) => setDistricts(r.districts)).catch(() => {});
  }, []);

  useEffect(() => {
    if (qDistrict && qDistrict !== district) setDistrict(qDistrict);
  }, [qDistrict]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!district) { setData(null); return; }
    let live = true;
    setLoading(true); setErr(null);
    getDiagnostic(district)
      .then((d) => {
        if (!live) return;
        setData(d);
        const url = new URL(window.location.href);
        if (url.searchParams.get("district") !== d.district) {
          url.searchParams.set("district", d.district);
          window.history.replaceState({}, "", url.toString());
        }
      })
      .catch(() => live && setErr("No diagnostic data for this district (pilot sample only)."))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [district]);

  const overall = useMemo(() => {
    if (!data) return null;
    const v = Object.values(data.indices);
    return v.reduce((a, b) => a + b, 0) / v.length;
  }, [data]);

  const contextBars = useMemo(() => {
    if (!data?.context) return null;
    const keys = Object.keys(CONTEXT_LABELS).filter((k) => data.context && typeof data.context[k] === "number");
    return { labels: keys.map((k) => CONTEXT_LABELS[k] || k), values: keys.map((k) => Number(data.context![k])) };
  }, [data]);

  const allPotentials = (data as DistrictDiagnostic & { phase3?: { top_potentials?: { name: string; score: number }[] } })?.phase3?.top_potentials
    ?? data?.top_potentials ?? [];

  return (
    <div className="min-h-dvh bg-[#0B1220] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-obsidian/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 rounded-xl bg-obsidian-700 px-3 py-2 text-sm font-bold hover:bg-obsidian-600">
            <Icon name="chev" className="h-4 w-4 rotate-90" /> Map
          </Link>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-gold">Prajna Opportunity Engine</div>
            <h1 className="truncate text-xl font-extrabold sm:text-2xl">District Development Diagnostic</h1>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="hidden text-slate-300 sm:inline">District</span>
            <select
              value={district}
              onChange={(e) => {
                setDistrict(e.target.value);
                router.replace(`/opportunity-engine?district=${encodeURIComponent(e.target.value)}`);
              }}
              className="min-h-12 min-w-[10rem] rounded-xl border border-white/15 bg-obsidian-700 px-3 font-semibold text-white"
            >
              <option value="">Select…</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
        </div>
        {data && (
          <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3">
            {([["phase1", "Phase 1 · Indices"], ["phase2", "Phase 2 · Startups"], ["phase3", "Phase 3 · Global"]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${tab === id ? "bg-sov text-white" : "bg-obsidian-700 text-slate-200 hover:bg-obsidian-600"}`}>
                {label}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {!district && (
          <div className="rounded-2xl border border-white/10 bg-obsidian-700/60 p-8 text-center">
            <p className="text-lg text-slate-200">Choose a district above, or open from the map after selecting a district.</p>
            <p className="mt-2 text-sm text-slate-400">Pilot data: {districts.join(", ") || "…"}</p>
            <Link href="/" className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-sov px-5 font-bold">Back to map</Link>
          </div>
        )}
        {loading && <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-64" /><Skeleton className="h-48" /></div>}
        {err && !loading && (
          <div className="rounded-2xl border-2 border-gold/50 bg-gold/10 p-6">
            <p className="font-semibold">{err}</p>
            <p className="mt-2 text-sm text-slate-300">Available: {districts.join(", ")}</p>
          </div>
        )}

        {data && !loading && tab === "phase1" && (
          <div className="space-y-6">
            <section>
              <h2 className="mb-3 text-lg font-extrabold">Index scores — {data.district}</h2>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-3 rounded-2xl bg-obsidian-700 p-3 ring-1 ring-white/5">
                  <ScoreRing value={overall} size={72} label="Overall" />
                  <div><div className="text-sm text-slate-300">Overall</div><div className="text-xl font-extrabold tabular-nums">{overall != null ? Math.round(overall) : "–"}</div></div>
                </div>
                {INDEX_META.map((m) => (
                  <button key={m.key} onClick={() => setBarKey(m.key)}
                    className={`flex items-center gap-2 rounded-2xl p-2.5 ring-1 ${barKey === m.key ? "bg-sov/30 ring-sky-400/50" : "bg-obsidian-700 ring-white/5"}`}>
                    <ScoreRing value={data.indices[m.key]} size={52} label={m.short} />
                    <span className="text-sm font-semibold">{m.short}</span>
                  </button>
                ))}
              </div>
            </section>
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl bg-obsidian-700/80 p-4 ring-1 ring-white/5">
                <h3 className="mb-2 font-extrabold">District capability radar</h3>
                <RadarChart labels={data.radar.labels} values={data.radar.values} />
              </section>
              <section className="rounded-2xl bg-obsidian-700/80 p-4 ring-1 ring-white/5">
                <div className="mb-3 flex flex-wrap gap-2">
                  {INDEX_META.map((m) => (
                    <button key={m.key} onClick={() => setBarKey(m.key)}
                      className={`rounded-full px-3 py-1.5 text-sm font-semibold ${barKey === m.key ? "bg-sov text-white" : "bg-obsidian-600 text-slate-200"}`}>{m.short}</button>
                  ))}
                </div>
                {data.indicators[barKey] && <HBar labels={data.indicators[barKey].labels} values={data.indicators[barKey].values} />}
              </section>
            </div>
            <section className="rounded-2xl bg-obsidian-700/80 p-4 ring-1 ring-white/5">
              <h3 className="mb-2 font-extrabold">Need vs readiness</h3>
              <div className="grid gap-4 lg:grid-cols-2">
                <Quadrant readiness={data.need_vs_readiness.readiness} need={data.need_vs_readiness.need} label={data.district} color={data.need_vs_readiness.quadrant.color} />
                <div className="rounded-xl border border-white/10 bg-obsidian/60 p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: data.need_vs_readiness.quadrant.color }} />
                    <span className="font-extrabold">{data.need_vs_readiness.quadrant.label}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-200">{data.need_vs_readiness.quadrant.meaning}</p>
                  <p className="mt-2 text-sm text-slate-300"><strong>Strategic focus:</strong> {data.need_vs_readiness.quadrant.focus}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {data.need_vs_readiness.quadrant.example_startups.map((s) => <Pill key={s} tone="cyan">{s}</Pill>)}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {data && !loading && tab === "phase2" && (
          <div className="space-y-6">
            {contextBars && (
              <section className="rounded-2xl bg-obsidian-700/80 p-4 ring-1 ring-white/5">
                <h2 className="mb-3 text-lg font-extrabold">District capability snapshot</h2>
                <HBar labels={contextBars.labels} values={contextBars.values} />
                {data.context?.urbanization_type != null && (
                  <p className="mt-3 text-sm text-slate-300">Urbanization: <strong className="text-white">{String(data.context.urbanization_type)}</strong></p>
                )}
              </section>
            )}
            <section>
              <h2 className="mb-3 text-lg font-extrabold">Startup recommendations</h2>
              <p className="mb-4 text-sm text-slate-300">Ranked by fit to readiness–need, infrastructure, sector alignment, and urban preference (0–100).</p>
              {!data.startup_ideas?.length && <p className="rounded-2xl border border-gold/40 bg-gold/10 p-4">No startup model crosses the suitability threshold yet.</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                {data.startup_ideas?.map((idea, i) => (
                  <article key={idea.id ?? i} className="overflow-hidden rounded-2xl bg-obsidian-700 ring-1 ring-white/5">
                    <div className="relative aspect-[16/10] bg-gradient-to-br from-sov/30 to-emerald-900/30">
                      <IdeaImage idea={idea} />
                      <span className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg bg-black/55 text-sm font-extrabold text-gold backdrop-blur">{i + 1}</span>
                      {idea.fit_score != null && (
                        <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-emerald-300 backdrop-blur">Fit {Math.round(idea.fit_score)}/100</span>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-extrabold text-white">{idea.title}</h3>
                      {idea.description && <p className="mt-1 text-sm leading-relaxed text-slate-300">{idea.description}</p>}
                      <ul className="mt-2 space-y-0.5 text-sm text-slate-300">
                        {idea.sector && <li>• Sector: {idea.sector}</li>}
                        {idea.capex_band && <li>• Capex: {idea.capex_band}</li>}
                        {idea.labour_type && <li>• Labour: {idea.labour_type}</li>}
                        {idea.urban_preference && <li>• Ideal location: {idea.urban_preference}</li>}
                        {idea.mgnrega_flag && <li>• MGNREGA: {idea.mgnrega_flag}</li>}
                      </ul>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {data && !loading && tab === "phase3" && (
          <div className="space-y-6">
            {allPotentials.length > 0 && (
              <section className="rounded-2xl bg-obsidian-700/80 p-4 ring-1 ring-white/5">
                <h2 className="mb-3 text-lg font-extrabold">Development potentials</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {allPotentials.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-3 rounded-xl bg-obsidian/70 p-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sov/30 text-sm font-extrabold text-sky-200">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{p.name}</div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-obsidian-600">
                          <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400" style={{ width: `${Math.min(100, p.score)}%` }} />
                        </div>
                      </div>
                      <span className="font-extrabold tabular-nums">{Math.round(p.score)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <section>
              <h2 className="mb-3 text-lg font-extrabold">Global development profile</h2>
              {(!data.global_models || data.global_models.length === 0) && (
                <p className="rounded-2xl border border-white/10 bg-obsidian-700 p-4 text-slate-300">Phase 3 archetype data not yet available for this district.</p>
              )}
              <div className="space-y-4">
                {data.global_models?.map((m, i) => (
                  <article key={m.archetype + i} className="rounded-2xl bg-obsidian-700/90 p-5 ring-1 ring-white/10">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold">Archetype {i + 1}</div>
                    <h3 className="text-xl font-extrabold text-white">{m.development_profile || m.archetype}</h3>
                    {m.missing && <p className="mt-2 text-sm text-amber-200">No global development model found for this archetype.</p>}
                    {!m.missing && (
                      <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-200">
                        {m.global_regions && <div><div className="font-bold text-sky-200">Global reference regions</div><p>{m.global_regions}</p></div>}
                        {m.profile_description && <div><div className="font-bold text-sky-200">Development profile</div><p>{m.profile_description}</p></div>}
                        {m.situation_20_years_ago && <div><div className="font-bold text-sky-200">Situation ~20 years ago</div><p>{m.situation_20_years_ago}</p></div>}
                        {m.key_transformation_strategies && <div><div className="font-bold text-sky-200">Key transformation strategies</div><p>{m.key_transformation_strategies}</p></div>}
                        {m.startup_ecosystem_today && <div><div className="font-bold text-sky-200">Startup ecosystem today</div><p>{m.startup_ecosystem_today}</p></div>}
                        {m.typical_startup_ideas && <div><div className="font-bold text-sky-200">Typical startup ideas</div><p>{m.typical_startup_ideas}</p></div>}
                        {m.relevant_policies && <div><div className="font-bold text-sky-200">Relevant policies & institutions</div><p>{m.relevant_policies}</p></div>}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default function OpportunityEnginePage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center bg-[#0B1220] text-white">Loading…</div>}>
      <EngineInner />
    </Suspense>
  );
}
