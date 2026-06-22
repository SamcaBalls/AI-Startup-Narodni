export default function PaperRail({ state, dispatch }) {
  const companyName = state.company.profile.nazev?.value ?? state.company.id;

  return (
    <aside className="rail-left">
      <div className="wordmark">
        <span className="mark">FG</span>
        <span>
          <b>FirmGuard</b>
          <small>Sandbox AIO 2026</small>
        </span>
      </div>

      <button className="rail-newbtn" onClick={() => dispatch({ type: "NEW_PAPER" })}>
        <span aria-hidden="true">+</span> Nový papír
      </button>

      <p className="rail-label">Papíry</p>

      <nav className="paper-list" aria-label="Papíry">
        {state.papers.map((paper) => (
          <div
            key={paper.id}
            className={`paper-item ${paper.id === state.selectedPaperId ? "is-selected" : ""}`}
          >
            <button
              className="paper-open"
              onClick={() => dispatch({ type: "SELECT_PAPER", id: paper.id })}
            >
              {paper.title || "Bez názvu"}
            </button>
            <button
              className="paper-del"
              aria-label={`Smazat ${paper.title}`}
              onClick={() => dispatch({ type: "DELETE_PAPER", id: paper.id })}
            >
              ×
            </button>
          </div>
        ))}
        {state.papers.length === 0 && <p className="rail-label">Zatím žádné papíry.</p>}
      </nav>

      <div className="rail-footer">
        <p className="company-name">{companyName}</p>
        <button className="rail-settings" onClick={() => dispatch({ type: "OPEN_SETTINGS" })}>
          <span aria-hidden="true">⚙</span> Nastavení firmy
        </button>
      </div>
    </aside>
  );
}
