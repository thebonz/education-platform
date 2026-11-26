# Phase 14 — Bubble Garden navigation, extended classroom and Bingo teacher review

## Purpose and boundaries

Continue independently implementing comparable interactions described by public
Easy Peasy English demo pages, without cloning their UI, artwork, script, audio,
brand or paid lesson content. All examples and SVG illustrations here are
original HappyClass content. This PR is stacked on Phase 13 (PR #55), remains
in draft, and **must not** auto-approve content or deploy to production.

## Changed game mechanics

### Bubble Word Garden
- Learners can browse **previous/next words** within the chosen unit.
- Browsing an unsolved word does **not** mark it complete or grant points.
- The per-session completed-word set is tracked by word ID. Revisiting a
  solved word shows its letters as complete and **cannot award points twice**.
- **Undo letter** restores the previous bubble for unfinished words.
- A per-word draft remembers unfinished letters and selected bubble IDs across
  previous/next browsing, so navigating away does not discard student work.
- **Change unit** returns to unit selection and deliberately resets session
  score, errors and hint count (no cross-unit score carryover).
- The finish button only submits when **every item in the current round**
  has genuinely been solved. If a learner skips earlier words, it navigates
  to the next unresolved word.
- Existing legacy one-unit content stays supported; navigation works even
  without an explicit `wordsPerRound` value. Word audio stays on-device.

### Classroom Discovery
- Hidden teacher-controlled demo now has **19 original illustrated concepts**
  (the prior 9 plus 10 SVG objects: desk, computer, globe, window, door,
  notebook, scissors, crayons, glue and board), keeping six per round.
- Every replay selects different actual words/images via existing
  `sessionSelection`. New content seed revision 2 remains unpublished and
  pending teacher approval.
- The new 10 SVGs are first-party source files under
  `apps/web/public/illustrations/classroom/`.
- Only these known first-party illustration paths are allowed into the PWA
  offline package URL collection (no arbitrary external URL fetching).

### Bingo Carnival
- **Called letters** displays only previously and correctly matched calls;
  no upcoming answers are exposed.
- Previous calls can be replayed for listening practice.
- **New card** resets/hides the review list. It does not skip a call or
  change the scoring rules.
- Existing board-size/goal, show/hide call text, and voice controls remain.

## Required verification

1. `npm run build:core && npm run test:core` (Phase 13 baseline).
2. `npm run lint && npm run typecheck`.
3. Playwright: `apps/web/e2e/games.spec.ts` Bubble navigation + Bingo
   call-history tests and the hidden classroom preview in
   `apps/web/e2e/phase12.spec.ts`.
4. Manual classroom preview on desktop, Android, iOS and projector: review
   English narration, 19 SVG legibility, hint correctness, keyboard/touch
   targets, reduced-motion setting, and no repeated six-item vocabulary in
   back-to-back rounds.
5. Manual Bubble test: navigate away from an unsolved word then back,
   complete a word, return to it, confirm score does not increment again,
   undo a letter and reset by changing unit.
6. Manual Bingo test: answer a single call, open history and play it, then
   create a new card and confirm the history is empty.

## Operations

- CI or a merged PR is **not** deployment; do not run `ops/deploy-test.sh`
  in the customer's shared DL380 until backups, review and rollback have
  been confirmed.
- New seed content requires a real teacher's image/vocabulary/voice review.
- No billing, Cloudflare access or other shared-host containers are changed.
