"use client";

/**
 * /share?id=<land_unit_id> — Public property ecological census
 *
 * NO AUTH. Anyone can view.
 *
 * Design philosophy:
 * - Nature documentary, not a lecture
 * - Data as wonder, not judgment
 * - Achievement, not grades
 * - Let the numbers speak — no opinions
 */

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { lookupSpecies, estimateWildlifeSpecies } from "@/lib/piedmont-nc-species";
import { generateCensusReport, type CensusReport } from "@/lib/census-report";
import { findLocalNurseries } from "@/lib/local-nurseries";

interface Entity {
  id: string;
  entity_type: string;
  label: string;
  species: string | null;
  observation_count: number;
}

interface PropertyData {
  property: { id: string; name: string; address: string | null };
  entities: Entity[];
  score: { score_value: number; confidence: number; coverage: number } | null;
  entity_count: number;
  light_summary: Record<string, number> | null;
  light_readings: number;
  lot_size_sqft: number | null;
}

function ShareContent() {
  const searchParams = useSearchParams();
  const landUnitId = searchParams.get("id");

  const [data, setData] = useState<PropertyData | null>(null);
  const [report, setReport] = useState<CensusReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!landUnitId) return;
    fetch(`/api/public/report/${landUnitId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d && !d.error) {
          setData(d);
          if (d.entities.length > 0) {
            const expanded = d.entities.flatMap((e: Entity) =>
              Array(e.observation_count).fill(null).map(() => ({
                species: e.species,
                label: e.label,
                category: e.entity_type,
                confidence: 0.8,
                lat: null,
                lng: null,
              }))
            );
            setReport(generateCensusReport(expanded));
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [landUnitId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07110c] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-lime-300 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || !report) {
    return (
      <div className="min-h-screen bg-[#07110c] flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-zinc-400">No census data available yet.</p>
        <a href="/" className="text-lime-300 text-sm">Learn about YardScore →</a>
      </div>
    );
  }

  // Use census-derived score (preferred) or fall back to backend score
  const v = report.censusScore > 0 ? report.censusScore : (data.score ? Math.round(data.score.score_value) : null);

  // Score ring color
  const ringColor = v !== null
    ? v >= 80 ? "border-lime-400" : v >= 60 ? "border-lime-300" : v >= 40 ? "border-yellow-400" : "border-red-400"
    : "border-zinc-600";
  const scoreText = v !== null
    ? v >= 80 ? "text-lime-400" : v >= 60 ? "text-lime-300" : v >= 40 ? "text-yellow-400" : "text-red-400"
    : "text-zinc-600";

  const layerNames: Record<string, string> = { canopy: "Canopy", understory: "Understory", shrub: "Shrub", ground_cover: "Ground Cover" };
  const layerEmoji: Record<string, string> = { strong: "●", moderate: "◐", weak: "○", absent: "·" };
  const layerColor: Record<string, string> = { strong: "text-lime-400", moderate: "text-lime-300/60", weak: "text-zinc-500", absent: "text-zinc-700" };

  return (
    <div className="min-h-screen bg-[#07110c]">
      <div className="max-w-md mx-auto px-5 py-8">

        {/* ── Header: YardScore branding ──────────────────────────────────── */}
        <div className="flex items-center gap-2.5 mb-10">
          <div className="w-8 h-8 rounded-lg bg-lime-300/10 border border-lime-300/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-lime-300" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 22c-4-4-8-7.5-8-12a8 8 0 0 1 16 0c0 4.5-4 8-8 12Z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-white tracking-tight">YardScore</span>
        </div>

        {/* ── The Score ───────────────────────────────────────────────────── */}
        <div className="text-center mb-10">
          {v !== null && (
            <div className={`inline-flex items-center justify-center w-28 h-28 rounded-full border-4 ${ringColor} mb-4`}>
              <span className={`text-5xl font-bold ${scoreText}`}>{v}</span>
            </div>
          )}
          <h1 className="text-xl font-bold text-white">{data.property.name}</h1>
          {data.property.address && (
            <p className="text-xs text-zinc-500 mt-1.5">{data.property.address.split(",").slice(0, 2).join(",")}</p>
          )}
        </div>

        {/* ── The Headline Numbers ────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{report.totalSpecies}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">species</p>
          </div>
          <div className="text-center">
            <p className={`text-2xl font-bold ${report.nativePercent >= 80 ? "text-lime-300" : report.nativePercent >= 50 ? "text-yellow-300" : "text-zinc-400"}`}>
              {report.nativePercent}%
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">native</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{report.totalPlants}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">observed</p>
          </div>
        </div>

        {/* ── Wildlife: the wonder moment ─────────────────────────────────── */}
        {report.wildlifeSpeciesEstimate > 0 && (
          <div className="rounded-2xl border border-lime-300/10 bg-[#0a1a0f] p-6 mb-6 text-center">
            <p className="text-5xl font-bold text-lime-300 tracking-tight">
              {report.wildlifeSpeciesEstimate.toLocaleString()}
            </p>
            <p className="text-sm text-zinc-300 mt-2">
              moth and butterfly species
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              hosted by the native plants on this property
            </p>
          </div>
        )}

        {/* ── Light Conditions ─────────────────────────────────────────────── */}
        {data.light_readings > 0 && (
          <div className="mb-6">
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Site Conditions</p>
            <p className="text-xs text-zinc-400">
              {data.light_readings} light readings collected.
              {data.light_readings < 50
                ? " More scans at different times of day will build a complete sun/shade profile for planting recommendations."
                : data.light_readings < 200
                ? " Building toward a reliable light profile. Morning and afternoon scans of different areas will improve accuracy."
                : " Strong light data. Recommendations are increasingly matched to your site conditions."
              }
            </p>
          </div>
        )}

        {/* ── Ecosystem Structure ─────────────────────────────────────────── */}
        <div className="mb-6">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-3">Ecosystem Structure</p>
          <div className="flex items-center justify-between gap-1">
            {(["canopy", "understory", "shrub", "ground_cover"] as const).map((layer) => {
              const l = report.layers[layer];
              return (
                <div key={layer} className="flex-1 text-center">
                  <p className={`text-lg ${layerColor[l.status]}`}>{layerEmoji[l.status]}</p>
                  <p className="text-[10px] text-zinc-500 mt-1">{layerNames[layer]}</p>
                  <p className="text-[9px] text-zinc-600">{l.species} spp.</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Species: the inventory ──────────────────────────────────────── */}
        <div className="mb-6">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-3">Species Observed</p>

          {/* Natives */}
          {report.nativeList.length > 0 && (
            <div className="mb-4">
              {report.nativeList.map((s: any) => (
                <div key={s.scientificName} className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-lime-400 flex-none" />
                    <div className="min-w-0">
                      <span className="text-xs text-zinc-200">{s.commonName}</span>
                      {s.wildlifeValue > 100 && (
                        <span className="text-[9px] text-lime-400/70 ml-1.5">keystone</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-none">
                    <a
                      href={`https://www.etsy.com/search?q=${encodeURIComponent(s.scientificName + " native plant")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] text-zinc-600 hover:text-lime-300 transition-colors"
                    >
                      find
                    </a>
                    <span className="text-[10px] text-zinc-600">{s.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Invasives — matter-of-fact with native alternatives */}
          {report.invasiveList.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] text-zinc-500 mb-2">Invasive species present</p>
              {report.invasiveList.map((s: any) => {
                // Suggest native alternatives for common invasives
                const alternatives: Record<string, string[]> = {
                  "Nandina": ["Ilex verticillata (Winterberry)", "Callicarpa americana (Beautyberry)"],
                  "Bradford Pear": ["Amelanchier arborea (Serviceberry)", "Cercis canadensis (Redbud)"],
                  "Chinese Privet": ["Viburnum dentatum (Arrowwood)", "Lindera benzoin (Spicebush)"],
                  "English Ivy": ["Packera aurea (Golden Ragwort)", "Polystichum acrostichoides (Christmas Fern)"],
                  "Japanese Honeysuckle": ["Lonicera sempervirens (Coral Honeysuckle)"],
                  "Multiflora Rose": ["Rosa carolina (Carolina Rose)"],
                  "Mimosa": ["Cercis canadensis (Redbud)", "Chionanthus virginicus (Fringetree)"],
                };
                const alts = alternatives[s.commonName] || [];
                return (
                  <div key={s.scientificName} className="py-2 border-b border-white/[0.03] last:border-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                        <span className="text-xs text-zinc-400">{s.commonName}</span>
                      </div>
                      <span className="text-[10px] text-zinc-600">{s.count}</span>
                    </div>
                    {alts.length > 0 && (
                      <div className="ml-4 mt-1">
                        <p className="text-[9px] text-zinc-600">Consider instead:</p>
                        {alts.map((alt, i) => {
                          const name = alt.split(" (")[0];
                          return (
                            <div key={i} className="mt-0.5">
                              <span className="text-[10px] text-lime-400/60">{alt}</span>
                              <span className="text-[9px] text-zinc-600 ml-1">
                                {(() => {
                                  const altName = alt.split(" (")[0];
                                  const local = findLocalNurseries(altName);
                                  if (local.length > 0) {
                                    return local.map((n, ni) => (
                                      <a key={ni} href={n.url} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-lime-300 transition-colors">
                                        {n.name}{ni < local.length - 1 ? ", " : ""}
                                      </a>
                                    ));
                                  }
                                  return (
                                    <a href={`https://www.etsy.com/search?q=${encodeURIComponent(altName + " native plant")}`} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-lime-300">
                                      Etsy
                                    </a>
                                  );
                                })()}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Others — quiet */}
          {report.speciesList.filter((s: any) => s.status === "ornamental" || s.status === "unknown").length > 0 && (
            <div>
              {report.speciesList.filter((s: any) => s.status === "ornamental" || s.status === "unknown").map((s: any) => (
                <div key={s.scientificName} className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                    <span className="text-xs text-zinc-500">{s.commonName}</span>
                  </div>
                  <span className="text-[10px] text-zinc-700">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── What's next: curiosity, not guilt ──────────────────────────── */}
        {report.recommendations.length > 0 && (
          <div className="mb-8">
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-3">Opportunities</p>
            {report.recommendations.map((rec: any, i: number) => (
              <div key={i} className="mb-4 last:mb-0">
                <p className="text-xs text-zinc-300">{rec.action}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">{rec.reason}</p>
                {rec.species_suggestions && (
                  <div className="mt-1.5 space-y-1">
                    {rec.species_suggestions.map((sp: string, j: number) => {
                      const name = sp.split(" (")[0];
                      const local = findLocalNurseries(name);
                      return (
                        <div key={j}>
                          <span className="text-[10px] text-lime-400/70">{sp}</span>
                          <span className="text-[9px] text-zinc-600 ml-1.5">
                            {local.length > 0 ? (
                              local.map((n, ni) => (
                                <a key={ni} href={n.url} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-lime-300 transition-colors">
                                  {n.name}{ni < local.length - 1 ? " · " : ""}
                                </a>
                              ))
                            ) : (
                              <a href={`https://www.etsy.com/search?q=${encodeURIComponent(name + " native plant")}`} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-lime-300">
                                find online →
                              </a>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Divider ────────────────────────────────────────────────────── */}
        <div className="border-t border-white/[0.04] my-8" />

        {/* ── CTA: quiet, confident ──────────────────────────────────────── */}
        <div className="text-center mb-8">
          <p className="text-sm text-zinc-300">What's in your yard?</p>
          <a
            href="/"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-lime-300 px-8 py-3.5 text-sm font-semibold text-zinc-950 transition hover:bg-lime-200"
          >
            Scan Your Yard
          </a>
          <p className="text-[10px] text-zinc-600 mt-3">Free · 10 minutes · Any phone</p>
        </div>

        {/* ── Attribution ────────────────────────────────────────────────── */}
        <div className="text-center space-y-1">
          <p className="text-[9px] text-zinc-700">Species identification by Pl@ntNet</p>
          <p className="text-[9px] text-zinc-700">Wildlife data from Doug Tallamy&apos;s host plant research</p>
          <p className="text-[9px] text-zinc-700">YardScore by DrewHenry</p>
        </div>
      </div>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#07110c] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-lime-300 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ShareContent />
    </Suspense>
  );
}
