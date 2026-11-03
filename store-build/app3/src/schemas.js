import { z } from "zod";
// Shape checks before anything is written to careSpaces/*. Bad items are dropped, never sent.
const base = z.object({ id: z.union([z.string(), z.number()]).optional() }).passthrough();
export const Child = base.extend({ name: z.string().min(1).max(80), allergies: z.array(z.string()).default([]) });
export const EventDoc = base.extend({ title: z.string().min(1).max(200), date: z.string().optional(), kind: z.string().optional() });
export const Shop = base.extend({ item: z.string().min(1).max(200) });
export const Story = base.extend({ text: z.string().min(1).max(500) });
export const SCHEMAS = { children: Child, events: EventDoc, shopping: Shop, today: Story };
export const clean = (k, arr) => (arr || []).filter((x) => (SCHEMAS[k] ? SCHEMAS[k].safeParse(typeof x === "object" ? x : { text: String(x) }).success : true));
