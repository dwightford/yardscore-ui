/**
 * Census Report Generator
 *
 * Takes scan observations and produces a structured ecological census report
 * with native/invasive classification, layer analysis, wildlife estimates,
 * and improvement recommendations.
 */

import { lookupSpecies, classifySpecies, estimateWildlifeSpecies, type SpeciesInfo } from "./piedmont-nc-species";

export interface Observation {
  species: string | null;
  label: string;
  category: string; // tree, shrub, herb, ground_cover
  confidence: number;
  lat: number | null;
  lng: number | null;
}

export interface SpeciesCensusEntry {
  scientificName: string;
  commonName: string;
  count: number;
  status: "native" | "invasive" | "ornamental" | "unknown";
  layer: string;
  wildlifeValue: number;
}

export interface LayerAnalysis {
  canopy: { count: number; species: number; status: "strong" | "moderate" | "weak" | "absent" };
  understory: { count: number; species: number; status: "strong" | "moderate" | "weak" | "absent" };
  shrub: { count: number; species: number; status: "strong" | "moderate" | "weak" | "absent" };
  ground_cover: { count: number; species: number; status: "strong" | "moderate" | "weak" | "absent" };
}

export interface Recommendation {
  priority: "high" | "medium" | "low";
  action: string;
  reason: string;
  species_suggestions?: string[];
}

export interface CensusReport {
  // Summary stats
  totalPlants: number;
  totalSpecies: number;
  nativeCount: number;
  invasiveCount: number;
  ornamentalCount: number;
  unknownCount: number;
  nativePercent: number;
  invasivePercent: number;

  // Species breakdown
  speciesList: SpeciesCensusEntry[];
  invasiveList: SpeciesCensusEntry[];
  nativeList: SpeciesCensusEntry[];

  // Layer analysis
  layers: LayerAnalysis;
  layerCompleteness: number; // 0-4 (how many layers present)

  // Wildlife estimate
  wildlifeSpeciesEstimate: number;

  // Recommendations
  recommendations: Recommendation[];

  // Prose
  summaryProse: string;
  layerProse: string;
  recommendationProse: string;
}

function layerStatus(count: number, species: number): "strong" | "moderate" | "weak" | "absent" {
  if (count === 0) return "absent";
  if (species >= 4 && count >= 8) return "strong";
  if (species >= 2 && count >= 3) return "moderate";
  return "weak";
}

export function generateCensusReport(observations: Observation[], scanDurationMin?: number): CensusReport {
  // Count by species
  const speciesCounts = new Map<string, { count: number; label: string; category: string }>();

  for (const obs of observations) {
    const key = obs.species || obs.label;
    const existing = speciesCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      speciesCounts.set(key, { count: 1, label: obs.label, category: obs.category });
    }
  }

  // Build species list with native/invasive status
  const speciesList: SpeciesCensusEntry[] = [];
  let nativeCount = 0;
  let invasiveCount = 0;
  let ornamentalCount = 0;
  let unknownCount = 0;

  for (const [name, data] of Array.from(speciesCounts.entries())) {
    const info = lookupSpecies(name);
    const status = info?.status ?? "unknown";
    const layer = info?.layer ?? data.category;
    const wildlifeValue = info?.wildlife_value ?? 0;

    const entry: SpeciesCensusEntry = {
      scientificName: name,
      commonName: info?.common_name ?? data.label,
      count: data.count,
      status,
      layer,
      wildlifeValue,
    };

    speciesList.push(entry);

    switch (status) {
      case "native": nativeCount += data.count; break;
      case "invasive": invasiveCount += data.count; break;
      case "ornamental": ornamentalCount += data.count; break;
      default: unknownCount += data.count; break;
    }
  }

  // Sort by count descending
  speciesList.sort((a, b) => b.count - a.count);

  const totalPlants = observations.length;
  const totalSpecies = speciesList.length;
  const nativePercent = totalPlants > 0 ? Math.round((nativeCount / totalPlants) * 100) : 0;
  const invasivePercent = totalPlants > 0 ? Math.round((invasiveCount / totalPlants) * 100) : 0;

  const nativeList = speciesList.filter((s) => s.status === "native");
  const invasiveList = speciesList.filter((s) => s.status === "invasive");

  // Layer analysis
  const layerCounts = { canopy: { count: 0, species: new Set<string>() }, understory: { count: 0, species: new Set<string>() }, shrub: { count: 0, species: new Set<string>() }, ground_cover: { count: 0, species: new Set<string>() } };

  for (const entry of speciesList) {
    const l = entry.layer as keyof typeof layerCounts;
    if (layerCounts[l]) {
      layerCounts[l].count += entry.count;
      layerCounts[l].species.add(entry.scientificName);
    } else if (entry.layer === "vine") {
      // Vines count toward shrub layer
      layerCounts.shrub.count += entry.count;
      layerCounts.shrub.species.add(entry.scientificName);
    }
  }

  const layers: LayerAnalysis = {
    canopy: { count: layerCounts.canopy.count, species: layerCounts.canopy.species.size, status: layerStatus(layerCounts.canopy.count, layerCounts.canopy.species.size) },
    understory: { count: layerCounts.understory.count, species: layerCounts.understory.species.size, status: layerStatus(layerCounts.understory.count, layerCounts.understory.species.size) },
    shrub: { count: layerCounts.shrub.count, species: layerCounts.shrub.species.size, status: layerStatus(layerCounts.shrub.count, layerCounts.shrub.species.size) },
    ground_cover: { count: layerCounts.ground_cover.count, species: layerCounts.ground_cover.species.size, status: layerStatus(layerCounts.ground_cover.count, layerCounts.ground_cover.species.size) },
  };

  const presentLayers = [layers.canopy, layers.understory, layers.shrub, layers.ground_cover].filter((l) => l.status !== "absent").length;

  // Wildlife estimate
  const nativeSpeciesNames = nativeList.map((s) => s.scientificName);
  const wildlifeSpeciesEstimate = estimateWildlifeSpecies(nativeSpeciesNames);

  // Recommendations
  const recommendations: Recommendation[] = [];

  // Invasive removal
  for (const inv of invasiveList) {
    const info = lookupSpecies(inv.scientificName);
    recommendations.push({
      priority: "high",
      action: `Remove ${inv.commonName} (${inv.scientificName})`,
      reason: info?.notes || "Invasive species that displaces natives",
    });
  }

  // Layer gaps
  if (layers.canopy.status === "absent" || layers.canopy.status === "weak") {
    recommendations.push({
      priority: "medium",
      action: "Add canopy trees",
      reason: "Canopy layer provides the foundation for ecosystem structure",
      species_suggestions: ["Quercus alba (White Oak)", "Acer rubrum (Red Maple)", "Liriodendron tulipifera (Tulip Poplar)"],
    });
  }
  if (layers.understory.status === "absent" || layers.understory.status === "weak") {
    recommendations.push({
      priority: "medium",
      action: "Add understory trees",
      reason: "Understory fills the gap between canopy and shrub layer",
      species_suggestions: ["Cercis canadensis (Redbud)", "Cornus florida (Dogwood)", "Amelanchier arborea (Serviceberry)"],
    });
  }
  if (layers.shrub.status === "absent" || layers.shrub.status === "weak") {
    recommendations.push({
      priority: "medium",
      action: "Add native shrubs",
      reason: "Shrub layer provides nesting habitat and wildlife food",
      species_suggestions: ["Callicarpa americana (Beautyberry)", "Viburnum dentatum (Arrowwood)", "Lindera benzoin (Spicebush)"],
    });
  }
  if (layers.ground_cover.status === "absent" || layers.ground_cover.status === "weak") {
    recommendations.push({
      priority: "low",
      action: "Add ground cover",
      reason: "Ground layer reduces erosion and provides habitat for ground-nesting species",
      species_suggestions: ["Packera aurea (Golden Ragwort)", "Polystichum acrostichoides (Christmas Fern)", "Phlox stolonifera (Creeping Phlox)"],
    });
  }

  // Generate prose
  const summaryProse = generateSummaryProse(totalPlants, totalSpecies, nativePercent, invasiveCount, wildlifeSpeciesEstimate, scanDurationMin);
  const layerProse = generateLayerProse(layers, presentLayers);
  const recommendationProse = generateRecommendationProse(recommendations);

  return {
    totalPlants,
    totalSpecies,
    nativeCount,
    invasiveCount,
    ornamentalCount,
    unknownCount,
    nativePercent,
    invasivePercent,
    speciesList,
    invasiveList,
    nativeList,
    layers,
    layerCompleteness: presentLayers,
    wildlifeSpeciesEstimate,
    recommendations,
    summaryProse,
    layerProse,
    recommendationProse,
  };
}

function generateSummaryProse(total: number, species: number, nativePct: number, invasiveCount: number, wildlife: number, durationMin?: number): string {
  const parts: string[] = [];

  if (durationMin) {
    parts.push(`In a ${durationMin}-minute walk, you identified ${total} plants across ${species} species.`);
  } else {
    parts.push(`${total} plants identified across ${species} species.`);
  }

  if (nativePct >= 90) {
    parts.push(`${nativePct}% are native — exceptional ecological composition.`);
  } else if (nativePct >= 70) {
    parts.push(`${nativePct}% native species — strong ecological foundation.`);
  } else if (nativePct >= 50) {
    parts.push(`${nativePct}% native — room to improve by replacing non-natives.`);
  } else {
    parts.push(`Only ${nativePct}% native. Shifting toward native species would significantly improve ecological value.`);
  }

  if (invasiveCount > 0) {
    parts.push(`${invasiveCount} invasive plant${invasiveCount > 1 ? "s" : ""} detected — removing ${invasiveCount > 1 ? "these" : "this"} is the highest-impact action you can take.`);
  } else {
    parts.push("No invasive species detected — well done.");
  }

  if (wildlife > 0) {
    parts.push(`Your native plants support an estimated ${wildlife} Lepidoptera (moth and butterfly) species, which in turn feed birds and other wildlife.`);
  }

  return parts.join(" ");
}

function generateLayerProse(layers: LayerAnalysis, completeness: number): string {
  const parts: string[] = [];

  if (completeness === 4) {
    parts.push("All four ecological layers are present — canopy, understory, shrub, and ground cover. This is excellent ecosystem structure.");
  } else if (completeness === 3) {
    parts.push(`Three of four layers present (${completeness}/4). Adding the missing layer would improve habitat diversity.`);
  } else if (completeness <= 2) {
    parts.push(`Only ${completeness} of 4 ecological layers present. A healthy yard needs canopy, understory, shrub, and ground cover layers working together.`);
  }

  const statusEmoji = { strong: "✓", moderate: "○", weak: "△", absent: "✗" };
  parts.push(`Canopy ${statusEmoji[layers.canopy.status]} (${layers.canopy.count} trees, ${layers.canopy.species} species)`);
  parts.push(`Understory ${statusEmoji[layers.understory.status]} (${layers.understory.count} trees, ${layers.understory.species} species)`);
  parts.push(`Shrub ${statusEmoji[layers.shrub.status]} (${layers.shrub.count} shrubs, ${layers.shrub.species} species)`);
  parts.push(`Ground ${statusEmoji[layers.ground_cover.status]} (${layers.ground_cover.count} plants, ${layers.ground_cover.species} species)`);

  return parts.join("\n");
}

function generateRecommendationProse(recs: Recommendation[]): string {
  if (recs.length === 0) return "Your yard is in excellent ecological condition. Continue maintaining native plantings.";

  const high = recs.filter((r) => r.priority === "high");
  const medium = recs.filter((r) => r.priority === "medium");

  const parts: string[] = [];

  if (high.length > 0) {
    parts.push(`Priority actions (${high.length}):`);
    for (const r of high) {
      parts.push(`• ${r.action} — ${r.reason}`);
    }
  }

  if (medium.length > 0) {
    parts.push(`\nImprovement opportunities (${medium.length}):`);
    for (const r of medium) {
      parts.push(`• ${r.action}`);
      if (r.species_suggestions) {
        parts.push(`  Try: ${r.species_suggestions.join(", ")}`);
      }
    }
  }

  return parts.join("\n");
}
