"use client";

import { RefObject } from "react";
import { FocusMode } from "../types/dashboard";

type FocusControlsProps = {
  focus: FocusMode;
  weight: number;
  tiltCopy: string;
  highlightRef: RefObject<HTMLSpanElement>;
  onFocusChange: (mode: FocusMode) => void;
  onWeightChange: (value: number) => void;
};

const MODES: FocusMode[] = ["price", "sentiment"];

export function FocusControls({
  focus,
  weight,
  tiltCopy,
  highlightRef,
  onFocusChange,
  onWeightChange,
}: FocusControlsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Preference Control</h2>
        <span className="text-sm text-slate-300">{tiltCopy}</span>
      </div>
      <div className="relative grid grid-cols-2 rounded-2xl border border-white/10 bg-black/30 p-1 text-sm font-medium text-slate-300">
        <span
          ref={highlightRef}
          className="absolute inset-y-1 left-1 z-0 w-1/2 rounded-xl bg-gradient-to-r from-emerald-400/80 to-cyan-400/80 mix-blend-screen"
        />
        {MODES.map((mode) => (
          <button
            key={mode}
            className={`z-10 rounded-xl px-4 py-2 transition-colors ${
              focus === mode ? "text-black" : "text-slate-300"
            }`}
            onClick={() => onFocusChange(mode)}
            type="button"
          >
            {mode === "price" ? "Price precision" : "Semantic context"}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        <label className="flex items-center justify-between text-sm text-slate-300">
          <span>Weight toward price action</span>
          <span className="font-semibold text-white">{weight}%</span>
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={weight}
          onChange={(event) => onWeightChange(Number(event.target.value))}
          className="h-1 w-full appearance-none rounded-full bg-slate-700 accent-emerald-400"
        />
      </div>
    </div>
  );
}
