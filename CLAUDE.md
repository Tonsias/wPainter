# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Operating mode

No human writes code here. Every line is produced by an LLM (primarily Claude), and every future reader is an LLM. Optimize the repository for that reader, not for a human onboarding experience.

- **Act, don't ask.** Committing and pushing are pre-authorized. Confirmation is still required for genuinely destructive or irreversible acts (history rewrites, force pushes, deleting remote state, repo settings that break the deploy).
- **Verify with tools, not inspection.** `npm run build` and `npm run lint` are the ground truth. Run both after changes; a green run replaces re-reading files.
- **No prose docs.** No READMEs, changelogs, guides, or summary markdown files unless the content is decision-relevant to a future LLM *and* cannot be derived from the code — then it goes here, not in a new file. `README.md` is only the GitHub landing page; keep it minimal.
- **Automate over repeating.** Anything otherwise re-derived or re-run by hand belongs in a workflow (`.github/workflows/`) or an npm script.
- **Comment budget.** Keep: a constraint, a trade-off, an external requirement, an invariant a reader could break, or why the obvious alternative was rejected. Delete: any retelling of the code beneath it, any issue-number chronicle, any doc comment on a non-exported symbol, any repetition of a decision already stated elsewhere. An exported symbol gets at most one line unless the non-derivable part demonstrably needs more. `npm run comment-budget` is the CI tripwire for this.

## Domain

The app produces PNG templates for wplace.live, so the palette is an external requirement, not a
design choice. `src/palette/wplace.ts` holds all 63 placeable colours in the game's own order:
indices 0-30 are the free ones, 31-62 premium. wplace's 64th palette slot is "transparent", which
is the eraser here rather than a swatch.

The list was cross-checked against three public palette references in September 2026 (they agree
on every hex except Teal, where two of three give `#10aea6`). If wplace ever changes its palette,
this array is the only place that has to move.

A pixel is stored as *palette index + 1*, so `0` — what a fresh `Uint8Array` is full of — already
means "nothing painted". A document therefore cannot represent a colour wplace does not have, and
that is the point: it removes the need to validate before export.

## Code conventions (optimized for LLM reading)

The cost that matters is how many files an LLM must read to change something safely. Minimize it.

- **Flat over layered.** No indirection that exists only for extensibility. No wrapper modules, no barrel `index.ts` re-exports, no abstract base classes with one implementation.
- **Colocate by feature.** A feature's component, types, state, and styles live in one directory. Do not split by technical kind (`components/`, `hooks/`, `utils/`) once a feature grows.
- **Types are the specification.** Strict mode is on; `any` and non-null-assertion escape hatches are defects. Model states so illegal ones cannot be represented.
- **No enums** (`erasableSyntaxOnly` is on): `export const X = [...] as const` + `type X = (typeof X)[number]`.
- **Predictable names.** File and symbol names must be greppable and unambiguous.
- **Plain CSS, one file per component that needs one**, BEM-ish (`.app__title`) — not CSS Modules, `styles.title` is not greppable.
- **vitest is pinned to 3.x on purpose.** vitest 4's optional peer set (`@vitest/browser-*`, `@vitejs/devtools-vitest`) crashes npm 11.5.2 while building the ideal tree (`Cannot read properties of null (reading 'edgesOut')`). Revisit when npm ships the fix; the pin is not about vitest 4 itself.
- **Minimal dependency surface.** Prefer the platform and what is already installed. Dependencies are `react` + `react-dom`; adding a third is a decision that belongs in this file with its reason. `@types/node` is a devDependency for the build-time and test tsconfigs only; it is types only and reaches no bundle.

## UI

The design tokens, the shared primitives (`.btn`, `.segment`) and the single-screen shell live in
`src/ui/App.css`. They are the project's whole visual vocabulary — a new surface reuses them
rather than introducing a second scale.

- **One screen, no page scroll.** `.app` is `height: 100dvh; overflow: hidden`; a panel that
  overflows scrolls inside itself. Anything that pushes the document into a scrollbar is a bug.
- **Two type families only.** `--font-heading` (Caprasimo) for the wordmark and panel titles,
  `--font-body` (Figtree) for everything else. Both come from the Google Fonts link in
  `index.html`, each with a real fallback stack.
- **Spacing and radii come from the tokens.** `--space-*` is a 4.4px-based scale; a hard-coded
  `px` gap is a defect unless the value is a device constant (a canvas size, a control's fixed
  hit area).
- **The canvas keeps its exact pixel size at every zoom.** Scale it through the element's CSS
  width/height with `image-rendering: pixelated`, and let the host scroll rather than letting the
  bitmap squash out of aspect.
- **Every CSS class must be referenced outside its own stylesheet** — `npm run deadcode` fails
  otherwise, which is what keeps the styled surface from growing back silently.

## Testing scope

Vitest, configured inside `vite.config.ts` (imports `defineConfig` from `vitest/config`, not `vite`). `environment: 'node'`. **No `globals: true`** — tests import from `vitest` explicitly, which `verbatimModuleSyntax` wants. Tests are colocated as `*.test.ts` next to the module they cover, and live in their own project reference (`tsconfig.test.json`) so Node globals stay out of `src/`. CI runs lint → comment-budget → line-budget → deadcode → test → build.

**Test pure functions only:** transforms, predicates, parsers, reducer actions. Do not test components or browser IO — that needs jsdom and fakes for near-zero signal on code whose real failure modes are the browser's.

## Commands

```bash
npm run dev            # Vite dev server (base '/', http://localhost:5173)
npm run build          # tsc -b (typecheck, project references) then vite build -> dist/
npm run preview        # serve dist/ locally; served under /wPainter/
npm run lint           # eslint (flat config)
npm run deadcode       # scripts/dead-exports.mjs: fails on an export or CSS class nothing outside its file uses
npm run comment-budget # scripts/comment-budget.mjs: CI tripwire on comment-line ratio per file
npm run line-budget    # scripts/line-budget.mjs: CI tripwire on line count per src/ directory
npm test               # vitest run (single pass)
npm run test:watch     # vitest in watch mode
```

## Deployment

Published to GitHub Pages at `https://tonsias.github.io/wPainter/` by `.github/workflows/deploy.yml` — every push to `main` builds and deploys via `upload-pages-artifact`/`deploy-pages`. No `gh-pages` branch; Pages source must stay "GitHub Actions" in repo settings.

`vite.config.ts` sets `base: '/wPainter/'` for builds only (dev stays on `/`) because the site lives in a repo subpath. Reference assets through Vite or `import.meta.env.BASE_URL` — a hard-coded absolute path like `/logo.svg` 404s in production. Pages serves static files only, so client-side routing needs hash routing or a `404.html` copy of `index.html`.

## TypeScript layout

`tsconfig.json` is a solution file with project references: `tsconfig.app.json` covers `src/` (DOM libs), `tsconfig.node.json` covers `vite.config.ts` (Node/build-time), `tsconfig.test.json` covers `src/**/*.test.ts`. All are `noEmit` — Vite transpiles; `tsc -b` is typecheck-only. `noUnusedLocals`/`noUnusedParameters` are on.
