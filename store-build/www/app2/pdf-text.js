// Caresitters PDF text reader — extraction only, for the
// resume model (Ilse's ruling, 19 Oct 2026: an upload is an
// extraction, never a kept document).
//
// The library is pdf.js (pdfjs-dist 4.10.38, Mozilla,
// Apache License 2.0), vendored verbatim beside this file
// as pdf.min.js and pdf.worker.min.js, the same way the
// Firebase SDK is vendored under accounts/sdk. The 6.x line
// was tested first and refused: it calls platform APIs
// (Uint8Array toHex and family) that older WebViews do not
// carry, and a resume read must never be the thing that
// needs the newest phone. 4.10.38 is the widest-support
// line, and pdf-tests.mjs proves the shipped bytes extract
// a real PDF in Node, so the suite drives exactly what
// ships.
//
// Extraction only: nothing is rendered. A PDF whose words
// are pictures (a scan) yields no text at all, and the
// caller speaks the honest line for that case.
let lib = null;

export async function extractPdfText(bytes) {
  if (!bytes || !bytes.length) return "";
  if (!lib) {
    lib = await import("./pdf.min.js");
    lib.GlobalWorkerOptions.workerSrc = new URL("./pdf.worker.min.js", import.meta.url).href;
  }
  const doc = await lib.getDocument({ data: bytes }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    let line = "";
    for (const it of tc.items) {
      line += it.str;
      if (it.hasEOL) { pages.push(line); line = ""; }
      else line += " ";
    }
    if (line.trim()) pages.push(line);
  }
  return pages.join("\n");
}
