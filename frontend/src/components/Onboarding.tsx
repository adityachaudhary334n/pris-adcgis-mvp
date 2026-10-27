"use client";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { Icon } from "@/components/ui";

/** Welcome card. The scrim is light on purpose: the map stays visible and alive behind it. */
export default function Onboarding({ lang, onStart, onTry }: { lang: Lang; onStart: () => void; onTry: (name: string) => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-obsidian/35 p-3 backdrop-blur-[2px] md:items-center" role="dialog" aria-modal="true" aria-labelledby="wt">
      <div className="max-h-full w-full max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-obsidian/95 p-6 shadow-2xl">
        <div className="mb-4 inline-block rounded-2xl bg-white px-4 py-2"><img src="/logo.png" alt="PRIS — Prajna Regional Intelligence System" className="h-20 w-auto" /></div>
        <h1 id="wt" className="text-3xl font-extrabold leading-tight md:text-4xl">{t("welcomeTitle", lang)}</h1>
        <p className="mt-3 max-w-prose text-lg leading-relaxed text-slate-200">{t("welcomeBody", lang)}</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          <li className="rounded-2xl border-l-8 border-gold bg-obsidian-700 p-3 font-semibold">{t("welcomeA", lang)}</li>
          <li className="rounded-2xl border-l-8 border-verdant bg-obsidian-700 p-3 font-semibold">{t("welcomeB", lang)}</li>
        </ul>
        <div className="mt-5 flex flex-wrap items-center gap-2"><span className="text-slate-300">{t("tryThese", lang)}:</span>
          {["Ayodhya", "Agra", "Kaushambi"].map((n) => <button key={n} onClick={() => onTry(n)} className="min-h-12 rounded-full bg-obsidian-700 px-5 font-bold text-sky-200 ring-1 ring-sov/60 hover:bg-obsidian-600">{n}</button>)}</div>
        <button autoFocus onClick={onStart} className="mt-5 flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-gold text-xl font-extrabold text-obsidian hover:brightness-110"><Icon name="pin" className="h-6 w-6" />{t("start", lang)}</button>
      </div>
    </div>
  );
}
