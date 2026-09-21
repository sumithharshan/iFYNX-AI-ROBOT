import {
  reactions,
  normalize,
  validCommand,
  resolveCommand,
  responsePlan,
  movements,
} from "./commands.js";
const $ = (id) => document.getElementById(id);
let custom = [];
try {
  const saved = JSON.parse(localStorage.getItem("buddy.commands") || "[]");
  if (Array.isArray(saved)) custom = saved.filter(validCommand).slice(0, 30);
} catch {
  /* Commands remain usable without browser storage. */
}
const history = [];
let ready = false,
  busy = false,
  request,
  idleTimer;
const labels = {
  happy: "Happy to see you",
  curious: "A little curious",
  sleepy: "Just resting my eyes…",
  excited: "Oh, this is exciting!",
  calm: "Enjoying your company",
  thinking: "Thinking about that…",
  dance: "Tiny feet, big moves!",
  wave: "Hello, my favourite human!",
  love: "A whole lot of love",
  angry: "Very small. Very grumpy.",
  sad: "Could use a little hug",
  jump: "Boing, boing!",
  nod: "Yes, yes!",
  shake: "A tiny no-no",
  look_left: "Looking left",
  look_right: "Looking right",
  spin: "A little twirl",
};
let motionTimer;
function stopMotion() {
  clearTimeout(motionTimer);
  $("robot").dataset.action = "idle";
  $("motion-stop").hidden = true;
}
function mood(value) {
  stopMotion();
  $("robot").dataset.mood = value;
  $("mood").textContent = labels[value] || labels.happy;
}
function performResponse(data, annotate = false) {
  const plan = responsePlan(data);
  mood(plan.emotion);
  $("robot-reply").textContent = data.reply;
  let index = 0;
  const next = () => {
    if (index >= plan.actions.length) {
      stopMotion();
      $("mood").textContent = labels[$("robot").dataset.mood] || labels.happy;
      return;
    }
    const action = plan.actions[index++];
    $("mood").textContent = labels[action] || action;
    $("motion-stop").hidden = false;
    if (movements.includes(action)) $("robot").dataset.action = action;
    else {
      $("robot").dataset.action = "idle";
      $("robot").dataset.mood = action;
    }
    motionTimer = setTimeout(next, action === "dance" ? 5000 : 2600);
  };
  next();
  const last = $("messages").lastElementChild;
  if (annotate && last && plan.actions.length) {
    const badge = document.createElement("span");
    badge.className = "action-tag";
    badge.textContent = plan.actions
      .map((a) => a.replaceAll("_", " "))
      .join(" → ");
    last.append(badge);
  }
}
function resetIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!busy) mood("sleepy");
  }, 90000);
}
function controls() {
  $("send").disabled = busy || !$("message").value.trim();
  $("stop").hidden = !busy;
  $("send").hidden = busy;
  $("clear").disabled = busy;
  document
    .querySelectorAll("#prompts button")
    .forEach((b) => (b.disabled = busy));
}
function addMessage(role, content) {
  $("messages").querySelector(".welcome")?.remove();
  const item = document.createElement("div");
  item.className = `bubble ${role}`;
  const name = document.createElement("span");
  name.className = "speaker";
  name.textContent = role === "user" ? "YOU" : "BUDDY";
  item.append(name, document.createTextNode(content));
  $("messages").append(item);
  item.scrollIntoView({ block: "nearest" });
  return item;
}
async function status() {
  try {
    const response = await fetch("/api/status");
    if (!response.ok) throw new Error();
    const data = await response.json();
    ready = data.ready;
    $("connection").textContent = ready
      ? "Local AI connected"
      : data.online
        ? "Model needs downloading"
        : "Local AI is offline";
  } catch {
    ready = false;
    $("connection").textContent = "Buddy server is offline";
  }
  $("connection").classList.toggle("ready", ready);
  controls();
}
async function send(text) {
  if (busy || !text.trim() || text.length > 2000) return;
  const command = resolveCommand(text, custom);
  if (command) {
    addMessage("user", text);
    addMessage("assistant", command.reply);
    performResponse(command, true);
    history.push(
      { role: "user", content: text },
      { role: "assistant", content: command.reply },
    );
    if (history.length > 14) history.splice(0, history.length - 14);
    $("message").value = "";
    $("count").textContent = "0 / 2000";
    $("error").hidden = true;
    controls();
    resetIdle();
    return;
  }
  if (!ready) {
    $("error").textContent =
      "AI chat is offline. Your saved commands and reaction buttons still work.";
    $("error").hidden = false;
    return;
  }
  busy = true;
  resetIdle();
  mood("thinking");
  $("error").hidden = true;
  $("prompts").hidden = true;
  controls();
  const bubble = addMessage("user", text);
  const started = Date.now();
  $("activity").textContent = "Buddy is thinking…";
  const timer = setInterval(() => {
    $("activity").textContent =
      `Buddy is thinking… ${Math.floor((Date.now() - started) / 1000)}s${Date.now() - started > 15000 ? " · First replies can take longer." : ""}`;
  }, 1000);
  request = new AbortController();
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [...history.slice(-14), { role: "user", content: text }],
      }),
      signal: request.signal,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Please try again.");
    history.push(
      { role: "user", content: text },
      { role: "assistant", content: data.reply },
    );
    if (history.length > 14) history.splice(0, history.length - 14);
    addMessage("assistant", data.reply);
    performResponse(data, true);
    if ($("message").value === text) $("message").value = "";
    $("count").textContent = `${$("message").value.length} / 2000`;
  } catch (error) {
    bubble.remove();
    $("error").textContent =
      error.name === "AbortError"
        ? "Stopped. Your message is kept so you can edit or retry."
        : error.message;
    $("error").hidden = false;
    mood("calm");
  } finally {
    clearInterval(timer);
    busy = false;
    request = null;
    $("activity").textContent = "";
    controls();
    resetIdle();
    $("message").focus();
  }
}
$("chat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  send($("message").value);
});
$("message").addEventListener("input", () => {
  $("count").textContent = `${$("message").value.length} / 2000`;
  controls();
  resetIdle();
});
$("message").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    send($("message").value);
  }
});
$("stop").addEventListener("click", () => request?.abort());
$("motion-stop").addEventListener("click", () => {
  mood("calm");
  $("robot-reply").textContent = "Okay, staying still for a moment.";
});
$("robot").addEventListener("click", () => {
  if (!busy) {
    performResponse({
      emotion: "love",
      reply: "A little boop makes my whole day.",
      actions: ["wave"],
    });
    resetIdle();
  }
});
document.querySelectorAll("[data-emotion]").forEach((b) =>
  b.addEventListener("click", () => {
    if (!busy) {
      performResponse({
        emotion: b.dataset.emotion,
        reply: labels[b.dataset.emotion],
      });
      resetIdle();
    }
  }),
);
document.querySelectorAll("#prompts button").forEach((b) =>
  b.addEventListener("click", () => {
    $("message").value = b.textContent;
    $("count").textContent = `${b.textContent.length} / 2000`;
    send(b.textContent);
  }),
);
$("clear").addEventListener("click", () => {
  if (busy) return;
  history.length = 0;
  $("messages").replaceChildren();
  addMessage("assistant", "A fresh start. What’s on your mind?");
  $("prompts").hidden = false;
  $("error").hidden = true;
  mood("happy");
  $("robot-reply").textContent = "Hello, human. What shall we do today?";
  $("message").focus();
  resetIdle();
});
for (const reaction of reactions) {
  const option = document.createElement("option");
  option.value = reaction;
  option.textContent = reaction;
  $("command-reaction").append(option);
}
function renderCommands() {
  $("command-list").replaceChildren();
  custom.forEach((c) => {
    const row = document.createElement("div");
    row.className = "command-row";
    const label = document.createElement("span");
    label.textContent = `“${c.phrase}” → ${c.reaction}`;
    const preview = document.createElement("button");
    preview.type = "button";
    preview.textContent = "Try";
    preview.setAttribute("aria-label", `Try ${c.phrase}`);
    preview.onclick = () => send(c.phrase);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Delete ${c.phrase}`);
    remove.onclick = () => {
      custom = custom.filter((item) => item !== c);
      saveCommands();
      renderCommands();
    };
    row.append(label, preview, remove);
    $("command-list").append(row);
  });
}
function saveCommands() {
  try {
    localStorage.setItem("buddy.commands", JSON.stringify(custom));
    $("command-status").textContent = "Saved on this browser.";
  } catch {
    $("command-status").textContent =
      "Storage unavailable. Commands work until this tab closes.";
  }
}
$("command-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const entry = {
    phrase: $("command-phrase").value.trim(),
    reaction: $("command-reaction").value,
    reply: $("command-reply").value.trim(),
  };
  if (!validCommand(entry)) {
    $("command-status").textContent =
      "Enter a phrase and a reply within the limits.";
    return;
  }
  const existing = custom.findIndex(
    (c) => normalize(c.phrase) === normalize(entry.phrase),
  );
  if (existing >= 0) custom[existing] = entry;
  else {
    if (custom.length >= 30) {
      $("command-status").textContent =
        "30 commands saved. Delete one to add another.";
      return;
    }
    custom.push(entry);
  }
  saveCommands();
  renderCommands();
  $("command-form").reset();
});
document
  .querySelectorAll("[data-command]")
  .forEach((b) => b.addEventListener("click", () => send(b.dataset.command)));
renderCommands();
status();
setInterval(status, 10000);
resetIdle();
