import test from "node:test";
import assert from "node:assert/strict";
import { createModelProvider } from "../src/model-provider.mjs";

test("createModelProvider returns a deterministic mock explainer by default", async () => {
  const provider = createModelProvider();
  const explanation = await provider.explain({
    question: "Proc DPH?",
    obligation: { code: "DPH", title: "Registrace k DPH", reason: "Odhad obratu prekrocil prah." },
    company: { nazev: { value: "Zamer 2 s.r.o." } },
  });

  assert.equal(provider.mode, "mock");
  assert.match(explanation.answer, /Registrace k DPH/);
  assert.match(explanation.answer, /Zamer 2 s\.r\.o\./);
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
