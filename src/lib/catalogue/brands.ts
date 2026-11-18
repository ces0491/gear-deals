/**
 * Brand names, so the same brand reads the same at every store, and brand detection
 * for stores whose catalogue doesn't name one.
 *
 * The list was seeded on 18 November 2026 from the brand fields 4x4 Mega World and
 * Opposite Lock publish and the most common opening words of Camp and Climb's product
 * names. A brand missing from it isn't lost: a store-supplied brand is kept as given,
 * and a product whose name starts with an unknown brand just has none.
 */

/** Canonical name, then other spellings seen in store data. */
const BRANDS: readonly (readonly [string, ...string[]])[] = [
  ["4WD Interiors"],
  ["4x4Equip", "4x4 Equip"],
  ["Addis"],
  ["Afritrail"],
  ["Akinfuel"],
  ["Alu-Cab", "AluCab", "Alu Cab"],
  ["Aqualine"],
  ["ARB", "ARB 4x4"],
  ["Black Diamond"],
  ["Bushranger"],
  ["Bushtech"],
  ["Cadac", "Cadac SA"],
  ["Camelbak", "CamelBak"],
  ["Camp Cover"],
  ["Campaid"],
  ["Charging System Africa"],
  ["COBB", "Cobb"],
  ["Coghlans", "Coghlan's"],
  ["Coleman"],
  ["CTEK"],
  ["Desert Products"],
  ["Direction Plus"],
  ["Dometic"],
  ["Eezi-Awn", "Eezi Awn", "EeziAwn"],
  ["Elsan"],
  ["Energizer"],
  ["Engel"],
  ["EXoverland", "EX Overland"],
  ["Falke"],
  ["First Ascent"],
  ["Forever Fresh"],
  ["Fredlin"],
  ["Front Runner", "Front Runner Outfitters"],
  ["Gomad"],
  ["Grangers"],
  ["Hardkorr", "HardKorr"],
  ["Highlander"],
  ["Indeflate"],
  ["Intervolt"],
  ["Intex"],
  ["Ironman 4x4", "Ironman", "Iron Man", "IRONMAN 4x4", "IRONMAN 4x4 Australia", "IRONMAN 4x4 Africa"],
  ["Jetboil"],
  ["KampCo"],
  ["Kaufmann"],
  ["Kershaw"],
  ["Lansky"],
  ["LAS"],
  ["Leatherman"],
  ["Ledlenser", "Led Lenser"],
  ["LeisureQuip", "Leisure Quip", "Leisure-Quip"],
  ["Leisurewize"],
  ["Lightforce"],
  ["LK's", "LKs"],
  ["Livelekker"],
  ["Lumeno"],
  ["Maxtrax", "MAXTRAX"],
  ["Mean Green"],
  ["Medalist"],
  ["Merrell"],
  ["MotoQuip"],
  ["MSR"],
  ["National Luna"],
  ["Nexus"],
  ["Nikwax"],
  ["NSV Auto", "NSV"],
  ["Old Man Emu", "OME"],
  ["Opinel"],
  ["Opposite Lock"],
  ["Oztrail", "OZtrail"],
  ["Petzl"],
  ["Pioneer"],
  ["Primus"],
  ["Profender"],
  ["Projecta"],
  ["Quick Pitch"],
  ["Red-E"],
  ["REDARC", "Redarc"],
  ["Renogy"],
  ["Rhino-Rack", "Rhino Rack"],
  ["Ring"],
  ["Sea to Summit"],
  ["SecureTech", "Securetech", "Secure Tech"],
  ["Slingsby"],
  ["Snomaster", "SnoMaster"],
  ["Stanley"],
  ["Streetwize"],
  ["Summit"],
  ["Surge"],
  ["Tabard"],
  ["Tanga"],
  ["Tentco"],
  ["Therm-a-Rest", "Thermarest"],
  ["Thule"],
  ["TJM"],
  ["T-Max", "TMax", "T Max"],
  ["Tough Dog"],
  ["Tracks4Africa", "Tracks 4 Africa", "T4A"],
  ["Ultimate9", "Ultimate 9"],
  ["Ultratec"],
  ["Victorinox"],
  ["Victron", "Victron Energy"],
  ["Zartek"],
];

const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

const CANONICAL = new Map<string, string>();
for (const [canonical, ...aliases] of BRANDS) {
  for (const name of [canonical, ...aliases]) CANONICAL.set(key(name), canonical);
}

/** Brands whose names are ordinary words or too short to spot at the start of a product name. */
const NOT_FROM_TITLE = new Set(["Ring", "LAS"]);

/**
 * Spellings to look for at the start of a product name, longest first so "Front Runner"
 * wins over a shorter brand that happens to share its opening.
 */
const PREFIXES = BRANDS.filter(([canonical]) => !NOT_FROM_TITLE.has(canonical))
  .flatMap(([canonical, ...aliases]) => [canonical, ...aliases].map((spelling) => ({ spelling, canonical })))
  .sort((a, b) => b.spelling.length - a.spelling.length);

/** The canonical spelling of a brand, or the name as given (tidied) when it's not on the list. */
export function canonicalBrand(name: string): string {
  const tidy = name
    .replace(/[®™©]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return CANONICAL.get(key(tidy)) ?? tidy;
}

/** The known brand a product name starts with, if any. */
export function brandFromTitle(title: string): string | null {
  // Stores mix straight and curly apostrophes ("Coghlan’s", "Coghlan's").
  const lower = title.toLowerCase().replace(/[‘’`]/g, "'");
  for (const { spelling, canonical } of PREFIXES) {
    const s = spelling.toLowerCase();
    if (!lower.startsWith(s)) continue;
    // A whole word: "Ring Automotive" names Ring; "Ringbolt" doesn't.
    const next = lower.charAt(s.length);
    if (next === "" || !/[a-z0-9]/.test(next)) return canonical;
  }
  return null;
}
