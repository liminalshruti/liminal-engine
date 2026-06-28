import React, { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { Workspace } from "./Workspace.tsx";
import { ProxyConsole } from "./ProxyConsole.tsx";
import "./styles/design-tokens.css";
import "./styles/app.css";
import "./styles/error.css";
import "./styles/correction-form.css";
import "./styles/proxy.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

// DIRECTIVE.md: the real product (the operating Workspace) is the default surface.
// The 14-beat demo flow stays as REFERENCE at #demo. The inference proxy — the one
// surface the Workspace doesn't cover — lives at #proxy (additive; defers to the
// Workspace as the default).
function subscribe(cb: () => void): () => void {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

function Root() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  const surface = hash === "#demo" ? "demo" : hash === "#proxy" ? "proxy" : "workspace";

  return (
    <>
      <nav className="surface-nav" aria-label="Surfaces">
        <span className="surface-nav__brand">Liminal Engine</span>
        <a href="#" className={surface === "workspace" ? "is-active" : ""}>Workspace</a>
        <a href="#proxy" className={surface === "proxy" ? "is-active" : ""}>Inference proxy</a>
        <a href="#demo" className={surface === "demo" ? "is-active" : ""}>Demo</a>
      </nav>
      {surface === "demo" ? <App /> : surface === "proxy" ? <ProxyConsole /> : <Workspace />}
    </>
  );
}

createRoot(root).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
