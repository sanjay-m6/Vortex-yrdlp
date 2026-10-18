import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Block default browser right-click context menu (Back, Refresh, Inspect, Save as, etc.)
document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

// Block browser shortcuts that trigger developer tools or browser print/save/reload dialogs
document.addEventListener("keydown", (e) => {
  if (e.key === "F12") {
    e.preventDefault();
  }
  if (
    e.ctrlKey &&
    (e.key === "p" ||
      e.key === "P" ||
      e.key === "s" ||
      e.key === "S" ||
      (e.shiftKey &&
        (e.key === "I" ||
          e.key === "i" ||
          e.key === "C" ||
          e.key === "c" ||
          e.key === "J" ||
          e.key === "j")))
  ) {
    e.preventDefault();
  }
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
