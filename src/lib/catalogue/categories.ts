/**
 * The site's own categories, so a filter means the same thing at every store.
 *
 * Each store names its categories differently ("Fridges and Freezers", "Engel Fridge
 * Freezers", "Refrigeration"), so a product is placed in this order:
 *
 * 1. the store's own hints, for a category name that means something particular there
 * 2. ordered rules tried on the store's category names; the first rule to match wins
 * 3. left out, when a store category marks it as something other than 4x4 or camping
 *    gear (climbing hardware, books, clothing, food, travel goods)
 * 4. the same rules tried on the product name
 * 5. left out, when the name is a piece of clothing or footwear ("Down Jacket", "Hiker
 *    Sock"), for stores whose categories don't say so
 * 6. "Other gear"
 *
 * Rules run from most specific to most general, which is why "Rooftop tents" comes
 * before "Tents" and "Fridges" before "Cooler boxes". The clothing check on names runs
 * only after every gear rule has had its turn, so a "Fleece Sleeping Bag" or a bottle
 * "with Flex Cap" stays in.
 */

export const CATEGORIES = [
  { id: "fridges", label: "Fridges & freezers" },
  { id: "rooftop-tents", label: "Rooftop tents" },
  { id: "tents", label: "Tents & gazebos" },
  { id: "awnings", label: "Awnings" },
  { id: "furniture", label: "Camp furniture" },
  { id: "kitchen", label: "Camp kitchen & braai" },
  { id: "coolers", label: "Cooler boxes & drinkware" },
  { id: "sleeping", label: "Sleeping" },
  { id: "camp-lighting", label: "Camp lights & torches" },
  { id: "vehicle-lighting", label: "Vehicle lights" },
  { id: "power", label: "Power & electrical" },
  { id: "recovery", label: "Recovery & tyre care" },
  { id: "racks", label: "Roof racks & carriers" },
  { id: "storage", label: "Storage, drawers & canopies" },
  { id: "protection", label: "Bars & protection" },
  { id: "suspension", label: "Suspension & performance" },
  { id: "water", label: "Water, showers & toilets" },
  { id: "packs", label: "Backpacks & hiking" },
  { id: "tools", label: "Tools, knives & safety" },
  { id: "vehicle", label: "Vehicle accessories" },
  { id: "other", label: "Other gear" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];

const LABELS = new Map<string, string>(CATEGORIES.map((c) => [c.id, c.label]));

export function categoryLabel(id: CategoryId): string {
  return LABELS.get(id) ?? id;
}

/**
 * Ordered: the first match wins. Words are bounded (\b) wherever a bare stem would
 * catch another word: "pot" is in "spotlight", "table" in "portable", "water" in
 * "waterproof".
 */
const RULES: readonly (readonly [CategoryId, RegExp])[] = [
  ["rooftop-tents", /roof ?top tents?|\brtt\b|hard ?shell (cover )?tents?|canopy camper|khaya camper|roof conversions?/i],
  ["fridges", /fridges?|freezers?|refrigerat|travel box(es)?|ice ?makers?/i],
  ["awnings", /awnings?|sunshades?|batwing/i],
  [
    "tents",
    /\btents?\b|gazebos?|marquee|ground ?sheets?|pole spares|tent (accessor|spares?|pegs?|poles?)|\bpegs?\b|mallets?|stretcher tents?/i,
  ],
  ["sleeping", /sleeping|mattress(es)?|pillows?|bedding|camp beds?|stretchers?\b/i],
  ["furniture", /\bchairs?\b|\btables?\b|cupboards?|furniture|hammocks?|\bstools?\b/i],
  [
    "coolers",
    /coolers?\b|cool ?box(es)?|ice ?box(es)?|water bottles?|\bflasks?\b|drinking|drinkware|insulated|tumblers?|hydration/i,
  ],
  [
    "kitchen",
    /kitchen|\bcook|\bstoves?\b|braai|\bbbq\b|potjie|griddles?|\bwoks?\b|\bpots?\b|\bpans?\b|utensils?|cutlery|\bplates?\b|\bbowls?\b|\bcups?\b|\bmugs?\b|coffee|kettles?|cast iron|gas (bottles?|cylinders?|canisters?|cartridges?)|butane|^fuel$|dish ?wash|washing up|skottel|\bgrids?\b|\btongs\b|pizza|cutting boards?|fire ?pits?|rotisserie|\bcadac\b/i,
  ],
  [
    "vehicle-lighting",
    /driving lights?|light ?bars?\b|spot ?lights?|\bspots?\b|work lights?|led upgrades?|\bbulbs?\b|headlights?|fog lights?|beacons?/i,
  ],
  ["camp-lighting", /lanterns?|headlamps?|head ?torch|torch(es)?|flashlights?|\blamps?\b|lighting|\blights?\b/i],
  [
    "recovery",
    /recovery|snatch|kinetic|shackles?|winch(es)?|traction boards?|maxtrax|compressors?|\btyres?\b|inflators?|deflators?|\bjacks?\b|hi-?lift|\btpms\b|tow (straps?|ropes?)/i,
  ],
  [
    "power",
    /batter(y|ies)|dc-?dc|chargers?|solar|inverters?|\bpower\b|power ?banks?|electrical|electronics|isolators?|\bbms\b|jump ?start|\bfuses?\b|connectors?|sockets?|\bplugs?\b|\bcables?\b|wiring|looms?|switch(es)?|terminals?|load shedding/i,
  ],
  ["racks", /roof ?racks?|\bracks?\b|load bars?|\bladders?\b|bike carriers?/i],
  [
    "protection",
    /bull ?bars?|nudge bars?|rear bars?|tow ?bars?|rock sliders?|underbody|bash plates?|4x4 protection|cattle rails?|side steps?|bonnet guards?/i,
  ],
  [
    "suspension",
    /suspension|lift kits?|levell?ing kits?|shock absorbers?|\bshocks?\b(?! ?cord)|coil springs?|leaf springs?|torsion bars?|\bstruts?\b|u-?bolts?|\bbush(es|ings?)\b|steering dampers?|snorkels?|intakes?\b|pre-?filters?|catch cans?|throttle|fuel manager|exhausts?/i,
  ],
  ["water", /\bwater\b|reservoirs?|jerry|showers?|toilets?|porta ?potti|basins?|hygiene|bathroom|wash ?stands?/i],
  ["packs", /rucksacks?|backpacks?|day ?packs?|packs \+ bags|hiking packs?|trekking poles?|walking poles?|gaiters?/i],
  [
    "vehicle",
    /seat covers?|floor mats?|dashboard|centre consoles?|roof consoles?|interior|aerials?|antennas?|in-cab|cabin trim|mirrors?|vehicle accessor|vehicle fitments?|mounting brackets?|cargo barriers?|auto travel|vehicle care|vehicle maintenance|valeting|caravan/i,
  ],
  [
    "storage",
    /canopy|canopies|drawers?|sliders?|storage|\bbox(es)?\b|\bbins?\b|molle|\bbags?\b|cargo|tray system|organi[sz]ers?|duffel|load bins?|\bcovers?\b|ratchet straps?|cambuckle|tie ?downs?|general straps|cords \+ straps|bungee/i,
  ],
  [
    "tools",
    // "Ice axe" is climbing gear, excluded below.
    /knife|knives|multi-?tools?|\btools?\b|(?<!ice )\baxes?\b|\bsaws?\b|first aid|survival|fire start|sharpeners?|spades?|shovels?|health \+ safety|compass(es)?|binoculars?|navigation|whistles?|signal|\bradios?\b|inreach|satellite|two-way|repellents?|mosquito/i,
  ],
];

/**
 * Store categories that mark something other than 4x4 or camping gear: climbing and
 * rope-access hardware (Camp and Climb's "Work" range is work-at-height kit), reading,
 * clothing, food and drink, other sports.
 */
const EXCLUDED =
  /climb|harness(es)?$|belay|carabiner|quickdraw|chalk|lanyards|^work$|fall arrest|ascender|rope clamp|^cams$|^nuts$|ice (axes|gear)|crampon|via ferrata|rescue|literature|^books?$|^maps$|destinations|fauna|clothing|cloting|apparel|kidswear|^(wo)?men$|footwear|shoes|socks|headwear|headbands|beanies|visors|neckwear|merino|\bcaps$|t-?shirts|merchandise|^food$|beverages|wine|beer|spirits|voucher|gift card|medical|cycling|watersports|sporting|swim|smart ?watch|work helmets|work pulleys|^travel$|travel accessories|luggage|wallets|sunglasses|dryflx|thermonet|^polar|coolnet|ecostretch|^windproof$|^protect$/i;

/**
 * Names of clothing, footwear and personal accessories, for stores whose categories don't
 * mark them. "Cap" is left out: fuel caps and lens caps aren't clothing.
 */
const APPAREL =
  /\b(t-?shirts?|tees?|shirts?|shorts|trunks|pants|trousers|leggings|jackets?|fleece|hoodies?|sweaters?|jerseys?|half-zip|softshell|base ?layers?|merino|neckwear|neck gaiters?|headwear|headbands?|beanies?|hats?|visors?|gloves|belts?|bikinis?|swimwear|underwear|bras?|briefs|socks?|sandals?|slides?|slippers?|clogs?|crocs|boots?|shoes?|sneakers?|masks?|sunglasses|wallets?|card ?holders?)\b/i;

export type Placement = { category: CategoryId } | { excluded: true; because: string };

/** Store category names that mean something particular at one store, e.g. Opposite Lock's "Lighting" is vehicle lights. */
export type CategoryHints = Readonly<Record<string, CategoryId>>;

/**
 * Where a product goes. `storeCategories` are the store's category, product type and tag
 * names; `title` is the product's name; `hints` are the store's own exact-name mappings,
 * tried first.
 */
export function categorise(title: string, storeCategories: readonly string[], hints: CategoryHints = {}): Placement {
  for (const name of storeCategories) {
    const hinted = hints[name];
    if (hinted) return { category: hinted };
  }
  for (const [category, pattern] of RULES) {
    if (storeCategories.some((name) => pattern.test(name))) return { category };
  }
  // Before names: "Power Crunch Chalk" is climbing chalk, not power gear.
  const excludedBy = storeCategories.find((name) => EXCLUDED.test(name) || APPAREL.test(name));
  if (excludedBy) return { excluded: true, because: excludedBy };
  for (const [category, pattern] of RULES) {
    if (pattern.test(title)) return { category };
  }
  const garment = title.match(APPAREL);
  if (garment) return { excluded: true, because: `clothing: ${garment[0].toLowerCase()}` };
  return { category: "other" };
}
