/**
 * Local native plant nurseries — Orange County / Triangle NC
 *
 * Used to show "Available locally at..." in census recommendations.
 * Each nursery has a list of genera they're known to carry.
 * Match is by genus (first word of scientific name) not exact species,
 * since nursery stock varies seasonally.
 */

export interface LocalNursery {
  name: string;
  location: string;
  url: string;
  distance_note: string; // e.g. "Chapel Hill" or "8 miles"
  genera: string[]; // lowercase genus names they carry
}

export const LOCAL_NURSERIES: LocalNursery[] = [
  {
    name: "Deep Roots Natives",
    location: "Chapel Hill, NC",
    url: "https://deeprootsnatives.com",
    distance_note: "Chapel Hill",
    genera: [
      "quercus", "acer", "betula", "nyssa", "platanus", "liriodendron", "fagus",
      "cornus", "cercis", "amelanchier", "oxydendrum", "chionanthus", "aesculus", "asimina",
      "callicarpa", "hydrangea", "fothergilla", "viburnum", "ilex", "lindera",
      "clethra", "itea", "leucothoe", "myrica", "morella", "calycanthus",
      "rhododendron", "kalmia", "hamamelis", "diervilla",
      "juniperus", "yucca",
    ],
  },
  {
    name: "Rachel's Native Plants",
    location: "Pittsboro, NC",
    url: "https://rachelsnativeplants.com",
    distance_note: "Pittsboro",
    genera: [
      "mertensia", "geranium", "packera", "cephalanthus",
      "asclepias", "echinacea", "rudbeckia", "solidago",
      "callicarpa", "viburnum", "fothergilla", "ilex", "hydrangea",
      "cornus", "cercis", "quercus", "acer",
    ],
  },
  {
    name: "Niche Gardens",
    location: "Chapel Hill, NC",
    url: "https://nichegardens.com",
    distance_note: "Chapel Hill",
    genera: [
      "asclepias", "echinacea", "rudbeckia", "solidago", "symphyotrichum",
      "phlox", "packera", "helianthus", "lobelia", "monarda",
      "callicarpa", "fothergilla", "hydrangea", "itea", "clethra",
      "cornus", "cercis", "amelanchier",
    ],
  },
];

/**
 * Find local nurseries that likely carry a given species.
 * Matches on genus (first word of scientific name).
 */
export function findLocalNurseries(scientificName: string): LocalNursery[] {
  const genus = scientificName.toLowerCase().split(" ")[0];
  return LOCAL_NURSERIES.filter((n) => n.genera.includes(genus));
}

/**
 * Get a display string for local availability.
 * e.g. "Available at Deep Roots Natives (Chapel Hill), Rachel's Native Plants (Pittsboro)"
 */
export function localAvailabilityText(scientificName: string): string {
  const nurseries = findLocalNurseries(scientificName);
  if (nurseries.length === 0) return "";
  return nurseries.map((n) => `${n.name} (${n.distance_note})`).join(", ");
}
