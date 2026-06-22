# Přepis FirmGuard Agent Demo z vanilla JS na React

**Datum:** 2026-06-22
**Stav:** Schváleno k implementaci

## Cíl

Přepsat vykreslovací vrstvu demo aplikace z vanilla DOM (`innerHTML` šablony + event delegation v `src/app.mjs`) na React komponenty. UI zůstává vizuálně identické, doménová logika beze změny.

## Rozhodnutí (potvrzeno uživatelem)

- **Build:** Vite + `@vitejs/plugin-react`.
- **Jazyk:** JavaScript (JSX), žádný TypeScript.
- **Styly:** zachovat `src/styles.css` beze změny, importovat v `main.jsx`.
- **Data:** plně Vite — JSON importovat přímo do kódu; opustit offline `embedded-data.js` a `server.mjs`.

## Co zůstává beze změny

- `src/domain.mjs` a `src/model-provider.mjs` — čisté funkce bez DOM. Zůstávají na stejné cestě, aby testy fungovaly bez úprav.
- `src/styles.css` — 899 řádků, beze změny.
- `tests/domain.test.mjs`, `tests/model-provider.test.mjs` a `npm test` (`node --test tests/*.test.mjs`).
- Veškerý vzhled a chování UI (texty v češtině, „podklad, ne závazná právní rada", human-in-the-loop).

## Architektura

### Stav: jeden `useReducer` v `App.jsx`

`initialState` zrcadlí dnešní globální `state` objekt:
`{ dataset, selectedId, mainTab, rightTab, baselineRun, agentRun, activeRun, profile, selectedObligationCode, batch, timeShifted, providerMode, messages }`.

Akce z dnešního `handleAction` / `selectCase` / `updateProfileField` / `updateObligationStatus` se stanou case'y reduceru:
`SELECT_CASE`, `SET_MAIN_TAB`, `SET_RIGHT_TAB`, `RUN_BASELINE`, `RUN_AGENT`, `RUN_BATCH`, `SIMULATE_TIME`, `SELECT_OBLIGATION`, `APPROVE_OBLIGATION`, `SCHEDULE_OBLIGATION`, `APPROVE_PLAN`, `UPDATE_PROFILE_FIELD`, `SET_PROVIDER_MODE`, `PUSH_MESSAGE`.

**Immutabilita:** dnešní kód mutuje povinnosti na místě (`updateObligationStatus`, „Schválit plán"). V reduceru se přepíše na immutable update (nové pole povinností / nový run), jinak React nepřekreslí.

**Async vysvětlení:** chat `explain` volá `createModelProvider().explain()` asynchronně. Řeší se handlerem v `App`, který dispatchne `PUSH_MESSAGE` (user → await → agent). Provider zůstává s graceful fallbackem.

### Strom komponent

- `App` — app-shell grid, reducer, načtení datasetu, async explain handler
  - `LeftRail` → `Brand`, `CasePicker`, `DemoActions`
  - `Workbench` → `TopBar`, `MainTabs`, a dle `mainTab`:
    - `CompliancePlan` → `ScoreTile` ×2, `ScoreChart` (canvas přes `useRef` + `useEffect`), `MiniRun` ×2, `ObligationRow`, `ObligationDetail`, `Timeline`
    - `SettingsView` → editovatelná pole profilu
    - `BatchView` → `CaseScore`
  - `AgentRail` → `ChatPanel` (async explain) / `ToolLog`

### Sdílené helpery

`statusLabel`, `timingLabel`, `confidenceLabel`, `formatMoney`, `trapTags` se vytáhnou do `src/lib/labels.js`. `escapeHtml` se zahodí — JSX escapuje text sám.

### Načítání dat

5 JSON souborů z `data/sandbox/` (`zamery_firem`, `ukazkove_pripady`, `klasifikace_zivnosti`, `katalog_povinnosti`, `registr_ares`) se importuje přímo a složí do `dataset`. `normalizeDataset` zvládne syrový tvar.

## Build a skripty

- `package.json`: přidat deps `react`, `react-dom`, `vite`, `@vitejs/plugin-react`. Skripty: `dev` (vite), `build` (vite build), `preview` (vite preview), `test` (beze změny). Odebrat `start` a `embed-data`.
- `vite.config.js` s React pluginem.
- `index.html`: Vite entry — `<div id="root">` + `<script type="module" src="/src/main.jsx">`.

## Soubory k odstranění

`src/app.mjs`, `server.mjs`, `run-server.cmd`, `scripts/embed-data.mjs`, `data/sandbox/embedded-data.js`. Aktualizovat `CLAUDE.md` (příkazy + architektura). Důsledek: demo už nepoběží z `file://`, jen přes `vite dev` / `preview`.

## Ověření

1. `npm install` projde.
2. `npm run build` zkompiluje bez chyb.
3. `npm test` — doménové testy projdou (7/7).
4. `npm run dev` — UI vypadá a chová se shodně s vanilla verzí (výběr případu, run agenta/baseline, batch, settings, schválení povinnosti, chat vysvětlení, simulace času).
