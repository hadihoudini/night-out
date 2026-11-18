# Night Out

**Practise in the game. Protect on the night.**

Built at HudHackHer 2026 (theme: HerFuture).

Women are given plenty of warnings about nights out (spiking, harassment, being followed, unsafe taxis), but nobody gets to *practise* what to do. Night Out lets UK students rehearse the worst night safely in a pixel-art game. Afterwards, the same phone from the game becomes a real toolkit for the night.

## Play

- **Game:** `index.html`, with 4 scenes: unwanted attention, separated from a friend, drink spiking, getting home.
- **Real night mode:** `real.html`. Share where you are, check your booked taxi's plate, quick-dial 999/101/111, find safe places, and send your plan and home-by time to your group chat.

Open either file in Chrome or Edge, or use the GitHub Pages link. No install, no account, no server.

Pitch shortcut: add a scene name to the URL to jump straight to it, e.g. `index.html#bar2` (Dean), `index.html#spike1` (spiking) or `index.html#home1` (getting home).

## What makes it different

- **You feel it:** a "through Jess's eyes" scene blurs, wobbles and muffles the screen; a 12-second countdown with a heartbeat when you're followed; screen shake and vibration when you choose badly.
- **You do it:** a phone slides up mid-game, and you slide to call 999, compare a taxi plate with your booking, and share your location.
- **Escape Call, in the game and for real:** fake a call from Mum to get away from someone at the bar, with a real voice when you answer. In Real night mode your own phone rings the same way, with a ringtone, vibration and a spoken voice.
- **Then it's real:** the same phone screens work for real in Real night mode.
- **Music reacts to danger:** chiptune is generated live in the browser and gets faster and fuller as safety drops. Optional real tracks can be dropped into `music/`.
- **Private by design:** no accounts, no server, nothing leaves the phone. Works offline once it's been opened.

## Accuracy

All advice is UK-specific: 999 / 101 / NHS 111, pressing 55 on a silent 999 call from a mobile, Ask for Angela, licensed and booked taxis only, reporting spiking quickly so police can arrange a test, the Rape Crisis 24/7 Support Line (0808 500 2222) and sexual assault referral centres. It's never the victim's fault, and the game says so on every ending.

## Tech

Plain HTML, CSS and JavaScript: no frameworks, no build step. Canvas pixel art drawn live, a Web Audio music engine, a service worker for offline use, and localStorage for the toolkit.
