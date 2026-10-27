#!/usr/bin/env python3
"""Generate SVG placeholders using EXACT basenames from startup_ideas.csv (spaces kept)."""
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV = ROOT / "backend/app/diagnostics/data/Phase_2/startup_ideas.csv"
OUTS = [
    ROOT / "frontend/public/startup_images",
    ROOT / "backend/app/diagnostics/static/startup_images",
]
SECTOR = {
    "it": ("#0284C7", "#0EA5E9"), "deep": ("#7C3AED", "#A78BFA"), "health": ("#059669", "#34D399"),
    "edu": ("#D97706", "#FBBF24"), "skill": ("#D97706", "#FBBF24"), "agri": ("#65A30D", "#A3E635"),
    "tour": ("#DB2777", "#F472B6"), "manu": ("#475569", "#94A3B8"), "energy": ("#EA580C", "#FB923C"),
    "log": ("#0891B2", "#22D3EE"), "fin": ("#4F46E5", "#818CF8"), "waste": ("#78716C", "#A8A29E"),
}

def cols(sector: str):
    s = (sector or "").lower()
    for k, v in SECTOR.items():
        if k in s:
            return v
    return ("#334155", "#64748B")

def svg(title: str, sector: str, c1: str, c2: str) -> str:
    t = (title or "Startup")[:40].replace("&", "&amp;")
    s = (sector or "Opportunity")[:28].replace("&", "&amp;")
    init = "".join(w[0] for w in t.split()[:2]).upper() or "OP"
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
  <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="{c1}"/><stop offset="100%" stop-color="{c2}"/>
  </linearGradient></defs>
  <rect width="640" height="400" fill="#0B1220"/>
  <rect x="20" y="20" width="600" height="360" rx="24" fill="url(#g)" opacity="0.95"/>
  <circle cx="110" cy="150" r="50" fill="rgba(255,255,255,0.2)"/>
  <text x="110" y="160" text-anchor="middle" font-family="system-ui,sans-serif" font-size="32" font-weight="800" fill="#fff">{init}</text>
  <text x="180" y="145" font-family="system-ui,sans-serif" font-size="24" font-weight="800" fill="#fff">{t}</text>
  <text x="180" y="180" font-family="system-ui,sans-serif" font-size="16" font-weight="600" fill="rgba(255,255,255,0.9)">{s}</text>
  <text x="40" y="350" font-family="system-ui,sans-serif" font-size="13" fill="rgba(255,255,255,0.75)">PRIS · replace with real photo using this exact filename</text>
</svg>
'''

def main():
    for o in OUTS:
        o.mkdir(parents=True, exist_ok=True)
        for f in list(o.iterdir()):
            if f.name != "README.txt":
                f.unlink(missing_ok=True)
    rows = list(csv.DictReader(CSV.open(encoding="utf-8")))
    n = 0
    for r in rows:
        img = (r.get("image_path") or "").strip()
        if not img:
            continue
        name = Path(img).name  # EXACT — keep spaces
        c1, c2 = cols(r.get("sector") or "")
        content = svg(r.get("startup_name") or "Startup", r.get("sector") or "", c1, c2)
        for base in OUTS:
            (base / name).write_text(content, encoding="utf-8")
        n += 1
    fallback = svg("Opportunity", "Startup idea", "#0284C7", "#10B981")
    readme = (
        "Drop real photos here using the EXACT basename from\n"
        "backend/app/diagnostics/data/Phase_2/startup_ideas.csv → image_path\n"
        "Spaces in filenames are intentional (e.g. 'ai ml development lab.jpg').\n"
        "Do NOT rename with hyphens unless you also change the CSV.\n"
        "Frontend: /startup_images/<exact name>\n"
        "API: /api/diagnostics/static/startup_images/<exact name>\n"
    )
    for base in OUTS:
        (base / "_placeholder.svg").write_text(fallback, encoding="utf-8")
        (base / "README.txt").write_text(readme, encoding="utf-8")
    print(f"exact placeholders: {n}")

if __name__ == "__main__":
    main()
