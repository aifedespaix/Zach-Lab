import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppIdProvider } from "@suite/shared/view";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppIdProvider id="zachart-maths">
      <App />
    </AppIdProvider>
  </React.StrictMode>,
);
