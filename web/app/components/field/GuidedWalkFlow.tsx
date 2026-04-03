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

  // ── Screen 1 handlers ──────────────────────────────────────────────────

  const handleSetFrontDoor = useCallback(async () => {
    if (isLive) {
      setOriginSaving(true);
      setError(null);
      try {
        const loc = locationRef.current;
        await fieldApi.saveAnchor(token!, landUnitId!, {
          anchor_type: "front_door",
          label: "Front door",
          device_lat: loc?.lat ?? null,
          device_lng: loc?.lng ?? null,
          accuracy_m: loc?.accuracy ?? null,
        });
        setMemCtx((prev) =>
          prev
            ? { ...prev, existingAnchorTypes: [...prev.existingAnchorTypes, "front_door"], anchorCount: prev.anchorCount + 1 }
            : prev,
        );
      } catch (e: any) {
        setError(e.message ?? "Could not save front door — you can set it later.");
      }
      setOriginSaving(false);
    }
    setStep("begin");
  }, [isLive, token, landUnitId, locationRef]);

  const handleSkipOrigin = useCallback(() => {
    setStep("begin");
  }, []);

  // ── Screen 2 handlers ──────────────────────────────────────────────────

  const handleBeginWalk = useCallback(async () => {
    if (isLive) {
      setWalkStarting(true);
      setError(null);
      try {
        await fieldApi.startWalk(token!, landUnitId!);
      } catch (e: any) {
        setError(e.message ?? "Could not start walk. Check your connection and try again.");
        setWalkStarting(false);
        return; // Stay on Begin Walk screen — don't proceed to broken shell
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
                    This gives your map a home base. Point the camera at your door and tap below.
                  </p>
                </div>

                {error && <InlineError message={error} />}

                <button
                  onClick={handleSetFrontDoor}
                  disabled={originSaving}
                  className="w-full bg-amber-600 hover:bg-amber-500 active:scale-[0.98] text-white font-semibold rounded-xl py-3.5 transition disabled:opacity-60"
                >
                  {originSaving ? "Setting..." : "Set Front Door"}
                </button>

                <button
                  onClick={handleSkipOrigin}
                  className="text-stone-500 hover:text-stone-300 text-sm transition"
                >
                  Not at front door
                </button>
              </div>
            ) : (
              <div className="w-full max-w-sm mx-auto flex flex-col items-center gap-5 text-center">
                <div>
                  <h1 className="text-white text-xl font-semibold mb-2">
                    {memCtx && memCtx.walkCount > 0
                      ? `Walk ${memCtx.walkCount + 1}`
                      : "Walk your property"}
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
                  {walkStarting ? "Starting..." : "Begin Walk"}
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
    return "Walk naturally through your yard. The app quietly builds a map as you move — you just mark what you see along the way.";
  }
  if (ctx.stage === "forming") {
    return "Your property memory is forming. This walk will help fill it in — mark anything new you notice.";
  }
  if (ctx.stage === "established") {
    return "Your property memory is well established. Walk to add seasonal detail or check on what you've noted before.";
  }
  return "Each walk adds to your property memory. The more you note, the better your recommendations will be.";
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

// ── Screen 3: Anchor Suggestion Card ─────────────────────────────────────────

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
    <div className="bg-stone-950/90 backdrop-blur-md border border-white/10 rounded-xl px-4 py-4 shadow-2xl">
      <p className="text-stone-300 text-sm leading-relaxed mb-3">
        Adding another reference point helps your map stay accurate.
        What&apos;s nearby?
      </p>

      <div className="flex gap-2 mb-3">
        {suggestions.map((s) => (
          <button
            key={s.type}
            onClick={() => setSelected(s)}
            className={[
              "flex-1 py-2.5 px-2 rounded-xl text-xs font-medium transition text-center",
              selected.type === s.type
                ? "bg-amber-700/60 border border-amber-500/50 text-amber-200"
                : "bg-white/6 text-stone-400 hover:text-white border border-transparent",
            ].join(" ")}
          >
            <span className="block text-base mb-0.5">{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-red-400 text-xs mb-2">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onSave(selected.type, selected.label)}
          disabled={saving}
          className="flex-1 bg-amber-600 hover:bg-amber-500 active:scale-[0.98] text-white font-semibold rounded-xl py-2.5 text-sm transition disabled:opacity-60"
        >
          {saving ? "Saving..." : `Save ${selected.label}`}
        </button>
        <button
          onClick={onSkip}
          className="px-4 text-stone-500 hover:text-stone-300 text-sm transition"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

// ── Screen 4: Capture Suggestion Card ────────────────────────────────────────

function CaptureSuggestionCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="bg-stone-950/90 backdrop-blur-md border border-white/10 rounded-xl px-4 py-4 shadow-2xl">
      <p className="text-stone-300 text-sm leading-relaxed mb-3">
        See something worth noting? Use the buttons below.
      </p>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-green-900/30 border border-green-700/30 rounded-xl px-3 py-2.5 text-center">
          <span className="text-base block mb-0.5">🔍</span>
          <p className="text-green-300 text-xs font-medium">Identify</p>
          <p className="text-stone-500 text-[10px] mt-0.5">
            A tree, shrub, or plant
          </p>
        </div>
        <div className="bg-lime-900/30 border border-lime-700/30 rounded-xl px-3 py-2.5 text-center">
          <span className="text-base block mb-0.5">🌿</span>
          <p className="text-lime-300 text-xs font-medium">Mark Area</p>
          <p className="text-stone-500 text-[10px] mt-0.5">
            A bed, lawn, or patch
          </p>
        </div>
      </div>

      <button
        onClick={onDismiss}
        className="w-full text-stone-500 hover:text-stone-300 text-xs py-1 transition"
      >
        Got it
      </button>
    </div>
  );
}

// ── Screen 4b: Light Suggestion Card ─────────────────────────────────────────

function LightSuggestionCard({ onDismiss }: { onDismiss: () => void }) {
  const hour = new Date().getHours();
  const timeLabel =
    hour < 10 ? "morning" : hour < 14 ? "midday" : hour < 17 ? "afternoon" : "evening";
  const seasonHint = (() => {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return "Spring light shifts fast — even one reading helps.";
    if (month >= 5 && month <= 7) return "Summer light is strongest now. Good time to record it.";
    if (month >= 8 && month <= 10) return "Fall canopy is changing — light readings now are especially useful.";
    return "Winter light is different. Recording it helps with year-round planning.";
  })();

  return (
    <div className="bg-stone-950/90 backdrop-blur-md border border-white/10 rounded-xl px-4 py-4 shadow-2xl">
      <div className="flex items-start gap-3 mb-2">
        <span className="text-2xl flex-none mt-0.5">☀️</span>
        <div>
          <p className="text-yellow-200 text-sm font-medium">
            Good time to record {timeLabel} light
          </p>
          <p className="text-stone-400 text-xs mt-1 leading-relaxed">
            Tap the Light button below to note how much sun this spot gets
            right now. This helps build your light map.
          </p>
        </div>
      </div>
      <p className="text-stone-600 text-[10px] mb-3 ml-9">{seasonHint}</p>

      <button
        onClick={onDismiss}
        className="w-full text-stone-500 hover:text-stone-300 text-xs py-1 transition"
      >
        Got it
      </button>
    </div>
  );
}
