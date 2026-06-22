export function createDemoPaperEdit({ question, document, company, intent, agentRun }) {
  if (!isDemoFillRequest(question) || !document) return null;

  const title = normalize(document.title);
  const facts = companyFacts(company, intent, agentRun);

  if (title.includes("spolecenska smlouva")) {
    return {
      body: buildFoundingContract(facts),
      answer:
        "Hotovo. Doplnil jsem společenskou smlouvu z profilu firmy, ARES sandboxu a compliance plánu. Zkontroluj hlavně jednatele, společníky a vklady; je to podklad ke schválení člověkem, ne závazná právní rada.",
    };
  }

  if (title.includes("ohlaseni zivnosti")) {
    return {
      body: buildTradeNotification(facts),
      answer:
        "Hotovo. Doplnil jsem ohlášení živnosti podle profilu firmy a klasifikace živnosti. Před odesláním ještě potvrď provozovnu a kontaktní údaje.",
    };
  }

  if (title.includes("prihlaska k registraci k dph")) {
    return {
      body: buildVatRegistration(facts),
      answer:
        "Hotovo. Doplnil jsem přihlášku k DPH podle odhadu obratu a compliance plánu. Část DIČ zůstává jako údaj po přidělení správcem daně.",
    };
  }

  return null;
}

function isDemoFillRequest(question) {
  const text = normalize(question);
  return text.includes("ares") || text.includes("vypln") || text.includes("dopln");
}

function companyFacts(company = {}, intent = {}, agentRun = {}) {
  return {
    name: value(company.nazev, intent.nazev ?? "Zamer 2 s.r.o."),
    address: value(company.sidlo, intent.sidlo?.adresa ?? "Hlavni 181, Brno"),
    subject: value(company.predmet, intent.predmet ?? "Provoz e-shopu"),
    turnover: Number(value(company.predpokladany_obrat_rok, intent.predpokladany_obrat_rok ?? 4_460_716)),
    employees: Number(value(company.plan_zamestnancu, intent.plan_zamestnancu ?? 2)),
    hasBranch: Boolean(value(company.provozovna, intent.provozovna)),
    branchAddress: intent.provozovna?.adresa ?? "bez samostatné provozovny",
    partners: formatPartners(intent.spolecnici),
    tradeType: tradeType(agentRun.obligationCodes),
    obligations: agentRun.obligationCodes ?? [],
  };
}

function buildFoundingContract(facts) {
  return [
    "SPOLEČENSKÁ SMLOUVA O ZALOŽENÍ SPOLEČNOSTI S RUČENÍM OMEZENÝM",
    "",
    `1. Obchodní firma: ${facts.name}`,
    `2. Sídlo: ${facts.address}`,
    `3. Předmět podnikání: ${facts.subject}`,
    `4. Společníci a jejich vklady: ${facts.partners}; základní vklad každého společníka 1 000 Kč (demo návrh).`,
    "5. Výše základního kapitálu: 10 000 Kč",
    "6. Jednatel: Adam Svoboda, datum narození 12. 3. 1990, bytem Praha (demo údaj k ověření).",
    "",
    "Agent doplnil návrh z veřejně známých údajů a sandbox profilu firmy.",
    `Navazující compliance plán: ${facts.obligations.join(", ")}.`,
    "",
    "Pracovní návrh ke kontrole člověkem.",
  ].join("\n");
}

function buildTradeNotification(facts) {
  return [
    "OHLÁŠENÍ ŽIVNOSTI",
    "",
    `Podnikatel: ${facts.name}`,
    `Sídlo: ${facts.address}`,
    `Předmět podnikání: ${facts.subject}`,
    `Druh živnosti: ${facts.tradeType}`,
    `Místo podnikání / provozovna: ${facts.hasBranch ? facts.branchAddress : "bez samostatné provozovny"}`,
    `Plán zaměstnanců: ${facts.employees}`,
    "",
    "Pracovní návrh ke kontrole člověkem.",
  ].join("\n");
}

function buildVatRegistration(facts) {
  return [
    "PŘIHLÁŠKA K REGISTRACI K DANI Z PŘIDANÉ HODNOTY",
    "",
    `Plátce: ${facts.name}`,
    "DIČ: bude doplněno po přidělení správcem daně",
    `Důvod registrace: předpokládaný roční obrat ${formatCzk(facts.turnover)} a průběžné hlídání DPH podle compliance plánu.`,
    `Předpokládaný roční obrat: ${formatCzk(facts.turnover)}`,
    `Kontaktní adresa: ${facts.address}`,
    "",
    "Pracovní návrh ke kontrole člověkem.",
  ].join("\n");
}

function formatPartners(partners = []) {
  if (!partners.length) return "společníci budou doplněni po kontrole";

  return partners
    .map((partner) => {
      if (partner.typ === "PO") return `${partner.nazev}, IČO ${partner.ico}`;
      return `fyzická osoba, státní příslušnost ${partner.statni_prislusnost ?? "CZ"}`;
    })
    .join("; ");
}

function tradeType(codes = []) {
  if (codes.includes("ZIVNOST_KONCESE")) return "koncesovaná živnost";
  if (codes.includes("ZIVNOST_VAZANA")) return "vázaná živnost";
  return "volná živnost";
}

function formatCzk(value) {
  return `${new Intl.NumberFormat("cs-CZ").format(value)} Kč`;
}

function value(field, fallback) {
  if (field && typeof field === "object" && "value" in field) return field.value;
  return field ?? fallback;
}

function normalize(valueToNormalize = "") {
  return String(valueToNormalize)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
