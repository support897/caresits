import { useEffect, useRef, useState } from "react";
import { Bunny, type Mood } from "./Bunny";
import { onAgentLine, type AgentLine } from "./bunnyAgent";
import { t } from "./i18n";
/** The docked helper. Shows one line at a time in a soft bubble, then goes quiet. Never blocks taps. */
export function BunnyAgent({ size = 64 }: { size?: number }) {
  const [line, setLine] = useState<AgentLine | null>(null); const [mood, setMood] = useState<Mood>("rest"); const timer = useRef(0);
  useEffect(() => onAgentLine((l) => {
    if (!l) return; setLine(l); setMood(l.mood); window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { setLine(null); setMood("rest"); }, 4200);
  }), []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return <div className="agent" aria-live="polite" data-testid="bunny-agent">
    {line && <p className="agent-bubble" role="status">{t(line.key, line.text)}</p>}
    <div className="agent-bunny" aria-hidden="true"><Bunny mood={mood} size={size} /></div>
  </div>;
}
