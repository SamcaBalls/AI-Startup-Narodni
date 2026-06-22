import { useLayoutEffect, useRef } from "react";

export default function PaperEditor({ paper, dispatch }) {
  const bodyRef = useRef(null);

  // Grow the textarea to fit its content so the page (center) scrolls, not the box.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [paper.body, paper.id]);

  return (
    <article className="doc">
      <input
        className="doc-title"
        value={paper.title}
        placeholder="Název papíru"
        onChange={(event) =>
          dispatch({ type: "RENAME_PAPER", id: paper.id, title: event.target.value })
        }
      />
      <p className="doc-meta">Dokument · ručně upravitelný</p>
      <textarea
        ref={bodyRef}
        className="doc-body"
        value={paper.body}
        placeholder="Začněte psát, nebo požádejte agenta vpravo o doplnění z veřejných dat."
        onChange={(event) =>
          dispatch({ type: "EDIT_BODY", id: paper.id, body: event.target.value })
        }
      />
    </article>
  );
}
