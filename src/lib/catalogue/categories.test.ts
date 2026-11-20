import { describe, expect, it } from "vitest";

import { categorise, CATEGORIES, categoryLabel } from "@/lib/catalogue/categories";

const placed = (title: string, cats: string[] = [], hints = {}) => {
  const p = categorise(title, cats, hints);
  return "category" in p ? p.category : `excluded:${p.because}`;
};

describe("categorise", () => {
  it("places products by the store's category names first", () => {
    expect(placed("NL 72 Legacy Smart Dual", ["Dual Control", "Fridges and Freezers"])).toBe("fridges");
    expect(placed("Eezi-Awn Jazz", ["Rooftop Tents", "Shop", "Tents"])).toBe("rooftop-tents");
    expect(placed("Tentco Rooftop Tent 1.2m", ["Camp/Hike", "Rooftop Tents", "Tents", "Vehicle Tents"])).toBe(
      "rooftop-tents",
    );
    expect(placed("4.75t Bow Shackle", ["Recovery", "Shackles & soft links"])).toBe("recovery");
    expect(placed("Bash Plate – Prado 250", ["Underbody Protection", "4X4 Protection"])).toBe("protection");
    expect(placed("Isuzu Rock Slider Side Step", ["Side steps & sliders"])).toBe("protection");
  });

  it("falls back to the product name", () => {
    expect(placed("Oztrail Tasman 2 Dome Tent", ["Camp/Hike"])).toBe("tents");
    expect(placed("Campotel 12V Ice Maker", ["Camp/Hike"])).toBe("fridges");
  });

  it("lets a store category win over the name", () => {
    expect(placed("Campotel 12V Ice Maker", ["Camp/Hike", "Electronics", "Refrigeration"])).toBe("fridges");
    expect(placed("Campotel 12V Ice Maker", ["Camp/Hike", "Electronics"])).toBe("power");
  });

  it("doesn't let a word stem catch a different word", () => {
    // "pot" is in "Spot", "table" in "Portable", "ladder" in "Bladder", "water" in "Waterproof".
    expect(placed("Lance 140mm Yellow Spot", ["Lighting"], { Lighting: "vehicle-lighting" })).toBe("vehicle-lighting");
    expect(placed("Lance 140mm Yellow Spot")).toBe("vehicle-lighting");
    expect(placed("Portable Power Station 500W")).toBe("power");
    expect(placed("Highlander SL Mil Hydration Bladder", ["Camp/Hike", "Fathers", "Hydration"])).toBe("coolers");
    expect(placed("Waterproof Phone Pouch")).toBe("other");
  });

  it("doesn't take a \"Backpacking\" section for backpacks", () => {
    const backpacking = ["Backpacking|Trekking", "Backpacking"];
    expect(placed("Zamberlan Vioz GTX Men's Hiking Boot", [...backpacking, "Boots", "Zamberlan Shoes"])).toMatch(/^excluded/);
    expect(placed("Zamberlan Guide GTX Men's Boot", ["Backpacking|Trekking"])).toMatch(/^excluded/);
    expect(placed("Osprey Kestrel 58 Hiking Backpack", backpacking)).toBe("packs");
    expect(placed("Osprey Kyte LT 65 Women's Backpacking Pack", backpacking)).toBe("packs");
  });

  it("uses a store's hints before the rules", () => {
    expect(placed("Amber Watermelon Lights", ["Lighting"], { Lighting: "vehicle-lighting" })).toBe("vehicle-lighting");
    expect(placed("Lumeno Rechargeable LED Sensor Light", ["Lighting", "LED Lights"])).toBe("camp-lighting");
  });

  it("leaves out climbing, books and clothing, even when the name has a gear word", () => {
    expect(placed("Petzl Power Crunch Chalk 300g", ["Christmas Gifting", "Climbing Chalk"])).toBe(
      "excluded:Climbing Chalk",
    );
    expect(placed("Petzl Glacier Ice Axe 70cm", ["Climbing", "Ice Axes", "Ice Gear"])).toBe("excluded:Climbing");
    expect(placed("Aqualine Bermuda-S Snorkel", ["Sporting", "Swim Aids", "Watersports"])).toBe("excluded:Sporting");
    expect(placed("Opposite Lock T-Shirts", ["Merchandise"])).toBe("excluded:Merchandise");
  });

  it("keeps gear a climbing shop also files under climbing", () => {
    expect(placed("Petzl Tikka Headlamp", ["Climbing", "Headlamps"])).toBe("camp-lighting");
    expect(placed("Petzl Pixa R Headlamp", ["Work", "Work Headlamps"])).toBe("camp-lighting");
  });

  it("leaves out clothing a store doesn't mark as clothing, by its name", () => {
    expect(placed("Sprayway Meldon Men's Jacket", ["Men"])).toBe("excluded:Men");
    expect(placed("Wildebees Core Padded Jacket", ["Sale"])).toBe("excluded:clothing: jacket");
    expect(placed("Buff® Original EcoStretch Neckwear Youth", ["Original EcoStretch"])).toBe("excluded:Original EcoStretch");
    expect(placed("Buff® Original Neckwear Youth", ["New Arrivals"])).toBe("excluded:clothing: neckwear");
    expect(placed("Hi-Tec Ula Sandal", [])).toBe("excluded:clothing: sandal");
  });

  it("checks names for clothing only after every gear rule", () => {
    expect(placed("Polar Fleece Sleeping Bag", [])).toBe("sleeping");
    expect(placed("Hydro Flask 32oz Wide Mouth Bottle with Flex Cap", [])).toBe("coolers");
    expect(placed("Fuel Cap Lock", [])).toBe("other");
  });

  it("files Ironman suspension parts and Cadac cooking gear", () => {
    expect(placed("Torsion Bar", [])).toBe("suspension");
    expect(placed("Steel Strut Top", [])).toBe("suspension");
    expect(placed("MSR Shock Cord Replacement Kit", ["Care + Repair"])).toBe("other");
    expect(placed("CADAC Pizza Stone", [])).toBe("kitchen");
    expect(placed("Portable Fire Pit", [])).toBe("kitchen");
  });

  it("puts what matches nothing under Other gear", () => {
    expect(placed("Bushnell 10x25 Powerview", ["Optics"])).toBe("other");
  });
});

describe("travel goods and the rest of a general outdoor store's range", () => {
  it("leaves out luggage, wallets and travel accessories", () => {
    expect(placed("Osprey Transporter 60 Wheeled Duffel", ["Travel"])).toBe("excluded:Travel");
    expect(placed("Osprey Ultralight Zip Organizer", ["Travel Accessories", "Travel"])).toBe("excluded:Travel Accessories");
    expect(placed("Bossi Mopane RFID Executive Wallet", ["Wallets"])).toBe("excluded:Wallets");
    expect(placed("Braai Broekies", ["Mens Shorts"])).toBe("excluded:Mens Shorts");
  });

  it("files radios, repellents, power banks and water reservoirs", () => {
    expect(placed("Zartek TX8 Twinpack Radios", ["equipment", "Radios"])).toBe("tools");
    expect(placed("Lifetrek Mosquito Band Plain - 2 Pack", ["equipment", "Repellents"])).toBe("tools");
    expect(placed("RED-E RC27 Powerhouse 27000MAH PD Powerbank", ["equipment", "Powerbanks"])).toBe("power");
    expect(placed("MSR Dromedary Bag 6L", ["Camp/Hike", "Water Reservoirs"])).toBe("water");
    expect(placed("Osprey Hydraulics 2L Reservoir", ["2L"])).toBe("water");
  });
});

describe("category labels", () => {
  it("has a label for every category", () => {
    for (const c of CATEGORIES) expect(categoryLabel(c.id)).toBe(c.label);
  });
});
