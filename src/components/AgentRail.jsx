const QUICK_ACTIONS = [
  ["Vyplnit z ARES", "Doplň prosím do dokumentu údaje z veřejně známých rejstříků (ARES)."],
  ["Zkontrolovat", "Zkontroluj tento dokument a upozorni na chybějící nebo sporné body."],
  ["Poradit", "Poraď mi, na co u tohoto dokumentu nezapomenout."],
];

export default function AgentRail({ state, paper, dispatch, assist }) {
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
