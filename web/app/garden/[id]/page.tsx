"use client";

/**
 * /garden/[id] — Public Garden Profile (Garden Voice edition)
 *
 * NO AUTH. The garden's public face.
 * Gets embedded on listings, shared on social, linked from neighborhood pages.
 * The garden narrates itself.
 *
 * Preserves existing /share page for backward compat.
 */

import { useState, useEffect, FormEvent } from "react";
import { useParams } from "next/navigation";
import {
  Sprout,
  MapPin,
  TreePine,
  Shrub,
  Flower2,
  Leaf,
  Share2,
  Code2,
  ExternalLink,
} from "lucide-react";

/* ── Types ──────────────────────────────────────────────────── */

interface GardenProfile {
  property: {
    id: string;
    name: string;
    address: string | null;
  };
  score: number | null;
  species_count: number;
  native_count: number;
  native_percent: number;
  total_plants: number;
  layers: {
    canopy: { count: number; species: number };
    understory: { count: number; species: number };
    shrub: { count: number; species: number };
    groundcover: { count: number; species: number };
  };
  layer_count: number;
  species_list: Array<{
    name: string;
    scientific: string;
    type: string;
    native: boolean;
    count: number;
  }>;
  narrative: string | null;
  lot_acres: number | null;
  climate_zone: string | null;
}

/* ── Layer bar widths ───────────────────────────────────────── */

function layerBar(count: number, max: number) {
  if (max === 0) return "0%";
  return `${Math.max(8, (count / max) * 100)}%`;
}

/* ── Component ──────────────────────────────────────────────── */

export default function GardenProfilePage() {
  const params = useParams();
  const gardenId = params.id as string;

  const [profile, setProfile] = useState<GardenProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);

  useEffect(() => {
    if (!gardenId) return;

    // Fetch public garden profile
    // TODO: replace with GET /public/garden/{id} when backend ready
    // For now, attempt the existing public report endpoint
    fetch(`/api/public/report/${gardenId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && !data.error) {
          // Transform existing report format to garden profile
          const entities = data.entities || [];
          const natives = entities.filter(
            (e: any) => e.native_status === "native",
          );
          const speciesMap = new Map<string, any>();
          entities.forEach((e: any) => {
            if (!speciesMap.has(e.species || e.label)) {
              speciesMap.set(e.species || e.label, {
                name: e.label,
                scientific: e.species || e.label,
                type: e.entity_type || "unknown",
                native: e.native_status === "native",
                count: e.observation_count || 1,
              });
            }
          });

          // Count layers
          const layerCounts = { canopy: 0, understory: 0, shrub: 0, groundcover: 0 };
          const layerSpecies = { canopy: 0, understory: 0, shrub: 0, groundcover: 0 };
          entities.forEach((e: any) => {
            const layer = e.ecological_layer || e.entity_type;
            if (layer === "tree" || layer === "canopy") {
              layerCounts.canopy++;
              layerSpecies.canopy++;
            } else if (layer === "understory") {
              layerCounts.understory++;
              layerSpecies.understory++;
            } else if (layer === "shrub") {
              layerCounts.shrub++;
              layerSpecies.shrub++;
            } else if (
              layer === "groundcover" ||
              layer === "ground_cover" ||
              layer === "herb"
            ) {
              layerCounts.groundcover++;
              layerSpecies.groundcover++;
            }
          });

          const activeLayers = Object.values(layerCounts).filter(
            (c) => c > 0,
          ).length;

          setProfile({
            property: data.property,
            score: data.score
              ? Math.round(data.score.score_value)
              : null,
            species_count: speciesMap.size,
            native_count: natives.length,
            native_percent:
              entities.length > 0
                ? Math.round((natives.length / entities.length) * 100)
                : 0,
            total_plants: entities.length,
            layers: {
              canopy: {
                count: layerCounts.canopy,
                species: layerSpecies.canopy,
              },
              understory: {
                count: layerCounts.understory,
                species: layerSpecies.understory,
              },
              shrub: {
                count: layerCounts.shrub,
                species: layerSpecies.shrub,
              },
              groundcover: {
                count: layerCounts.groundcover,
                species: layerSpecies.groundcover,
              },
            },
            layer_count: activeLayers,
            species_list: Array.from(speciesMap.values()),
            narrative: null, // fetched separately
            lot_acres: null,
            climate_zone: null,
          });
        }
        setLoading(false);

        // Fetch narrative lazily
        fetch(`/api/public/narrative/${gardenId}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((n) => {
            if (n?.narrative && profile) {
              setProfile((prev) =>
                prev ? { ...prev, narrative: n.narrative } : prev,
              );
            }
          })
          .catch(() => {});
      })
      .catch(() => setLoading(false));
  }, [gardenId]);

  const handleAsk = async (e: FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    // TODO: wire to POST /intelligence/ask when backend ready
    await new Promise((r) => setTimeout(r, 1500));
    setAnswer(
      "This garden has strong understory diversity. Based on the species present, shade-tolerant native groundcovers like foamflower or wild ginger would do well here.",
    );
    setAsking(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-forest-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-forest-300 border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-forest-950 px-6">
        <p className="text-zinc-400">This garden hasn&apos;t been walked yet.</p>
        <a href="/" className="text-sm text-forest-300">
          Get your YardScore — Free →
        </a>
      </div>
    );
  }

  const maxLayerCount = Math.max(
    profile.layers.canopy.species,
    profile.layers.understory.species,
    profile.layers.shrub.species,
    profile.layers.groundcover.species,
    1,
  );

  const embedCode = `<iframe src="${typeof window !== "undefined" ? window.location.origin : ""}/garden/${gardenId}/embed" width="300" height="180" frameborder="0"></iframe>`;

  return (
    <div className="min-h-screen bg-forest-950">
      <div className="mx-auto max-w-2xl px-5 py-8">
        {/* ── Header ──────────────────────────────────── */}
        <div className="mb-8 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-forest-300/20 bg-forest-300/10">
              <Sprout className="h-4 w-4 text-forest-300" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-white">
              YardScore
            </span>
          </a>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: `YardScore — ${profile.property.name}`,
                  url: window.location.href,
                });
              } else {
                navigator.clipboard.writeText(window.location.href);
              }
            }}
            className="btn-secondary !rounded-lg !px-3 !py-2 !text-xs"
          >
            <Share2 className="mr-1.5 h-3.5 w-3.5" />
            Share
          </button>
        </div>

        {/* ── Score hero ──────────────────────────────── */}
        <div className="mb-8 text-center">
          {profile.score !== null && (
            <div className="score-badge mb-4 !text-5xl !px-12 !py-6">
              {profile.score}
            </div>
          )}
          <h1 className="text-xl font-bold text-white">
            {profile.property.name}
          </h1>
          {profile.property.address && (
            <p className="mt-1 text-xs text-zinc-500">
              {profile.property.address}
            </p>
          )}
        </div>

        {/* ── Key stats ───────────────────────────────── */}
        <div className="mb-8 grid grid-cols-4 gap-3">
          <div className="stat-card text-center">
            <p className="stat-value !text-xl">{profile.species_count}</p>
            <p className="stat-label">species</p>
          </div>
          <div className="stat-card text-center">
            <p className="stat-value !text-xl">{profile.layer_count}</p>
            <p className="stat-label">eco layers</p>
          </div>
          <div className="stat-card text-center">
            <p className="stat-value !text-xl">{profile.native_percent}%</p>
            <p className="stat-label">native</p>
          </div>
          <div className="stat-card text-center">
            <p className="stat-value !text-xl">{profile.total_plants}</p>
            <p className="stat-label">observed</p>
          </div>
        </div>

        {/* ── Map placeholder ─────────────────────────── */}
        <div className="card mb-8 !p-0 overflow-hidden">
          <div className="relative flex h-48 items-center justify-center bg-forest-900 sm:h-64">
            <MapPin className="mr-2 h-5 w-5 text-zinc-600" />
            <span className="text-sm text-zinc-600">
              Garden map
            </span>
            {/* TODO: Interactive Leaflet map with plants, buildings, boundary */}
          </div>
        </div>

        {/* ── Garden narrative ─────────────────────────── */}
        {profile.narrative ? (
          <div className="garden-voice mb-8">{profile.narrative}</div>
        ) : (
          <div className="garden-voice mb-8 animate-pulse-gentle">
            Generating garden narrative...
          </div>
        )}

        {/* ── Ask this garden ─────────────────────────── */}
        <div className="card mb-8">
          <p className="section-label mb-3">Ask this garden</p>
          <form onSubmit={handleAsk} className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What grows well in shade here?"
              className="address-input !h-11 !rounded-xl !text-sm"
            />
            <button
              type="submit"
              disabled={asking}
              className="btn-primary !rounded-xl !px-4 !py-0 !text-sm disabled:opacity-50"
            >
              {asking ? "..." : "Ask"}
            </button>
          </form>

          {/* Suggested questions */}
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              "What species are here?",
              "What layers are present?",
              "What's missing?",
            ].map((q) => (
              <button
                key={q}
                onClick={() => setQuestion(q)}
                className="chip text-[11px]"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Answer */}
          {answer && (
            <div className="garden-voice mt-4 animate-fade-in">{answer}</div>
          )}
        </div>

        {/* ── Ecological structure ─────────────────────── */}
        <div className="card mb-8">
          <p className="section-label mb-4">Ecological Structure</p>
          <div className="space-y-3">
            {(
              [
                {
                  key: "canopy" as const,
                  label: "Canopy",
                  icon: TreePine,
                },
                {
                  key: "understory" as const,
                  label: "Understory",
                  icon: TreePine,
                },
                { key: "shrub" as const, label: "Shrub", icon: Shrub },
                {
                  key: "groundcover" as const,
                  label: "Groundcover",
                  icon: Leaf,
                },
              ] as const
            ).map((layer) => {
              const data = profile.layers[layer.key];
              const Icon = layer.icon;
              return (
                <div key={layer.key} className="flex items-center gap-3">
                  <Icon className="h-4 w-4 flex-none text-zinc-500" />
                  <span className="w-24 flex-none text-xs text-zinc-400">
                    {layer.label}
                  </span>
                  <div className="flex-1">
                    <div className="h-5 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-forest-600/40 transition-all"
                        style={{
                          width: layerBar(data.species, maxLayerCount),
                        }}
                      />
                    </div>
                  </div>
                  <span className="w-16 flex-none text-right text-xs text-zinc-500">
                    {data.species} spp.
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Species list ─────────────────────────────── */}
        <div className="card mb-8">
          <p className="section-label mb-4">
            Species Observed ({profile.species_count})
          </p>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {profile.species_list.map((s) => (
              <div
                key={s.scientific}
                className="flex items-center justify-between border-b border-white/[0.04] py-2 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`h-1.5 w-1.5 flex-none rounded-full ${s.native ? "bg-forest-400" : "bg-zinc-600"}`}
                  />
                  <span className="text-sm text-zinc-200">{s.name}</span>
                  {s.native && (
                    <span className="text-[10px] text-forest-400/70">
                      native
                    </span>
                  )}
                </div>
                <span className="text-xs text-zinc-600">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Embed / Share ────────────────────────────── */}
        <div className="card mb-8">
          <div className="flex items-center justify-between">
            <p className="section-label">Embed this score</p>
            <button
              onClick={() => setShowEmbed(!showEmbed)}
              className="chip"
            >
              <Code2 className="mr-1 h-3 w-3" />
              {showEmbed ? "Hide" : "Show"} code
            </button>
          </div>
          {showEmbed && (
            <div className="mt-3">
              <pre className="overflow-x-auto rounded-lg bg-forest-900 p-3 text-xs text-zinc-400">
                {embedCode}
              </pre>
              <button
                onClick={() =>
                  navigator.clipboard.writeText(embedCode)
                }
                className="btn-secondary mt-2 !px-3 !py-1.5 !text-xs"
              >
                Copy embed code
              </button>
            </div>
          )}
        </div>

        {/* ── CTA ─────────────────────────────────────── */}
        <div className="mb-8 text-center">
          <p className="text-sm text-zinc-300">
            What&apos;s in your yard?
          </p>
          <a href="/" className="btn-primary mt-4">
            Get Your YardScore — Free
          </a>
          <p className="mt-3 text-[10px] text-zinc-600">
            Everything free. No Pro tier. Your garden earns for you.
          </p>
        </div>

        {/* ── Footer ──────────────────────────────────── */}
        <div className="space-y-1 text-center">
          <p className="text-[9px] text-zinc-700">
            Species identification by Pl@ntNet
          </p>
          <p className="text-[9px] text-zinc-700">YardScore by DrewHenry</p>
        </div>
      </div>
    </div>
  );
}
