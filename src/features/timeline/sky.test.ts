import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");
const PAGES: [string, string][] = [
  ["src/app/timeline/timeline.html", "Tidslinjen"], ["src/app/board.html", "Brettet"],
  ["src/app/inntak/inntak.html", "Inntak"], ["src/app/kunder/kunder.html", "Kunder"],
];
const css = read("src/features/timeline/sky.css");

describe("R17: one shared stylesheet", () => {
  it("carries the hidden rule, the note style, the focus ring and the AA tokens", () => {
    expect(css).toContain("[hidden]{display:none !important}");
    expect(css).toContain(".md{font-size:12px;color:var(--text-3)}");
    expect(css).toMatch(/--text-4:#64748b;/);
    expect(css).toMatch(/--text-4:#5fa8d3;/);
    expect(css).toMatch(/--warn:#b45309;/);
    expect(css).toMatch(/--accent-hover:#2f5f8f;/);
    expect(css).toContain(".sr-only{");
    expect(css).toContain("button.as-text{");
  });
  for (const [file, name] of PAGES) {
    it(`${name}: links sky.css, keeps no token block of its own, one h1, a main, the title, Logg ut, the icon`, () => {
      const html = read(file);
      expect(html).toMatch(/timeline\/sky\.css/);
      expect(html).not.toMatch(/--bg:#f8fafc/);                       // the tokens live in sky.css only
      expect(html).not.toMatch(/\*\{margin:0;padding:0;box-sizing:border-box\}/);
      expect(html.match(/<h1[\s>]/g) || []).toHaveLength(1);
      expect(html).toMatch(/<main[\s>]/);
      expect(html).toContain(`<title>${name} – SkyTracker</title>`);
      expect(html).toMatch(/href="\/api\/auth\/signout"/);
      expect(html).toContain('<link rel="icon" href="/icon.svg" type="image/svg+xml">');
    });
  }
});
