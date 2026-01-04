# Metronome

A cross-platform metronome for musicians. It runs in any modern browser on iOS, Android, and desktop, and can be installed as a lightweight offline-capable app (PWA).

## Features
- Accurate Web Audio click engine with accented downbeats
- Tempo control via slider, numeric entry, and tap tempo
- Time-signature aware beat lights for visual practice
- Volume control for both accented and regular clicks
- Offline-first: install to your home screen or dock for a native-like feel

## Getting started
1. Serve the app locally (required for audio unlock and service workers):
   ```sh
   python -m http.server 4173
   ```
2. Open your browser to [http://localhost:4173](http://localhost:4173).
3. Press **Start** to unlock audio and begin playback.
4. Adjust tempo, beats per measure, and volume as you practice.

## Install as an app
- **iOS / Android:** open the site in Safari or Chrome, then use “Add to Home Screen” / “Install app.”
- **Desktop:** in Chromium-based browsers, click the install icon in the address bar; in Safari, use “Add to Dock.”

## Notes
- Audio contexts must be started from a user gesture. Use the **Start** or **Tap tempo** buttons to initialize audio on first load.
- The service worker caches core assets so you can use the metronome offline after the first load.
