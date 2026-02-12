import { useState, useRef, useEffect } from "react";

export interface HourlyPoint {
  hour: number;
  multiplier: number;
}

interface HourlyPriorityEditorProps {
  points: HourlyPoint[];
  onChange: (points: HourlyPoint[]) => void;
}

const MAX_HOUR = 23;
const MAX_MULTIPLIER = 2;
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

function xScale(hour: number) {
  return PAD_LEFT + (hour / MAX_HOUR) * GRAPH_W;
}
function yScale(multiplier: number) {
  return HEIGHT - PAD_BOTTOM - (multiplier / MAX_MULTIPLIER) * GRAPH_H;
}
function xInverse(px: number) {
  return ((px - PAD_LEFT) / GRAPH_W) * MAX_HOUR;
}
function yInverse(px: number) {
  return ((HEIGHT - PAD_BOTTOM - px) / GRAPH_H) * MAX_MULTIPLIER;
}

function snap(val: number, step: number, min: number, max: number) {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  return Math.max(min, Math.min(max, parseFloat((Math.round(val / step) * step).toFixed(decimals))));
}

export function interpolateHourlyCurve(hour: number, points: HourlyPoint[]): number {
  const sorted = [...points].sort((a, b) => a.hour - b.hour);
  if (sorted.length === 0) return 1;
  if (hour <= sorted[0].hour) return sorted[0].multiplier;
  if (hour >= sorted[sorted.length - 1].hour) return sorted[sorted.length - 1].multiplier;

  for (let i = 0; i < sorted.length - 1; i++) {
    const p0 = sorted[i];
    const p1 = sorted[i + 1];
    if (hour >= p0.hour && hour <= p1.hour) {
      const t = (hour - p0.hour) / (p1.hour - p0.hour);
      return p0.multiplier + t * (p1.multiplier - p0.multiplier);
    }
  }
  return sorted[sorted.length - 1].multiplier;
}

export const DEFAULT_HOURLY_CURVE: HourlyPoint[] = [
  { hour: 0, multiplier: 1 },
  { hour: 23, multiplier: 1 },
];

export default function HourlyPriorityEditor({ points, onChange }: HourlyPriorityEditorProps) {
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

  const sorted = [...points].sort((a, b) => a.hour - b.hour);

  const curvePath = (() => {
    const pts: string[] = [];
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const h = (i / steps) * MAX_HOUR;
      const m = interpolateHourlyCurve(h, sorted);
      pts.push(`${xScale(h)},${yScale(m)}`);
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
      const newHour = snap(xInverse(svgX), 1, 0, MAX_HOUR);
      const newMultiplier = snap(yInverse(svgY), 0.1, 0, MAX_MULTIPLIER);

      const wouldDuplicate = points.some(
        (p, i) => i !== index && p.hour === newHour
      );
      if (wouldDuplicate) return;

      const newPoints = [...points];
      newPoints[index] = { hour: newHour, multiplier: newMultiplier };
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

    const newHour = snap(xInverse(svgX), 1, 0, MAX_HOUR);
    const newMultiplier = snap(yInverse(svgY), 0.1, 0, MAX_MULTIPLIER);

    if (points.some((p) => p.hour === newHour)) return;

    onChange([...points, { hour: newHour, multiplier: newMultiplier }]);
    setSelectedIdx(points.length);
  };

  const handleDelete = () => {
    if (selectedIdx === null || points.length <= MIN_POINTS) return;
    onChange(points.filter((_, i) => i !== selectedIdx));
    setSelectedIdx(null);
  };

  const X_LABELS = [0, 6, 12, 18, 23];
  const Y_LABELS = [0, 0.5, 1, 1.5, 2];

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
        {X_LABELS.map((h) => (
          <line
            key={`gx-${h}`}
            x1={xScale(h)} y1={PAD_TOP}
            x2={xScale(h)} y2={HEIGHT - PAD_BOTTOM}
            stroke="var(--color-base-800)" strokeWidth="1"
          />
        ))}
        {Y_LABELS.map((m) => (
          <line
            key={`gy-${m}`}
            x1={PAD_LEFT} y1={yScale(m)}
            x2={WIDTH - PAD_RIGHT} y2={yScale(m)}
            stroke="var(--color-base-800)" strokeWidth="1"
          />
        ))}

        {/* 1x reference line */}
        <line
          x1={PAD_LEFT} y1={yScale(1)}
          x2={WIDTH - PAD_RIGHT} y2={yScale(1)}
          stroke="var(--color-base-600)" strokeWidth="1" strokeDasharray="4 3"
        />

        {/* Axis labels */}
        {X_LABELS.map((h) => (
          <text
            key={`lx-${h}`}
            x={xScale(h)} y={HEIGHT - PAD_BOTTOM + 16}
            fill="var(--color-base-500)" fontSize="10" textAnchor="middle"
          >
            {h}:00
          </text>
        ))}
        {Y_LABELS.map((m) => (
          <text
            key={`ly-${m}`}
            x={PAD_LEFT - 6} y={yScale(m) + 3}
            fill="var(--color-base-500)" fontSize="10" textAnchor="end"
          >
            {m}x
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
            (p) => p.hour === pt.hour && p.multiplier === pt.multiplier
          );
          const cx = xScale(pt.hour);
          const cy = yScale(pt.multiplier);
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
                  {pt.hour}:00 {"\u2192"} {pt.multiplier}x
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
