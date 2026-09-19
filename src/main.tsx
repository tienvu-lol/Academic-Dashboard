import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./styles/globals.css";
import { App } from "./features/app";
import { TooltipProvider } from "./components/ui/tooltip";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing #root application mount point.");
}

createRoot(root).render(
  <StrictMode>
    <TooltipProvider><App /></TooltipProvider>
  </StrictMode>,
);
