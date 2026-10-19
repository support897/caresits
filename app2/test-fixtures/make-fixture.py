# Builds maria-santos.pdf, a real (if small) one page PDF
# holding a fictional carer resume. The PDF suite legs prove
# the shipped extractor reads THESE words and the draft
# grounds only in them. Regenerate with: python3 make-fixture.py
LINES = [
    "Maria Santos",
    "Nanny and babysitter",
    "Mobile 0412 555 018",
    "Email maria.santos@example.com",
    "Home 12 Crown Street, Surry Hills 2031",
    "Languages Spanish and English",
    "Experience 6 years with babies and toddlers",
    "First Aid certificate current",
    "Working With Children Check",
]

def esc(s):
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

content = ["BT", "/F1 16 Tf", "72 760 Td"]
for i, line in enumerate(LINES):
    if i:
        content.append("0 -26 Td")
    content.append(f"({esc(line)}) Tj")
content.append("ET")
stream = "\n".join(content).encode("latin-1")

objs = []
objs.append(b"<< /Type /Catalog /Pages 2 0 R >>")
objs.append(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
objs.append(b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>")
objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
objs.append(b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream")

out = bytearray(b"%PDF-1.4\n")
offsets = []
for i, body in enumerate(objs, start=1):
    offsets.append(len(out))
    out += f"{i} 0 obj\n".encode() + body + b"\nendobj\n"
xref_at = len(out)
out += f"xref\n0 {len(objs) + 1}\n".encode()
out += b"0000000000 65535 f \n"
for off in offsets:
    out += f"{off:010d} 00000 n \n".encode()
out += (f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_at}\n%%EOF\n").encode()

with open("maria-santos.pdf", "wb") as f:
    f.write(out)
print("wrote maria-santos.pdf", len(out), "bytes")
