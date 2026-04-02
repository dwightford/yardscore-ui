"use client";

/**
 * /property/[id]/light — Light Observation capture flow
 *
 * Quick-capture screen for recording light conditions at a property.
 * Designed to take ~10 seconds: auto-selects time bucket and season,
 * user picks light level, optionally cloud cover, taps submit.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// -- Types -------------------------------------------------------------------

interface LightObservation {
  id: string;
  land_unit_id: string;
  time_bucket: string;
  light_level: string;
  cloud_cover?: string;
  season_bucket?: string;
  notes?: string;
  lat?: number;
  lng?: number;
  observed_at: string;
}

type TimeBucket = "morning" | "midday" | "afternoon" | "dusk";
type LightLevel = "full_sun" | "part_sun" | "dappled" | "part_shade" | "full_shade";
type CloudCover = "clear" | "partly_cloudy" | "overcast";
type SeasonBucket = "spring_leafout" | "summer_canopy" | "fall_transition" | "winter_leafoff";
type Status = "idle" | "submitting" | "success" | "error";

// -- Helpers -----------------------------------------------------------------

function detectTimeBucket(): TimeBucket {
  const h = new Date().getHours();
  if (h >= 6 && h < 10) return "morning";
  if (h >= 10 && h < 14) return "midday";
  if (h >= 14 && h < 18) return "afternoon";
  return "dusk";
}

function detectSeason(): SeasonBucket {
  const m = new Date().getMonth(); // 0-indexed
  if (m >= 2 && m <= 4) return "spring_leafout";
  if (m >= 5 && m <= 7) return "summer_canopy";
  if (m >= 8 && m <= 10) return "fall_transition";
  return "winter_leafoff";
}

const TIME_BUCKETS: { value: TimeBucket; label: string; sub: string; icon: string }[] = [
  { value: "morning", label: "Morning", sub: "6am-10am", icon: "M12 3v1m0 16v1m8.66-13.66l-.71.71M4.05 19.07l-.71.71M21 12h-1M4 12H3m16.66 7.07l-.71-.71M4.05 4.93l-.71-.71M16 12a4 4 0 11-8 0" },
  { value: "midday", label: "Midday", sub: "10am-2pm", icon: "M12 2v2m0 16v2m10-10h-2M4 12H2m15.07-7.07l-1.41 1.41M6.34 17.66l-1.41 1.41m12.73 0l-1.41-1.41M6.34 6.34L4.93 4.93M12 8a4 4 0 100 8 4 4 0 000-8z" },
  { value: "afternoon", label: "Afternoon", sub: "2pm-6pm", icon: "M12 3v1m0 16v1m8.66-13.66l-.71.71M4.05 19.07l-.71.71M21 12h-1M4 12H3M16 12a4 4 0 11-8 0 4 4 0 018 0z" },
  { value: "dusk", label: "Dusk", sub: "6pm-8pm", icon: "M17 12a5 5 0 01-10 0m10 0h2M3 12h2m10 0a5 5 0 00-10 0m5-9v2m0 14v2m7.07-16.07l-1.41 1.41M6.34 17.66l-1.41 1.41" },
];

const LIGHT_LEVELS: { value: LightLevel; label: string; desc: string }[] = [
  { value: "full_sun", label: "Full Sun", desc: "No shade, direct sunlight" },
  { value: "part_sun", label: "Part Sun", desc: "Some shade, mostly sunny" },
  { value: "dappled", label: "Dappled", desc: "Filtered through canopy" },
  { value: "part_shade", label: "Part Shade", desc: "Mostly shaded, some sun" },
  { value: "full_shade", label: "Full Shade", desc: "No direct sunlight" },
];

const CLOUD_OPTIONS: { value: CloudCover; label: string }[] = [
  { value: "clear", label: "Clear" },
  { value: "partly_cloudy", label: "Partly Cloudy" },
  { value: "overcast", label: "Overcast" },
];

const SEASON_LABELS: Record<SeasonBucket, string> = {
  spring_leafout: "Spring (Leaf-out)",
  summer_canopy: "Summer (Canopy)",
  fall_transition: "Fall (Transition)",
  winter_leafoff: "Winter (Leaf-off)",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// -- Component ---------------------------------------------------------------

export default function LightObservationPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const token = (session as any)?.apiToken as string | undefined;

  // Form state
  const [timeBucket, setTimeBucket] = useState<TimeBucket>(detectTimeBucket);
  const [lightLevel, setLightLevel] = useState<LightLevel | null>(null);
  const [cloudCover, setCloudCover] = useState<CloudCover | null>(null);
  const [season, setSeason] = useState<SeasonBucket>(detectSeason);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // GPS
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);

  // Recent readings
  const [readings, setReadings] = useState<LightObservation[]>([]);

  // GPS capture on mount (non-blocking)
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        coordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // Fetch recent readings
  const fetchReadings = useCallback(async () => {
    if (!token || !id) return;
    try {
      const r = await apiFetch(token, `${API}/light-observations?land_unit_id=${id}`);
      if (r.ok) {
        const data = await r.json();
        setReadings(Array.isArray(data) ? data : []);
      }
    } catch {
      // non-critical
    }
  }, [token, id]);

  useEffect(() => {
    fetchReadings();
  }, [fetchReadings]);

  // Submit handler
  async function handleSubmit() {
    if (!lightLevel) {
      setErrorMsg("Select a light level.");
      return;
    }
    setStatus("submitting");
    setErrorMsg("");

    const coords = coordsRef.current;
    const body: Record<string, unknown> = {
      land_unit_id: id,
      time_bucket: timeBucket,
      light_level: lightLevel,
    };
    if (cloudCover) body.cloud_cover = cloudCover;
    if (season) body.season_bucket = season;
    if (notes.trim()) body.notes = notes.trim();
    if (coords) {
      body.lat = coords.lat;
      body.lng = coords.lng;
    }

    try {
      const r = await apiFetch(token, `${API}/light-observations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(text || `HTTP ${r.status}`);
      }
      setStatus("success");
      fetchReadings();
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Submit failed");
    }
  }

  function resetForm() {
    setTimeBucket(detectTimeBucket());
    setLightLevel(null);
    setCloudCover(null);
    setSeason(detectSeason());
    setNotes("");
    setStatus("idle");
    setErrorMsg("");
  }

  // -- Render ----------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#07110c] flex flex-col">
      {/* Header */}
      <nav className="flex-none border-b border-white/5 bg-[#07110c]">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <a
            href={`/property/${id}`}
            className="text-zinc-400 hover:text-white transition-colors text-sm flex items-center gap-1"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
            </svg>
            Back
          </a>
          <h1 className="text-white font-semibold text-lg">Light Reading</h1>
        </div>
      </nav>

      <div className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-6">
        {/* Success state */}
        {status === "success" ? (
          <div className="rounded-2xl border border-lime-300/20 bg-lime-300/5 p-6 text-center space-y-4">
            <div className="text-4xl">&#9745;</div>
            <p className="text-lime-300 font-semibold text-lg">Light reading recorded</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={resetForm}
                className="bg-lime-300 text-zinc-950 font-medium text-sm px-4 py-2.5 rounded-lg active:scale-95 transition-transform"
              >
                Record Another
              </button>
              <a
                href={`/property/${id}`}
                className="bg-white/10 border border-white/10 text-zinc-300 font-medium text-sm px-4 py-2.5 rounded-lg"
              >
                Back to Property
              </a>
            </div>
          </div>
        ) : (
          <>
            {/* 1. Time bucket */}
            <section>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                Time of Day
              </p>
              <div className="grid grid-cols-4 gap-2">
                {TIME_BUCKETS.map((tb) => (
                  <button
                    key={tb.value}
                    onClick={() => setTimeBucket(tb.value)}
                    className={`flex flex-col items-center gap-1 py-3 px-1 rounded-xl border transition-colors ${
                      timeBucket === tb.value
                        ? "bg-lime-300/10 border-lime-300/30 text-lime-300"
                        : "bg-white/5 border-white/10 text-zinc-400 hover:border-white/20"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                      <path d={tb.icon} />
                    </svg>
                    <span className="text-xs font-medium">{tb.label}</span>
                    <span className="text-[10px] text-zinc-600">{tb.sub}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* 2. Light level */}
            <section>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                Light Level
              </p>
              <div className="space-y-2">
                {LIGHT_LEVELS.map((ll) => (
                  <button
                    key={ll.value}
                    onClick={() => setLightLevel(ll.value)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                      lightLevel === ll.value
                        ? "bg-lime-300/10 border-lime-300/30"
                        : "bg-white/5 border-white/10 hover:border-white/20"
                    }`}
                  >
                    <span className={`text-sm font-medium ${lightLevel === ll.value ? "text-lime-300" : "text-white"}`}>
                      {ll.label}
                    </span>
                    <span className="text-xs text-zinc-500 ml-2">{ll.desc}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* 3. Cloud cover */}
            <section>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                Cloud Cover <span className="text-zinc-600 normal-case">(optional)</span>
              </p>
              <div className="grid grid-cols-3 gap-2">
                {CLOUD_OPTIONS.map((cc) => (
                  <button
                    key={cc.value}
                    onClick={() => setCloudCover(cloudCover === cc.value ? null : cc.value)}
                    className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                      cloudCover === cc.value
                        ? "bg-lime-300/10 border-lime-300/30 text-lime-300"
                        : "bg-white/5 border-white/10 text-zinc-400 hover:border-white/20"
                    }`}
                  >
                    {cc.label}
                  </button>
                ))}
              </div>
            </section>

            {/* 4. Season */}
            <section>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                Season <span className="text-zinc-600 normal-case">(auto-detected)</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(SEASON_LABELS) as [SeasonBucket, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setSeason(val)}
                    className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                      season === val
                        ? "bg-lime-300/10 border-lime-300/30 text-lime-300"
                        : "bg-white/5 border-white/10 text-zinc-400 hover:border-white/20"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            {/* 5. Notes */}
            <section>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                Notes <span className="text-zinc-600 normal-case">(optional)</span>
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Big oak casts shadow after 3pm"
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-lime-300/30 resize-none"
              />
            </section>

            {/* Error */}
            {errorMsg && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-300 text-center">
                {errorMsg}
              </div>
            )}

            {/* 7. Submit */}
            <button
              onClick={handleSubmit}
              disabled={!lightLevel || status === "submitting"}
              className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] ${
                lightLevel && status !== "submitting"
                  ? "bg-lime-300 text-zinc-950 hover:bg-lime-200"
                  : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
              }`}
            >
              {status === "submitting" ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />
                  Recording...
                </span>
              ) : (
                "Record Light Reading"
              )}
            </button>
          </>
        )}

        {/* Recent readings */}
        {readings.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
              Recent Readings
            </p>
            <div className="space-y-2">
              {readings.map((r) => (
                <div
                  key={r.id}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm text-white font-medium">
                      {LIGHT_LEVELS.find((l) => l.value === r.light_level)?.label ?? r.light_level}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {TIME_BUCKETS.find((t) => t.value === r.time_bucket)?.label ?? r.time_bucket}
                      {r.season_bucket && ` · ${SEASON_LABELS[r.season_bucket as SeasonBucket] ?? r.season_bucket}`}
                    </p>
                  </div>
                  <p className="text-xs text-zinc-600">{formatDate(r.observed_at)}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
