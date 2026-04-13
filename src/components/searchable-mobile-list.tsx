"use client";

import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

type SearchableItem = {
  id: string;
  href?: string | null;
  title: string;
  subtitle?: string;
  meta?: string;
  rightTitle?: string;
  rightMeta?: ReactNode;
  badge?: ReactNode;
  keywords?: string[];
};

type SearchableMobileListProps = {
  items: SearchableItem[];
  searchPlaceholder: string;
  emptyTitle: string;
  emptyDescription: string;
};

export function SearchableMobileList({
  items,
  searchPlaceholder,
  emptyTitle,
  emptyDescription,
}: SearchableMobileListProps) {
  const [query, setQuery] = useState("");

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;

    return items.filter((item) => {
      const haystack = [
        item.title,
        item.subtitle,
        item.meta,
        item.rightTitle,
        ...(item.keywords || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [items, query]);

  return (
    <div className="space-y-3">
      <div className="mobile-input-shell flex items-center gap-3 px-4 py-3">
        <Search size={16} className="mobile-text-tertiary" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          className="mobile-text-primary w-full bg-transparent text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
        />
      </div>

      {filteredItems.length === 0 ? (
        <section className="mobile-panel px-4 py-5 text-center">
          <p className="mobile-text-primary text-base font-semibold">{emptyTitle}</p>
          <p className="mobile-text-secondary mt-2 text-sm leading-relaxed">{emptyDescription}</p>
        </section>
      ) : (
        <section className="mobile-panel px-3 py-3">
          <div className="mobile-compact-list">
            {filteredItems.map((item) => {
              const content = (
                <div className="mobile-row">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="mobile-text-primary truncate text-sm font-semibold">{item.title}</p>
                        {item.subtitle ? (
                          <p className="mobile-text-secondary mt-1 truncate text-[13px]">{item.subtitle}</p>
                        ) : null}
                      </div>
                      {item.badge ? <div className="shrink-0">{item.badge}</div> : null}
                    </div>

                    {(item.meta || item.rightTitle || item.rightMeta) ? (
                      <div className="mt-3 flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          {item.meta ? <p className="mobile-text-tertiary truncate text-xs">{item.meta}</p> : null}
                        </div>
                        {(item.rightTitle || item.rightMeta) ? (
                          <div className="shrink-0 text-right">
                            {item.rightTitle ? <p className="mobile-text-primary text-sm font-semibold">{item.rightTitle}</p> : null}
                            {item.rightMeta ? <div className="mt-1 text-xs">{item.rightMeta}</div> : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  {item.href ? <ChevronRight size={16} className="mobile-text-tertiary shrink-0" /> : null}
                </div>
              );

              return item.href ? (
                <Link key={item.id} href={item.href} className="block">
                  {content}
                </Link>
              ) : (
                <div key={item.id}>{content}</div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
