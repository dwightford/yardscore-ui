"use client";

/**
 * /capture — capture-first mobile screen
 *
 * Design axiom: ONE human act — take a photo.
 * Everything else (place selection, GPS, scoring) happens automatically
 * before or after that single tap.
 *
 * Flow:
 *   1. Mount: silently request GPS + fetch existing places in parallel
 *   2. User taps the camera button → native camera opens (capture="environment")
 *   3. File selected → immediately POST /observations/upload
 *   4. While uploading: "scoring…" spinner
 *   5. Poll GET /yardscore/{id} up to 10s → show inline ScoreCard
 *   6. "Score another" returns to idle state
 *
 * Place selection:
 *   - If places exist: show compact chip row above camera button
 *   - "New…" chip: prompts for a name (single text input, no wizard)
 *   - If no places: auto-prompt for a name before upload is allowed
 *
 * All state is local — no router, no navigation, no form.
 */

import { useState, useEffect, useRef, useCallback, ChangeEvent } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";
import NavBar from "../components/NavBar";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Place {
  id: string;
  name: string;
  land_unit_type: string;
  address: string | null;
}

interface ScoreResult {
  land_unit_id: string;
  score_value: number;
  confidence: number;
  coverage: number;
  positives: string[];
  negatives: string[];
  recommendations: string[];
}

type Status = "idle" | "uploading" | "scoring" | "done" | "error";

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(v: number): string {
  if (v >= 75) return "text-green-700";
  if (v >= 50) return "text-yellow-700";
  return "text-red-700";
}

function scoreBg(v: number): string {
  if (v >= 75) return "bg-green-50 border-green-200";
  if (v >= 50) return "bg-yellow-50 border-yellow-200";
  return "bg-red-50 border-red-200";
}

// Poll /yardscore/.../latest until a score run is available or timeout.
// Polls the persisted latest score — does NOT re-trigger scoring.
async function pollScore(token: string | undefined, landUnitId: string, signal: AbortSignal): Promise<ScoreResult | null> {
  const start = Date.now();
  while (Date.now() - start < 15_000) {
    if (signal.aborted) return null;
    try {
      const r = await apiFetch(token, `${API}/yardscore/${landUnitId}/latest`, { signal });
      if (r.ok) {
        const body = await r.json();
        if (body.score_value !== undefined) return body as ScoreResult;
      }
      // 404 = score not yet written; keep polling
    } catch {
      // network blip or abort — keep trying
    }
    await new Promise((res) => setTimeout(res, 1000));
  }
  return null;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CapturePage() {
  const { data: session } = useSession();
  const tokenRef = useRef<string | undefined>(undefined);
  useEffect(() => { tokenRef.current = (session as any)?.apiToken; }, [session]);

  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [newPlaceName, setNewPlaceName] = useState("");
  const [showNewPlaceInput, setShowNewPlaceInput] = useState(false);
  const [hasGps, setHasGps] = useState(false);

  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── On mount: fetch places only — GPS is deferred to user tap ───────────────

  const token = (session as any)?.apiToken as string | undefined;

  useEffect(() => {
    if (!token) return;
    apiFetch(token, `${API}/land_units`)
      .then((r) => r.json())
      .then((data: Place[]) => {
        setPlaces(data);
        if (data.length === 1) setSelectedPlace(data[0]);
      })
      .catch(() => {
        /* non-critical: places chip row simply stays empty */
      });
  }, [token]);

  // ── Start GPS in background — called on user tap, not on mount ───────────────
  // This avoids triggering the iOS permission prompt during initial render.
  function startGpsInBackground() {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        coordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setHasGps(true);
      },
      () => { /* permission denied — upload will continue without coords */ },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  // ── Create a new place ───────────────────────────────────────────────────────

  const createNewPlace = useCallback(async () => {
    const name = newPlaceName.trim();
    if (!name) return;

    const coords = coordsRef.current;
    // Try to reverse-geocode for a nicer address string
    let address: string | null = null;
    if (coords) {
      try {
        const gr = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`,
          { headers: { "Accept-Language": "en" } }
        );
        if (gr.ok) {
          const gj = await gr.json();
          address = gj.display_name ?? null;
        }
      } catch {
        /* ignore */
      }
    }

    const r = await apiFetch(tokenRef.current, `${API}/land_units`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, land_unit_type: "yard", address }),
    });
    if (!r.ok) return;
    const place: Place = await r.json();
    setPlaces((prev) => [place, ...prev]);
    setSelectedPlace(place);
    setNewPlaceName("");
    setShowNewPlaceInput(false);
  }, [newPlaceName]);

  // ── Handle file selection → immediate upload ─────────────────────────────────

  const handleFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const coords = coordsRef.current;
      let place = selectedPlace;

      // Auto-resolve a place from GPS if the user hasn't selected one
      if (!place) {
        if (!coords) {
          setErrorMsg("Select or create a place first, or allow location access.");
          return;
        }
        try {
          const r = await apiFetch(tokenRef.current, `${API}/places/resolve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: coords.lat, lon: coords.lng }),
          });
          if (!r.ok) throw new Error("Could not resolve place from GPS");
          const resolved = await r.json();
          place = {
            id: resolved.land_unit_id,
            name: resolved.name,
            land_unit_type: resolved.land_unit_type ?? "yard",
            address: resolved.address,
          };
          setSelectedPlace(place);
          setPlaces((prev) =>
            prev.find((p) => p.id === resolved.land_unit_id)
              ? prev
              : [place!, ...prev]
          );
        } catch (err: unknown) {
          setErrorMsg(
            err instanceof Error ? err.message : "Could not detect location. Select a place manually."
          );
          return;
        }
      }

      // Show preview while uploading
      const url = URL.createObjectURL(file);
      setPreview(url);
      setStatus("uploading");
      setErrorMsg("");
      setScore(null);

      const landUnitId = place.id;

      try {
        // 1. Open observation session
        const sessR = await apiFetch(tokenRef.current, `${API}/observation_sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ land_unit_id: landUnitId }),
        });
        if (!sessR.ok) throw new Error("Failed to open session");
        const sess = await sessR.json();
        const sessionId: string = sess.id;

        // 2. Upload frame to session (triggers background scoring)
        const fd = new FormData();
        fd.append("file", file);
        if (coords) {
          fd.append("device_lat", String(coords.lat));
          fd.append("device_lng", String(coords.lng));
        }
        const frameR = await apiFetch(tokenRef.current, `${API}/observation_sessions/${sessionId}/frames`, {
          method: "POST",
          body: fd,
        });
        if (!frameR.ok) throw new Error(await frameR.text());

        // 3. Finalize session (creates interpretation record)
        await apiFetch(tokenRef.current, `${API}/observation_sessions/${sessionId}/finalize`, { method: "PATCH" });
      } catch (err: unknown) {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Upload failed");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      // 4. Poll for score from persisted latest (scoring ran as background task)
      setStatus("scoring");
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const result = await pollScore(tokenRef.current, landUnitId, ctrl.signal);
      abortRef.current = null;

      if (result) {
        setScore(result);
        setStatus("done");
      } else {
        setStatus("error");
        setErrorMsg("Score timed out — try again.");
      }

      // Reset file input so selecting the same file triggers onChange next time
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [selectedPlace]
  );

  // ── Reset ────────────────────────────────────────────────────────────────────

  function reset() {
    abortRef.current?.abort();
    setStatus("idle");
    setScore(null);
    setPreview(null);
    setErrorMsg("");
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  // Capture is always enabled when idle — GPS and place resolution happen on tap
  const canCapture = status === "idle";

  return (
    <div className="min-h-screen bg-[#f0f7f4] flex flex-col">
      <NavBar active="/capture" />

      <div className="flex-1 flex flex-col px-4 py-4 max-w-md mx-auto w-full gap-4">
        {/* Place selector chips */}
        <section>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Scoring for
          </p>
          <div className="flex flex-wrap gap-2">
            {places.map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelectedPlace(p); setShowNewPlaceInput(false); }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  selectedPlace?.id === p.id
                    ? "bg-[#2d6a4f] text-white border-[#2d6a4f]"
                    : "bg-white text-gray-700 border-gray-300 hover:border-[#2d6a4f]"
                }`}
              >
                {p.name}
              </button>
            ))}

            {/* "New place" chip */}
            {!showNewPlaceInput && (
              <button
                onClick={() => setShowNewPlaceInput(true)}
                className="px-3 py-1.5 rounded-full text-sm font-medium border border-dashed border-gray-400 text-gray-500 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors"
              >
                + New…
              </button>
            )}
          </div>

          {/* Inline new-place input */}
          {showNewPlaceInput && (
            <div className="mt-2 flex gap-2">
              <input
                autoFocus
                value={newPlaceName}
                onChange={(e) => setNewPlaceName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createNewPlace()}
                placeholder="e.g. Front yard"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]"
              />
              <button
                onClick={createNewPlace}
                disabled={!newPlaceName.trim()}
                className="bg-[#2d6a4f] disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg"
              >
                Add
              </button>
              <button
                onClick={() => { setShowNewPlaceInput(false); setNewPlaceName(""); }}
                className="text-gray-400 text-sm px-2"
              >
                ✕
              </button>
            </div>
          )}
        </section>

        {/* Dominant camera action */}
        <section className="flex-1 flex flex-col items-center justify-center gap-4">
          {/* Hidden file input — accept images, trigger camera on mobile */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFile}
            disabled={!canCapture}
          />

          {/* Preview or camera button */}
          {preview && status !== "idle" ? (
            <div className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Captured yard" className="w-full object-cover aspect-[4/3]" />
              {(status === "uploading" || status === "scoring") && (
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2">
                  <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-white text-sm font-medium">
                    {status === "uploading" ? "Uploading…" : "Scoring…"}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => { startGpsInBackground(); fileInputRef.current?.click(); }}
              disabled={!canCapture}
              aria-label="Take a photo"
              className={`w-32 h-32 rounded-full flex flex-col items-center justify-center gap-1 shadow-xl transition-all active:scale-95 ${
                canCapture
                  ? "bg-[#2d6a4f] hover:bg-[#1b4332] text-white"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              <span className="text-4xl">📷</span>
              <span className="text-xs font-semibold tracking-wide">TAP TO SCORE</span>
            </button>
          )}

          {/* No place selected — contextual hint */}
          {!selectedPlace && places.length > 0 && status === "idle" && (
            <p className="text-sm text-gray-500 text-center">
              {hasGps ? "📍 Place will be auto-detected from GPS." : "Select a place above to start."}
            </p>
          )}
          {!selectedPlace && places.length === 0 && status === "idle" && (
            <p className="text-sm text-gray-500 text-center">
              {hasGps
                ? "📍 GPS detected. Tap to score — your place will be created automatically."
                : "Create a place above, then tap to score."}
            </p>
          )}

          {/* Error */}
          {errorMsg && (
            <div className="w-full max-w-sm rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 text-center">
              {errorMsg}
            </div>
          )}
        </section>

        {/* Score result */}
        {status === "done" && score && (
          <section
            className={`rounded-2xl border p-4 shadow-sm ${scoreBg(score.score_value)}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  YardScore
                </p>
                <p className={`text-5xl font-black leading-none ${scoreColor(score.score_value)}`}>
                  {Math.round(score.score_value)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Coverage {(score.coverage * 100).toFixed(0)}% · Confidence{" "}
                  {(score.confidence * 100).toFixed(0)}%
                </p>
              </div>
              <button
                onClick={reset}
                className="text-sm bg-white border border-gray-300 hover:border-[#2d6a4f] text-gray-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                Score another
              </button>
            </div>

            {score.positives.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-green-700 mb-1">What&apos;s working</p>
                <ul className="text-sm text-gray-700 space-y-0.5">
                  {score.positives.map((p, i) => (
                    <li key={i}>✓ {p}</li>
                  ))}
                </ul>
              </div>
            )}

            {score.negatives.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-red-700 mb-1">To improve</p>
                <ul className="text-sm text-gray-700 space-y-0.5">
                  {score.negatives.map((n, i) => (
                    <li key={i}>✗ {n}</li>
                  ))}
                </ul>
              </div>
            )}

            {score.recommendations.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#2d6a4f] mb-1">Next steps</p>
                <ul className="text-sm text-gray-700 space-y-0.5">
                  {score.recommendations.map((r, i) => (
                    <li key={i}>→ {r}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
