import { describe, expect, it } from "vitest";

import { recategorise } from "@/lib/catalogue/recategorise";

import { makeProduct } from "../../../test/helpers";

describe("recategorise", () => {
  it("re-places products under the current rules and drops what they leave out", () => {
    const products = [
      makeProduct({ title: "Torsion Bar", storeId: "ironman", category: "other", storeCategories: [] }),
      makeProduct({ title: "Tentco Chair", storeId: "tentco", category: "furniture", storeCategories: ["Chairs"] }),
      makeProduct({ title: "Jeep Fashion T-Shirt", storeId: "trappers", category: "other", storeCategories: ["mens clothing"] }),
    ];
    const out = recategorise(products);
    expect(out.products.map((p) => [p.title, p.category])).toEqual([
      ["Torsion Bar", "suspension"],
      ["Tentco Chair", "furniture"],
    ]);
    expect(out).toMatchObject({ moved: 1, dropped: 1 });
  });

  it("copes with products written before store categories were kept", () => {
    const old = { ...makeProduct({ title: "Torsion Bar", storeId: "ironman" }), storeCategories: undefined as unknown as string[] };
    expect(recategorise([old]).products[0].category).toBe("suspension");
  });
});
