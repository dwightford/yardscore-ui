"use client";

/**
 * /field — Property Memory surface
 *
 * Front-door-first entry to YardScore. Instead of jumping straight into
 * a scan, the user builds a durable mental model of their property:
 * anchors (named reference points), subjects (individual plants/trees),
 * and patches (ground-cover areas), all tied to walk sessions.
 *
 * Stage 1 behaviour:
 *  - Show property memory state fetched from GET /land_units/{id}/memory
 *  - Prompt to set front door anchor when none exists
 *  - "Start Walk" → POST /field/walk-sessions → active walk HUD
 *  - Active walk HUD: Add Anchor / Tag Subject / Tag Patch / End Walk
 *  - Small Leaflet map showing anchors + subjects + patches as pins
 *  - "End Walk" → POST /field/walk-sessions/{id}/end
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import NavBar from "../components/NavBar";
import { apiFetch } from "@/lib/api";

// ── Dynamic Leaflet imports (no SSR) ─────────────────────────────────────────

const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false },
);
const CircleMarker = dynamic(
  () => import("react-leaflet").then((m) => m.CircleMarker),
  { ssr: false },
);
const Popup = dynamic(
  () => import("react-leaflet").then((m) => m.Popup),
  { ssr: false },
);

// ── Config ────────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DEFAULT_CENTER: [number, number] = [37.77, -122.41];

// ── Types ─────────────────────────────────────────────────────────────────────

interface LandUnit {
  id: string;
  name: string;
  address?: string | null;
  lat?: number | null;
  lon?: number | null;
}

interface Anchor {
  id: string;
  anchor_type: string;
  label: string;
  confidence: number;
  device_lat?: number | null;
  device_lng?: number | null;
}

interface Subject {
  id: string;
  subject_type: string;
  label?: string | null;
  confidence: string;
  device_lat?: number | null;
  device_lng?: number | null;
}

interface Patch {
  id: string;
  patch_type: string;
  label?: string | null;
  confidence: string;
  device_lat?: number | null;
  device_lng?: number | null;
}

interface PropertyMemory {
  land_unit_id: string;
  memory_stage: string;
  prompt: string;
  has_front_door_anchor: boolean;
  anchor_count: number;
  anchors: Anchor[];
  walk_sessions_completed: number;
  last_walk?: { id: string; started_at: string; quality_score?: number } | null;
  subjects: { total: number; trees: number; shrubs: number; confirmed: number; provisional: number };
  patches: { total: number; confirmed: number; provisional: number };
}

interface WalkSession {
  id: string;
  status: string;
  started_at: string;
}

// ── Anchor type colours ───────────────────────────────────────────────────────

const ANCHOR_COLOR = "#f59e0b";   // amber
const SUBJECT_COLORS: Record<string, string> = {
  tree: "#15803d",
  shrub: "#16a34a",
  specimen: "#4ade80",
  clump: "#86efac",
  unknown: "#6b7280",
};
const PATCH_COLORS: Record<string, string> = {
  lawn: "#86efac",
  mulch: "#92400e",
  leaf_litter: "#d97706",
  groundcover: "#4ade80",
  mixed_bed: "#a3e635",
  bare_soil: "#d6d3d1",
  violet_zone: "#c084fc",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function FieldPage() {
  const { data: session } = useSession();
  const token: string | undefined = (session as any)?.apiToken;

  const [landUnits, setLandUnits] = useState<LandUnit[]>([]);
  const [selectedLandUnit, setSelectedLandUnit] = useState<LandUnit | null>(null);
  const [memory, setMemory] = useState<PropertyMemory | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [patches, setPatches] = useState<Patch[]>([]);

  const [activeWalk, setActiveWalk] = useState<WalkSession | null>(null);
  const [walkHistory, setWalkHistory] = useState<WalkSession[]>([]);

  // Anchor placement mode
  const [placingAnchor, setPlacingAnchor] = useState(false);
  const [anchorLabel, setAnchorLabel] = useState("Front Door");
  const [anchorType, setAnchorType] = useState("front_door");

  // Subject tagging
  const [taggingSubject, setTaggingSubject] = useState(false);
  const [subjectType, setSubjectType] = useState("tree");
  const [subjectLabel, setSubjectLabel] = useState("");

  // Patch tagging
  const [taggingPatch, setTaggingPatch] = useState(false);
  const [patchType, setPatchType] = useState("lawn");
  const [patchLabel, setPatchLabel] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const locationRef = useRef<{ lat: number; lng: number; accuracy: number } | null>(null);
  const watchRef = useRef<number | null>(null);

  // ── Load land units ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) return;
    apiFetch(token, `${API}/land_units`)
      .then((r) => r.json())
      .then((data) => {
        const units: LandUnit[] = Array.isArray(data) ? data : data.land_units ?? [];
        setLandUnits(units);
        if (units.length > 0) setSelectedLandUnit(units[0]);
      })
      .catch(() => setError("Could not load properties"));
  }, [token]);

  // ── Load memory for selected land unit ─────────────────────────────────────

  const loadMemory = useCallback(async () => {
    if (!token || !selectedLandUnit) return;
    setLoading(true);
    try {
      const [memRes, subRes, patRes, walkRes] = await Promise.all([
        apiFetch(token, `${API}/land_units/${selectedLandUnit.id}/memory`),
        apiFetch(token, `${API}/land_units/${selectedLandUnit.id}/subjects`),
        apiFetch(token, `${API}/land_units/${selectedLandUnit.id}/patches`),
        apiFetch(token, `${API}/land_units/${selectedLandUnit.id}/walk-sessions`),
      ]);
      if (memRes.ok) setMemory(await memRes.json());
      if (subRes.ok) setSubjects(await subRes.json());
      if (patRes.ok) setPatches(await patRes.json());
      if (walkRes.ok) {
        const walks: WalkSession[] = await walkRes.json();
        setWalkHistory(walks);
        const active = walks.find((w) => w.status === "active");
        if (active) setActiveWalk(active);
      }
    } catch {
      setError("Could not load property memory");
    } finally {
      setLoading(false);
    }
  }, [token, selectedLandUnit]);

  useEffect(() => {
    loadMemory();
  }, [loadMemory]);

  // ── GPS watch (active during walk) ─────────────────────────────────────────

  const startGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("GPS not available on this device");
      return;
    }
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        locationRef.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setGpsError(null);
      },
      () => setGpsError("Location unavailable"),
      { enableHighAccuracy: true, maximumAge: 2000 },
    );
  }, []);

  const stopGps = useCallback(() => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }, []);

  // ── Walk session actions ────────────────────────────────────────────────────

  const startWalk = async () => {
    if (!token || !selectedLandUnit) return;
    setLoading(true);
    try {
      const res = await apiFetch(token, `${API}/field/walk-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ land_unit_id: selectedLandUnit.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      const walk: WalkSession = await res.json();
      setActiveWalk(walk);
      startGps();
    } catch (e: any) {
      setError(e.message ?? "Could not start walk");
    } finally {
      setLoading(false);
    }
  };

  const endWalk = async () => {
    if (!token || !activeWalk) return;
    setLoading(true);
    try {
      await apiFetch(token, `${API}/field/walk-sessions/${activeWalk.id}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setActiveWalk(null);
      stopGps();
      await loadMemory();
    } catch (e: any) {
      setError(e.message ?? "Could not end walk");
    } finally {
      setLoading(false);
    }
  };

  // ── Anchor / Subject / Patch creation ──────────────────────────────────────

  const placeAnchor = async () => {
    if (!token || !selectedLandUnit) return;
    const loc = locationRef.current;
    setLoading(true);
    try {
      const body: any = {
        anchor_type: anchorType,
        label: anchorLabel,
        device_lat: loc?.lat ?? null,
        device_lng: loc?.lng ?? null,
        accuracy_m: loc?.accuracy ?? null,
      };
      if (activeWalk) body.walk_session_id = activeWalk.id;

      const res = await apiFetch(token, `${API}/land_units/${selectedLandUnit.id}/anchors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setPlacingAnchor(false);
      setAnchorLabel("Front Door");
      setAnchorType("front_door");
      await loadMemory();
    } catch (e: any) {
      setError(e.message ?? "Could not place anchor");
    } finally {
      setLoading(false);
    }
  };

  const tagSubject = async () => {
    if (!token || !selectedLandUnit) return;
    const loc = locationRef.current;
    setLoading(true);
    try {
      const body: any = {
        subject_type: subjectType,
        label: subjectLabel || null,
        device_lat: loc?.lat ?? null,
        device_lng: loc?.lng ?? null,
        accuracy_m: loc?.accuracy ?? null,
      };
      if (activeWalk) body.walk_session_id = activeWalk.id;

      const res = await apiFetch(token, `${API}/land_units/${selectedLandUnit.id}/subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setTaggingSubject(false);
      setSubjectLabel("");
      setSubjectType("tree");
      await loadMemory();
    } catch (e: any) {
      setError(e.message ?? "Could not tag subject");
    } finally {
      setLoading(false);
    }
  };

  const tagPatch = async () => {
    if (!token || !selectedLandUnit) return;
    const loc = locationRef.current;
    setLoading(true);
    try {
      const body: any = {
        patch_type: patchType,
        label: patchLabel || null,
        device_lat: loc?.lat ?? null,
        device_lng: loc?.lng ?? null,
        accuracy_m: loc?.accuracy ?? null,
      };
      if (activeWalk) body.walk_session_id = activeWalk.id;

      const res = await apiFetch(token, `${API}/land_units/${selectedLandUnit.id}/patches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setTaggingPatch(false);
      setPatchLabel("");
      setPatchType("lawn");
      await loadMemory();
    } catch (e: any) {
      setError(e.message ?? "Could not tag patch");
    } finally {
      setLoading(false);
    }
  };

  // ── Derived map centre ──────────────────────────────────────────────────────

  const mapCenter: [number, number] = selectedLandUnit?.lat && selectedLandUnit?.lon
    ? [selectedLandUnit.lat, selectedLandUnit.lon]
    : DEFAULT_CENTER;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-stone-950 text-white flex flex-col">
      <NavBar />
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 pb-6 pt-2 gap-4">

        {/* Property selector */}
        {landUnits.length > 1 && (
          <select
            className="bg-stone-800 border border-stone-600 rounded px-3 py-2 text-sm"
            value={selectedLandUnit?.id ?? ""}
            onChange={(e) => {
              const lu = landUnits.find((l) => l.id === e.target.value);
              if (lu) { setSelectedLandUnit(lu); setMemory(null); }
            }}
          >
            {landUnits.map((lu) => (
              <option key={lu.id} value={lu.id}>{lu.name || lu.address || lu.id}</option>
            ))}
          </select>
        )}

        {error && (
          <div className="bg-red-900/40 border border-red-600 rounded px-3 py-2 text-sm text-red-300 flex items-center gap-2">
            <span>⚠</span><span>{error}</span>
            <button className="ml-auto text-red-400 hover:text-white" onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {/* ── Memory Stage Header ─────────────────────────────────────────── */}
        {memory && (
          <div className="bg-stone-900 border border-stone-700 rounded-xl px-4 pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold text-white">
                {selectedLandUnit?.name || "Property"} Memory
              </h2>
              <StageChip stage={memory.memory_stage} />
            </div>
            <p className="text-stone-400 text-sm mb-3">{memory.prompt}</p>

            {/* Counts row */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <MemStat value={memory.anchor_count} label="Anchors" accent="text-amber-400" />
              <MemStat value={memory.walk_sessions_completed} label="Walks" accent="text-sky-400" />
              <MemStat value={memory.subjects.total} label="Subjects" accent="text-green-400" />
              <MemStat value={memory.patches.total} label="Patches" accent="text-purple-400" />
            </div>

            {/* Last walk */}
            {memory.last_walk && (
              <p className="text-stone-500 text-xs mt-2">
                Last walk {new Date(memory.last_walk.started_at).toLocaleDateString()}
                {memory.last_walk.quality_score != null && (
                  <span className="ml-2">· quality {(memory.last_walk.quality_score * 100).toFixed(0)}%</span>
                )}
              </p>
            )}
          </div>
        )}

        {/* ── Map ────────────────────────────────────────────────────────────── */}
        {selectedLandUnit && (
          <div className="rounded-xl overflow-hidden border border-stone-700" style={{ height: 260 }}>
            <MapContainer
              center={mapCenter}
              zoom={19}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; Esri'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
              {/* Anchor pins */}
              {memory?.anchors.map((a) =>
                a.device_lat && a.device_lng ? (
                  <CircleMarker
                    key={a.id}
                    center={[a.device_lat, a.device_lng]}
                    radius={8}
                    pathOptions={{ color: ANCHOR_COLOR, fillColor: ANCHOR_COLOR, fillOpacity: 0.9 }}
                  >
                    <Popup>{a.label} <br /><span style={{ opacity: 0.7, fontSize: 11 }}>{a.anchor_type}</span></Popup>
                  </CircleMarker>
                ) : null,
              )}
              {/* Subject pins */}
              {subjects.map((s) =>
                s.device_lat && s.device_lng ? (
                  <CircleMarker
                    key={s.id}
                    center={[s.device_lat, s.device_lng]}
                    radius={6}
                    pathOptions={{
                      color: SUBJECT_COLORS[s.subject_type] ?? "#6b7280",
                      fillColor: SUBJECT_COLORS[s.subject_type] ?? "#6b7280",
                      fillOpacity: 0.8,
                    }}
                  >
                    <Popup>{s.label || s.subject_type} · <em>{s.confidence}</em></Popup>
                  </CircleMarker>
                ) : null,
              )}
              {/* Patch pins */}
              {patches.map((p) =>
                p.device_lat && p.device_lng ? (
                  <CircleMarker
                    key={p.id}
                    center={[p.device_lat, p.device_lng]}
                    radius={5}
                    pathOptions={{
                      color: PATCH_COLORS[p.patch_type] ?? "#6b7280",
                      fillColor: PATCH_COLORS[p.patch_type] ?? "#6b7280",
                      fillOpacity: 0.6,
                      dashArray: "4 3",
                    }}
                  >
                    <Popup>{p.label || p.patch_type} · <em>{p.confidence}</em></Popup>
                  </CircleMarker>
                ) : null,
              )}
            </MapContainer>
          </div>
        )}

        {/* ── Active Walk HUD ────────────────────────────────────────────────── */}
        {activeWalk ? (
          <div className="bg-green-950 border border-green-700 rounded-xl px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-300 text-sm font-semibold flex items-center gap-1">
                <span className="animate-pulse w-2 h-2 bg-green-400 rounded-full inline-block" />
                Walk in progress
              </span>
              {gpsError && <span className="text-xs text-yellow-400">⚠ {gpsError}</span>}
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button
                className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg py-2 transition"
                onClick={() => { setPlacingAnchor(true); setTaggingSubject(false); setTaggingPatch(false); }}
              >
                📍 Anchor
              </button>
              <button
                className="bg-green-700 hover:bg-green-600 text-white text-sm font-medium rounded-lg py-2 transition"
                onClick={() => { setTaggingSubject(true); setPlacingAnchor(false); setTaggingPatch(false); }}
              >
                🌳 Subject
              </button>
              <button
                className="bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium rounded-lg py-2 transition"
                onClick={() => { setTaggingPatch(true); setPlacingAnchor(false); setTaggingSubject(false); }}
              >
                🌿 Patch
              </button>
            </div>
            <button
              className="w-full bg-stone-700 hover:bg-stone-600 text-stone-200 text-sm font-medium rounded-lg py-2 transition"
              onClick={endWalk}
              disabled={loading}
            >
              {loading ? "Ending…" : "End Walk"}
            </button>
          </div>
        ) : (
          /* ── Start Walk / No Walk ───────────────────────────────────────── */
          <div className="flex flex-col gap-2">
            {/* Establish front door CTA when memory is unstarted */}
            {memory?.memory_stage === "unstarted" && !placingAnchor && (
              <button
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl py-3 transition"
                onClick={() => { setPlacingAnchor(true); setAnchorType("front_door"); setAnchorLabel("Front Door"); }}
              >
                📍 Set Front Door Anchor
              </button>
            )}
            <button
              className="w-full bg-green-700 hover:bg-green-600 text-white font-semibold rounded-xl py-3 transition"
              onClick={startWalk}
              disabled={loading || !selectedLandUnit}
            >
              {loading ? "Starting…" : "▶ Start Walk"}
            </button>
          </div>
        )}

        {/* ── Anchor placement form ─────────────────────────────────────────── */}
        {placingAnchor && (
          <div className="bg-stone-900 border border-amber-700 rounded-xl px-4 py-3">
            <h3 className="text-amber-300 text-sm font-semibold mb-2">Place Anchor</h3>
            <label className="text-stone-400 text-xs block mb-1">Type</label>
            <select
              className="bg-stone-800 border border-stone-600 rounded px-2 py-1 text-sm w-full mb-2"
              value={anchorType}
              onChange={(e) => setAnchorType(e.target.value)}
            >
              {["front_door", "side_door", "back_door", "driveway_corner", "big_tree", "shed_corner", "custom"].map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
            <label className="text-stone-400 text-xs block mb-1">Label</label>
            <input
              className="bg-stone-800 border border-stone-600 rounded px-2 py-1 text-sm w-full mb-3"
              value={anchorLabel}
              onChange={(e) => setAnchorLabel(e.target.value)}
              placeholder="e.g. Front Door"
            />
            <div className="flex gap-2">
              <button
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg py-2 transition"
                onClick={placeAnchor}
                disabled={loading || !anchorLabel.trim()}
              >
                {loading ? "Saving…" : "Save Anchor"}
              </button>
              <button
                className="flex-1 bg-stone-700 hover:bg-stone-600 text-stone-300 text-sm rounded-lg py-2 transition"
                onClick={() => setPlacingAnchor(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Subject tagging form ──────────────────────────────────────────── */}
        {taggingSubject && (
          <div className="bg-stone-900 border border-green-700 rounded-xl px-4 py-3">
            <h3 className="text-green-300 text-sm font-semibold mb-2">Tag Subject</h3>
            <label className="text-stone-400 text-xs block mb-1">Type</label>
            <select
              className="bg-stone-800 border border-stone-600 rounded px-2 py-1 text-sm w-full mb-2"
              value={subjectType}
              onChange={(e) => setSubjectType(e.target.value)}
            >
              {["tree", "shrub", "specimen", "clump", "unknown"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <label className="text-stone-400 text-xs block mb-1">Label (optional)</label>
            <input
              className="bg-stone-800 border border-stone-600 rounded px-2 py-1 text-sm w-full mb-3"
              value={subjectLabel}
              onChange={(e) => setSubjectLabel(e.target.value)}
              placeholder="e.g. Big oak by fence"
            />
            <div className="flex gap-2">
              <button
                className="flex-1 bg-green-700 hover:bg-green-600 text-white text-sm font-medium rounded-lg py-2 transition"
                onClick={tagSubject}
                disabled={loading}
              >
                {loading ? "Saving…" : "Tag Subject"}
              </button>
              <button
                className="flex-1 bg-stone-700 hover:bg-stone-600 text-stone-300 text-sm rounded-lg py-2 transition"
                onClick={() => setTaggingSubject(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Patch tagging form ────────────────────────────────────────────── */}
        {taggingPatch && (
          <div className="bg-stone-900 border border-purple-700 rounded-xl px-4 py-3">
            <h3 className="text-purple-300 text-sm font-semibold mb-2">Tag Patch</h3>
            <label className="text-stone-400 text-xs block mb-1">Type</label>
            <select
              className="bg-stone-800 border border-stone-600 rounded px-2 py-1 text-sm w-full mb-2"
              value={patchType}
              onChange={(e) => setPatchType(e.target.value)}
            >
              {["lawn", "mulch", "leaf_litter", "groundcover", "mixed_bed", "bare_soil", "violet_zone"].map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
            <label className="text-stone-400 text-xs block mb-1">Label (optional)</label>
            <input
              className="bg-stone-800 border border-stone-600 rounded px-2 py-1 text-sm w-full mb-3"
              value={patchLabel}
              onChange={(e) => setPatchLabel(e.target.value)}
              placeholder="e.g. Side lawn"
            />
            <div className="flex gap-2">
              <button
                className="flex-1 bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium rounded-lg py-2 transition"
                onClick={tagPatch}
                disabled={loading}
              >
                {loading ? "Saving…" : "Tag Patch"}
              </button>
              <button
                className="flex-1 bg-stone-700 hover:bg-stone-600 text-stone-300 text-sm rounded-lg py-2 transition"
                onClick={() => setTaggingPatch(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Walk history ──────────────────────────────────────────────────── */}
        {walkHistory.length > 0 && (
          <div>
            <h3 className="text-stone-500 text-xs font-semibold uppercase tracking-wide mb-2">Walk History</h3>
            <div className="flex flex-col gap-1">
              {walkHistory.slice(0, 5).map((w) => (
                <div key={w.id} className="bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="text-stone-300 text-sm">{new Date(w.started_at).toLocaleDateString()}</span>
                  <StatusBadge status={w.status} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Legend ────────────────────────────────────────────────────────── */}
        {(memory?.anchor_count ?? 0) + subjects.length + patches.length > 0 && (
          <div className="flex flex-wrap gap-3 text-xs text-stone-400">
            <LegendDot color={ANCHOR_COLOR} label="Anchor" />
            <LegendDot color={SUBJECT_COLORS.tree} label="Tree" />
            <LegendDot color={SUBJECT_COLORS.shrub} label="Shrub" />
            <LegendDot color={PATCH_COLORS.lawn} label="Lawn" />
            <LegendDot color={PATCH_COLORS.mulch} label="Mulch" />
            <LegendDot color={PATCH_COLORS.violet_zone} label="Violet zone" />
          </div>
        )}

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MemStat({ value, label, accent }: { value: number; label: string; accent: string }) {
  return (
    <div className="bg-stone-800 rounded-lg py-2">
      <p className={`text-xl font-bold ${accent}`}>{value}</p>
      <p className="text-stone-500 text-xs">{label}</p>
    </div>
  );
}

function StageChip({ stage }: { stage: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    unstarted: { label: "Unstarted", cls: "bg-stone-700 text-stone-300" },
    walked_no_origin: { label: "No Origin", cls: "bg-yellow-900 text-yellow-300" },
    origin_only: { label: "Origin Set", cls: "bg-amber-900 text-amber-300" },
    forming: { label: "Forming", cls: "bg-blue-900 text-blue-300" },
    established: { label: "Established", cls: "bg-green-900 text-green-300" },
  };
  const { label, cls } = map[stage] ?? { label: stage, cls: "bg-stone-700 text-stone-300" };
  return <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${cls}`}>{label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    active: "bg-green-900 text-green-300",
    completed: "bg-sky-900 text-sky-300",
    abandoned: "bg-stone-700 text-stone-400",
  };
  return (
    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${cls[status] ?? "bg-stone-700 text-stone-400"}`}>
      {status}
    </span>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
