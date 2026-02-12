import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { CATEGORY_ICONS } from "../lib/constants";
import { useState } from "react";

export const Route = createFileRoute("/history")({
  component: HistoryScreen,
});

function HistoryScreen() {
  const [showArchived, setShowArchived] = useState(false);

  return showArchived ? (
    <ArchivedList onBack={() => setShowArchived(false)} />
  ) : (
    <SessionHistory onShowArchived={() => setShowArchived(true)} />
  );
}

function SessionHistory({ onShowArchived }: { onShowArchived: () => void }) {
  const sessions = useQuery(api.sessions.listAll);
  const activities = useQuery(api.activities.list);
  const removeSession = useMutation(api.sessions.remove);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (sessions === undefined || activities === undefined) {
    return <div className="pt-8 text-base-400 text-center">Loading...</div>;
  }

  const activityMap = new Map(activities.map((a) => [a._id, a]));

  const grouped = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const date = new Date(session.startedAt).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date)!.push(session);
  }

  const handleDelete = async (id: string) => {
    await removeSession({ id: id as any });
    setConfirmDeleteId(null);
  };

  return (
    <div className="pt-4 pb-8">
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-xl font-semibold text-base-100">History</h1>
        <button
          onClick={onShowArchived}
          className="text-base-500 text-xs tracking-wider hover:text-base-300 transition-colors"
        >
          Archived
        </button>
      </div>

      {sessions.length === 0 && (
        <p className="text-base-500 text-sm">No sessions logged yet.</p>
      )}

      {[...grouped.entries()].map(([date, daySessions]) => (
        <div key={date} className="mb-5">
          <h2 className="text-xs uppercase tracking-wider text-base-500 mb-2">
            {date}
          </h2>
          <div className="space-y-1.5">
            {daySessions.map((session) => {
              const activity = activityMap.get(session.activityId);
              const Icon = activity ? CATEGORY_ICONS[activity.category] : null;
              const time = new Date(session.startedAt).toLocaleTimeString(
                "en-US",
                { hour: "numeric", minute: "2-digit" }
              );

              return (
                <div
                  key={session._id}
                  className="flex items-center gap-2 bg-base-900 rounded-lg px-3 py-2"
                >
                  {Icon && <Icon size={14} className="text-base-500 shrink-0" />}
                  <span className="text-base-100 text-sm flex-1 min-w-0 truncate">
                    {activity?.name ?? "Deleted activity"}
                  </span>
                  {session.note && (
                    <span className="text-base-500 text-xs truncate max-w-[120px]">
                      {session.note}
                    </span>
                  )}
                  <span className="text-base-600 text-xs shrink-0">{time}</span>
                  {confirmDeleteId === session._id ? (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleDelete(session._id)}
                        className="text-xs text-red-400 px-1.5 py-0.5 rounded border border-red-400/30 hover:bg-red-400/10"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs text-base-400 px-1.5 py-0.5"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(session._id)}
                      className="text-base-700 hover:text-red-400 text-xs shrink-0 transition-colors"
                    >
                      {"\u00D7"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ArchivedList({ onBack }: { onBack: () => void }) {
  const archived = useQuery(api.activities.listArchived);
  const unarchive = useMutation(api.activities.unarchive);

  if (archived === undefined) {
    return <div className="pt-8 text-base-400 text-center">Loading...</div>;
  }

  const handleRestore = async (id: string) => {
    await unarchive({ id: id as any });
  };

  return (
    <div className="pt-4 pb-8">
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-xl font-semibold text-base-100">Archived</h1>
        <button
          onClick={onBack}
          className="text-base-500 text-xs tracking-wider hover:text-base-300 transition-colors"
        >
          Back
        </button>
      </div>

      {archived.length === 0 && (
        <p className="text-base-500 text-sm">No archived activities.</p>
      )}

      <div className="space-y-1.5">
        {archived.map((activity) => {
          const CatIcon = CATEGORY_ICONS[activity.category];
          return (
          <div
            key={activity._id}
            className="flex items-center gap-2 bg-base-900 rounded-lg px-3 py-2.5"
          >
            {CatIcon && <CatIcon size={14} className="text-base-500 shrink-0" />}
            <span className="text-base-300 text-sm flex-1 min-w-0 truncate">
              {activity.name}
            </span>
            <button
              onClick={() => handleRestore(activity._id)}
              className="text-xs text-accent/70 px-2 py-1 rounded border border-accent/20 hover:bg-accent/10 transition-colors shrink-0"
            >
              Restore
            </button>
          </div>
          );
        })}
      </div>
    </div>
  );
}
