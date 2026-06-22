export const DEMO_PAPER_EDIT_DELAY_MS = 1600;

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
    name: value(company.nazev, intent.nazev ?? "Vltava Market s.r.o."),
    address: value(company.sidlo, intent.sidlo?.adresa ?? "Křižíkova 148/34, 186 00 Praha 8 - Karlín"),
    subject: value(company.predmet, intent.predmet ?? "Provozování e-shopu s domácími potřebami"),
    turnover: Number(value(company.predpokladany_obrat_rok, intent.predpokladany_obrat_rok ?? 4_850_000)),
    employees: Number(value(company.plan_zamestnancu, intent.plan_zamestnancu ?? 3)),
    hasBranch: Boolean(value(company.provozovna, intent.provozovna)),
    branchAddress: intent.provozovna?.adresa ?? "bez samostatné provozovny",
    partners: formatPartners(intent.spolecnici),
    tradeType: tradeType(agentRun.obligationCodes),
    obligations: agentRun.obligationCodes ?? [],
  };
}

function buildFoundingContract(facts) {
  return [
    "SPOLEČENSKÁ SMLOUVA",
    "o založení společnosti s ručením omezeným",
    "",
    "Níže uvedení zakladatelé uzavírají podle zákona o obchodních korporacích tuto společenskou smlouvu.",
    "",
    "Článek I. Obchodní firma a sídlo",
    `1. Obchodní firma společnosti je ${trimTrailingPeriod(facts.name)}.`,
    `2. Sídlem společnosti je ${facts.address}.`,
    "",
    "Článek II. Předmět podnikání",
    `1. Předmětem podnikání společnosti je ${facts.subject}.`,
    `2. Pro účely živnostenského oprávnění agent předběžně vyhodnotil činnost jako ${facts.tradeType}.`,
    "",
    "Článek III. Společníci a vklady",
    `1. Společníky společnosti jsou: ${facts.partners}.`,
    "2. Základní kapitál společnosti činí 10 000 Kč.",
    "3. Každý společník splatí svůj peněžitý vklad před podáním návrhu na zápis společnosti do obchodního rejstříku.",
    "",
    "Článek IV. Obchodní podíly",
    "1. Každý společník vlastní obchodní podíl odpovídající poměru jeho vkladu k základnímu kapitálu.",
    "2. Převod obchodního podílu na jinou osobu vyžaduje souhlas valné hromady.",
    "",
    "Článek V. Jednatel",
    "1. Prvním jednatelem společnosti je Jan Novák, datum narození 14. 5. 1988, bytem Praha.",
    "2. Jednatel zastupuje společnost samostatně.",
    "",
    "Článek VI. Správa vkladu a vznik společnosti",
    "1. Správcem vkladů je Jan Novák.",
    "2. Společnost vzniká dnem zápisu do obchodního rejstříku.",
    "",
    "Článek VII. Navazující povinnosti",
    `1. Navazující compliance plán: ${facts.obligations.join(", ")}.`,
    "2. Před podpisem je nutné ověřit totožnost společníků, souhlas se sídlem, živnostenské oprávnění a finální znění u člověka.",
    "",
    "Tento dokument je pracovní návrh připravený pro demo. Není závaznou právní radou.",
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
      const name = partner.jmeno ?? "fyzická osoba";
      const citizenship = partner.statni_prislusnost ?? "CZ";
      const deposit = partner.vklad_kc ? `, vklad ${formatCzk(partner.vklad_kc)}` : "";
      return `${name}, státní příslušnost ${citizenship}${deposit}`;
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

function trimTrailingPeriod(valueToTrim) {
  return String(valueToTrim).replace(/\.$/, "");
}
