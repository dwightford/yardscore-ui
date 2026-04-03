"use client";

/**
 * FieldMapperShell
 *
 * Top-level HUD shell for the YardScore field capture experience.
 *
 * Dual-mode:
 *   - Live API mode (token + landUnitId): persists to server, GPS active,
 *     live camera, PlantNet ID, readiness-driven suggestions, breadcrumb trail,
 *     camera overlay badges, post-walk review with trail map
 *   - Demo/seed mode: local state only, all interactions work without network
 *
 * Layout (top → bottom):
 *   SessionStatusStrip   ← thin, always-visible status bar
 *   CameraFeed + overlay ← flex-1, live camera or dark placeholder
 *   ContextPanel         ← appears over camera when a mode is open
 *   WalkReview           ← appears when walk ends
 *   BottomActionRail     ← fixed bottom chrome
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";

import SessionStatusStrip, { type StripState } from "./SessionStatusStrip";
import BottomActionRail, { type ActionMode } from "./BottomActionRail";
import ContextPanel, { type WalkState } from "./ContextPanel";
import CameraFeed, { type CameraFeedHandle } from "./CameraFeed";
import CameraOverlay, { type AnchorBadge, type SubjectBadge, type AreaBadge } from "./CameraOverlay";
import WalkReview, { type WalkReviewData, type MapPin } from "./WalkReview";
import { useGps } from "@/hooks/useGps";
import { useWalkTrail } from "@/hooks/useWalkTrail";
import * as fieldApi from "@/lib/field-api";

// ── Seed state type ───────────────────────────────────────────────────────────

export interface FieldMapperSeedState {
  walkActive?: boolean;
  walkStartedAt?: string;
  anchorCount?: number;
  areaCount?: number;
  subjectCount?: number;
  initialStripState?: StripState;
  hasOriginAnchor?: boolean;
}

export interface FieldMapperShellProps {
  seed?: FieldMapperSeedState;
  propertyLabel?: string;
  token?: string;
  landUnitId?: string;
  onViewProperty?: () => void;
}

// ── Shell ─────────────────────────────────────────────────────────────────────

export default function FieldMapperShell({
  seed,
  propertyLabel,
  token,
  landUnitId,
  onViewProperty,
}: FieldMapperShellProps) {
  const isLive = Boolean(token && landUnitId);
  const router = useRouter();

  // ── GPS + Trail ───────────────────────────────────────────────────────────
  const { locationRef, gpsError, startGps, stopGps } = useGps();
  const { trail, startRecording, stopRecording, clearTrail } = useWalkTrail(locationRef);

  // ── Camera ────────────────────────────────────────────────────────────────
  const cameraHandleRef = useRef<CameraFeedHandle | null>(null);
  const handleCameraReady = useCallback((handle: CameraFeedHandle) => {
    cameraHandleRef.current = handle;
  }, []);
  const captureFrame = useCallback(async (): Promise<Blob | null> => {
    return cameraHandleRef.current?.captureFrame() ?? null;
  }, []);

  // ── Walk state ────────────────────────────────────────────────────────────
  const [walkActive, setWalkActive] = useState(seed?.walkActive ?? false);
  const [walkStartedAt, setWalkStartedAt] = useState<Date | undefined>(
    seed?.walkStartedAt ? new Date(seed.walkStartedAt) : undefined,
  );
  const [walkSessionId, setWalkSessionId] = useState<string | null>(null);
  const [anchorCount, setAnchorCount] = useState(seed?.anchorCount ?? 0);
  const [areaCount, setAreaCount] = useState(seed?.areaCount ?? 0);
  const [subjectCount, setSubjectCount] = useState(seed?.subjectCount ?? 0);

  // ── Badge state (for overlay + review map) ────────────────────────────────
  const [anchorBadges, setAnchorBadges] = useState<AnchorBadge[]>([]);
  const [subjectBadges, setSubjectBadges] = useState<SubjectBadge[]>([]);
  const [areaBadges, setAreaBadges] = useState<AreaBadge[]>([]);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeMode, setActiveMode] = useState<ActionMode>("walk");
  const [panelOpen, setPanelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightSavedThisSession, setLightSavedThisSession] = useState(false);
  const [transientStrip, setTransientStrip] = useState<StripState | null>(null);
  const [reviewData, setReviewData] = useState<WalkReviewData | null>(null);
  const [nextObs, setNextObs] = useState<fieldApi.NextObservation | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── Readiness-driven strip state ──────────────────────────────────────────

  const derivedStripState = useMemo((): StripState => {
    if (!walkActive) {
      if (seed?.initialStripState && !walkSessionId) return seed.initialStripState;
      return "no_walk";
    }
    if (anchorCount === 0) return "anchor_suggested";
    if (nextObs && nextObs.observation_type === "light_profile" && !lightSavedThisSession) {
      return "light_suggested";
    }
    const hour = new Date().getHours();
    if (hour >= 12 && hour < 17 && !lightSavedThisSession) return "light_suggested";
    return "walk_active";
  }, [walkActive, anchorCount, lightSavedThisSession, seed?.initialStripState, walkSessionId, nextObs]);

  const stripState = transientStrip ?? derivedStripState;

  const flashStrip = useCallback((state: StripState, ms = 3000) => {
    clearTimeout(flashTimer.current);
    setTransientStrip(state);
    flashTimer.current = setTimeout(() => setTransientStrip(null), ms);
  }, []);

  // ── Auto-dismiss error ────────────────────────────────────────────────────

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  // ── Fetch readiness + property memory on mount (live mode) ────────────────

  useEffect(() => {
    if (!isLive) return;
    // Readiness
    fieldApi.fetchNextObservation(token!, landUnitId!).then(setNextObs).catch(() => {});
    // Hydrate badge state from existing property memory
    fieldApi.fetchPropertyMemory(token!, landUnitId!).then((mem) => {
      if (!mem) return;
      setAnchorBadges(
        mem.anchors.map((a) => ({ id: a.id, label: a.label, type: a.anchor_type })),
      );
    }).catch(() => {});
    fieldApi.fetchSubjects(token!, landUnitId!).then((subs) => {
      setSubjectBadges(
        subs.map((s) => ({ id: s.id, label: s.label || s.subject_type, type: s.subject_type })),
      );
    }).catch(() => {});
    fieldApi.fetchPatches(token!, landUnitId!).then((pats) => {
      setAreaBadges(
        pats.map((p) => ({ id: p.id, label: p.label || p.patch_type, type: p.patch_type })),
      );
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive]);

  // ── Resume active walk on mount (live mode) ───────────────────────────────

  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    fieldApi.fetchActiveWalk(token!, landUnitId!).then((walk) => {
      if (cancelled || !walk) return;
      setWalkActive(true);
      setWalkSessionId(walk.id);
      setWalkStartedAt(new Date(walk.started_at));
      startGps();
      startRecording();
    });
    // Also hydrate counts from memory
    fieldApi.fetchPropertyMemory(token!, landUnitId!).then((mem) => {
      if (cancelled || !mem) return;
      setAnchorCount(mem.anchor_count);
      setSubjectCount(mem.subjects.total);
      setAreaCount(mem.patches.total);
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive]);

  // ── GPS coordinate helper ─────────────────────────────────────────────────

  const gpsCoords = useCallback(() => {
    const loc = locationRef.current;
    return {
      device_lat: loc?.lat ?? null,
      device_lng: loc?.lng ?? null,
      accuracy_m: loc?.accuracy ?? null,
    };
  }, [locationRef]);

  // ── Navigation helper ─────────────────────────────────────────────────────

  const handleNavigate = useCallback((path: string) => {
    // For property route, append the land unit ID
    if (path === "/property" && landUnitId) {
      router.push(`/property/${landUnitId}`);
    } else {
      router.push(path);
    }
  }, [router, landUnitId]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleModeSelect = useCallback((mode: ActionMode) => {
    setActiveMode(mode);
    setPanelOpen(true);
  }, []);

  const handleClosePanel = useCallback(() => {
    setPanelOpen(false);
  }, []);

  const handleStartWalk = useCallback(async () => {
    if (isLive) {
      try {
        const walk = await fieldApi.startWalk(token!, landUnitId!);
        setWalkSessionId(walk.id);
        startGps();
        startRecording();
      } catch (e: any) {
        setError(e.message ?? "Could not start walk");
        return;
      }
    }
    setWalkActive(true);
    setWalkStartedAt(new Date());
    setReviewData(null);
    setPanelOpen(false);
  }, [isLive, token, landUnitId, startGps, startRecording]);

  const handleEndWalk = useCallback(async () => {
    if (isLive && walkSessionId) {
      try {
        await fieldApi.endWalk(token!, walkSessionId);
      } catch (e: any) {
        setError(e.message ?? "Could not end walk");
        return;
      }
    }

    const duration = walkStartedAt
      ? Math.floor((Date.now() - walkStartedAt.getTime()) / 1000)
      : 0;

    // Build map pins from badges that have GPS coords
    const anchorPins: MapPin[] = [];
    const subjectPins: MapPin[] = [];
    const areaPins: MapPin[] = [];

    // We'll fetch fresh data for pins if live
    if (isLive) {
      try {
        const [mem, subs, pats] = await Promise.all([
          fieldApi.fetchPropertyMemory(token!, landUnitId!),
          fieldApi.fetchSubjects(token!, landUnitId!),
          fieldApi.fetchPatches(token!, landUnitId!),
        ]);
        if (mem) {
          mem.anchors.forEach((a) => {
            if (a.device_lat && a.device_lng) {
              anchorPins.push({ lat: a.device_lat, lng: a.device_lng, label: a.label, color: "#f59e0b" });
            }
          });
        }
        subs.forEach((s) => {
          if (s.device_lat && s.device_lng) {
            subjectPins.push({ lat: s.device_lat, lng: s.device_lng, label: s.label || s.subject_type, color: "#22c55e" });
          }
        });
        pats.forEach((p) => {
          if (p.device_lat && p.device_lng) {
            areaPins.push({ lat: p.device_lat, lng: p.device_lng, label: p.label || p.patch_type, color: "#a3e635" });
          }
        });
      } catch { /* non-critical */ }
    }

    setReviewData({
      duration,
      anchorCount,
      subjectCount,
      areaCount,
      lightRecorded: lightSavedThisSession,
      trail: [...trail],
      anchorPins,
      subjectPins,
      areaPins,
    });

    setWalkActive(false);
    setWalkSessionId(null);
    setLightSavedThisSession(false);
    stopGps();
    stopRecording();
    setPanelOpen(false);
  }, [isLive, token, landUnitId, walkSessionId, walkStartedAt, anchorCount, subjectCount, areaCount, lightSavedThisSession, trail, stopGps, stopRecording]);

  const handleSaveAnchor = useCallback(async (type: string, label: string) => {
    if (isLive) {
      try {
        const coords = gpsCoords();
        const anchor = await fieldApi.saveAnchor(token!, landUnitId!, {
          anchor_type: type,
          label,
          ...coords,
          ...(walkSessionId ? { walk_session_id: walkSessionId } : {}),
        });
        setAnchorBadges((prev) => [...prev, { id: anchor.id, label, type, recent: true }]);
      } catch (e: any) {
        setError(e.message ?? "Could not save reference point");
        return;
      }
    } else {
      setAnchorBadges((prev) => [...prev, { id: `local-${Date.now()}`, label, type, recent: true }]);
    }
    setAnchorCount((n) => n + 1);
    flashStrip("anchor_confirmed");
    setPanelOpen(false);
  }, [isLive, token, landUnitId, walkSessionId, gpsCoords, flashStrip]);

  const handleSaveArea = useCallback(async (type: string, label: string) => {
    if (isLive) {
      try {
        const coords = gpsCoords();
        const patch = await fieldApi.savePatch(token!, landUnitId!, {
          patch_type: type,
          label: label || null,
          ...coords,
          ...(walkSessionId ? { walk_session_id: walkSessionId } : {}),
        });
        setAreaBadges((prev) => [...prev, { id: patch.id, label: label || type, type, recent: true }]);
      } catch (e: any) {
        setError(e.message ?? "Could not mark area");
        return;
      }
    } else {
      setAreaBadges((prev) => [...prev, { id: `local-${Date.now()}`, label: label || type, type, recent: true }]);
    }
    setAreaCount((n) => n + 1);
    flashStrip("area_marked");
    setPanelOpen(false);
  }, [isLive, token, landUnitId, walkSessionId, gpsCoords, flashStrip]);

  const handleTagSubject = useCallback(async (type: string, label: string) => {
    if (isLive) {
      try {
        const coords = gpsCoords();
        const subject = await fieldApi.saveSubject(token!, landUnitId!, {
          subject_type: type,
          label: label || null,
          ...coords,
          ...(walkSessionId ? { walk_session_id: walkSessionId } : {}),
        });
        setSubjectBadges((prev) => [...prev, { id: subject.id, label: label || type, type, recent: true }]);
      } catch (e: any) {
        setError(e.message ?? "Could not note plant");
        return;
      }
    } else {
      setSubjectBadges((prev) => [...prev, { id: `local-${Date.now()}`, label: label || type, type, recent: true }]);
    }
    setSubjectCount((n) => n + 1);
    flashStrip("subject_tagged");
    setPanelOpen(false);
  }, [isLive, token, landUnitId, walkSessionId, gpsCoords, flashStrip]);

  const handleSaveLight = useCallback(async (direction: string, condition: string) => {
    if (isLive) {
      try {
        const loc = locationRef.current;
        await fieldApi.saveLight(token!, {
          land_unit_id: landUnitId!,
          direction,
          condition,
          lat: loc?.lat ?? null,
          lng: loc?.lng ?? null,
        });
      } catch (e: any) {
        setError(e.message ?? "Could not record light");
        return;
      }
    }
    setLightSavedThisSession(true);
    flashStrip("walk_active");
    setPanelOpen(false);
  }, [isLive, token, landUnitId, locationRef, flashStrip]);

  const handleDismissReview = useCallback(() => {
    setReviewData(null);
    clearTrail();
  }, [clearTrail]);

  const handleStartNewWalkFromReview = useCallback(() => {
    setReviewData(null);
    clearTrail();
    setAnchorCount(0);
    setAreaCount(0);
    setSubjectCount(0);
    // Clear "recent" flags on badges
    setAnchorBadges((prev) => prev.map((b) => ({ ...b, recent: false })));
    setSubjectBadges((prev) => prev.map((b) => ({ ...b, recent: false })));
    setAreaBadges((prev) => prev.map((b) => ({ ...b, recent: false })));
    handleStartWalk();
  }, [clearTrail, handleStartWalk]);

  // ── Walk state for ContextPanel ───────────────────────────────────────────

  const walkState: WalkState = {
    active: walkActive,
    anchorCount,
    areaCount,
    subjectCount,
    startedAt: walkStartedAt,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="relative w-full h-[100dvh] overflow-hidden bg-black select-none"
      style={{ touchAction: "none" }}
    >
      {/* ── Layer 1: Live camera ──────────────────────────────────────── */}
      <CameraFeed onReady={handleCameraReady} active={walkActive}>
        <CameraOverlay
          trail={trail}
          anchors={anchorBadges}
          subjects={subjectBadges}
          areas={areaBadges}
          lightRecorded={lightSavedThisSession}
          walkActive={walkActive}
        />
      </CameraFeed>

      {/* ── Layer 2: Status strip (top chrome) ────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-10">
        <SessionStatusStrip
          state={stripState}
          propertyLabel={propertyLabel}
          detail={
            nextObs && walkActive && stripState === "walk_active"
              ? nextObs.description
              : undefined
          }
        />
        {walkActive && gpsError && (
          <div className="px-4 py-1 bg-yellow-900/60 border-b border-yellow-700/30">
            <p className="text-yellow-400 text-[10px]">
              Location unavailable — points will be saved without coordinates
            </p>
          </div>
        )}
        {error && (
          <div className="mx-4 mt-1 px-3 py-2 bg-red-900/70 border border-red-700/50 rounded-xl">
            <p className="text-red-300 text-xs">{error}</p>
          </div>
        )}
      </div>

      {/* ── Layer 3: Context panel (animated slide-up) ─────────────────── */}
      <AnimatePresence>
        {panelOpen && !reviewData && (
          <motion.div
            key="context-panel"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="absolute inset-0 z-20"
          >
            <ContextPanel
              mode={activeMode}
              walkState={walkState}
              onStartWalk={handleStartWalk}
              onEndWalk={handleEndWalk}
              onSaveAnchor={handleSaveAnchor}
              onSaveArea={handleSaveArea}
              onTagSubject={handleTagSubject}
              onSaveLight={handleSaveLight}
              onClose={handleClosePanel}
              captureFrame={captureFrame}
              onNavigate={handleNavigate}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Layer 3b: Walk review (after walk ends) ───────────────────── */}
      <AnimatePresence>
        {reviewData && (
          <motion.div
            key="walk-review"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
          >
            <WalkReview
              data={reviewData}
              propertyLabel={propertyLabel}
              onStartNewWalk={handleStartNewWalkFromReview}
              onViewProperty={onViewProperty}
              onDismiss={handleDismissReview}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Layer 4: Bottom action rail ────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <BottomActionRail
          activeMode={activeMode}
          walkActive={walkActive}
          onSelect={handleModeSelect}
        />
      </div>
    </div>
  );
}
