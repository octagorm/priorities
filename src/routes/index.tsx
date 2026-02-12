import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { EnergySliders } from "../components/EnergySliders";
import { ActivityCard } from "../components/ActivityCard";
import { prioritizeActivities } from "../lib/prioritization";
import { CATEGORY_ICONS, formatTimeRemaining } from "../lib/constants";

export const Route = createFileRoute("/")({
  component: MainScreen,
});

function MainScreen() {
  const activities = useQuery(api.activities.list);
  const sessions = useQuery(api.sessions.listRecent);
  const seed = useMutation(api.activities.seedDefaultActivities);

  const [mentalEnergy, setMentalEnergy] = useState(() => {
    const saved = localStorage.getItem("mentalEnergy");
    return saved ? Number(saved) : 2;
  });
  const [physicalEnergy, setPhysicalEnergy] = useState(() => {
    const saved = localStorage.getItem("physicalEnergy");
    return saved ? Number(saved) : 1;
  });

  useEffect(() => { localStorage.setItem("mentalEnergy", String(mentalEnergy)); }, [mentalEnergy]);
  useEffect(() => { localStorage.setItem("physicalEnergy", String(physicalEnergy)); }, [physicalEnergy]);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [showMore, setShowMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Seed on first load
  useEffect(() => {
    if (activities !== undefined && activities.length === 0) {
      seed();
    }
  }, [activities, seed]);

  // Update hour every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (activities === undefined || sessions === undefined) {
    return <div className="pt-8 text-base-400 text-center">Loading...</div>;
  }

  const now = Date.now();
  const pausedActivities = activities.filter(
    (a) => a.pausedUntil && a.pausedUntil > now
  );
  const activeActivities = activities.filter(
    (a) => !a.pausedUntil || a.pausedUntil <= now
  );

  const prioritized = prioritizeActivities(
    activeActivities,
    sessions,
    mentalEnergy,
    physicalEnergy,
    currentHour
  );

  const moreCount = Math.max(0, prioritized.available.length - 3);
  const beyondCount = prioritized.too_tired.length;

  const query = searchQuery.toLowerCase().trim();
  const searchResults = query
    ? activities.filter((a) => a.name.toLowerCase().includes(query))
    : [];

  return (
    <div className="pt-4">
      {/* Search bar */}
      <div className="relative mb-2">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-500" />
        <input
          ref={searchRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search activities..."
          className="w-full bg-base-900 text-base-100 rounded-xl pl-10 pr-9 py-2.5 border border-base-700 focus:border-accent focus:outline-none text-sm placeholder:text-base-600"
        />
        {searchQuery && (
          <button
            onClick={() => { setSearchQuery(""); searchRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-base-500 hover:text-base-300"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Search results */}
      {query && (
        <div className="mb-4">
          {searchResults.length === 0 ? (
            <p className="text-base-500 text-sm text-center py-4">No matches</p>
          ) : (
            searchResults.map((a) => {
              const AIcon = CATEGORY_ICONS[a.category];
              return (
                <Link
                  key={a._id}
                  to="/activities/$activityId"
                  params={{ activityId: a._id }}
                  className="flex items-center gap-2.5 bg-base-850 border border-base-700 rounded-xl px-4 py-3 mb-3"
                >
                  {AIcon && <AIcon size={20} className="text-base-300" />}
                  <span className="text-base text-base-50 flex-1">{a.name}</span>
                  <span className="text-sm text-base-500">{a.category}</span>
                </Link>
              );
            })
          )}
        </div>
      )}

      {!query && prioritized.available.length > 0 && (
        <Section
          title="What to do now"
          action={
            <Link
              to="/activities/$activityId"
              params={{ activityId: "new" }}
              className="text-base-400 text-sm tracking-wider"
            >
              + Add
            </Link>
          }
        >
          {prioritized.available.slice(0, 3).map((item) => (
            <ActivityCard
              key={item.activity._id}
              item={item}
              mentalEnergy={mentalEnergy}
              physicalEnergy={physicalEnergy}
            />
          ))}
          {(prioritized.available.length > 3 || prioritized.too_tired.length > 0) && (
            <>
              {showMore && (
                <>
                  {prioritized.available.slice(3).map((item) => (
                    <ActivityCard
                      key={item.activity._id}
                      item={item}
                      mentalEnergy={mentalEnergy}
                      physicalEnergy={physicalEnergy}
                    />
                  ))}
                  {prioritized.too_tired.length > 0 && (
                    <div className="mt-4 mb-2 px-1">
                      <h3 className="text-sm uppercase tracking-wider text-base-500">
                        Too tired for
                      </h3>
                    </div>
                  )}
                  {prioritized.too_tired.map((item) => (
                    <ActivityCard
                      key={item.activity._id}
                      item={item}
                      mentalEnergy={mentalEnergy}
                      physicalEnergy={physicalEnergy}
                    />
                  ))}
                </>
              )}
              <button
                onClick={() => setShowMore(!showMore)}
                className="w-full text-base-400 text-sm py-3 hover:text-base-300 transition-colors"
              >
                {showMore
                  ? "Show less"
                  : [
                      moreCount > 0 ? `${moreCount} more` : null,
                      beyondCount > 0 ? `${beyondCount} beyond` : null,
                    ].filter(Boolean).join(" + ")}
              </button>
            </>
          )}
        </Section>
      )}

      {!query && prioritized.cooldown.length > 0 && (
        <Section title="On cooldown">
          {prioritized.cooldown.map((item) => (
            <ActivityCard
              key={item.activity._id}
              item={item}
              mentalEnergy={mentalEnergy}
              physicalEnergy={physicalEnergy}
            />
          ))}
        </Section>
      )}

      {!query && prioritized.wrong_time.length > 0 && (
        <Section title="Not right now">
          {prioritized.wrong_time.map((item) => (
            <ActivityCard
              key={item.activity._id}
              item={item}
              mentalEnergy={mentalEnergy}
              physicalEnergy={physicalEnergy}
            />
          ))}
        </Section>
      )}

      {!query && pausedActivities.length > 0 && (
        <Section title="Paused">
          {pausedActivities.map((a) => {
            const PausedIcon = CATEGORY_ICONS[a.category];
            return (
            <Link
              key={a._id}
              to="/activities/$activityId"
              params={{ activityId: a._id }}
              className="flex items-center gap-2.5 bg-base-900/50 border border-base-800/50 rounded-xl px-4 py-3 mb-3"
            >
              {PausedIcon && <PausedIcon size={18} className="text-base-600" />}
              <span className="text-base-400 text-base flex-1">{a.name}</span>
              <span className="text-base-500 text-sm">
                {formatTimeRemaining(a.pausedUntil! - now)}
              </span>
            </Link>
            );
          })}
        </Section>
      )}

      <div className="h-20" /> {/* spacer for fixed bottom bar */}

      <div className="fixed bottom-0 left-0 right-0 bg-base-950/90 backdrop-blur border-t border-base-800 px-4 py-3 flex justify-center max-w-lg mx-auto">
        <EnergySliders
          mentalEnergy={mentalEnergy}
          physicalEnergy={physicalEnergy}
          onMentalChange={setMentalEnergy}
          onPhysicalChange={setPhysicalEnergy}
        />
      </div>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between mb-3 px-1">
        <h2 className="text-sm uppercase tracking-wider text-base-400 font-medium">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}
