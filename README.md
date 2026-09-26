# 🍽️ FridgeChef — Fridge-to-Recipe AI

> **Frontend Internship Assignment** — Fridge-to-Recipe option.

A React app that takes a free-form list of ingredients, streams a structured recipe from **Google Gemini**, and renders it as a fully interactive cooking assistant.

LIVE LINK OF THIS PRIJECT : https://frontend-delta-fawn-77.vercel.app/?_vercel_share=RpWwBTp3jT0E2EWFzB0AspYjSuJAKWYH

---

## ✨ Features

| Feature | Details |
|---|---|
| **AI-powered recipe generation** | Gemini 1.5 Flash with structured JSON output |
| **Streaming** | SSE stream with live JSON preview while waiting |
| **Interactive ingredients** | Check off items as you shop / cook |
| **Serving scaler** | Scale ×0.5 → ×4 with real-time amount recalculation |
| **Ingredient swaps** | AI suggests substitutes; tap to apply them permanently |
| **Step-by-step checklist** | Tap steps to check off; progress bar tracks completion |
| **Error handling** | Malformed JSON, network failures, rate limits, empty responses — all handled gracefully with retry |
| **Dark mode** | Persisted in `localStorage`; respects system preference |
| **Mobile-first** | Responsive at all screen sizes, touch-friendly tap targets |
| **Keyboard navigation** | All interactive elements reachable via Tab/Enter/Space/Escape |

---

## 🚀 Setup

### Prerequisites
- Node.js ≥ 18
- A **Google Gemini API key** — [get one free here](https://aistudio.google.com/app/apikey)

### 1. Install dependencies

```bash
# From the project root
npm install --prefix frontend
npm install --prefix backend
```

Or use the convenience script:

```bash
npm run install:all
```

### 2. Configure the API key

```bash
cp backend/.env.example backend/.env
# Edit backend/.env and paste your key:
# GEMINI_API_KEY=AIza...
```

> **Security note:** The API key lives only in `backend/.env` and is never sent to the browser. The Vite dev server proxies `/api/*` requests to the Express backend.

### 3. Start the servers

Open **two terminals**:

```bash
# Terminal 1 — backend (port 3001)
cd backend && npm start

# Terminal 2 — frontend (port 5173)
cd frontend && npm run dev
```

Then open **http://localhost:5173**.

---

## 🏗️ Architecture

```
Assignment/
├── backend/
│   ├── server.js        # Express + Gemini SSE stream, JSON validation
│   └── .env             # GEMINI_API_KEY (never committed)
└── frontend/
    ├── src/
    │   ├── recipeApi.js          # Fetch + SSE parser + shape validator
    │   ├── useRecipe.js          # State machine hook (idle/loading/success/error)
    │   ├── App.jsx               # Root — theme, retry, state routing
    │   ├── index.css             # Full design system (tokens, dark mode, animations)
    │   └── components/
    │       ├── IngredientInput.jsx   # Textarea, example chips, char limit
    │       ├── LoadingView.jsx        # Spinner + live stream preview
    │       ├── ErrorView.jsx          # Error banner with retry
    │       ├── RecipeView.jsx         # Full interactive recipe
    │       ├── ServingScaler.jsx      # +/− scaler
    │       └── SwapPopover.jsx        # Modal ingredient swap
    └── vite.config.js   # Dev proxy to backend
```

---

## 🛡️ Handling Bad AI Output

This is the key part of the assignment. Here's exactly what the app does:

| Failure mode | How it's handled |
|---|---|
| **Malformed / partial JSON** | Server strips markdown fences; client catches `JSON.parse` errors → shows error + retry |
| **Wrong shape** (missing fields) | `validateRecipeShape()` runs on both server and client; normalises optional fields, throws on missing required ones |
| **Empty response** | Detected after stream ends; specific "empty response" error message |
| **Network failure** | `fetch` error caught → "Could not reach the server" message |
| **Slow / timeout** | 45-second client timeout; Cancel button aborts the stream immediately |
| **Stale response (race condition)** | Each request gets an `AbortController`; a new submission cancels the previous in-flight request |
| **Rate limit (429)** | Detected by HTTP status and Gemini error text → specific "rate limit" message |
| **Server crash (5xx)** | Generic "server error" message with retry |

---

## ⏱️ Time Spent

| Task | Time |
|---|---|
| Architecture planning & component design | ~45 min |
| Backend (Express, SSE streaming, Gemini, validation) | ~1.5 hr |
| `recipeApi.js` (SSE parsing, error classes, shape validator) | ~1 hr |
| `useRecipe.js` hook + race condition handling | ~30 min |
| CSS design system (tokens, dark mode, animations) | ~1.5 hr |
| React components (Input, Recipe, Scaler, Swap, Error, Loading) | ~2 hr |
| Testing failure modes manually | ~30 min |
| README | ~15 min |
| **Total** | **~8 hr** |

---

## 🤖 AI Usage Note

I used **Google Gemini (via Antigravity IDE)** throughout this project for:

- **Boilerplate scaffolding** — initial component shells and CSS token setup
- **SSE parsing logic** — the line-by-line SSE event parsing loop in `recipeApi.js`
- **Prompt engineering** — iterating the Gemini system prompt to produce consistent JSON
- **Accessibility attributes** — ARIA roles and labels for the checklist items

All architectural decisions (state machine shape, race condition prevention via AbortController, dual-layer JSON validation, SSE streaming instead of a single response) were designed by me. I understand every line of code and can explain, debug, or extend it in an interview.

---

## ⚠️ Known Limitations

- **No session persistence** — refreshing the page loses the current recipe (localStorage save would be a stretch goal)
- **Single recipe only** — no regeneration variation (a "try a different recipe" follow-up prompt would be next)
- **Gemini 1.5 Flash** — smaller local models (Ollama) are less consistent at structured output, so failure handling would matter even more
- **No optimistic UI during initial load** — skeleton card could improve perceived performance
- **Serving scaler uses preset multipliers** (0.5×, 1×, 1.5×, 2×, 3×, 4×) rather than free-form input

---

## 🗺️ What I'd Build Next (with more time)

1. **Save & reload sessions** via `localStorage`
2. **Refinement loop** — a follow-up input to tweak the recipe ("make it vegan", "reduce calories")
3. **Regenerate variation** — keep the same ingredients, get a different recipe
4. **Nutritional estimate block** — structured data block alongside the recipe
5. **Drag-to-reorder steps** — for personalised cooking flow
6. **Print/share view** — clean print stylesheet
