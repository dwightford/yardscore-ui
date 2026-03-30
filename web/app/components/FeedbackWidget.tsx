"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Collect device/browser context automatically so users never need to debug */
function collectContext(): Record<string, unknown> {
  const ctx: Record<string, unknown> = {
    page: window.location.pathname + window.location.search,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    online: navigator.onLine,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    platform: (navigator as any).userAgentData?.platform ?? navigator.platform,
    touchSupport: "ontouchstart" in window,
  };

  // Connection info
  const conn = (navigator as any).connection;
  if (conn) {
    ctx.connectionType = conn.effectiveType;
    ctx.connectionDownlink = conn.downlink;
    ctx.connectionRtt = conn.rtt;
  }

  // Memory info (Chrome only)
  const mem = (performance as any).memory;
  if (mem) {
    ctx.memoryUsedMB = Math.round(mem.usedJSHeapSize / 1024 / 1024);
    ctx.memoryTotalMB = Math.round(mem.totalJSHeapSize / 1024 / 1024);
  }

  // Performance timing
  const perf = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (perf) {
    ctx.pageLoadMs = Math.round(perf.loadEventEnd - perf.startTime);
  }

  return ctx;
}

/** Capture recent console errors */
function useErrorCapture(): string[] {
  const errorsRef = useRef<string[]>([]);

  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      const msg = `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`;
      errorsRef.current = [...errorsRef.current.slice(-9), msg];
    };
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      const msg = `Unhandled rejection: ${event.reason}`;
      errorsRef.current = [...errorsRef.current.slice(-9), msg];
    };

    window.addEventListener("error", handler);
    window.addEventListener("unhandledrejection", rejectionHandler);
    return () => {
      window.removeEventListener("error", handler);
      window.removeEventListener("unhandledrejection", rejectionHandler);
    };
  }, []);

  return errorsRef.current;
}

export default function FeedbackWidget() {
  const { data: session } = useSession();
  const tokenRef = useRef<string | undefined>(undefined);
  useEffect(() => { tokenRef.current = (session as any)?.apiToken; }, [session]);

  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [feedbackType, setFeedbackType] = useState<"general" | "bug" | "idea">("general");
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const recentErrors = useErrorCapture();

  // Grab GPS when widget opens (non-blocking)
  useEffect(() => {
    if (open && !gpsCoords && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
  }, [open, gpsCoords]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setStatus("sending");
    try {
      const context = collectContext();
      const r = await apiFetch(tokenRef.current, `${API}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          type: feedbackType,
          page: window.location.pathname,
          userAgent: navigator.userAgent,
          context: {
            ...context,
            gps: gpsCoords,
            recentErrors: recentErrors.length > 0 ? recentErrors : undefined,
          },
        }),
      });
      if (r.ok) {
        setStatus("sent");
        setMessage("");
        setFeedbackType("general");
        setTimeout(() => {
          setStatus("idle");
          setOpen(false);
        }, 2000);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      {/* Floating feedback button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full bg-[#2d6a4f] text-white shadow-lg flex items-center justify-center hover:bg-[#1b4332] active:scale-95 transition-all"
          aria-label="Give feedback"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
        </button>
      )}

      {/* Feedback panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-[#2d6a4f] px-4 py-3 flex items-center justify-between">
            <span className="text-white text-sm font-semibold">Send Feedback</span>
            <button
              onClick={() => { setOpen(false); setStatus("idle"); }}
              className="text-white/70 hover:text-white text-lg leading-none"
            >
              &times;
            </button>
          </div>

          {/* Body */}
          <div className="p-4">
            {status === "sent" ? (
              <div className="text-center py-4">
                <p className="text-[#2d6a4f] font-semibold">Thanks!</p>
                <p className="text-gray-500 text-sm mt-1">Drew will see your feedback with full context.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Feedback type selector */}
                <div className="flex gap-2">
                  {([
                    { key: "general", label: "General", icon: "💬" },
                    { key: "bug", label: "Bug", icon: "🐛" },
                    { key: "idea", label: "Idea", icon: "💡" },
                  ] as const).map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setFeedbackType(t.key)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        feedbackType === t.key
                          ? "bg-[#2d6a4f] text-white"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    feedbackType === "bug"
                      ? "What went wrong? We'll capture device info automatically."
                      : feedbackType === "idea"
                      ? "What should YardScore do?"
                      : "What's working? What's not?"
                  }
                  rows={4}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#52b788] focus:ring-1 focus:ring-[#52b788]"
                  autoFocus
                />

                {/* Auto-captured context preview */}
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-[10px] text-gray-400 space-y-0.5">
                  <p className="font-medium text-gray-500">Auto-captured:</p>
                  <p>📍 Page: {typeof window !== "undefined" ? window.location.pathname : ""}</p>
                  <p>📱 {typeof window !== "undefined" ? (
                    /iPhone|iPad/.test(navigator.userAgent) ? "iOS" :
                    /Android/.test(navigator.userAgent) ? "Android" : "Desktop"
                  ) : ""} · {typeof window !== "undefined" ? `${window.innerWidth}×${window.innerHeight}` : ""}</p>
                  {gpsCoords && <p>🛰 GPS: {gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)}</p>}
                  {recentErrors.length > 0 && (
                    <p className="text-red-400">⚠ {recentErrors.length} recent error{recentErrors.length > 1 ? "s" : ""} captured</p>
                  )}
                </div>

                {status === "error" && (
                  <p className="text-red-500 text-xs">Failed to send. Try again.</p>
                )}
                <button
                  type="submit"
                  disabled={status === "sending" || !message.trim()}
                  className="w-full py-2.5 bg-[#2d6a4f] hover:bg-[#1b4332] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                  {status === "sending" ? "Sending..." : "Send Feedback"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
