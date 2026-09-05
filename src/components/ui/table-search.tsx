"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

/**
 * Live, client-side filter for a server-rendered table.
 * Wrap the Card containing the table in an element with [data-searchable]
 * and drop <TableSearch /> anywhere inside it. Rows whose text doesn't match
 * the query are hidden; an empty-state row is shown when nothing matches.
 */
export function TableSearch({ placeholder = "Rechercher…" }: { placeholder?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const scope = ref.current?.closest("[data-searchable]");
    if (!scope) return;
    const rows = Array.from(scope.querySelectorAll<HTMLTableRowElement>("tbody tr[data-row]"));
    const q = query.trim().toLowerCase();

    let visible = 0;
    for (const row of rows) {
      const match = !q || (row.textContent ?? "").toLowerCase().includes(q);
      row.hidden = !match;
      if (match) visible++;
    }

    // Toggle a "no results" row if present.
    const empty = scope.querySelector<HTMLElement>("[data-empty-row]");
    if (empty) empty.hidden = visible !== 0 || !q;

    setCount(q ? visible : null);
  }, [query]);

  return (
    <div ref={ref} className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-9 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/25"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label="Effacer"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      )}
      {count !== null && (
        <span className="absolute -bottom-5 left-1 text-xs text-muted-foreground">
          {count} résultat{count > 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}
