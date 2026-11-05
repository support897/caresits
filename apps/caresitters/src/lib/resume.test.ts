import { describe, expect, it } from "vitest";
import { parseResumeText, redact, cleanResume } from "./resume";

const SAMPLE = `Casey Carer
0412 345 678 | casey@example.com | 12 Wickham Street, New Farm
Date of birth: 4 May 1998
Summary
Warm, reliable nanny who loves play-based learning.
Work Experience
Nanny, The Smith Family, Brisbane
2021 - 2024
• Cared for two children aged 2 and 4
• Cooked meals and ran the school pickup
Babysitter, Local families
2019 - 2021
Education
Certificate III in Early Childhood Education, TAFE Queensland
Skills
First aid, Infant care, Cooking
Certificates
Senior First Aid, valid to 2027
References
Jo Smith 0400 111 222`;

describe("resume reader", () => {
  it("removes phone numbers, emails, links, street addresses and ID lines", () => {
    const out = redact(SAMPLE + "\nhttps://linkedin.com/in/casey\n+61 7 3333 4444");
    expect(out).not.toMatch(/0412|345 678|example\.com|Wickham|linkedin|3333|1998/);
  });
  it("keeps year ranges", () => { expect(redact("2021 - 2024")).toContain("2021 - 2024"); });
  it("splits into sections", () => {
    const r = parseResumeText(SAMPLE);
    expect(r.summary).toMatch(/play-based/);
    expect(r.jobs.length).toBe(2);
    expect(r.jobs[0]).toMatch(/Smith Family/);
    expect(r.jobs[0]).toMatch(/Cooked meals/);
    expect(r.education[0]).toMatch(/Early Childhood/);
    expect(r.skills).toEqual(["First aid", "Infant care", "Cooking"]);
    expect(r.certificates[0]).toMatch(/First Aid/);
    expect(JSON.stringify(r)).not.toMatch(/0400|111 222/);
  });
  it("falls back to a summary when there are no headings", () => {
    const r = parseResumeText("Alex\nI have looked after children for six years and love it.");
    expect(r.summary).toMatch(/six years/);
  });
  it("cleans edited text again before saving", () => {
    const r = cleanResume({ summary: "Call me 0412 345 678", jobs: [], education: [], skills: [], certificates: [] });
    expect(r.summary).not.toMatch(/0412/);
  });
});
