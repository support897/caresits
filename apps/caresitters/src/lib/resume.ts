// Resume reader. Runs on the device: the original file is never uploaded.
// It pulls out experience, education, skills and certificates, and removes phone numbers, emails, links and street addresses.
// The carer always reviews and edits the result before saving. Nothing here says a carer is verified or qualified.
export type Resume = { summary: string; jobs: string[]; education: string[]; skills: string[]; certificates: string[] };
export const EMPTY_RESUME: Resume = { summary: "", jobs: [], education: [], skills: [], certificates: [] };
export const RESUME_LIMITS = { summary: 600, jobs: 8, education: 6, skills: 20, certificates: 8, entry: 300 } as const;

const YEAR_RANGE = /^\s*(19|20)\d{2}\s*[-–—to ]+\s*((19|20)\d{2}|present|current)\s*$/i;
const STREET = /\b\d{1,4}[A-Za-z]?(\/\d{1,4})?\s+[A-Z][A-Za-z'-]+(\s+[A-Z][A-Za-z'-]+)?\s+(St|Street|Rd|Road|Ave|Avenue|Dr|Drive|Ct|Court|Pl|Place|Ln|Lane|Cres|Crescent|Way|Blvd|Boulevard|Tce|Terrace|Pde|Parade|Hwy|Highway)\b\.?/g;
const PRIVATE_LINE = /\b(date of birth|dob|d\.o\.b|passport|tax file|tfn|medicare|licen[cs]e (no|number)|driver'?s? licen[cs]e number|blue card (no|number)|wwcc (no|number)|card number)\b/i;

export function redact(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "")
    .replace(/(https?:\/\/|www\.)\S+/gi, "")
    .replace(/\b(linkedin|facebook|instagram)\.com\S*/gi, "")
    .replace(/\+?\(?\d[\d\s().-]{6,}\d/g, (match) => {
      if (YEAR_RANGE.test(match)) return match;
      const digits = match.replace(/\D/g, "").length;
      return digits >= 8 ? "" : match;
    })
    .replace(STREET, "")
    .split("\n").filter((line) => !PRIVATE_LINE.test(line)).join("\n")
    .replace(/[ \t]{2,}/g, " ");
}

type Section = "summary" | "jobs" | "education" | "skills" | "certificates" | "skip";
const HEADINGS: Array<[RegExp, Section]> = [
  [/^(summary|profile|about me|about|objective|career objective|personal statement|personal profile)$/i, "summary"],
  [/^((relevant |professional |work |childcare |employment |nanny |babysitting )?(experience|history)|employment( history)?|work history)$/i, "jobs"],
  [/^(education|training|studies|academic( background)?|education and training)$/i, "education"],
  [/^((key |core |special |personal )?skills|strengths|interests|languages|abilities)$/i, "skills"],
  [/^(certificates?|certifications?|qualifications?|licen[cs]es?|accreditations?|checks|first aid|courses|licences and certificates)$/i, "certificates"],
  [/^(references?|referees?|contact( details)?|personal details)$/i, "skip"],
];
function headingOf(line: string): Section | null {
  const clean = line.replace(/[:\-–—_*#]+$/g, "").replace(/^[#*\s]+/, "").trim();
  if (!clean || clean.length > 40) return null;
  for (const [pattern, section] of HEADINGS) if (pattern.test(clean)) return section;
  return null;
}
const BULLET = /^\s*([•·▪●◦*\-–—]|\d+[.)])\s+/;
const trim = (value: string, max: number = RESUME_LIMITS.entry) => value.replace(/\s+/g, " ").trim().slice(0, max);

function entries(lines: string[]): string[] {
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (BULLET.test(line) && out.length) out[out.length - 1] += `; ${line.replace(BULLET, "").trim()}`;
    else if (YEAR_RANGE.test(line) && out.length) out[out.length - 1] += ` (${line})`;
    else out.push(line.replace(BULLET, "").trim());
  }
  return out.map((entry) => trim(entry)).filter(Boolean);
}
function skillList(lines: string[]): string[] {
  return lines.flatMap((line) => line.replace(BULLET, "").split(/[,;|•·]/)).map((s) => trim(s, 60)).filter((s) => s.length > 1);
}

export function parseResumeText(input: string): Resume {
  const text = redact(input.replace(/\r/g, "\n"));
  const lines = text.split("\n").map((line) => line.trimEnd());
  const buckets: Record<Section, string[]> = { summary: [], jobs: [], education: [], skills: [], certificates: [], skip: [] };
  let current: Section | null = null;
  const preface: string[] = [];
  for (const line of lines) {
    const heading = headingOf(line);
    if (heading) { current = heading; continue; }
    if (current) buckets[current].push(line); else if (line.trim()) preface.push(line);
  }
  const found = (["summary", "jobs", "education", "skills", "certificates"] as Section[]).some((key) => buckets[key].some((l) => l.trim()));
  const summarySource = found ? buckets.summary.join(" ") : preface.slice(1).join(" ");
  return {
    summary: trim(summarySource, RESUME_LIMITS.summary),
    jobs: entries(buckets.jobs).slice(0, RESUME_LIMITS.jobs),
    education: entries(buckets.education).slice(0, RESUME_LIMITS.education),
    skills: [...new Set(skillList(buckets.skills))].slice(0, RESUME_LIMITS.skills),
    certificates: entries(buckets.certificates).slice(0, RESUME_LIMITS.certificates),
  };
}

export function cleanResume(value: Resume): Resume {
  const list = (items: string[], max: number, each: number = RESUME_LIMITS.entry) => items.map((x) => trim(redact(x), each)).filter(Boolean).slice(0, max);
  return {
    summary: trim(redact(value.summary), RESUME_LIMITS.summary),
    jobs: list(value.jobs, RESUME_LIMITS.jobs),
    education: list(value.education, RESUME_LIMITS.education),
    skills: list(value.skills, RESUME_LIMITS.skills, 60),
    certificates: list(value.certificates, RESUME_LIMITS.certificates),
  };
}
export function hasResume(r?: Partial<Resume> | null): boolean {
  return Boolean(r && (r.summary || r.jobs?.length || r.education?.length || r.skills?.length || r.certificates?.length));
}
export function readResumeFromCard(card: unknown): Resume {
  const raw = (card && typeof card === "object" ? (card as Record<string, unknown>).resume : null) as Partial<Resume> | null;
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return raw ? { summary: typeof raw.summary === "string" ? raw.summary : "", jobs: arr(raw.jobs), education: arr(raw.education), skills: arr(raw.skills), certificates: arr(raw.certificates) } : { ...EMPTY_RESUME };
}

export async function extractFileText(file: File): Promise<string> {
  if (/\.(txt|md)$/i.test(file.name) || file.type.startsWith("text/")) return file.text();
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") throw new Error("unsupported");
  const pdfjs = await import("../vendor/pdfjs/pdf.min.mjs");
  const worker = (await import("../vendor/pdfjs/pdf.worker.min.mjs?url")).default as string;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const lines: string[] = [];
  for (let n = 1; n <= Math.min(doc.numPages, 6); n += 1) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    let lastY: number | null = null; let line = "";
    for (const item of content.items as Array<{ str: string; transform: number[]; hasEOL?: boolean }>) {
      const y = Math.round(item.transform[5] ?? 0);
      if (lastY !== null && Math.abs(y - lastY) > 3) { lines.push(line); line = ""; }
      line += item.str; lastY = y;
      if (item.hasEOL) { lines.push(line); line = ""; lastY = null; }
    }
    if (line) lines.push(line);
    lines.push("");
  }
  return lines.join("\n");
}
