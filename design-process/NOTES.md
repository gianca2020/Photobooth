# Little Photo Club: design evolution notes

Evidence-based, from screenshots in `screens/` (1280×800, scenes -1..5 per draft; `go(i)` drives each draft). "Why" lines stay blank until Giancarlo fills them in.

## Drafts
`drafts/` holds 16 files = 14 numbered drafts (07–13, 15–21; no 14; drafts before 07 not provided) + 2 extra 08 variants.
- 08, 08_dither100 and 08_dither100(1) all still say "Draft 07" in the title. The two dither files are the same size, so probably duplicates.
- Saved Nov 25 23:19 (draft 07) → Nov 26 02:15 (draft 21): about 3 hours. Draft 10 was re-saved at 04:55.
- Draft 11's footer still reads "DRAFT / 10" (label not updated).

## Constants since draft 07
- Flow: welcome → guests → booth → photos → reveal → email.
- UI chrome: pixel font, orange `#F66B00` buttons with hard shadows, "little photo ✳ club" wordmark, ink `#171717`.
- The guest-setup screen already used the real character art in draft 07 (smooth illustration).

## Turning points (verified by looking at screens)
| Draft | What changed | Why (Giancarlo) |
|---|---|---|
| 07 | Baseline. Smooth marker-script "Welcome!", line-art camera, plain white bg, tilted smooth character portrait, flat orange panel for reveal, raw camera feed with plain buttons. 6 scenes. | |
| 08 | Faint grid background; dither variants tried. | |
| 09 | Dot-dither background; pixel "Insert coin" launch scene added (7 scenes). Welcome art still vector. | |
| 10 | "Welcome" turns pixelated and is handwritten on letter by letter. | |
| 11 | Pixel-art dithered camera with orange accent replaces the vector camera. | |
| 12 | Last draft with the smooth, tilted portrait. | |
| 13 | **Portrait becomes straight, hard-edged 1-bit art**, with a hard drop shadow. File size drops from ~7MB to ~400KB in the same draft (likely the art was re-encoded; confirm). | |
| 15–19 | Camera screen grows from a raw feed into an arcade camera housing with a filter bar (Classic, Flipnote Ink, Mischief, Distortion, Orange Lens) and Doodle frame. Not yet diffed draft by draft. | |
| 20–21 | Graffiti feature added (draw on photos). 21 is the current state. | |

Reveal scene: **corrected.** Draft 07 already has the dispenser interaction (an orange vector booth with a recessed slot; click "Pick up your photo strip" to open the photos). Draft 21 uses identical logic (`openPhoto`) with pixel art and a "PHOTOS" sign. So the change is art only, not behavior. An earlier note and the Figma row "orange panel to pixel dispenser" called the old version a flat panel, which was wrong.

Copy change in draft 12: a heading changed from "Take us…" to "Special delivery!". It appears on the **Email** screen, not the reveal (an earlier note said reveal; that was wrong).

Camera screenshots: draft 07 shows a green video box only because the headless test browser used a fake green webcam feed. Later drafts show gray because the default "Classic" filter is black and white. Don't treat the green as a design change.

## Characters (`characters/`)
Man / Guest 1 (cap, earring, 4 expressions + turnaround), Woman / Guest 2 (bangs, hoops, turtleneck, 3 expressions + back), Baby / Guest 3 (messy hair, deadpan + star-eyes), Cat (black silhouette, orange burst marks). Shared system: black ink, halftone dots, one orange accent, orange burst lines for emotion.
- **Giancarlo confirmed: the characters came first and shaped the pixel direction.** (Sheets saved Nov 25 21:13–21:15, draft 07 at 23:19.)
- Intent (his words): each character lets users self-insert into this world and remember the project better; clicks should have a Nintendo-like feel; storytelling is meant to push a nostalgic feel. What each character's story is stays up to the user.
- Evidence of outcomes: none yet. Only Giancarlo has used it.

## Headline story (candidate)
The characters came first. The app wrapped them in a friendly marker-and-orange interface, then drafts 09–13 pulled the whole world into the characters' 1-bit halftone language (draft 13 is the moment the character art itself goes 1-bit). Drafts 15–21 turned the camera step into an arcade booth, while the flow stayed fixed.

## Figma
File: https://www.figma.com/design/Cz1Ry96QpaBQBSBgE4lNuu (team: Giancarlo Forero's team).
- Starter plan: max 3 pages, and a Figma MCP tool-call limit (hit during the first build).
- Pages: 1 · Cover & Cast (cover frame + idea/cast/system frame), 2 · The Flow (draft 21, 7 screens), 3 · How It Changed (5 before/after rows + "what's missing").
- Fonts: Press Start 2P (headings; Pixelify Sans was dropped because its capital C and G read as O and B and its "fi" ligature breaks), Space Mono (body/captions), Caveat (handwritten notes).
- "Why" slots on page 3 are placeholders for Giancarlo.
- After the font swap, the cover and flow frames were re-checked; the cast and how-it-changed frames were not (rate limit). Look for text overflow there.

## Reasons given by Giancarlo (Nov 26)
- Portrait (draft 13): visual cohesion; everything should map to one nostalgic Flipnote-style look. (Direction was tilted/smooth → straight/1-bit.)
- Filters/camera: the app merges the photobooth (revival among young people) with the Nintendo DSi; filters echo DSi Camera lenses and Flipnote.
- Reveal: delegated to me; reasoned from the code (pickup gate, then Keep/Retake gate). Needs his confirmation.
- Click feel: "needs to feel like Nintendo memoriam" (read as: a memory of / tribute to Nintendo).

## Research (checked against sources)
- DSi + DSi XL: 41M+ units combined as of Sept 30, 2014 (28.44M + 12.93M, Nintendo figures via Wikipedia). DS family 154.02M.
- Flipnote Archive: 44M Flipnotes from 1.2M creators (fan-built, DSi-era Hatena servers; Nintendo Life, Jun 2022).
- Photobooths: The Week (Oct 2025) says young people are flocking to booths, but gives no statistics. The claim "everyone runs to photobooths to post about it" and any market-value figure are NOT supported by what I found.
- DSi Camera lens names verified from Nintendo's manual: Distortion, Mischief. Emoter and Graffiti lenses appear in a search summary only; not verified.
