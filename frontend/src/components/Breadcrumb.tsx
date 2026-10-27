"use client";
import type { HierarchyNode, Lang } from "@/lib/types";
/** State → District → Block → Village from /api/spatial/hierarchy/{id}. */
export default function Breadcrumb({ nodes, lang, onSelect }: { nodes: HierarchyNode[]; lang: Lang; onSelect: (n: HierarchyNode) => void }) {
  if (!nodes.length) return null;
  return (
    <nav aria-label="Location hierarchy" className="flex flex-wrap items-center gap-1">
      {nodes.map((n, i) => (
        <span key={n.id} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden className="text-slate-500">›</span>}
          <button onClick={() => onSelect(n)} aria-current={i === nodes.length - 1} className={`min-h-12 rounded-xl px-3 font-semibold ${i === nodes.length - 1 ? "bg-sov text-white" : "bg-obsidian-700 text-sky-200 hover:bg-obsidian-600"}`}>
            {lang === "hi" && n.name_hi ? n.name_hi : n.name}
          </button>
        </span>
      ))}
    </nav>
  );
}
