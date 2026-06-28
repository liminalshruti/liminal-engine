import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./styles/design-tokens.css";
import "./styles/app.css";
import "./styles/error.css";
import "./styles/correction-form.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
