import { useState, useRef, useEffect } from "react";

export interface CurvePoint {
  days: number;
  priority: number;
}

interface PriorityCurveEditorProps {
  points: CurvePoint[];
  onChange: (points: CurvePoint[]) => void;
}

const MAX_DAYS = 30;
const MAX_PRIORITY = 4;
const MAX_POINTS = 8;
const MIN_POINTS = 2;

const WIDTH = 400;
const HEIGHT = 240;
const PAD_LEFT = 32;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const GRAPH_W = WIDTH - PAD_LEFT - PAD_RIGHT;
const GRAPH_H = HEIGHT - PAD_TOP - PAD_BOTTOM;

function xScale(days: number) {
  return PAD_LEFT + (days / MAX_DAYS) * GRAPH_W;
}
function yScale(priority: number) {
  return HEIGHT - PAD_BOTTOM - (priority / MAX_PRIORITY) * GRAPH_H;
}
function xInverse(px: number) {
  return ((px - PAD_LEFT) / GRAPH_W) * MAX_DAYS;
}
function yInverse(px: number) {
  return ((HEIGHT - PAD_BOTTOM - px) / GRAPH_H) * MAX_PRIORITY;
}

function snap(val: number, step: number, min: number, max: number) {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  return Math.max(min, Math.min(max, parseFloat((Math.round(val / step) * step).toFixed(decimals))));
}

export function interpolateCurve(daysSinceLast: number, points: CurvePoint[]): number {
  const sorted = [...points].sort((a, b) => a.days - b.days);
  if (sorted.length === 0) return 0;
  if (daysSinceLast <= sorted[0].days) return sorted[0].priority;
  if (daysSinceLast >= sorted[sorted.length - 1].days) return sorted[sorted.length - 1].priority;

  for (let i = 0; i < sorted.length - 1; i++) {
    const p0 = sorted[i];
    const p1 = sorted[i + 1];
    if (daysSinceLast >= p0.days && daysSinceLast <= p1.days) {
      const t = (daysSinceLast - p0.days) / (p1.days - p0.days);
      return p0.priority + t * (p1.priority - p0.priority);
    }
  }
  return sorted[sorted.length - 1].priority;
}

export default function PriorityCurveEditor({ points, onChange }: PriorityCurveEditorProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [justFinishedDrag, setJustFinishedDrag] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (selectedIdx !== null && selectedIdx >= points.length) {
      setSelectedIdx(null);
    }
  }, [points, selectedIdx]);

  const sorted = [...points].sort((a, b) => a.days - b.days);

  const curvePath = (() => {
    const pts: string[] = [];
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const d = (i / steps) * MAX_DAYS;
      const p = interpolateCurve(d, sorted);
      pts.push(`${xScale(d)},${yScale(p)}`);
    }
    return pts.join(" ");
  })();

  const getSvgCoords = (e: MouseEvent | TouchEvent) => {
    const svg = svgRef.current;
    if (!svg) return { svgX: 0, svgY: 0 };
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { svgX: 0, svgY: 0 };
    return {
      svgX: (clientX - ctm.e) / ctm.a,
      svgY: (clientY - ctm.f) / ctm.d,
    };
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent, index: number) => {
    e.stopPropagation();
    setSelectedIdx(index);
    setIsDragging(true);

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      moveEvent.preventDefault();
      const { svgX, svgY } = getSvgCoords(moveEvent);
      const newDays = snap(xInverse(svgX), 0.5, 0, MAX_DAYS);
      const newPriority = snap(yInverse(svgY), 0.1, 0, MAX_PRIORITY);

      const wouldDuplicate = points.some(
        (p, i) => i !== index && Math.abs(p.days - newDays) < 0.25
      );
      if (wouldDuplicate) return;

      const newPoints = [...points];
      newPoints[index] = { days: newDays, priority: newPriority };
      onChange(newPoints);
    };

    const handleEnd = () => {
      setIsDragging(false);
      setJustFinishedDrag(true);
      setTimeout(() => setJustFinishedDrag(false), 100);
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("touchend", handleEnd);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleMove, { passive: false });
    document.addEventListener("touchend", handleEnd);
  };

  const handleGraphClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging || justFinishedDrag || points.length >= MAX_POINTS) return;

    const svg = svgRef.current;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const svgX = (e.clientX - ctm.e) / ctm.a;
    const svgY = (e.clientY - ctm.f) / ctm.d;

    const newDays = snap(xInverse(svgX), 0.5, 0, MAX_DAYS);
    const newPriority = snap(yInverse(svgY), 0.1, 0, MAX_PRIORITY);

    if (points.some((p) => Math.abs(p.days - newDays) < 0.25)) return;

    onChange([...points, { days: newDays, priority: newPriority }]);
    setSelectedIdx(points.length);
  };

  const handleDelete = () => {
    if (selectedIdx === null || points.length <= MIN_POINTS) return;
    onChange(points.filter((_, i) => i !== selectedIdx));
    setSelectedIdx(null);
  };

  const X_LABELS = [0, 7, 14, 21, 28];
  const Y_LABELS = [0, 1, 2, 3, 4];

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full touch-none select-none"
        style={{ maxHeight: 240, overflow: "visible" }}
        onClick={handleGraphClick}
      >
        {/* Grid lines */}
        {X_LABELS.map((d) => (
          <line
            key={`gx-${d}`}
            x1={xScale(d)} y1={PAD_TOP}
            x2={xScale(d)} y2={HEIGHT - PAD_BOTTOM}
            stroke="var(--color-base-800)" strokeWidth="1"
          />
        ))}
        {Y_LABELS.map((p) => (
          <line
            key={`gy-${p}`}
            x1={PAD_LEFT} y1={yScale(p)}
            x2={WIDTH - PAD_RIGHT} y2={yScale(p)}
            stroke="var(--color-base-800)" strokeWidth="1"
          />
        ))}

        {/* Axis labels */}
        {X_LABELS.map((d) => (
          <text
            key={`lx-${d}`}
            x={xScale(d)} y={HEIGHT - PAD_BOTTOM + 16}
            fill="var(--color-base-500)" fontSize="10" textAnchor="middle"
          >
            {d}d
          </text>
        ))}
        {Y_LABELS.map((p) => (
          <text
            key={`ly-${p}`}
            x={PAD_LEFT - 6} y={yScale(p) + 3}
            fill="var(--color-base-500)" fontSize="10" textAnchor="end"
          >
            {p}x
          </text>
        ))}

        {/* Curve line */}
        <polyline
          points={curvePath}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Draggable points */}
        {sorted.map((pt) => {
          const origIdx = points.findIndex(
            (p) => p.days === pt.days && p.priority === pt.priority
          );
          const cx = xScale(pt.days);
          const cy = yScale(pt.priority);
          const isSelected = selectedIdx === origIdx;
          const isHovered = hoveredIdx === origIdx;

          return (
            <g
              key={origIdx}
              onMouseDown={(e) => handleDragStart(e, origIdx)}
              onTouchStart={(e) => handleDragStart(e, origIdx)}
              onMouseEnter={() => setHoveredIdx(origIdx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: "grab" }}
            >
              {/* Larger invisible hit area for touch */}
              <circle cx={cx} cy={cy} r="16" fill="transparent" />
              <circle
                cx={cx} cy={cy} r="7"
                fill={isSelected ? "var(--color-accent)" : "var(--color-base-700)"}
                stroke="var(--color-accent)"
                strokeWidth="2.5"
              />
              {(isHovered || isSelected) && (
                <text
                  x={cx} y={cy - 14}
                  fill="var(--color-base-200)" fontSize="10"
                  textAnchor="middle" fontWeight="500"
                >
                  {pt.days}d {"\u2192"} {pt.priority}x
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Controls below chart */}
      <div className="flex items-center gap-2 mt-1">
        {points.length < MAX_POINTS && (
          <span className="text-base-600 text-xs">Tap chart to add point</span>
        )}
        <div className="flex-1" />
        {selectedIdx !== null && points.length > MIN_POINTS && (
          <button
            type="button"
            onClick={handleDelete}
            className="text-xs text-red-400/70 px-2 py-1 rounded border border-red-400/20 hover:bg-red-400/10 transition-colors"
          >
            Delete point
          </button>
        )}
      </div>
    </div>
  );
}

