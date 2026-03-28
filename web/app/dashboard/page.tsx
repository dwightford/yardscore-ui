"use client";

import { useState, useEffect, useCallback } from "react";
import NavBar from "../components/NavBar";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LandUnit {
  id: string;
  name: string;
  land_unit_type: string;
  address: string | null;
  created_at: string;
  observation_count?: number;
}

interface LatestScore {
  score_value: number;
  confidence: number;
  coverage: number;
  computed_at: string;
}

interface PlaceWithScore {
  place: LandUnit;
  score: LatestScore | null;
  entityCount?: number;
  hasParcel?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-700";
  if (score >= 45) return "text-yellow-600";
  return "text-red-600";
}

function typeLabel(t: string): string {
  const map: Record<string, string> = {
    yard: "Yard",
    parcel: "Parcel",
    property: "Property",
    cluster: "Community cluster",
  };
  return map[t] ?? t;
}

// ── Score badge ───────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: LatestScore | null | "loading" }) {
  if (score === "loading") {
    return (
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center animate-pulse">
        <span className="text-xs text-gray-400">...</span>
      </div>
    );
  }
  if (!score) {
    return (
      <div className="w-12 h-12 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
        <span className="text-xs text-gray-400">&mdash;</span>
      </div>
    );
  }
  const si = Math.round(score.score_value);
  const ringClass =
    si >= 70 ? "border-green-400" : si >= 45 ? "border-yellow-400" : "border-red-400";
  const textClass = scoreColor(si);
  return (
    <div
      className={`w-12 h-12 rounded-full border-2 ${ringClass} flex items-center justify-center`}
    >
      <span className={`text-sm font-black tabular-nums ${textClass}`}>{si}</span>
    </div>
  );
}

// ── Place card ────────────────────────────────────────────────────────────────

function PlaceCard({
  item,
  onDelete,
}: {
  item: PlaceWithScore & { scoreLoading: boolean };
  onDelete: (id: string) => void;
}) {
  const { place, score, scoreLoading } = item;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setDeleting(true);
    try {
      await fetch(`${API}/land_units/${place.id}`, { method: "DELETE" });
      onDelete(place.id);
    } finally {
      setDeleting(false);
    }
  }

  const obsCount = place.observation_count ?? 0;
  const entityCount = (item as any).entityCount ?? 0;
  const hasParcel = (item as any).hasParcel ?? false;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-[#52b788] hover:shadow-sm transition-all">
      <div className="flex items-center gap-3 px-4 py-3">
        <ScoreBadge score={scoreLoading ? "loading" : score} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 truncate">{place.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-400">{typeLabel(place.land_unit_type)}</span>
            {place.address && (
              <span className="text-xs text-gray-400 truncate max-w-[200px]">&middot; {place.address.split(",").slice(0, 2).join(",")}</span>
            )}
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          title={confirmDelete ? "Tap again to confirm" : "Delete"}
          className={`flex-none w-8 h-8 rounded-lg flex items-center justify-center text-xs transition-colors border ${
            confirmDelete
              ? "bg-red-50 border-red-300 text-red-600"
              : "bg-white border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500"
          } disabled:opacity-50`}
        >
          {deleting ? "..." : confirmDelete ? "OK" : "x"}
        </button>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs">
        <span className={obsCount > 0 ? "text-[#2d6a4f] font-medium" : "text-gray-400"}>
          {obsCount} photo{obsCount !== 1 ? "s" : ""}
        </span>
        {entityCount > 0 && (
          <span className="text-[#2d6a4f] font-medium">
            {entityCount} tagged
          </span>
        )}
        {hasParcel && (
          <span className="text-emerald-600 font-medium">
            Parcel linked
          </span>
        )}
        <div className="flex-1" />
        <a href={`/map`} className="text-[#2d6a4f] font-medium hover:underline">
          Map
        </a>
        <a href={`/capture?place=${place.id}`} className="text-[#52b788] font-medium hover:underline">
          Upload
        </a>
      </div>
    </div>
  );

}

// ── Places list ───────────────────────────────────────────────────────────────

function PlacesList({ onNewPlace }: { onNewPlace: () => void }) {
  const [items, setItems] = useState<(PlaceWithScore & { scoreLoading: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPlaces = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/land_units`);
      if (!res.ok) throw new Error(await res.text());
      const places: LandUnit[] = await res.json();

      const initial = places.map((p) => ({ place: p, score: null, scoreLoading: true }));
      setItems(initial);
      setLoading(false);

      const scored = await Promise.all(
        places.map(async (p) => {
          try {
            const [sr, er, pr] = await Promise.all([
              fetch(`${API}/yardscore/${p.id}/latest`),
              fetch(`${API}/entities?land_unit_id=${p.id}`),
              fetch(`${API}/parcels?land_unit_id=${p.id}`),
            ]);
            const score: LatestScore | null = sr.ok ? await sr.json() : null;
            const entities = er.ok ? await er.json() : [];
            const parcels = pr.ok ? await pr.json() : [];
            return {
              place: p,
              score,
              scoreLoading: false,
              entityCount: entities.length,
              hasParcel: parcels.length > 0,
            };
          } catch {
            return { place: p, score: null, scoreLoading: false, entityCount: 0, hasParcel: false };
          }
        })
      );
      setItems(scored);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load places.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlaces();
  }, [loadPlaces]);

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((item) => item.place.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Your places</h2>
        <div className="flex items-center gap-2">
          <a
            href="/capture"
            className="text-sm bg-[#52b788] hover:bg-[#40916c] text-white font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Upload Photos
          </a>
          <button
            onClick={onNewPlace}
            className="text-sm bg-[#2d6a4f] hover:bg-[#1b4332] text-white font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + New place
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">&#127807;</div>
          <p className="font-semibold text-gray-700 mb-1">No places yet</p>
          <p className="text-sm text-gray-400 mb-4">
            Create your first place and upload a photo to get your YardScore.
          </p>
          <button
            onClick={onNewPlace}
            className="bg-[#2d6a4f] hover:bg-[#1b4332] text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
          >
            Create your first place
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <PlaceCard key={item.place.id} item={item} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── New place modal ───────────────────────────────────────────────────────────

function NewPlaceForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("yard");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/land_units`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          land_unit_type: type,
          address: address.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create place.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">New place</h3>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          Cancel
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Front yard, Community Plot A"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#52b788]"
            autoFocus
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#52b788]"
          >
            <option value="yard">Yard</option>
            <option value="parcel">Parcel</option>
            <option value="property">Property</option>
            <option value="cluster">Community cluster</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main St, Durham NC"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#52b788]"
          />
        </div>
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full bg-[#2d6a4f] hover:bg-[#1b4332] text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create place"}
        </button>
      </form>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [showNewPlace, setShowNewPlace] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  function handlePlaceCreated() {
    setShowNewPlace(false);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="min-h-screen bg-[#f8f4ef]">
      <NavBar active="/dashboard" />

      {/* ── Hero / welcome section ──────────────────────────────────────────── */}
      <div className="bg-gradient-to-b from-[#2d6a4f] to-[#1b4332]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Welcome to YardScore
          </h1>
          <p className="mt-3 text-base sm:text-lg text-[#b7e4c7] max-w-lg mx-auto">
            Upload photos of your yard to get your ecological score
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/scan"
              className="inline-flex items-center gap-2 bg-white text-[#2d6a4f] font-semibold px-6 py-3 rounded-xl hover:bg-[#d8f3dc] transition-colors text-sm shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
              Start Scan
            </a>
            <a
              href="/capture"
              className="inline-flex items-center gap-2 bg-transparent border border-white/30 text-white font-medium px-6 py-3 rounded-xl hover:bg-white/10 transition-colors text-sm"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Upload Photos
            </a>
          </div>
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showNewPlace ? (
          <div className="max-w-md mx-auto">
            <NewPlaceForm
              onCreated={handlePlaceCreated}
              onCancel={() => setShowNewPlace(false)}
            />
          </div>
        ) : (
          <div key={refreshKey} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <PlacesList onNewPlace={() => setShowNewPlace(true)} />
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="text-center text-xs text-gray-400 pb-8">
        YardScore v1.0
      </footer>
    </div>
  );
}
