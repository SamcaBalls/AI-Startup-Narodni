const QUICK_ACTIONS = [
  ["Vyplnit z ARES", "Doplň prosím do dokumentu údaje z veřejně známých rejstříků (ARES)."],
  ["Compliance plán", "Shrň compliance plán pro tuto firmu a řekni, co má být v tomto dokumentu doplněno."],
  ["Zkontrolovat", "Zkontroluj tento dokument a upozorni na chybějící nebo sporné body."],
  ["Poradit", "Poraď mi, na co u tohoto dokumentu nezapomenout."],
];

export default function AgentRail({ state, paper, dispatch, assist }) {
  const agentRun = state.agentRun;
  const baselineRun = state.baselineRun;
  const scheduled = agentRun?.scheduled ?? [];

  const onSubmit = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const question = new FormData(form).get("question");
    form.reset();
    assist(String(question ?? ""));
  };

  return (
    <aside className="rail-right">
      <div className="chat-head">
        <span className="chat-title">Agent</span>
        <div className="provider">
          <select
            value={state.providerMode}
            onChange={(event) => dispatch({ type: "SET_PROVIDER_MODE", mode: event.target.value })}
            aria-label="Provider modelu"
          >
            <option value="mock">Mock</option>
            <option value="ollama">Ollama</option>
          </select>
        </div>
      </div>

      {agentRun && (
        <section className="agent-summary" aria-label="Compliance plán">
          <div className="summary-line">
            <span>Agent</span>
            <strong>{agentRun.metrics.missedObligations}/{agentRun.metrics.extraObligations}</strong>
          </div>
          <div className="summary-line muted">
            <span>Baseline</span>
            <strong>{baselineRun?.metrics.missedObligations ?? "?"}/{baselineRun?.metrics.extraObligations ?? "?"}</strong>
          </div>
          <div className="obligation-chips">
            {agentRun.obligationCodes.map((code) => (
              <span key={code}>{code}</span>
            ))}
          </div>
          {scheduled.length > 0 && (
            <p className="summary-note">
              Hlídat v čase: {scheduled.map((item) => item.povinnost).join(", ")}
            </p>
          )}
        </section>
      )}

      <div className="messages">
        {paper ? (
          paper.messages.map((message, index) => (
            <p key={index} className={`msg ${message.role}`}>
              {message.text}
            </p>
          ))
        ) : (
          <p className="empty">Vyberte nebo vytvořte papír, ke kterému se chcete poradit.</p>
        )}
      </div>

      {paper && (
        <div className="quick-actions">
          {QUICK_ACTIONS.map(([label, prompt]) => (
            <button key={label} onClick={() => assist(prompt)}>
              {label}
            </button>
          ))}
        </div>
      )}

      <form className="chat-form" onSubmit={onSubmit}>
        <input
          name="question"
          placeholder={paper ? "Zeptejte se agenta na tento papír…" : "Nejdřív otevřete papír"}
          disabled={!paper}
        />
        <button disabled={!paper}>Odeslat</button>
      </form>
    </aside>
  );
}
