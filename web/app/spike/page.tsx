"use client";

/**
 * /spike — PlantNet API species identification spike
 *
 * Camera feed with tap-to-identify. Each tap sends one frame to PlantNet API
 * (server-side proxy to protect API key), returns species classification
 * with confidence scores and taxonomic chain.
 *
 * Free tier: 500 identifications/day, 50,000+ species.
 */

import { useState, useEffect, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlantResult {
  scientificName: string;
  commonNames: string[];
  family: string;
  genus: string;
  score: number;
  gbifId?: number;
}

interface Classification {
  results: PlantResult[];
  bestMatch: PlantResult | null;
  organ: string;
  timestamp: number;
  latencyMs: number;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SpikePage() {
  const [status, setStatus] = useState<"idle" | "camera" | "classifying" | "error">("idle");
  const [error, setError] = useState("");
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [callCount, setCallCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Camera ──────────────────────────────────────────────────────────────────

  async function startCamera() {
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
      setStatus("camera");
      setError("");
    } catch (e: any) {
      setError(`Camera: ${e.message}`);
      setStatus("error");
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
  }

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Capture + classify ──────────────────────────────────────────────────────

  const classify = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (status === "classifying") return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx || video.readyState < 2) return;

    // Capture frame
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    ctx.drawImage(video, 0, 0);

    // Convert to blob
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85);
    });
    if (!blob) { setError("Failed to capture frame"); return; }

    setStatus("classifying");

    const t0 = Date.now();
    try {
      // Send to our API proxy (protects the PlantNet key)
      const fd = new FormData();
      fd.append("file", blob, "capture.jpg");
      fd.append("organ", "auto"); // let PlantNet decide

      const r = await fetch("/api/plantnet", {
        method: "POST",
        body: fd,
      });

      if (!r.ok) {
        const body = await r.text();
        throw new Error(`${r.status}: ${body}`);
      }

      const data = await r.json();
      const latencyMs = Date.now() - t0;

      const results: PlantResult[] = (data.results || []).slice(0, 5).map((r: any) => ({
        scientificName: r.species?.scientificNameWithoutAuthor || "Unknown",
        commonNames: r.species?.commonNames || [],
        family: r.species?.family?.scientificNameWithoutAuthor || "",
        genus: r.species?.genus?.scientificNameWithoutAuthor || "",
        score: r.score || 0,
        gbifId: r.gbif?.id,
      }));

      const classification: Classification = {
        results,
        bestMatch: results.length > 0 ? results[0] : null,
        organ: data.query?.organ || "auto",
        timestamp: Date.now(),
        latencyMs,
      };

      setClassifications((prev) => [classification, ...prev.slice(0, 9)]);
      setCallCount((c) => c + 1);
      setStatus("camera");
    } catch (e: any) {
      setError(`PlantNet: ${e.message}`);
      setStatus("camera"); // stay in camera mode so they can retry
    }
  }, [status]);

  // ── Vibrate on tap ──────────────────────────────────────────────────────────

  const handleTap = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate(30);
    classify();
  }, [classify]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const latest = classifications[0] || null;
  const best = latest?.bestMatch;

  return (
    <div className="min-h-screen bg-[#07110c] flex flex-col">
      {/* Header */}
      <div className="px-4 pt-14 pb-2 flex items-center justify-between z-20 relative">
        <div>
          <h1 className="text-lg font-bold text-white">Plant ID Spike</h1>
          <p className="text-[10px] text-zinc-500">PlantNet API · 50K+ species · tap to identify</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-400">{callCount}/500 today</p>
          {latest && <p className="text-[10px] text-zinc-600">{latest.latencyMs}ms</p>}
        </div>
      </div>

      {/* Camera + overlays */}
      <div className="relative flex-1" onClick={status === "camera" ? handleTap : undefined}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: status === "camera" || status === "classifying" ? "block" : "none" }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Classification overlay */}
        {(status === "camera" || status === "classifying") && best && (
          <div className="absolute inset-x-0 top-0 p-3 z-10">
            <div className="bg-black/80 backdrop-blur-md rounded-2xl p-4 border border-lime-300/30">
              {/* Best match */}
              <p className="text-lime-300 text-xl font-bold italic">{best.scientificName}</p>
              {best.commonNames.length > 0 && (
                <p className="text-white text-sm mt-0.5">{best.commonNames[0]}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-zinc-400">
                <span>{best.family}</span>
                <span>·</span>
                <span>{(best.score * 100).toFixed(1)}%</span>
                <span>·</span>
                <span>{latest!.latencyMs}ms</span>
              </div>

              {/* Other results */}
              {latest!.results.length > 1 && (
                <div className="mt-3 border-t border-white/10 pt-2">
                  {latest!.results.slice(1).map((r, i) => (
                    <div key={i} className="flex items-center justify-between py-0.5">
                      <span className="text-[11px] text-zinc-300 italic truncate flex-1">{r.scientificName}</span>
                      {r.commonNames[0] && (
                        <span className="text-[10px] text-zinc-500 mx-2 truncate max-w-[100px]">{r.commonNames[0]}</span>
                      )}
                      <span className="text-[11px] font-mono text-lime-300/70 w-12 text-right">
                        {(r.score * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Classifying spinner */}
        {status === "classifying" && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div className="bg-black/60 backdrop-blur-sm rounded-2xl px-6 py-4 flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-lime-300 border-t-transparent rounded-full animate-spin" />
              <span className="text-white text-sm">Identifying...</span>
            </div>
          </div>
        )}

        {/* Tap hint */}
        {status === "camera" && !best && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/50 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/10">
              <p className="text-white text-sm font-medium">Tap anywhere to identify a plant</p>
              <p className="text-zinc-400 text-xs mt-1 text-center">Fill the frame with the plant first</p>
            </div>
          </div>
        )}

        {/* Tap hint when results showing */}
        {status === "camera" && best && (
          <div className="absolute bottom-24 inset-x-0 flex justify-center pointer-events-none z-10">
            <div className="bg-black/40 backdrop-blur-sm rounded-full px-4 py-2">
              <p className="text-zinc-400 text-xs">Tap to identify another plant</p>
            </div>
          </div>
        )}

        {/* Idle state */}
        {status === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
            <div className="w-20 h-20 rounded-full bg-lime-300/10 border border-lime-300/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-10 h-10 text-lime-300" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 22c-4-4-8-7.5-8-12a8 8 0 0 1 16 0c0 4.5-4 8-8 12Z" />
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-white text-xl font-bold">Plant Identification</h2>
              <p className="text-zinc-400 text-sm mt-2 max-w-xs">
                Point your camera at a plant and tap to identify it.
                Works with 50,000+ species worldwide.
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute bottom-28 inset-x-0 px-4 z-20">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
              <p className="text-red-300 text-xs">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Classification history (scrollable) */}
      {classifications.length > 1 && (
        <div className="px-4 py-2 max-h-32 overflow-y-auto">
          <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">History</p>
          {classifications.slice(1).map((c, i) => (
            <div key={i} className="flex items-center justify-between py-0.5">
              <span className="text-[11px] text-zinc-400 italic truncate flex-1">
                {c.bestMatch?.scientificName || "Unknown"}
              </span>
              <span className="text-[10px] text-zinc-600">
                {c.bestMatch?.commonNames?.[0] || ""}
              </span>
              <span className="text-[10px] font-mono text-zinc-600 ml-2">
                {c.bestMatch ? `${(c.bestMatch.score * 100).toFixed(0)}%` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="px-4 pb-8 pt-2">
        {status === "idle" && (
          <button onClick={startCamera} className="w-full py-4 bg-lime-300 text-zinc-950 font-bold rounded-2xl text-sm active:scale-95 transition-transform">
            Start Camera
          </button>
        )}
        {(status === "camera" || status === "classifying") && (
          <button onClick={stopCamera} className="w-full py-3 bg-white/10 text-zinc-300 font-medium rounded-2xl text-sm">
            Done
          </button>
        )}
      </div>

      {/* PlantNet attribution */}
      <div className="text-center pb-4">
        <p className="text-[9px] text-zinc-700">Powered by Pl@ntNet API</p>
      </div>
    </div>
  );
}
