# MadBot

Self-contained desktop control room. Alerts, chat, goals, commands, Hue and Govee lights, voice, and OBS overlays all run on this PC. Nothing is loaded from the website.

The window icon, taskbar icon, and installer icon are the Dog Kennel logo.

## Windows

Download `MadBot.exe` from the latest release and double-click it. Open **Shorts** to cut a VOD into vertical clips. The first time, click **Set up cutter** and leave the window open. Then pick a video or paste a Kick link and click **Make shorts**. Files land in your Videos folder, in `MadBot Shorts`.

Press **Ctrl+K** anywhere to search pages and fire actions (test alerts, clip, flash lights, show BRB). **Ctrl+1** to **Ctrl+0** jump between pages.

In OBS, add a Browser source. The **Overlays** page shows a live preview of each one and copies the URL for you.

| Overlay | URL | Size |
| --- | --- | --- |
| Alert box | `http://127.0.0.1:4721/alert.html` | 1920 × 1080 |
| Chat | `http://127.0.0.1:4721/chat.html` | 600 × 800 |
| Goal bar | `http://127.0.0.1:4721/goal.html` | 800 × 200 |
| Recent events | `http://127.0.0.1:4721/events.html` | 500 × 600 |
| Ticker | `http://127.0.0.1:4721/ticker.html` | 1920 × 80 |
| Scene (Starting, BRB, Ending) | `http://127.0.0.1:4721/scene.html` | 1920 × 1080 |

Overlay colors, chat size, chat fade-out, and the alert sound are set on the **Overlays** page. Overlays reconnect on their own if the app restarts.

Fonts in `assets/fonts` (Anton, Space Grotesk, JetBrains Mono) are under the SIL Open Font License.

## From source

```powershell
npm install
npm start
npm run dist
```
