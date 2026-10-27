"use client";
import { useEffect, useRef, useState } from "react";
import { askPai } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Icon } from "@/components/ui";
import type { ChatMessage, Lang } from "@/lib/types";

interface Ctx { lat?: number; lon?: number; district?: string; village?: string }

/** PAI-lite chat: grounded answers, visible sources, and an explicit "no data" state with nearest information. */
export default function PaiChat({ lang, ctx, onClose }: { lang: Lang; ctx: Ctx; onClose: () => void }) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]); const [text, setText] = useState(""); const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);
  const send = async (m: string) => {
    if (!m.trim() || busy) return;
    setMsgs((x) => [...x, { role: "user", text: m }]); setText(""); setBusy(true);
    try { const r = await askPai({ message: m, ...ctx, language: lang }); setMsgs((x) => [...x, { role: "system", text: r.answer, meta: r }]); }
    catch { setMsgs((x) => [...x, { role: "system", text: t("chatError", lang), meta: { answer: "", data_available: null } }]); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex h-full flex-col bg-obsidian/95 backdrop-blur-md" role="dialog" aria-label={t("chat", lang)}>
      <header className="flex items-center justify-between border-b border-obsidian-600 p-3">
        <div><h2 className="flex items-center gap-2 text-xl font-extrabold text-white"><Icon name="chat" className="h-6 w-6 text-gold" />{t("chat", lang)}</h2><p className="text-sm text-slate-400">{t("poweredBy", lang)}</p></div>
        <button onClick={onClose} className="min-h-12 min-w-12 rounded-lg bg-obsidian-700 px-3 text-white" aria-label={t("close", lang)}><Icon name="close" className="mx-auto h-5 w-5" /></button>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
        {msgs.length === 0 && <div className="space-y-2">{(["q1", "q2"] as const).map((k) => (
          <button key={k} onClick={() => send(t(k, lang))} className="min-h-16 w-full rounded-xl bg-obsidian-700 px-4 text-left text-lg font-semibold text-sky-200">{t(k, lang)}</button>))}</div>}
        {msgs.map((m, i) => m.role === "user" ? (
          <div key={i} className="ml-8 rounded-2xl rounded-br-md bg-sov p-3 text-lg text-white">{m.text}</div>
        ) : (
          <div key={i} className={`mr-8 rounded-2xl rounded-bl-md border-l-4 bg-obsidian-700 p-3 text-lg text-white ${m.meta?.data_available === false ? "border-gold" : "border-verdant"}`}>
            {m.meta?.data_available === false && <p className="mb-1 font-bold text-gold">{t("chatNoData", lang)}</p>}
            <p className="whitespace-pre-wrap">{m.text}</p>
            {m.meta?.nearest_available && <p className="mt-2 rounded bg-obsidian p-2 text-base text-sky-200"><b>{t("nearest", lang)}:</b> {m.meta.nearest_available}</p>}
            {!!m.meta?.sources?.length && <p className="mt-2 text-sm text-slate-300"><b>{t("sources", lang)}:</b> {m.meta.sources.map((s) => typeof s === "string" ? s : s.title ?? s.source).join(" · ")}</p>}
          </div>))}
        {busy && <div className="mr-8 animate-pulse rounded-xl bg-obsidian-700 p-3 text-slate-300">{t("thinking", lang)}</div>}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex gap-2 border-t border-obsidian-600 p-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={t("chatHint", lang)} aria-label={t("chatHint", lang)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
          className="min-h-16 flex-1 resize-none rounded-xl bg-white p-3 text-lg text-obsidian focus-visible:outline focus-visible:outline-4 focus-visible:outline-gold" />
        <button type="button" disabled title={t("micSoon", lang)} aria-label={t("micSoon", lang)} className="w-14 rounded-xl bg-obsidian-700 opacity-50"><Icon name="mic" className="mx-auto h-6 w-6" /></button>
        <button type="submit" disabled={busy || !text.trim()} className="min-w-20 rounded-xl bg-gold px-4 text-lg font-bold text-obsidian disabled:opacity-50">{t("send", lang)}</button>
      </form>
    </div>
  );
}
