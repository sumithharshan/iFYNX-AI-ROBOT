# Mini Buddy

A local desk companion with animated expressions and Qwen3 4B chat. No cloud API keys, npm dependencies, microphone access, or remote fonts. The first version supports text and expressions; voice and physical hardware are not implemented.

## Open

### First setup after cloning

1. Install Node.js 22 or newer.
2. Download `ollama-windows-amd64.zip` from the [official Ollama releases](https://github.com/ollama/ollama/releases). The prototype was tested with v0.34.2.
3. Create a `runtime` folder in this project and extract the archive into it. Confirm that `runtime/ollama.exe` exists and keep its bundled library folders alongside it.
4. Double-click **Start Buddy.cmd**. Keep an internet connection for the first model download (about 2.5 GB).

This repository contains application source only. Ollama binaries, model weights, logs, and personal command storage are not included. No `npm install` is required because the app uses Node.js built-ins.

Double-click **Start Buddy.cmd**. It starts the portable Ollama runtime and Buddy, then opens http://127.0.0.1:3210. Requires Node.js 22+ (already available on this laptop). The first model download is about 2.5 GB; later chats work offline.

Click Buddy to pet it, try an expression, or type a message. Enter sends; Shift+Enter adds a line. Stop cancels a pending reply. Failed messages remain in the input. New chat clears model conversation history. Refreshing closes the in-memory conversation; no chats are written to disk.

## Runtime

The runtime and model live under `runtime/` (ignored by Git). This project is inside OneDrive; that folder may sync depending on your OneDrive settings. Both servers listen only on loopback. Ollama cloud features are disabled by the launcher. The model has no filesystem, shell, internet, or device tools. Expressions use a fixed allowlist. GPU use depends on driver support; CPU fallback is supported. Sinhala/Singlish quality and latency vary.

Services continue in the background when the tab closes. Ollama unloads the model after 10 idle minutes. Restarting Windows stops the processes; use the launcher next time. Logs in `runtime/` help diagnose startup errors.

## Verify

`npm run check` checks JS syntax. `npm test` checks input validation, expression validation, cross-origin protection, and static file boundaries. The app uses plain HTML/CSS/JS and Node built-ins; no build or type compilation is required.

## Personal commands
Type dance, wave, sleep, love, angry, sad, jump, or wake up to react instantly. Singlish aliases include natanna, nida ganna, adarei, and paninna. Teach Buddy a command lets you save up to 30 exact phrases with a reaction and reply; saved phrases override built-ins. Commands stay in this browser's local storage. They trigger only allowlisted on-screen animations, never shell or device commands. AI chat can also select these reactions from natural-language requests.


Natural-language chat returns a reply, facial expression and up to three ordered animations. Try 'Wave hello, then dance' or 'Look left and right'. Movement playback is bounded and can be interrupted with Stop movement, another command, or a new chat. Replies also appear above the robot. Supported extra movements include nod, shake, look_left, look_right and spin. These are on-screen animations only.

