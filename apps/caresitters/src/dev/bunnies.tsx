import { createRoot } from "react-dom/client";
import "@cc/core/src/theme.css";
import { Bunny, MOODS } from "@cc/core";
createRoot(document.getElementById("root")!).render(<div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, padding: 16, background: "#FDF8F0" }}>{MOODS.map((m) => <div key={m} style={{ textAlign: "center" }}><Bunny mood={m} size={150} /><p style={{ margin: 0 }}>{m}</p></div>)}</div>);
