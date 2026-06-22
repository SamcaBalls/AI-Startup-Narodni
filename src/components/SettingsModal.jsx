import { useEffect } from "react";
import SettingsView from "./SettingsView.jsx";

export default function SettingsModal({ profile, dispatch }) {
  const close = () => dispatch({ type: "CLOSE_SETTINGS" });

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="modal-scrim"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="modal-panel" role="dialog" aria-modal="true" aria-label="Nastavení firmy">
        <div className="modal-head">
          <h2>Nastavení firmy</h2>
          <button className="modal-close" aria-label="Zavřít" onClick={close}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <p className="modal-intro">
            Údaje, které firma uvádí o sobě. Agent z nich vychází při doplňování papírů.
          </p>
          <SettingsView profile={profile} dispatch={dispatch} />
        </div>
      </div>
    </div>
  );
}
