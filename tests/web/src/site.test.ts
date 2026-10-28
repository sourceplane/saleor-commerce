import { describe, expect, it } from "vitest";
import { SITE_NAME, brandConfig, formatPageTitle, getCopyrightText } from "@/config/brand";

// The one line a product's bootstrap rewrites (tooling/rebrand's site name
// seam): every field upstream spelled the store's name in now reads it.
describe("the store's name (apps/web/src/config/brand.ts)", () => {
  it("is set", () => {
    expect(SITE_NAME.trim()).not.toBe("");
  });

  it("names the site, the copyright holder, the organization and the default brand", () => {
    expect(brandConfig.siteName).toBe(SITE_NAME);
    expect(brandConfig.copyrightHolder).toBe(SITE_NAME);
    expect(brandConfig.organizationName).toBe(SITE_NAME);
    expect(brandConfig.defaultBrand).toBe(SITE_NAME);
  });

  it("ends every page title and the copyright line", () => {
    expect(formatPageTitle("Shoes")).toBe(`Shoes | ${SITE_NAME}`);
    expect(getCopyrightText(2026)).toBe(`© 2026 ${SITE_NAME}. All rights reserved.`);
  });
});
