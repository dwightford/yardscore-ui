"use client";

/**
 * BottomActionRail
 *
 * Primary action surface during field observation.
 * Canon actions: Identify This / Anchor / Note / Light
 * Finish Walk always visible when observing.
 *
 * Design rule: calm, thumb-friendly, garden stays primary.
 * The rail is soft persistent chrome — not a toolbar.
 */

import React from "react";

export type ActionMode =
  | "walk"       // Walk controls (start/resume)
  | "identify"   // Identify a plant
  | "anchor"     // Drop an anchor
  | "area"       // Mark an area
  | "light"      // Record light
  | "note"       // Say what you notice (sensory/narrative)
  | "more";      // Secondary overflow

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
  return (
    <div
      className="w-full bg-black/60 backdrop-blur-xl border-t border-white/[0.06]"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      {/* Finish bar — always visible when observing */}
      {walkActive && onFinishWalk && (
        <div className="flex items-center justify-center px-4 py-1.5">
          <button
            onClick={onFinishWalk}
            className="flex items-center gap-2 px-5 py-2 rounded-full bg-white/[0.06] hover:bg-white/10 text-stone-400 hover:text-stone-200 text-xs font-medium transition active:scale-95"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-400/80" />
            Finish
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-around px-1 pt-1">
        <RailButton
          icon="🔍"
          label="Identify"
          active={activeMode === "identify"}
          onClick={() => onSelect("identify")}
        />
        <RailButton
          icon="📍"
          label="Anchor"
          active={activeMode === "anchor"}
          onClick={() => onSelect("anchor")}
        />
        <RailButton
          icon="💬"
          label="Note"
          active={activeMode === "note"}
          onClick={() => onSelect("note")}
        />
        <RailButton
          icon="☀️"
          label="Light"
          active={activeMode === "light"}
          onClick={() => onSelect("light")}
        />
        <RailButton
          icon="🌿"
          label="Area"
          active={activeMode === "area"}
          onClick={() => onSelect("area")}
          subtle
        />
      </div>
    </div>
  );
}

function RailButton({
  icon,
  label,
  active,
  onClick,
  subtle,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
  subtle?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all",
        "min-w-[48px] focus:outline-none active:scale-95",
        active
          ? "text-white"
          : subtle
            ? "text-white/25 hover:text-white/50"
            : "text-white/40 hover:text-white/70",
      ].join(" ")}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span className="text-[9px] leading-none font-medium tracking-wide">{label}</span>
    </button>
  );
}
