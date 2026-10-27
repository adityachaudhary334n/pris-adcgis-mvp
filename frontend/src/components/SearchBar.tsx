"use client";
import { useEffect, useRef, useState } from "react";
import { searchPlaces } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { Lang, SearchResult } from "@/lib/types";
import { Icon } from "@/components/ui";

const LEVEL: Record<string, { en: string; hi: string }> = { state: { en: "State", hi: "राज्य" }, district: { en: "District", hi: "ज़िला" }, block: { en: "Block", hi: "ब्लॉक" }, village: { en: "Village", hi: "गाँव" } };

/** Typeahead over /api/spatial/search (English or Hindi). Debounced; stale responses are dropped. */
export default function SearchBar({ lang, onSelect }: { lang: Lang; onSelect: (r: SearchResult) => void }) {
  const [q, setQ] = useState(""); const [res, setRes] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(false); const [open, setOpen] = useState(false); const [hi, setHi] = useState(0);
  const seq = useRef(0); const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); setErr(false); setBusy(false); return; }
    const id = ++seq.current; setBusy(true);
    const h = setTimeout(async () => {
      try { const r = await searchPlaces(q.trim()); if (id === seq.current) { setRes(r); setErr(false); setHi(0); } }
      catch { if (id === seq.current) { setRes([]); setErr(true); } }
      finally { if (id === seq.current) setBusy(false); }
    }, 220);
    return () => clearTimeout(h);
  }, [q]);
  useEffect(() => { const f = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", f); return () => document.removeEventListener("mousedown", f); }, []);
  const pick = (r: SearchResult) => { onSelect(r); setQ(lang === "hi" && r.name_hi ? r.name_hi : r.name); setOpen(false); };
  return (
    <div ref={box} className="relative w-full">
      <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-500" />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setHi((i) => Math.min(i + 1, res.length - 1)); } else if (e.key === "ArrowUp") { e.preventDefault(); setHi((i) => Math.max(i - 1, 0)); } else if (e.key === "Enter" && res[hi]) pick(res[hi]); else if (e.key === "Escape") setOpen(false); }}
        placeholder={t("search", lang)} aria-label={t("search", lang)} role="combobox" aria-expanded={open && q.length > 1} aria-controls="search-list" autoComplete="off"
        className="h-14 w-full rounded-2xl border-2 border-transparent bg-white pl-12 pr-4 text-lg font-semibold text-obsidian shadow-xl placeholder:font-medium placeholder:text-slate-500 focus:border-sov focus-visible:outline-none" />
      {open && q.trim().length > 1 && (
        <ul id="search-list" role="listbox" className="absolute z-40 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl bg-white p-1 shadow-2xl">
          {busy && <li className="p-4 text-slate-600">{t("layerLoading", lang)}</li>}
          {!busy && err && <li className="p-4 font-semibold text-red-700">{t("loadError", lang)}</li>}
          {!busy && !err && res.length === 0 && <li className="p-4 text-slate-700">{t("noResults", lang)}</li>}
          {res.map((r, i) => (
            <li key={r.id} role="option" aria-selected={i === hi}>
              <button className={`flex min-h-16 w-full items-center justify-between gap-3 rounded-xl px-4 py-2 text-left ${i === hi ? "bg-sky-100" : "hover:bg-sky-50"}`} onMouseEnter={() => setHi(i)} onClick={() => pick(r)}>
                <span><span className="block text-lg font-bold text-obsidian">{lang === "hi" && r.name_hi ? r.name_hi : r.name}</span>
                  {(r.path || r.district) && <span className="text-sm text-slate-600">{r.path ?? r.district}</span>}</span>
                <span className="shrink-0 rounded-full bg-obsidian px-3 py-1 text-sm font-semibold text-white">{LEVEL[r.level]?.[lang] ?? r.level}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
