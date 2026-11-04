import { createRoot } from "react-dom/client";
import { applyDir, loadFlags } from "@cc/core";
import { App } from "./App";
applyDir();
const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
const applySystemTheme = () => { document.body.dataset.theme = colorScheme.matches ? "dark" : "light"; };
applySystemTheme(); colorScheme.addEventListener("change", applySystemTheme);
void loadFlags();
createRoot(document.getElementById("root")!).render(<App />);
