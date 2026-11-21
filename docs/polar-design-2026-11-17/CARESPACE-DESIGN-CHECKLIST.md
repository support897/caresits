# CareSpace Design Implementation Checklist

Distilled by the ChatGPT/Codex desk, 2026-11-17, from the cured
CareSpace HTML (md5 75a4823c150489d0e843d007dd5cca5c), the track
fences and HQ's fence rulings. The HTML governs; this checklist is how
a builder checks a screen against it. Every item is checked per screen,
per role, per state, at the exactness pass.

## Type — three simultaneous roles, never options or a picker

- Display / brand voice: Fraunces. Headings, celebrations, story
  moments.
- Bubble / friendly emphasis: Fredoka. Buttons, chips, playful labels.
- All long-form and functional text: Atkinson Hyperlegible — even when
  surrounded by decorative type. Atkinson Hyperlegible NEXT banned.
- Functional text minimum 17pt. Dynamic Type scales; layouts survive
  the largest accessibility text size; Reduced Motion is honoured on
  rendered screens.

## Colour — same brand, measured

- Ink (body text): #2D2A35. No dark green anywhere.
- Bunny Pink #F4A9BC · Bunny Blush #F2C4CE · Blush Pink #F6CBD3.
- Deep Raspberry #C2345B — only on words that must be read (Bunny Pink
  on white measures 1.87:1 and never carries must-read text alone).
- Audited helpers only: Sky #B9D6EC · Sun #F6D67C.
- White is the default ground; dark theme is true black — and the dark
  theme must be checked on RENDERED screens, not only by its saved
  value (the track's open honesty gap).
- Every text/background pair measures 4.5:1 or better.

## CareSpace screen craft

- Warm cards, hierarchy and spacing translated into reusable SwiftUI
  components — one component per repeated shape, never per-screen
  copies that drift.
- Home ordering: the next actual handover stands FIRST, followed by
  real updates, then messages, then calendar information.
- The message-bubble heart geometry is preserved through the approved
  asset — never redrawn, approximated or replaced by a system shape.
- Truthful message and record states, each designed and distinct:
  pending, saved, failed, delivered, read, acknowledged. A state the
  backend has not confirmed is never rendered as confirmed.

## Content states — every screen, every one

- Loading (designed, never blank), empty (says what will appear and
  what to do), error (real error, plain words, recovery action),
  offline (named, queued work stated honestly), denied permission
  (what, why, how to allow), recovery (a working way back).

## The bunny and art

- The bunny is the master file (original_bunny_UNMODIFIED.png, md5
  8119dd962fff72882152f6e21f6300ca), poses as they are — never derived,
  redrawn or regenerated.
- No emojis anywhere in the app. Icons are designed brand marks.
- Screen art is picture-compared against the approved art of record on
  the shipped bytes (Screen-Art Compare Law).

## Exactness pass evidence, per screen

- Screen captures from the actual build, both roles, including the
  important empty, error, offline and permission states — each with
  role, CS ID, state, device size, theme and commit recorded, compared
  against the same state in the cured HTML. Exactness cannot be
  established from Swift source alone; a green flow test is not proof
  a screen matches the design.
