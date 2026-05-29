# 🧸 Kids Room - Interactive Learning Space

Welcome to the **Kids Room**, a premium, interactive client-side learning application for children. It offers educational modules for studying the Alphabet (A-Z), counting Numbers (1-10), tracing letters on a digital handwriting canvas, and singing nursery Hindi rhymes.

The application has been rebuilt with a dynamic curriculum database loader, a bulletproof Speech Synthesis (TTS) engine, three customizable theme styles (including E-Ink support), tiered game difficulty menus, and built-in system diagnostics.

---

## 🚀 Quick Start

Because the application fetches its curriculum configuration dynamically from an external JSON file, browsers require a local web server (to avoid CORS restrictions associated with the `file://` protocol).

### Running Locally
To launch the application, open your terminal, navigate to the project directory, and start a local HTTP server using any of the following standard utilities:

**Using Node.js (npx):**
```bash
npx http-server .
```

**Using Python:**
```bash
python3 -m http.server 8000
```

Once running, open the local URL (e.g. `http://localhost:8080` or `http://localhost:8000`) in your web browser.

---

## 📁 File Structure

The project has a modular, dependency-free structure:
```
/kids
├── index.html        # App structural layout, responsive viewport, and modals
├── style.css         # Custom typography, glassmorphism design variables, and themes
├── app.js            # App routing, Speech Engine, Canvas Tracing, and Game logic
└── data.json         # Modifiable curriculum database configuration
```

---

## 🛠️ Key Systems & Architectural Design

### 1. Dynamic Curriculum Config Database (`data.json`)
All content is loaded dynamically from [data.json](file:///Users/apple/data/LIFE_LIBRARY/kids/data.json). You can modify, translate, or expand characters, emojis, numeric limits, or lyrics directly in the JSON file without changing any HTML or JavaScript source code.

### 2. Bulletproof Speech Engine (`app.js`)
To resolve Web Speech API crashes, voice stutters, and browser-specific lockups:
- **250ms Transition Settle Delay**: Interrupted speech cancels the current queue and schedules a 250ms settle delay before launching the subsequent speak command, preventing event queue deadlocks in Chromium-based browsers.
- **Chrome Garbage Collection Bug Workaround**: UTTERANCE objects are stored in a global array (`window._speechUtterances`) to prevent them from being garbage-collected mid-speech (a bug that stops callbacks from firing).
- **Watchdog Fallback**: Automatically invokes fallback speech terminations after 7 seconds if the native browser engine fails to fire completion callbacks.
- **Heuristic Voice Matching**: Scans loaded synthesis voices for local, high-fidelity actors (e.g. `Google हिन्दी`, `Lekha`, or `Rishi` for Hindi; and `Google US English` or `Samantha` for English).
- **Offline voice retries**: Catches cloud connection errors and automatically drops back to browser-default local voices.

### 3. Tiered Quiz Difficulty Menus
Alphabet and Numbers games contain tab menus allowing children to customize the difficulty:
- **🟢 Easy Mode**: Flashcard identification (tap the matching letter or number character).
- **🟡 Medium Mode**: Count objects or associate vocabulary words with their corresponding emojis.
- **🔴 Hard Mode**:
  - **Alphabet Spelling**: Children must select the correct spelling for an emoji. Distractors are generated dynamically (swapped adjacent characters, letter duplication, or omitted letters).
  - **Math Addition**: Displays basic arithmetic problems (e.g. `2 + 1 = 3`) and renders interactive emoji count groups visually, allowing the child to count the items to find the answer.

### 4. Interactive Tracing Canvas Board
- Selecting **Trace** on any alphabet card opens a handwriting canvas modal overlay.
- Renders a large, high-contrast, faint outline guide of the letter.
- Automatically handles both touchscreen events and mouse-drags to draw custom trace lines.
- Triggers congratulations audio, toast notifications, and confetti cascades upon completion.

### 5. Lyrics-Synced Rhymes Theater
- Visualizes classic Hindi nursery rhymes (मछली, चंदा मामा, तितली, घोड़ा) in an animated CSS layout.
- Animates character movements (swimming fish, rising moon, floating clouds, rocking horse). Animation speeds dynamically adjust during vocal playback.
- Highlights individual lines of lyrics in real-time, syncing native Hindi scripts, English transliterations (Romanized), and literal English meanings.
- Supports dual language playback (Native Hindi voice vs. Romanized English voice).

### 6. Built-in Hardware Diagnostics
If you do not hear speech, open the **Diagnostics** panel from the settings panel or the utility toolbar:
- Runs live audits of the browser’s `AudioContext` and Web Speech engine capabilities.
- Lists all currently available hardware voices.
- Provides text testing modules and Web Audio pop triggers to verify audio channels.
- Lists troubleshooting commands to resolve macOS-specific Speech Daemon freeze issues.

---

## 🎨 Visual Design Aesthetics & Styling

Styled entirely with custom vanilla CSS (`style.css`):
- **Typography**: Uses modern `Fredoka` and `Outfit` fonts from Google Fonts for a premium, child-friendly appearance.
- **Aesthetic Themes**:
  1. ☀️ **Light Theme**: Soft warm pastels (`#fcf8f2`), dark borders, and playful sky gradients.
  2. 🌙 **Dark Theme**: Glassmorphic dark violet neon backdrops (`#0f0c1b`) with high-contrast text.
  3. 📖 **Ink Theme (e-Paper)**: Dashed minimalist black-and-white layouts, ideal for e-Ink screens or distraction-free learning.
- **Visual Micro-animations**: Confetti bursts, bouncy card indicators, floating cloud backdrops, sliding toast popups, and hover transformations.
- **iOS Silence Mode Banner**: Warns Safari/iPadOS users if their physical hardware silent switch is toggled, which blocks HTML5 speech synthesis.

---

## 🔧 macOS Sound Troubleshooting

On macOS, the system's text-to-speech service daemon can sometimes lock up. If the diagnostics dashboard shows that speech is available but you only hear Web Audio pops (drum sounds) instead of spoken words, copy and paste this command into your Mac's **Terminal** application to restart the speech service:

```bash
killall SpeechSynthesisServer com.apple.speech.speechsynthesisd
```
