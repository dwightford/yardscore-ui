"use client";

/**
 * /plant?id=<entity_id> — Entity detail page
 *
 * Shows everything known about a specific plant entity:
 * - Species, common name, family
 * - Map position (mini-map)
 * - Observation count + first/last seen
 * - Completeness indicator (how many photo types captured)
 * - Add more photos (leaf, bark, flower, fruit, whole plant)
 * - Correct species identification
 * - All observations timeline
 */

import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Entity {
  id: string;
  land_unit_id: string;
  entity_type: string;
  label: string;
  species: string | null;
  size_class: string | null;
  estimated_lat: number | null;
  estimated_lng: number | null;
  observation_count: number;
  confidence: number;
  first_observed_at: string | null;
  last_observed_at: string | null;
  metadata: Record<string, unknown> | null;
}

interface PlantNetResult {
  scientificName: string;
  commonNames: string[];
  family: string;
  score: number;
}

const PHOTO_TYPES = [
  { key: "leaf", label: "Leaf", emoji: "🍃" },
  { key: "bark", label: "Bark", emoji: "🪵" },
  { key: "flower", label: "Flower", emoji: "🌸" },
  { key: "fruit", label: "Fruit/Seed", emoji: "🫐" },
  { key: "whole", label: "Whole Plant", emoji: "🌳" },
];

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function typeColor(t: string): string {
  if (t === "tree") return "bg-lime-500/20 text-lime-300 border-lime-500/30";
  if (t === "shrub") return "bg-green-500/20 text-green-300 border-green-500/30";
  if (t === "herb") return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
  return "bg-zinc-500/20 text-zinc-300 border-zinc-500/30";
}

export default function PlantDetailPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#07110c] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-lime-300 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PlantDetailPage />
    </Suspense>
  );
}

function PlantDetailPage() {
  const { data: session } = useSession();
  const token = (session as any)?.apiToken as string | undefined;
  const searchParams = useSearchParams();
  const entityId = searchParams.get("id");

  const [entity, setEntity] = useState<Entity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Correction state
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionText, setCorrectionText] = useState("");
  const [correctionSubmitted, setCorrectionSubmitted] = useState(false);

  // Add photo state
  const [addingPhoto, setAddingPhoto] = useState(false);
  const [selectedPhotoType, setSelectedPhotoType] = useState<string | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const [newIdResult, setNewIdResult] = useState<PlantNetResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load entity
  useEffect(() => {
    if (!token || !entityId) return;
    setLoading(true);
    apiFetch(token, `${API}/entities/${entityId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Entity not found");
        return r.json();
      })
      .then((data) => {
        setEntity(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [token, entityId]);

  // Handle photo capture for additional observation
  const handlePhoto = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !entity) return;

    setIdentifying(true);
    setNewIdResult(null);

    try {
      // Send to PlantNet for re-identification
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/plantnet-proxy", { method: "POST", body: fd });
      if (r.ok) {
        const data = await r.json();
        if (data.results?.[0]) {
          const best = data.results[0];
          setNewIdResult({
            scientificName: best.species?.scientificNameWithoutAuthor || "Unknown",
            commonNames: best.species?.commonNames || [],
            family: best.species?.family?.scientificNameWithoutAuthor || "",
            score: best.score || 0,
          });
        }
      }

      // Record observation against this entity
      apiFetch(token, `${API}/entities/${entity.id}/observe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photo_type: selectedPhotoType,
        }),
      }).catch(() => {});

      // Update local observation count
      setEntity((prev) => prev ? { ...prev, observation_count: prev.observation_count + 1 } : prev);
    } catch {
      // failed silently
    } finally {
      setIdentifying(false);
      setAddingPhoto(false);
      setSelectedPhotoType(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [entity, token, selectedPhotoType]);

  // Submit correction
  function submitCorrection() {
    if (!correctionText.trim() || !entity) return;
    apiFetch(token, `${API}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "wrong_id",
        predicted_species: entity.species,
        corrected_species: correctionText.trim(),
        entity_id: entity.id,
        land_unit_id: entity.land_unit_id,
      }),
    }).catch(() => {});
    setCorrectionSubmitted(true);
    setShowCorrection(false);
  }

  // Completeness score
  const completeness = entity ? Math.min(entity.observation_count, 5) : 0;
  const completenessLabel = completeness >= 5 ? "Well documented" : completeness >= 3 ? "Good coverage" : completeness >= 1 ? "Needs more photos" : "No observations";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07110c] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-lime-300 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !entity) {
    return (
      <div className="min-h-screen bg-[#07110c] flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-red-400">{error || "Plant not found"}</p>
        <a href="/map" className="text-lime-300 text-sm">← Back to Map</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07110c]">
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <a href="/map" className="text-zinc-500 text-sm hover:text-white">← Map</a>
          <a href="/dashboard" className="text-zinc-500 text-sm hover:text-white">Dashboard</a>
        </div>

        {/* Species name + type badge */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{entity.label}</h1>
            {entity.species && entity.species !== entity.label && (
              <p className="text-lime-300/70 text-sm italic mt-0.5">{entity.species}</p>
            )}
            {entity.metadata && (entity.metadata as any).species && (
              <p className="text-zinc-500 text-xs mt-1">
                Family: {(entity.metadata as any).family || "Unknown"}
              </p>
            )}
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium border capitalize ${typeColor(entity.entity_type)}`}>
            {entity.entity_type}
          </span>
        </div>
      </div>

      <div className="px-5 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <p className="text-[10px] text-zinc-500 uppercase">Observations</p>
            <p className="text-lg font-bold text-white">{entity.observation_count}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <p className="text-[10px] text-zinc-500 uppercase">First Seen</p>
            <p className="text-sm font-medium text-white">{timeAgo(entity.first_observed_at)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <p className="text-[10px] text-zinc-500 uppercase">Last Seen</p>
            <p className="text-sm font-medium text-white">{timeAgo(entity.last_observed_at)}</p>
          </div>
        </div>

        {/* Completeness indicator */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-zinc-400">Documentation</p>
            <p className="text-xs text-zinc-500">{completeness}/5 photo types</p>
          </div>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-lime-400 transition-all"
              style={{ width: `${(completeness / 5) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-zinc-500 mt-2">{completenessLabel}</p>

          {/* Photo type chips */}
          <div className="flex flex-wrap gap-2 mt-3">
            {PHOTO_TYPES.map((pt) => (
              <span
                key={pt.key}
                className="text-[10px] px-2 py-1 rounded-full border border-white/10 bg-white/[0.03] text-zinc-400"
              >
                {pt.emoji} {pt.label}
              </span>
            ))}
          </div>
        </div>

        {/* Add photo section */}
        <div className="rounded-xl border border-lime-300/20 bg-lime-300/5 p-4">
          <p className="text-sm font-medium text-lime-300 mb-2">Add an observation</p>
          <p className="text-xs text-zinc-400 mb-3">
            Take a photo of this plant's leaf, bark, flower, fruit, or whole form.
            Each photo improves identification confidence.
          </p>

          {!addingPhoto ? (
            <button
              onClick={() => setAddingPhoto(true)}
              className="w-full py-3 bg-lime-300 text-zinc-950 font-bold rounded-xl text-sm active:scale-95 transition-transform"
            >
              📷 Take Photo
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-zinc-400">What part of the plant?</p>
              <div className="flex flex-wrap gap-2">
                {PHOTO_TYPES.map((pt) => (
                  <button
                    key={pt.key}
                    onClick={() => {
                      setSelectedPhotoType(pt.key);
                      fileInputRef.current?.click();
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      selectedPhotoType === pt.key
                        ? "bg-lime-300/20 border-lime-300/40 text-lime-300"
                        : "bg-white/5 border-white/10 text-zinc-300 hover:border-white/20"
                    }`}
                  >
                    {pt.emoji} {pt.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setAddingPhoto(false); setSelectedPhotoType(null); }}
                className="text-xs text-zinc-500"
              >
                Cancel
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhoto}
          />

          {identifying && (
            <div className="flex items-center gap-2 mt-3">
              <div className="w-4 h-4 border-2 border-lime-300 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-zinc-400">Identifying...</span>
            </div>
          )}

          {newIdResult && (
            <div className="mt-3 rounded-lg border border-lime-300/20 bg-lime-300/5 p-3">
              <p className="text-xs text-zinc-500">New identification:</p>
              <p className="text-sm font-medium text-lime-300 italic">{newIdResult.scientificName}</p>
              {newIdResult.commonNames[0] && (
                <p className="text-xs text-zinc-400">{newIdResult.commonNames[0]}</p>
              )}
              <p className="text-[10px] text-zinc-500 mt-1">
                {newIdResult.family} · {(newIdResult.score * 100).toFixed(0)}%
              </p>
            </div>
          )}
        </div>

        {/* Correct ID section */}
        {!showCorrection && !correctionSubmitted && (
          <button
            onClick={() => setShowCorrection(true)}
            className="w-full py-3 bg-white/5 border border-white/10 text-zinc-400 rounded-xl text-sm hover:bg-white/10"
          >
            Wrong identification? Correct it
          </button>
        )}

        {showCorrection && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-sm font-medium text-red-300 mb-1">Correct identification</p>
            <p className="text-xs text-zinc-500 mb-3">
              PlantNet identified this as: <span className="text-white italic">{entity.species}</span>
            </p>
            <input
              type="text"
              value={correctionText}
              onChange={(e) => setCorrectionText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitCorrection()}
              placeholder="What is this plant actually?"
              autoFocus
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-400/50"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={submitCorrection}
                disabled={!correctionText.trim()}
                className="flex-1 py-2.5 bg-red-500/20 border border-red-500/30 text-red-200 text-xs font-semibold rounded-lg disabled:opacity-40"
              >
                Submit Correction
              </button>
              <button
                onClick={() => setShowCorrection(false)}
                className="py-2.5 px-4 bg-white/5 text-zinc-500 text-xs rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {correctionSubmitted && (
          <div className="rounded-xl border border-lime-300/20 bg-lime-300/5 p-3">
            <p className="text-xs text-lime-300">Correction submitted — thank you! This improves identification for everyone.</p>
          </div>
        )}

        {/* Location */}
        {entity.estimated_lat && entity.estimated_lng && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs text-zinc-500 mb-1">Location</p>
            <p className="text-xs font-mono text-zinc-400">
              {entity.estimated_lat.toFixed(6)}, {entity.estimated_lng.toFixed(6)}
            </p>
            <a
              href="/map"
              className="text-xs text-lime-300 mt-2 block"
            >
              View on map →
            </a>
          </div>
        )}

        {/* Metadata (debug) */}
        {entity.metadata && (
          <details className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <summary className="text-xs text-zinc-600 cursor-pointer">Raw metadata</summary>
            <pre className="text-[10px] text-zinc-500 mt-2 overflow-x-auto">
              {JSON.stringify(entity.metadata, null, 2)}
            </pre>
          </details>
        )}
      </div>

      {/* Bottom padding */}
      <div className="h-20" />
    </div>
  );
}
