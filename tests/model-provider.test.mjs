import test from "node:test";
import assert from "node:assert/strict";
import { createModelProvider } from "../src/model-provider.mjs";

test("createModelProvider returns a deterministic mock explainer by default", async () => {
  const provider = createModelProvider();
  const explanation = await provider.explain({
    question: "Proc DPH?",
    obligation: {
      code: "DPH",
      title: "Registrace k DPH",
      reason: "Odhad obratu prekrocil prah.",
      legalEvidence: [{ actNumber: "235/2004 Sb.", actName: "Zakon o dani z pridane hodnoty" }],
    },
    company: { nazev: { value: "Zamer 2 s.r.o." } },
  });

  assert.equal(provider.mode, "mock");
  assert.match(explanation.answer, /Registrace k DPH/);
  assert.match(explanation.answer, /Zamer 2 s\.r\.o\./);
  assert.match(explanation.answer, /235\/2004 Sb\./);
  assert.equal(explanation.source, "fallback-template");
});

test("ollama provider posts a compact prompt and falls back when the model is unreachable", async () => {
  const calls = [];
  const provider = createModelProvider({
    mode: "ollama",
    endpoint: "http://localhost:11434",
    model: "qwen3:14b",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      throw new Error("connection refused");
    },
  });

  const explanation = await provider.explain({
    question: "Co baseline minula?",
    obligation: { code: "SIDLO_OZNACENI", title: "Oznaceni sidla", reason: "Sidlo musi byt oznacene." },
    company: { nazev: { value: "Zamer 1 s.r.o." } },
  });

  assert.equal(provider.mode, "ollama");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://localhost:11434/api/generate");
  assert.match(calls[0].options.body, /qwen3:14b/);
  assert.match(explanation.answer, /Oznaceni sidla/);
  assert.equal(explanation.source, "fallback-template");
});

test("mock provider assist references the document, company, and agent plan in a template answer", async () => {
  const provider = createModelProvider();
  const result = await provider.assist({
    question: "Dopln z ARES",
    document: { title: "Spolecenska smlouva", body: "Sidlo: [doplnit]" },
    company: { nazev: { value: "Zamer 2 s.r.o." }, sidlo: { value: "Hlavni 181, Brno" } },
    agentRun: { obligationCodes: ["OR_ZAPIS", "DPH"], metrics: { missedObligations: 0, extraObligations: 0 } },
  });

  assert.equal(provider.mode, "mock");
  assert.match(result.answer, /Spolecenska smlouva/);
  assert.match(result.answer, /Zamer 2 s\.r\.o\./);
  assert.match(result.answer, /OR_ZAPIS, DPH/);
  assert.equal(result.source, "fallback-template");
});

test("ollama provider assist posts the assist prompt and falls back when unreachable", async () => {
  const calls = [];
  const provider = createModelProvider({
    mode: "ollama",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      throw new Error("connection refused");
    },
  });

  const result = await provider.assist({
    question: "Zkontroluj dokument",
    document: { title: "Ohlaseni zivnosti", body: "Predmet: [doplnit]" },
    company: { nazev: { value: "Zamer 2 s.r.o." } },
    agentRun: { obligationCodes: ["ZIVNOST_VOLNA"], metrics: { missedObligations: 0, extraObligations: 0 } },
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].options.body, /Ohlaseni zivnosti/);
  assert.match(calls[0].options.body, /ZIVNOST_VOLNA/);
  assert.match(result.answer, /Ohlaseni zivnosti/);
  assert.equal(result.source, "fallback-template");
});

test("ollama provider extracts JSON answers from Qwen thinking wrappers", async () => {
  const provider = createModelProvider({
    mode: "ollama",
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          response: '<think>checking rules</think>\n```json\n{"answer":"DPH se bude hlidat v case."}\n```',
        };
      },
    }),
  });

  const explanation = await provider.explain({
    question: "Proc DPH?",
    obligation: { code: "DPH", title: "Registrace k DPH", reason: "Odhad obratu prekrocil prah." },
    company: { nazev: { value: "Zamer 2 s.r.o." } },
  });

  assert.equal(explanation.answer, "DPH se bude hlidat v case.");
  assert.equal(explanation.source, "ollama");
  assert.equal(explanation.model, "qwen3:14b");
});

test("ollama provider auto-detects an installed Qwen3 model when the default tag is missing", async () => {
  const calls = [];
  const provider = createModelProvider({
    mode: "ollama",
    endpoint: "http://localhost:11434",
    model: "qwen3:14b",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });

      if (url.endsWith("/api/tags")) {
        return {
          ok: true,
          async json() {
            return {
              models: [
                {
                  name: "qwen3-local:latest",
                  details: { family: "qwen3", parameter_size: "14.8B" },
                },
              ],
            };
          },
        };
      }

      const body = JSON.parse(options.body);
      if (body.model === "qwen3:14b") {
        return { ok: false, status: 404 };
      }

      return {
        ok: true,
        async json() {
          return { response: '{"answer":"Autodetected model works."}' };
        },
      };
    },
  });

  const explanation = await provider.explain({
    question: "Proc DPH?",
    obligation: { code: "DPH", title: "Registrace k DPH", reason: "Odhad obratu prekrocil prah." },
    company: { nazev: { value: "Zamer 2 s.r.o." } },
  });

  assert.equal(explanation.answer, "Autodetected model works.");
  assert.equal(explanation.source, "ollama");
  assert.equal(explanation.model, "qwen3-local:latest");
  assert.deepEqual(
    calls.filter((call) => call.url.endsWith("/api/generate")).map((call) => JSON.parse(call.options.body).model),
    ["qwen3:14b", "qwen3-local:latest"],
  );
});
