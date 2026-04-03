"use client";

/**
 * GuidedWalkFlow
 *
 * Orchestrates the 5-screen guided anchor flow on top of FieldMapperShell.
 * The shell stays stable — the guided flow adds ceremony before the walk
 * and lightweight contextual prompts during it.
 *
 * Screens:
 *   1. Origin anchor (front door)           → pre-shell
 *   2. Begin walk (with memory context)     → pre-shell
 *   3. Contextual anchor suggestion         → overlay during shell
 *   4. Identify or mark area guidance       → overlay during shell
 *   4b. Light suggestion (readiness-driven) → overlay during shell
 *   5. Walk review (shell's WalkReview)     → handled by shell
 *
 * Anchor suggestions are filtered against existing anchors.
 * Prompt dismissals persist in localStorage across sessions.
 * Guided anchor saves trigger a shell refresh so badges/counts update.
 * Errors are surfaced inline — failures don't silently proceed.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import FieldMapperShell from "./FieldMapperShell";
import CameraFeed from "./CameraFeed";
import { useGps } from "@/hooks/useGps";
import * as fieldApi from "@/lib/field-api";

// ── Types ────────────────────────────────────────────────────────────────────

type FlowStep = "origin" | "begin" | "walking";
type GuidedPrompt =
  | "anchor_suggestion"
  | "capture_suggestion"
  | "light_suggestion"
  | null;

interface MemoryContext {
  stage: fieldApi.MemoryStage;
  prompt: string;
  walkCount: number;
  anchorCount: number;
  existingAnchorTypes: string[];
}

interface GuidedWalkFlowProps {
  token?: string;
  landUnitId?: string;
  propertyLabel?: string;
  onViewProperty?: () => void;
}

// ── localStorage helpers ─────────────────────────────────────────────────────

const PROMPT_STORAGE_KEY = "ys:guided-prompts-seen";

function getSeenPrompts(): Set<string> {
  try {
    const raw = localStorage.getItem(PROMPT_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markPromptSeen(prompt: string) {
  try {
    const seen = getSeenPrompts();
    seen.add(prompt);
    localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify([...seen]));
  } catch {
    // localStorage unavailable
  }
}

// ── Demo seed for shell ──────────────────────────────────────────────────────

const DEMO_WALKING_SEED = {
  walkActive: true,
  walkStartedAt: new Date().toISOString(),
  hasOriginAnchor: true,
  anchorCount: 1,
  areaCount: 0,
  subjectCount: 0,
  initialStripState: "walk_active" as const,
};

// ── All possible anchor suggestions ──────────────────────────────────────────

const ALL_ANCHOR_SUGGESTIONS = [
  { type: "back_door", label: "Back door", icon: "🚪" },
  { type: "driveway_corner", label: "Driveway corner", icon: "🅿️" },
  { type: "big_tree", label: "Big obvious tree", icon: "🌳" },
  { type: "side_door", label: "Side door", icon: "🚪" },
  { type: "shed_corner", label: "Shed / fence corner", icon: "🏚️" },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function GuidedWalkFlow({
  token,
  landUnitId,
  propertyLabel,
  onViewProperty,
}: GuidedWalkFlowProps) {
  const isLive = Boolean(token && landUnitId);

  // Flow state
  const [step, setStep] = useState<FlowStep>("origin");
  const [loading, setLoading] = useState(isLive);
  const [originSaving, setOriginSaving] = useState(false);
  const [walkStarting, setWalkStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memory context for Begin Walk screen + anchor filtering
  const [memCtx, setMemCtx] = useState<MemoryContext | null>(null);

  // Shell refresh trigger
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Guided prompt state
  const [guidedPrompt, setGuidedPrompt] = useState<GuidedPrompt>(null);
  const [anchorSaving, setAnchorSaving] = useState(false);
  const [anchorSaved, setAnchorSaved] = useState(false);
  const [anchorError, setAnchorError] = useState<string | null>(null);
  const promptTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const repollRef = useRef<ReturnType<typeof setInterval>>();
  const promptShownRef = useRef({ anchor: false, capture: false, light: false });

  // Weather — used to suppress light prompt on overcast/rainy days
  const goodLightRef = useRef(true); // assume good until checked

  // Hydrate prompt-shown state from localStorage
  useEffect(() => {
    const seen = getSeenPrompts();
    if (seen.has("capture")) promptShownRef.current.capture = true;
  }, []);

  // Auto-dismiss errors
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  useEffect(() => {
    if (!anchorError) return;
    const t = setTimeout(() => setAnchorError(null), 4000);
    return () => clearTimeout(t);
  }, [anchorError]);

  // GPS
  const { locationRef, startGps } = useGps();

  // ── On mount: check for existing state (live mode) ────────────────────

  useEffect(() => {
    if (!isLive) {
      setLoading(false);
      return;
    }
    startGps();

    let cancelled = false;
    Promise.all([
      fieldApi.fetchPropertyMemory(token!, landUnitId!),
      fieldApi.fetchActiveWalk(token!, landUnitId!),
      fieldApi.fetchWeather(token!, landUnitId!).catch(() => null),
    ])
      .then(([mem, activeWalk, weather]) => {
        if (cancelled) return;

        goodLightRef.current = fieldApi.isGoodLightConditions(weather);

        if (mem) {
          setMemCtx({
            stage: mem.memory_stage,
            prompt: mem.prompt,
            walkCount: mem.walk_sessions_completed,
            anchorCount: mem.anchor_count,
            existingAnchorTypes: mem.anchors.map((a) => a.anchor_type),
          });
        }

        const hasOrigin = mem?.anchors.some((a) => a.anchor_type === "front_door");
        if (activeWalk) {
          setStep("walking");
        } else if (hasOrigin) {
          setStep("begin");
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive]);

  // Schedule prompts when jumping straight to walking (active walk on mount)
  const hasScheduledRef = useRef(false);
  useEffect(() => {
    if (step === "walking" && !hasScheduledRef.current) {
      hasScheduledRef.current = true;
      schedulePrompts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
      if (repollRef.current) clearInterval(repollRef.current);
    };
  }, []);

  // ── Filtered anchor suggestions ────────────────────────────────────────

  const anchorSuggestions = ALL_ANCHOR_SUGGESTIONS.filter(
    (s) => !memCtx?.existingAnchorTypes.includes(s.type),
  );
  const hasAnchorSuggestions = anchorSuggestions.length > 0;

  // ── First non-anchor prompt to show ────────────────────────────────────

  const scheduleNonAnchorPrompt = useCallback(() => {
    if (!promptShownRef.current.capture) {
      setGuidedPrompt("capture_suggestion");
      promptTimerRef.current = setTimeout(() => {
        setGuidedPrompt(null);
        promptShownRef.current.capture = true;
        markPromptSeen("capture");
      }, 10_000);
    } else if (!promptShownRef.current.light && goodLightRef.current) {
      setGuidedPrompt("light_suggestion");
    }
  }, []);

  // ── Readiness-driven prompt scheduling ─────────────────────────────────

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const schedulePrompts = useCallback(() => {
    if (!isLive) {
      promptTimerRef.current = setTimeout(() => {
        setGuidedPrompt("anchor_suggestion");
      }, 3_000);
      return;
    }

    fieldApi
      .fetchNextObservation(token!, landUnitId!)
      .then((next) => {
        if (next?.observation_type === "light_profile" && goodLightRef.current) {
          promptTimerRef.current = setTimeout(
            () => setGuidedPrompt("light_suggestion"),
            12_000,
          );
          return;
        }

        if (hasAnchorSuggestions) {
          const delay =
            next?.observation_type === "anchor" || next?.observation_type === "origin_anchor"
              ? 8_000
              : next
                ? 20_000
                : 25_000;
          promptTimerRef.current = setTimeout(
            () => setGuidedPrompt("anchor_suggestion"),
            delay,
          );
        } else {
          // No anchor suggestions left — go to capture/light
          promptTimerRef.current = setTimeout(scheduleNonAnchorPrompt, 15_000);
        }
      })
      .catch(() => {
        const delay = hasAnchorSuggestions ? 20_000 : 15_000;
        promptTimerRef.current = setTimeout(
          () => hasAnchorSuggestions
            ? setGuidedPrompt("anchor_suggestion")
            : scheduleNonAnchorPrompt(),
          delay,
        );
      });

    repollRef.current = setInterval(() => {
      fieldApi
        .fetchNextObservation(token!, landUnitId!)
        .then((next) => {
          if (!next) return;
          if (
            next.observation_type === "light_profile" &&
            !promptShownRef.current.light &&
            goodLightRef.current
          ) {
            setGuidedPrompt((current) => {
              if (current !== null) return current;
              return "light_suggestion";
            });
          }
        })
        .catch(() => {});
    }, 90_000);
  }, [isLive, token, landUnitId, hasAnchorSuggestions, scheduleNonAnchorPrompt]);

  // ── Screen 1 handler: set front door + start walk in one action ─────────
  // The walk starts first so the anchor gets linked to the walk session.
  // This is the primary entry point — one big button, one action.

  const handleSetFrontDoorAndStart = useCallback(async () => {
    if (isLive) {
      setOriginSaving(true);
      setError(null);
      try {
        // 1. Start walk first so we have a session ID
        const walk = await fieldApi.startWalk(token!, landUnitId!);

        // 2. Save front door anchor linked to this walk
        const loc = locationRef.current;
        await fieldApi.saveAnchor(token!, landUnitId!, {
          anchor_type: "front_door",
          label: "Front door",
          device_lat: loc?.lat ?? null,
          device_lng: loc?.lng ?? null,
          accuracy_m: loc?.accuracy ?? null,
          walk_session_id: walk.id,
        });
        setMemCtx((prev) =>
          prev
            ? { ...prev, existingAnchorTypes: [...prev.existingAnchorTypes, "front_door"], anchorCount: prev.anchorCount + 1 }
            : prev,
        );
      } catch (e: any) {
        setError(e.message ?? "Could not start — check your connection and try again.");
        setOriginSaving(false);
        return;
      }
      setOriginSaving(false);
    }
    hasScheduledRef.current = true;
    setStep("walking");
    schedulePrompts();
  }, [isLive, token, landUnitId, locationRef, schedulePrompts]);

  const handleSkipOriginAndStart = useCallback(async () => {
    if (isLive) {
      setWalkStarting(true);
      setError(null);
      try {
        await fieldApi.startWalk(token!, landUnitId!);
      } catch (e: any) {
        setError(e.message ?? "Could not start walk. Check your connection and try again.");
        setWalkStarting(false);
        return;
      }
      setWalkStarting(false);
    }
    hasScheduledRef.current = true;
    setStep("walking");
    schedulePrompts();
  }, [isLive, token, landUnitId, schedulePrompts]);

  // ── Screen 2 handler (returning user — already has origin) ─────────────

  const handleBeginWalk = useCallback(async () => {
    if (isLive) {
      setWalkStarting(true);
      setError(null);
      try {
        await fieldApi.startWalk(token!, landUnitId!);
      } catch (e: any) {
        setError(e.message ?? "Could not start walk. Check your connection and try again.");
        setWalkStarting(false);
        return;
      }
      setWalkStarting(false);
    }
    hasScheduledRef.current = true;
    setStep("walking");
    schedulePrompts();
  }, [isLive, token, landUnitId, schedulePrompts]);

  // ── Guided prompt handlers (Screens 3, 4, 4b) ─────────────────────────

  const advanceAfterAnchor = useCallback(() => {
    setAnchorSaved(false);
    if (promptShownRef.current.capture) {
      setGuidedPrompt(null);
      return;
    }
    setGuidedPrompt("capture_suggestion");
    promptTimerRef.current = setTimeout(() => {
      setGuidedPrompt(null);
      promptShownRef.current.capture = true;
      markPromptSeen("capture");
      if (!isLive && !promptShownRef.current.light) {
        promptTimerRef.current = setTimeout(
          () => setGuidedPrompt("light_suggestion"),
          4_000,
        );
      }
    }, 10_000);
  }, [isLive]);

  const handleSaveGuidedAnchor = useCallback(
    async (type: string, label: string) => {
      setAnchorError(null);
      if (isLive) {
        setAnchorSaving(true);
        try {
          const loc = locationRef.current;
          await fieldApi.saveAnchor(token!, landUnitId!, {
            anchor_type: type,
            label,
            device_lat: loc?.lat ?? null,
            device_lng: loc?.lng ?? null,
            accuracy_m: loc?.accuracy ?? null,
          });
          setMemCtx((prev) =>
            prev
              ? { ...prev, existingAnchorTypes: [...prev.existingAnchorTypes, type], anchorCount: prev.anchorCount + 1 }
              : prev,
          );
          setRefreshTrigger((n) => n + 1);
        } catch (e: any) {
          setAnchorError(e.message ?? "Could not save — keep walking, you can add it later.");
          setAnchorSaving(false);
          return; // Stay on the anchor card so user can retry or skip
        }
        setAnchorSaving(false);
      }
      setAnchorSaved(true);
      promptShownRef.current.anchor = true;
      promptTimerRef.current = setTimeout(advanceAfterAnchor, 1500);
    },
    [isLive, token, landUnitId, locationRef, advanceAfterAnchor],
  );

  const handleSkipAnchorSuggestion = useCallback(() => {
    promptShownRef.current.anchor = true;
    setAnchorError(null);
    advanceAfterAnchor();
  }, [advanceAfterAnchor]);

  const handleDismissCapturePrompt = useCallback(() => {
    promptShownRef.current.capture = true;
    markPromptSeen("capture");
    setGuidedPrompt(null);
    if (!isLive && !promptShownRef.current.light) {
      promptTimerRef.current = setTimeout(
        () => setGuidedPrompt("light_suggestion"),
        4_000,
      );
    }
  }, [isLive]);

  const handleDismissLightPrompt = useCallback(() => {
    promptShownRef.current.light = true;
    setGuidedPrompt(null);
  }, []);

  // ── Loading ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-[100dvh] bg-black flex items-center justify-center">
        <p className="text-stone-600 text-sm tracking-wide">Loading...</p>
      </div>
    );
  }

  // ── Pre-walk screens (origin + begin) — camera always visible behind ────

  if (step === "origin" || step === "begin") {
    return (
      <div className="relative h-[100dvh] overflow-hidden bg-black">
        {/* Live camera background */}
        <CameraFeed active />

        {/* Overlay card */}
        <div className="absolute inset-0 flex flex-col justify-end pointer-events-none">
          <div className="pointer-events-auto bg-black/80 backdrop-blur-md rounded-t-2xl px-6 pt-6 pb-8" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}>
            {step === "origin" ? (
              <div className="w-full max-w-sm mx-auto flex flex-col items-center gap-5 text-center">
                <div>
                  <h1 className="text-white text-xl font-semibold mb-2">
                    Start at your front door
                  </h1>
                  <p className="text-stone-400 text-sm leading-relaxed">
                    This gives your yard a home base. Point the camera at your door and tap below.
                  </p>
                </div>

                {error && <InlineError message={error} />}

                <button
                  onClick={handleSetFrontDoorAndStart}
                  disabled={originSaving}
                  className="w-full bg-green-600 hover:bg-green-500 active:scale-[0.98] text-white font-semibold rounded-xl py-3.5 transition disabled:opacity-60"
                >
                  {originSaving ? "Starting..." : "Set Front Door & Start Observing"}
                </button>

                <button
                  onClick={handleSkipOriginAndStart}
                  disabled={walkStarting}
                  className="text-stone-500 hover:text-stone-300 text-sm transition"
                >
                  {walkStarting ? "Starting..." : "Skip — start observing"}
                </button>
              </div>
            ) : (
              <div className="w-full max-w-sm mx-auto flex flex-col items-center gap-5 text-center">
                <div>
                  <h1 className="text-white text-xl font-semibold mb-2">
                    {memCtx && memCtx.walkCount > 0
                      ? "Resume observing"
                      : "Observe your yard"}
                  </h1>
                  <p className="text-stone-400 text-sm leading-relaxed">
                    {beginWalkBody(memCtx)}
                  </p>
                </div>

                {memCtx && memCtx.walkCount > 0 && (
                  <div className="flex gap-2 flex-wrap justify-center">
                    <ContextChip
                      value={String(memCtx.walkCount)}
                      label={memCtx.walkCount === 1 ? "walk so far" : "walks so far"}
                    />
                    {memCtx.anchorCount > 0 && (
                      <ContextChip
                        value={String(memCtx.anchorCount)}
                        label={memCtx.anchorCount === 1 ? "reference point" : "reference points"}
                      />
                    )}
                  </div>
                )}

                {error && <InlineError message={error} />}

                <button
                  onClick={handleBeginWalk}
                  disabled={walkStarting}
                  className="w-full bg-green-600 hover:bg-green-500 active:scale-[0.98] text-white font-semibold rounded-xl py-3.5 transition disabled:opacity-60"
                >
                  {walkStarting ? "Starting..." : "Start Observing"}
                </button>

                {propertyLabel && (
                  <p className="text-stone-600 text-xs">{propertyLabel}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Walking: FieldMapperShell + guided prompts ─────────────────────────

  return (
    <div className="relative h-[100dvh]">
      <FieldMapperShell
        token={token}
        landUnitId={landUnitId}
        propertyLabel={propertyLabel}
        onViewProperty={onViewProperty}
        refreshTrigger={refreshTrigger}
        {...(!isLive ? { seed: DEMO_WALKING_SEED } : {})}
      />

      <AnimatePresence>
        {guidedPrompt === "anchor_suggestion" && !anchorSaved && hasAnchorSuggestions && (
          <motion.div
            key="anchor-prompt"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute top-16 left-3 right-3 z-30"
          >
            <AnchorSuggestionCard
              suggestions={anchorSuggestions.slice(0, 3)}
              onSave={handleSaveGuidedAnchor}
              onSkip={handleSkipAnchorSuggestion}
              saving={anchorSaving}
              error={anchorError}
            />
          </motion.div>
        )}

        {guidedPrompt === "anchor_suggestion" && anchorSaved && (
          <motion.div
            key="anchor-confirmed"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute top-16 left-3 right-3 z-30"
          >
            <div className="bg-amber-900/80 backdrop-blur-md border border-amber-600/40 rounded-xl px-4 py-3 text-center">
              <p className="text-amber-200 text-sm font-medium">
                Reference point saved
              </p>
            </div>
          </motion.div>
        )}

        {guidedPrompt === "capture_suggestion" && (
          <motion.div
            key="capture-prompt"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute top-16 left-3 right-3 z-30"
          >
            <CaptureSuggestionCard onDismiss={handleDismissCapturePrompt} />
          </motion.div>
        )}

        {guidedPrompt === "light_suggestion" && (
          <motion.div
            key="light-prompt"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute top-16 left-3 right-3 z-30"
          >
            <LightSuggestionCard onDismiss={handleDismissLightPrompt} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Inline error ─────────────────────────────────────────────────────────────

function InlineError({ message }: { message: string }) {
  return (
    <div className="w-full bg-red-900/40 border border-red-700/40 rounded-xl px-4 py-2.5">
      <p className="text-red-300 text-xs leading-relaxed">{message}</p>
    </div>
  );
}

// ── Begin Walk body text ─────────────────────────────────────────────────────

function beginWalkBody(ctx: MemoryContext | null): string {
  if (!ctx || ctx.walkCount === 0) {
    return "Walk your yard naturally. The app quietly remembers what you see — just mark anything that catches your eye.";
  }
  if (ctx.stage === "forming") {
    return "Your yard memory is building. Walk and notice what's new — every observation makes it stronger.";
  }
  if (ctx.stage === "established") {
    return "Your yard memory is strong. Walk to add seasonal detail or notice what's changed.";
  }
  return "Each walk adds to what the app knows about your yard. Mark anything you notice.";
}

// ── Context chip ─────────────────────────────────────────────────────────────

function ContextChip({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-full px-3 py-1.5 flex items-center gap-1.5">
      <span className="text-white text-sm font-bold">{value}</span>
      <span className="text-stone-500 text-[10px]">{label}</span>
    </div>
  );
}

// ── Prompt cards — calm, brief, skippable ────────────────────────────────────
//
// Design rule from canon: "brief, skippable, calm, context-aware"
// These should feel like a quiet nudge, not a dialog box.

interface AnchorSuggestion {
  type: string;
  label: string;
  icon: string;
}

function AnchorSuggestionCard({
  suggestions,
  onSave,
  onSkip,
  saving,
  error,
}: {
  suggestions: AnchorSuggestion[];
  onSave: (type: string, label: string) => void;
  onSkip: () => void;
  saving: boolean;
  error: string | null;
}) {
  const [selected, setSelected] = useState(suggestions[0]);

  return (
    <div className="bg-black/50 backdrop-blur-lg border border-white/[0.08] rounded-2xl px-4 py-3.5">
      <p className="text-white/60 text-xs mb-3">
        This looks like a good reference point. What is it?
      </p>

      <div className="flex gap-1.5 mb-3">
        {suggestions.map((s) => (
          <button
            key={s.type}
            onClick={() => setSelected(s)}
            className={[
              "flex-1 py-2 px-1.5 rounded-xl text-[10px] font-medium transition text-center",
              selected.type === s.type
                ? "bg-white/10 text-white"
                : "text-white/30 hover:text-white/60",
            ].join(" ")}
          >
            <span className="block text-sm mb-0.5">{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      {error && <p className="text-red-400/70 text-[10px] mb-2">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => onSave(selected.type, selected.label)}
          disabled={saving}
          className="flex-1 bg-white/10 hover:bg-white/15 active:scale-[0.98] text-white text-xs font-medium rounded-xl py-2 transition disabled:opacity-50"
        >
          {saving ? "..." : "Save"}
        </button>
        <button
          onClick={onSkip}
          className="px-3 text-white/30 hover:text-white/50 text-xs transition"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

function CaptureSuggestionCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="bg-black/50 backdrop-blur-lg border border-white/[0.08] rounded-2xl px-4 py-3">
      <p className="text-white/50 text-xs leading-relaxed">
        See something? Tap <span className="text-white/70">Identify</span> or <span className="text-white/70">Area</span> below.
      </p>
      <button
        onClick={onDismiss}
        className="mt-2 text-white/25 hover:text-white/40 text-[10px] transition"
      >
        Got it
      </button>
    </div>
  );
}

function LightSuggestionCard({ onDismiss }: { onDismiss: () => void }) {
  const hour = new Date().getHours();
  const timeLabel =
    hour < 10 ? "morning" : hour < 14 ? "midday" : hour < 17 ? "afternoon" : "evening";

  return (
    <div className="bg-black/50 backdrop-blur-lg border border-white/[0.08] rounded-2xl px-4 py-3">
      <p className="text-white/50 text-xs leading-relaxed">
        Good {timeLabel} light here. Tap <span className="text-yellow-300/60">Light</span> to record it.
      </p>
      <button
        onClick={onDismiss}
        className="mt-2 text-white/25 hover:text-white/40 text-[10px] transition"
      >
        Got it
      </button>
    </div>
  );
}
