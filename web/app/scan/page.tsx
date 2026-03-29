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

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Observation {
  id: string;
  category: string;
  label: string;
  species: string | null;
  confidence: number;
  size: string | null;
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
  let score = 30; // base
  score += Math.min(counts.trees * 5, 30);
  score += Math.min(counts.shrubs * 4, 15);
  score += Math.min(counts.herbs * 3, 10);
  score += counts.ground_cover > 0 ? 5 : 0;
  // Diversity bonus
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

function elapsed(startTime: number): string {
  const s = Math.floor((Date.now() - startTime) / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ScanPage() {
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
  const [classifying, setClassifying] = useState(false);
  const [elapsedStr, setElapsedStr] = useState("0:00");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uploadingRef = useRef(false);
  const classifyingRef = useRef(false);
  const classifyQueueRef = useRef<Blob[]>([]);
  const headingRef = useRef<number | null>(null);
  const [gpsSignal, setGpsSignal] = useState<"strong" | "weak" | "none">("none");

  // ── Cleanup on unmount ──────────────────────────────────────────────────────

  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const heading = (e as any).webkitCompassHeading ?? (e.alpha != null ? (360 - e.alpha) % 360 : null);
      if (heading != null) headingRef.current = Math.round(heading);
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
    } catch {
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
        const r = await fetch(`${API}/places/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: coords.lat, lon: coords.lng }),
        });
        if (r.ok) landUnitId = (await r.json()).land_unit_id;
      } catch { /* fall through */ }
    }

    if (!landUnitId) {
      try {
        const r = await fetch(`${API}/land_units`, {
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
      const r = await fetch(`${API}/observation_sessions`, {
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

      fetch(`${API}/observation_sessions/${sessionId}/frames`, {
        method: "POST",
        body: fd,
      }).then((r) => {
        if (r.ok) setState((prev) => ({ ...prev, frameCount: prev.frameCount + 1 }));
      }).catch(() => {});

      // Queue for classification (don't await — runs in background)
      if (!classifyingRef.current) {
        classifyInBackground(blob, coords);
      }
      // else: skip classification for this frame, GPU is busy
    } catch {
      // Frame capture failed
    } finally {
      uploadingRef.current = false;
    }
  }

  // ── Classify in background (slow, ~10-80s, never blocks capture) ───────────

  async function classifyInBackground(
    blob: Blob,
    coords: { lat: number; lng: number } | null,
  ) {
    classifyingRef.current = true;
    setClassifying(true);

    try {
      const classifyFd = new FormData();
      classifyFd.append("file", blob, `classify_${Date.now()}.jpg`);

      const r = await fetch(`${API}/vision/classify`, {
        method: "POST",
        body: classifyFd,
      });

      if (r.ok) {
        const data = await r.json();
        if (data.observations && data.observations.length > 0) {
          const newObs: Observation[] = data.observations.map((obs: any) => ({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            category: obs.category,
            label: obs.label,
            species: obs.species,
            confidence: obs.confidence,
            size: obs.size,
            notes: obs.notes,
            timestamp: Date.now(),
            lat: coords?.lat ?? null,
            lng: coords?.lng ?? null,
          }));

          setObservations((prev) => [...prev, ...newObs]);

          // Update counts
          setState((prev) => {
            const counts = { ...prev.liveCounts };
            for (const obs of newObs) {
              if (obs.category === "tree") counts.trees++;
              else if (obs.category === "shrub") counts.shrubs++;
              else if (obs.category === "herb") counts.herbs++;
              else if (obs.category === "ground_cover") counts.ground_cover++;
            }
            return { ...prev, liveCounts: counts };
          });

          // Show latest label with details
          const best = newObs.reduce((a, b) => a.confidence > b.confidence ? a : b);
          const labelParts = [best.label];
          if (best.size) labelParts.push(`· ${best.size}`);
          if (best.species) labelParts.push(`\n${best.species}`);
          setLatestLabel(labelParts.join(" "));
          setTimeout(() => setLatestLabel(null), 5000);
        }
      }
    } catch {
      // Classification failed — frame was still saved
    } finally {
      classifyingRef.current = false;
      setClassifying(false);
    }
  }

  // ── Manual capture (tap) ────────────────────────────────────────────────────

  const manualCapture = useCallback(() => {
    if (state.sessionId && state.status === "scanning") {
      captureFrame(state.sessionId, state.coords);
      if (navigator.vibrate) navigator.vibrate(50);
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
      await fetch(`${API}/observation_sessions/${sessionId}/finalize`, { method: "PATCH" });
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

          {/* AI label overlay — floats in center when classification returns */}
          <div className="flex-1 flex items-center justify-center">
            {latestLabel && (
              <div className="bg-black/70 backdrop-blur-md rounded-2xl px-6 py-4 border border-lime-300/40 shadow-lg shadow-lime-300/10 mx-8">
                <p className="text-lime-300 text-xl font-bold text-center whitespace-pre-line">{latestLabel}</p>
              </div>
            )}
            {!latestLabel && classifying && (
              <div className="bg-black/40 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-lime-300 border-t-transparent rounded-full animate-spin" />
                  <p className="text-zinc-300 text-sm">Identifying vegetation...</p>
                </div>
              </div>
            )}
          </div>

          {/* Counters — bottom corners */}
          <div className="px-4 mb-2 flex items-end justify-between">
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

          {/* Bottom: capture button + end scan */}
          <div className="pointer-events-auto px-4 pb-8">
            {/* Capture button */}
            <div className="flex items-center justify-center mb-4">
              <button
                onClick={manualCapture}
                className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border-4 border-white/60 flex items-center justify-center active:scale-90 transition-transform"
              >
                <div className="w-12 h-12 rounded-full bg-white" />
              </button>
            </div>

            {/* End scan */}
            <div className="flex items-center justify-between">
              <button
                onClick={endScan}
                className="px-5 py-2.5 bg-red-500/80 backdrop-blur-md text-white text-sm font-semibold rounded-full active:scale-95 transition-transform"
              >
                ■ End Scan
              </button>
              <div className="text-right">
                <p className="text-white/60 text-xs">Score: {score}</p>
                <p className="text-zinc-500 text-[10px]">{observations.length} observations</p>
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

      {/* ── DONE STATE — Score Summary ──────────────────────────────────────── */}
      {status === "done" && (
        <div className="flex-1 flex flex-col bg-[#07110c] overflow-y-auto">
          <div className="px-5 pt-14 pb-8">
            {/* Header */}
            <div className="text-center mb-8">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Scan Complete</p>
              <p className="text-sm text-zinc-400 mt-1">{elapsedStr} · {frameCount} frames</p>
            </div>

            {/* Score card */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-6">
              <div className="text-center mb-4">
                <p className="text-xs text-zinc-400 uppercase tracking-widest mb-2">YardScore</p>
                <p className="text-5xl font-bold text-white">{score}</p>
                <p className="text-sm text-zinc-400 mt-1">{scoreRating(score)}</p>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${scoreBarColor(score)}`}
                  style={{ width: `${Math.min(score, 100)}%` }}
                />
              </div>
            </div>

            {/* Observation breakdown */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 mb-6">
              <h3 className="text-sm font-semibold text-white mb-4">Observations</h3>

              {liveCounts.trees > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-zinc-300">🌳 Trees</span>
                    <span className="text-sm font-bold text-white">{liveCounts.trees}</span>
                  </div>
                  {/* Species breakdown */}
                  {(() => {
                    const treeObs = observations.filter(o => o.category === "tree");
                    const byLabel = new Map<string, number>();
                    treeObs.forEach(o => byLabel.set(o.label, (byLabel.get(o.label) || 0) + 1));
                    return Array.from(byLabel.entries()).map(([label, count]) => (
                      <div key={label} className="flex items-center justify-between pl-6 py-0.5">
                        <span className="text-xs text-zinc-400">{label}</span>
                        <span className="text-xs text-zinc-500">{count}</span>
                      </div>
                    ));
                  })()}
                </div>
              )}

              {liveCounts.shrubs > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-zinc-300">🌿 Shrubs</span>
                    <span className="text-sm font-bold text-white">{liveCounts.shrubs}</span>
                  </div>
                  {(() => {
                    const shrubObs = observations.filter(o => o.category === "shrub");
                    const byLabel = new Map<string, number>();
                    shrubObs.forEach(o => byLabel.set(o.label, (byLabel.get(o.label) || 0) + 1));
                    return Array.from(byLabel.entries()).map(([label, count]) => (
                      <div key={label} className="flex items-center justify-between pl-6 py-0.5">
                        <span className="text-xs text-zinc-400">{label}</span>
                        <span className="text-xs text-zinc-500">{count}</span>
                      </div>
                    ));
                  })()}
                </div>
              )}

              {liveCounts.herbs > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300">🌱 Herbs</span>
                  <span className="text-sm font-bold text-white">{liveCounts.herbs}</span>
                </div>
              )}

              {liveCounts.ground_cover > 0 && (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-zinc-300">🍂 Ground Cover</span>
                  <span className="text-sm font-bold text-white">{liveCounts.ground_cover}</span>
                </div>
              )}
            </div>

            {/* Scan stats */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 mb-6">
              <h3 className="text-sm font-semibold text-white mb-3">Scan Stats</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-zinc-500">Frames</p>
                  <p className="text-lg font-bold text-white">{frameCount}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Observations</p>
                  <p className="text-lg font-bold text-white">{observations.length}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Duration</p>
                  <p className="text-lg font-bold text-white">{elapsedStr}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Species Found</p>
                  <p className="text-lg font-bold text-white">
                    {new Set(observations.filter(o => o.species).map(o => o.species)).size}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <a
                href="/map"
                className="block w-full py-3.5 bg-white/10 border border-white/10 text-white font-semibold rounded-2xl text-sm text-center transition-colors hover:bg-white/20"
              >
                📍 View on Map
              </a>
              <button
                onClick={reset}
                className="w-full py-3.5 bg-lime-300 text-zinc-950 font-bold rounded-2xl text-sm transition-colors hover:bg-lime-200"
              >
                Scan Again
              </button>
            </div>
          </div>
        </div>
      )}

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
