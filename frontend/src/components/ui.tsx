import type { ReactNode } from "react";

/** Minimal inline icon set (24px grid, stroke) so there is no icon dependency. */
const P: Record<string, string> = {
  layers: "M12 3 3 8l9 5 9-5-9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5",
  chat: "M4 5h16v11H9l-5 4V5Z",
  leaf: "M5 19c0-9 5-14 15-14 0 10-5 15-14 15M5 19c2-4 5-7 9-9",
  close: "M6 6l12 12M18 6 6 18",
  down: "M12 4v11m0 0-4-4m4 4 4-4M5 20h14",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4",
  chev: "m6 9 6 6 6-6",
  plane: "M2 12l20-8-6 16-4-7-10-1Z",
  pin: "M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Zm0-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  target: "M12 3v4m0 10v4M3 12h4m10 0h4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-6 9a6 6 0 0 0 12 0m-6 6v3",
  camera: "M4 8h3l2-3h6l2 3h3v11H4V8Zm8 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  check: "m5 12 5 5 9-10",
  info: "M12 8h.01M11 12h1v5h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
};
export function Icon({ name, className = "h-6 w-6" }: { name: keyof typeof P; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden><path d={P[name]} /></svg>;
}

/** Radial score ring, 0–100. Colour shifts gold → cyan → verdant so rank reads without numbers. */
export function ScoreRing({ value, size = 64, label }: { value?: number | null; size?: number; label?: string }) {
  const v = value == null ? null : Math.max(0, Math.min(100, value));
  const r = (size - 8) / 2, c = 2 * Math.PI * r;
  const col = v == null ? "#475569" : v >= 70 ? "#10B981" : v >= 45 ? "#0284C7" : "#F59E0B";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label ?? "Score"} ${v == null ? "no data" : Math.round(v)}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#334155" strokeWidth="6" />
        {v != null && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: "stroke-dashoffset .6s ease" }} />}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-extrabold tabular-nums" style={{ fontSize: size * 0.34 }}>{v == null ? "–" : Math.round(v)}</span>
    </div>
  );
}

export const Panel = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-white/10 bg-obsidian/85 shadow-2xl backdrop-blur-md ${className}`}>{children}</div>
);
export const Pill = ({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "gold" | "cyan" | "green" }) => (
  <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${{ slate: "bg-obsidian-600 text-slate-100", gold: "bg-gold/20 text-gold", cyan: "bg-sov/25 text-sky-200", green: "bg-verdant/20 text-emerald-300" }[tone]}`}>{children}</span>
);
export const Skeleton = ({ className = "h-20" }: { className?: string }) => <div className={`animate-pulse rounded-xl bg-obsidian-700 ${className}`} />;
