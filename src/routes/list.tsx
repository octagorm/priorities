import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { Search, X, ChevronLeft } from "lucide-react";
import { CATEGORY_ICONS, energyDots } from "../lib/constants";

export const Route = createFileRoute("/list")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: search.q as string | undefined,
  }),
  component: ListView,
});

function ListView() {
  const { q = "" } = Route.useSearch();
  const navigate = useNavigate();
  const activities = useQuery(api.activities.list);
  const [searchQuery, setSearchQuery] = useState(q);

  const updateSearch = (value: string) => {
    setSearchQuery(value);
    navigate({
      to: "/list",
      search: value ? { q: value } : { q: undefined },
      replace: true,
    });
  };

  if (activities === undefined) {
    return <div className="pt-8 text-base-400 text-center">Loading...</div>;
  }

  const query = searchQuery.toLowerCase().trim();
  const filtered = query
    ? activities.filter((a) => a.name.toLowerCase().includes(query))
    : activities;

  // Group by category, sort categories and activities alphabetically
  const byCategory = new Map<string, typeof filtered>();
  for (const a of filtered) {
    if (!byCategory.has(a.category)) byCategory.set(a.category, []);
    byCategory.get(a.category)!.push(a);
  }
  const sortedCategories = [...byCategory.keys()].sort();
  for (const group of byCategory.values()) {
    group.sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <div className="pt-4 pb-8">
      <div className="flex items-center gap-2 mb-4">
        <Link
          to="/"
          search={searchQuery ? { q: searchQuery } : { q: undefined }}
          className="text-base-400 text-sm shrink-0"
        >
          <ChevronLeft size={20} />
        </Link>
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => updateSearch(e.target.value)}
            placeholder="Search activities..."
            className="w-full bg-base-900 text-base-100 rounded-xl pl-10 pr-9 py-2.5 border border-base-700 focus:border-accent focus:outline-none text-sm placeholder:text-base-600"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => updateSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-base-500 hover:text-base-300"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {sortedCategories.map((category) => {
        const items = byCategory.get(category)!;
        const CatIcon = CATEGORY_ICONS[category];
        return (
          <div key={category} className="mb-4">
            <div className="flex items-center gap-2 px-1 mb-1.5">
              {CatIcon && <CatIcon size={14} className="text-base-500" />}
              <h3 className="text-xs uppercase tracking-wider text-base-500">
                {category}
              </h3>
            </div>
            {items.map((a) => (
              <Link
                key={a._id}
                to="/activities/$activityId"
                params={{ activityId: a._id }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-base-850 transition-colors"
              >
                <span className="text-base-100 text-sm flex-1 min-w-0 truncate">
                  {a.name}
                </span>
                <span className="flex items-center gap-2 text-sm shrink-0">
                  <span className="text-red-400/70">{energyDots(a.physicalEnergyCost)}</span>
                  <span className="text-emerald-400/70">{energyDots(a.mentalEnergyCost)}</span>
                </span>
              </Link>
            ))}
          </div>
        );
      })}

      {filtered.length === 0 && (
        <p className="text-base-500 text-sm text-center py-8">No activities found</p>
      )}
    </div>
  );
}
