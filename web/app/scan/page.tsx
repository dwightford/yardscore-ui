"use client";

/**
 * /scan — continuous observation with AI classification
 *
 * Flow:
 *   1. User taps "Start Scan" — GPS + camera activated
 *   2. Camera captures frames every 3s (auto) + on tap (manual)
 *   3. Each frame uploaded to server + sent to /vision/classify
 *   4. AI labels float as overlays on the camera view
 *   5. User taps "End Scan" — summary with score
 *
 * The AI runs on the homelab (Ollama + Llama 3.2 Vision).
 * Classification is non-blocking — user keeps walking.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Observation {
  id: string;
  category: string;
  count: number;
  layer: string | null;
  label: string;
  species: string | null;
  confidence: number;
  size: string | null;
  native_status: string | null;
  notes: string | null;
  timestamp: number;
  lat: number | null;
  lng: number | null;
}

interface LiveCounts {
  trees: number;
  shrubs: number;
  herbs: number;
  ground_cover: number;
}

type ScanStatus = "idle" | "starting" | "scanning" | "stopping" | "done" | "error";

interface ScanState {
  status: ScanStatus;
  sessionId: string | null;
  landUnitId: string | null;
  coords: { lat: number; lng: number } | null;
  liveCounts: LiveCounts;
  frameCount: number;
  error: string | null;
  startTime: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeScore(counts: LiveCounts, obs: Observation[]): number {
  let score = 20; // base

  // Layer presence (up to 25 points)
  const layers = new Set(obs.map(o => o.layer).filter(Boolean));
  score += Math.min(layers.size * 5, 25);

  // Canopy trees (up to 20 points)
  score += Math.min(counts.trees * 3, 20);

  // Shrub layer (up to 10 points)
  score += Math.min(counts.shrubs * 3, 10);

  // Herb + ground cover (up to 10 points)
  score += Math.min((counts.herbs + counts.ground_cover) * 3, 10);

  // Native bonus / invasive penalty (up to ±15 points)
  for (const o of obs) {
    if (o.native_status === "native") score += 2 * o.count;
    else if (o.native_status === "invasive") score -= 3 * o.count;
  }

  // Species diversity bonus (up to 10 points)
  const species = new Set(obs.filter(o => o.species).map(o => o.species));
  score += Math.min(species.size * 2, 10);

  return Math.max(0, Math.min(100, score));
}

function scoreRating(v: number): string {
  if (v >= 80) return "Excellent";
  if (v >= 60) return "Good";
  if (v >= 40) return "Fair";
  return "Needs Work";
}

function scoreBarColor(v: number): string {
  if (v >= 80) return "bg-lime-400";
  if (v >= 60) return "bg-lime-300";
  if (v >= 40) return "bg-yellow-400";
  return "bg-red-400";
}

async function captureFrameFromVideo(video: HTMLVideoElement): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.7);
  });
}

/**
 * Measure average brightness from a video frame (0-255).
 * Samples every 20th pixel for performance.
 * Returns brightness 0-255 and a human label.
 */
function measureBrightness(video: HTMLVideoElement): { value: number; label: string; color: string } {
  const canvas = document.createElement("canvas");
  canvas.width = 160; // small for speed
  canvas.height = 120;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { value: 0, label: "Unknown", color: "text-zinc-500" };
  ctx.drawImage(video, 0, 0, 160, 120);
  const data = ctx.getImageData(0, 0, 160, 120).data;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 80) { // sample every 20th pixel (4 channels × 20)
    sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
    count++;
  }
  const avg = Math.round(sum / count);
  if (avg > 180) return { value: avg, label: "Full Sun", color: "text-yellow-300" };
  if (avg > 120) return { value: avg, label: "Part Sun", color: "text-lime-300" };
  if (avg > 70) return { value: avg, label: "Part Shade", color: "text-green-400" };
  return { value: avg, label: "Full Shade", color: "text-blue-300" };
}

function elapsed(startTime: number): string {
  const s = Math.floor((Date.now() - startTime) / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ScanPage() {
  const { data: session } = useSession();
  const tokenRef = useRef<string | undefined>(undefined);
  // Keep token in a ref so capture callbacks always have the latest
  useEffect(() => { tokenRef.current = (session as any)?.apiToken; }, [session]);

  const [state, setState] = useState<ScanState>({
    status: "idle",
    sessionId: null,
    landUnitId: null,
    coords: null,
    liveCounts: { trees: 0, shrubs: 0, herbs: 0, ground_cover: 0 },
    frameCount: 0,
    error: null,
    startTime: null,
  });

  const [observations, setObservations] = useState<Observation[]>([]);
  const [latestLabel, setLatestLabel] = useState<string | null>(null);
  const [latestSpecies, setLatestSpecies] = useState<string | null>(null);
  const [latestEntityId, setLatestEntityId] = useState<string | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionText, setCorrectionText] = useState("");
  const [alternatives, setAlternatives] = useState<{ name: string; common: string; score: number }[]>([]);
  const [classifying, setClassifying] = useState(false);
  const [elapsedStr, setElapsedStr] = useState("0:00");
  const [lightLabel, setLightLabel] = useState("");
  const [lightColor, setLightColor] = useState("text-zinc-500");

  // Multi-shot identification state
  const [shotCount, setShotCount] = useState(0);
  const shotBufferRef = useRef<Blob[]>([]);
  const shotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uploadingRef = useRef(false);
  const classifyingRef = useRef(false);
  const classifyQueueRef = useRef<Blob[]>([]);
  const headingRef = useRef<number | null>(null);
  const pitchRef = useRef<number | null>(null);
  const [gpsSignal, setGpsSignal] = useState<"strong" | "weak" | "none">("none");

  // ── Cleanup on unmount ──────────────────────────────────────────────────────

  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const heading = (e as any).webkitCompassHeading ?? (e.alpha != null ? (360 - e.alpha) % 360 : null);
      if (heading != null) headingRef.current = Math.round(heading);
      // Pitch: beta is the front-to-back tilt (0=flat, 90=vertical, negative=tilted back)
      if (e.beta != null) pitchRef.current = Math.round(e.beta);
    };
    window.addEventListener("deviceorientation", handleOrientation, true);

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation, true);
      stopCamera();
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Camera control ──────────────────────────────────────────────────────────

  async function startCamera(): Promise<boolean> {
    // Check if camera API is available
    if (!navigator.mediaDevices?.getUserMedia) {
      setState((s) => ({
        ...s, status: "error",
        error: "Camera not available. Make sure you're using HTTPS and a supported browser.",
      }));
      return false;
    }

    // Check permission state if available
    try {
      const permResult = await navigator.permissions?.query({ name: "camera" as PermissionName });
      if (permResult?.state === "denied") {
        setState((s) => ({
          ...s, status: "error",
          error: "Camera permission was denied. On iPhone: Settings → Safari → Camera → Allow. Then reload this page.",
        }));
        return false;
      }
    } catch {
      // permissions API not available on all browsers — proceed to getUserMedia
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      return true;
    } catch (err: unknown) {
      const name = err instanceof DOMException ? err.name : "";
      let msg = "Camera access denied.";
      if (name === "NotAllowedError") {
        msg = "Camera permission denied. On iPhone: tap the AA in the URL bar → Website Settings → Camera → Allow. Then reload.";
      } else if (name === "NotFoundError") {
        msg = "No camera found on this device.";
      } else if (name === "NotReadableError") {
        msg = "Camera is in use by another app. Close other camera apps and try again.";
      }
      setState((s) => ({ ...s, status: "error", error: msg }));
      return false;
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  // ── GPS ─────────────────────────────────────────────────────────────────────

  function getGps(): Promise<{ lat: number; lng: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsSignal(pos.coords.accuracy < 20 ? "strong" : "weak");
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => { setGpsSignal("none"); resolve(null); },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  // ── Start Scan ──────────────────────────────────────────────────────────────

  const startScan = useCallback(async () => {
    setState((s) => ({ ...s, status: "starting", error: null }));

    // Request compass permission (iOS)
    try {
      const DOE = DeviceOrientationEvent as any;
      if (typeof DOE.requestPermission === "function") {
        await DOE.requestPermission();
      }
    } catch { /* Android/desktop */ }

    // GPS
    const coords = await getGps();

    // Camera
    const cameraOk = await startCamera();
    if (!cameraOk) {
      setState((s) => ({ ...s, status: "error", error: "Camera access denied." }));
      return;
    }

    // Resolve land unit from GPS
    let landUnitId: string | null = null;
    if (coords) {
      try {
        const r = await apiFetch(tokenRef.current, `${API}/places/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: coords.lat, lon: coords.lng }),
        });
        if (r.ok) landUnitId = (await r.json()).land_unit_id;
      } catch { /* fall through */ }
    }

    if (!landUnitId) {
      try {
        const r = await apiFetch(tokenRef.current, `${API}/land_units`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Scan Location", land_unit_type: "yard" }),
        });
        if (r.ok) landUnitId = (await r.json()).id;
      } catch { /* fall through */ }
    }

    if (!landUnitId) {
      stopCamera();
      setState((s) => ({ ...s, status: "error", error: "Could not create location." }));
      return;
    }

    // Open session
    let sessionId: string | null = null;
    try {
      const r = await apiFetch(tokenRef.current, `${API}/observation_sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          land_unit_id: landUnitId,
          capture_mode: "scan",
          device_context: coords ? { lat: coords.lat, lng: coords.lng, source: "gps" } : null,
        }),
      });
      if (!r.ok) throw new Error("Failed");
      sessionId = (await r.json()).id;
    } catch {
      stopCamera();
      setState((s) => ({ ...s, status: "error", error: "Could not start scan." }));
      return;
    }

    const now = Date.now();
    setState((s) => ({
      ...s,
      status: "scanning",
      sessionId,
      landUnitId,
      coords,
      liveCounts: { trees: 0, shrubs: 0, herbs: 0, ground_cover: 0 },
      frameCount: 0,
      error: null,
      startTime: now,
    }));
    setObservations([]);

    // Frame capture every 3s
    intervalRef.current = setInterval(() => {
      captureFrame(sessionId!, coords);
    }, 3000);

    // Elapsed timer
    timerRef.current = setInterval(() => {
      setElapsedStr(elapsed(now));
    }, 1000);
  }, []);

  // ── Capture frame (fast, never blocks) ──────────────────────────────────────

  async function captureFrame(
    sessionId: string,
    initialCoords: { lat: number; lng: number } | null
  ) {
    if (!videoRef.current || uploadingRef.current) return;
    uploadingRef.current = true;

    try {
      const blob = await captureFrameFromVideo(videoRef.current);
      if (!blob) return;

      const coords = await getGps() || initialCoords;

      // Measure light conditions from current frame
      const light = measureBrightness(videoRef.current);
      setLightLabel(light.label);
      setLightColor(light.color);

      // Upload frame to session (fast, ~0.5s)
      const fd = new FormData();
      fd.append("file", blob, `frame_${Date.now()}.jpg`);
      if (coords) {
        fd.append("device_lat", String(coords.lat));
        fd.append("device_lng", String(coords.lng));
      }
      if (headingRef.current != null) {
        fd.append("compass_heading", String(headingRef.current));
      }
      // Include light measurement as notes metadata
      fd.append("notes", `light:${light.value}:${light.label}`);

      apiFetch(tokenRef.current, `${API}/observation_sessions/${sessionId}/frames`, {
        method: "POST",
        body: fd,
      }).then((r) => {
        if (r.ok) setState((prev) => ({ ...prev, frameCount: prev.frameCount + 1 }));
      }).catch(() => {});

      // Auto-capture does NOT classify — classification is manual tap only
    } catch {
      // Frame capture failed
    } finally {
      uploadingRef.current = false;
    }
  }

  // ── Multi-shot: collect frames then identify ─────────────────────────────────

  function collectShot() {
    if (!videoRef.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;
      shotBufferRef.current.push(blob);
      setShotCount(shotBufferRef.current.length);

      // Clear existing auto-submit timer
      if (shotTimerRef.current) clearTimeout(shotTimerRef.current);

      // Auto-submit after 4 seconds of no new taps (or if 5 shots collected)
      if (shotBufferRef.current.length >= 5) {
        submitMultiShot();
      } else {
        shotTimerRef.current = setTimeout(() => {
          submitMultiShot();
        }, 4000);
      }
    }, "image/jpeg", 0.85);

    if (navigator.vibrate) navigator.vibrate(30);
  }

  function submitMultiShot() {
    if (shotTimerRef.current) clearTimeout(shotTimerRef.current);
    const blobs = [...shotBufferRef.current];
    shotBufferRef.current = [];
    setShotCount(0);
    if (blobs.length > 0) {
      identifyPlant(blobs, state.coords);
    }
  }

  // ── Identify plant via PlantNet API (supports 1-5 images) ──────────────────

  async function identifyPlant(
    blobs: Blob[],
    coords: { lat: number; lng: number } | null,
  ) {
    classifyingRef.current = true;
    setClassifying(true);

    try {
      const fd = new FormData();
      if (blobs.length === 1) {
        // Single shot — backward compatible
        fd.append("file", blobs[0], `identify_${Date.now()}.jpg`);
      } else {
        // Multi-shot — send indexed files
        blobs.forEach((blob, i) => {
          fd.append(`file_${i}`, blob, `identify_${i}_${Date.now()}.jpg`);
          fd.append(`organ_${i}`, "auto");
        });
      }

      const r = await fetch("/plantnet-proxy", { method: "POST", body: fd });

      if (r.ok) {
        const data = await r.json();
        const plantResults = (data.results || []).slice(0, 5);

        // Store alternatives for display
        setAlternatives(
          plantResults.slice(1, 4).map((pr: any) => ({
            name: pr.species?.scientificNameWithoutAuthor || "Unknown",
            common: pr.species?.commonNames?.[0] || "",
            score: pr.score || 0,
          }))
        );

        if (plantResults.length > 0) {
          const best = plantResults[0];
          const species = best.species?.scientificNameWithoutAuthor || "Unknown";
          const commonName = best.species?.commonNames?.[0] || "";
          const family = best.species?.family?.scientificNameWithoutAuthor || "";
          const genus = best.species?.genus?.scientificNameWithoutAuthor || "";
          const score = best.score || 0;

          // Determine category from family/genus
          // (rough heuristic — trees vs shrubs vs herbs)
          let category = "herb";
          const treeFamilies = ["Fagaceae", "Aceraceae", "Sapindaceae", "Pinaceae", "Betulaceae", "Juglandaceae", "Ulmaceae", "Platanaceae", "Oleaceae", "Magnoliaceae", "Cornaceae"];
          const shrubFamilies = ["Rosaceae", "Ericaceae", "Caprifoliaceae", "Hydrangeaceae", "Berberidaceae", "Buxaceae"];
          if (treeFamilies.includes(family)) category = "tree";
          else if (shrubFamilies.includes(family)) category = "shrub";

          const obs: Observation = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            category,
            count: 1,
            layer: category === "tree" ? "canopy" : category === "shrub" ? "understory" : "ground",
            label: commonName || species,
            species,
            confidence: score,
            size: null,
            native_status: null,
            notes: `Family: ${family}, Genus: ${genus}`,
            timestamp: Date.now(),
            lat: coords?.lat ?? null,
            lng: coords?.lng ?? null,
          };

          setObservations((prev) => [...prev, obs]);

          // Create entity on backend so it appears on the map
          if (coords && state.landUnitId) {
            apiFetch(tokenRef.current, `${API}/entities/match`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                land_unit_id: state.landUnitId,
                lat: coords.lat,
                lng: coords.lng,
                heading: headingRef.current,
                pitch: pitchRef.current,
                entity_type: category,
                size_class: null,
                species,
              }),
            })
              .then((r) => r.ok ? r.json() : null)
              .then((data) => {
                if (data?.entity?.id) setLatestEntityId(data.entity.id);
              })
              .catch(() => {});
          }

          setState((prev) => {
            const counts = { ...prev.liveCounts };
            if (category === "tree") counts.trees += 1;
            else if (category === "shrub") counts.shrubs += 1;
            else if (category === "herb") counts.herbs += 1;
            else counts.ground_cover += 1;
            return { ...prev, liveCounts: counts };
          });

          // Show label with confirm/correct options
          const parts: string[] = [];
          parts.push(commonName || species);
          if (commonName && species !== commonName) parts.push(`\n${species}`);
          parts.push(`\n${family} · ${(score * 100).toFixed(0)}%`);
          setLatestLabel(parts.join(" "));
          setLatestSpecies(species);
          setShowCorrection(false);
          setCorrectionText("");
          // Auto-dismiss after 10s (longer to allow correction)
          setTimeout(() => {
            setLatestLabel((current) => {
              // Only auto-dismiss if user hasn't opened the correction flow
              if (current === parts.join(" ")) return null;
              return current;
            });
          }, 10000);
        }
      }
    } catch {
      // Classification failed — frame was still saved
    } finally {
      classifyingRef.current = false;
      setClassifying(false);
    }
  }

  // ── Correction handlers ─────────────────────────────────────────────────────

  function confirmIdentification() {
    setLatestLabel(null);
    setLatestSpecies(null);
    setShowCorrection(false);
    if (navigator.vibrate) navigator.vibrate(30);
  }

  function submitCorrection() {
    if (!correctionText.trim()) return;
    // Store correction via feedback endpoint
    apiFetch(tokenRef.current, `${API}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "wrong_id",
        predicted_species: latestSpecies,
        corrected_species: correctionText.trim(),
        entity_id: latestEntityId,
        land_unit_id: state.landUnitId,
        context: {
          lat: state.coords?.lat,
          lng: state.coords?.lng,
          heading: headingRef.current,
          pitch: pitchRef.current,
        },
      }),
    }).catch(() => {});

    setLatestLabel(null);
    setLatestSpecies(null);
    setShowCorrection(false);
    setCorrectionText("");
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
  }

  // ── Manual capture (tap) ────────────────────────────────────────────────────

  const manualCapture = useCallback(async () => {
    if (state.sessionId && state.status === "scanning") {
      // Capture frame + upload to session
      captureFrame(state.sessionId, state.coords);

      // Collect shot for multi-shot identification
      // (if not already mid-classification — allow adding more shots during collection)
      if (!classifyingRef.current) {
        collectShot();
      }
    }
  }, [state.sessionId, state.status, state.coords]);

  // ── End Scan ────────────────────────────────────────────────────────────────

  const endScan = useCallback(async () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    stopCamera();

    setState((s) => ({ ...s, status: "stopping" }));

    const { sessionId } = state;
    if (!sessionId) {
      setState((s) => ({ ...s, status: "error", error: "No active session." }));
      return;
    }

    try {
      await apiFetch(tokenRef.current, `${API}/observation_sessions/${sessionId}/finalize`, { method: "PATCH" });
    } catch { /* frames are saved regardless */ }

    setState((s) => ({ ...s, status: "done" }));
  }, [state.sessionId]);

  // ── Reset ───────────────────────────────────────────────────────────────────

  function reset() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    stopCamera();
    setState({
      status: "idle",
      sessionId: null,
      landUnitId: null,
      coords: null,
      liveCounts: { trees: 0, shrubs: 0, herbs: 0, ground_cover: 0 },
      frameCount: 0,
      error: null,
      startTime: null,
    });
    setObservations([]);
    setLatestLabel(null);
    setElapsedStr("0:00");
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const { status, liveCounts, frameCount, error } = state;
  const score = computeScore(liveCounts, observations);
  const isScanning = status === "scanning";

  return (
    <div className="min-h-screen bg-[#07110c] flex flex-col relative">
      {/* Camera preview — full screen background */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: isScanning || status === "starting" ? "block" : "none" }}
      />

      {/* ── IDLE STATE ──────────────────────────────────────────────────────── */}
      {status === "idle" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6 bg-[#07110c]">
          <header className="text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-lime-300/10 border border-lime-300/20 flex items-center justify-center mb-4">
              <svg viewBox="0 0 24 24" className="w-8 h-8 text-lime-300" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 22c-4-4-8-7.5-8-12a8 8 0 0 1 16 0c0 4.5-4 8-8 12Z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">YardScore</h1>
            <p className="text-sm text-zinc-400 mt-2">Walk your yard. AI identifies what grows.</p>
          </header>

          <button
            onClick={startScan}
            className="w-40 h-40 rounded-full bg-lime-300 hover:bg-lime-200 text-zinc-950 shadow-2xl shadow-lime-300/20 flex flex-col items-center justify-center gap-2 transition-all active:scale-95"
          >
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
            <span className="text-sm font-bold tracking-wide">START SCAN</span>
          </button>

          <p className="text-xs text-zinc-500 text-center max-w-xs leading-relaxed">
            Point your camera at trees and vegetation. Walk naturally — AI classifies what it sees every few seconds.
          </p>
        </div>
      )}

      {/* ── STARTING STATE ──────────────────────────────────────────────────── */}
      {status === "starting" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-black/80 relative z-10">
          <div className="w-14 h-14 border-4 border-lime-300 border-t-transparent rounded-full animate-spin" />
          <p className="text-white text-sm font-semibold">Starting scan...</p>
          <p className="text-zinc-500 text-xs">Requesting camera and GPS</p>
        </div>
      )}

      {/* ── SCANNING HUD ───────────────────────────────────────────────────── */}
      {isScanning && (
        <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">

          {/* Top bar: recording indicator + stats */}
          <div className="pointer-events-auto pt-14 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md rounded-full px-3 py-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white text-xs font-semibold">{elapsedStr}</span>
              </div>
              <div className="flex items-center gap-3 bg-black/50 backdrop-blur-md rounded-full px-3 py-1.5">
                <span className="text-zinc-400 text-xs">{frameCount} saved</span>
                {headingRef.current != null && (
                  <span className="text-zinc-500 text-[10px] font-mono">{headingRef.current}°</span>
                )}
                <div className={`w-2 h-2 rounded-full ${
                  gpsSignal === "strong" ? "bg-lime-400" : gpsSignal === "weak" ? "bg-yellow-400" : "bg-red-400"
                }`} />
              </div>
            </div>
          </div>

          {/* Light indicator */}
          {lightLabel && (
            <div className="px-4 mt-1">
              <div className="flex items-center justify-center">
                <div className="bg-black/40 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    lightLabel === "Full Sun" ? "bg-yellow-300" :
                    lightLabel === "Part Sun" ? "bg-lime-300" :
                    lightLabel === "Part Shade" ? "bg-green-400" : "bg-blue-400"
                  }`} />
                  <span className={`text-xs font-medium ${lightColor}`}>{lightLabel}</span>
                </div>
              </div>
            </div>
          )}

          {/* AI label overlay — floats in center with confirm/correct buttons */}
          <div className="flex-1 flex items-center justify-center pointer-events-auto">
            {latestLabel && !showCorrection && (
              <div className="bg-black/70 backdrop-blur-md rounded-2xl px-6 py-4 border border-lime-300/40 shadow-lg shadow-lime-300/10 mx-8 max-w-xs">
                <p className="text-lime-300 text-xl font-bold text-center whitespace-pre-line">{latestLabel}</p>

                {/* Alternative IDs with confidence */}
                {alternatives.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {alternatives.map((alt, i) => (
                      <div key={i} className="flex items-center justify-between text-[10px]">
                        <span className="text-zinc-400">{alt.common || alt.name}</span>
                        <span className="text-zinc-500 font-mono">{(alt.score * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-center gap-3 mt-3">
                  <button
                    onClick={confirmIdentification}
                    className="flex items-center gap-1.5 bg-lime-300/20 border border-lime-300/40 text-lime-300 px-4 py-2 rounded-full text-xs font-semibold active:scale-95"
                  >
                    ✓ Correct
                  </button>
                  <button
                    onClick={() => setShowCorrection(true)}
                    className="flex items-center gap-1.5 bg-red-500/20 border border-red-500/40 text-red-300 px-4 py-2 rounded-full text-xs font-semibold active:scale-95"
                  >
                    ✗ Wrong
                  </button>
                </div>
              </div>
            )}
            {latestLabel && showCorrection && (
              <div className="bg-black/80 backdrop-blur-md rounded-2xl px-5 py-4 border border-red-500/40 shadow-lg mx-6 max-w-xs w-full">
                <p className="text-red-300 text-xs font-semibold mb-1">Wrong ID — what is this plant?</p>
                <p className="text-zinc-500 text-[10px] mb-2">PlantNet said: {latestSpecies}</p>
                <input
                  type="text"
                  value={correctionText}
                  onChange={(e) => setCorrectionText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitCorrection()}
                  placeholder="e.g. Red Maple, or just 'maple'"
                  autoFocus
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-400/50"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={submitCorrection}
                    disabled={!correctionText.trim()}
                    className="flex-1 bg-red-500/30 border border-red-500/40 text-red-200 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40 active:scale-95"
                  >
                    Submit Correction
                  </button>
                  <button
                    onClick={() => { setShowCorrection(false); setLatestLabel(null); }}
                    className="bg-white/10 text-zinc-400 px-3 py-2 rounded-lg text-xs active:scale-95"
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}
            {!latestLabel && classifying && (
              <div className="bg-black/40 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-lime-300 border-t-transparent rounded-full animate-spin" />
                  <p className="text-zinc-300 text-sm">Identifying...</p>
                </div>
              </div>
            )}
          </div>

          {/* Counters — above the fixed bottom controls */}
          <div className="px-4 mb-36 flex items-end justify-between">
            <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md rounded-xl px-3 py-2">
              <span className="text-lime-300 text-lg">🌳</span>
              <span className="text-white text-xl font-bold">{liveCounts.trees}</span>
            </div>
            {liveCounts.shrubs > 0 && (
              <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md rounded-xl px-3 py-2">
                <span className="text-lime-300 text-lg">🌿</span>
                <span className="text-white text-xl font-bold">{liveCounts.shrubs}</span>
              </div>
            )}
          </div>

          {/* Bottom: capture button + end scan — FIXED to viewport bottom */}
          <div className="pointer-events-auto fixed bottom-0 left-0 right-0 px-4 pb-8 pt-2 z-20" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}>
            {/* Identify button — large, always reachable. Shows shot count during multi-shot. */}
            <div className="flex items-center justify-center mb-4">
              <div className="relative">
                <button
                  onClick={manualCapture}
                  className={`w-20 h-20 rounded-full backdrop-blur-md border-4 flex flex-col items-center justify-center active:scale-90 transition-transform shadow-xl ${
                    shotCount > 0
                      ? "bg-yellow-300/90 border-yellow-200/80 shadow-yellow-300/20"
                      : "bg-lime-300/90 border-white/80 shadow-lime-300/20"
                  }`}
                >
                  {shotCount > 0 ? (
                    <>
                      <span className="text-2xl font-bold text-zinc-900">{shotCount}</span>
                      <span className="text-[7px] font-bold text-zinc-700 uppercase">more ↑</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-8 h-8 text-zinc-900" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 22c-4-4-8-7.5-8-12a8 8 0 0 1 16 0c0 4.5-4 8-8 12Z" />
                      </svg>
                      <span className="text-[8px] font-bold text-zinc-900 uppercase tracking-wider mt-0.5">ID</span>
                    </>
                  )}
                </button>

                {/* Multi-shot hint + submit button */}
                {shotCount > 0 && (
                  <>
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/60 backdrop-blur-sm rounded-full px-3 py-1">
                    <span className="text-[9px] text-zinc-300">Tap more: bark, leaves, flowers</span>
                  </div>
                  <button
                    onClick={submitMultiShot}
                    className="absolute -right-16 top-1/2 -translate-y-1/2 px-3 py-2 bg-lime-300 text-zinc-900 text-[10px] font-bold rounded-full active:scale-95"
                  >
                    ID Now
                  </button>
                  </>
                )}
              </div>
            </div>

            {/* End scan + stats */}
            <div className="flex items-center justify-between">
              <button
                onClick={endScan}
                className="px-5 py-2.5 bg-red-500/80 backdrop-blur-md text-white text-sm font-semibold rounded-full active:scale-95 transition-transform"
              >
                ■ End Scan
              </button>
              <div className="text-right">
                <p className="text-white/60 text-xs">{observations.length} identified</p>
                <p className="text-zinc-500 text-[10px]">{frameCount} frames</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STOPPING STATE ──────────────────────────────────────────────────── */}
      {status === "stopping" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#07110c]">
          <div className="w-14 h-14 border-4 border-lime-300 border-t-transparent rounded-full animate-spin" />
          <p className="text-white text-sm font-semibold">Finalizing scan...</p>
          <p className="text-zinc-500 text-xs">{frameCount} frames · {observations.length} observations</p>
        </div>
      )}

      {/* ── DONE STATE — Census Report ──────────────────────────────────────── */}
      {status === "done" && (() => {
        const censusObs = observations.map(o => ({
          species: o.species,
          label: o.label,
          category: o.category,
          confidence: o.confidence,
          lat: o.lat,
          lng: o.lng,
        }));
        const durationMin = state.startTime ? Math.round((Date.now() - state.startTime) / 60000) : undefined;

        // Dynamic import would be cleaner but for immediate use:
        const { generateCensusReport } = require("@/lib/census-report");
        const report = generateCensusReport(censusObs, durationMin);

        const statusEmoji: Record<string, string> = { strong: "✓", moderate: "○", weak: "△", absent: "✗" };
        const statusColor: Record<string, string> = { strong: "text-lime-300", moderate: "text-yellow-300", weak: "text-orange-400", absent: "text-red-400" };

        return (
        <div className="flex-1 flex flex-col bg-[#07110c] overflow-y-auto">
          <div className="px-5 pt-14 pb-8">
            {/* Header */}
            <div className="text-center mb-6">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Property Ecological Census</p>
              <p className="text-sm text-zinc-400 mt-1">{elapsedStr} · {frameCount} frames · {observations.length} identified</p>
            </div>

            {/* Score + headline stats */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">YardScore</p>
                  <p className="text-4xl font-bold text-white">{report.censusScore}</p>
                  <p className="text-xs text-zinc-400">{scoreRating(report.censusScore)}</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-xs text-zinc-400">{report.totalSpecies} species</p>
                  <p className={`text-sm font-bold ${report.nativePercent >= 80 ? "text-lime-300" : report.nativePercent >= 50 ? "text-yellow-300" : "text-red-400"}`}>
                    {report.nativePercent}% native
                  </p>
                  {report.invasiveCount > 0 && (
                    <p className="text-xs text-red-400">{report.invasiveCount} invasive</p>
                  )}
                </div>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${scoreBarColor(report.censusScore)}`}
                  style={{ width: `${Math.min(report.censusScore, 100)}%` }}
                />
              </div>
            </div>

            {/* Census prose summary */}
            <div className="rounded-2xl border border-lime-300/20 bg-lime-300/5 p-4 mb-4">
              <p className="text-sm text-zinc-200 leading-relaxed">{report.summaryProse}</p>
            </div>

            {/* Wildlife estimate */}
            {report.wildlifeSpeciesEstimate > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-4 text-center">
                <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Wildlife Supported</p>
                <p className="text-3xl font-bold text-lime-300">{report.wildlifeSpeciesEstimate}</p>
                <p className="text-xs text-zinc-400 mt-1">moth & butterfly species hosted by your native plants</p>
              </div>
            )}

            {/* Layer analysis */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Ecosystem Layers</h3>
                <span className="text-xs text-zinc-500">{report.layerCompleteness}/4 present</span>
              </div>
              {(["canopy", "understory", "shrub", "ground_cover"] as const).map((layer) => {
                const l = report.layers[layer];
                const names = { canopy: "Canopy", understory: "Understory", shrub: "Shrub", ground_cover: "Ground Cover" };
                return (
                  <div key={layer} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${statusColor[l.status]}`}>{statusEmoji[l.status]}</span>
                      <span className="text-sm text-zinc-300">{names[layer]}</span>
                    </div>
                    <span className="text-xs text-zinc-500">
                      {l.count} plants · {l.species} species · {l.status}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Species list with native/invasive badges */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-4">
              <h3 className="text-sm font-semibold text-white mb-3">Species Census</h3>

              {/* Invasives first (if any) */}
              {report.invasiveList.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] text-red-400 uppercase tracking-widest mb-1.5">Invasive — Remove</p>
                  {report.invasiveList.map((s: any) => (
                    <div key={s.scientificName} className="flex items-center justify-between py-1 pl-2 border-l-2 border-red-500/50">
                      <div>
                        <span className="text-xs text-red-300">{s.commonName}</span>
                        <span className="text-[10px] text-red-400/60 ml-1 italic">{s.scientificName}</span>
                      </div>
                      <span className="text-xs text-red-400 font-bold">×{s.count}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Natives */}
              {report.nativeList.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] text-lime-400 uppercase tracking-widest mb-1.5">Native</p>
                  {report.nativeList.map((s: any) => (
                    <div key={s.scientificName} className="flex items-center justify-between py-1 pl-2 border-l-2 border-lime-500/30">
                      <div>
                        <span className="text-xs text-zinc-300">{s.commonName}</span>
                        <span className="text-[10px] text-zinc-500 ml-1 italic">{s.scientificName}</span>
                        {s.wildlifeValue > 50 && <span className="text-[9px] text-lime-400 ml-1">★ keystone</span>}
                      </div>
                      <span className="text-xs text-zinc-400">×{s.count}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Unknown/ornamental */}
              {report.speciesList.filter((s: any) => s.status === "ornamental" || s.status === "unknown").length > 0 && (
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">Other / Unclassified</p>
                  {report.speciesList.filter((s: any) => s.status === "ornamental" || s.status === "unknown").map((s: any) => (
                    <div key={s.scientificName} className="flex items-center justify-between py-1 pl-2 border-l-2 border-zinc-700">
                      <div>
                        <span className="text-xs text-zinc-400">{s.commonName}</span>
                        <span className="text-[10px] text-zinc-600 ml-1 italic">{s.scientificName}</span>
                      </div>
                      <span className="text-xs text-zinc-500">×{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recommendations */}
            {report.recommendations.length > 0 && (
              <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 mb-4">
                <h3 className="text-sm font-semibold text-white mb-3">Recommendations</h3>
                {report.recommendations.map((rec: any, i: number) => (
                  <div key={i} className="mb-3 last:mb-0">
                    <div className="flex items-start gap-2">
                      <span className={`text-xs mt-0.5 ${rec.priority === "high" ? "text-red-400" : rec.priority === "medium" ? "text-yellow-400" : "text-zinc-400"}`}>
                        {rec.priority === "high" ? "▲" : rec.priority === "medium" ? "●" : "○"}
                      </span>
                      <div>
                        <p className="text-xs text-zinc-200">{rec.action}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{rec.reason}</p>
                        {rec.species_suggestions && (
                          <div className="mt-1.5 space-y-1">
                            {rec.species_suggestions.map((sp: string, j: number) => {
                              const name = sp.split(" (")[0]; // "Quercus alba (White Oak)" → "Quercus alba"
                              const searchQuery = encodeURIComponent(name + " native plant");
                              return (
                                <div key={j} className="flex items-center gap-2">
                                  <span className="text-[10px] text-lime-400">{sp}</span>
                                  <a
                                    href={`https://www.etsy.com/search?q=${searchQuery}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[9px] text-zinc-500 underline hover:text-lime-300"
                                  >
                                    Etsy
                                  </a>
                                  <a
                                    href={`https://www.naturehills.com/search?q=${encodeURIComponent(name)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[9px] text-zinc-500 underline hover:text-lime-300"
                                  >
                                    Nature Hills
                                  </a>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Scan stats */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-6">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-white">{frameCount}</p>
                  <p className="text-[10px] text-zinc-500">Frames</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{observations.length}</p>
                  <p className="text-[10px] text-zinc-500">Identified</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{report.totalSpecies}</p>
                  <p className="text-[10px] text-zinc-500">Species</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{elapsedStr}</p>
                  <p className="text-[10px] text-zinc-500">Duration</p>
                </div>
              </div>
            </div>

            {/* Share */}
            {state.landUnitId && (
              <button
                onClick={() => {
                  const url = `${window.location.origin}/share?id=${state.landUnitId}`;
                  if (navigator.share) {
                    navigator.share({ title: "My YardScore Census", text: `${report.totalSpecies} species, ${report.nativePercent}% native, ${report.wildlifeSpeciesEstimate} wildlife species supported`, url });
                  } else {
                    navigator.clipboard.writeText(url);
                    alert("Link copied!");
                  }
                }}
                className="w-full py-3.5 bg-white/10 border border-lime-300/30 text-lime-300 font-semibold rounded-2xl text-sm mb-3"
              >
                Share Census Report
              </button>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <a
                href="/dashboard"
                className="block w-full py-3.5 bg-lime-300 text-zinc-950 font-bold rounded-2xl text-sm text-center transition-colors hover:bg-lime-200"
              >
                Go to Dashboard
              </a>
              <a
                href="/map"
                className="block w-full py-3.5 bg-white/10 border border-white/10 text-white font-semibold rounded-2xl text-sm text-center transition-colors hover:bg-white/20"
              >
                View on Map
              </a>
              <button
                onClick={reset}
                className="w-full py-3.5 bg-white/10 border border-white/10 text-white font-medium rounded-2xl text-sm transition-colors hover:bg-white/20"
              >
                Scan Again
              </button>
            </div>

            {/* Attribution */}
            <p className="text-center text-[9px] text-zinc-700 mt-6">
              Powered by Pl@ntNet · Wildlife data from Doug Tallamy&apos;s research
            </p>
          </div>
        </div>
        );
      })()}

      {/* ── ERROR STATE ─────────────────────────────────────────────────────── */}
      {status === "error" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 bg-[#07110c]">
          <div className="w-full max-w-sm rounded-2xl bg-red-500/10 border border-red-500/20 p-5 text-center">
            <p className="text-sm text-red-300">{error}</p>
          </div>
          <button
            onClick={reset}
            className="px-8 py-3 bg-lime-300 text-zinc-950 font-semibold rounded-2xl text-sm transition-colors hover:bg-lime-200"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
