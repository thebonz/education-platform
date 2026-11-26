# Phase 16 — Fusion Reveal Cards: original digital/physical decoder

## Public reference boundary

The publicly described Easy Peasy English Shadow Fusion demo shows two
registration-marked square patterns intended to print at **145 × 145 mm**, on
landscape A4 pages, and reveal a visual when aligned. The full proprietary
script, underlying layer algorithm, graphical assets and membership features
were *not* inspected or copied. This phase builds an independently designed
dual-strip decoder for HappyClass with original educational material.

**Do not describe this as an exact clone, a copy of the source game, or a
validated equivalent of its physical optical effect.** Printed accuracy must be
checked using physical media and a printer.

## Implemented

- New English-only template key `fusion-reveal`, with Zod validation:
  even stripe count from 24–60, original picture cards, unique IDs/words,
  three or four distinct answers per card and 2–8 cards per session.
- Two layers: A shows the HappyClass original image on every even stripe
  and an original interference pattern on the odd stripes. B is a dark-stroke
  mask on every odd stripe with transparent slots in between. Slide B across
  A until the registration marks line up.
- Digital interaction: keyboard/touch range slider, answer choices locked
  until the patterns are aligned, wrong-answer feedback, read-aloud of the
  correct word after success, next card, game score/result and rotating
  pictures on **Play Again**.
- Teacher print: **two A4 landscape pages**. Each page contains a
  **145 × 145 mm** square drawn at actual size; A is white paper, B requires
  **clear transparency film** (or physically cut out the clear bands).
  Page B has no opaque white rectangle. Browser print must use **100% scale,
  no fit-to-page**. Crop/registration marks are drawn on both sheets.
- Game Builder starter and hidden demo with **12 original HappyClass
  illustration assets**, **three cards per session**; **published:false,
  review PENDING**. No external images, voice packs or premium lesson data
  copied from the reference site.

## QA and physical acceptance

1. `npm run build:core && npm run test:core`; validate starter, unique
   answers, stripe count, unsafe picture path and distinct replay cards in
   `packages/game-core/src/fusion-reveal.test.ts`.
2. Run ESLint, Web/API typecheck, build and `apps/web/e2e/phase16.spec.ts`
   in the normal isolated GitHub CI environment.
3. In Admin → English games → **Fusion Reveal Cards** → Builder → Preview:
   check the encrypted image, move decoder slider with mouse, touch and keyboard,
   verify choices disabled before alignment and enabled afterwards.
4. Guess wrong, then correctly, hear the proper American English audio and
   verify score. Repeat all three cards, click Play Again and verify that
   different images are selected from the 12-picture bank.
5. Open **Print sheets A + B** and select A4 **landscape**, 100% scale,
   all two pages. Check the printed square with a physical ruler: each must
   measure **145 mm** in both axes. Print A on paper and B on transparency
   film, align corner marks and inspect whether the intended object appears.
   If transparency ink is too translucent, change paper/film or use a cutout
   mask instead. Do **not** claim physical success based only on screen E2E.
6. Check screen reader descriptions, slider focus, contrast, page overflow,
   mobile layouts, A/B card print orientation, and images in the offline PWA.
7. Ask a teacher to review vocabulary, artwork, child safety and audio.
   Explicitly approve draft and version only after this review.

## Operational safeguards

The feature is a **Draft PR stacked on Phase 15**. There is no production
deployment, no seed run against the DL380, no auto-publication, no app
credential changes, no billing or Cloudflare Access changes and no impact on
other server workloads. Follow `docs/GO-LIVE.md` and keep backups/rollback
before any authorized release.
