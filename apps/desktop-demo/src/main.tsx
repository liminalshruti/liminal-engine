import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { Workspace } from "./Workspace.tsx";
import "./styles/design-tokens.css";
import "./styles/app.css";
import "./styles/error.css";
import "./styles/correction-form.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

// DIRECTIVE.md: the real product (the operating Workspace) is the default surface.
// The 14-beat demo flow stays as REFERENCE, reachable at #demo.
const showDemo = window.location.hash === "#demo";

createRoot(root).render(
  <React.StrictMode>{showDemo ? <App /> : <Workspace />}</React.StrictMode>,
);
