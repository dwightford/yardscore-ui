"use client";

/**
 * Light Walk — real-time GPS-tracked light scanning.
 *
 * Full-screen satellite map centered on your GPS position.
 * Walk your yard. Tap the light level as you go.
 * Colored dots appear on the map at your feet in real-time.
 *
 * Lane 1 tech stack: GPS + manual tap + satellite view.
 * No inference, no CV — just human observation with live feedback.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import("react-leaflet").then((m) => m.CircleMarker), { ssr: false });
const Tooltip = dynamic(() => import("react-leaflet").then((m) => m.Tooltip), { ssr: false });

// Dynamic component to re-center map on GPS updates
const MapUpdater = dynamic(
  () =>
    import("react-leaflet").then((mod) => {
      const { useMap } = mod;
      return function Updater({ center, follow }: { center: [number, number]; follow: boolean }) {
        const map = useMap();
        useEffect(() => {
          if (follow && center[0] !== 0) {
            map.setView(center, map.getZoom(), { animate: true });
          }
        }, [center, follow, map]);
        return null;
      };
    }),
  { ssr: false }
);

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Light levels ────────────────────────────────────────────────────────────

const LIGHT_LEVELS = [
  { key: "full_sun", label: "Sun", emoji: "☀️", color: "#fbbf24", desc: "Direct sunlight" },
  { key: "part_sun", label: "Part", emoji: "🌤", color: "#f59e0b", desc: "Mostly sunny" },
  { key: "dappled", label: "Dapple", emoji: "🌿", color: "#d97706", desc: "Filtered" },
  { key: "part_shade", label: "Shade", emoji: "⛅", color: "#92400e", desc: "Mostly shaded" },
  { key: "full_shade", label: "Dark", emoji: "🌑", color: "#78350f", desc: "No sun" },
] as const;

type LightLevel = typeof LIGHT_LEVELS[number]["key"];

interface DroppedPin {
  id: string;
  lat: number;
  lng: number;
  light_level: LightLevel;
  time_bucket: string;
  saved: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getTimeBucket(): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 10) return "morning";
  if (h >= 10 && h < 14) return "midday";
  if (h >= 14 && h < 18) return "afternoon";
  return "dusk";
}

function getSeasonBucket(): string {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return "spring_leafout";
  if (m >= 5 && m <= 7) return "summer_canopy";
  if (m >= 8 && m <= 10) return "fall_transition";
  return "winter_leafoff";
}

function timeBucketLabel(tb: string): string {
  return { morning: "Morning", midday: "Midday", afternoon: "Afternoon", dusk: "Dusk" }[tb] ?? tb;
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function LightWalkPage() {
  const { id: landUnitId } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const token = (session as any)?.apiToken as string | undefined;

  // GPS state
  const [pos, setPos] = useState<[number, number]>([0, 0]);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [followGps, setFollowGps] = useState(true);
  const watchIdRef = useRef<number | null>(null);

  // Pins
  const [pins, setPins] = useState<DroppedPin[]>([]);
  const [existing, setExisting] = useState<DroppedPin[]>([]);

  // UI state
  const [started, setStarted] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<LightLevel | null>(null);
  const timeBucket = getTimeBucket();
  const seasonBucket = getSeasonBucket();

  // ── Load existing light observations ────────────────────────────────────

  useEffect(() => {
    if (!token || !landUnitId) return;
    apiFetch(token, `${API}/light-observations?land_unit_id=${landUnitId}`)
      .then((r) => r.ok ? r.json() : [])
      .then((obs: any[]) => {
        setExisting(
          obs
            .filter((o: any) => o.device_lat && o.device_lng)
            .map((o: any) => ({
              id: o.id,
              lat: o.device_lat,
              lng: o.device_lng,
              light_level: o.light_level,
              time_bucket: o.time_bucket,
              saved: true,
            }))
        );
      })
      .catch(() => {});
  }, [token, landUnitId]);

  // ── GPS tracking ────────────────────────────────────────────────────────

  const startGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("GPS not available");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setPos([p.coords.latitude, p.coords.longitude]);
        setGpsAccuracy(p.coords.accuracy);
        setGpsError(null);
      },
      (err) => {
        setGpsError(err.message);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
    watchIdRef.current = id;
  }, []);

  const stopGps = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopGps();
  }, [stopGps]);

  // ── Start walk ──────────────────────────────────────────────────────────

  function handleStart() {
    setStarted(true);
    startGps();
  }

  function handleStop() {
    setStarted(false);
    stopGps();
  }

  // ── Drop a pin ──────────────────────────────────────────────────────────

  async function dropPin(level: LightLevel) {
    if (pos[0] === 0 && pos[1] === 0) return; // no GPS yet

    const pin: DroppedPin = {
      id: `local-${Date.now()}`,
      lat: pos[0],
      lng: pos[1],
      light_level: level,
      time_bucket: timeBucket,
      saved: false,
    };

    // Optimistic add — show immediately
    setPins((prev) => [...prev, pin]);
    setSelectedLevel(null);

    // Save to API in background
    if (token) {
      try {
        const r = await apiFetch(token, `${API}/light-observations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            land_unit_id: landUnitId,
            time_bucket: timeBucket,
            season_bucket: seasonBucket,
            light_level: level,
            device_lat: pos[0],
            device_lng: pos[1],
            confidence: 0.8,
          }),
        });
        if (r.ok) {
          const saved = await r.json();
          setPins((prev) =>
            prev.map((p) => (p.id === pin.id ? { ...p, id: saved.id, saved: true } : p))
          );
        }
      } catch {
        // Pin stays visible even if save fails — retry later
      }
    }
  }

  // ── All pins (existing + new) ───────────────────────────────────────────

  const allPins = [...existing, ...pins];
  const pinColor = (level: LightLevel) =>
    LIGHT_LEVELS.find((l) => l.key === level)?.color ?? "#fbbf24";

  // ── Pre-start screen ────────────────────────────────────────────────────

  if (!started) {
    return (
      <div className="min-h-screen bg-[#07110c] text-white flex flex-col">
        <header className="px-5 pt-14 pb-4">
          <a href={`/property/${landUnitId}`} className="text-zinc-500 text-sm hover:text-white">
            ← Back
          </a>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="text-6xl mb-6">☀️</div>
          <h1 className="text-2xl font-bold mb-3">Light Walk</h1>
          <p className="text-sm text-zinc-400 max-w-sm leading-relaxed mb-2">
            Walk your yard with the map open. At each spot, tap the light level you see.
            Dots appear on the satellite view in real-time.
          </p>
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-8">
            <span className="px-2 py-1 rounded bg-white/5">{timeBucketLabel(timeBucket)}</span>
            <span>recording window</span>
          </div>
          <button
            onClick={handleStart}
            className="px-10 py-4 bg-amber-400 text-zinc-950 font-bold rounded-2xl text-sm hover:bg-amber-300 transition-colors"
          >
            Start Light Walk
          </button>
          <p className="text-[10px] text-zinc-600 mt-4">Requires GPS. Works best outdoors.</p>

          {/* Existing coverage */}
          {existing.length > 0 && (
            <div className="mt-8 text-xs text-zinc-500">
              {existing.length} light reading{existing.length !== 1 ? "s" : ""} already recorded
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Active walk — full-screen map ───────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-[#07110c]">
      {/* Top bar */}
      <div className="flex-none bg-black/80 backdrop-blur-sm border-b border-white/10 px-4 py-2 flex items-center justify-between z-[1001]">
        <div className="flex items-center gap-3">
          <span className="text-amber-400 text-lg">☀️</span>
          <div>
            <p className="text-xs font-semibold text-white">
              Light Walk — {timeBucketLabel(timeBucket)}
            </p>
            <p className="text-[10px] text-zinc-500">
              {pins.length} new · {allPins.length} total
              {gpsAccuracy && <span> · GPS ±{Math.round(gpsAccuracy)}m</span>}
            </p>
          </div>
        </div>
        <button
          onClick={handleStop}
          className="px-3 py-1.5 bg-white/10 border border-white/10 text-white text-xs font-medium rounded-lg hover:bg-white/20"
        >
          Done
        </button>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {pos[0] === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#07110c]">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-zinc-400">Waiting for GPS...</p>
              {gpsError && <p className="text-xs text-red-400 mt-2">{gpsError}</p>}
            </div>
          </div>
        ) : (
          <MapContainer
            center={pos}
            zoom={20}
            maxZoom={21}
            className="w-full h-full"
            style={{ background: "#111" }}
          >
            <TileLayer
              attribution='Tiles &copy; Esri'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={21}
            />
            <MapUpdater center={pos} follow={followGps} />

            {/* You-are-here pulsing dot */}
            <CircleMarker
              center={pos}
              radius={8}
              pathOptions={{
                color: "#3b82f6",
                fillColor: "#3b82f6",
                fillOpacity: 0.9,
                weight: 3,
              }}
            >
              <Tooltip direction="top" offset={[0, -12]} permanent>
                <span style={{ fontSize: "10px", fontWeight: 600 }}>You</span>
              </Tooltip>
            </CircleMarker>

            {/* GPS accuracy ring */}
            {gpsAccuracy && gpsAccuracy > 5 && (
              <CircleMarker
                center={pos}
                radius={Math.min(gpsAccuracy * 2, 40)}
                pathOptions={{
                  color: "#3b82f6",
                  fillColor: "#3b82f6",
                  fillOpacity: 0.08,
                  weight: 1,
                  dashArray: "4 4",
                }}
              />
            )}

            {/* All light observation pins */}
            {allPins.map((pin) => (
              <CircleMarker
                key={pin.id}
                center={[pin.lat, pin.lng]}
                radius={7}
                pathOptions={{
                  color: "#fff",
                  fillColor: pinColor(pin.light_level),
                  fillOpacity: 0.85,
                  weight: pin.saved ? 1.5 : 2.5,
                }}
              >
                <Tooltip direction="top" offset={[0, -8]}>
                  <span style={{ fontSize: "10px" }}>
                    {LIGHT_LEVELS.find((l) => l.key === pin.light_level)?.label ?? pin.light_level}
                    {" · "}
                    {pin.time_bucket}
                    {!pin.saved && " (saving...)"}
                  </span>
                </Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        )}

        {/* Re-center button */}
        {pos[0] !== 0 && !followGps && (
          <button
            onClick={() => setFollowGps(true)}
            className="absolute top-4 right-4 z-[1000] w-10 h-10 bg-black/70 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/10"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
            </svg>
          </button>
        )}
      </div>

      {/* Light level buttons — always visible at bottom */}
      <div className="flex-none bg-black/90 backdrop-blur-sm border-t border-white/10 px-3 py-3 z-[1001]">
        <p className="text-[10px] text-zinc-500 text-center mb-2">
          Tap the light level you see right now
        </p>
        <div className="flex gap-2">
          {LIGHT_LEVELS.map((level) => (
            <button
              key={level.key}
              onClick={() => dropPin(level.key)}
              disabled={pos[0] === 0}
              className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border transition-all active:scale-95 disabled:opacity-30"
              style={{
                backgroundColor: `${level.color}15`,
                borderColor: `${level.color}40`,
              }}
            >
              <span className="text-xl">{level.emoji}</span>
              <span className="text-[10px] font-semibold text-white">{level.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
