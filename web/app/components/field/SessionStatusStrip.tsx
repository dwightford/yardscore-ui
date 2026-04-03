"use client";

/**
 * SessionStatusStrip
 *
 * A thin, soft persistent strip that communicates property-memory
 * formation in plain homeowner language. It should feel like a
 * quiet companion whispering context — not a status dashboard.
 *
 * Design rule: visually subordinate to the live scene.
 */

import React from "react";

export type StripState =
  | "no_walk"
  | "walk_active"
  | "anchor_confirmed"
  | "anchor_suggested"
  | "light_suggested"
  | "area_marked"
  | "subject_tagged"
  | "walk_done"
  | "memory_forming"
  | "queued"
  | "synced";

interface SessionStatusStripProps {
  state: StripState;
  detail?: string;
  propertyLabel?: string;
}

const MESSAGES: Record<StripState, { text: string; accent: string }> = {
  no_walk: {
    text: "Ready to observe your yard.",
    accent: "text-stone-500",
  },
  walk_active: {
    text: "Observing — mark what you notice.",
    accent: "text-green-400/70",
  },
  anchor_confirmed: {
    text: "Reference point saved.",
    accent: "text-amber-400/70",
  },
  anchor_suggested: {
    text: "A reference point nearby would help.",
    accent: "text-amber-300/60",
  },
  light_suggested: {
    text: "Good light — worth recording.",
    accent: "text-yellow-400/60",
  },
  area_marked: {
    text: "Area noted.",
    accent: "text-lime-400/70",
  },
  subject_tagged: {
    text: "Noted — keep going.",
    accent: "text-green-300/70",
  },
  walk_done: {
    text: "Walk finished. Memory updated.",
    accent: "text-sky-400/70",
  },
  memory_forming: {
    text: "Property memory is forming.",
    accent: "text-blue-400/60",
  },
  queued: {
    text: "Saved locally — will sync soon.",
    accent: "text-orange-400/60",
  },
  synced: {
    text: "All synced.",
    accent: "text-green-400/70",
  },
};

export default function SessionStatusStrip({ state, detail, propertyLabel }: SessionStatusStripProps) {
  const { text, accent } = MESSAGES[state];
  return (
    <div className="w-full flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-sm">
      <div className="flex-1 min-w-0">
        {propertyLabel && (
          <p className="text-stone-600 text-[9px] leading-none mb-0.5 truncate">{propertyLabel}</p>
        )}
        <p className={`text-[11px] leading-snug ${accent}`}>
          {detail ?? text}
        </p>
      </div>
    </div>
  );
}
