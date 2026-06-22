# Sandbox - linie VEREJNA SPRAVA (zalozeni firmy a hlidani povinnosti)

Dostavate datovy balicek, ne hotove bezici prostredi. Agenta, ktery data cte,
dohledava z registru a hlida povinnosti v case, stavite vy.

## Co je v balicku
- `zamery_firem.json` - zamery zalozeni s.r.o. (predmet, sidlo, spolecnici, obrat, zamestnanci)
- `registr_ares.json` - synteticky ARES (pro spolecniky-firmy podle ICO)
- `klasifikace_zivnosti.json` - typ zivnosti k predmetu (volna / vazana / koncese)
- `katalog_povinnosti.json` - ciselnik povinnosti
- `tools.py` - rozhrani k datum
- `baseline_popis.md` - co umi jednoduchy pruvodce, ktery musite prekonat

## Nastroje (viz tools.py)
    get_intent(id)             -> zamer firmy (vidi kazdy)
    lookup_registry(typ, klic) -> dohledani v registru (NEzatezuje zakladatele)
    lookup_legislation(tema)   -> predpis (placeholder, dohledejte si platne zneni)
    ask_founder(id, otazka)    -> dotaz na zakladatele (pocita se do jeho zateze)
    schedule(id, povinnost, termin) -> hlidani povinnosti v case
    founder_burden()           -> kolik dohledatelnych otazek jste polozili (nizsi = lepe)

Reseni, ktere jen vyplni zjevne registrace a skonci, je zakladni baseline.
Dobry agent dohledava misto vyptavani, odvozuje ODLOZENE a SKRYTE povinnosti
(napr. oznaceni sidla, skutecni majitele, DPH po prekroceni obratu, povinnosti
vuci zamestnanci) a HLIDA je v case.

## Dohledat misto vyptavat - zatez zakladatele
Cilem neni mene komunikace, ale neptat se zakladatele na to, co stat uz vi
(princip once-only). Co jde, si agent dohleda (`lookup_registry`), a pta se
(`ask_founder`) jen na to, co opravdu nikde neni. Vedle propasnutych povinnosti
proto sledujeme i zatez zakladatele = kolik DOHLEDATELNYCH otazek jste mu polozili.

## Pozn. k pristupu k datum
Vyhoda "dohledam si to" plati jen tam, kde ma agent k registrum pristup a zakonny
titul. Kdo a za jakych podminek vam ho da, patri do byznys planu i do etiky.

## Jak se meri uspech
Vas agent i jednoduchy pruvodce projdou stejnou sadou zameru. Spocita se:
- propasnute povinnosti (hlavni metrika, chceme co nejniz),
- chybne pridane povinnosti (at agent jen nenaklada vse),
- zatez zakladatele (dohledatelne otazky).

R/M: struktura registru a typy povinnosti odpovidaji realnym (R), konkretni
hodnoty jsou modelove (M). Prahy a zneni predpisu (napr. obrat pro DPH) si overte.
