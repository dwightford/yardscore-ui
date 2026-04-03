"use client";

/**
 * WalkReview
 *
 * Shown after observation ends. This is the handoff surface —
 * not the full browser. It should feel like a gentle summary
 * of what the walk added to property memory.
 *
 * Canon: anchors confirmed, known plants updated, new candidates,
 * areas marked, light confidence improved, sensory notes added,
 * one next best action.
 */

import React from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import type { TrailPoint } from "@/hooks/useWalkTrail";

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Polyline = dynamic(() => import("react-leaflet").then((m) => m.Polyline), { ssr: false });
const CircleMarker = dynamic(() => import("react-leaflet").then((m) => m.CircleMarker), { ssr: false });

// ── Types ────────────────────────────────────────────────────────────────────

export interface MapPin {
  lat: number;
  lng: number;
  label: string;
  color: string;
}

export interface NextAction {
  label: string;
  description: string;
}

export type MemoryStage = "unstarted" | "walked_no_origin" | "origin_only" | "forming" | "established";

export interface WalkReviewData {
  duration: number;
  anchorCount: number;
  subjectCount: number;
  areaCount: number;
  lightRecorded: boolean;
  noteCount?: number;
  trail: TrailPoint[];
  anchorPins?: MapPin[];
  subjectPins?: MapPin[];
  areaPins?: MapPin[];
  nextAction?: NextAction | null;
  memoryStage?: MemoryStage | null;
  queuedCount?: number;
}

interface WalkReviewProps {
  data: WalkReviewData;
  propertyLabel?: string;
  onStartNewWalk: () => void;
  onViewProperty?: () => void;
  onDismiss: () => void;
}

function formatDuration(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m} min`;
}

// ── Trail map ────────────────────────────────────────────────────────────────

function TrailMap({ trail, pins }: { trail: TrailPoint[]; pins: MapPin[] }) {
  if (trail.length < 2) return null;

  const positions: [number, number][] = trail.map((p) => [p.lat, p.lng]);
  const lats = trail.map((p) => p.lat);
  const lngs = trail.map((p) => p.lng);
  const center: [number, number] = [
    (Math.min(...lats) + Math.max(...lats)) / 2,
    (Math.min(...lngs) + Math.max(...lngs)) / 2,
  ];

  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.06]" style={{ height: 160 }}>
      <MapContainer
        center={center}
        zoom={19}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
        dragging={false}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
        <Polyline positions={positions} pathOptions={{ color: "#4ade80", weight: 2, opacity: 0.6 }} />
        <CircleMarker center={positions[0]} radius={4} pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 1 }} />
        <CircleMarker center={positions[positions.length - 1]} radius={4} pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 1 }} />
        {pins.map((pin, i) => (
          <CircleMarker key={i} center={[pin.lat, pin.lng]} radius={3} pathOptions={{ color: pin.color, fillColor: pin.color, fillOpacity: 0.8 }} />
        ))}
      </MapContainer>
    </div>
  );
}

// ── Main review component ────────────────────────────────────────────────────

export default function WalkReview({
  data,
  propertyLabel,
  onStartNewWalk,
  onViewProperty,
  onDismiss,
}: WalkReviewProps) {
  const allPins = [
    ...(data.anchorPins ?? []),
    ...(data.subjectPins ?? []),
    ...(data.areaPins ?? []),
  ];

  // Build summary items — only show what actually happened
  const items: Array<{ label: string; accent: string }> = [];
  if (data.anchorCount > 0) {
    items.push({ label: `${data.anchorCount} reference ${data.anchorCount === 1 ? "point" : "points"} confirmed`, accent: "text-amber-400/80" });
  }
  if (data.subjectCount > 0) {
    items.push({ label: `${data.subjectCount} ${data.subjectCount === 1 ? "plant" : "plants"} noted`, accent: "text-green-400/80" });
  }
  if (data.areaCount > 0) {
    items.push({ label: `${data.areaCount} ${data.areaCount === 1 ? "area" : "areas"} marked`, accent: "text-lime-400/80" });
  }
  if (data.lightRecorded) {
    items.push({ label: "Light conditions recorded", accent: "text-yellow-400/80" });
  }
  if ((data.noteCount ?? 0) > 0) {
    items.push({ label: `${data.noteCount} ${data.noteCount === 1 ? "note" : "notes"} added`, accent: "text-sky-400/80" });
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onDismiss} />

      <div
        className="relative z-10 bg-stone-950/95 rounded-t-2xl border-t border-white/[0.08] px-5 pt-5 max-h-[85vh] overflow-y-auto"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="w-8 h-0.5 bg-white/15 rounded-full mx-auto mb-5" />

        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-white text-base font-semibold">Observation complete</h2>
          <button onClick={onDismiss} className="text-stone-600 hover:text-stone-400 text-sm px-1">
            ✕
          </button>
        </div>
        <p className="text-stone-600 text-xs mb-4">
          {propertyLabel && <span>{propertyLabel} · </span>}
          {formatDuration(data.duration)}
        </p>

        {/* Trail map */}
        {data.trail.length >= 2 && (
          <div className="mb-4">
            <TrailMap trail={data.trail} pins={allPins} />
          </div>
        )}

        {/* What happened — simple list */}
        {items.length > 0 ? (
          <div className="space-y-2 mb-4">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-white/20 flex-none" />
                <span className={`text-xs ${item.accent}`}>{item.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-stone-500 text-xs mb-4">
            You walked the yard. Next time, try marking things that catch your eye — even rough notes help.
          </p>
        )}

        {/* Memory stage */}
        {data.memoryStage && (
          <div className="flex items-center justify-between bg-white/[0.03] rounded-xl px-3 py-2.5 mb-4">
            <span className="text-stone-500 text-[10px] uppercase tracking-wide">Property memory</span>
            <span className="text-stone-300 text-xs font-medium">{STAGE_LABELS[data.memoryStage]}</span>
          </div>
        )}

        {/* Next best action */}
        {data.nextAction && (
          <div className="bg-white/[0.03] rounded-xl px-3 py-2.5 mb-4">
            <p className="text-stone-300 text-xs font-medium">{data.nextAction.label}</p>
            <p className="text-stone-500 text-[10px] mt-0.5">{data.nextAction.description}</p>
          </div>
        )}

        {/* Queued notice */}
        {(data.queuedCount ?? 0) > 0 && (
          <p className="text-orange-400/60 text-[10px] mb-4">
            {data.queuedCount} {data.queuedCount === 1 ? "item" : "items"} saved offline — will sync when connected.
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {onViewProperty && (
            <button
              onClick={onViewProperty}
              className="w-full bg-white/[0.06] hover:bg-white/10 active:scale-[0.98] text-white font-medium rounded-xl py-3 text-sm transition"
            >
              View property
            </button>
          )}
          <button
            onClick={onStartNewWalk}
            className="w-full text-stone-500 hover:text-stone-300 text-xs py-2 transition"
          >
            Observe again
          </button>
        </div>
      </div>
    </div>
  );
}

const STAGE_LABELS: Record<MemoryStage, string> = {
  unstarted: "Not started",
  walked_no_origin: "Needs origin",
  origin_only: "Origin set",
  forming: "Forming",
  established: "Established",
};
