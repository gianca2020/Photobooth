# Accessibility

## What is checked automatically
`tests/e2e/a11y.spec.ts` runs axe-core (WCAG 2.0/2.1 A and AA, plus best practices) on every screen, at desktop
and phone size: coin, welcome, guests (with names), run-in, camera (with the graffiti tools and stamp palette
open), dispenser (strip landed, with names), reveal, the graffiti editor with its palette, keep/retake, delivery
and the finished screen. Zero violations is required. Only the prototype scene-jumper (`#progress`, shown with
`?debug`) is excluded.

Changes this check led to (none visible; they only change what a screen reader announces):
- a hidden level-one heading, "Little Photo Club", inside `<main>` (the header is hidden on the coin screen);
- the sound button's name is its visible text ("sound on" / "sound off"), not a different label;
- the guest buttons are named "−1 guest" / "+1 guest" (their visible text first);
- the camera's four dots and the dispenser group have a role, so their labels are allowed;
- the printed strip button's name contains the words printed on it ("Pick up your photo strip, little photo club,
  Ana Ben"), and a newline separates the footer from the names line so assistive technology reads them apart.

## What cannot be checked automatically: colour contrast
axe reports contrast as "needs review" here because the backgrounds are dotted patterns. Computed by hand from
the design's own colours (WCAG ratios; AA needs 4.5:1 for normal text, 3:1 for large text and UI):

| Pair | Ratio | |
|---|---|---|
| ink `#171717` on white | 17.9 : 1 | passes |
| help text `#666666` on white | 5.7 : 1 | passes |
| ink on the orange `#f66b00` buttons | 6.0 : 1 | passes |
| orange on ink | 6.0 : 1 | passes |
| orange on white | 3.0 : 1 | just under 3:1; used only for decoration (the brand star, the live dot) and the big countdown numbers |
| white on orange | 3.0 : 1 | same |

The design is final, so none of this was changed. If the design is ever revisited, orange text on white is the
one pairing to darken.

## Not yet checked
- A real screen reader (VoiceOver, TalkBack): axe finds structural problems, not whether the flow makes sense.
- Keyboard-only use of the drawing canvases (drawing is pointer-only, as in Draft 27; the keep/retake, delivery
  and format buttons are ordinary buttons).
- Reduced motion is honoured by the coin, run-in and dispenser; not audited for the welcome animation.
