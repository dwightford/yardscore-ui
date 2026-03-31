"use client";

/**
 * /admin/map — All entities across all accounts on one map
 * Admin-only view showing every identified plant from every user.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import("react-leaflet").then((m) => m.CircleMarker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Orange County NC center
const DEFAULT_CENTER: [number, number] = [35.9132, -79.0558];

interface LandUnit {
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
}

interface Entity {
  id: string;
  land_unit_id: string;
  entity_type: string;
  label: string;
  species: string | null;
  estimated_lat: number | null;
  estimated_lng: number | null;
  observation_count: number;
  confidence: number;
}

const ENTITY_COLORS: Record<string, string> = {
  tree: "#84cc16",    // lime
  shrub: "#22c55e",   // green
  herb: "#a3e635",    // yellow-green
  ground_cover: "#65a30d", // dark lime
};

const ENTITY_RADIUS: Record<string, number> = {
  tree: 10,
  shrub: 7,
  herb: 5,
  ground_cover: 4,
};

export default function AdminMapPage() {
  const { data: session } = useSession();
  const token = (session as any)?.apiToken as string | undefined;

  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [landUnits, setLandUnits] = useState<LandUnit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    apiFetch(token, `${API}/me`)
      .then((r) => r.json())
      .then((data) => setAuthorized(data.user?.role === "admin"))
      .catch(() => setAuthorized(false));
  }, [token]);

  const loadData = useCallback(async () => {
    if (!token || !authorized) return;
    setLoading(true);

    try {
      const luRes = await apiFetch(token, `${API}/land_units?limit=200`);
      if (!luRes.ok) throw new Error();
      const lus: LandUnit[] = await luRes.json();
      setLandUnits(lus);

      // Load entities for all land units
      const allEntities: Entity[] = [];
      await Promise.all(
        lus.map(async (lu) => {
          try {
            const r = await apiFetch(token, `${API}/entities?land_unit_id=${lu.id}`);
            if (r.ok) {
              const ents: Entity[] = await r.json();
              allEntities.push(...ents);
            }
          } catch {}
        })
      );
      setEntities(allEntities);
    } catch {}
    finally { setLoading(false); }
  }, [token, authorized]);

  useEffect(() => { loadData(); }, [loadData]);

  // Find map center from entities or land units
  const entitiesWithCoords = entities.filter((e) => e.estimated_lat && e.estimated_lng);
  const center: [number, number] = entitiesWithCoords.length > 0
    ? [entitiesWithCoords[0].estimated_lat!, entitiesWithCoords[0].estimated_lng!]
    : landUnits.find((lu) => lu.lat && lu.lon)
      ? [landUnits.find((lu) => lu.lat)!.lat!, landUnits.find((lu) => lu.lon)!.lon!]
      : DEFAULT_CENTER;

  if (authorized === null) {
    return (
      <div className="min-h-screen bg-[#07110c] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-lime-300 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#07110c] flex items-center justify-center">
        <p className="text-red-400">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07110c] flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between z-20 relative">
        <div>
          <h1 className="text-lg font-bold text-white">Admin Map</h1>
          <p className="text-[10px] text-zinc-500">
            {entitiesWithCoords.length} plants · {landUnits.length} properties · all accounts
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <a href="/admin" className="hover:text-white">Admin</a>
          <a href="/dashboard" className="hover:text-white">Dashboard</a>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-lime-300 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <MapContainer
            center={center}
            zoom={17}
            style={{ width: "100%", height: "100%" }}
            className="h-full"
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Esri"
            />

            {entitiesWithCoords.map((e) => (
              <CircleMarker
                key={e.id}
                center={[e.estimated_lat!, e.estimated_lng!]}
                radius={ENTITY_RADIUS[e.entity_type] || 6}
                pathOptions={{
                  color: ENTITY_COLORS[e.entity_type] || "#84cc16",
                  fillColor: ENTITY_COLORS[e.entity_type] || "#84cc16",
                  fillOpacity: 0.7,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="text-xs">
                    <p className="font-bold">{e.label || e.species || "Unknown"}</p>
                    {e.species && e.species !== e.label && (
                      <p className="italic text-gray-500">{e.species}</p>
                    )}
                    <p className="text-gray-400 mt-1">{e.entity_type} · seen {e.observation_count}×</p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 py-2 flex items-center gap-4">
        {Object.entries(ENTITY_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-zinc-500 capitalize">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
