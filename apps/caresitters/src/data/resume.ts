import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@cc/core";
import { cleanResume, EMPTY_RESUME, type Resume } from "../lib/resume";

const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
/** Read a carer's self-reported resume. Returns null when none is saved. */
export async function loadResume(uid: string): Promise<Resume | null> {
  try {
    const s = await getDoc(doc(db, "profiles", uid, "resume", "main"));
    if (!s.exists()) return null;
    const d = s.data();
    return { ...EMPTY_RESUME, summary: typeof d.summary === "string" ? d.summary : "", jobs: arr(d.jobs), education: arr(d.education), skills: arr(d.skills), certificates: arr(d.certificates) };
  } catch { return null; }
}
export async function saveResume(uid: string, value: Resume): Promise<Resume> {
  const clean = cleanResume(value);
  await setDoc(doc(db, "profiles", uid, "resume", "main"), { ...clean, updatedAt: serverTimestamp() });
  return clean;
}
