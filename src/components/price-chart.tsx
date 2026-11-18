"use client";

import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { daysBetween, formatDisplayDate } from "@/lib/dates";
import { formatRand } from "@/lib/format";

export interface ChartPoint {
  on: string;
  priceZar: number;
}

const W = 640;
const H = 220;
const PAD = { top: 16, right: 92, bottom: 30, left: 64 };

/** The price on a given day: the last change on or before it. */
function priceOn(points: readonly ChartPoint[], day: number, start: string): ChartPoint {
  let current = points[0];
  for (const p of points) if (daysBetween(start, p.on) <= day) current = p;
  return current;
}

/**
 * One store's price over time as a step line: a price holds until the day it changes.
 * Hovering or arrowing through the chart reads out the price on that day; the same
 * figures are in the table below it.
 */
export function PriceChart({ points, end, label }: { points: readonly ChartPoint[]; end: string; label: string }) {
  const start = points[0].on;
  const days = Math.max(1, daysBetween(start, end));
  const prices = points.map((p) => p.priceZar);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const span = hi - lo || hi * 0.1 || 1;
  const yMin = Math.max(0, lo - span * 0.25);
  const yMax = hi + span * 0.25;

  const x = (day: number) => PAD.left + (day / days) * (W - PAD.left - PAD.right);
  const y = (price: number) => PAD.top + (1 - (price - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);

  const path =
    points
      .map((p, i) => {
        const px = x(daysBetween(start, p.on));
        const py = y(p.priceZar);
        return i === 0 ? `M${px},${py}` : `H${px}V${py}`;
      })
      .join("") + `H${x(days)}`;

  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tipId = useId();
  const current = points[points.length - 1];
  const shown = hover === null ? null : priceOn(points, hover, start);

  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return;
    const sx = ((e.clientX - box.left) / box.width) * W;
    const day = Math.round(((sx - PAD.left) / (W - PAD.left - PAD.right)) * days);
    setHover(Math.min(days, Math.max(0, day)));
  }

  /** Arrow keys step between the days the price changed, and the last day. */
  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    const stops = [...points.map((p) => daysBetween(start, p.on)), days];
    const at = hover ?? days;
    if (e.key === "ArrowLeft") {
      setHover([...stops].reverse().find((s) => s < at) ?? stops[0]);
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      setHover(stops.find((s) => s > at) ?? days);
      e.preventDefault();
    } else if (e.key === "Escape") {
      setHover(null);
    }
  }

  const hoverDate = hover === null ? null : new Date(Date.parse(`${start}T00:00:00Z`) + hover * 86_400_000).toISOString().slice(0, 10);

  return (
    <figure className="min-w-0">
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-none select-none"
          role="img"
          aria-label={`${label}, from ${formatDisplayDate(start)} to ${formatDisplayDate(end)}. Use the arrow keys to read the price on each change.`}
          aria-describedby={hover !== null ? tipId : undefined}
          tabIndex={0}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKeyDown}
          onBlur={() => setHover(null)}
        >
          {/* Recessive frame: a baseline and two price gridlines. */}
          {[lo, hi].map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="stroke-line" strokeDasharray="2 4" />
              <text x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-ink-muted text-[12px]">
                {formatRand(v)}
              </text>
            </g>
          ))}
          <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} className="stroke-line" />
          <text x={PAD.left} y={H - 8} className="fill-ink-muted text-[12px]">
            {formatDisplayDate(start)}
          </text>
          <text x={W - PAD.right} y={H - 8} textAnchor="end" className="fill-ink-muted text-[12px]">
            {formatDisplayDate(end)}
          </text>

          <path d={path} fill="none" className="stroke-chart-line" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p) => (
            <circle
              key={p.on}
              cx={x(daysBetween(start, p.on))}
              cy={y(p.priceZar)}
              r={4}
              className="fill-chart-line stroke-surface"
              strokeWidth={2}
            />
          ))}
          {/* Direct label for the price now. */}
          <text x={x(days) + 8} y={y(current.priceZar)} dy="0.32em" className="fill-ink text-[13px] font-semibold">
            {formatRand(current.priceZar)}
          </text>

          {hover !== null && shown && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} className="stroke-ink-muted" strokeWidth={1} />
              <circle cx={x(hover)} cy={y(shown.priceZar)} r={5} className="fill-surface stroke-chart-line" strokeWidth={2} />
            </g>
          )}
        </svg>
        {hover !== null && shown && hoverDate && (
          <div
            id={tipId}
            role="status"
            className="pointer-events-none absolute top-0 rounded border border-line bg-surface px-2.5 py-1.5 text-sm shadow-sm"
            style={{ left: `${(x(hover) / W) * 100}%`, transform: hover > days / 2 ? "translateX(calc(-100% - 8px))" : "translateX(8px)" }}
          >
            <span className="price block text-lg">{formatRand(shown.priceZar)}</span>
            <span className="text-ink-muted">{formatDisplayDate(hoverDate)}</span>
          </div>
        )}
      </div>
      <details className="mt-2 text-sm">
        <summary className="text-ink-muted">Price changes as a table</summary>
        <table className="mt-2 w-full max-w-sm text-left">
          <thead>
            <tr className="border-b border-line text-ink-muted">
              <th scope="col" className="py-1 font-medium">
                From
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Price
              </th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.on} className="border-b border-line/60">
                <td className="py-1">{formatDisplayDate(p.on)}</td>
                <td className="py-1 text-right tabular-nums">{formatRand(p.priceZar)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
