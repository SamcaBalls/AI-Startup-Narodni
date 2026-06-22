# Shrnutí chatu

## Kontext

Řešili jsme datový balíček `drive-download-20260622T080903Z-3-001.zip` a otázku, na který problém z hackathon zadání máme nejlepší oporu v datech. Součástí konverzace byl také text `message (3).txt`, který vyjmenovával možné směry rozšíření agenta pro veřejnou správu.

## Nejlepší problém podle dostupných dat

Nejlepší datovou oporu má problém:

**Proaktivní hlídač povinností pro nově zakládanou s.r.o.**

Tedy agent, který:

- přečte záměr firmy,
- dohledá dostupné údaje v registrech,
- odvodí skryté a odložené povinnosti,
- naplánuje hlídání povinností v čase,
- minimalizuje zbytečné otázky na zakladatele.

## Proč právě tento problém

Datový balíček je přímo postavený na scénáři založení firmy a hlídání povinností. Obsahuje:

- `zamery_firem.json` - 40 záměrů firem,
- `registr_ares.json` - syntetický ARES registr,
- `klasifikace_zivnosti.json` - typy živností podle předmětu podnikání,
- `katalog_povinnosti.json` - katalog povinností,
- `ukazkove_pripady.json` - označené ukázkové případy,
- `tools.py` - rozhraní pro agenta,
- `bodovac.py` - jednoduchý hodnoticí skript.

V datech jsou explicitně zachyceny faktory, ze kterých lze povinnosti odvozovat:

- předmět podnikání,
- sídlo,
- společníci,
- očekávaný obrat,
- plán zaměstnanců,
- provozovna,
- typ živnosti,
- dohledání přes registr.

## Důležitá čísla z dat

V balíčku je:

- 40 záměrů firem,
- 12 typů povinností,
- 12 položek klasifikace živností,
- 24 záznamů v syntetickém ARES registru.

Z analyzovaných záměrů:

- 18/40 firem má očekávaný obrat nad modelovým prahem pro DPH,
- 19/40 firem plánuje zaměstnance,
- 15/40 firem má provozovnu,
- 16/40 firem má regulovanou živnost, tedy vázanou nebo koncesovanou,
- 18/40 firem má společníka firmu, což podporuje dohledávání přes ARES.

## Slabší směry podle dat

Slabší datovou oporu mají:

- OCR a vytěžování dokumentů,
- přístupnost a digitální propast,
- obecná komunikace s úřady,
- bezpečnost a oprávnění jako hlavní datově měřený problém.

Bezpečnost a oprávnění dávají smysl jako silná část prezentace a etického/business obhájení, ale samotný balíček je primárně neměří.

## Doporučený model pro agenta

Doporučený open-weight lokálně běžitelný model:

**Qwen3**

Konkrétně:

- nejlepší lokální volba: `Qwen3-30B-A3B-Instruct-2507`,
- praktická hackathon/laptop volba: `qwen3:8b` přes Ollama,
- slabší stroj: `qwen3:4b`,
- silnější stroj: `qwen3:14b` nebo `qwen3:30b`.

Qwen3 byl doporučen hlavně kvůli:

- dobrému tool calling / agentickému chování,
- práci se strukturovaným JSON výstupem,
- vícejazyčnosti,
- lokálnímu běhu přes Ollama, llama.cpp nebo LM Studio,
- Apache 2.0 licenci u open-weight modelů.

## Doporučená architektura agenta

Agent by neměl fungovat jako čisté „LLM rozhoduje právo“. Lepší architektura:

1. Qwen3 jako plánovač a koordinátor.
2. Volání nástrojů typu `get_intent`, `lookup_registry`, `lookup_legislation`, `schedule`.
3. Deterministická pravidla v Pythonu pro samotné povinnosti.
4. LLM jako vysvětlovač, který popíše, proč povinnost vznikla.
5. Zakladatele se ptát jen tehdy, když informaci nejde dohledat.

Tím řešení lépe odpovídá metrikám balíčku:

- méně propásnutých povinností,
- méně zbytečně přidaných povinností,
- nižší zátěž zakladatele.

## Qwen3:30b - nároky

Pro `qwen3:30b` v Ollama:

- místo na disku: přibližně 19 GB,
- praktické minimum RAM: 32 GB,
- pohodlnější RAM: 64 GB,
- rozumné minimum pro GPU běh: přibližně 24 GB VRAM,
- s 16 GB VRAM bude model typicky offloadovat do RAM a bude pomalejší.

Poznámka: 19 GB je velikost kvantovaných vah modelu. Při běhu je potřeba další paměť na KV cache, která roste s délkou kontextu.

## Praktické doporučení

Pro hackathon a rychlý vývoj je nejrozumnější začít s:

```bash
ollama run qwen3:8b
```

Pokud je k dispozici silnější stroj s dostatkem RAM/VRAM:

```bash
ollama run qwen3:30b
```

Nejlepší produktová pozice řešení:

**Lokálně běžící agent pro založení s.r.o., který nad registry a pravidly proaktivně hlídá povinnosti v čase a snižuje zátěž zakladatele.**
