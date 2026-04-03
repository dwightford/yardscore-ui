"use client";

/**
 * WalkReview
 *
 * Shown after a walk ends. Summarizes what was captured during the
 * session: anchors, plants, areas, trail length, duration.
 * Includes a mini-map showing the walk trail and tagged items.
 * Plain homeowner language — no internal jargon.
 *
 * Actions: view property details, start another walk, or dismiss.
 */

import React from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import type { TrailPoint } from "@/hooks/useWalkTrail";

// Dynamic Leaflet imports (no SSR)
const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false },
);
const Polyline = dynamic(
  () => import("react-leaflet").then((m) => m.Polyline),
  { ssr: false },
);
const CircleMarker = dynamic(
  () => import("react-leaflet").then((m) => m.CircleMarker),
  { ssr: false },
);

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
  duration: number; // seconds
  anchorCount: number;
  subjectCount: number;
  areaCount: number;
  lightRecorded: boolean;
  trail: TrailPoint[];
  /** Optional pins for map display */
  anchorPins?: MapPin[];
  subjectPins?: MapPin[];
  areaPins?: MapPin[];
  /** Readiness-driven next action suggestion */
  nextAction?: NextAction | null;
  /** Property memory maturity after this walk */
  memoryStage?: MemoryStage | null;
  /** Number of observations still queued offline */
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
  const sec = s % 60;
  return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
}

function trailDistanceM(trail: TrailPoint[]): number {
  let total = 0;
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1];
    const b = trail[i];
    const R = 6371000;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const h =
      sinLat * sinLat +
      Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
    total += R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }
  return total;
}

function formatDistance(m: number): string {
  if (m < 30) return `${Math.round(m)} m`;
  const ft = Math.round(m * 3.281);
  return ft > 5000 ? `${(ft / 5280).toFixed(1)} mi` : `${ft} ft`;
}

// ── Trail map ────────────────────────────────────────────────────────────────

function TrailMap({ trail, anchorPins, subjectPins, areaPins }: {
  trail: TrailPoint[];
  anchorPins?: MapPin[];
  subjectPins?: MapPin[];
  areaPins?: MapPin[];
}) {
  if (trail.length < 2) return null;

  const positions: [number, number][] = trail.map((p) => [p.lat, p.lng]);

  // Compute bounds center
  const lats = trail.map((p) => p.lat);
  const lngs = trail.map((p) => p.lng);
  const center: [number, number] = [
    (Math.min(...lats) + Math.max(...lats)) / 2,
    (Math.min(...lngs) + Math.max(...lngs)) / 2,
  ];

  const allPins = [
    ...(anchorPins ?? []),
    ...(subjectPins ?? []),
    ...(areaPins ?? []),
  ];

  return (
    <div className="rounded-xl overflow-hidden border border-white/10" style={{ height: 180 }}>
      <MapContainer
        center={center}
        zoom={19}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
        dragging={false}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        {/* Walk trail polyline */}
        <Polyline
          positions={positions}
          pathOptions={{ color: "#4ade80", weight: 3, opacity: 0.8 }}
        />
        {/* Start point */}
        <CircleMarker
          center={positions[0]}
          radius={6}
          pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 1 }}
        />
        {/* End point */}
        <CircleMarker
          center={positions[positions.length - 1]}
          radius={6}
          pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 1 }}
        />
        {/* Pins */}
        {allPins.map((pin, i) => (
          <CircleMarker
            key={i}
            center={[pin.lat, pin.lng]}
            radius={5}
            pathOptions={{ color: pin.color, fillColor: pin.color, fillOpacity: 0.9 }}
          />
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
  const totalItems = data.anchorCount + data.subjectCount + data.areaCount;
  const distance = trailDistanceM(data.trail);

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onDismiss} />

      {/* Review sheet */}
      <div className="relative z-10 bg-stone-950/95 rounded-t-2xl border-t border-white/10 px-5 pt-4 pb-6 max-h-[85vh] overflow-y-auto">
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-1">
          <h2 className="text-white font-semibold text-base">Walk Complete</h2>
          <button
            onClick={onDismiss}
            className="text-stone-500 hover:text-white text-lg leading-none px-1"
          >
            ✕
          </button>
        </div>
        {propertyLabel && (
          <p className="text-stone-500 text-xs mb-4">{propertyLabel}</p>
        )}

        {/* Trail map */}
        {data.trail.length >= 2 && (
          <div className="mb-4">
            <TrailMap
              trail={data.trail}
              anchorPins={data.anchorPins}
              subjectPins={data.subjectPins}
              areaPins={data.areaPins}
            />
            <div className="flex items-center justify-between mt-1.5 px-1">
              <span className="flex items-center gap-1 text-[10px] text-stone-500">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Start
              </span>
              <span className="flex items-center gap-1 text-[10px] text-stone-500">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> End
              </span>
            </div>
          </div>
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <StatCard value={formatDuration(data.duration)} label="Duration" accent="text-sky-400" />
          <StatCard
            value={distance > 0 ? formatDistance(distance) : "--"}
            label="Distance walked"
            accent="text-sky-400"
          />
          <StatCard value={String(data.anchorCount)} label="Reference points" accent="text-amber-400" />
          <StatCard value={String(data.subjectCount)} label="Plants noted" accent="text-green-400" />
          <StatCard value={String(data.areaCount)} label="Areas marked" accent="text-lime-400" />
          <StatCard
            value={data.lightRecorded ? "Yes" : "No"}
            label="Light recorded"
            accent={data.lightRecorded ? "text-yellow-400" : "text-stone-500"}
          />
        </div>

        {/* Narrative */}
        <div className="bg-white/5 rounded-xl px-4 py-3 mb-4">
          <p className="text-stone-300 text-sm leading-relaxed">
            {reviewNarrative(totalItems, data.memoryStage ?? null)}
          </p>
          {data.nextAction && (
            <div className="mt-2 pt-2 border-t border-white/5">
              <p className="text-stone-200 text-xs font-medium">{data.nextAction.label}</p>
              <p className="text-stone-500 text-xs mt-0.5">{data.nextAction.description}</p>
            </div>
          )}
          {!data.nextAction && !data.lightRecorded && (
            <p className="text-stone-500 text-xs mt-2">
              Recording light conditions on your next walk will help with planting recommendations.
            </p>
          )}
        </div>

        {/* Memory maturity */}
        {data.memoryStage && (
          <MemoryStageIndicator stage={data.memoryStage} />
        )}

        {/* Queued items notice */}
        {data.queuedCount != null && data.queuedCount > 0 && (
          <div className="bg-orange-900/30 border border-orange-700/30 rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2">
            <span className="text-base">📶</span>
            <p className="text-orange-300 text-xs">
              {data.queuedCount} {data.queuedCount === 1 ? "observation" : "observations"} saved
              offline — will sync when you&apos;re back online.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {onViewProperty && (
            <button
              onClick={onViewProperty}
              className="w-full bg-green-700 hover:bg-green-600 active:scale-95 text-white font-semibold rounded-xl py-3 transition"
            >
              View Property
            </button>
          )}
          <button
            onClick={onStartNewWalk}
            className="w-full bg-white/10 hover:bg-white/15 active:scale-95 text-white font-medium rounded-xl py-3 transition"
          >
            Start Another Walk
          </button>
        </div>
      </div>
    </div>
  );
}

function reviewNarrative(totalItems: number, stage: MemoryStage | null): string {
  if (stage === "established") {
    return totalItems > 0
      ? "Great walk. Your property memory is well established. Seasonal revisits keep it fresh."
      : "Walk complete. Your memory is strong — revisiting across seasons adds the most value now.";
  }
  if (stage === "forming") {
    return totalItems > 3
      ? "Great walk. Your property memory is forming nicely. A couple more walks will fill in the picture."
      : "Good progress. Each walk strengthens your property memory. Try noting a few more things next time.";
  }
  // Early stages or unknown
  if (totalItems === 0) {
    return "You completed a walk. Next time, try marking some plants and areas as you go — even rough notes help build your property memory.";
  }
  if (totalItems <= 3) {
    return "Good start. Each walk adds to your property memory. The more you note, the better your recommendations will be.";
  }
  return "Great walk. Your property memory is getting stronger. Repeated visits across seasons will fill in the picture.";
}

function StatCard({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <div className="bg-white/5 rounded-xl py-2.5 px-3">
      <p className={`text-lg font-bold ${accent}`}>{value}</p>
      <p className="text-stone-500 text-[10px] mt-0.5">{label}</p>
    </div>
  );
}

const STAGE_CONFIG: Record<MemoryStage, { label: string; fill: number; accent: string }> = {
  unstarted:        { label: "Not started",     fill: 0,   accent: "bg-stone-600" },
  walked_no_origin: { label: "Needs origin",    fill: 15,  accent: "bg-amber-600" },
  origin_only:      { label: "Origin set",      fill: 25,  accent: "bg-amber-500" },
  forming:          { label: "Forming",         fill: 55,  accent: "bg-blue-500" },
  established:      { label: "Established",     fill: 90,  accent: "bg-green-500" },
};

function MemoryStageIndicator({ stage }: { stage: MemoryStage }) {
  const cfg = STAGE_CONFIG[stage];
  return (
    <div className="bg-white/5 rounded-xl px-4 py-3 mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-stone-400 text-[10px] uppercase tracking-wide">Property memory</p>
        <p className="text-stone-300 text-xs font-medium">{cfg.label}</p>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${cfg.accent}`}
          style={{ width: `${cfg.fill}%` }}
        />
      </div>
    </div>
  );
}
