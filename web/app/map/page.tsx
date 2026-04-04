"use client";

/**
 * /map — Layered property map
 *
 * Shows all field mapper data on a satellite map with toggle-able layers:
 * - Walk trails (breadcrumb polylines)
 * - Anchors (reference point pins)
 * - Plants (subjects colored by ecological layer)
 * - Areas (patches as soft regions)
 * - Light (observations colored by level)
 * - Legacy entities (old scan data, off by default)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Polygon = dynamic(() => import("react-leaflet").then((m) => m.Polygon), { ssr: false });
const CircleMarker = dynamic(() => import("react-leaflet").then((m) => m.CircleMarker), { ssr: false });
const Polyline = dynamic(() => import("react-leaflet").then((m) => m.Polyline), { ssr: false });
const Tooltip = dynamic(() => import("react-leaflet").then((m) => m.Tooltip), { ssr: false });

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DEFAULT_CENTER: [number, number] = [35.953, -79.054];
const DEFAULT_ZOOM = 19;

// ── Types ────────────────────────────────────────────────────────────────────

interface LandUnit {
  id: string;
  name: string;
  lat?: number | null;
  lon?: number | null;
}

interface Anchor {
  id: string;
  anchor_type: string;
  label: string;
  device_lat: number | null;
  device_lng: number | null;
}

interface Subject {
  id: string;
  subject_type: string;
  label: string | null;
  device_lat: number | null;
  device_lng: number | null;
  confidence: string;
}

interface Patch {
  id: string;
  patch_type: string;
  label: string | null;
  device_lat: number | null;
  device_lng: number | null;
}

interface WalkSession {
  id: string;
  status: string;
  started_at: string;
  breadcrumb_count?: number;
}

interface Breadcrumb {
  device_lat: number | null;
  device_lng: number | null;
}

interface LightObs {
  id: string;
  time_bucket: string;
  light_level: string;
  device_lat: number | null;
  device_lng: number | null;
}

interface Entity {
  id: string;
  label: string;
  entity_type: string;
  estimated_lat: number | null;
  estimated_lng: number | null;
}

type MapLayer = "trails" | "anchors" | "plants" | "areas" | "light" | "legacy";

const LAYER_CONFIG: Array<{ key: MapLayer; label: string; color: string; defaultOn: boolean }> = [
  { key: "trails",  label: "Trails",  color: "#4ade80", defaultOn: true },
  { key: "anchors", label: "Anchors", color: "#f59e0b", defaultOn: true },
  { key: "plants",  label: "Plants",  color: "#22c55e", defaultOn: true },
  { key: "areas",   label: "Areas",   color: "#a3e635", defaultOn: false },
  { key: "light",   label: "Light",   color: "#fbbf24", defaultOn: false },
  { key: "legacy",  label: "Scans",   color: "#6b7280", defaultOn: false },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function subjectColor(type: string): string {
  if (type === "tree") return "#22c55e";
  if (type === "shrub") return "#84cc16";
  if (type === "groundcover") return "#65a30d";
  return "#4ade80";
}

function lightColor(level: string): string {
  if (level === "full_sun") return "#fbbf24";
  if (level === "part_sun") return "#f59e0b";
  if (level === "dappled") return "#d97706";
  if (level === "part_shade") return "#92400e";
  return "#78350f";
}

function patchColor(type: string): string {
  if (type === "lawn") return "#86efac";
  if (type === "mulch") return "#a16207";
  if (type === "groundcover") return "#65a30d";
  if (type === "mixed_bed") return "#4ade80";
  if (type === "leaf_litter") return "#854d0e";
  if (type === "violet_zone") return "#c084fc";
  return "#6b7280";
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MapPage() {
  const { data: session } = useSession();
  const token = (session as any)?.apiToken as string | undefined;
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  const [places, setPlaces] = useState<LandUnit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Layer data
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [patches, setPatches] = useState<Patch[]>([]);
  const [walks, setWalks] = useState<WalkSession[]>([]);
  const [trails, setTrails] = useState<Array<[number, number][]>>([]);
  const [lightObs, setLightObs] = useState<LightObs[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [parcelRings, setParcelRings] = useState<[number, number][][]>([]);

  // Layer toggles
  const [activeLayers, setActiveLayers] = useState<Set<MapLayer>>(
    new Set(LAYER_CONFIG.filter((l) => l.defaultOn).map((l) => l.key)),
  );

  function toggleLayer(layer: MapLayer) {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  }

  // ── Load places ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) return;
    apiFetch(token, `${API}/land_units`)
      .then((r) => r.json())
      .then((data) => {
        const units: LandUnit[] = Array.isArray(data) ? data : [];
        setPlaces(units);
        if (units.length > 0) setSelectedId(units[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  // ── Load all layer data when property changes ──────────────────────────

  const loadData = useCallback(async (id: string) => {
    const t = tokenRef.current;
    if (!t) return;

    const [anchorsRes, subjectsRes, patchesRes, walksRes, lightRes, entitiesRes] = await Promise.all([
      apiFetch(t, `${API}/land_units/${id}/anchors`).catch(() => null),
      apiFetch(t, `${API}/land_units/${id}/subjects`).catch(() => null),
      apiFetch(t, `${API}/land_units/${id}/patches`).catch(() => null),
      apiFetch(t, `${API}/land_units/${id}/walk-sessions`).catch(() => null),
      apiFetch(t, `${API}/light-observations?land_unit_id=${id}`).catch(() => null),
      apiFetch(t, `${API}/entities?land_unit_id=${id}`).catch(() => null),
    ]);

    if (anchorsRes?.ok) { const d = await anchorsRes.json(); setAnchors(Array.isArray(d) ? d : []); } else setAnchors([]);
    if (subjectsRes?.ok) { const d = await subjectsRes.json(); setSubjects(Array.isArray(d) ? d : []); } else setSubjects([]);
    if (patchesRes?.ok) { const d = await patchesRes.json(); setPatches(Array.isArray(d) ? d : []); } else setPatches([]);
    if (lightRes?.ok) { const d = await lightRes.json(); setLightObs(Array.isArray(d) ? d : []); } else setLightObs([]);
    if (entitiesRes?.ok) { const d = await entitiesRes.json(); setEntities(Array.isArray(d) ? d : []); } else setEntities([]);

    // Fetch parcel boundary — try stored first, then fetch from GIS
    setParcelRings([]);
    try {
      let parcelRes = await apiFetch(t, `${API}/land_units/${id}/parcel`);
      if (!parcelRes.ok) {
        // No stored parcel — try fetching from GIS
        parcelRes = await apiFetch(t, `${API}/land_units/${id}/parcel/fetch`, { method: "POST" });
        if (parcelRes.ok) {
          // Re-fetch the stored parcel to get the geometry
          parcelRes = await apiFetch(t, `${API}/land_units/${id}/parcel`);
        }
      }
      if (parcelRes.ok) {
        const parcelData = await parcelRes.json();
        const geojson = parcelData.geojson;
        if (geojson?.coordinates) {
          // GeoJSON coordinates are [lng, lat] — Leaflet needs [lat, lng]
          const rings = geojson.coordinates.map((ring: number[][]) =>
            ring.map(([lng, lat]: number[]) => [lat, lng] as [number, number]),
          );
          setParcelRings(rings);
        }
      }
    } catch {} // non-critical

    // Load walk sessions + fetch breadcrumbs for each completed walk
    if (walksRes?.ok) {
      const w: WalkSession[] = await walksRes.json();
      setWalks(Array.isArray(w) ? w : []);

      // Fetch breadcrumbs for the most recent walks that have crumbs
      const recentWalks = (Array.isArray(w) ? w : [])
        .filter((ws) => ws.status === "completed" && (ws.breadcrumb_count ?? 0) > 0)
        .slice(0, 8);

      const trailResults = await Promise.all(
        recentWalks.map(async (ws): Promise<[number, number][] | null> => {
          try {
            const r = await apiFetch(t, `${API}/field/walk-sessions/${ws.id}/breadcrumbs`);
            if (!r.ok) return null;
            const crumbs: Array<{ device_lat: number; device_lng: number }> = await r.json();
            if (!Array.isArray(crumbs) || crumbs.length < 2) return null;
            return crumbs
              .filter((c) => c.device_lat && c.device_lng)
              .map((c) => [Number(c.device_lat), Number(c.device_lng)] as [number, number]);
          } catch { return null; }
        }),
      );
      setTrails(trailResults.filter((t): t is [number, number][] => t !== null && t.length >= 2));
    } else {
      setWalks([]);
      setTrails([]);
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadData(selectedId);
  }, [selectedId, loadData]);

  // ── Derived ────────────────────────────────────────────────────────────

  const selectedPlace = places.find((p) => p.id === selectedId) ?? null;
  const center: [number, number] =
    selectedPlace?.lat && selectedPlace?.lon
      ? [Number(selectedPlace.lat), Number(selectedPlace.lon)]
      : DEFAULT_CENTER;

  // Layer counts for toggle pills
  const layerCounts: Record<MapLayer, number> = {
    trails: walks.filter((w) => (w.breadcrumb_count ?? 0) > 0).length,
    anchors: anchors.filter((a) => a.device_lat).length,
    plants: subjects.filter((s) => s.device_lat).length,
    areas: patches.filter((p) => p.device_lat).length,
    light: lightObs.filter((l) => l.device_lat).length,
    legacy: entities.filter((e) => e.estimated_lat).length,
  };

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-screen bg-[#07110c] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-lime-300/30 border-t-lime-300 rounded-full animate-spin" />
      </div>
    );
  }

  if (places.length === 0) {
    return (
      <div className="h-screen bg-[#07110c] flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-white text-lg font-semibold">No properties yet</p>
        <p className="text-stone-400 text-sm text-center">Start observing your yard to see it on the map.</p>
        <a href="/walk" className="bg-green-600 hover:bg-green-500 text-white font-medium rounded-xl px-6 py-3 text-sm transition">
          Start observing
        </a>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#07110c]">
      {/* Property selector (if multiple) */}
      {places.length > 1 && (
        <div className="flex-none border-b border-white/5 px-4 py-2 overflow-x-auto">
          <div className="flex gap-2">
            {places.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition ${
                  selectedId === p.id
                    ? "bg-lime-300 text-zinc-950 border-lime-300"
                    : "bg-white/5 text-zinc-300 border-white/10"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={center}
          zoom={DEFAULT_ZOOM}
          maxZoom={20}
          className="w-full h-full"
          style={{ background: "#07110c" }}
        >
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={20}
          />

          {/* ── Property boundary ───────────────────────────── */}
          {parcelRings.length > 0 && (
            <Polygon
              positions={parcelRings}
              pathOptions={{
                color: "#52b788",
                weight: 2,
                fillColor: "#2d6a4f",
                fillOpacity: 0.08,
                dashArray: "6 3",
              }}
            />
          )}

          {/* ── Trail layer ──────────────────────────────────── */}
          {activeLayers.has("trails") && trails.map((trail, i) => (
            <Polyline
              key={`trail-${i}`}
              positions={trail}
              pathOptions={{ color: "#4ade80", weight: 2, opacity: 0.5 }}
            />
          ))}

          {/* ── Anchor layer ─────────────────────────────────── */}
          {activeLayers.has("anchors") && anchors.map((a) => {
            if (!a.device_lat || !a.device_lng) return null;
            return (
              <CircleMarker
                key={`anchor-${a.id}`}
                center={[Number(a.device_lat), Number(a.device_lng)]}
                radius={7}
                pathOptions={{
                  color: "#f59e0b",
                  fillColor: "#f59e0b",
                  fillOpacity: 0.8,
                  weight: 2,
                }}
              >
                <Tooltip direction="top" offset={[0, -8]} permanent={false}>
                  <span style={{ fontSize: 11 }}>{a.label}</span>
                </Tooltip>
              </CircleMarker>
            );
          })}

          {/* ── Plants layer (subjects) ──────────────────────── */}
          {activeLayers.has("plants") && subjects.map((s) => {
            if (!s.device_lat || !s.device_lng) return null;
            const color = subjectColor(s.subject_type);
            return (
              <CircleMarker
                key={`subj-${s.id}`}
                center={[Number(s.device_lat), Number(s.device_lng)]}
                radius={5}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.7,
                  weight: 1,
                }}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  <span style={{ fontSize: 11 }}>
                    {s.label || s.subject_type}
                    {s.confidence === "provisional" && " (?)"}
                  </span>
                </Tooltip>
              </CircleMarker>
            );
          })}

          {/* ── Areas layer (patches) ────────────────────────── */}
          {activeLayers.has("areas") && patches.map((p) => {
            if (!p.device_lat || !p.device_lng) return null;
            const color = patchColor(p.patch_type);
            return (
              <CircleMarker
                key={`patch-${p.id}`}
                center={[Number(p.device_lat), Number(p.device_lng)]}
                radius={12}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.25,
                  weight: 1,
                  dashArray: "4 2",
                }}
              >
                <Tooltip direction="top" offset={[0, -10]}>
                  <span style={{ fontSize: 11 }}>{p.label || p.patch_type.replace(/_/g, " ")}</span>
                </Tooltip>
              </CircleMarker>
            );
          })}

          {/* ── Light layer ──────────────────────────────────── */}
          {activeLayers.has("light") && lightObs.map((lo) => {
            if (!lo.device_lat || !lo.device_lng) return null;
            const color = lightColor(lo.light_level);
            return (
              <CircleMarker
                key={`light-${lo.id}`}
                center={[Number(lo.device_lat), Number(lo.device_lng)]}
                radius={5}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.6, weight: 1 }}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  <span style={{ fontSize: 11 }}>
                    {lo.light_level.replace(/_/g, " ")} · {lo.time_bucket}
                  </span>
                </Tooltip>
              </CircleMarker>
            );
          })}

          {/* ── Legacy entity layer ──────────────────────────── */}
          {activeLayers.has("legacy") && entities.map((e) => {
            if (!e.estimated_lat || !e.estimated_lng) return null;
            return (
              <CircleMarker
                key={`entity-${e.id}`}
                center={[Number(e.estimated_lat), Number(e.estimated_lng)]}
                radius={4}
                pathOptions={{
                  color: "#6b7280",
                  fillColor: "#6b7280",
                  fillOpacity: 0.5,
                  weight: 1,
                }}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  <span style={{ fontSize: 11 }}>{e.label}</span>
                </Tooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {/* ── Layer toggle panel ──────────────────────────────── */}
        <div className="absolute bottom-20 left-3 z-[1000] flex flex-col gap-1.5">
          {LAYER_CONFIG.map(({ key, label, color }) => {
            const count = layerCounts[key];
            const active = activeLayers.has(key);
            if (count === 0 && !active) return null; // hide empty layers
            return (
              <button
                key={key}
                onClick={() => toggleLayer(key)}
                className={[
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-medium transition backdrop-blur-sm",
                  active
                    ? "bg-black/60 text-white"
                    : "bg-black/30 text-white/30",
                ].join(" ")}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: active ? color : "#555" }}
                />
                {label}
                {count > 0 && <span className="text-white/40">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
