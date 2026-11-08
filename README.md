# MadBot

Self-contained desktop control room. Alerts, chat, goals, commands, Hue and Govee lights, voice, and OBS overlays all run on this PC. Nothing is loaded from the website.

The window icon, taskbar icon, and installer icon are the Dog Kennel logo.

## Windows

Download `MadBot.exe` from the latest release and double-click it. Leave it open while you stream.

In OBS, add a Browser source:

- `http://127.0.0.1:4721/alert.html`
- `http://127.0.0.1:4721/chat.html`
- `http://127.0.0.1:4721/goal.html`
- `http://127.0.0.1:4721/events.html`

## From source

```powershell
npm install
npm start
npm run dist
```
