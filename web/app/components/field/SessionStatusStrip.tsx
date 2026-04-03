"use client";

/**
 * SessionStatusStrip
 *
 * A thin persistent strip above the action rail that communicates
 * property-memory formation state in plain homeowner language.
 *
 * States drive themselves from the walk/memory context —
 * no internal jargon exposed to the user.
 */

import React from "react";

export type StripState =
  | "no_walk"            // nothing started yet
  | "walk_active"        // walk in progress
  | "anchor_confirmed"   // just placed an anchor
  | "anchor_suggested"   // nudge: one more anchor would help
  | "light_suggested"    // good time to record light
  | "area_marked"        // just marked an area
  | "subject_tagged"     // just tagged a plant/tree
  | "walk_done"          // walk completed
  | "memory_forming";    // 1-2 walks done, building up

interface SessionStatusStripProps {
  state: StripState;
  /** Optional supplemental detail text (overrides default message) */
  detail?: string;
  /** Property label shown as a small prefix (e.g. "108 Buena Vista Way") */
  propertyLabel?: string;
}

const MESSAGES: Record<StripState, { icon: string; text: string; accent: string }> = {
  no_walk: {
    icon: "🏠",
    text: "Start at your front door to begin building your property map.",
    accent: "text-stone-400",
  },
  walk_active: {
    icon: "👣",
    text: "Walk in progress — tap to mark what you find.",
    accent: "text-green-400",
  },
  anchor_confirmed: {
    icon: "📍",
    text: "Anchor saved. This helps your map stay accurate over time.",
    accent: "text-amber-400",
  },
  anchor_suggested: {
    icon: "💡",
    text: "One more reference point would improve your map placement.",
    accent: "text-amber-300",
  },
  light_suggested: {
    icon: "☀️",
    text: "Good time to record afternoon light for this area.",
    accent: "text-yellow-400",
  },
  area_marked: {
    icon: "🌿",
    text: "Area marked. You can refine it on your next walk.",
    accent: "text-lime-400",
  },
  subject_tagged: {
    icon: "🌳",
    text: "Noted. Keep walking — you can identify it later.",
    accent: "text-green-300",
  },
  walk_done: {
    icon: "✓",
    text: "Walk finished. Your property memory has been updated.",
    accent: "text-sky-400",
  },
  memory_forming: {
    icon: "🗺",
    text: "Property memory is forming. A few more walks will fill it in.",
    accent: "text-blue-400",
  },
};

export default function SessionStatusStrip({ state, detail, propertyLabel }: SessionStatusStripProps) {
  const { icon, text, accent } = MESSAGES[state];
  return (
    <div className="w-full flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-sm border-b border-white/5">
      <span className="text-base leading-none flex-none">{icon}</span>
      <div className="flex-1 min-w-0">
        {propertyLabel && (
          <p className="text-stone-600 text-[10px] leading-none mb-0.5 truncate">{propertyLabel}</p>
        )}
        <p className={`text-xs leading-snug ${accent}`}>
          {detail ?? text}
        </p>
      </div>
    </div>
  );
}
