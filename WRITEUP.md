## Approach (200 words)

I treated 8 hours as a real constraint and scoped down rather than shipping a shallow version of everything. The app is static and backend-free (`index.html` / `style.css` / `app.js`), needing zero infrastructure and deploying to GitHub Pages in minutes.

For voice input I used the browser's Web Speech API, paired with a regex-based parser handling natural phrasings ("add milk", "I need milk", "I want to buy milk") plus quantity extraction ("2 bottles of water"). A text input runs through the same parser, so the app is fully testable without a mic — also my main debugging tool.

Suggestions are real logic, not hardcoded: a "running low" prompt fires when an item was added twice before (via localStorage history) but isn't currently listed; seasonal picks come from a month-keyed table; substitutes fire from a static map on relevant adds. Voice search supports price filtering ("find toothpaste under $5") against a mock catalog.

I skipped multilingual support and a trained NLP model — both achievable, but would have consumed the whole budget. Both are called out in the README as scoped-out, with reasoning and next steps.
