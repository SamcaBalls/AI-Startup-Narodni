// Shared display helpers extracted from the original app.mjs.
// JSX escapes text by itself, so escapeHtml is no longer needed.

export function statusLabel(status) {
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

export function timingLabel(timing) {
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

export function confidenceLabel(confidence) {
  return (
    {
      vysoka: "vysoká jistota",
      stredni: "střední jistota",
      nizka: "nízká jistota",
    }[confidence] ?? confidence
  );
}

export function formatMoney(value) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

export function trapTags(caseRecord) {
  const text = caseRecord?.proc_zradne ?? "";
  const tags = [];
  if (text.includes("obrat")) tags.push("DPH");
  if (text.includes("zamestnance")) tags.push("ZAM");
  if (text.includes("provozovna")) tags.push("PROV");
  if (text.includes("regulovany")) tags.push("ŽIV");
  if (text.includes("sidlo")) tags.push("SIDLO");
  if (text.includes("majitelu")) tags.push("UBO");
  return tags.slice(0, 4);
}
