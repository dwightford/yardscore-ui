"use client";

/**
 * CameraFeed
 *
 * Live camera view using getUserMedia with environment-facing camera.
 * Falls back to a dark placeholder when camera is unavailable or denied.
 *
 * Exposes a `captureFrame()` function via `onReady` callback so the
 * parent (FieldMapperShell) can grab a JPEG blob from the current frame
 * for plant identification or other analysis.
 *
 * The overlay zone is preserved for future breadcrumb hints, anchor
 * badges, measure annotations, and plant ID labels.
 */

import React, { useRef, useState, useEffect, useCallback } from "react";

export interface CameraFeedHandle {
  /** Capture the current video frame as a JPEG Blob. Returns null if camera is off. */
  captureFrame: () => Promise<Blob | null>;
}

interface CameraFeedProps {
  /** Called once camera is ready (or on mount if unavailable) with the capture handle */
  onReady?: (handle: CameraFeedHandle) => void;
  /** When true, camera stream is active. When false, stream is stopped. */
  active?: boolean;
  /** Optional overlay content (breadcrumb trail, badges, etc.) */
  children?: React.ReactNode;
}

export default function CameraFeed({ onReady, active = true, children }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraState, setCameraState] = useState<"loading" | "live" | "denied" | "unavailable">(
    "loading",
  );

  // ── Capture a JPEG frame from the live video ─────────────────────────────
  const captureFrame = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
    });
  }, []);

  // ── Start / stop camera stream ───────────────────────────────────────────
  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("unavailable");
      return;
    }

    // Check permission state if API available
    try {
      const perm = await navigator.permissions?.query({ name: "camera" as PermissionName });
      if (perm?.state === "denied") {
        setCameraState("denied");
        return;
      }
    } catch {
      // permissions API not available — proceed to getUserMedia
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraState("live");
    } catch {
      setCameraState("denied");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // ── Lifecycle ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (active) {
      startCamera();
    } else {
      stopCamera();
      setCameraState("loading");
    }
    return stopCamera;
  }, [active, startCamera, stopCamera]);

  // Expose capture handle to parent
  useEffect(() => {
    onReady?.({ captureFrame });
  }, [onReady, captureFrame]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="absolute inset-0 bg-black flex items-center justify-center overflow-hidden"
      aria-label="Camera view area"
    >
      {/* Live video (hidden when not streaming) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={[
          "absolute inset-0 w-full h-full object-cover",
          cameraState === "live" ? "opacity-100" : "opacity-0",
        ].join(" ")}
      />

      {/* Fallback placeholder */}
      {cameraState !== "live" && (
        <div className="absolute inset-0 bg-gradient-to-b from-stone-950 via-stone-900 to-black flex items-center justify-center">
          {/* Subtle grid */}
          <div
            className="absolute inset-0 opacity-5 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(to right, #fff 1px, transparent 1px), " +
                "linear-gradient(to bottom, #fff 1px, transparent 1px)",
              backgroundSize: "80px 80px",
            }}
          />
          <div className="flex flex-col items-center gap-3 pointer-events-none select-none">
            <div className="w-12 h-12 rounded-full border-2 border-white/20 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white/30" />
            </div>
            <p className="text-stone-600 text-xs tracking-widest uppercase">
              {cameraState === "loading" && "Starting camera..."}
              {cameraState === "denied" && "Camera access needed"}
              {cameraState === "unavailable" && "Camera not available"}
            </p>
            {cameraState === "denied" && (
              <p className="text-stone-700 text-[10px] max-w-[200px] text-center">
                Allow camera access in your browser settings to use the live view.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Center reticle (subtle, over both live and fallback) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-16 h-16 rounded-full border border-white/10" />
      </div>

      {/* Overlay zone for badges, breadcrumbs, labels */}
      <div className="overlay-zone absolute inset-0 pointer-events-none">
        {children}
      </div>
    </div>
  );
}
