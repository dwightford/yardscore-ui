"use client";

/**
 * /scan — continuous observation HUD (canonical mobile capture)
 *
 * Interaction model: Start Scan → Observe → End Scan
 *
 * No required text input before observation begins.
 * No place naming before scanning.
 * No multi-step wizard.
 * No manual submit per frame.
 *
 * Flow:
 *   1. User taps "Start Scan"
 *      - GPS requested (user gesture)
 *      - Land unit resolved from GPS or created with defaults
 *      - ObservationSession opened with capture_mode="scan"
 *   2. During scan:
 *      - Camera preview via getUserMedia
 *      - Timer-based frame capture every ~3s
 *      - Each frame POSTed to /observation_sessions/{id}/frames
 *      - Live broad-category counts updated from feature extraction
 *      - Provisional planted score updated
 *   3. User taps "End Scan"
 *      - Session finalized
 *      - Final score fetched
 *      - Summary displayed
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  loadModel,
  isModelLoaded,
  detectFromVideo,
  type DetectionResult,
} from "../lib/yolo-detect";
import {
  loadSam,
  isSamLoaded,
  isSamLoading,
  segmentAtPoint,
} from "../lib/sam-segment";
import NavBar from "../components/NavBar";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScoreResult {
  score_value: number;
  confidence: number;
  coverage: number;
  positives: string[];
  negatives: string[];
  recommendations: string[];
}

interface LiveCounts {
  trees: number;
  shrubs: number;
  groundCover: number;
  flowers: number;
}

type ScanStatus = "idle" | "starting" | "scanning" | "stopping" | "done" | "error";

interface ScanState {
  status: ScanStatus;
  sessionId: string | null;
  landUnitId: string | null;
  coords: { lat: number; lng: number } | null;
  liveCounts: LiveCounts;
  provisionalScore: number | null;
  frameCount: number;
  error: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(v: number): string {
  if (v >= 75) return "text-green-400";
  if (v >= 50) return "text-yellow-400";
  return "text-red-400";
}

function scoreBg(v: number): string {
  if (v >= 75) return "bg-green-50 border-green-200";
  if (v >= 50) return "bg-yellow-50 border-yellow-200";
  return "bg-red-50 border-red-200";
}

function scoreColorFull(v: number): string {
  if (v >= 75) return "text-green-700";
  if (v >= 50) return "text-yellow-700";
  return "text-red-700";
}

async function pollScore(landUnitId: string, signal: AbortSignal): Promise<ScoreResult | null> {
  const start = Date.now();
  while (Date.now() - start < 15_000) {
    if (signal.aborted) return null;
    try {
      const r = await fetch(`${API}/yardscore/${landUnitId}/latest`, { signal });
      if (r.ok) {
        const body = await r.json();
        if (body.score_value !== undefined) return body as ScoreResult;
      }
    } catch {
      // network blip or abort
    }
    await new Promise((res) => setTimeout(res, 1000));
  }
  return null;
}

/** Map backend feature names to HUD categories */
function updateCountsFromFeatures(
  prev: LiveCounts,
  features: Array<{ feature_name: string; value: number }>
): LiveCounts {
  const next = { ...prev };
  for (const f of features) {
    if (f.feature_name === "tree_canopy" && f.value > 0.3) next.trees += 1;
    if (f.feature_name === "diverse_planting" && f.value > 0.3) next.shrubs += 1;
    if (f.feature_name === "lawn_dominant" && f.value > 0.3) next.groundCover += 1;
    if (f.feature_name === "flowers" && f.value > 0.3) next.flowers += 1;
  }
  return next;
}

/** Estimate provisional score from live counts */
function estimateProvisionalScore(counts: LiveCounts, frameCount: number): number | null {
  if (frameCount === 0) return null;
  // Simple heuristic: base 50, +points for diversity, -points for monoculture
  let score = 50;
  score += Math.min(counts.trees * 5, 20);
  score += Math.min(counts.flowers * 4, 15);
  score += Math.min(counts.shrubs * 3, 10);
  // Ground cover (lawn) is a slight negative if dominant
  if (counts.groundCover > counts.trees + counts.flowers + counts.shrubs) {
    score -= 10;
  }
  return Math.max(0, Math.min(100, score));
}

// ── Capture helpers ───────────────────────────────────────────────────────────

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

// ── Main component ────────────────────────────────────────────────────────────

export default function ScanPage() {
  const [state, setState] = useState<ScanState>({
    status: "idle",
    sessionId: null,
    landUnitId: null,
    coords: null,
    liveCounts: { trees: 0, shrubs: 0, groundCover: 0, flowers: 0 },
    provisionalScore: null,
    frameCount: 0,
    error: null,
  });

  const [finalScore, setFinalScore] = useState<ScoreResult | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Guard against concurrent frame uploads
  const uploadingRef = useRef(false);
  // YOLO local detection
  const [modelReady, setModelReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const detectionLoopRef = useRef<number | null>(null);
  const detectingRef = useRef(false);
  const [inferenceMs, setInferenceMs] = useState<number | null>(null);
  const [lastDetection, setLastDetection] = useState<DetectionResult | null>(null);
  // Training data: tap-to-label annotations
  // Training data: tap-to-label annotations
  const [annotations, setAnnotations] = useState<Array<{
    timestamp: number;
    label: string;
    size: "large" | "medium" | "small" | "area";
    frameDataUrl: string | null;
  }>>([]);
  const [labelFeedback, setLabelFeedback] = useState<string | null>(null);
  // Device orientation (compass + pitch + roll)
  const headingRef = useRef<number | null>(null);
  const pitchRef = useRef<number | null>(null);
  const rollRef = useRef<number | null>(null);
  // GPS breadcrumb trail
  const [gpsTrail, setGpsTrail] = useState<Array<{ lat: number; lng: number; time: number }>>([]);
  // SAM segmentation mask overlay
  const [maskOverlay, setMaskOverlay] = useState<string | null>(null);
  const [segmenting, setSegmenting] = useState(false);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────

  useEffect(() => {
    // Listen for device compass heading
    const handleOrientation = (e: DeviceOrientationEvent) => {
      // Compass heading: webkitCompassHeading for iOS, alpha for Android
      const heading = (e as any).webkitCompassHeading ?? (e.alpha != null ? (360 - e.alpha) % 360 : null);
      if (heading != null) headingRef.current = Math.round(heading);
      // Pitch: beta (0=vertical, 90=flat, negative=tilted back)
      if (e.beta != null) pitchRef.current = Math.round(e.beta);
      // Roll: gamma (-90 to 90)
      if (e.gamma != null) rollRef.current = Math.round(e.gamma);
    };
    window.addEventListener("deviceorientation", handleOrientation, true);

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation, true);
      stopCamera();
      stopDetectionLoop();
      if (intervalRef.current) clearInterval(intervalRef.current);
      abortRef.current?.abort();
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
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  // ── GPS ─────────────────────────────────────────────────────────────────────

  function getGps(): Promise<{ lat: number; lng: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  // ── Start Scan ──────────────────────────────────────────────────────────────

  const startScan = useCallback(async () => {
    setState((s) => ({ ...s, status: "starting", error: null }));

    // 0. Request compass permission (iOS requires user gesture)
    try {
      const DOE = DeviceOrientationEvent as any;
      if (typeof DOE.requestPermission === "function") {
        const perm = await DOE.requestPermission();
        if (perm === "granted") {
          console.log("Compass permission granted");
        }
      }
    } catch {
      // Android or desktop — no permission needed
    }

    // 0b. Load YOLO model (if not already loaded)
    if (!isModelLoaded()) {
      setModelLoading(true);
      await loadModel();
      setModelLoading(false);
      setModelReady(isModelLoaded());
    }

    // 1. Request GPS (user gesture)
    const coords = await getGps();

    // 2. Start camera
    const cameraOk = await startCamera();
    if (!cameraOk) {
      setState((s) => ({
        ...s,
        status: "error",
        error: "Camera access denied. Please allow camera permissions and try again.",
      }));
      return;
    }

    // 3. Resolve or create land unit from GPS
    let landUnitId: string | null = null;
    if (coords) {
      try {
        const r = await fetch(`${API}/places/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: coords.lat, lon: coords.lng }),
        });
        if (r.ok) {
          const body = await r.json();
          landUnitId = body.land_unit_id;
        }
      } catch {
        // GPS resolve failed — fall through to default creation
      }
    }

    // Fallback: create a default land unit if GPS resolution failed
    if (!landUnitId) {
      try {
        const r = await fetch(`${API}/land_units`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Scan Location", land_unit_type: "yard" }),
        });
        if (r.ok) {
          const body = await r.json();
          landUnitId = body.id;
        }
      } catch {
        // fall through
      }
    }

    if (!landUnitId) {
      stopCamera();
      setState((s) => ({
        ...s,
        status: "error",
        error: "Could not create a location. Check network connection.",
      }));
      return;
    }

    // 4. Open ObservationSession with capture_mode="scan"
    let sessionId: string | null = null;
    try {
      const r = await fetch(`${API}/observation_sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          land_unit_id: landUnitId,
          capture_mode: "scan",
          device_context: coords
            ? { lat: coords.lat, lng: coords.lng, source: "gps" }
            : null,
        }),
      });
      if (!r.ok) throw new Error("Failed to create session");
      const body = await r.json();
      sessionId = body.id;
    } catch {
      stopCamera();
      setState((s) => ({
        ...s,
        status: "error",
        error: "Could not start scan session. Try again.",
      }));
      return;
    }

    setState((s) => ({
      ...s,
      status: "scanning",
      sessionId,
      landUnitId,
      coords,
      liveCounts: { trees: 0, shrubs: 0, groundCover: 0, flowers: 0 },
      provisionalScore: null,
      frameCount: 0,
      error: null,
    }));

    // 5. Start frame capture interval (every 3 seconds) for server persistence
    intervalRef.current = setInterval(() => {
      captureAndUploadFrame(sessionId!, landUnitId!, coords);
    }, 3000);

    // 6. Start local YOLO detection loop for real-time HUD
    startDetectionLoop();
  }, []);

  // ── Frame capture + upload ──────────────────────────────────────────────────

  async function captureAndUploadFrame(
    sessionId: string,
    landUnitId: string,
    coords: { lat: number; lng: number } | null
  ) {
    if (!videoRef.current || uploadingRef.current) return;
    uploadingRef.current = true;

    try {
      const blob = await captureFrameFromVideo(videoRef.current);
      if (!blob) return;

      const fd = new FormData();
      fd.append("file", blob, `scan_frame_${Date.now()}.jpg`);
      if (coords) {
        fd.append("device_lat", String(coords.lat));
        fd.append("device_lng", String(coords.lng));
      }
      if (headingRef.current != null) {
        fd.append("compass_heading", String(headingRef.current));
      }

      const r = await fetch(`${API}/observation_sessions/${sessionId}/frames`, {
        method: "POST",
        body: fd,
      });

      if (r.ok) {
        // Frame uploaded for server-side persistence + scoring
        setState((prev) => ({
          ...prev,
          frameCount: prev.frameCount + 1,
        }));
        // Collect GPS breadcrumb for walking path
        if (coords) {
          setGpsTrail((prev) => [...prev, { lat: coords.lat, lng: coords.lng, time: Date.now() }]);
        }
      }
    } catch {
      // Network error on a single frame — don't crash the scan
    } finally {
      uploadingRef.current = false;
    }
  }

  // ── Hybrid detection loop (YOLO + color-ratio) ─────────────────────────

  /** Analyze vegetation from video frame using color ratios */
  function analyzeVegetation(video: HTMLVideoElement): { trees: number; shrubs: number; groundCover: number; flowers: number } {
    const canvas = document.createElement("canvas");
    const size = 80;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { trees: 0, shrubs: 0, groundCover: 0, flowers: 0 };

    ctx.drawImage(video, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;
    const total = size * size;

    let darkGreen = 0, lawnGreen = 0, flowerPixels = 0;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      const rgGap = g - r, gbGap = g - b, bright = r + g + b;

      if (rgGap > 15 && gbGap > 15) {
        if (bright > 320) lawnGreen++;
        else darkGreen++;
      } else if ((r > 160 && r > g + 50) || (b > 160 && b > g + 30 && r < 160)) {
        flowerPixels++;
      }
    }

    // Estimate counts from pixel ratios
    const darkRatio = darkGreen / total;
    const lawnRatio = lawnGreen / total;
    const flowerRatio = flowerPixels / total;

    return {
      trees: darkRatio > 0.15 ? Math.max(1, Math.round(darkRatio * 20)) : darkRatio > 0.05 ? 1 : 0,
      shrubs: (darkRatio > 0.03 && lawnRatio > 0.03) ? Math.max(1, Math.round((darkRatio + lawnRatio) * 5)) : 0,
      groundCover: lawnRatio > 0.1 ? 1 : 0,
      flowers: flowerRatio > 0.02 ? Math.max(1, Math.round(flowerRatio * 15)) : 0,
    };
  }

  /** Start the hybrid detection loop */
  function startDetectionLoop() {
    if (detectionLoopRef.current) return;

    const runDetection = async () => {
      if (!videoRef.current || detectingRef.current) {
        detectionLoopRef.current = requestAnimationFrame(runDetection);
        return;
      }

      detectingRef.current = true;
      const start = performance.now();

      try {
        // Always run color-ratio (fast, works for vegetation)
        const vegCounts = analyzeVegetation(videoRef.current);

        // Run YOLO if model is loaded (adds objects: cars, people, structures)
        let yoloCounts = { tree: 0, shrub: 0, flower: 0, structure: 0, vehicle: 0, person: 0, animal: 0, furniture: 0, other: 0 };
        let yoloTreeSizes = { large: 0, medium: 0, small: 0 };

        if (isModelLoaded()) {
          const result = await detectFromVideo(videoRef.current);
          if (result) {
            setLastDetection(result);
            yoloCounts = result.counts;
            yoloTreeSizes = result.treeSizes;
          }
        }

        // Merge: color-ratio for vegetation, YOLO for objects
        // Take the higher count between color-ratio and YOLO for trees/shrubs
        const mergedCounts = {
          trees: Math.max(vegCounts.trees, yoloCounts.tree),
          shrubs: Math.max(vegCounts.shrubs, yoloCounts.shrub),
          groundCover: vegCounts.groundCover,
          flowers: Math.max(vegCounts.flowers, yoloCounts.flower),
        };

        setInferenceMs(performance.now() - start);

        setState((prev) => ({
          ...prev,
          liveCounts: mergedCounts,
          provisionalScore: estimateProvisionalScore(mergedCounts, prev.frameCount > 0 ? prev.frameCount : 1),
        }));
      } catch {
        // Detection error — skip this frame
      } finally {
        detectingRef.current = false;
      }

      // Throttle to ~300ms between detections
      setTimeout(() => {
        detectionLoopRef.current = requestAnimationFrame(runDetection);
      }, 300);
    };

    detectionLoopRef.current = requestAnimationFrame(runDetection);
  }

  function stopDetectionLoop() {
    if (detectionLoopRef.current) {
      cancelAnimationFrame(detectionLoopRef.current);
      detectionLoopRef.current = null;
    }
  }

  // ── Tap-to-label (training data collection) ───────────────────────────

  /** Capture current frame with a user label + SAM segmentation for training data */
  async function captureLabel(label: string, size: "large" | "medium" | "small" | "area") {
    if (!videoRef.current) return;

    // Capture frame as data URL
    const vw = videoRef.current.videoWidth || 640;
    const vh = videoRef.current.videoHeight || 480;
    const canvas = document.createElement("canvas");
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const frameDataUrl = canvas.toDataURL("image/jpeg", 0.8);

    // Show immediate feedback
    setLabelFeedback(`${size} ${label} tagged!`);

    // Run SAM segmentation on center of frame (where user is pointing)
    setSegmenting(true);
    let maskData: { maskDataUrl: string; maskArea: number } | null = null;

    // Load SAM on first use
    if (!isSamLoaded() && !isSamLoading()) {
      setLabelFeedback("Loading segmentation model...");
      await loadSam();
    }

    if (isSamLoaded() && videoRef.current) {
      setLabelFeedback("Segmenting...");
      try {
        maskData = await segmentAtPoint(videoRef.current, vw / 2, vh / 2);
      } catch (e) {
        console.error("SAM segmentation error:", e);
      }
      if (maskData) {
        // Show golden outline mask overlay for 4 seconds
        setMaskOverlay(maskData.maskDataUrl);
        setTimeout(() => setMaskOverlay(null), 4000);
        setLabelFeedback(`${size} ${label} — ${(maskData.maskArea * 100).toFixed(0)}% of frame`);
      } else {
        setLabelFeedback(`${size} ${label} tagged!`);
      }
    } else if (!isSamLoaded()) {
      console.log("SAM not loaded — skipping segmentation");
    }
    setSegmenting(false);

    // Entity matching: find or create persistent entity
    // Get FRESH GPS at tap time (not session-start GPS) for better positioning
    let entityLabel: string | null = null;
    let entityObsCount = 0;
    const freshCoords = await getGps() || state.coords;
    if (state.landUnitId && freshCoords) {
      try {
        const matchRes = await fetch(`${API}/entities/match`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            land_unit_id: state.landUnitId,
            lat: freshCoords.lat,
            lng: freshCoords.lng,
            heading: headingRef.current,
            pitch: pitchRef.current,
            roll: rollRef.current,
            entity_type: label,
            size_class: size === "area" ? null : size,
          }),
        });
        if (matchRes.ok) {
          const match = await matchRes.json();
          if (match.entity) {
            entityLabel = match.entity.label;
            entityObsCount = match.entity.observation_count;
            if (match.created) {
              setLabelFeedback(`New ${label} tagged! (${entityLabel})`);
            } else {
              setLabelFeedback(`${entityLabel} — observed ${entityObsCount} times`);
            }
          }
        }
      } catch {
        // Entity matching failed — non-critical, continue
      }
    }

    if (!entityLabel) {
      // Fallback if entity matching didn't work
      if (maskData) {
        setLabelFeedback(`${size} ${label} — ${(maskData.maskArea * 100).toFixed(0)}% of frame`);
      } else {
        setLabelFeedback(`${size} ${label} tagged!`);
      }
    }
    setTimeout(() => setLabelFeedback(null), 3000);

    const annotation = {
      timestamp: Date.now(),
      label,
      size,
      frameDataUrl,
    };

    setAnnotations((prev) => [...prev, annotation]);

    // Upload annotation to server if session is active
    if (state.sessionId) {
      const blob = dataUrlToBlob(frameDataUrl);
      if (blob) {
        const fd = new FormData();
        fd.append("file", blob, `label_${label}_${size}_${Date.now()}.jpg`);
        fd.append("annotation_label", label);
        fd.append("annotation_size", size);
        fd.append("annotation_source", "user_tap");
        if (state.coords) {
          fd.append("device_lat", String(state.coords.lat));
          fd.append("device_lng", String(state.coords.lng));
        }
        if (headingRef.current != null) {
          fd.append("compass_heading", String(headingRef.current));
        }
        // Fire-and-forget upload
        fetch(`${API}/observation_sessions/${state.sessionId}/frames`, {
          method: "POST",
          body: fd,
        }).catch(() => {});
      }
    }
  }

  function dataUrlToBlob(dataUrl: string): Blob | null {
    try {
      const parts = dataUrl.split(",");
      const mime = parts[0].match(/:(.*?);/)?.[1] || "image/jpeg";
      const raw = atob(parts[1]);
      const arr = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
      return new Blob([arr], { type: mime });
    } catch {
      return null;
    }
  }

  // ── End Scan ────────────────────────────────────────────────────────────────

  const endScan = useCallback(async () => {
    // Stop frame capture and detection
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    stopDetectionLoop();
    stopCamera();

    setState((s) => ({ ...s, status: "stopping" }));

    const { sessionId, landUnitId } = state;
    if (!sessionId || !landUnitId) {
      setState((s) => ({ ...s, status: "error", error: "No active session." }));
      return;
    }

    // Finalize session
    try {
      await fetch(`${API}/observation_sessions/${sessionId}/finalize`, {
        method: "PATCH",
      });
    } catch {
      setState((s) => ({
        ...s,
        status: "error",
        error: "Could not finalize session. Your frames were saved.",
      }));
      return;
    }

    // Poll for final score
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const result = await pollScore(landUnitId, ctrl.signal);
    abortRef.current = null;

    if (result) {
      setFinalScore(result);
      setState((s) => ({ ...s, status: "done" }));
    } else {
      setState((s) => ({
        ...s,
        status: "error",
        error: "Score timed out. Your session was saved — score will be available shortly.",
      }));
    }
  }, [state.sessionId, state.landUnitId]);

  // ── Reset ───────────────────────────────────────────────────────────────────

  function reset() {
    abortRef.current?.abort();
    if (intervalRef.current) clearInterval(intervalRef.current);
    stopCamera();
    setState({
      status: "idle",
      sessionId: null,
      landUnitId: null,
      coords: null,
      liveCounts: { trees: 0, shrubs: 0, groundCover: 0, flowers: 0 },
      provisionalScore: null,
      frameCount: 0,
      error: null,
    });
    setFinalScore(null);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const { status, liveCounts, provisionalScore, frameCount, error } = state;

  // ── Helpers for ui1.png HUD ────────────────────────────────────────────────

  const totalTrees = liveCounts.trees;
  // Approximate size breakdown from total (will be real with YOLO later)
  const treeLarge = Math.floor(totalTrees * 0.4);
  const treeMedium = Math.floor(totalTrees * 0.3);
  const treeSmall = totalTrees - treeLarge - treeMedium;

  function scoreRating(v: number): string {
    if (v >= 80) return "Excellent";
    if (v >= 60) return "Good";
    if (v >= 40) return "Fair";
    return "Needs Work";
  }

  function scoreBarColor(v: number): string {
    if (v >= 80) return "bg-green-500";
    if (v >= 60) return "bg-green-400";
    if (v >= 40) return "bg-yellow-400";
    return "bg-red-400";
  }
  const isScanning = status === "scanning";

  return (
    <div className="min-h-screen bg-black flex flex-col relative">
      {/* Camera preview — full screen background */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: isScanning || status === "starting" ? "block" : "none" }}
      />

      {/* SAM segmentation mask overlay */}
      {maskOverlay && isScanning && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={maskOverlay}
          alt=""
          className="absolute inset-0 w-full h-full object-cover z-[5] pointer-events-none animate-pulse"
          style={{ mixBlendMode: "screen" }}
        />
      )}

      {/* ── IDLE STATE ──────────────────────────────────────────────────────── */}
      {status === "idle" && (
        <div className="flex-1 flex flex-col bg-[#f0f7f4]">
          <NavBar active="/scan" />
          <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6">
            <header className="text-center">
              <svg viewBox="0 0 44 44" className="mx-auto h-16 w-16 mb-4" aria-label="YardScore">
                <rect width="44" height="44" rx="9" fill="#2d6a4f"/>
                <path d="M14 11 L22 21 L30 11" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="22" y1="21" x2="22" y2="29" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="13" y1="33" x2="31" y2="33" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <h1 className="text-3xl font-black text-[#2d6a4f] tracking-tight">YardScore</h1>
              <p className="text-sm text-gray-500 mt-2">Scan your yard. See what grows.</p>
            </header>

            <button
              onClick={startScan}
              className="w-44 h-44 rounded-full bg-[#2d6a4f] hover:bg-[#1b4332] text-white shadow-2xl flex flex-col items-center justify-center gap-3 transition-all active:scale-95 border-4 border-[#52b788]/30"
            >
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
              <span className="text-sm font-bold tracking-wide">START SCAN</span>
            </button>

            <p className="text-xs text-gray-400 text-center max-w-xs leading-relaxed">
              Point your camera at your yard and walk around. YardScore detects trees, shrubs, and ground cover automatically.
            </p>
          </div>
        </div>
      )}

      {/* ── STARTING STATE ──────────────────────────────────────────────────── */}
      {status === "starting" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-black/80 relative z-10">
          <div className="w-14 h-14 border-4 border-[#52b788] border-t-transparent rounded-full animate-spin" />
          <p className="text-white text-sm font-semibold">
            {modelLoading ? "Loading detection model..." : "Starting scan..."}
          </p>
          <p className="text-white/50 text-xs">
            {modelLoading ? "First load downloads ~12MB" : "Requesting camera and GPS"}
          </p>
        </div>
      )}

      {/* ── SCANNING HUD — ui1.png style ──────────────────────────────────── */}
      {isScanning && (
        <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">

          {/* Top: Hero tree count */}
          <div className="pointer-events-auto pt-12 pb-4 text-center">
            <div className="inline-flex items-center gap-3 bg-black/40 backdrop-blur-md rounded-full px-5 py-1.5 mb-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white/80 text-xs font-semibold tracking-wide">
                  {frameCount} saved
                </span>
              </div>
              {inferenceMs !== null && (
                <span className="text-white/40 text-[10px] font-mono">
                  {Math.round(1000 / inferenceMs)}fps
                </span>
              )}
              {headingRef.current != null && (
                <span className="text-white/40 text-[10px] font-mono">
                  {headingRef.current}°
                </span>
              )}
              {gpsTrail.length > 0 && (
                <span className="text-white/40 text-[10px] font-mono">
                  {gpsTrail.length}pts
                </span>
              )}
            </div>
            <h2 className="text-3xl font-black text-white drop-shadow-lg">
              {totalTrees} Trees Detected
            </h2>
            <p className="text-white/60 text-xs mt-1">
              Confidence: {frameCount < 3 ? "Low" : frameCount < 8 ? "Medium" : "High"}
            </p>
          </div>

          {/* Middle: Tappable floating circular badges (ui1.png layout) */}
          {/* Tapping a badge labels the current frame for training data */}
          <div className="flex-1 relative">
            {/* Label feedback toast */}
            {labelFeedback && (
              <div className="absolute top-[45%] left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                <div className="bg-[#2d6a4f] text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg animate-bounce">
                  {labelFeedback}
                </div>
              </div>
            )}

            {/* Large — top left */}
            <div className="absolute top-[10%] left-[12%] pointer-events-auto">
              <button
                onClick={() => captureLabel("tree", "large")}
                className="w-20 h-20 rounded-full border-2 border-[#52b788] bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center shadow-lg active:scale-110 active:border-white transition-transform"
              >
                <span className="text-2xl font-black text-white">{treeLarge}</span>
                <span className="text-[10px] font-semibold text-[#52b788] uppercase tracking-wider">Large</span>
              </button>
            </div>
            {/* Medium — top right */}
            <div className="absolute top-[8%] right-[12%] pointer-events-auto">
              <button
                onClick={() => captureLabel("tree", "medium")}
                className="w-20 h-20 rounded-full border-2 border-[#52b788] bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center shadow-lg active:scale-110 active:border-white transition-transform"
              >
                <span className="text-2xl font-black text-white">{treeMedium}</span>
                <span className="text-[10px] font-semibold text-[#52b788] uppercase tracking-wider">Medium</span>
              </button>
            </div>
            {/* Small — bottom left */}
            <div className="absolute bottom-[25%] left-[10%] pointer-events-auto">
              <button
                onClick={() => captureLabel("tree", "small")}
                className="w-20 h-20 rounded-full border-2 border-[#52b788] bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center shadow-lg active:scale-110 active:border-white transition-transform"
              >
                <span className="text-2xl font-black text-white">{treeSmall}</span>
                <span className="text-[10px] font-semibold text-[#52b788] uppercase tracking-wider">Small</span>
              </button>
            </div>
            {/* Shrub Areas — bottom right */}
            <div className="absolute bottom-[22%] right-[10%] pointer-events-auto">
              <button
                onClick={() => captureLabel("shrub", "area")}
                className="w-20 h-20 rounded-full border-2 border-emerald-400 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center shadow-lg active:scale-110 active:border-white transition-transform"
              >
                <span className="text-2xl font-black text-white">{liveCounts.shrubs}</span>
                <span className="text-[9px] font-semibold text-emerald-400 uppercase tracking-wider leading-tight text-center">Shrub<br/>Areas</span>
              </button>
            </div>
          </div>

          {/* Bottom: Frosted score card */}
          <div className="pointer-events-auto mx-3 mb-4">
            <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/50">
              {/* Score row */}
              {provisionalScore !== null && (
                <div className="mb-3">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-bold text-[#2d6a4f]">YardScore:</span>
                      <span className="text-2xl font-black text-[#2d6a4f]">{Math.round(provisionalScore)}</span>
                      <span className="text-green-600 text-sm">&#x2714;</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-500">{scoreRating(provisionalScore)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${scoreBarColor(provisionalScore)}`}
                      style={{ width: `${Math.min(provisionalScore, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Quick insights */}
              <div className="space-y-1 text-sm text-gray-700">
                {liveCounts.trees > 0 && (
                  <p><span className="text-[#2d6a4f]">&bull;</span> Strong canopy</p>
                )}
                {liveCounts.shrubs > 0 && liveCounts.flowers > 0 && (
                  <p><span className="text-[#2d6a4f]">&bull;</span> Mixed plant beds</p>
                )}
                {liveCounts.groundCover > liveCounts.trees && liveCounts.trees > 0 && (
                  <p><span className="text-[#52b788]">&rarr;</span> Enhance groundcover habitat</p>
                )}
                {liveCounts.trees === 0 && frameCount > 2 && (
                  <p><span className="text-[#52b788]">&rarr;</span> Point camera toward trees</p>
                )}
              </div>

              {/* Walk prompt + annotation count */}
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-gray-400 italic">
                  Walk to scan more of your yard.
                </p>
                {annotations.length > 0 && (
                  <span className="text-[10px] text-[#2d6a4f] font-semibold bg-[#e8f5ee] px-2 py-0.5 rounded-full">
                    {annotations.length} tagged
                  </span>
                )}
              </div>
            </div>

            {/* End Scan button */}
            <button
              onClick={endScan}
              className="w-full mt-3 py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl text-sm tracking-wide transition-colors active:scale-[0.98] shadow-lg"
            >
              END SCAN
            </button>
          </div>
        </div>
      )}

      {/* ── STOPPING STATE ──────────────────────────────────────────────────── */}
      {status === "stopping" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#f0f7f4]">
          <div className="w-14 h-14 border-4 border-[#2d6a4f] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#2d6a4f] text-sm font-semibold">Finalizing scan...</p>
          <p className="text-gray-400 text-xs">{frameCount} frames captured</p>
        </div>
      )}

      {/* ── DONE STATE — Score Summary (ui1.png result card style) ────────── */}
      {status === "done" && finalScore && (
        <div className="flex-1 flex flex-col bg-[#f0f7f4]">
          <NavBar active="/scan" />
          <div className="flex-1 flex flex-col px-4 py-8">
          <header className="text-center mb-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Scan Complete
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {frameCount} frames &middot; {totalTrees} trees detected
            </p>
          </header>

          {/* Floating size badges */}
          <div className="flex justify-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full border-2 border-[#2d6a4f] bg-white flex flex-col items-center justify-center shadow-md">
              <span className="text-lg font-black text-[#2d6a4f]">{treeLarge}</span>
              <span className="text-[8px] font-semibold text-gray-500 uppercase">Large</span>
            </div>
            <div className="w-16 h-16 rounded-full border-2 border-[#2d6a4f] bg-white flex flex-col items-center justify-center shadow-md">
              <span className="text-lg font-black text-[#2d6a4f]">{treeMedium}</span>
              <span className="text-[8px] font-semibold text-gray-500 uppercase">Medium</span>
            </div>
            <div className="w-16 h-16 rounded-full border-2 border-[#2d6a4f] bg-white flex flex-col items-center justify-center shadow-md">
              <span className="text-lg font-black text-[#2d6a4f]">{treeSmall}</span>
              <span className="text-[8px] font-semibold text-gray-500 uppercase">Small</span>
            </div>
            <div className="w-16 h-16 rounded-full border-2 border-emerald-500 bg-white flex flex-col items-center justify-center shadow-md">
              <span className="text-lg font-black text-emerald-600">{liveCounts.shrubs}</span>
              <span className="text-[8px] font-semibold text-gray-500 uppercase">Shrubs</span>
            </div>
          </div>

          {/* Score card */}
          <section className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100">
            <div className="flex items-baseline justify-between mb-2">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-[#2d6a4f]">YardScore:</span>
                <span className="text-4xl font-black text-[#2d6a4f]">{Math.round(finalScore.score_value)}</span>
                <span className="text-green-600">&#x2714;</span>
              </div>
              <span className="text-sm font-semibold text-gray-500">{scoreRating(finalScore.score_value)}</span>
            </div>

            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
              <div
                className={`h-full rounded-full ${scoreBarColor(finalScore.score_value)}`}
                style={{ width: `${Math.min(finalScore.score_value, 100)}%` }}
              />
            </div>

            {finalScore.positives.length > 0 && (
              <div className="mb-3">
                {finalScore.positives.map((p, i) => (
                  <p key={i} className="text-sm text-gray-700 py-0.5">
                    <span className="text-[#2d6a4f]">&bull;</span> {p}
                  </p>
                ))}
              </div>
            )}

            {finalScore.negatives.length > 0 && (
              <div className="mb-3">
                {finalScore.negatives.map((n, i) => (
                  <p key={i} className="text-sm text-gray-700 py-0.5">
                    <span className="text-red-500">&bull;</span> {n}
                  </p>
                ))}
              </div>
            )}

            {finalScore.recommendations.length > 0 && (
              <div>
                {finalScore.recommendations.map((r, i) => (
                  <p key={i} className="text-sm text-[#2d6a4f] py-0.5">
                    &rarr; {r}
                  </p>
                ))}
              </div>
            )}
          </section>

          <div className="mt-6">
            <button
              onClick={reset}
              className="w-full py-3.5 bg-[#2d6a4f] hover:bg-[#1b4332] text-white font-bold rounded-2xl text-sm transition-colors shadow-md"
            >
              Scan Again
            </button>
          </div>
          </div>
        </div>
      )}

      {/* ── ERROR STATE ─────────────────────────────────────────────────────── */}
      {status === "error" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 bg-[#f0f7f4]">
          <div className="w-full max-w-sm rounded-2xl bg-red-50 border border-red-200 p-5 text-center">
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button
            onClick={reset}
            className="px-8 py-3 bg-[#2d6a4f] text-white font-semibold rounded-2xl text-sm transition-colors hover:bg-[#1b4332] shadow-md"
          >
            Try Again
          </button>
          <a
            href="/capture"
            className="text-xs text-gray-400 hover:text-[#2d6a4f] transition-colors"
          >
            Upload photos instead
          </a>
        </div>
      )}
    </div>
  );
}
