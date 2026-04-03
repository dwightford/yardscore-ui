"use client";

/**
 * BottomActionRail
 *
 * Primary action bar at the bottom of the Field Mapper HUD.
 * Six actions visible to the user in plain language.
 * Active action is highlighted.
 *
 * Layout: easy thumb reach, stable, no clutter.
 * The "More" slot is a placeholder for future secondary actions.
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
}

const ACTIONS: Action[] = [
  { mode: "walk",     icon: "👣", label: "Walk"     },
  { mode: "identify", icon: "🔍", label: "Identify"  },
  { mode: "anchor",   icon: "📍", label: "Anchor"    },
  { mode: "area",     icon: "🌿", label: "Mark Area" },
  { mode: "light",    icon: "☀️", label: "Light"     },
  { mode: "more",     icon: "⋯",  label: "More"      },
];

interface BottomActionRailProps {
  activeMode: ActionMode;
  walkActive: boolean;
  onSelect: (mode: ActionMode) => void;
}

export default function BottomActionRail({
  activeMode,
  walkActive,
  onSelect,
}: BottomActionRailProps) {
  return (
    <div
      className="w-full flex items-end justify-around px-2 pb-safe pt-2 bg-black/75 backdrop-blur-md border-t border-white/10"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      {ACTIONS.map(({ mode, icon, label }) => {
        const isActive = mode === activeMode;
        const isWalkBtn = mode === "walk";

        // Walk button shows different label based on walk state
        const displayLabel = isWalkBtn
          ? walkActive ? "Walking" : "Start Walk"
          : label;

        return (
          <button
            key={mode}
            onClick={() => onSelect(mode)}
            className={[
              "flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all",
              "min-w-[52px] focus:outline-none active:scale-95",
              isActive
                ? "bg-white/15 text-white"
                : "text-white/50 hover:text-white/80",
              isWalkBtn && walkActive && !isActive
                ? "text-green-400/70"
                : "",
            ].join(" ")}
          >
            <span className="text-xl leading-none">{icon}</span>
            <span className="text-[10px] leading-none font-medium tracking-wide">
              {displayLabel}
            </span>
            {/* active indicator dot */}
            {isActive && (
              <span className="w-1 h-1 rounded-full bg-white/70 mt-0.5" />
            )}
            {/* walk-active pulse dot when not in walk mode */}
            {isWalkBtn && walkActive && !isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse mt-0.5" />
            )}
          </button>
        );
      })}
    </div>
  );
}
