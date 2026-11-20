import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { installChunkRecovery } from "./chunk-recovery";
import { ErrorScreen } from "./components/ErrorScreen";
import "@fontsource-variable/inter";
import "./styles.css";

installChunkRecovery();

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorScreen>
        <App />
      </ErrorScreen>
    </BrowserRouter>
  </StrictMode>,
);
