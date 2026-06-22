import {
  compareCodes,
  createAgentRun,
  createBaselineRun,
  createCompanyProfile,
  scoreBatch,
} from "./domain.mjs";
import { createModelProvider } from "./model-provider.mjs";

const app = document.querySelector("#app");

const state = {
  dataset: null,
  selectedId: "FIRMA-0002",
  mainTab: "plan",
  rightTab: "agent",
  baselineRun: null,
  agentRun: null,
  activeRun: null,
  profile: null,
  selectedObligationCode: null,
  batch: null,
  timeShifted: false,
  providerMode: "mock",
  messages: [],
};

init().catch((error) => {
  app.innerHTML = `<main class="fatal"><h1>Demo se nepodařilo načíst</h1><pre>${escapeHtml(error.stack ?? error.message)}</pre></main>`;
});

async function init() {
  state.dataset = await loadDataset();
  state.profile = createCompanyProfile(state.selectedId, state.dataset);
  state.baselineRun = createBaselineRun(state.selectedId, state.dataset);
  state.agentRun = createAgentRun(state.selectedId, state.dataset);
  state.activeRun = state.agentRun;
  state.selectedObligationCode = state.agentRun.obligationCodes[0];
  state.batch = scoreBatch(state.dataset);
  state.messages = [
    {
      role: "agent",
      text: "Agent je připravený. Model není potřeba pro výpočet povinností; vysvětlení zatím běží přes šablonový provider.",
    },
  ];
  render();
}

async function loadDataset() {
  if (globalThis.FIRMGUARD_DATA) {
    return globalThis.FIRMGUARD_DATA;
  }

  const [intents, cases, classifications, catalog, ares] = await Promise.all([
    fetchJson("./data/sandbox/zamery_firem.json"),
    fetchJson("./data/sandbox/ukazkove_pripady.json"),
    fetchJson("./data/sandbox/klasifikace_zivnosti.json"),
    fetchJson("./data/sandbox/katalog_povinnosti.json"),
    fetchJson("./data/sandbox/registr_ares.json"),
  ]);

  return {
    intents,
    cases,
    classifications,
    catalog,
    ares,
  };
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Nelze načíst ${url}: HTTP ${response.status}`);
  }
  return response.json();
}

function render() {
  const intent = currentIntent();
  const caseRecord = currentCase();
  const activeRun = state.activeRun;
  const selectedObligation = activeRun?.obligations.find((item) => item.code === state.selectedObligationCode);

  app.innerHTML = `
    <aside class="left-rail">
      ${renderBrand()}
      ${renderCasePicker()}
      ${renderDemoActions()}
    </aside>
    <main class="workbench">
      ${renderTopBar(intent)}
      ${renderMainTabs()}
      ${state.mainTab === "settings" ? renderSettings() : ""}
      ${state.mainTab === "plan" ? renderCompliancePlan(activeRun, selectedObligation, caseRecord) : ""}
      ${state.mainTab === "batch" ? renderBatchScore() : ""}
    </main>
    <aside class="agent-rail">
      ${renderAgentRail(activeRun)}
    </aside>
  `;

  bindEvents();
  drawScoreCanvas();
}

function renderBrand() {
  return `
    <section class="brand-block">
      <div class="brand-row">
        <div class="brand-mark">FG</div>
        <div>
          <p class="eyebrow">Sandbox AIO 2026</p>
          <h1>FirmGuard Agent</h1>
        </div>
      </div>
      <p class="brand-copy">Lokální agent pro založení s.r.o., skryté povinnosti a hlídání v čase.</p>
    </section>
  `;
}

function renderCasePicker() {
  return `
    <section class="case-list" aria-label="Ukázkové případy">
      <div class="section-head">
        <h2>Případy</h2>
        <span>${state.dataset.cases.length}</span>
      </div>
      ${state.dataset.cases
        .map((caseRecord) => {
          const selected = caseRecord.id === state.selectedId ? "is-selected" : "";
          return `
            <button class="case-item ${selected}" data-case-id="${caseRecord.id}">
              <span class="case-id">${caseRecord.id}</span>
              <span class="case-title">${escapeHtml(caseRecord.predmet)}</span>
              <span class="case-tags">${trapTags(caseRecord).map((tag) => `<b>${tag}</b>`).join("")}</span>
            </button>
          `;
        })
        .join("")}
    </section>
  `;
}

function renderDemoActions() {
  return `
    <section class="demo-actions">
      <button class="primary-action" data-action="run-agent">Spustit agenta</button>
      <button data-action="run-baseline">Spustit baseline</button>
      <button data-action="run-batch">Porovnat všech 6</button>
      <button data-action="simulate-time">${state.timeShifted ? "Vrátit čas" : "Simulovat čas"}</button>
    </section>
  `;
}

function renderTopBar(intent) {
  const caseRecord = currentCase();
  return `
    <header class="top-bar">
      <div>
        <p class="eyebrow">Aktivní záměr</p>
        <h2>${escapeHtml(intent.nazev)} <span>${escapeHtml(intent.id)}</span></h2>
      </div>
      <dl class="intent-facts">
        <div><dt>Předmět</dt><dd>${escapeHtml(intent.predmet)}</dd></div>
        <div><dt>Obrat</dt><dd>${formatMoney(intent.predpokladany_obrat_rok)}</dd></div>
        <div><dt>Zaměstnanci</dt><dd>${intent.plan_zamestnancu}</dd></div>
        <div><dt>Provozovna</dt><dd>${intent.provozovna ? "ano" : "ne"}</dd></div>
      </dl>
      <p class="trap-note">${escapeHtml(caseRecord?.proc_zradne ?? "")}</p>
    </header>
  `;
}

function renderMainTabs() {
  return `
    <nav class="main-tabs" aria-label="Hlavní zobrazení">
      ${tabButton("plan", "Compliance plan")}
      ${tabButton("settings", "Settings · O firmě")}
      ${tabButton("batch", "Batch score")}
    </nav>
  `;
}

function tabButton(tab, label) {
  const selected = state.mainTab === tab ? "is-active" : "";
  return `<button class="${selected}" data-main-tab="${tab}">${label}</button>`;
}

function renderCompliancePlan(activeRun, selectedObligation, caseRecord) {
  return `
    <section class="score-strip">
      ${renderScoreTile("Baseline", state.baselineRun?.metrics, "baseline")}
      ${renderScoreTile("Agent MVP", state.agentRun?.metrics, "agent")}
      <div class="score-visual">
        <canvas id="scoreCanvas" width="340" height="130" aria-label="Srovnání metrik"></canvas>
      </div>
    </section>
    <section class="comparison-band">
      ${renderMiniRun("Baseline", state.baselineRun, caseRecord?.spravne_povinnosti)}
      ${renderMiniRun("Agent", state.agentRun, caseRecord?.spravne_povinnosti)}
    </section>
    <section class="plan-grid">
      <div class="obligation-list">
        <div class="section-head">
          <h2>${activeRun?.type === "baseline" ? "Baseline povinnosti" : "Navržené povinnosti"}</h2>
          <button data-action="approve-plan">Schválit plán</button>
        </div>
        ${activeRun?.obligations.map((obligation) => renderObligationRow(obligation)).join("") ?? ""}
      </div>
      <div class="audit-panel">
        ${selectedObligation ? renderObligationDetail(selectedObligation) : renderEmptyDetail()}
      </div>
    </section>
    ${renderTimeline(activeRun)}
  `;
}

function renderScoreTile(label, metrics, variant) {
  return `
    <article class="score-tile ${variant}">
      <span>${label}</span>
      <strong>${metrics?.missedObligations ?? "–"}</strong>
      <p>propášené povinnosti</p>
      <small>${metrics?.extraObligations ?? "–"} zbytečně navíc · ${metrics?.founderBurden ?? 0} otázek</small>
    </article>
  `;
}

function renderMiniRun(label, run, expectedCodes = []) {
  const diff = compareCodes(run?.obligationCodes ?? [], expectedCodes);
  return `
    <article class="mini-run">
      <div class="section-head">
        <h3>${label}</h3>
        <span>${run?.obligationCodes.length ?? 0} položek</span>
      </div>
      <div class="code-cloud">
        ${run?.obligationCodes.map((code) => `<span>${code}</span>`).join("") ?? ""}
      </div>
      <p class="diff-line missed">Mine: ${diff.missed.length ? diff.missed.join(", ") : "nic"}</p>
      <p class="diff-line extra">Navíc: ${diff.extra.length ? diff.extra.join(", ") : "nic"}</p>
    </article>
  `;
}

function renderObligationRow(obligation) {
  const selected = obligation.code === state.selectedObligationCode ? "is-selected" : "";
  const approved = obligation.status === "schvaleno" ? "is-approved" : "";
  return `
    <article class="obligation-row ${selected} ${approved}" data-obligation="${obligation.code}">
      <button class="obligation-main" data-action="select-obligation" data-code="${obligation.code}">
        <span class="code-pill">${obligation.code}</span>
        <span>
          <strong>${escapeHtml(obligation.title)}</strong>
          <small>${escapeHtml(obligation.reason)}</small>
        </span>
      </button>
      <div class="row-meta">
        <span class="status ${obligation.status}">${statusLabel(obligation.status)}</span>
        <span>${timingLabel(obligation.timing)}</span>
        <span>${confidenceLabel(obligation.confidence)}</span>
      </div>
      <div class="row-actions">
        <button data-action="approve-obligation" data-code="${obligation.code}">Schválit</button>
        <button data-action="explain-obligation" data-code="${obligation.code}">Vysvětlit</button>
        <button data-action="schedule-obligation" data-code="${obligation.code}">${obligation.scheduled ? "Naplánováno" : "Naplánovat"}</button>
      </div>
    </article>
  `;
}

function renderObligationDetail(obligation) {
  return `
    <div class="detail-head">
      <span class="code-pill">${obligation.code}</span>
      <h2>${escapeHtml(obligation.title)}</h2>
    </div>
    <p>${escapeHtml(obligation.reason)}</p>
    <dl class="audit-list">
      <div><dt>Stav</dt><dd>${statusLabel(obligation.status)}</dd></div>
      <div><dt>Čas</dt><dd>${timingLabel(obligation.timing)}</dd></div>
      <div><dt>Jistota</dt><dd>${confidenceLabel(obligation.confidence)}</dd></div>
      <div><dt>Human-in-the-loop</dt><dd>${obligation.requiresHumanApproval ? "vyžaduje potvrzení" : "jen baseline výstup"}</dd></div>
      <div><dt>Zdroje</dt><dd>${obligation.sources.map((source) => `<span>${escapeHtml(source)}</span>`).join("")}</dd></div>
      <div><dt>Právní opora</dt><dd>${renderLegalEvidence(obligation.legalEvidence)}</dd></div>
    </dl>
    <p class="legal-note">Výstup je podklad, ne závazná právní rada. Produkční verze musí ověřit aktuální znění předpisů.</p>
  `;
}

function renderLegalEvidence(legalEvidence = []) {
  if (!legalEvidence.length) {
    return "<span>demo opora není přiřazena</span>";
  }

  return legalEvidence
    .map(
      (source) => `
        <a href="${escapeHtml(source.sourceUrl)}" target="_blank" rel="noreferrer">
          ${escapeHtml(source.actNumber)} · ${escapeHtml(source.sectionHint)}
        </a>
      `,
    )
    .join("");
}

function renderEmptyDetail() {
  return `<p class="empty-state">Vyberte povinnost pro audit trail.</p>`;
}

function renderTimeline(run) {
  const buckets = [
    ["pred_zalozenim", "Před založením"],
    ["ted", "Teď"],
    ["po_zalozeni", "Po založení"],
    ["pred_zahajenim", "Před zahájením provozu"],
    ["hlidat_v_case", state.timeShifted ? "Za 6 měsíců" : "Hlídat v čase"],
  ];

  return `
    <section class="timeline-band">
      ${buckets
        .map(([bucket, label]) => {
          const items = run?.obligations.filter((item) => item.timing === bucket) ?? [];
          return `
            <article>
              <h3>${label}</h3>
              ${items.length ? items.map((item) => `<span>${item.code}</span>`).join("") : "<small>bez položek</small>"}
            </article>
          `;
        })
        .join("")}
    </section>
  `;
}

function renderSettings() {
  const fields = [
    ["nazev", "Název firmy", "text"],
    ["obecne_zamereni", "Obecné zaměření", "textarea"],
    ["predmet", "Předmět podnikání", "text"],
    ["sidlo", "Sídlo", "text"],
    ["kontaktni_email", "Kontaktní e-mail", "email"],
    ["preferovany_kanal", "Preferovaný kanál", "select"],
    ["prvni_mesic_cinnosti", "První měsíc činnosti", "month"],
    ["predpokladany_obrat_rok", "Odhad ročního obratu", "number"],
    ["plan_zamestnancu", "Plán zaměstnanců", "number"],
    ["provozovna", "Má provozovnu", "checkbox"],
    ["ucetni_kontakt", "Účetní kontakt", "text"],
    ["souhlas_registry", "Souhlas s registry", "checkbox"],
  ];

  return `
    <section class="settings-view">
      <div class="section-head">
        <h2>O firmě</h2>
        <button data-action="run-agent">Přepočítat agenta</button>
      </div>
      <div class="settings-table">
        ${fields.map(([key, label, type]) => renderProfileField(key, label, type)).join("")}
      </div>
    </section>
  `;
}

function renderProfileField(key, label, type) {
  const field = state.profile[key];
  const value = field?.value ?? "";
  const input =
    type === "textarea"
      ? `<textarea data-profile-field="${key}">${escapeHtml(value)}</textarea>`
      : type === "select"
        ? `<select data-profile-field="${key}">
            ${["aplikace", "e-mail", "účetní"].map((item) => `<option ${item === value ? "selected" : ""}>${item}</option>`).join("")}
          </select>`
        : type === "checkbox"
          ? `<input type="checkbox" data-profile-field="${key}" ${value ? "checked" : ""} />`
          : `<input type="${type}" data-profile-field="${key}" value="${escapeHtml(value)}" />`;

  return `
    <label class="settings-row">
      <span>
        <strong>${label}</strong>
        <small>${field?.required ? "povinné pro demo" : "volitelné"}</small>
      </span>
      ${input}
      <em>${field?.source ?? "uzivatel"}</em>
    </label>
  `;
}

function renderBatchScore() {
  const batch = state.batch ?? scoreBatch(state.dataset);
  return `
    <section class="batch-view">
      <div class="batch-hero">
        <div>
          <p class="eyebrow">Batch finále</p>
          <h2>Agent poráží baseline na ${batch.cases} ukázkových případech</h2>
        </div>
        <button data-action="run-batch">Přepočítat</button>
      </div>
      <table class="score-table">
        <thead><tr><th>Metrika</th><th>Baseline</th><th>Agent MVP</th></tr></thead>
        <tbody>
          <tr><td>Propásnuté povinnosti</td><td>${batch.baseline.missedObligations}</td><td>${batch.agent.missedObligations}</td></tr>
          <tr><td>Zbytečně přidané povinnosti</td><td>${batch.baseline.extraObligations}</td><td>${batch.agent.extraObligations}</td></tr>
          <tr><td>Zátěž zakladatele</td><td>neřeší once-only</td><td>${batch.agent.founderBurden}</td></tr>
        </tbody>
      </table>
      <div class="case-score-list">
        ${state.dataset.cases.map((caseRecord) => renderCaseScore(caseRecord)).join("")}
      </div>
    </section>
  `;
}

function renderCaseScore(caseRecord) {
  const baseline = createBaselineRun(caseRecord.id, state.dataset);
  const agent = createAgentRun(caseRecord.id, state.dataset);
  return `
    <article>
      <span>${caseRecord.id}</span>
      <strong>${escapeHtml(caseRecord.predmet)}</strong>
      <small>Baseline ${baseline.metrics.missedObligations}/${baseline.metrics.extraObligations} · Agent ${agent.metrics.missedObligations}/${agent.metrics.extraObligations}</small>
    </article>
  `;
}

function renderAgentRail(activeRun) {
  return `
    <section class="agent-tabs">
      <button class="${state.rightTab === "agent" ? "is-active" : ""}" data-right-tab="agent">Agent</button>
      <button class="${state.rightTab === "tools" ? "is-active" : ""}" data-right-tab="tools">Tool log</button>
    </section>
    ${state.rightTab === "agent" ? renderChat(activeRun) : renderToolLog(activeRun)}
  `;
}

function renderChat(activeRun) {
  const selected = activeRun?.obligations.find((item) => item.code === state.selectedObligationCode);
  return `
    <section class="chat-panel">
      <div class="model-line">
        <label>
          Provider
          <select data-provider-mode>
            <option value="mock" ${state.providerMode === "mock" ? "selected" : ""}>Mock fallback</option>
            <option value="ollama" ${state.providerMode === "ollama" ? "selected" : ""}>Ollama qwen3:14b</option>
          </select>
        </label>
        <span>${state.providerMode === "mock" ? "offline ready" : "fallback při chybě"}</span>
      </div>
      <div class="messages">
        ${state.messages.map((message) => `<p class="${message.role}">${escapeHtml(message.text)}</p>`).join("")}
      </div>
      <form class="chat-form" data-chat-form>
        <input name="question" value="${selected ? `Proč platí ${selected.code}?` : "Co baseline minula?"}" />
        <button>Vysvětlit</button>
      </form>
    </section>
  `;
}

function renderToolLog(activeRun) {
  return `
    <section class="tool-log">
      ${(activeRun?.toolCalls ?? [])
        .map(
          (call, index) => `
            <article>
              <span>${String(index + 1).padStart(2, "0")}</span>
              <strong>${escapeHtml(call.tool)}</strong>
              <code>${escapeHtml(JSON.stringify(call.args))}</code>
              <p>${escapeHtml(call.resultSummary)}</p>
            </article>
          `,
        )
        .join("")}
    </section>
  `;
}

function bindEvents() {
  app.querySelectorAll("[data-case-id]").forEach((button) => {
    button.addEventListener("click", () => selectCase(button.dataset.caseId));
  });

  app.querySelectorAll("[data-main-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mainTab = button.dataset.mainTab;
      render();
    });
  });

  app.querySelectorAll("[data-right-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.rightTab = button.dataset.rightTab;
      render();
    });
  });

  app.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleAction(button.dataset.action, button.dataset.code));
  });

  app.querySelectorAll("[data-profile-field]").forEach((input) => {
    input.addEventListener("change", () => updateProfileField(input));
    input.addEventListener("input", () => {
      if (input.tagName === "TEXTAREA" || input.type === "text" || input.type === "number" || input.type === "email") {
        updateProfileField(input, false);
      }
    });
  });

  const providerSelect = app.querySelector("[data-provider-mode]");
  providerSelect?.addEventListener("change", () => {
    state.providerMode = providerSelect.value;
    render();
  });

  const form = app.querySelector("[data-chat-form]");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = new FormData(form).get("question");
    await explainSelected(String(question ?? ""));
  });
}

function selectCase(companyId) {
  state.selectedId = companyId;
  state.profile = createCompanyProfile(companyId, state.dataset);
  state.baselineRun = createBaselineRun(companyId, state.dataset);
  state.agentRun = createAgentRun(companyId, state.dataset);
  state.activeRun = state.agentRun;
  state.selectedObligationCode = state.agentRun.obligationCodes[0];
  state.timeShifted = false;
  state.messages = [{ role: "agent", text: `Načetl jsem ${companyId}. Můžete spustit baseline nebo agenta nad aktuálním profilem.` }];
  render();
}

function handleAction(action, code) {
  if (action === "run-baseline") {
    state.baselineRun = createBaselineRun(state.selectedId, state.dataset);
    state.activeRun = state.baselineRun;
    state.selectedObligationCode = state.activeRun.obligationCodes[0];
    state.rightTab = "tools";
  }

  if (action === "run-agent") {
    state.agentRun = createAgentRun(state.selectedId, datasetWithProfile());
    state.activeRun = state.agentRun;
    state.selectedObligationCode = state.agentRun.obligationCodes[0];
    state.rightTab = "tools";
  }

  if (action === "run-batch") {
    state.batch = scoreBatch(state.dataset);
    state.mainTab = "batch";
  }

  if (action === "simulate-time") {
    state.timeShifted = !state.timeShifted;
    if (state.timeShifted) {
      state.messages.push({ role: "agent", text: "Simulace času: u případů s vyšším obratem zvýrazňuji hlídání DPH jako blížící se odloženou povinnost." });
    }
  }

  if (action === "select-obligation") {
    state.selectedObligationCode = code;
  }

  if (action === "approve-obligation") {
    updateObligationStatus(code, "schvaleno");
  }

  if (action === "schedule-obligation") {
    updateObligationStatus(code, "naplanovano");
  }

  if (action === "approve-plan") {
    for (const obligation of state.activeRun?.obligations ?? []) {
      obligation.status = obligation.scheduled ? "naplanovano" : "schvaleno";
    }
    state.messages.push({ role: "agent", text: "Plán je potvrzený člověkem. Agent by teď v reálném produktu pouze připravil další kroky, nic nepodává sám." });
  }

  if (action === "explain-obligation") {
    state.selectedObligationCode = code;
    explainSelected(`Proč platí ${code}?`);
    return;
  }

  render();
}

function updateProfileField(input, rerender = true) {
  const field = state.profile[input.dataset.profileField];
  if (!field) return;

  if (input.type === "checkbox") {
    field.value = input.checked;
  } else if (input.type === "number") {
    field.value = Number(input.value);
  } else {
    field.value = input.value;
  }

  field.source = "uzivatel";
  if (rerender) render();
}

async function explainSelected(question) {
  const obligation = state.activeRun?.obligations.find((item) => item.code === state.selectedObligationCode);
  if (!obligation) return;

  state.rightTab = "agent";
  state.messages.push({ role: "user", text: question });
  render();

  const explanation = await requestExplanation({
    question,
    obligation,
    company: state.profile,
    run: state.activeRun,
  });
  state.messages.push({ role: "agent", text: explanation.answer });
  render();
}

async function requestExplanation(context) {
  if (state.providerMode === "ollama") {
    try {
      const response = await fetch("./api/agent/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...context, providerMode: "ollama" }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.json();
    } catch (error) {
      return createModelProvider({ mode: "mock" }).explain({
        ...context,
        question: `${context.question} (server/Ollama nedostupny: ${error.message})`,
      });
    }
  }

  const provider = createModelProvider({ mode: state.providerMode });
  return provider.explain(context);
}

function updateObligationStatus(code, status) {
  for (const run of [state.agentRun, state.activeRun]) {
    const obligation = run?.obligations.find((item) => item.code === code);
    if (obligation) {
      obligation.status = status;
      if (status === "naplanovano") obligation.scheduled = true;
    }
  }
}

function datasetWithProfile() {
  const intent = currentIntent();
  const updatedIntent = {
    ...intent,
    nazev: state.profile.nazev.value,
    predmet: state.profile.predmet.value,
    sidlo: {
      ...intent.sidlo,
      adresa: state.profile.sidlo.value,
    },
    predpokladany_obrat_rok: Number(state.profile.predpokladany_obrat_rok.value),
    plan_zamestnancu: Number(state.profile.plan_zamestnancu.value),
    provozovna: state.profile.provozovna.value ? (intent.provozovna ?? { adresa: state.profile.sidlo.value }) : null,
  };

  return {
    ...state.dataset,
    intents: state.dataset.intents.map((item) => (item.id === state.selectedId ? updatedIntent : item)),
  };
}

function currentIntent() {
  return state.dataset.intents.find((item) => item.id === state.selectedId);
}

function currentCase() {
  return state.dataset.cases.find((item) => item.id === state.selectedId);
}

function drawScoreCanvas() {
  const canvas = document.querySelector("#scoreCanvas");
  if (!canvas || !state.batch) return;

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 340;
  const height = canvas.clientHeight || 130;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const baseline = state.batch.baseline.missedObligations;
  const agent = state.batch.agent.missedObligations;
  const max = Math.max(30, baseline, agent);

  drawBar(ctx, 26, 26, (baseline / max) * 240, "#b84a3a", `Baseline ${baseline}`);
  drawBar(ctx, 26, 74, Math.max(4, (agent / max) * 240), "#247c63", `Agent ${agent}`);

  ctx.fillStyle = "#5f675f";
  ctx.font = "12px Aptos, Segoe UI, sans-serif";
  ctx.fillText("propásnuté povinnosti napříč datasetem", 26, 118);
}

function drawBar(ctx, x, y, width, color, label) {
  ctx.fillStyle = "#eef0e8";
  ctx.fillRect(x, y, 260, 18);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, 18);
  ctx.fillStyle = "#17211c";
  ctx.font = "700 13px Aptos, Segoe UI, sans-serif";
  ctx.fillText(label, x + 270, y + 14);
}

function trapTags(caseRecord) {
  const text = caseRecord.proc_zradne ?? "";
  const tags = [];
  if (text.includes("obrat")) tags.push("DPH");
  if (text.includes("zamestnance")) tags.push("ZAM");
  if (text.includes("provozovna")) tags.push("PROV");
  if (text.includes("regulovany")) tags.push("ŽIV");
  if (text.includes("sidlo")) tags.push("SIDLO");
  if (text.includes("majitelu")) tags.push("UBO");
  return tags.slice(0, 4);
}

function statusLabel(status) {
  return (
    {
      baseline: "Baseline",
      ceka_na_schvaleni: "Čeká na schválení",
      schvaleno: "Schváleno",
      naplanovano: "Naplánováno",
      zamitnuto: "Zamítnuto",
    }[status] ?? status
  );
}

function timingLabel(timing) {
  return (
    {
      pred_zalozenim: "před založením",
      po_zalozeni: "po založení",
      pred_zahajenim: "před provozem",
      ted: "teď",
      hlidat_v_case: "hlídat v čase",
    }[timing] ?? timing
  );
}

function confidenceLabel(confidence) {
  return (
    {
      vysoka: "vysoká jistota",
      stredni: "střední jistota",
      nizka: "nízká jistota",
    }[confidence] ?? confidence
  );
}

function formatMoney(value) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
