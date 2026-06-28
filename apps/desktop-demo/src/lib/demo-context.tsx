/**
 * DemoContext — provides the LIVE governance-loop output to every screen.
 *
 * `buildGovernanceDemo()` runs the REAL `runGovernanceLoop` + `runEvals` once and
 * returns a `GovernanceDemo` (every artifact the loop produced). This provider
 * resolves it a single time at app start and hands it to the screens via context, so
 * each screen reads `useDemo().X` instead of importing `acmeScenario.X` directly.
 *
 * Why this matters (LIM-1255): the screens now render data the engine actually
 * produced — "the real engine drives the UI" (AGENTS.md Rule 6, JUDGING_MAP). The
 * output is byte-identical to the locked Acme fixtures (proven by determinism), so the
 * walkthrough is visually unchanged and still deterministic — no live calls on the spine.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { buildGovernanceDemo, type GovernanceDemo } from "./governance-demo.ts";

const DemoContext = createContext<GovernanceDemo | null>(null);

/**
 * Resolves the live governance demo once, then renders its children. Until the loop
 * has run, shows a minimal deterministic loading state (no spinner animation — the
 * spine stays deterministic and screenshot-stable).
 */
export function DemoProvider({ children }: { children: ReactNode }) {
  const [demo, setDemo] = useState<GovernanceDemo | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    buildGovernanceDemo()
      .then((d) => {
        if (active) setDemo(d);
      })
      .catch((err) => {
        // The loop can throw (e.g. runGovernanceLoop throws "no governance case
        // detected" if detectMiss returns null). Surface it loudly instead of
        // hanging forever on the loading state — the worst on-stage failure mode.
        if (active) setError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <div className="demo-loading" role="alert">
        Governance loop failed to run: {error.message}
      </div>
    );
  }

  if (!demo) {
    return (
      <div className="demo-loading" role="status" aria-live="polite">
        Running the governance loop…
      </div>
    );
  }

  return <DemoContext.Provider value={demo}>{children}</DemoContext.Provider>;
}

/**
 * Read the live governance demo. Throws if used outside `DemoProvider` — screens are
 * always mounted under it, so this surfaces a wiring mistake loudly rather than
 * silently rendering empty (fail-closed, matching the product's own discipline).
 */
export function useDemo(): GovernanceDemo {
  const demo = useContext(DemoContext);
  if (!demo) {
    throw new Error("useDemo() must be used within <DemoProvider>");
  }
  return demo;
}
