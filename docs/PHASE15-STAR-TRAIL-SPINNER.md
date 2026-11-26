# Phase 15 — Star Trail spinner and replayable question library

## Design and reference boundary

The public Easy Peasy English Board Quest listing describes a classroom turn game
with a spinner, a board and quiz prompts. The complete JS gameplay and all
member-only features were not independently verified. This phase builds an
**original HappyClass interpretation** rather than copying its source, artwork,
audio, lesson text or brand identity.

This PR is stacked on Phase 14 (PR #56), itself stacked on Phase 13 (PR #55).
The code is a **draft only** and is not deployed to the customer's DL380.

## Functionality

- Teacher sets 2–4 teams in the GameShell intro, as before.
- During each new team turn, choose **Dice** or **Spinner**. A 2–6-segment
  pastel spinner visually selects the same bounded random roll mechanic as the
  dice and remains mounted while the quiz is displayed, to animate visibly.
- Teams move only after a correct answer. Answering incorrectly never moves a
  pawn. Board positions are clamped to the finish tile.
- The board displays a correct-answer count next to each team's position.
- An optional turn-history panel shows **only completed turns**, answers and
  rolls. It never reveals future questions or answers.
- Optional schema field `questionsPerRound` selects a real subset of the
  teacher-owned question bank on every replay. Packs without this field retain
  the legacy behaviour of using all questions.
- The **hidden English seed** contains **24 original questions and 10 per
  session**; repeat play selects the next ten different questions. All
  illustrations come from the first-party HappyClass SVG word library.
- The existing Vietnamese draft still defaults to Dice, but its teachers can
  also choose Spinner. No Vietnamese seed was changed.

## QA

1. Run `npm run build:core && npm run test:core`; check
   `packages/game-core/src/trail.test.ts` for spinner and selection bounds.
2. Run ESLint and TypeScript checks, then the Playwright preview section
   **Star Trail** in `apps/web/e2e/builder.spec.ts`.
3. On English preview, the question bank should say `10/24`.
4. Play an entire English ten-question round, check that the summary score,
   team hits, moves and result screen match the actual answers; Play Again
   must present a different set of question IDs.
5. In the spinner mode, the wheel should animate on phones and desktop and
   must stop at the displayed selected number. If reduced-motion is enabled,
   it should stop immediately.
6. Check 2, 3 and 4 teams, the final tile cap, disabled answers after a choice,
   history initially empty and history cleared when a new full session starts.
7. Teacher-review pronunciations and illustrations. Do not bulk-approve or
   publish the hidden game because a code test passes.

## Operational boundaries

No production seed/deploy, payment configuration, Cloudflare Access change,
live content approval, or database migration is included. Existing HappyClass
content and any other DL380 workloads must remain untouched.
