"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import NavBar from "../components/NavBar";

// ── Dynamic imports (Leaflet does not support SSR) ────────────────────────────

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false },
);
const Polygon = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polygon),
  { ssr: false },
);
const CircleMarker = dynamic(
  () => import("react-leaflet").then((mod) => mod.CircleMarker),
  { ssr: false },
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false },
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false },
);
const Tooltip = dynamic(
  () => import("react-leaflet").then((mod) => mod.Tooltip),
  { ssr: false },
);

// ── Config ────────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DEFAULT_CENTER: [number, number] = [35.91, -79.05];
const DEFAULT_ZOOM = 19; // property level — ESRI satellite available at this zoom

// ── Types ─────────────────────────────────────────────────────────────────────

interface LandUnit {
  id: string;
  name: string;
  land_unit_type: string;
  address: string | null;
  lat?: number | null;
  lon?: number | null;
}

interface Parcel {
  id: string;
  land_unit_id: string;
  geojson?: GeoJSON.Geometry | null;
}

interface Entity {
  id: string;
  land_unit_id: string;
  label: string;
  entity_type: string;
  size_class: string | null;
  estimated_lat: number | null;
  estimated_lng: number | null;
  observation_count: number;
  first_observed: string | null;
  last_observed: string | null;
}

interface LightObs {
  id: string;
  time_bucket: string;
  light_level: string;
  device_lat: number | null;
  device_lng: number | null;
  observed_at: string;
}

type MapLayer = "plants" | "light" | "structure";

// ── Helpers ───────────────────────────────────────────────────────────────────

function entityColor(type: string): string {
  const t = type.toLowerCase();
  if (t === "tree") return "#84cc16";
  if (t === "shrub") return "#22c55e";
  if (t === "herb") return "#a3e635";
  if (t === "ground_cover") return "#65a30d";
  if (t === "structure") return "#6b7280";
  return "#84cc16";
}

function entityRadius(type: string): number {
  const t = type.toLowerCase();
  if (t === "tree") return 10;
  if (t === "shrub") return 7;
  if (t === "herb") return 5;
  if (t === "ground_cover") return 4;
  return 6;
}


/** Convert GeoJSON Polygon/MultiPolygon coordinates to Leaflet LatLng arrays */
function geojsonToLatLngs(
  geometry: GeoJSON.Geometry,
): [number, number][][] {
  if (geometry.type === "Polygon") {
    return (geometry as GeoJSON.Polygon).coordinates.map((ring) =>
      ring.map(([lng, lat]) => [lat, lng] as [number, number]),
    );
  }
  if (geometry.type === "MultiPolygon") {
    return (geometry as GeoJSON.MultiPolygon).coordinates.flatMap((poly) =>
      poly.map((ring) =>
        ring.map(([lng, lat]) => [lat, lng] as [number, number]),
      ),
    );
  }
  return [];
}

/** Create a colored circle divIcon for entity markers — supports drag */
function makeEntityIcon(type: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const L = require("leaflet");
  const size = entityRadius(type) * 2 + 4; // +4 for border
  const color = entityColor(type);
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:2px solid rgba(255,255,255,0.6);
      box-shadow:0 1px 4px rgba(0,0,0,0.5);
      cursor:grab;
    "></div>`,
  });
}

/** Update entity position via API after drag */
async function updateEntityPosition(token: string | undefined, entityId: string, lat: number, lng: number) {
  try {
    await apiFetch(token, `${API}/entities/${entityId}/position`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng }),
    });
  } catch {
    console.error("Failed to update entity position");
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MapPage() {
  const { data: session } = useSession();
  const tokenRef = useRef<string | undefined>(undefined);
  useEffect(() => { tokenRef.current = (session as any)?.apiToken; }, [session]);

  const [places, setPlaces] = useState<LandUnit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [lightObs, setLightObs] = useState<LightObs[]>([]);
  const [activeLayers, setActiveLayers] = useState<Set<MapLayer>>(new Set(["plants"]));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function toggleLayer(layer: MapLayer) {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  }

  // ── Load land units ──────────────────────────────────────────────────────

  const token = (session as any)?.apiToken as string | undefined;

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await apiFetch(token, `${API}/land_units`);
        if (!res.ok) throw new Error(await res.text());
        const data: LandUnit[] = await res.json();
        setPlaces(data);
        if (data.length > 0) setSelectedId(data[0].id);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load places.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // ── Load parcels + entities when selection changes ───────────────────────

  const loadPlaceData = useCallback(async (landUnitId: string) => {
    setParcels([]);
    setEntities([]);
    setLightObs([]);
    try {
      const [parcelsRes, entitiesRes, lightRes] = await Promise.all([
        apiFetch(tokenRef.current, `${API}/parcels?land_unit_id=${landUnitId}`),
        apiFetch(tokenRef.current, `${API}/entities?land_unit_id=${landUnitId}`),
        apiFetch(tokenRef.current, `${API}/light-observations?land_unit_id=${landUnitId}`),
      ]);
      if (parcelsRes.ok) {
        const parcelList = await parcelsRes.json();
        // Fetch detail with geometry for each parcel
        const withGeom = await Promise.all(
          parcelList.map(async (p: Parcel) => {
            try {
              const dr = await apiFetch(tokenRef.current, `${API}/parcels/${p.id}`);
              if (dr.ok) return await dr.json();
              return p;
            } catch (e) { return p; }
          })
        );
        setParcels(withGeom);
      }
      if (entitiesRes.ok) {
        const e: Entity[] = await entitiesRes.json();
        setEntities(e);
      }
      if (lightRes.ok) {
        const l: LightObs[] = await lightRes.json();
        setLightObs(l);
      }
    } catch {
      // non-critical — map still renders
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadPlaceData(selectedId);
  }, [selectedId, loadPlaceData]);

  // ── Derived values ───────────────────────────────────────────────────────

  const selectedPlace = places.find((p) => p.id === selectedId) ?? null;
  const center: [number, number] =
    selectedPlace?.lat && selectedPlace?.lon
      ? [selectedPlace.lat, selectedPlace.lon]
      : DEFAULT_CENTER;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-[#07110c]">
      {/* Nav */}
      <nav className="flex-none border-b border-white/5 bg-[#07110c]">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <a href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-lime-300/10 border border-lime-300/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-lime-300" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 22c-4-4-8-7.5-8-12a8 8 0 0 1 16 0c0 4.5-4 8-8 12Z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-white">YardScore</span>
          </a>
          <div className="flex items-center gap-6 text-xs text-zinc-400">
            <a href="/dashboard" className="hover:text-white transition-colors">Dashboard</a>
            <a href="/map" className="text-lime-300 font-medium">Map</a>
            <a href="/scan" className="hover:text-white transition-colors">Scan →</a>
          </div>
        </div>
      </nav>

      {/* Place selector chips */}
      {places.length > 1 && (
        <div className="flex-none border-b border-white/5 px-4 py-2">
          <div className="flex flex-wrap gap-2">
            {places.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  selectedId === p.id
                    ? "bg-lime-300 text-zinc-950 border-lime-300"
                    : "bg-white/5 text-zinc-300 border-white/10 hover:border-lime-300/50"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Map area */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#07110c]">
            <div className="w-10 h-10 border-4 border-lime-300 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 max-w-sm text-center">
              {error}
            </div>
          </div>
        ) : places.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4">
            <div className="text-4xl">&#127807;</div>
            <p className="font-semibold text-gray-700">Scan your yard first</p>
            <p className="text-sm text-gray-400 text-center max-w-xs">
              Create a place and upload photos before viewing the map.
            </p>
            <a
              href="/scan"
              className="bg-[#2d6a4f] hover:bg-[#1b4332] text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
            >
              Go to Scan
            </a>
          </div>
        ) : (
          <MapContainer
            center={center}
            zoom={DEFAULT_ZOOM}
            maxZoom={20}
            className="w-full h-full"
            style={{ background: "#f8f4ef" }}
          >
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={20}
            />

            {/* Parcel polygons */}
            {parcels.map((parcel) => {
              if (!parcel.geojson) return null;
              const rings = geojsonToLatLngs(parcel.geojson);
              if (rings.length === 0) return null;
              return (
                <Polygon
                  key={parcel.id}
                  positions={rings}
                  pathOptions={{
                    color: "#52b788",
                    weight: 3,
                    fillColor: "#2d6a4f",
                    fillOpacity: 0.15,
                  }}
                />
              );
            })}

            {/* Entity markers — colored circles, draggable, tap for details */}
            {activeLayers.has("plants") && entities.map((entity) => {
              if (entity.estimated_lat == null || entity.estimated_lng == null)
                return null;
              const icon = makeEntityIcon(entity.entity_type);
              return (
                <Marker
                  key={entity.id}
                  position={[entity.estimated_lat, entity.estimated_lng]}
                  icon={icon}
                  draggable={true}
                  eventHandlers={{
                    dragend: (e) => {
                      const pos = e.target.getLatLng();
                      setEntities((prev) =>
                        prev.map((ent) =>
                          ent.id === entity.id
                            ? { ...ent, estimated_lat: pos.lat, estimated_lng: pos.lng }
                            : ent
                        )
                      );
                      updateEntityPosition(tokenRef.current, entity.id, pos.lat, pos.lng);
                    },
                  }}
                >
                  <Popup>
                    <div className="text-sm space-y-1.5 min-w-[180px] p-1" style={{ color: "#1a1a1a" }}>
                      <p className="font-bold text-base" style={{ color: "#111" }}>
                        {entity.label}
                      </p>
                      {(entity as any).species && (entity as any).species !== entity.label && (
                        <p className="italic text-xs" style={{ color: "#2d6a4f" }}>
                          {(entity as any).species}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-xs" style={{ color: "#555" }}>
                        <span className="capitalize">{entity.entity_type}</span>
                        <span>·</span>
                        <span>{entity.observation_count} observation{entity.observation_count !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="flex gap-2 mt-2 pt-2" style={{ borderTop: "1px solid #e5e5e5" }}>
                        <a
                          href={`/plant?id=${entity.id}`}
                          style={{ background: "#2d6a4f", color: "white", padding: "6px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, textDecoration: "none", display: "inline-block" }}
                        >
                          {(entity as any).species ? "Add Observation" : "Identify Species"}
                        </a>
                      </div>
                      <p style={{ color: "#999", fontSize: "10px", marginTop: "4px" }}>
                        Drag marker to correct position
                      </p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Light observation markers — amber sun dots */}
            {activeLayers.has("light") && lightObs.map((lo) => {
              if (lo.device_lat == null || lo.device_lng == null) return null;
              const lightColor = lo.light_level === "full_sun" ? "#fbbf24"
                : lo.light_level === "part_sun" ? "#f59e0b"
                : lo.light_level === "dappled" ? "#d97706"
                : lo.light_level === "part_shade" ? "#92400e"
                : "#78350f";
              return (
                <CircleMarker
                  key={lo.id}
                  center={[lo.device_lat, lo.device_lng]}
                  radius={6}
                  pathOptions={{ color: lightColor, fillColor: lightColor, fillOpacity: 0.7, weight: 1 }}
                >
                  <Tooltip direction="top" offset={[0, -8]}>
                    <span style={{ fontSize: "11px" }}>
                      {lo.light_level.replace(/_/g, " ")} · {lo.time_bucket}
                    </span>
                  </Tooltip>
                </CircleMarker>
              );
            })}
          </MapContainer>
        )}

        {/* Layer toggles + legend */}
        <div className="absolute bottom-4 left-4 z-[1000] bg-black/80 backdrop-blur-sm rounded-xl px-3 py-2.5 space-y-2">
          {/* Layer toggles */}
          <div className="flex items-center gap-2">
            {([
              { key: "plants" as MapLayer, label: "Plants", color: "#84cc16", count: entities.length },
              { key: "light" as MapLayer, label: "Light", color: "#fbbf24", count: lightObs.filter(l => l.device_lat).length },
            ]).map(({ key, label, color, count }) => (
              <button
                key={key}
                onClick={() => toggleLayer(key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                  activeLayers.has(key) ? "bg-white/15 text-white" : "bg-white/5 text-white/40"
                }`}
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeLayers.has(key) ? color : "#555" }} />
                {label} ({count})
              </button>
            ))}
          </div>

          {/* Plant type legend (when plants layer is active) */}
          {activeLayers.has("plants") && (
            <div className="flex items-center gap-3 pt-1 border-t border-white/10">
              {[
                { type: "tree", label: "Tree" },
                { type: "shrub", label: "Shrub" },
                { type: "herb", label: "Herb" },
                { type: "ground_cover", label: "Ground" },
              ].map(({ type, label }) => (
                <div key={type} className="flex items-center gap-1">
                  <div className="rounded-full" style={{
                    backgroundColor: entityColor(type),
                    width: entityRadius(type) * 2,
                    height: entityRadius(type) * 2,
                  }} />
                  <span className="text-[10px] text-white/60">{label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Light level legend (when light layer is active) */}
          {activeLayers.has("light") && (
            <div className="flex items-center gap-3 pt-1 border-t border-white/10">
              {[
                { level: "Full Sun", color: "#fbbf24" },
                { level: "Part Sun", color: "#f59e0b" },
                { level: "Dappled", color: "#d97706" },
                { level: "Part Shade", color: "#92400e" },
                { level: "Full Shade", color: "#78350f" },
              ].map(({ level, color }) => (
                <div key={level} className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[10px] text-white/60">{level}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
