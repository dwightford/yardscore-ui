"use client";

/**
 * CameraOverlay
 *
 * Soft visual overlay on the live camera scene during observation.
 *
 * Design rule: the garden is primary. The overlay is subordinate.
 * Show only what the user needs to feel the system is working:
 *   - a gentle pulse (observing)
 *   - a brief flash when something is noted
 *   - a soft count chip if items exist
 *   - a queued indicator only when offline
 *
 * No stacked badge walls. No trail counters. No AR clutter.
 */

import React, { useState, useEffect, useRef } from "react";
import type { TrailPoint } from "@/hooks/useWalkTrail";

// ── Badge data types (kept for shell compatibility) ─────────────────────────

export interface AnchorBadge {
  id: string;
  label: string;
  type: string;
  recent?: boolean;
  queued?: boolean;
}

export interface SubjectBadge {
  id: string;
  label: string;
  type: string;
  species?: string | null;
  recent?: boolean;
  queued?: boolean;
}

export interface AreaBadge {
  id: string;
  label: string;
  type: string;
  recent?: boolean;
  queued?: boolean;
}

interface CameraOverlayProps {
  trail: TrailPoint[];
  anchors: AnchorBadge[];
  subjects: SubjectBadge[];
  areas: AreaBadge[];
  lightRecorded: boolean;
  walkActive: boolean;
  queuedCount?: number;
}

export default function CameraOverlay({
  anchors,
  subjects,
  areas,
  lightRecorded,
  walkActive,
  queuedCount = 0,
}: CameraOverlayProps) {
  if (!walkActive) return null;

  const totalNoted = anchors.length + subjects.length + areas.length + (lightRecorded ? 1 : 0);

  // Find the most recent item for the flash chip
  const recentItem = [...anchors, ...subjects, ...areas]
    .filter((b) => b.recent)
    .pop();

  return (
    <>
      {/* ── Soft observing pulse (top-left) ────────────────────────────── */}
      <div className="absolute top-14 left-3 pointer-events-none">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400/60 animate-pulse" />
          <span className="text-green-400/40 text-[9px] font-medium">Observing</span>
        </div>
      </div>

      {/* ── Recent item flash (top-right, fades) ──────────────────────── */}
      {recentItem && (
        <RecentFlash label={recentItem.label} />
      )}

      {/* ── Soft count chip (bottom-left, above action rail) ──────────── */}
      {totalNoted > 0 && (
        <div className="absolute bottom-20 left-3 pointer-events-none">
          <div className="bg-black/30 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1.5">
            <span className="text-white/40 text-[9px] font-medium tabular-nums">
              {totalNoted} noted
            </span>
          </div>
        </div>
      )}

      {/* ── Queued indicator (only when offline items exist) ──────────── */}
      {queuedCount > 0 && (
        <div className="absolute top-14 right-3 pointer-events-none">
          <div className="bg-orange-900/40 backdrop-blur-sm border border-orange-600/30 rounded-full px-2 py-0.5">
            <span className="text-orange-400/60 text-[9px] font-medium">{queuedCount} queued</span>
          </div>
        </div>
      )}
    </>
  );
}

// ── Recent flash chip — shows briefly then fades ─────────────────────────────

function RecentFlash({ label }: { label: string }) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setVisible(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timerRef.current);
  }, [label]);

  if (!visible) return null;

  return (
    <div className="absolute top-14 right-3 pointer-events-none">
      <div className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-full px-2.5 py-1 max-w-[160px]">
        <span className="text-white/60 text-[10px] font-medium truncate block">{label}</span>
      </div>
    </div>
  );
}
