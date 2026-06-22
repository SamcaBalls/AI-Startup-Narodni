import { useCallback, useReducer } from "react";
import { dataset } from "./dataset.js";
import { createInitialState, getSelectedPaper, reducer } from "./state.js";
import { createModelProvider } from "./model-provider.mjs";
import PaperRail from "./components/PaperRail.jsx";
import PaperEditor from "./components/PaperEditor.jsx";
import AgentRail from "./components/AgentRail.jsx";
import SettingsModal from "./components/SettingsModal.jsx";

export default function App() {
  const [state, dispatch] = useReducer(reducer, dataset, createInitialState);
  const selectedPaper = getSelectedPaper(state);

  const assist = useCallback(
    async (question) => {
      const text = String(question ?? "").trim();
      const paperId = state.selectedPaperId;
      const paper = state.papers.find((item) => item.id === paperId);
      if (!text || !paper) return;

      dispatch({ type: "PUSH_MESSAGE", paperId, message: { role: "user", text } });

      const provider = createModelProvider({ mode: state.providerMode });
      const reply = await provider.assist({
        question: text,
        document: paper,
        company: state.company.profile,
        agentRun: state.agentRun,
        baselineRun: state.baselineRun,
      });
      dispatch({
        type: "PUSH_MESSAGE",
        paperId,
        message: { role: "agent", text: reply.answer },
      });
    },
    [state],
  );

  return (
    <>
      <PaperRail state={state} dispatch={dispatch} />

      <main className="center">
        <div className="center-inner">
          {selectedPaper ? (
            <PaperEditor paper={selectedPaper} dispatch={dispatch} />
          ) : (
            <div className="doc-empty">
              <p>Žádný otevřený papír.</p>
              <button onClick={() => dispatch({ type: "NEW_PAPER" })}>Vytvořit papír</button>
            </div>
          )}
        </div>
      </main>

      <AgentRail state={state} paper={selectedPaper} dispatch={dispatch} assist={assist} />

      {state.settingsOpen && (
        <SettingsModal
          company={state.company}
          profile={state.company.profile}
          dispatch={dispatch}
        />
      )}
    </>
  );
}
