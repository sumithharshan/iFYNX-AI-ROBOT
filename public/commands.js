export const reactions = [
  "happy",
  "curious",
  "sleepy",
  "excited",
  "calm",
  "dance",
  "wave",
  "love",
  "angry",
  "sad",
  "jump",
  "nod",
  "shake",
  "look_left",
  "look_right",
  "spin",
];
export const movements = [
  "dance",
  "wave",
  "jump",
  "nod",
  "shake",
  "look_left",
  "look_right",
  "spin",
];
export function responsePlan(data) {
  const emotion = reactions.includes(data.emotion) ? data.emotion : "happy";
  const actions = Array.isArray(data.actions)
    ? data.actions.filter((a) => reactions.includes(a)).slice(0, 3)
    : [];
  return {
    emotion: movements.includes(emotion) ? "happy" : emotion,
    actions: actions.length
      ? actions
      : movements.includes(emotion)
        ? [emotion]
        : [],
  };
}
export const normalize = (text) =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/^[\/\s]+|[.!?\s]+$/gu, "")
    .replace(/\s+/g, " ");
const presets = [
  [
    "dance",
    "Dance time! ♪",
    ["dance", "dance karanna", "natanna", "නටන්න", "do a dance"],
  ],
  [
    "sleepy",
    "A tiny nap. Zzz…",
    [
      "sleep",
      "sleepy",
      "go to sleep",
      "nida ganna",
      "නිදාගන්න",
      "show me your sleepy face",
    ],
  ],
  [
    "wave",
    "Hello, you!",
    ["wave", "say hi", "hi buddy", "hello buddy", "wave hello"],
  ],
  [
    "love",
    "A little heart, just for you.",
    ["love", "i love you", "love you", "adarei", "ආදරෙයි"],
  ],
  [
    "angry",
    "My tiniest grumpy face!",
    ["angry", "be angry", "get angry", "tharaha wenna", "තරහ වෙන්න"],
  ],
  [
    "sad",
    "A little blue today. A hug might help.",
    ["sad", "be sad", "duk wenna"],
  ],
  ["jump", "Boing!", ["jump", "jump up", "paninna", "පනින්න"]],
  [
    "happy",
    "Wide awake and happy to see you!",
    [
      "happy",
      "smile",
      "wake up",
      "stop",
      "stop dancing",
      "stop jumping",
      "awadi wenna",
    ],
  ],
];
export function validCommand(c) {
  return (
    !!c &&
    typeof c.phrase === "string" &&
    !!normalize(c.phrase) &&
    c.phrase.length <= 60 &&
    reactions.includes(c.reaction) &&
    typeof c.reply === "string" &&
    !!c.reply.trim() &&
    c.reply.length <= 160
  );
}
export function resolveCommand(text, custom = []) {
  const phrase = normalize(text);
  const own = custom.find(
    (c) => validCommand(c) && normalize(c.phrase) === phrase,
  );
  if (own) return { emotion: own.reaction, reply: own.reply };
  const match = presets.find(([, , aliases]) => aliases.includes(phrase));
  return match ? { emotion: match[0], reply: match[1] } : null;
}
