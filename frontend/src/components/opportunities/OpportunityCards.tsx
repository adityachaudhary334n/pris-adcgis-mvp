"use client";
import { useEffect, useState } from "react";
import { getOpportunities, getOpportunity } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { Lang, Opportunity } from "@/lib/types";
import { Icon, Pill, ScoreRing, Skeleton } from "@/components/ui";

type Step = NonNullable<Opportunity["setup_steps"]>[number];
const stepParts = (s: Step, lang: Lang) => typeof s === "string" ? { title: s, body: "" }
  : { title: (lang === "hi" && s.title_hi) || s.title || s.step || "", body: (lang === "hi" && s.description_hi) || s.description || "" };

function Card({ o, rank, lang }: { o: Opportunity; rank: number; lang: Lang }) {
  const [open, setOpen] = useState(false); const [full, setFull] = useState<Opportunity>(o); const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setOpen(!open);
    if (!open && !full.setup_steps) { setBusy(true); try { setFull(await getOpportunity(o.id)); } catch { /* "no steps" state */ } finally { setBusy(false); } }
  };
  const factors = Array.isArray(full.factors) ? full.factors.map(String) : full.factors ? Object.entries(full.factors).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`) : [];
  const title = (lang === "hi" && full.title_hi) || full.title;
  return (
    <article className="overflow-hidden rounded-2xl bg-obsidian-700 ring-1 ring-white/5">
      <div className="flex gap-3 p-3">
        {full.image_url ? <img src={full.image_url} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
          : <div aria-hidden className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-verdant/30 to-sov/30"><Icon name="leaf" className="h-10 w-10 text-emerald-300" /></div>}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div><span className="text-sm font-bold text-gold">#{rank}</span>{full.category && <span className="ml-2"><Pill tone="cyan">{full.category}</Pill></span>}
              <h4 className="mt-1 text-lg font-extrabold leading-tight">{title}</h4></div>
            <ScoreRing value={full.score} size={56} label={t("score", lang)} />
          </div>
          {full.description && <p className="mt-1.5 line-clamp-3 text-[0.95rem] text-slate-200">{full.description}</p>}
        </div>
      </div>
      {factors.length > 0 && <ul className="flex flex-wrap gap-1.5 px-3 pb-3">{factors.map((f) => <li key={f}><Pill>{f}</Pill></li>)}</ul>}
      <button onClick={toggle} aria-expanded={open} className="flex min-h-14 w-full items-center justify-between bg-sov/90 px-4 text-lg font-bold hover:bg-sov">{t("howTo", lang)}<Icon name="chev" className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} /></button>
      {open && <div className="p-4">{busy ? <Skeleton className="h-16" /> : full.setup_steps?.length ? (
        <ol className="space-y-3">{full.setup_steps.map((s, i) => { const p = stepParts(s, lang); return (
          <li key={i} className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold font-extrabold text-obsidian">{i + 1}</span>
            <div><div className="font-bold">{p.title}</div>{p.body && <div className="text-[0.95rem] text-slate-300">{p.body}</div>}</div></li>); })}</ol>
      ) : <p className="text-slate-300">{t("noSteps", lang)}</p>}</div>}
    </article>
  );
}

export default function OpportunityCards({ district, lang }: { district?: string | null; lang: Lang }) {
  const [items, setItems] = useState<Opportunity[] | null>(null); const [err, setErr] = useState(false); const [n, setN] = useState(0);
  useEffect(() => {
    let live = true; setItems(null); setErr(false);
    getOpportunities(district ?? undefined).then((r) => live && setItems([...r].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)))).catch(() => live && setErr(true));
    return () => { live = false; };
  }, [district, n]);
  return (
    <section aria-label={t("opps", lang)} className="space-y-3">
      <h3 className="text-xl font-extrabold">{district ? t("opps", lang) : t("statewideOpps", lang)}</h3>
      {err && <div role="alert" className="rounded-2xl bg-red-900/60 p-4">{t("loadError", lang)} <button className="ml-2 min-h-12 rounded-xl bg-white px-4 font-bold text-obsidian" onClick={() => setN(n + 1)}>{t("retry", lang)}</button></div>}
      {!err && !items && [1, 2].map((i) => <Skeleton key={i} className="h-36" />)}
      {items?.length === 0 && <p className="rounded-2xl border-2 border-gold/60 bg-gold/10 p-4">{t("oppsEmpty", lang)}</p>}
      {items?.map((o, i) => <Card key={o.id} o={o} rank={i + 1} lang={lang} />)}
    </section>
  );
}
