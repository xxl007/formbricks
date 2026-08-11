"use client";

import type { BowtieStage } from "@holostaff/sdk";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

interface HolostaffProviderProps {
  tenantId: string;
  sourceId: string;
}

// Journey stages, by the route the creator is on. First match wins. The
// copilot uses this to know whether someone is setting up their first
// survey, building, or looking at plans; everything else (stall detection,
// what to say, whether to say anything at all) comes from the journey map.
// Exported for the colocated test, which walks app/(app) and fails if a
// route this table relies on moves.
export const STAGE_ROUTES: [RegExp, BowtieStage][] = [
  [/^\/organizations\/[^/]+\/workspaces\/new\/plan$/, "expansion"],
  [/^\/organizations\/[^/]+\/(landing|workspaces\/new)/, "onboarding"],
  [/^\/workspaces\/[^/]+\/(surveys|dashboards|charts|unify)/, "adoption"],
  [/^\/organizations\/[^/]+\/settings\/billing$/, "expansion"],
];

/**
 * Initializes the Holostaff copilot and reports which part of the journey the
 * creator is in on client-side navigation. Mounted only in the authenticated
 * app layout, so it can never load on survey link pages (/s, /c, /p) or any
 * other respondent-facing surface. The SDK sits behind a dynamic import, so
 * its chunk is only fetched when the provider is actually mounted.
 */
export const HolostaffProvider = ({ tenantId, sourceId }: Readonly<HolostaffProviderProps>) => {
  const pathname = usePathname();
  const sdkRef = useRef<Promise<typeof import("@holostaff/sdk")> | null>(null);
  const stageRef = useRef<BowtieStage | null>(null);

  useEffect(() => {
    sdkRef.current ??= import("@holostaff/sdk").then((mod) => {
      // A creator's screen can include response data, so mask the content
      // of every input in the session capture, not just PII field types.
      mod.holostaff.init({ tenantId, sourceId, observe: { maskAllInputs: true } });
      return mod;
    });

    const stage = STAGE_ROUTES.find(([pattern]) => pattern.test(pathname))?.[1];
    sdkRef.current
      .then(({ holostaff }) => {
        if (stage && stage !== stageRef.current) {
          stageRef.current = stage;
          holostaff.markStageEntry(stage);
        }
      })
      .catch((error) => {
        console.warn("Holostaff did not load:", error);
      });
  }, [tenantId, sourceId, pathname]);

  return null;
};
