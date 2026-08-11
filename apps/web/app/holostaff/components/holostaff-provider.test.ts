import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { STAGE_ROUTES } from "./holostaff-provider";

// The stage table maps live pathnames to journey stages with regexes, so a
// route rename would silently strand the copilot in the wrong stage. This
// test rebuilds representative pathnames from the app router's own directory
// tree at test time: if a route the table relies on moves, this fails loudly.

const APP_GROUP_DIR = join(__dirname, "..", "..", "(app)");

/** Walk the (app) route group and return concrete example pathnames for
 *  every page.tsx, with [params] filled and (groups) elided. */
const collectPathnames = (dir: string, urlSegments: string[]): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name === "page.tsx") {
      out.push(`/${urlSegments.join("/")}`);
      continue;
    }
    if (!entry.isDirectory() || entry.name.startsWith("@") || entry.name === "api") continue;
    const isGroup = entry.name.startsWith("(") && entry.name.endsWith(")");
    const segment = entry.name.startsWith("[") ? "cm0example0id" : entry.name;
    out.push(...collectPathnames(join(dir, entry.name), isGroup ? urlSegments : [...urlSegments, segment]));
  }
  return out;
};

describe("holostaff stage routes", () => {
  const pathnames = collectPathnames(APP_GROUP_DIR, []);

  test("every stage pattern still matches a real route", () => {
    for (const [pattern] of STAGE_ROUTES) {
      const matched = pathnames.filter((p) => pattern.test(p));
      expect(matched, `${pattern} matches no route under app/(app) — did a route move?`).not.toHaveLength(0);
    }
  });

  test("no stage pattern matches a respondent-facing path", () => {
    for (const respondentPath of ["/s/cm0example0id", "/c/some.jwt.token", "/p/pretty-slug"]) {
      for (const [pattern] of STAGE_ROUTES) {
        expect(pattern.test(respondentPath), `${pattern} must not match ${respondentPath}`).toBe(false);
      }
    }
  });
});
