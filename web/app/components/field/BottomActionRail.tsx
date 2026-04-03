"use client";

/**
 * BottomActionRail
 *
 * Primary action bar at the bottom of the Field Mapper HUD.
 * Three primary actions — big, thumb-friendly, grandma-safe.
 * Secondary actions (anchor, area) accessible via "More" or
 * triggered contextually by the guided flow.
 *
 * Layout: easy thumb reach, stable, no clutter.
 */

import React from "react";

export type ActionMode =
  | "walk"       // Start Walk / Continue Walk
  | "identify"   // Identify a plant
  | "anchor"     // Add Anchor (reference point)
  | "area"       // Mark Area (patch)
  | "light"      // Record Light
  | "more";      // Secondary overflow

interface Action {
  mode: ActionMode;
  icon: string;
  label: string;
  primary?: boolean;
}

const PRIMARY_ACTIONS: Action[] = [
  { mode: "walk",     icon: "👣", label: "Walk",     primary: true },
  { mode: "identify", icon: "🔍", label: "Identify", primary: true },
  { mode: "anchor",   icon: "📍", label: "Anchor",   primary: true },
  { mode: "light",    icon: "☀️", label: "Light",    primary: true },
];

const SECONDARY_ACTIONS: Action[] = [
  { mode: "area",     icon: "🌿", label: "Mark Area" },
];

interface BottomActionRailProps {
  activeMode: ActionMode;
  walkActive: boolean;
  onSelect: (mode: ActionMode) => void;
  onFinishWalk?: () => void;
}

export default function BottomActionRail({
  activeMode,
  walkActive,
  onSelect,
  onFinishWalk,
}: BottomActionRailProps) {
  const [showMore, setShowMore] = React.useState(false);

  return (
    <div
      className="w-full bg-black/75 backdrop-blur-md border-t border-white/10"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      {/* Secondary actions (expanded) */}
      {showMore && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 border-b border-white/5">
          {SECONDARY_ACTIONS.map(({ mode, icon, label }) => (
            <button
              key={mode}
              onClick={() => { onSelect(mode); setShowMore(false); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/8 text-white/70 hover:text-white text-xs font-medium transition active:scale-95"
            >
              <span className="text-sm">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Finish Walk bar — visible when walking */}
      {walkActive && onFinishWalk && (
        <div className="flex items-center justify-center px-4 py-2 border-b border-white/5">
          <button
            onClick={onFinishWalk}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-200 text-sm font-semibold transition active:scale-95"
          >
            <span className="w-2 h-2 rounded-full bg-red-400" />
            Finish Walk
          </button>
        </div>
      )}

      {/* Primary actions */}
      <div className="flex items-end justify-around px-2 pt-2">
        {PRIMARY_ACTIONS.map(({ mode, icon, label }) => {
          const isActive = mode === activeMode;
          const isWalkBtn = mode === "walk";
          const displayLabel = isWalkBtn
            ? walkActive ? "Walking" : "Start Walk"
            : label;

          return (
            <button
              key={mode}
              onClick={() => onSelect(mode)}
              className={[
                "flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all",
                "min-w-[56px] focus:outline-none active:scale-95",
                isActive
                  ? "bg-white/15 text-white"
                  : "text-white/50 hover:text-white/80",
                isWalkBtn && walkActive && !isActive
                  ? "text-green-400/70"
                  : "",
              ].join(" ")}
            >
              <span className="text-2xl leading-none">{icon}</span>
              <span className="text-[10px] leading-none font-medium tracking-wide">
                {displayLabel}
              </span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-white/70 mt-0.5" />
              )}
              {isWalkBtn && walkActive && !isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse mt-0.5" />
              )}
            </button>
          );
        })}

        {/* More toggle */}
        <button
          onClick={() => setShowMore(!showMore)}
          className={[
            "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all",
            "min-w-[44px] focus:outline-none active:scale-95",
            showMore ? "text-white/80" : "text-white/30 hover:text-white/50",
          ].join(" ")}
        >
          <span className="text-lg leading-none">⋯</span>
          <span className="text-[10px] leading-none font-medium">More</span>
        </button>
      </div>
    </div>
  );
}
