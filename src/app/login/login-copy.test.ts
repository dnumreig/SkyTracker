import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("R17: the login page speaks Norwegian and loads no unused fonts", () => {
  const page = readFileSync("src/app/login/page.tsx", "utf8"), layout = readFileSync("src/app/layout.tsx", "utf8");
  it("Norwegian copy", () => {
    expect(page).toContain("Logg inn på SkyTracker");
    expect(page).toContain("Logg inn med Skytale-kontoen din");
    expect(page).not.toMatch(/Sign in/);
  });
  it("lang nb, no Geist", () => {
    expect(layout).toMatch(/lang="nb"/);
    expect(layout).not.toMatch(/Geist/);
  });
  it("the button's hover passes AA contrast (white on #2f5f8f, 6.66:1)", () => {
    expect(page).toContain("hover:bg-[#2f5f8f]");
    expect(page).not.toContain("hover:bg-ocean-6");
  });
});
