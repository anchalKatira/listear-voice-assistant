# ListEar — Voice Command Shopping Assistant

A voice-controlled shopping list with smart suggestions. Static site, zero backend, zero build step — open `index.html` or deploy the folder as-is.


# Try it

- Tap the mic and say things like:
  - "I need milk" / "add 3 bananas" / "buy toothpaste"
  - "remove bread"
  - "find toothpaste under $5"
- Or type the same phrases in the text box — the app runs the exact same parser either way, so it's fully testable without a working mic.

# Scope & approach

The original brief covers a lot (multilingual NLP, ML recommendations, cloud deployment) — more than fits in an honest 8-hour build. I scoped deliberately rather than stub every bullet point:

| Feature | What's implemented | What's mocked / cut, and why |
|---|---|---|
| Voice input | Real: browser `SpeechRecognition` API | — |
| NLP / flexible phrasing | Real: a regex-based parser handles several natural phrasings ("add X", "I need X", "I want to buy X", quantities like "2 bottles of water") | Full NLP/LLM understanding — cut to stay in scope; documented as the clear next step |
| Multilingual | Not implemented this pass | Needs either a paid translation API or per-language keyword sets; scoped out to keep the 8hr budget realistic — flagged, not silently skipped |
| Product suggestions | Real logic: an item you've added 2+ times but isn't currently on the list triggers a "running low" suggestion, using a localStorage-backed history | Real historical purchase data — mocked with local session history since there's no backend/user accounts |
| Seasonal suggestions | Real logic: a static month→produce lookup table drives an in-season suggestion | A live seasonal/produce API — mocked table, swappable later |
| Substitutes | Real logic: a substitution map triggers a suggestion when you add an item that has known alternatives (e.g. milk → almond/oat milk) | — |
| Categorization | Real: keyword-to-category lookup, grouped list view | A trained classifier — a lookup table is sufficient at this scale |
| Quantity | Real: parses digits and number words ("2", "two", "a couple of") | — |
| Voice search + price filter | Real: parses "find X under $Y" against a small mock product catalog (12 SKUs, multiple brands/prices) | A real product API — mocked catalog since no backend is in scope |
| Loading state | Real: mic pulses while listening; a short processing indicator runs between transcript and result, mirroring the latency a live NLP/API call would have | — |
| Hosting | Static site on GitHub Pages / Vercel free tier | AWS/Firebase — static hosting is the right fit for a no-backend app |

## Architecture

- `index.html` — structure only
- `style.css` — all styling (grocery-fresh minimal theme, mobile-first)
- `app.js` — everything else: command parsing, list state (persisted to `localStorage`), suggestion engine, mock catalog search, and the Web Speech API wiring

No frameworks, no dependencies, no `npm install` — this was a deliberate choice to keep the review surface small and the deploy step trivial.

## Known limitations

- English only, and phrasing has to roughly match the parser's patterns (see table above).
- Web Speech API works best in Chrome; the text input is a full-parity fallback for other browsers.
- Purchase history and the product catalog are mocked locally rather than backed by a real database — the data shapes are designed so swapping in a real API later is a small change, not a rewrite.


