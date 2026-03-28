"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setStatus("sending");
    try {
      const r = await fetch(`${API}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          page: window.location.pathname,
          userAgent: navigator.userAgent,
        }),
      });
      if (r.ok) {
        setStatus("sent");
        setMessage("");
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
      {/* Floating feedback button — bottom right, always visible */}
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
                <p className="text-gray-500 text-sm mt-1">Drew will see your feedback.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What's working? What's not? What do you wish it did?"
                  rows={4}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#52b788] focus:ring-1 focus:ring-[#52b788]"
                  autoFocus
                />
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
                <p className="text-gray-400 text-[10px] text-center">
                  Includes your current page and device info
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
