import { describe, expect, it } from "vitest";

import { normalise, normaliseSku } from "@/lib/catalogue/normalise";
import { storeById } from "@/lib/stores/registry";

import { makeScraped } from "../../../test/helpers";

const product = (out: ReturnType<typeof normalise>) => {
  if (!("product" in out)) throw new Error(`excluded: ${out.because}`);
  return out.product;
};

describe("normalise", () => {
  it("decodes the name and builds the id from store and store id", () => {
    const p = product(normalise(makeScraped({ title: "Petzl Vertex Helmet &#8211; Red", externalId: "89760", storeCategories: ["Camp/Hike", "Headlamps"] })));
    expect(p.id).toBe("campandclimb:89760");
    expect(p.title).toBe("Petzl Vertex Helmet – Red");
  });

  it("gives a maker's own shop's products its brand", () => {
    const p = product(
      normalise(makeScraped({ storeId: "tentco", title: "Chair Director", storeCategories: ["Chairs"] }), storeById("tentco")),
    );
    expect(p.brand).toBe("Tentco");
  });

  it("prefers a brand at the start of the name over a store's house default", () => {
    const p = product(
      normalise(
        makeScraped({ storeId: "megaworld", title: "ARB Hydraulic Jack Adaptor", brand: "Desert Products", storeCategories: ["Jacks"] }),
        storeById("megaworld"),
      ),
    );
    expect(p.brand).toBe("ARB");
  });

  it("keeps a store's brand field when the name names none", () => {
    const p = product(
      normalise(makeScraped({ storeId: "megaworld", title: "Roof Rack – Base", brand: "Desert Products", storeCategories: ["Roof Racks"] }), storeById("megaworld")),
    );
    expect(p.brand).toBe("Desert Products");
  });

  it("drops a was-price implying more than 90% off as a data error", () => {
    expect(product(normalise(makeScraped({ title: "Tent", priceZar: 50, wasZar: 1000 }))).wasZar).toBeNull();
    expect(product(normalise(makeScraped({ title: "Tent", priceZar: 195, wasZar: 702 }))).wasZar).toBe(702);
  });

  it("flags a product in the store's clearance section", () => {
    const p = product(
      normalise(
        makeScraped({ storeId: "megaworld", title: "Full OME Suspension for Jeep JL SWB", storeCategories: ["Clearance - Spring Sale", "Suspension"] }),
        storeById("megaworld"),
      ),
    );
    expect(p.clearance).toBe("Clearance - Spring Sale");
    expect(p.category).toBe("suspension");
  });

  it("reports what wasn't gear", () => {
    expect(normalise(makeScraped({ title: "Petzl Verso Belay Device", storeCategories: ["Belay + Descenders", "Climbing"] }))).toEqual({
      excluded: true,
      because: "Belay + Descenders",
    });
  });
});

describe("normaliseSku", () => {
  it("keeps letters and digits, upper-cased", () => {
    expect(normaliseSku("des/sp-pra250")).toBe("DESSPPRA250");
    expect(normaliseSku("TEN061")).toBe("TEN061");
  });

  it("rejects codes too short or without both letters and digits", () => {
    expect(normaliseSku("ABH")).toBeNull();
    expect(normaliseSku("3460100")).toBeNull();
    expect(normaliseSku("HOLDERBOARDS")).toBeNull();
    expect(normaliseSku("")).toBeNull();
    expect(normaliseSku(null)).toBeNull();
  });
});
