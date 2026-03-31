/**
 * Piedmont NC species database — native/invasive/ornamental classification
 *
 * Sources:
 * - USDA PLANTS Database (plants.usda.gov)
 * - NC Native Plant Society
 * - Doug Tallamy's "Nature's Best Hope" host plant research
 * - NC Forest Service invasive species list
 *
 * Each species has:
 * - status: "native" | "invasive" | "ornamental" | "unknown"
 * - layer: "canopy" | "understory" | "shrub" | "ground_cover" | "vine" | "grass"
 * - wildlife_value: estimated number of Lepidoptera (moth/butterfly) species hosted
 *   (from Tallamy's research — higher = more ecologically valuable)
 * - sun: "full_sun" | "part_shade" | "full_shade" | "adaptable"
 * - notes: brief ecological context
 */

export interface SpeciesInfo {
  scientific_name: string;
  common_name: string;
  status: "native" | "invasive" | "ornamental" | "unknown";
  layer: "canopy" | "understory" | "shrub" | "ground_cover" | "vine" | "grass";
  wildlife_value: number; // lepidoptera species hosted (Tallamy)
  sun: "full_sun" | "part_shade" | "full_shade" | "adaptable";
  notes: string;
}

// Lookup by scientific name (lowercase, without author)
const SPECIES_DB: Record<string, SpeciesInfo> = {
  // ══════════════════════════════════════════════════════════════════════
  // NATIVE CANOPY TREES
  // ══════════════════════════════════════════════════════════════════════
  "quercus alba": { scientific_name: "Quercus alba", common_name: "White Oak", status: "native", layer: "canopy", wildlife_value: 534, sun: "full_sun", notes: "Keystone species. Hosts more Lepidoptera than any other genus." },
  "quercus rubra": { scientific_name: "Quercus rubra", common_name: "Red Oak", status: "native", layer: "canopy", wildlife_value: 534, sun: "full_sun", notes: "Major canopy tree. Acorns feed dozens of bird and mammal species." },
  "quercus velutina": { scientific_name: "Quercus velutina", common_name: "Black Oak", status: "native", layer: "canopy", wildlife_value: 534, sun: "full_sun", notes: "Upland oak. Excellent wildlife value." },
  "quercus phellos": { scientific_name: "Quercus phellos", common_name: "Willow Oak", status: "native", layer: "canopy", wildlife_value: 534, sun: "full_sun", notes: "Common street tree. Fast-growing native oak." },
  "quercus coccinea": { scientific_name: "Quercus coccinea", common_name: "Scarlet Oak", status: "native", layer: "canopy", wildlife_value: 534, sun: "full_sun", notes: "Brilliant fall color. Dry upland sites." },
  "acer rubrum": { scientific_name: "Acer rubrum", common_name: "Red Maple", status: "native", layer: "canopy", wildlife_value: 285, sun: "adaptable", notes: "Extremely adaptable. Early spring bloom supports pollinators." },
  "acer saccharum": { scientific_name: "Acer saccharum", common_name: "Sugar Maple", status: "native", layer: "canopy", wildlife_value: 285, sun: "part_shade", notes: "Shade-tolerant canopy tree." },
  "liriodendron tulipifera": { scientific_name: "Liriodendron tulipifera", common_name: "Tulip Poplar", status: "native", layer: "canopy", wildlife_value: 21, sun: "full_sun", notes: "Tallest eastern hardwood. Fast-growing. Major nectar source." },
  "carya ovata": { scientific_name: "Carya ovata", common_name: "Shagbark Hickory", status: "native", layer: "canopy", wildlife_value: 200, sun: "full_sun", notes: "Nuts feed wildlife. Distinctive bark." },
  "carya laciniosa": { scientific_name: "Carya laciniosa", common_name: "Shellbark Hickory", status: "native", layer: "canopy", wildlife_value: 200, sun: "full_sun", notes: "Largest hickory nut. Rare in cultivation." },
  "carya tomentosa": { scientific_name: "Carya tomentosa", common_name: "Mockernut Hickory", status: "native", layer: "canopy", wildlife_value: 200, sun: "full_sun", notes: "Most common hickory in Piedmont." },
  "nyssa sylvatica": { scientific_name: "Nyssa sylvatica", common_name: "Black Gum", status: "native", layer: "canopy", wildlife_value: 35, sun: "adaptable", notes: "Spectacular fall color. Early fruit feeds migrating birds." },
  "liquidambar styraciflua": { scientific_name: "Liquidambar styraciflua", common_name: "Sweetgum", status: "native", layer: "canopy", wildlife_value: 35, sun: "full_sun", notes: "Pioneer species. Seeds feed goldfinches." },
  "platanus occidentalis": { scientific_name: "Platanus occidentalis", common_name: "American Sycamore", status: "native", layer: "canopy", wildlife_value: 45, sun: "full_sun", notes: "Massive native. Riparian corridors." },
  "fagus grandifolia": { scientific_name: "Fagus grandifolia", common_name: "American Beech", status: "native", layer: "canopy", wildlife_value: 126, sun: "full_shade", notes: "Shade-tolerant climax species. Beechnuts feed wildlife." },
  "fraxinus americana": { scientific_name: "Fraxinus americana", common_name: "White Ash", status: "native", layer: "canopy", wildlife_value: 150, sun: "full_sun", notes: "Threatened by Emerald Ash Borer. Plant while we can." },
  "betula nigra": { scientific_name: "Betula nigra", common_name: "River Birch", status: "native", layer: "canopy", wildlife_value: 413, sun: "full_sun", notes: "Excellent wildlife value. Tolerates wet sites." },
  "pinus taeda": { scientific_name: "Pinus taeda", common_name: "Loblolly Pine", status: "native", layer: "canopy", wildlife_value: 203, sun: "full_sun", notes: "Dominant Piedmont pine. Seeds feed birds." },
  "pinus virginiana": { scientific_name: "Pinus virginiana", common_name: "Virginia Pine", status: "native", layer: "canopy", wildlife_value: 203, sun: "full_sun", notes: "Pioneer species on disturbed sites." },
  "juniperus virginiana": { scientific_name: "Juniperus virginiana", common_name: "Eastern Red Cedar", status: "native", layer: "canopy", wildlife_value: 54, sun: "full_sun", notes: "Berries critical for cedar waxwings. Year-round cover." },
  "prunus serotina": { scientific_name: "Prunus serotina", common_name: "Black Cherry", status: "native", layer: "canopy", wildlife_value: 456, sun: "full_sun", notes: "3rd most valuable host plant genus. Fruit feeds 40+ bird species." },
  "diospyros virginiana": { scientific_name: "Diospyros virginiana", common_name: "American Persimmon", status: "native", layer: "canopy", wildlife_value: 46, sun: "full_sun", notes: "Fruit valuable for wildlife and humans." },
  "sassafras albidum": { scientific_name: "Sassafras albidum", common_name: "Sassafras", status: "native", layer: "canopy", wildlife_value: 35, sun: "full_sun", notes: "Host for Spicebush Swallowtail. Aromatic." },
  "ulmus americana": { scientific_name: "Ulmus americana", common_name: "American Elm", status: "native", layer: "canopy", wildlife_value: 213, sun: "full_sun", notes: "DED-resistant cultivars available." },

  // ══════════════════════════════════════════════════════════════════════
  // NATIVE UNDERSTORY TREES
  // ══════════════════════════════════════════════════════════════════════
  "cornus florida": { scientific_name: "Cornus florida", common_name: "Flowering Dogwood", status: "native", layer: "understory", wildlife_value: 117, sun: "part_shade", notes: "Iconic Piedmont understory. Fruit feeds 40+ bird species. Anthracnose-resistant cultivars exist." },
  "cercis canadensis": { scientific_name: "Cercis canadensis", common_name: "Eastern Redbud", status: "native", layer: "understory", wildlife_value: 19, sun: "part_shade", notes: "Early spring bloom. Critical early pollinator resource." },
  "oxydendrum arboreum": { scientific_name: "Oxydendrum arboreum", common_name: "Sourwood", status: "native", layer: "understory", wildlife_value: 53, sun: "part_shade", notes: "Source of prized sourwood honey. Spectacular fall color." },
  "amelanchier arborea": { scientific_name: "Amelanchier arborea", common_name: "Serviceberry", status: "native", layer: "understory", wildlife_value: 124, sun: "part_shade", notes: "Early spring bloom + edible fruit. Multi-season interest." },
  "chionanthus virginicus": { scientific_name: "Chionanthus virginicus", common_name: "White Fringetree", status: "native", layer: "understory", wildlife_value: 2, sun: "part_shade", notes: "Stunning spring bloom. Olive family relative." },
  "aesculus pavia": { scientific_name: "Aesculus pavia", common_name: "Red Buckeye", status: "native", layer: "understory", wildlife_value: 35, sun: "part_shade", notes: "Early spring nectar for hummingbirds." },
  "aesculus sylvatica": { scientific_name: "Aesculus sylvatica", common_name: "Painted Buckeye", status: "native", layer: "understory", wildlife_value: 35, sun: "part_shade", notes: "Uncommon native. Shade-tolerant." },
  "aralia spinosa": { scientific_name: "Aralia spinosa", common_name: "Devil's Walking Stick", status: "native", layer: "understory", wildlife_value: 12, sun: "part_shade", notes: "Dramatic tropical look. Late summer fruit for birds." },
  "asimina triloba": { scientific_name: "Asimina triloba", common_name: "Pawpaw", status: "native", layer: "understory", wildlife_value: 12, sun: "part_shade", notes: "Edible fruit. Host for Zebra Swallowtail." },
  "ilex opaca": { scientific_name: "Ilex opaca", common_name: "American Holly", status: "native", layer: "understory", wildlife_value: 49, sun: "part_shade", notes: "Evergreen. Winter berries for birds." },
  "cornus alternifolia": { scientific_name: "Cornus alternifolia", common_name: "Pagoda Dogwood", status: "native", layer: "understory", wildlife_value: 117, sun: "part_shade", notes: "Tiered branching. Shade-tolerant." },

  // ══════════════════════════════════════════════════════════════════════
  // NATIVE SHRUBS
  // ══════════════════════════════════════════════════════════════════════
  "callicarpa americana": { scientific_name: "Callicarpa americana", common_name: "American Beautyberry", status: "native", layer: "shrub", wildlife_value: 3, sun: "part_shade", notes: "Vivid purple berries. Easy to grow. Birds eat berries in fall." },
  "hydrangea quercifolia": { scientific_name: "Hydrangea quercifolia", common_name: "Oakleaf Hydrangea", status: "native", layer: "shrub", wildlife_value: 2, sun: "part_shade", notes: "Multi-season interest. Exfoliating bark, fall color." },
  "fothergilla gardenii": { scientific_name: "Fothergilla gardenii", common_name: "Dwarf Witch Alder", status: "native", layer: "shrub", wildlife_value: 2, sun: "part_shade", notes: "Fragrant spring bloom. Excellent fall color." },
  "fothergilla major": { scientific_name: "Fothergilla major", common_name: "Large Witch Alder", status: "native", layer: "shrub", wildlife_value: 2, sun: "part_shade", notes: "Larger form. Mountain origin, adapts to Piedmont." },
  "fothergilla latifolia": { scientific_name: "Fothergilla latifolia", common_name: "Large Witch Alder", status: "native", layer: "shrub", wildlife_value: 2, sun: "part_shade", notes: "Synonym for F. major. Bottlebrush white flowers." },
  "lindera benzoin": { scientific_name: "Lindera benzoin", common_name: "Spicebush", status: "native", layer: "shrub", wildlife_value: 12, sun: "part_shade", notes: "Host for Spicebush Swallowtail. Aromatic. Shade-tolerant." },
  "viburnum dentatum": { scientific_name: "Viburnum dentatum", common_name: "Arrowwood Viburnum", status: "native", layer: "shrub", wildlife_value: 97, sun: "adaptable", notes: "Berries ripen blue. Important bird food." },
  "viburnum prunifolium": { scientific_name: "Viburnum prunifolium", common_name: "Blackhaw Viburnum", status: "native", layer: "shrub", wildlife_value: 97, sun: "adaptable", notes: "White spring flowers, fall fruit, fall color." },
  "ilex vomitoria": { scientific_name: "Ilex vomitoria", common_name: "Yaupon Holly", status: "native", layer: "shrub", wildlife_value: 49, sun: "adaptable", notes: "Evergreen. Berries for winter birds. Caffeine-containing leaves." },
  "ilex verticillata": { scientific_name: "Ilex verticillata", common_name: "Winterberry", status: "native", layer: "shrub", wildlife_value: 49, sun: "full_sun", notes: "Deciduous holly. Bright red winter berries." },
  "myrica cerifera": { scientific_name: "Myrica cerifera", common_name: "Wax Myrtle", status: "native", layer: "shrub", wildlife_value: 31, sun: "full_sun", notes: "Semi-evergreen. Nitrogen-fixing. Fast screen." },
  "morella cerifera": { scientific_name: "Morella cerifera", common_name: "Wax Myrtle", status: "native", layer: "shrub", wildlife_value: 31, sun: "full_sun", notes: "Updated genus name for Myrica cerifera." },
  "calycanthus floridus": { scientific_name: "Calycanthus floridus", common_name: "Sweetshrub", status: "native", layer: "shrub", wildlife_value: 3, sun: "part_shade", notes: "Fragrant maroon flowers. Deer-resistant." },
  "clethra alnifolia": { scientific_name: "Clethra alnifolia", common_name: "Summersweet", status: "native", layer: "shrub", wildlife_value: 2, sun: "part_shade", notes: "Summer bloom. Excellent pollinator plant. Tolerates wet feet." },
  "rhododendron maximum": { scientific_name: "Rhododendron maximum", common_name: "Rosebay Rhododendron", status: "native", layer: "shrub", wildlife_value: 51, sun: "full_shade", notes: "Large evergreen native. Deep shade." },
  "kalmia latifolia": { scientific_name: "Kalmia latifolia", common_name: "Mountain Laurel", status: "native", layer: "shrub", wildlife_value: 51, sun: "part_shade", notes: "Evergreen. Spectacular spring bloom. NC state flower (unofficial)." },
  "leucothoe fontanesiana": { scientific_name: "Leucothoe fontanesiana", common_name: "Dog-hobble", status: "native", layer: "shrub", wildlife_value: 51, sun: "full_shade", notes: "Evergreen arching shrub. Stream banks and shade." },
  "itea virginica": { scientific_name: "Itea virginica", common_name: "Virginia Sweetspire", status: "native", layer: "shrub", wildlife_value: 2, sun: "adaptable", notes: "Fragrant white racemes. Good fall color. Wet sites." },
  "euonymus americanus": { scientific_name: "Euonymus americanus", common_name: "Hearts-a-Bustin", status: "native", layer: "shrub", wildlife_value: 14, sun: "part_shade", notes: "Spectacular seed capsules. Deer-resistant." },
  "cornus sericea": { scientific_name: "Cornus sericea", common_name: "Red-osier Dogwood", status: "native", layer: "shrub", wildlife_value: 117, sun: "full_sun", notes: "Red winter stems. Wet sites. High wildlife value." },
  "cornus amomum": { scientific_name: "Cornus amomum", common_name: "Silky Dogwood", status: "native", layer: "shrub", wildlife_value: 117, sun: "part_shade", notes: "Blue fruit. Riparian areas." },

  // ══════════════════════════════════════════════════════════════════════
  // NATIVE GROUND COVER / FERNS / HERBS
  // ══════════════════════════════════════════════════════════════════════
  "polystichum acrostichoides": { scientific_name: "Polystichum acrostichoides", common_name: "Christmas Fern", status: "native", layer: "ground_cover", wildlife_value: 0, sun: "full_shade", notes: "Evergreen fern. Excellent ground cover in shade." },
  "asarum canadense": { scientific_name: "Asarum canadense", common_name: "Wild Ginger", status: "native", layer: "ground_cover", wildlife_value: 1, sun: "full_shade", notes: "Spreads slowly. Unique ground-level flowers." },
  "packera aurea": { scientific_name: "Packera aurea", common_name: "Golden Ragwort", status: "native", layer: "ground_cover", wildlife_value: 5, sun: "part_shade", notes: "Semi-evergreen. Early spring bloom. Excellent lawn replacement." },
  "phlox stolonifera": { scientific_name: "Phlox stolonifera", common_name: "Creeping Phlox", status: "native", layer: "ground_cover", wildlife_value: 1, sun: "part_shade", notes: "Spring bloom carpet. Butterfly nectar." },
  "juniperus horizontalis": { scientific_name: "Juniperus horizontalis", common_name: "Creeping Juniper", status: "native", layer: "ground_cover", wildlife_value: 54, sun: "full_sun", notes: "Evergreen ground cover. Berries for birds." },
  "asclepias tuberosa": { scientific_name: "Asclepias tuberosa", common_name: "Butterfly Weed", status: "native", layer: "ground_cover", wildlife_value: 12, sun: "full_sun", notes: "Monarch host plant. Brilliant orange flowers." },
  "asclepias syriaca": { scientific_name: "Asclepias syriaca", common_name: "Common Milkweed", status: "native", layer: "ground_cover", wildlife_value: 12, sun: "full_sun", notes: "Primary Monarch host. Fragrant flowers." },
  "rudbeckia fulgida": { scientific_name: "Rudbeckia fulgida", common_name: "Black-eyed Susan", status: "native", layer: "ground_cover", wildlife_value: 17, sun: "full_sun", notes: "Prolific bloomer. Seeds for goldfinches." },
  "echinacea purpurea": { scientific_name: "Echinacea purpurea", common_name: "Purple Coneflower", status: "native", layer: "ground_cover", wildlife_value: 17, sun: "full_sun", notes: "Long bloom season. Seeds for birds." },
  "solidago spp.": { scientific_name: "Solidago spp.", common_name: "Goldenrod", status: "native", layer: "ground_cover", wildlife_value: 115, sun: "full_sun", notes: "Does NOT cause allergies (ragweed does). Critical fall pollinator resource." },
  "symphyotrichum spp.": { scientific_name: "Symphyotrichum spp.", common_name: "Aster", status: "native", layer: "ground_cover", wildlife_value: 112, sun: "full_sun", notes: "Fall bloom. 2nd most valuable pollinator genus." },

  // ══════════════════════════════════════════════════════════════════════
  // INVASIVE SPECIES
  // ══════════════════════════════════════════════════════════════════════
  "pyrus calleryana": { scientific_name: "Pyrus calleryana", common_name: "Bradford Pear", status: "invasive", layer: "canopy", wildlife_value: 0, sun: "full_sun", notes: "NC's #1 invasive tree. Banned from sale in some states. Remove and replace with native." },
  "ligustrum sinense": { scientific_name: "Ligustrum sinense", common_name: "Chinese Privet", status: "invasive", layer: "shrub", wildlife_value: 0, sun: "adaptable", notes: "Aggressive invader of forest understory. Displaces native shrubs." },
  "ligustrum japonicum": { scientific_name: "Ligustrum japonicum", common_name: "Japanese Privet", status: "invasive", layer: "shrub", wildlife_value: 0, sun: "adaptable", notes: "Invasive. Often confused with native wax myrtle." },
  "pueraria montana": { scientific_name: "Pueraria montana", common_name: "Kudzu", status: "invasive", layer: "vine", wildlife_value: 0, sun: "full_sun", notes: "The vine that ate the South. Smothers native vegetation." },
  "hedera helix": { scientific_name: "Hedera helix", common_name: "English Ivy", status: "invasive", layer: "vine", wildlife_value: 0, sun: "full_shade", notes: "Climbs and smothers trees. Ground cover that displaces natives." },
  "lonicera japonica": { scientific_name: "Lonicera japonica", common_name: "Japanese Honeysuckle", status: "invasive", layer: "vine", wildlife_value: 0, sun: "adaptable", notes: "Aggressive vine. Smothers native shrubs and trees." },
  "microstegium vimineum": { scientific_name: "Microstegium vimineum", common_name: "Japanese Stiltgrass", status: "invasive", layer: "grass", wildlife_value: 0, sun: "part_shade", notes: "Annual grass invading forest floors across the Piedmont." },
  "ailanthus altissima": { scientific_name: "Ailanthus altissima", common_name: "Tree of Heaven", status: "invasive", layer: "canopy", wildlife_value: 0, sun: "full_sun", notes: "Aggressive colonizer. Produces toxins that suppress native plants." },
  "elaeagnus umbellata": { scientific_name: "Elaeagnus umbellata", common_name: "Autumn Olive", status: "invasive", layer: "shrub", wildlife_value: 0, sun: "full_sun", notes: "Fixes nitrogen, altering soil chemistry. Birds spread seeds." },
  "nandina domestica": { scientific_name: "Nandina domestica", common_name: "Nandina", status: "invasive", layer: "shrub", wildlife_value: 0, sun: "adaptable", notes: "Berries toxic to birds. Common landscape plant, but invasive." },
  "wisteria sinensis": { scientific_name: "Wisteria sinensis", common_name: "Chinese Wisteria", status: "invasive", layer: "vine", wildlife_value: 0, sun: "full_sun", notes: "Strangles trees. Use native Wisteria frutescens instead." },
  "rosa multiflora": { scientific_name: "Rosa multiflora", common_name: "Multiflora Rose", status: "invasive", layer: "shrub", wildlife_value: 0, sun: "full_sun", notes: "Forms impenetrable thickets. Originally planted for erosion control." },
  "celastrus orbiculatus": { scientific_name: "Celastrus orbiculatus", common_name: "Oriental Bittersweet", status: "invasive", layer: "vine", wildlife_value: 0, sun: "full_sun", notes: "Girdles and kills trees. Use native C. scandens instead." },
  "paulownia tomentosa": { scientific_name: "Paulownia tomentosa", common_name: "Princess Tree", status: "invasive", layer: "canopy", wildlife_value: 0, sun: "full_sun", notes: "Rapid colonizer of disturbed sites." },
  "albizia julibrissin": { scientific_name: "Albizia julibrissin", common_name: "Mimosa", status: "invasive", layer: "canopy", wildlife_value: 0, sun: "full_sun", notes: "Aggressive reseeder. Displaces native edge species." },
  "lespedeza cuneata": { scientific_name: "Lespedeza cuneata", common_name: "Sericea Lespedeza", status: "invasive", layer: "ground_cover", wildlife_value: 0, sun: "full_sun", notes: "Dominates roadsides and meadows." },

  // ══════════════════════════════════════════════════════════════════════
  // COMMON ORNAMENTALS (non-native, non-invasive — neutral score)
  // ══════════════════════════════════════════════════════════════════════
  "lagerstroemia indica": { scientific_name: "Lagerstroemia indica", common_name: "Crape Myrtle", status: "ornamental", layer: "understory", wildlife_value: 0, sun: "full_sun", notes: "Non-native but not invasive. Summer color. Low wildlife value." },
  "buxus sempervirens": { scientific_name: "Buxus sempervirens", common_name: "Boxwood", status: "ornamental", layer: "shrub", wildlife_value: 0, sun: "part_shade", notes: "Non-native evergreen. Zero wildlife value but not invasive." },
  "camellia japonica": { scientific_name: "Camellia japonica", common_name: "Camellia", status: "ornamental", layer: "shrub", wildlife_value: 0, sun: "part_shade", notes: "Winter bloom. Non-native, not invasive." },
  "acer palmatum": { scientific_name: "Acer palmatum", common_name: "Japanese Maple", status: "ornamental", layer: "understory", wildlife_value: 0, sun: "part_shade", notes: "Non-native ornamental. Beautiful but no ecological value." },
  "hydrangea macrophylla": { scientific_name: "Hydrangea macrophylla", common_name: "Bigleaf Hydrangea", status: "ornamental", layer: "shrub", wildlife_value: 0, sun: "part_shade", notes: "Non-native. Use native H. quercifolia or H. arborescens instead." },
  "rosa spp.": { scientific_name: "Rosa spp.", common_name: "Garden Rose", status: "ornamental", layer: "shrub", wildlife_value: 0, sun: "full_sun", notes: "Cultivated roses. Low wildlife value but not invasive." },
};

/**
 * Look up a species by scientific name. Case-insensitive.
 * Falls back to genus-level match if species not found.
 */
export function lookupSpecies(scientificName: string): SpeciesInfo | null {
  const key = scientificName.toLowerCase().trim();

  // Exact match
  if (SPECIES_DB[key]) return SPECIES_DB[key];

  // Try genus-level match (first word)
  const genus = key.split(" ")[0];
  for (const [dbKey, info] of Object.entries(SPECIES_DB)) {
    if (dbKey.startsWith(genus + " ")) return info;
  }

  // Check "spp." entries
  const sppKey = genus + " spp.";
  if (SPECIES_DB[sppKey]) return SPECIES_DB[sppKey];

  return null;
}

/**
 * Classify a species as native/invasive/ornamental/unknown
 */
export function classifySpecies(scientificName: string): "native" | "invasive" | "ornamental" | "unknown" {
  const info = lookupSpecies(scientificName);
  return info?.status ?? "unknown";
}

/**
 * Get ecological layer for a species
 */
export function getLayer(scientificName: string): string {
  const info = lookupSpecies(scientificName);
  return info?.layer ?? "unknown";
}

/**
 * Estimate total wildlife species supported by a plant portfolio
 * Based on Tallamy's Lepidoptera host plant research
 */
export function estimateWildlifeSpecies(speciesList: string[]): number {
  const uniqueGenera = new Set<string>();
  let total = 0;

  for (const name of speciesList) {
    const info = lookupSpecies(name);
    if (info && info.status === "native") {
      const genus = name.toLowerCase().split(" ")[0];
      if (!uniqueGenera.has(genus)) {
        uniqueGenera.add(genus);
        total += info.wildlife_value;
      }
    }
  }

  return total;
}

export default SPECIES_DB;
