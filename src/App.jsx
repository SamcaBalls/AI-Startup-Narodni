import { useCallback, useReducer, useState } from "react";
import { dataset } from "./dataset.js";
import { DEMO_PAPER_EDIT_DELAY_MS, createDemoPaperEdit } from "./demo-paper-edits.mjs";
import { createInitialState, getSelectedPaper, reducer } from "./state.js";
import { createModelProvider } from "./model-provider.mjs";
import PaperRail from "./components/PaperRail.jsx";
import PaperEditor from "./components/PaperEditor.jsx";
import AgentRail from "./components/AgentRail.jsx";
import SettingsModal from "./components/SettingsModal.jsx";

export default function App() {
  const [state, dispatch] = useReducer(reducer, dataset, createInitialState);
  const [agentWorking, setAgentWorking] = useState(false);
  const selectedPaper = getSelectedPaper(state);

  const assist = useCallback(
    async (question) => {
      const text = String(question ?? "").trim();
      const paperId = state.selectedPaperId;
      const paper = state.papers.find((item) => item.id === paperId);
      if (!text || !paper || agentWorking) return;

      dispatch({ type: "PUSH_MESSAGE", paperId, message: { role: "user", text } });
      setAgentWorking(true);

      try {
        const intent = state.runtimeDataset.intents.find((item) => item.id === state.company.id);
        const demoEdit = createDemoPaperEdit({
          question: text,
          document: paper,
          company: state.company.profile,
          intent,
          agentRun: state.agentRun,
        });

        if (demoEdit) {
          await sleep(DEMO_PAPER_EDIT_DELAY_MS);
          dispatch({ type: "EDIT_BODY", id: paperId, body: demoEdit.body });
          dispatch({
            type: "PUSH_MESSAGE",
            paperId,
            message: { role: "agent", text: demoEdit.answer },
          });
          return;
        }

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
      } finally {
        setAgentWorking(false);
      }
    },
    [agentWorking, state],
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

      <AgentRail
        state={state}
        paper={selectedPaper}
        dispatch={dispatch}
        assist={assist}
        agentWorking={agentWorking}
      />

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

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
