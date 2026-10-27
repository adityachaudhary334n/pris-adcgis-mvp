"use client";
import { useEffect, useMemo, useState } from "react";
import { getDiagnostic, type DistrictDiagnostic } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { Icon, Pill, ScoreRing, Skeleton } from "@/components/ui";

/* ───────────── pure SVG charts (no extra deps) ───────────── */

function RadarChart({ labels, values, size = 280 }: { labels: string[]; values: number[]; size?: number }) {
  const n = labels.length;
  const cx = size / 2, cy = size / 2, r = size * 0.36;
  const angle = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const pt = (i: number, v: number) => {
    const a = angle(i);
    const rr = (Math.max(0, Math.min(100, v)) / 100) * r;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as const;
  };
  const poly = values.map((v, i) => pt(i, v).join(",")).join(" ");
  const rings = [25, 50, 75, 100];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[320px]" role="img" aria-label="Capability radar">
      {rings.map((rv) => (
        <polygon
          key={rv}
          fill="none"
          stroke="rgba(148,163,184,0.25)"
          strokeWidth="1"
          points={Array.from({ length: n }, (_, i) => pt(i, rv).join(",")).join(" ")}
        />
      ))}
      {labels.map((_, i) => {
        const [x, y] = pt(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(148,163,184,0.2)" strokeWidth="1" />;
      })}
      <polygon points={poly} fill="rgba(2,132,199,0.35)" stroke="#38BDF8" strokeWidth="2.5" strokeLinejoin="round" />
      {values.map((v, i) => {
        const [x, y] = pt(i, v);
        return <circle key={i} cx={x} cy={y} r="4" fill="#F59E0B" stroke="#0B1220" strokeWidth="1.5" />;
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
  const max = 100;
  return (
    <div className="space-y-2.5">
      {labels.map((lab, i) => {
        const v = Math.max(0, Math.min(100, values[i] ?? 0));
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
  const size = 260;
  const pad = 36;
  const plot = size - pad * 2;
  const x = pad + (Math.max(0, Math.min(100, readiness)) / 100) * plot;
  const y = pad + (1 - Math.max(0, Math.min(100, need)) / 100) * plot;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[300px]" role="img" aria-label="Need vs readiness">
      <rect x={pad} y={pad} width={plot / 2} height={plot / 2} fill="rgba(2,132,199,0.12)" />
      <rect x={pad + plot / 2} y={pad} width={plot / 2} height={plot / 2} fill="rgba(16,185,129,0.12)" />
      <rect x={pad} y={pad + plot / 2} width={plot / 2} height={plot / 2} fill="rgba(239,68,68,0.1)" />
      <rect x={pad + plot / 2} y={pad + plot / 2} width={plot / 2} height={plot / 2} fill="rgba(245,158,11,0.1)" />
      <line x1={pad + plot / 2} y1={pad} x2={pad + plot / 2} y2={pad + plot} stroke="rgba(148,163,184,0.4)" strokeDasharray="4 4" />
      <line x1={pad} y1={pad + plot / 2} x2={pad + plot} y2={pad + plot / 2} stroke="rgba(148,163,184,0.4)" strokeDasharray="4 4" />
      <rect x={pad} y={pad} width={plot} height={plot} fill="none" stroke="rgba(148,163,184,0.35)" />
      <circle cx={x} cy={y} r="10" fill={color} stroke="#0B1220" strokeWidth="2" />
      <text x={x} y={y - 16} textAnchor="middle" fill="#F8FAFC" fontSize="12" fontWeight="700">{label}</text>
      <text x={size / 2} y={size - 8} textAnchor="middle" fill="#94A3B8" fontSize="11">Infrastructure readiness →</text>
      <text x={14} y={size / 2} textAnchor="middle" fill="#94A3B8" fontSize="11" transform={`rotate(-90 14 ${size / 2})`}>← Development need</text>
    </svg>
  );
}

const INDEX_META: { key: keyof DistrictDiagnostic["indices"]; label: string; short: string }[] = [
  { key: "water_climate", label: "Water & Climate", short: "Water" },
  { key: "agro_economic", label: "Agro-Economic", short: "Agro" },
  { key: "renewable_energy", label: "Renewable Energy", short: "Energy" },
  { key: "labour_human_capital", label: "Labour & Human Capital", short: "Labour" },
  { key: "infrastructure", label: "Infrastructure", short: "Infra" },
];

type Idea = DistrictDiagnostic["startup_ideas"][number];

/** Image with cascading fallbacks so the card never shows a blank area. */
function IdeaCard({ idea, rank }: { idea: Idea; rank: number }) {
  const [src, setSrc] = useState<string>(() => idea.image_url || "/startup_images/_placeholder.svg");
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
  const initials = (idea.title || "OP")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <article className="overflow-hidden rounded-2xl bg-obsidian-700 ring-1 ring-white/5">
      <div className="relative aspect-[16/9] w-full bg-gradient-to-br from-sov/40 to-emerald-900/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          onError={onError}
          className="h-full w-full object-cover"
        />
        <span className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl bg-black/55 text-sm font-extrabold text-gold backdrop-blur">
          {rank}
        </span>
        {idea.fit_score != null && (
          <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-emerald-300 backdrop-blur">
            fit {idea.fit_score}
          </span>
        )}
        {!src.includes("_placeholder") ? null : (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-4xl font-extrabold text-white/25">
            {initials}
          </span>
        )}
      </div>
      <div className="p-4">
        <h4 className="text-base font-extrabold text-white">{idea.title ?? "Idea"}</h4>
        {idea.description && (
          <p className="mt-1 text-sm leading-relaxed text-slate-300">{idea.description}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {idea.sector && <Pill tone="cyan">{idea.sector}</Pill>}
          {idea.urban_preference && <Pill tone="slate">{idea.urban_preference}</Pill>}
          {idea.capex_band && <Pill tone="gold">{idea.capex_band} capex</Pill>}
          {idea.labour_type && <Pill tone="slate">{idea.labour_type}</Pill>}
        </div>
      </div>
    </article>
  );
}

type Props = {
  district: string;
  lang: Lang;
  onClose: () => void;
};

export default function OpportunityEngine({ district, lang, onClose }: Props) {
  const [data, setData] = useState<DistrictDiagnostic | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [barKey, setBarKey] = useState<keyof DistrictDiagnostic["indices"]>("infrastructure");

  useEffect(() => {
    let live = true;
    setLoading(true);
    setErr(null);
    setData(null);
    getDiagnostic(district)
      .then((d) => live && setData(d))
      .catch(async (e) => {
        if (!live) return;
        // Try to surface available districts from 404 body if present
        setErr(e?.message ?? "Failed to load");
      })
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [district]);

  const overall = useMemo(() => {
    if (!data) return null;
    const vals = Object.values(data.indices);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [data]);

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-end bg-black/60 backdrop-blur-sm" role="dialog" aria-modal aria-label={t("opp_engine", lang)}>
      <div className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-[#0B1220] shadow-2xl ring-1 ring-white/10 md:rounded-l-3xl">
        {/* Header */}
        <header className="flex items-start gap-3 border-b border-white/10 bg-obsidian/90 p-4">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-gold">{t("opp_engine", lang)}</div>
            <h2 className="truncate text-2xl font-extrabold text-white">
              {t("opp_engine_for", lang)} {data?.district ?? district}
            </h2>
            <p className="mt-0.5 text-sm text-slate-300">{t("opp_engine_summary", lang)}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("close", lang)}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-obsidian-700 hover:bg-obsidian-600"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-64" />
              <Skeleton className="h-40" />
            </div>
          )}

          {!loading && err && !data && (
            <div className="space-y-4 rounded-2xl border-2 border-gold/50 bg-gold/10 p-5">
              <p className="text-base leading-relaxed text-slate-100">{t("opp_no_data", lang)}</p>
              <p className="text-sm text-slate-300">Requested: <strong>{district}</strong></p>
              <button onClick={onClose} className="min-h-12 rounded-xl bg-sov px-5 font-bold text-white">
                {t("opp_back", lang)}
              </button>
            </div>
          )}

          {data && (
            <>
              {/* Index score rings */}
              <section>
                <h3 className="mb-3 text-lg font-extrabold">{t("opp_indices", lang)}</h3>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-3 rounded-2xl bg-obsidian-700 p-3 ring-1 ring-white/5">
                    <ScoreRing value={overall} size={72} label="Overall" />
                    <div>
                      <div className="text-sm text-slate-300">Overall</div>
                      <div className="text-xl font-extrabold tabular-nums">{overall != null ? Math.round(overall) : "–"}</div>
                    </div>
                  </div>
                  {INDEX_META.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setBarKey(m.key)}
                      className={`flex items-center gap-2 rounded-2xl p-2.5 ring-1 transition ${
                        barKey === m.key ? "bg-sov/30 ring-sky-400/50" : "bg-obsidian-700 ring-white/5 hover:bg-obsidian-600"
                      }`}
                    >
                      <ScoreRing value={data.indices[m.key]} size={52} label={m.short} />
                      <span className="hidden text-sm font-semibold sm:inline">{m.short}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Radar */}
              <section className="rounded-2xl bg-obsidian-700/80 p-4 ring-1 ring-white/5">
                <h3 className="mb-2 text-lg font-extrabold">{t("opp_radar", lang)}</h3>
                <RadarChart labels={data.radar.labels} values={data.radar.values} />
              </section>

              {/* Drill-down bars */}
              <section className="rounded-2xl bg-obsidian-700/80 p-4 ring-1 ring-white/5">
                <div className="mb-3 flex flex-wrap gap-2">
                  {INDEX_META.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setBarKey(m.key)}
                      className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                        barKey === m.key ? "bg-sov text-white" : "bg-obsidian-600 text-slate-200 hover:bg-obsidian-500"
                      }`}
                    >
                      {m.short}
                    </button>
                  ))}
                </div>
                {data.indicators[barKey] && (
                  <HBar labels={data.indicators[barKey].labels} values={data.indicators[barKey].values} />
                )}
              </section>

              {/* Need vs readiness */}
              <section className="rounded-2xl bg-obsidian-700/80 p-4 ring-1 ring-white/5">
                <h3 className="mb-2 text-lg font-extrabold">{t("opp_quadrant", lang)}</h3>
                <Quadrant
                  readiness={data.need_vs_readiness.readiness}
                  need={data.need_vs_readiness.need}
                  label={data.district}
                  color={data.need_vs_readiness.quadrant.color}
                />
                <div className="mt-4 rounded-xl border border-white/10 bg-obsidian/60 p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: data.need_vs_readiness.quadrant.color }} />
                    <span className="font-extrabold">{data.need_vs_readiness.quadrant.label}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-200">{data.need_vs_readiness.quadrant.meaning}</p>
                  <p className="mt-2 text-sm text-slate-300">
                    <strong>{t("opp_strategic", lang)}:</strong> {data.need_vs_readiness.quadrant.focus}
                  </p>
                  {data.need_vs_readiness.quadrant.example_startups?.length > 0 && (
                    <div className="mt-3">
                      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{t("opp_examples", lang)}</div>
                      <div className="flex flex-wrap gap-2">
                        {data.need_vs_readiness.quadrant.example_startups.map((s) => (
                          <Pill key={s} tone="cyan">{s}</Pill>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Context snapshot */}
              {data.context && Object.keys(data.context).length > 0 && (
                <section className="rounded-2xl bg-obsidian-700/80 p-4 ring-1 ring-white/5">
                  <h3 className="mb-3 text-lg font-extrabold">{t("opp_context", lang)}</h3>
                  <HBar
                    labels={Object.keys(data.context).map((k) => k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))}
                    values={Object.values(data.context).map(Number)}
                  />
                </section>
              )}

              {/* Top potentials */}
              {data.top_potentials?.length > 0 && (
                <section className="rounded-2xl bg-obsidian-700/80 p-4 ring-1 ring-white/5">
                  <h3 className="mb-3 text-lg font-extrabold">{t("opp_potential", lang)}</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {data.top_potentials.map((p, i) => (
                      <div key={p.name} className="flex items-center gap-3 rounded-xl bg-obsidian/70 p-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sov/30 text-sm font-extrabold text-sky-200">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-white">{p.name}</div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-obsidian-600">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400"
                              style={{ width: `${Math.min(100, p.score)}%` }}
                            />
                          </div>
                        </div>
                        <span className="font-extrabold tabular-nums text-white">{Math.round(p.score)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Startup ideas — image from /startup_images or API static; never blank */}
              {data.startup_ideas?.length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-lg font-extrabold">{t("opp_ideas", lang)}</h3>
                  {data.startup_ideas.map((idea, i) => (
                    <IdeaCard key={idea.id ?? i} idea={idea} rank={i + 1} />
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
