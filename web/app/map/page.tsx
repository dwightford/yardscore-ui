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

// ── Helpers ───────────────────────────────────────────────────────────────────

function entityColor(type: string): string {
  const t = type.toLowerCase();
  if (t === "tree") return "#2d6a4f";
  if (t === "shrub") return "#52b788";
  if (t === "structure") return "#6b7280";
  return "#ffffff";
}

function entityRadius(sizeClass: string | null): number {
  switch (sizeClass?.toLowerCase()) {
    case "large":
      return 18;
    case "medium":
      return 14;
    case "small":
      return 10;
    default:
      return 12;
  }
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

/** Create a colored circle DivIcon for entity markers (lazy L import for SSR compat) */
function makeEntityIcon(type: string, sizeClass: string | null) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const L = require("leaflet");
  const size = entityRadius(sizeClass) * 2;
  const color = entityColor(type);
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:3px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,0.4);
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ── Load land units ──────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(tokenRef.current, `${API}/land_units`);
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
  }, []);

  // ── Load parcels + entities when selection changes ───────────────────────

  const loadPlaceData = useCallback(async (landUnitId: string) => {
    setParcels([]);
    setEntities([]);
    try {
      const [parcelsRes, entitiesRes] = await Promise.all([
        apiFetch(tokenRef.current, `${API}/parcels?land_unit_id=${landUnitId}`),
        apiFetch(tokenRef.current, `${API}/entities?land_unit_id=${landUnitId}`),
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
    <div className="h-screen flex flex-col bg-[#f8f4ef]">
      <NavBar active="/map" />

      {/* ── Place selector chips ────────────────────────────────────────────── */}
      {places.length > 1 && (
        <div className="flex-none bg-white border-b border-gray-200 px-4 py-3">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-wrap gap-2">
              {places.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    selectedId === p.id
                      ? "bg-[#2d6a4f] text-white border-[#2d6a4f]"
                      : "bg-white text-gray-700 border-gray-300 hover:border-[#2d6a4f]"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Map area ────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-400 text-sm">Loading...</p>
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

            {/* Draggable entity markers */}
            {entities.map((entity) => {
              if (entity.estimated_lat == null || entity.estimated_lng == null)
                return null;
              const icon = makeEntityIcon(entity.entity_type, entity.size_class);
              return (
                <Marker
                  key={entity.id}
                  position={[entity.estimated_lat, entity.estimated_lng]}
                  icon={icon}
                  draggable={true}
                  eventHandlers={{
                    dragend: (e) => {
                      const marker = e.target;
                      const pos = marker.getLatLng();
                      // Update local state
                      setEntities((prev) =>
                        prev.map((ent) =>
                          ent.id === entity.id
                            ? { ...ent, estimated_lat: pos.lat, estimated_lng: pos.lng }
                            : ent
                        )
                      );
                      // Persist to server
                      updateEntityPosition(tokenRef.current, entity.id, pos.lat, pos.lng);
                    },
                  }}
                >
                  <Popup>
                    <div className="text-sm space-y-1 min-w-[160px]">
                      <p className="font-semibold text-gray-800">
                        {entity.label}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {entity.entity_type}
                        {entity.size_class ? ` · ${entity.size_class}` : ""}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {entity.observation_count} observation
                        {entity.observation_count !== 1 ? "s" : ""}
                      </p>
                      {(entity as any).species && (
                        <p className="text-green-600 text-xs font-medium mt-1">
                          {(entity as any).species}
                        </p>
                      )}
                      <div className="flex gap-2 mt-2">
                        <a
                          href={`/identify?entity=${entity.id}&name=${encodeURIComponent(entity.label)}`}
                          className="text-[10px] font-semibold text-white bg-[#2d6a4f] px-2.5 py-1 rounded-md hover:bg-[#1b4332]"
                        >
                          {(entity as any).species ? "Re-identify" : "Identify Species"}
                        </a>
                      </div>
                      <p className="text-gray-300 text-[10px] mt-1">
                        Drag to correct position
                      </p>
                    </div>
                  </Popup>
                  <Tooltip permanent direction="top" offset={[0, -16]}
                    className="!bg-black/80 !text-white !border-0 !rounded !px-2 !py-1 !text-xs !font-bold !shadow-lg">
                    {entity.label}
                  </Tooltip>
                </Marker>
              );
            })}
          </MapContainer>
        )}
      </div>
    </div>
  );
}
