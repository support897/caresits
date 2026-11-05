import { createRoot } from "react-dom/client";
import { applyDir, loadFlags } from "@cc/core";
import { App } from "./App";
applyDir();
document.body.dataset.theme = "light";
void loadFlags();
createRoot(document.getElementById("root")!).render(<App />);
