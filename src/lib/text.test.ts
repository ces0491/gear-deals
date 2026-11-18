import { describe, expect, it } from "vitest";

import { cleanText, decodeEntities, searchable } from "@/lib/text";

describe("decodeEntities", () => {
  it("decodes the numeric and named entities WooCommerce puts in names", () => {
    expect(decodeEntities("Petzl Vertex Helmet &#8211; Red")).toBe("Petzl Vertex Helmet – Red");
    expect(decodeEntities("4&#215;4 Equip")).toBe("4×4 Equip");
    expect(decodeEntities("Quick Fist 3&#8243;")).toBe("Quick Fist 3″");
    expect(decodeEntities("LC 79&amp;76 Bonnet Guard")).toBe("LC 79&76 Bonnet Guard");
    expect(decodeEntities("Inflation &#038; Deflation")).toBe("Inflation & Deflation");
    expect(decodeEntities("&#x2019;")).toBe("’");
  });

  it("leaves unknown or malformed entities as they are", () => {
    expect(decodeEntities("&bogus; &#0; & alone")).toBe("&bogus; &#0; & alone");
  });
});

describe("cleanText", () => {
  it("strips tags and collapses whitespace", () => {
    expect(cleanText("  <b>Bash</b>   Plate &#8211;\n Prado ")).toBe("Bash Plate – Prado");
  });
});

describe("searchable", () => {
  it("lower-cases and drops accents and punctuation", () => {
    expect(searchable("Coghlan’s Café-Stove 2.0")).toBe("coghlan s cafe stove 2 0");
  });
});
