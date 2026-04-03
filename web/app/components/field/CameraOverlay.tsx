"use client";

/**
 * CameraOverlay
 *
 * Visual overlay rendered on top of the camera feed during an active walk.
 * Shows:
 *   - Breadcrumb trail dots (recent trail points as fading dots)
 *   - Anchor badges (confirmed reference points)
 *   - Plant labels (recently tagged subjects)
 *   - Area indicators (recently marked patches)
 *   - Light badge (when light was recorded this session)
 *
 * All badges are non-interactive informational indicators.
 * They appear briefly after creation and fade to subtle persistence.
 *
 * Since we don't have screen-space projection from GPS coords
 * (no AR), badges are shown as a compact edge-anchored list
 * rather than trying to position them over the camera view.
 */

import React from "react";
import type { TrailPoint } from "@/hooks/useWalkTrail";

// ── Badge data types ─────────────────────────────────────────────────────────

export interface AnchorBadge {
  id: string;
  label: string;
  type: string;
  recent?: boolean; // highlight if just placed
}

export interface SubjectBadge {
  id: string;
  label: string;
  type: string;
  species?: string | null;
  recent?: boolean;
}

export interface AreaBadge {
  id: string;
  label: string;
  type: string;
  recent?: boolean;
}

interface CameraOverlayProps {
  trail: TrailPoint[];
  anchors: AnchorBadge[];
  subjects: SubjectBadge[];
  areas: AreaBadge[];
  lightRecorded: boolean;
  walkActive: boolean;
}

export default function CameraOverlay({
  trail,
  anchors,
  subjects,
  areas,
  lightRecorded,
  walkActive,
}: CameraOverlayProps) {
  if (!walkActive) return null;

  const hasAnything = anchors.length > 0 || subjects.length > 0 || areas.length > 0;

  return (
    <>
      {/* ── Breadcrumb trail indicator (bottom-left) ──────────────────── */}
      {trail.length > 0 && (
        <div className="absolute bottom-24 left-3 flex items-center gap-1 pointer-events-none">
          {/* Recent trail dots */}
          {trail.slice(-8).map((_, i, arr) => (
            <span
              key={i}
              className="rounded-full bg-green-400"
              style={{
                width: 4,
                height: 4,
                opacity: 0.2 + (i / arr.length) * 0.5,
              }}
            />
          ))}
          <span className="text-green-500/60 text-[9px] ml-1 tabular-nums">
            {trail.length}
          </span>
        </div>
      )}

      {/* ── Session badges (top-right, stacked) ──────────────────────── */}
      {hasAnything && (
        <div className="absolute top-14 right-3 flex flex-col gap-1.5 items-end pointer-events-none max-w-[140px]">
          {/* Anchors */}
          {anchors.map((a) => (
            <Badge
              key={a.id}
              icon="📍"
              label={a.label}
              color="amber"
              recent={a.recent}
            />
          ))}
          {/* Subjects */}
          {subjects.slice(-4).map((s) => (
            <Badge
              key={s.id}
              icon="🌳"
              label={s.species || s.label}
              color="green"
              recent={s.recent}
            />
          ))}
          {/* Areas */}
          {areas.slice(-3).map((a) => (
            <Badge
              key={a.id}
              icon="🌿"
              label={a.label}
              color="lime"
              recent={a.recent}
            />
          ))}
          {/* Light */}
          {lightRecorded && (
            <Badge icon="☀️" label="Light recorded" color="yellow" />
          )}
        </div>
      )}

      {/* ── Walk pulse indicator (top-left) ──────────────────────────── */}
      <div className="absolute top-14 left-3 flex items-center gap-1.5 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-green-400/70 text-[10px] font-medium">Recording</span>
      </div>
    </>
  );
}

// ── Badge pill ───────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  amber:  { bg: "bg-amber-900/60",  border: "border-amber-600/40",  text: "text-amber-300" },
  green:  { bg: "bg-green-900/60",  border: "border-green-600/40",  text: "text-green-300" },
  lime:   { bg: "bg-lime-900/60",   border: "border-lime-600/40",   text: "text-lime-300" },
  yellow: { bg: "bg-yellow-900/60", border: "border-yellow-600/40", text: "text-yellow-300" },
};

function Badge({
  icon,
  label,
  color,
  recent,
}: {
  icon: string;
  label: string;
  color: string;
  recent?: boolean;
}) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.green;
  return (
    <div
      className={[
        "flex items-center gap-1 px-2 py-1 rounded-full border backdrop-blur-sm text-[10px] font-medium truncate max-w-full",
        c.bg, c.border, c.text,
        recent ? "opacity-100 ring-1 ring-white/20" : "opacity-70",
      ].join(" ")}
    >
      <span className="text-xs leading-none flex-none">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}
