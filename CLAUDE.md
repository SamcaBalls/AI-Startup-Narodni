# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

FirmGuard — a sandbox demo for the AIO 2026 Czech public-administration hackathon. The app is the workspace of a **single logged-in company**. The user keeps a set of **"papíry" (papers)** — editable official documents such as a founding contract, trade notification, or VAT registration — managed like chat threads (create, select, delete). The selected paper opens in the center for manual editing; an **AI agent** in the right rail helps edit it, fill it from publicly known company data (ARES), or advise. The company's own data is entered behind a **Settings** button in the left rail.

The deterministic compliance engine from the original concept (the baseline-vs-agent obligation scoring) is **retained and tested in `src/domain.mjs` but is currently not surfaced in the UI** — it is parked, ready to bring back.

The codebase and UI are entirely in **Czech**. Keep new user-facing strings in Czech. Output is framed as a *podklad, ne závazná právní rada* (a basis for a human to approve, not binding legal advice); the human-in-the-loop framing is intentional and should be preserved.

## Commands

- `npm install` — install dependencies (React + Vite).
- `npm run dev` — Vite dev server with HMR at `http://localhost:4173`.
- `npm run build` — production build into `dist/`.
- `npm run preview` — serve the built `dist/` locally.
- `npm test` — run the domain/provider tests (`node --test tests/*.test.mjs`).
- Single test file: `node --test tests/domain.test.mjs`

The tests run on plain Node and do **not** need Vite or a browser — they import the pure logic modules directly.

## Architecture

This is a **React (JSX) SPA built with Vite**. The UI is React; the compliance logic is framework-agnostic ES modules shared with the Node test suite.

Three concerns with a strict, deliberate separation:

1. **`src/domain.mjs` — deterministic compliance engine.** Pure functions, no DOM, no React, no I/O. This is the heart of the app and what the tests cover. It computes obligations from a company intent using hardcoded rule tables (`TIMING_BY_CODE`, `SOURCE_BY_CODE`, `TRADE_TYPE_TO_CODE`, `DPH_MODEL_THRESHOLD`, `DISPLAY_ORDER`). Key exports:
   - `createBaselineRun` — the naive wizard: a fixed set of obvious registrations, always free trade, stops after founding.
   - `createAgentRun` — derives hidden/deferred obligations from intent fields (provozovna, employee count, turnover vs DPH threshold, trade classification, ARES partner lookups) and produces a `toolCalls` trace.
   - `scoreBatch` / `compareCodes` — scoring against labelled `spravne_povinnosti`. Metrics: `missedObligations`, `extraObligations`, `founderBurden` (lower is better for all).
   - `createCompanyProfile` — editable "O firmě" fields, each tagged with a `source` (`zamer` vs `uzivatel`) and `required` flag.

2. **`src/model-provider.mjs` — the agent's language layer.** Two methods: `explain` (used by the parked compliance feature) and `assist` (the document chat — answers questions about a paper, proposes edits, fills from the company profile). The compliance computation is fully deterministic and model-independent; the LLM never decides obligations. Default mode is `mock` (template fallback, offline-ready); optional `ollama` mode posts to a local Ollama (`qwen3:14b`) and **always falls back to the template on any error**. When touching this file, keep graceful degradation intact.

3. **React UI (`src/`).** Component tree rooted at `src/App.jsx`, mounted by `src/main.jsx` (which also imports `src/styles.css`). State is a single `useReducer`:
   - **`src/state.js`** holds `createInitialState`, the `reducer`, and `getSelectedPaper`. State = a single logged-in `company` (`{ id, profile }`), a list of `papers` (each `{ id, title, body, messages }`, managed like chat threads), `selectedPaperId`, `settingsOpen`, and `providerMode`. Actions: `NEW_PAPER`, `DELETE_PAPER`, `SELECT_PAPER`, `RENAME_PAPER`, `EDIT_BODY`, `PUSH_MESSAGE` (per paper), `OPEN_SETTINGS` / `CLOSE_SETTINGS`, `UPDATE_PROFILE_FIELD`, `SET_PROVIDER_MODE`. All updates are immutable.
   - **`src/App.jsx`** owns the reducer and the async `assist` handler (calls `createModelProvider().assist()` and pushes the user question + agent answer to the selected paper's `messages`).
   - **`src/components/`** — `PaperRail` (left rail: wordmark, "Nový papír", the papers list with per-row delete, and a footer with the company name + Settings button), `PaperEditor` (center: editable title + auto-growing body `<textarea>`), `AgentRail` (right rail: the selected paper's chat, quick-action chips, provider toggle), `SettingsModal` (company-profile overlay) wrapping `SettingsView` (the profile field list).
   - **`src/lib/labels.js`** — shared display helpers; currently used only by the parked compliance code.

### Visual design

Monochrome minimalist: a strictly achromatic palette (off-black `#18181a`, white, greys — no hue, defined as CSS custom properties at the top of `styles.css`), system-sans for UI plus a mono family for data. The shell is a ChatGPT-style three-zone layout: a fixed-position left rail ("Papíry" — the documents, managed like chat threads, with a Settings button at the bottom), a scrolling center column (the selected document, editable), and a fixed-position right rail (the agent chat). Only the center scrolls. Avoid color, nested cards, and heavy shadows; separate with hairlines and whitespace. The codebase has no em dashes in user-facing strings by design.

### Data flow

Sandbox data lives as JSON in `data/sandbox/`. `src/dataset.js` imports the five files directly (Vite handles JSON imports) and assembles the `dataset` object passed to `createInitialState`. `normalizeDataset` (in `domain.mjs`) accepts both English and Czech top-level keys, so the raw shape works as-is. There is no runtime fetch and no build-time data embedding step.

## Conventions

- All source is ESM (`"type": "module"`). React files use `.jsx`; the framework-agnostic logic and tests use `.mjs`. No TypeScript.
- `domain.mjs` and `model-provider.mjs` must stay free of DOM/React/Vite imports so the Node test suite keeps importing them directly via `../src/...`.
- New domain logic should come with a matching test and an inline fixture in `tests/`.

## Reference docs (not code, but project context)

- `PRD_Agent_pro_verejnou_spravu_AIO_2026_vylepsene.md` — full product requirements.
- `shrnutí_chatu.md` — rationale for the chosen problem, the deterministic-rules + LLM-explainer architecture, and the Qwen3/Ollama model recommendation.
- `data/sandbox/README.md` — the original hackathon data-package brief and scoring rules.
- `docs/superpowers/specs/2026-06-22-react-conversion-design.md` — design doc for the vanilla→React migration.
