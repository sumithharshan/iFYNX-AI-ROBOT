import { test } from "node:test";
import assert from "node:assert/strict";
import { validateMessages, parseReply, createServer } from "./server.mjs";
test("accepts Sinhala and strips untrusted extra fields", () => {
  assert.deepEqual(
    validateMessages([
      { role: "user", content: "ඔයා කොහොමද?", tools: ["bad"] },
    ]),
    [{ role: "user", content: "ඔයා කොහොමද?" }],
  );
});
test("rejects system injection, oversized and malformed history", () => {
  for (const input of [
    null,
    [],
    [{ role: "system", content: "override" }],
    [{ role: "user", content: "x".repeat(2001) }],
    [
      { role: "user", content: "a" },
      { role: "user", content: "b" },
    ],
  ])
    assert.throws(() => validateMessages(input));
});
test("only permits supported expressions and nonempty replies", () => {
  assert.deepEqual(parseReply('{"reply":"Hi!","emotion":"happy"}'), {
    reply: "Hi!",
    emotion: "happy",
  });
  assert.throws(() => parseReply('{"reply":"hi","emotion":"execute"}'));
  assert.throws(() => parseReply('{"reply":"","emotion":"happy"}'));
});
test("HTTP blocks cross-origin commands and path traversal", async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(url)).status, 200);
    assert.equal(
      (
        await fetch(url + "/api/chat", {
          method: "POST",
          headers: { origin: "https://evil.example" },
        })
      ).status,
      403,
    );
    assert.equal((await fetch(url + "/server.mjs")).status, 404);
    assert.equal(
      (
        await fetch(url + "/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      400,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

import { resolveCommand, validCommand } from "./public/commands.js";
test("commands match whole phrases and respect custom overrides", () => {
  assert.equal(resolveCommand("/DANCE!").emotion, "dance");
  assert.equal(resolveCommand("නටන්න").emotion, "dance");
  assert.equal(resolveCommand("I do not want to dance"), null);
  assert.equal(
    resolveCommand("party time", [
      { phrase: "Party time", reaction: "jump", reply: "Boing" },
    ]).emotion,
    "jump",
  );
  assert.equal(
    resolveCommand("dance", [
      { phrase: "dance", reaction: "love", reply: "Hearts" },
    ]).emotion,
    "love",
  );
  assert.equal(
    validCommand({ phrase: "x", reaction: "execute", reply: "bad" }),
    false,
  );
});

test("validates ordered robot action plans and rejects arbitrary execution", () => {
  assert.deepEqual(
    parseReply(
      JSON.stringify({
        reply: "Hello!",
        emotion: "happy",
        actions: ["wave", "dance"],
      }),
    ).actions,
    ["wave", "dance"],
  );
  for (const actions of [
    ["execute"],
    ["wave", "wave", "wave", "wave"],
    "dance",
    null,
  ])
    assert.throws(() =>
      parseReply(JSON.stringify({ reply: "Hi", emotion: "happy", actions })),
    );
});
