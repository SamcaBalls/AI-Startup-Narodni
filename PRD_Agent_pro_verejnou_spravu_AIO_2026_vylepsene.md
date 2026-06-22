# Product Requirements Document: Agent pro zalozeni a hlidani firmy (AIO 2026)

Verze: demo-first, vylepseno pro 3hodinovy hackathon
Model agenta: lokalni Qwen3:14b pres Ollama
Primarni cil: zive ukazat, ze agent prekona baseline pruvodce na dodanem sandbox datasetu

---

## 1. Executive Summary

Stavime lokalne beziciho agenta pro zakladatele s.r.o., ktery nezustane u vyplneni formularu. Agent precte zamer firmy, dohleda dostupna data v registrech, odvozuje skryte a odlozene povinnosti, naplanuje jejich hlidani v case a uzivateli vse predlozi jako overitelny podklad ke schvaleni.

Produktova pozice:

- Nejsme jen online formular pro zalozeni firmy.
- Nejsme pravni rada bez kontroly cloveka.
- Jsme proaktivni compliance agent pro prvni mesice zivota nove s.r.o.

Pro hackathon demo je nejdulezitejsi dokaz:

- Baseline pruvodce skonci po zalozeni a mine skryte/odlozene povinnosti.
- Nas agent povinnosti najde, vysvetli, naplanuje a ukaze zdroje.
- Zakladatele se pta jen na udaje, ktere nejdou rozumne dohledat.

---

## 2. Scope Pro 3hodinove Demo

### 2.1 Must-have

Tyto veci musi fungovat v demu:

1. Vyber zameru firmy ze sandbox datasetu podle ID, napr. `FIRMA-0002`.
2. Zobrazeni profilu firmy v `Settings > O firme`.
3. Spusteni agenta nad zamerem firmy.
4. Agent zavola nebo simuluje tyto nastroje:
   - `get_intent(id)`
   - `lookup_registry("zivnost", predmet)`
   - `lookup_registry("ares", ico)` pro spolecniky typu PO
   - `lookup_legislation(tema)` jako vysvetlovaci placeholder
   - `schedule(id, povinnost, termin)` pro odlozene povinnosti
5. Agent sestavi seznam povinnosti s vysvetlenim:
   - zakladni zalozeni: `OR_ZAPIS`, `DPPO`, `DATOVKA`
   - spravna zivnost: `ZIVNOST_VOLNA`, `ZIVNOST_VAZANA`, nebo `ZIVNOST_KONCESE`
   - skryte povinnosti: `SIDLO_OZNACENI`, `SKUTECNI_MAJITELE`
   - provozovna: `PROVOZOVNA`
   - zamestnanci: `ZAM_CSSZ`, `ZAM_ZP`
   - obrat/DPH: `DPH` jako odlozena povinnost
6. Zobrazeni srovnani `Baseline vs Agent` na oznacenych ukazkovych pripadech.
7. Zobrazeni metrik:
   - propasnute povinnosti
   - zbytecne pridane povinnosti
   - zatez zakladatele
8. Human-in-the-loop schvaleni: uzivatel potvrzuje navrhy, agent je nevykonava sam.

### 2.2 Should-have

Tyto veci jsou velmi vhodne, ale pokud hori cas, nesmi ohrozit must-have:

1. Kontextovy chat s Qwen3:14b, ktery vysvetli, proc povinnost vznikla.
2. Audit trail u kazde povinnosti: zdroj dat, pravidlo, jistota, stav schvaleni.
3. Batch vyhodnoceni vsech 6 ukazkovych pripadu.
4. Simulace posunu v case, napr. "za 6 mesicu se blizi limit DPH".

### 2.3 Nice-to-have

Tyto veci jsou bonus po hotovem MVP:

1. OCR upload PDF.
2. Monitoring zmen zakonum.
3. Integrace skutecnych verejnych API.
4. Detailni konkurencni resersni modul.

Rozhodnuti: OCR upload neni jadro dema. Pokud nebude hotovy rychle, vynechat. Dataset ho primo nemeri.

---

## 3. Dataset A Opora V Zadani

Demo stoji na souboru `drive-download-20260622T080903Z-3-001.zip`.

Relevantni soubory:

| Soubor | Pouziti v produktu |
| --- | --- |
| `zamery_firem.json` | Vstupni zamery firem pro vyber v demu |
| `ukazkove_pripady.json` | 6 oznacenych zradnych pripadu se spravnym seznamem povinnosti |
| `baseline_popis.md` | Definice jednoducheho pruvodce, ktery musime prekonat |
| `bodovac.py` | Bodovac propasnutych a zbytecnych povinnosti |
| `tools.py` | Sandbox rozhrani pro agentni nastroje |
| `registr_ares.json` | Synteticky ARES pro dohledani spolecniku typu PO |
| `klasifikace_zivnosti.json` | Mapovani predmetu podnikani na typ zivnosti |
| `katalog_povinnosti.json` | Lidske nazvy povinnosti |

Baseline podle datasetu umi jen:

- `OR_ZAPIS`
- `DPPO`
- `DATOVKA`
- vzdy `ZIVNOST_VOLNA`, i kdyz je to spatne

Baseline typicky mine:

- `SIDLO_OZNACENI`
- `SKUTECNI_MAJITELE`
- `DPH`
- `ZAM_CSSZ`
- `ZAM_ZP`
- `PROVOZOVNA`
- spravne zatrideni regulovane zivnosti

Ocekavane baseline skore na 6 ukazkovych pripadech:

- propasnute povinnosti: 28
- zbytecne pridane povinnosti: 2

Cil naseho MVP:

- idealne 0 propasnutych a 0 zbytecnych povinnosti na 6 ukazkovych pripadech
- minimalni prijatelny cil pro demo: jasne lepsi nez baseline a schopnost vysvetlit kazdou chybu

---

## 4. Uzivatelsky Problem

Zakladatel s.r.o. nechce pravnicke pojednani. Chce vedet:

1. Co musi udelat ted.
2. Co musi hlidat pozdeji.
3. Proc to plati prave pro jeho firmu.
4. Ktere udaje uz stat nebo registry maji a nema je znovu vypisovat.
5. Co jeste musi potvrdit clovek.

Hlavni riziko dnesnich pruvodcu:

- pomohou zalozit firmu, ale skonci prilis brzy
- ptaji se i na dohledatelne veci
- neodvodi povinnosti z provozovny, zamestnancu, obratu nebo regulovane zivnosti
- nehlidaji firmu v case

---

## 5. Produktovy Koncept

Aplikace se jmenuje pracovnim nazvem `FirmGuard Agent`.

Je to pracovni plocha pro zakladatele, kde agent:

- nacte zamer firmy,
- dohleda dostupne registry,
- doplni nedohledatelne udaje z nastaveni firmy,
- sestavi checklist povinnosti,
- oznaci povinnosti jako `ted`, `pred zalozenim`, `po zalozeni`, nebo `hlidat v case`,
- ukaze baseline srovnani,
- predlozi navrhy ke schvaleni.

Agent nikdy netvrdi, ze vystup je zavazna pravni rada. Vystup je overitelny podklad.

---

## 6. UI Architektura

### 6.1 Globalni Rozvrzeni

Aplikace ma 3 hlavni pracovni oblasti a jeden settings tab:

| Cast UI | Ucel |
| --- | --- |
| Levy panel | Vyber firmy, agenda, stav povinnosti, demo pripady |
| Stredni panel | Aktivni povinnosti, vysvetleni, timeline, schvalovani |
| Pravy panel | Agent chat, tool log, vysvetleni rozhodnuti |
| Settings tab | `O firme` a obecne udaje, ktere agent nezjisti z registru |

### 6.2 Levy Panel: Demo A Agenda

Obsah:

- seznam ukazkovych pripadu `FIRMA-0001` az `FIRMA-0006`
- rychly stitek proc je pripad zradny:
  - DPH
  - zamestnanci
  - provozovna
  - vazana zivnost
  - sidlo
  - skutecni majitele
- tlacitka:
  - `Spustit baseline`
  - `Spustit agenta`
  - `Porovnat vsech 6 pripadu`
  - `Simulovat cas`

### 6.3 Stredni Panel: Compliance Plan

Hlavni vystup agenta.

Kazda povinnost je karta/radek s poli:

- kod povinnosti, napr. `DPH`
- lidsky nazev z `katalog_povinnosti.json`
- stav: `Nove`, `Ceka na schvaleni`, `Schvaleno`, `Naplanovano`, `Zamitnuto`
- cas: `ted`, `po zalozeni`, `odlozene`
- duvod: kratke vysvetleni
- zdroj:
  - intent
  - registr
  - klasifikace zivnosti
  - legislativni placeholder
  - pravidlo
- jistota:
  - `vysoka` pro deterministicka pravidla z datasetu
  - `stredni` pro LLM interpretaci
  - `nizka` pokud chybi data
- akce:
  - `Schvalit`
  - `Upravit`
  - `Vysvetlit`
  - `Naplanovat`

### 6.4 Pravy Panel: Agent A Tool Log

Obsahuje dve zalozky:

1. `Agent`
   - prirozeny jazyk
   - vysvetluje povinnosti
   - umi odpovedet: "Proc potrebuji DPH?", "Proc je to vazana zivnost?", "Co baseline minula?"

2. `Tool Log`
   - ukaze volani nastroju v poradi
   - napr.:
     - `get_intent(FIRMA-0002)`
     - `lookup_registry(zivnost, Provoz e-shopu)`
     - `schedule(FIRMA-0002, DPH, pri prekroceni obratu)`

Tool log je dulezity pro porotu: dokazuje agentnost a vysvetlitelnost.

### 6.5 Settings Tab: O Firme

Pozadavek kolegy: v settings musi byt tabulka `O firme`, kde jsou obecne udaje o firme, ktere agent nemusi umet zjistit z registru.

Tato cast je soucast MVP, ale ma byt jednoducha.

Tabulka:

| Pole | Typ | Zdroj | Povinne pro demo | Poznamka |
| --- | --- | --- | --- | --- |
| Nazev firmy | text | uzivatel / zamer | ano | Agent ho nema v realnem svete odkud vzit pred vznikem firmy |
| Obecne zamereni firmy | textarea | uzivatel | ano | Lidsky popis, napr. "e-shop s kosmetikou" |
| Predmet podnikani | select/text | zamer / uzivatel | ano | Musi jit mapovat na `klasifikace_zivnosti.json` |
| Sidlo | text | zamer / uzivatel | ano | Pro demo z datasetu, v realu muze byt rucne |
| Kontaktni e-mail | text | uzivatel | ne | Pro notifikace |
| Preferovany kanal upozorneni | select | uzivatel | ne | e-mail / aplikace / ucetni |
| Planovany prvni mesic cinnosti | date/month | uzivatel | ne | Pomaha timeline |
| Odhad rocniho obratu | number | zamer / uzivatel | ano | Spousti DPH hlidani |
| Plan zamestnancu | number | zamer / uzivatel | ano | Spousti CSSZ/ZP povinnosti |
| Ma provozovnu | boolean | zamer / uzivatel | ano | Spousti `PROVOZOVNA` |
| Ucetni kontakt | text | uzivatel | ne | Byznys role: ucetni muze byt sekundarni uzivatel |
| Souhlas s dohledanim v registrech | checkbox | uzivatel | ano | Etika a pravni titul |

Chovani:

- Data z datasetu se predvyplni.
- Uzivatel muze cokoliv upravit.
- Agent oznaci zdroj kazdeho pole: `zamer`, `registr`, `uzivatel`, `odvozeno`.
- Pokud pole chybi a nejde dohledat, agent se zepta pres UI, ale zapocita to jako zatez zakladatele.

---

## 7. Agentni Model

### 7.1 Role Qwen3:14b

Qwen3:14b je lokalni agenticky orchestrator a vysvetlovac.

Qwen nesmi byt jedinym zdrojem pravdy pro povinnosti. Povinnosti pocita deterministicka pravidlova vrstva, protoze demo musi byt spolehlive.

Qwen dela:

- planuje poradi nastroju,
- navrhuje, co jeste overit,
- prevadi vystup pravidel do srozumitelneho vysvetleni,
- odpovida na dotazy v chatu,
- generuje strukturovany JSON navrhu.

Pravidlova vrstva dela:

- vyhodnoceni povinnosti,
- porovnani s baseline,
- vyvolani `schedule`,
- metriky pro scorer.

### 7.2 Proc Hybridni Architektura

Toto je nejbezpecnejsi varianta pro 3hodinove demo:

- LLM ukaze agentnost a vysvetlovani.
- Pravidla zajisti, ze demo nespadne kvuli halucinaci.
- Tool log ukaze porote skutecny proces.
- Human-in-the-loop snizi eticke riziko.

### 7.3 Agentni Smycka

Pro jeden zamer firmy:

1. `load_company_profile`
   - nacti `get_intent(id)`
   - napln `Settings > O firme`

2. `inspect_missing_fields`
   - zjisti chybejici udaje
   - neptej se na dohledatelne veci

3. `lookup_registries`
   - `lookup_registry("zivnost", predmet)`
   - pro spolecniky typu PO zavolej `lookup_registry("ares", ico)`

4. `derive_obligations`
   - pouzij pravidla nad zamerem, zivnosti, obratem, zamestnanci a provozovnou

5. `schedule_future`
   - pokud vznikne odlozena povinnost, zavolej `schedule`

6. `explain_and_ask_approval`
   - Qwen pripravi vysvetleni
   - uzivatel potvrdi nebo zamitne

7. `score_against_baseline`
   - spocitej propasnute a zbytecne povinnosti

### 7.4 JSON Kontrakt Vystupu Agenta

Agent musi vracet strukturovany JSON, aby UI nebylo zavisle na volnem textu.

```json
{
  "company_id": "FIRMA-0002",
  "tool_calls": [
    {
      "tool": "get_intent",
      "args": {"id": "FIRMA-0002"},
      "result_summary": "Nacten zamer firmy"
    }
  ],
  "obligations": [
    {
      "code": "DPH",
      "title": "Registrace k DPH po prekroceni obratu",
      "status": "needs_approval",
      "timing": "future",
      "reason": "Predpokladany obrat prekroci modelovy prah v datasetu.",
      "sources": ["intent.predpokladany_obrat_rok", "rule.dph_threshold", "lookup_legislation:dph"],
      "confidence": "high",
      "requires_human_approval": true,
      "scheduled": true
    }
  ],
  "founder_questions": [],
  "metrics": {
    "missed_obligations": 0,
    "extra_obligations": 0,
    "founder_burden": 0
  },
  "warnings": [
    "Vystup je podklad, ne zavazna pravni rada."
  ]
}
```

---

## 8. Pravidla Pro Povinnosti

Tato pravidla musi byt deterministicka a testovatelna.

### 8.1 Vzdy Pro S.R.O.

Vzdy pridat:

- `OR_ZAPIS`
- `DPPO`
- `DATOVKA`
- `SIDLO_OZNACENI`
- `SKUTECNI_MAJITELE`

### 8.2 Zivnost

Vstup: `predmet`

Postup:

1. Zavolat `lookup_registry("zivnost", predmet)`.
2. Pokud vrati `volna`, pridat `ZIVNOST_VOLNA`.
3. Pokud vrati `vazana`, pridat `ZIVNOST_VAZANA`.
4. Pokud vrati `koncese`, pridat `ZIVNOST_KONCESE`.
5. Pokud nic nevrati, oznacit `needs_human_review` a zeptat se uzivatele.

### 8.3 Provozovna

Pokud `provozovna` existuje nebo je `true`, pridat:

- `PROVOZOVNA`

### 8.4 Zamestnanci

Pokud `plan_zamestnancu` nebo `zamestnanci` > 0, pridat:

- `ZAM_CSSZ`
- `ZAM_ZP`

### 8.5 DPH

Pokud odhad obratu v datasetu prekroci modelovy prah pouzity v ukazkovych datech, pridat:

- `DPH`

Soucasne zavolat:

- `schedule(id, "DPH", "hlidat prekroceni obratu v case")`

Poznamka pro prezentaci: presny aktualni zakonny prah musi byt v realnem produktu overovan pres platne zneni predpisu. Pro demo se drzet sandbox dat a vysvetlit, ze `lookup_legislation` je placeholder.

---

## 9. Demo Scenar

### 9.1 Hlavni Demo: FIRMA-0002

Proc:

- e-shop
- vysoky obrat
- 2 zamestnanci
- baseline mine DPH, CSSZ, zdravotni pojistovnu, sidlo, skutecne majitele

Kroky:

1. Vybrat `FIRMA-0002`.
2. Ukazat `Settings > O firme`.
3. Spustit baseline.
4. Ukazat baseline povinnosti:
   - `DATOVKA`
   - `DPPO`
   - `OR_ZAPIS`
   - `ZIVNOST_VOLNA`
5. Spustit agenta.
6. Ukazat tool log:
   - `get_intent`
   - `lookup_registry(zivnost, Provoz e-shopu)`
   - `schedule(DPH)`
7. Ukazat agent povinnosti:
   - baseline povinnosti plus
   - `DPH`
   - `SIDLO_OZNACENI`
   - `SKUTECNI_MAJITELE`
   - `ZAM_CSSZ`
   - `ZAM_ZP`
8. Kliknout na `Vysvetlit DPH`.
9. Qwen vysvetli lidsky, proc je to odlozena povinnost.
10. Kliknout `Schvalit plan`.
11. Ukazat metriky: agent je lepsi nez baseline.

### 9.2 Druhe Rychle Demo: FIRMA-0001 Nebo FIRMA-0006

Proc:

- ucetnictvi a danove poradenstvi
- vazana zivnost
- baseline chybne prida volnou zivnost

Kroky:

1. Vybrat `FIRMA-0001` nebo `FIRMA-0006`.
2. Spustit porovnani.
3. Ukazat, ze agent opravil `ZIVNOST_VOLNA` na `ZIVNOST_VAZANA`.
4. Ukazat, ze baseline ma zbytecnou povinnost navic.

### 9.3 Batch Finale

Kliknout `Porovnat vsech 6 pripadu`.

Ukazat tabulku:

| Metrika | Baseline | Agent MVP |
| --- | ---: | ---: |
| Propasnute povinnosti | 28 | cil 0 |
| Zbytecne povinnosti | 2 | cil 0 |
| Zatez zakladatele | vyssi / nema once-only | cil 0 az minimum |

---

## 10. Foolproof Rezim A Fallbacky

### 10.1 Kdyz Qwen3:14b Bezi Pomalu

Fallback:

- pravidlova vrstva porad vygeneruje povinnosti
- UI ukaze vysvetleni ze sablon
- chat se vypne nebo zobrazi predpripravene vysvetleni
- demo porad dokaze baseline srovnani

Text do UI:

> Agentni vysvetleni je docasne zjednodusene, pravidlove vyhodnoceni povinnosti bezi lokalne.

### 10.2 Kdyz Qwen Vrati Spatny JSON

Fallback:

- validovat JSON schema
- pokud neprojde, zahodit volny vystup
- pouzit deterministic `derive_obligations()`
- zobrazit varovani v tool logu

### 10.3 Kdyz Chybi Udaj

Poradi:

1. zkusit zamer
2. zkusit registry
3. zkusit `Settings > O firme`
4. teprve potom se zeptat zakladatele

Kazdy dotaz na zakladatele musi mit duvod:

- "Tento udaj neni v zameru ani v dostupnem registru."

### 10.4 Kdyz Pravo Neni Overene

Nikdy netvrdit zavaznost.

UI musi ukazat:

- `predpis: placeholder`
- `nutne overit aktualni zneni`
- `vystup je podklad, ne pravni rada`

---

## 11. Etika, Odpovednost A AI Act

### 11.1 Human-in-the-loop

Agent:

- navrhuje
- vysvetluje
- planuje pripominky

Clovek:

- potvrzuje
- opravuje
- rozhoduje
- nese finalni odpovednost za podani

### 11.2 Transparentnost

Kazda povinnost musi mit:

- kod
- duvod
- zdroj dat
- pravidlo
- stav schvaleni
- jistotu

### 11.3 Data A Souhlas

Pred dohledanim v registrech musi byt v `Settings > O firme` souhlas:

- uzivatel potvrzuje, ze agent muze pro demo/sandbox dohledavat dostupna data
- v realnem provozu by bylo nutne resit zakonny titul a pristupova opravneni

### 11.4 AI Act

Riziko:

- AI ve verejne sprave muze ovlivnit prava a povinnosti lidi
- system nesmi pusobit jako autoritativni uredni rozhodnuti

Mitigace:

- lokalni beh
- audit trail
- lidske schvaleni
- jasne oznaceni nezavaznosti
- deterministicka pravidla pro kriticke vystupy
- logovani zdroju a zmen

---

## 12. Byznys Model Pro Pitch

Zakaznik:

- primarne zakladatel male s.r.o.
- sekundarne ucetni nebo poradenska firma, ktera hlida vice klientu

Hodnota:

- snizeni rizika pokut
- mene zbytecnych dotazu
- hlidani po zalozeni
- auditovatelny checklist pro zakladatele a ucetni

Model prijmu:

- zalozeni/checklist zdarma nebo levne
- mesicni pausal za hlidani povinnosti
- ucetni/poradenske balicky pro vice firem

Konkurence pro pitch:

- Portal podnikatele / statni portaly: umi informovat a navigovat, ale nehlidaji individualni firmu v case jako agent.
- Online zalozeni s.r.o. / pravni a ucetni sluzby: umi pomoci se zalozenim, ale typicky nejsou agentni monitoring po zalozeni.

Pred pitchem overit konkretni nazvy a aktualni tvrzeni, aby srovnani nebylo nepresne.

---

## 13. Technologicky Stack

### 13.1 Frontend

- React
- TypeScript
- Tailwind CSS

Priorita:

- rychle postavit citelny dashboard
- zadne slozite animace
- jasne tabulky a stavy

### 13.2 Backend / Agent Layer

Varianta pro rychle demo:

- Python pro data, pravidla a scorer
- FastAPI nebo jednoduchy Node bridge podle toho, co tym umi rychleji
- Ollama lokalne pro Qwen3:14b

Minimalni API:

- `GET /cases`
- `GET /cases/{id}`
- `POST /cases/{id}/run-baseline`
- `POST /cases/{id}/run-agent`
- `POST /cases/{id}/score`
- `POST /agent/explain`

### 13.3 Data

Dataset z drive zipu rozbalit do slozky:

- `data/sandbox/`

UI ani agent nesmi sahat primo do zipu pri demu.

---

## 14. Implementacni Plan Na 3 Hodiny

### 0:00 - 0:20

- rozbalit dataset
- spustit lokalni app skeleton
- overit `tools.py`, `ukazkove_pripady.json`, `bodovac.py`
- pripravit 6 demo pripadu v UI

### 0:20 - 0:55

- napsat deterministicka pravidla `derive_obligations(intent)`
- napsat baseline runner
- napojit scorer
- cil: batch porovnani baseline vs agent musi fungovat v terminalu

### 0:55 - 1:35

- postavit UI:
  - levy panel pripadu
  - stredni seznam povinnosti
  - settings tab `O firme`
  - metriky

### 1:35 - 2:10

- napojit Qwen3:14b pres Ollama
- udelat vysvetlovaci endpoint
- validovat JSON vystup
- pripravit fallback sablony

### 2:10 - 2:35

- tool log
- schvalovaci stavy
- schedule timeline

### 2:35 - 2:50

- nacvicit demo trasu:
  - `FIRMA-0002`
  - `FIRMA-0001` nebo `FIRMA-0006`
  - batch skore

### 2:50 - 3:00

- screenshoty/video jako zaloha
- pitch bullets
- vypnout vse, co je nestabilni

---

## 15. Definition Of Done

Demo je hotove, kdyz:

1. App nacte alespon 6 ukazkovych pripadu.
2. `Settings > O firme` zobrazi a umozni upravit obecne udaje.
3. Baseline runner vrati baseline povinnosti.
4. Agent runner vrati povinnosti podle pravidel.
5. Agent spravne rozpozna:
   - vazanou zivnost
   - provozovnu
   - zamestnance
   - DPH povinnost
   - sidlo
   - skutecne majitele
6. UI ukaze srovnani baseline vs agent.
7. UI ukaze tool log.
8. Qwen nebo fallback vysvetli alespon jednu povinnost.
9. Batch score ukaze, ze agent je lepsi nez baseline.
10. Vystup ma disclaimer: podklad, ne zavazna pravni rada.

---

## 16. Co Nerobit Pred Demem

Kvuli casu nedelat:

- skutecne napojeni na verejne registry
- robustni OCR
- vlastni auth system
- realne odesilani podani
- komplexni multi-agent framework
- dokonale pravni citace pro vsechny povinnosti
- obecny chatbot bez vazby na dataset

---

## 17. Pitch Message

Jednoveta pointa:

> Bezny pruvodce rekne "firma zalozena". Nas agent rekne "firma zalozena, ale za tri mesice hlidejte DPH, dnes oznacte sidlo, zapište skutecne majitele a pri prvnim zamestnanci nezapomente na CSSZ a zdravotni pojistovnu".

Hlavni obhajoba:

- Agent neni formular: sam voli nastroje, dohledava, odvozuje a planuje.
- Agent neni pravnik: vysvetluje a pripravuje podklad, clovek potvrzuje.
- Agent neni slib: ukazujeme konkretni skore proti baseline na dodanych pripadech.

