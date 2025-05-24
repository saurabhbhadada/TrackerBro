# TrackerBro 🏋️‍♂️🤖📈

**TrackerBro** is a lightweight web app that lets you chat naturally with an AI training partner while it quietly logs every PR, workout, and habit you mention.
Whenever you need insight, TrackerBro feeds the stored data back to the AI (Cerebras Qwen-3 32B via **OpenRouter**) and instantly generates interactive charts.

<p align="center">
  <img src="docs/demo-chat.gif" width="40%">
  <img src="docs/demo-analytics.gif" width="55%">
</p>

---

## ✨ Features

| Area            | Capability |
|-----------------|------------|
| **Conversational logger** | • Friendly chat powered by Qwen-3.<br>• Background JSON extraction of any structured info: exercise PRs (weight × reps × sets), nutrition, water, sleep, mindfulness minutes, etc.<br>• All logs stored locally in **IndexedDB** (`broDB.logs`). |
| **Analytics**   | • Ask plain-English questions like “compare squat and deadlift PRs” or “show water intake trend”.<br>• Habit cards: tap a card to auto-plot its history.<br>• Charts are generated on the fly—AI returns JavaScript/Chart.js code that runs in a secure sandbox. |
| **Tech stack**  | Vite + React 18 • Chart.js 4 • idb • Axios • OpenRouter API. |

---

## 🌐 Live demo (optional)

Deploy the static build (e.g. Vercel/Netlify/Firebase Hosting) and add an **OpenRouter** key—everything runs client-side.

---

## 🛠 Local setup

```bash
# clone & install
pnpm i            # or npm / yarn

# add your OpenRouter key
echo "VITE_OPENROUTER_API_KEY=sk-..." > .env.local

# dev server
pnpm dev

# production build
pnpm build && pnpm preview
