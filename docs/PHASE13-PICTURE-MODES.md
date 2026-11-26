# Phase 13 — picture carousel and eight-door discovery (HappyClass original)

## Scope

This iteration closes two verified gaps from the public Easy Peasy demo comparison:

1. **Picture Puzzle** now includes a non-scored **3D Picture Ring** teacher showcase.
   It works on the same teacher-owned picture bank as the existing swap puzzle,
   with previous/next, optional auto-spin, adjustable speed (slow / normal / fast),
   a read-aloud button, Place 1, Place all, Clear board, and mobile/keyboard support.
   The original 2×2–4×4 swap puzzle, score and progress are unchanged.
   The picture-puzzle schema adds optional `picturesPerRound`: existing teacher
   packs play all images as before, while new packs can rotate non-overlapping
   picture sets on Play Again.
3. The seed-managed hidden `happyclass-picture-puzzle` example contains **12**
   licensed-by-owner SVG pictures, and plays **3 per session**. Seed revision is
   bumped from 1 to 2: any seed-managed copies will be reviewed before release.
2. **Mystery Doors** supports **eight doors (4 columns × 2 rows)** in addition to
   the existing four/six/nine door configurations. The data validator accepts the
   new value and rejects unsupported door counts.

The 3D picture ring is a **picture introduction/showcase**, not an answer key or
quiz mode. Showing/placing pictures does **not** change scores, submit results,
complete puzzle rounds, or unlock access to game content.

## Check in Game Builder preview

- Admin → Games → hidden HappyClass Picture Puzzle → Builder → Refresh Preview.
- Start, choose **3D Picture Ring**, then select previous/next pictures.
- Check auto spin, pause, speed setting, Place 1, Place all and Clear board.
- Switch back to **Solve puzzle**, swap pieces to solve the full game and check
  that only the solved puzzle rounds count toward the result.
- Press **Play again** after completing the three pictures: the next session
  should use the next three different image IDs rather than merely reshuffling
  pieces of the same picture.
- For Mystery Doors create/edit a **draft**, set doorCount to **8**, refresh
  preview, open one of eight doors and confirm choice scoring still works.
- Test on a narrow phone viewport, desktop and projected classroom display.
- Do not publish any draft or approve teacher review merely because CI passes.

## Validation and rollout

- Core tests: `packages/game-core/src/mystery-doors.test.ts` and
  `packages/game-core/src/picture-puzzle.test.ts`.
- Browser test: Picture Puzzle subsection in `apps/web/e2e/builder.spec.ts`.
- Run `npm run typecheck`, `npm run test:core` and appropriate Playwright
  preview tests in an isolated environment with existing E2E test credentials.
- A GitHub commit/PR is **not** a server deployment. Follow backup, safety
  and manual approval checklist in `docs/GO-LIVE.md` and the deployment script.

No Easy Peasy code, media, audio, trademark design or textbook content was
copied. The features are an independent implementation of comparable interaction
patterns, not a claim of exact visual or functional parity with all member games.
