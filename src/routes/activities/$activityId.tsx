import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect, useRef } from "react";
import { CATEGORIES, CATEGORY_ICONS, MAX_ENERGY, MentalIcon, PhysicalIcon } from "../../lib/constants";
import PriorityCurveEditor, {
  type CurvePoint,
} from "../../components/PriorityCurveEditor";

export const Route = createFileRoute("/activities/$activityId")({
  component: ActivityEditor,
});

const DEFAULT_CURVE: CurvePoint[] = [{ days: 0, priority: 0 }, { days: 1, priority: 1 }];

function ActivityEditor() {
  const { activityId } = Route.useParams();
  const navigate = useNavigate();
  const isNew = activityId === "new";

  const activity = useQuery(
    api.activities.get,
    isNew ? "skip" : { id: activityId as Id<"activities"> }
  );
  const updateActivity = useMutation(api.activities.update);
  const createActivity = useMutation(api.activities.create);
  const archiveActivity = useMutation(api.activities.archive);
  const pauseActivity = useMutation(api.activities.pause);
  const unpauseActivity = useMutation(api.activities.unpause);
  const logEnergyCostChange = useMutation(api.energyCostChanges.log);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Skills");
  const [mentalCost, setMentalCost] = useState(0);
  const [physicalCost, setPhysicalCost] = useState(0);
  const [priorityCurve, setPriorityCurve] = useState<CurvePoint[]>(DEFAULT_CURVE);
  const [notes, setNotes] = useState("");
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [pauseWeeks, setPauseWeeks] = useState(1);

  useEffect(() => {
    if (activity) {
      setName(activity.name);
      setCategory(activity.category);
      setMentalCost(activity.mentalEnergyCost);
      setPhysicalCost(activity.physicalEnergyCost);
      if (activity.priorityCurve && (activity.priorityCurve as CurvePoint[]).length >= 2) {
        setPriorityCurve(activity.priorityCurve as CurvePoint[]);
      }
      setNotes(activity.notes);
    }
  }, [activity]);

  if (!isNew && activity === undefined) {
    return <div className="pt-8 text-base-400 text-center">Loading...</div>;
  }
  if (!isNew && activity === null) {
    return <div className="pt-8 text-base-400 text-center">Activity not found.</div>;
  }

  const isPaused = activity?.pausedUntil && activity.pausedUntil > Date.now();

  const handleSave = async () => {
    if (isNew) {
      await createActivity({
        name,
        category,
        mentalEnergyCost: mentalCost,
        physicalEnergyCost: physicalCost,
        targetFrequency: { type: "freeform" },
        priorityCurve,
        isTemporary: false,
        notes,
      });
    } else {
      if (
        activity &&
        (mentalCost !== activity.mentalEnergyCost ||
          physicalCost !== activity.physicalEnergyCost)
      ) {
        await logEnergyCostChange({
          activityId: activity._id,
          previousMentalCost: activity.mentalEnergyCost,
          newMentalCost: mentalCost,
          previousPhysicalCost: activity.physicalEnergyCost,
          newPhysicalCost: physicalCost,
        });
      }
      await updateActivity({
        id: activityId as Id<"activities">,
        name,
        category,
        mentalEnergyCost: mentalCost,
        physicalEnergyCost: physicalCost,
        priorityCurve,
        notes,
      });
    }
    navigate({ to: "/" });
  };

  const handlePause = async () => {
    await pauseActivity({
      id: activityId as Id<"activities">,
      weeks: pauseWeeks,
    });
    setShowPauseDialog(false);
    navigate({ to: "/" });
  };

  const handleUnpause = async () => {
    await unpauseActivity({ id: activityId as Id<"activities"> });
  };

  const handleArchive = async () => {
    if (!isNew) {
      await archiveActivity({ id: activityId as Id<"activities"> });
      navigate({ to: "/" });
    }
  };

  return (
    <div className="pt-4 pb-8">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate({ to: "/" })}
          className="text-base-400 text-sm"
        >
          Cancel
        </button>
        <h1 className="text-lg font-semibold text-base-100">
          {isNew ? "New activity" : "Edit activity"}
        </h1>
        <button
          onClick={handleSave}
          className="text-accent text-sm font-medium"
        >
          Save
        </button>
      </div>

      <div className="space-y-5">
        {/* Name + Category */}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs uppercase tracking-wider text-base-500 mb-1.5 block">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-base-900 text-base-100 rounded-lg px-3 py-2 border border-base-700 focus:border-accent focus:outline-none"
              placeholder="Activity name"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs uppercase tracking-wider text-base-500 mb-1.5 block">
              Category
            </label>
            <CategoryPicker value={category} onChange={setCategory} />
          </div>
        </div>

        {/* Energy costs */}
        <Field label="Energy cost" centered>
          <div className="flex items-center justify-center gap-6">
            <EnergyPicker
              icon={PhysicalIcon}
              value={physicalCost}
              onChange={setPhysicalCost}
              activeColor="bg-red-500/30"
              activeBorder="border-red-400/40"
            />
            <EnergyPicker
              icon={MentalIcon}
              value={mentalCost}
              onChange={setMentalCost}
              activeColor="bg-emerald-500/30"
              activeBorder="border-emerald-400/40"
            />
          </div>
        </Field>

        {/* Priority curve */}
        <Field label="Priority curve">
          <PriorityCurveEditor points={priorityCurve} onChange={setPriorityCurve} />
        </Field>

        {/* Notes */}
        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-base-900 text-base-100 rounded-lg px-3 py-2 border border-base-700 focus:border-accent focus:outline-none resize-none"
            rows={3}
            placeholder="Optional notes..."
          />
        </Field>

        {/* Pause / Unpause / Archive */}
        {!isNew && (
          <div className="space-y-2 mt-4">
            {isPaused ? (
              <button
                onClick={handleUnpause}
                className="w-full text-amber-300/80 text-sm py-2 border border-amber-400/20 rounded-lg hover:bg-amber-400/10 transition-colors"
              >
                Unpause (paused until {new Date(activity!.pausedUntil!).toLocaleDateString("en-US", { month: "short", day: "numeric" })})
              </button>
            ) : showPauseDialog ? (
              <div className="bg-base-900 border border-base-700 rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-base-200">
                    Pause for {pauseWeeks} {pauseWeeks === 1 ? "week" : "weeks"}
                  </span>
                  <button
                    onClick={() => setShowPauseDialog(false)}
                    className="text-base-500 text-xs"
                  >
                    Cancel
                  </button>
                </div>
                <input
                  type="range"
                  min={1}
                  max={52}
                  value={pauseWeeks}
                  onChange={(e) => setPauseWeeks(Number(e.target.value))}
                  className="w-full mb-3 accent-amber-400"
                />
                <button
                  onClick={handlePause}
                  className="w-full text-sm py-1.5 rounded-lg bg-amber-800/30 text-amber-300 border border-amber-700/40 hover:bg-amber-800/50 transition-colors"
                >
                  Pause for {pauseWeeks}w
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowPauseDialog(true)}
                className="w-full text-amber-300/80 text-sm py-2 border border-amber-400/20 rounded-lg hover:bg-amber-400/10 transition-colors"
              >
                Pause activity
              </button>
            )}

            <button
              onClick={handleArchive}
              className="w-full text-red-400/80 text-sm py-2 border border-red-400/20 rounded-lg hover:bg-red-400/10 transition-colors"
            >
              Archive activity
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, [open]);

  const SelectedIcon = CATEGORY_ICONS[value];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 bg-base-900 text-base-100 rounded-lg px-3 py-2 border border-base-700 focus:border-accent focus:outline-none text-left"
      >
        {SelectedIcon && <SelectedIcon size={16} className="text-base-400 shrink-0" />}
        <span className="flex-1">{value}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" className="text-base-500 shrink-0">
          <path fill="currentColor" d="M6 8L1 3h10z" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-base-900 border border-base-700 rounded-lg py-1 max-h-60 overflow-y-auto">
          {CATEGORIES.map((cat) => {
            const CatIcon = CATEGORY_ICONS[cat];
            return (
              <button
                key={cat}
                type="button"
                onClick={() => { onChange(cat); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                  cat === value ? "text-accent bg-accent/10" : "text-base-200 hover:bg-base-800"
                }`}
              >
                {CatIcon && <CatIcon size={16} className={cat === value ? "text-accent" : "text-base-400"} />}
                <span>{cat}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, children, centered }: { label: string; children: React.ReactNode; centered?: boolean }) {
  return (
    <div>
      <label className={`text-xs uppercase tracking-wider text-base-500 mb-1.5 block ${centered ? "text-center" : ""}`}>
        {label}
      </label>
      {children}
    </div>
  );
}

function EnergyPicker({
  icon: Icon,
  value,
  onChange,
  activeColor,
  activeBorder,
}: {
  icon: typeof MentalIcon;
  value: number;
  onChange: (v: number) => void;
  activeColor: string;
  activeBorder: string;
}) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: MAX_ENERGY }, (_, i) => i + 1).map((level) => {
        const isActive = level <= value;
        return (
          <button
            key={level}
            onClick={() => onChange(level === value ? level - 1 : level)}
            className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${
              isActive
                ? `${activeColor} ${activeBorder}`
                : "bg-base-850 border-base-700"
            }`}
          >
            <Icon
              size={16}
              className={isActive ? "text-base-200" : "text-base-600"}
            />
          </button>
        );
      })}
    </div>
  );
}
