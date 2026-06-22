# -*- coding: utf-8 -*-
"""Bodovac na ukazkovych oznacenych pripadech (linie VEREJNA SPRAVA).
Porovna VAS seznam povinnosti s baseline na techto par pripadech.
Pouziti:
    from bodovac import vyhodnot
    moje = {"FIRMA-0001": ["OR_ZAPIS","DPPO","DATOVKA","ZIVNOST_VOLNA","SIDLO_OZNACENI"], ...}
    vyhodnot(moje)
"""
import json, os
_D = os.path.dirname(__file__)
with open(os.path.join(_D, "ukazkove_pripady.json"), encoding="utf-8") as f:
    PRIPADY = {p["id"]: p for p in json.load(f)}

def _skore(volba):
    propasnute = zbytecne = 0
    for fid, p in PRIPADY.items():
        spravne = set(p["spravne_povinnosti"]); moje = set(volba.get(fid, []))
        propasnute += len(spravne - moje)   # FN: povinnost, kterou jste vynechali
        zbytecne   += len(moje - spravne)   # FP: povinnost navic, ktera neplati
    return propasnute, zbytecne

def vyhodnot(moje_volby):
    bp, bz = _skore({fid: p["baseline_povinnosti"] for fid, p in PRIPADY.items()})
    mp, mz = _skore(moje_volby)
    print("Pripadu:", len(PRIPADY))
    print(f"Baseline:     propasnute={bp}, zbytecne navic={bz}")
    print(f"Vase reseni:  propasnute={mp}, zbytecne navic={mz}")
    print(f"Lepsi o: propasnute {bp-mp}, zbytecne {bz-mz}")
    return {"baseline": (bp, bz), "vase": (mp, mz)}
