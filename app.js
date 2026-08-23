/* ==========================================================
   ListEar — Voice Shopping Assistant
   Vanilla JS, no build step, no backend. All state in
   localStorage so the list and "history" survive a refresh.
   ========================================================== */

// ---------- reference data (mocked, documented as such in README) ----------

const CATEGORY_MAP = {
  milk:'Dairy', cheese:'Dairy', yogurt:'Dairy', butter:'Dairy', cream:'Dairy',
  'almond milk':'Dairy', 'oat milk':'Dairy', 'soy milk':'Dairy', eggs:'Dairy',
  apple:'Produce', apples:'Produce', banana:'Produce', bananas:'Produce',
  tomato:'Produce', tomatoes:'Produce', onion:'Produce', onions:'Produce',
  potato:'Produce', potatoes:'Produce', spinach:'Produce', orange:'Produce',
  oranges:'Produce', lettuce:'Produce', carrot:'Produce', carrots:'Produce',
  bread:'Bakery', bagel:'Bakery', bagels:'Bakery', croissant:'Bakery', bun:'Bakery', buns:'Bakery',
  chips:'Snacks', cookies:'Snacks', chocolate:'Snacks', crackers:'Snacks', nuts:'Snacks',
  water:'Beverages', juice:'Beverages', soda:'Beverages', coffee:'Beverages', tea:'Beverages',
  toothpaste:'Household', soap:'Household', detergent:'Household',
  'paper towels':'Household', 'toilet paper':'Household', shampoo:'Household'
};

const SUBSTITUTES = {
  milk: ['almond milk', 'oat milk'],
  butter: ['margarine', 'ghee'],
  sugar: ['honey', 'stevia'],
  bread: ['multigrain bread', 'gluten-free bread'],
};

// simplistic "in season this month" mock — real version would call a produce API
const SEASONAL_BY_MONTH = {
  0:['oranges','spinach'], 1:['oranges','carrots'], 2:['spinach','lettuce'],
  3:['spinach','lettuce'], 4:['tomatoes','lettuce'], 5:['tomatoes','bananas'],
  6:['tomatoes','carrots'], 7:['tomatoes','apples'], 8:['apples','carrots'],
  9:['apples','potatoes'], 10:['potatoes','oranges'], 11:['oranges','potatoes']
};

const CATALOG = [
  {name:'Organic Apples', brand:"Nature's Farm", price:4.50, category:'Produce'},
  {name:'Gala Apples', brand:'FreshCo', price:3.20, category:'Produce'},
  {name:'Toothpaste', brand:'Colgate', price:3.20, category:'Household'},
  {name:'Toothpaste Whitening', brand:'Sensodyne', price:6.50, category:'Household'},
  {name:'Toothpaste Kids', brand:'Colgate', price:2.80, category:'Household'},
  {name:'Whole Milk 1L', brand:'DairyPure', price:2.10, category:'Dairy'},
  {name:'Almond Milk 1L', brand:'Silk', price:3.60, category:'Dairy'},
  {name:'Sourdough Bread', brand:'Local Bakery', price:5.00, category:'Bakery'},
  {name:'White Bread', brand:'WonderLoaf', price:2.40, category:'Bakery'},
  {name:'Orange Juice 1L', brand:'Tropicana', price:4.00, category:'Beverages'},
  {name:'Ground Coffee 250g', brand:'Blue Mountain', price:8.90, category:'Beverages'},
];

const WORD_NUMBERS = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,
  a:1, an:1, couple:2, few:3};

// ---------- state ----------

let list = JSON.parse(localStorage.getItem('le_list') || '[]');
let history = JSON.parse(localStorage.getItem('le_history') || '{}'); // {item: timesAdded}

function saveState(){
  localStorage.setItem('le_list', JSON.stringify(list));
  localStorage.setItem('le_history', JSON.stringify(history));
}

// ---------- DOM refs ----------

const micBtn = document.getElementById('micBtn');
const voiceState = document.getElementById('voiceState');
const voiceTranscript = document.getElementById('voiceTranscript');
const loadingDots = document.getElementById('loadingDots');
const textForm = document.getElementById('textForm');
const textInput = document.getElementById('textInput');
const categoriesEl = document.getElementById('categories');
const itemCountEl = document.getElementById('itemCount');
const emptyStateEl = document.getElementById('emptyState');
const suggestionsEl = document.getElementById('suggestions');
const searchDrawer = document.getElementById('searchDrawer');
const searchResults = document.getElementById('searchResults');
const searchTitle = document.getElementById('searchTitle');

// ---------- command parsing ----------

function wordsToNumber(str){
  if(/^\d+$/.test(str)) return parseInt(str, 10);
  return WORD_NUMBERS[str] || null;
}

function extractQuantity(text){
  // matches leading "2", "two", "a couple of" etc, optionally followed by a unit word
  const m = text.match(/^(\d+|[a-z]+)\s+(?:bottles?|cans?|bags?|boxes?|packs?|of\s+)?/i);
  if(m){
    const n = wordsToNumber(m[1].toLowerCase());
    if(n){
      return { qty: n, rest: text.slice(m[0].length).trim() };
    }
  }
  return { qty: 1, rest: text };
}

function categorize(name){
  const key = name.toLowerCase().trim();
  if(CATEGORY_MAP[key]) return CATEGORY_MAP[key];
  // try singular (strip trailing s)
  if(key.endsWith('s') && CATEGORY_MAP[key.slice(0,-1)]) return CATEGORY_MAP[key.slice(0,-1)];
  return 'Other';
}

function parseCommand(raw){
  const text = raw.trim().toLowerCase().replace(/\.$/, '');

  // search intent (check before add, since "find" is distinct)
  let m = text.match(/^(?:find|search for|search|look for|show me)\s+(.+)/);
  if(m){
    return parseSearch(m[1]);
  }

  // show list intent
  if(/^(show|list) my list$|what.?s on my list/.test(text)){
    return { intent:'show' };
  }

  // remove intent
  m = text.match(/^(?:remove|delete|take off|get rid of)\s+(.+?)(?:\s+from my list)?$/);
  if(m){
    return { intent:'remove', item: m[1].trim() };
  }

  // add intent — several natural phrasings
  m = text.match(/^(?:add|i need|i want to buy|i want|need|get me|buy|pick up|put)\s+(.+?)(?:\s+to (?:my|the) list)?$/);
  if(m){
    const { qty, rest } = extractQuantity(m[1].trim());
    return { intent:'add', item: rest, qty };
  }

  return { intent:'unknown', raw: text };
}

function parseSearch(rest){
  let text = rest;
  let maxPrice = null;
  const priceMatch = text.match(/under\s+\$?(\d+(?:\.\d+)?)|less than\s+\$?(\d+(?:\.\d+)?)/);
  if(priceMatch){
    maxPrice = parseFloat(priceMatch[1] || priceMatch[2]);
    text = text.replace(priceMatch[0], '').trim();
  }
  text = text.replace(/\b(organic|for)\b/g, '').replace(/\s+/g,' ').trim();
  return { intent:'search', query: text, maxPrice };
}

// ---------- list actions ----------

function addItem(name, qty){
  name = name.trim();
  if(!name) return null;
  const category = categorize(name);
  const existing = list.find(i => i.name.toLowerCase() === name.toLowerCase());
  if(existing){
    existing.qty += qty;
  } else {
    list.push({ name, qty, category });
  }
  history[name.toLowerCase()] = (history[name.toLowerCase()] || 0) + 1;
  saveState();
  renderList();
  renderSuggestions(name);
  return name;
}

function removeItem(query){
  const idx = list.findIndex(i => i.name.toLowerCase().includes(query.toLowerCase()));
  if(idx === -1) return null;
  const removed = list.splice(idx, 1)[0];
  saveState();
  renderList();
  renderSuggestions();
  return removed.name;
}

// ---------- rendering ----------

function renderList(){
  categoriesEl.innerHTML = '';
  itemCountEl.textContent = `${list.length} item${list.length !== 1 ? 's' : ''}`;
  emptyStateEl.classList.toggle('show', list.length === 0);

  const byCategory = {};
  list.forEach(item => {
    byCategory[item.category] = byCategory[item.category] || [];
    byCategory[item.category].push(item);
  });

  Object.keys(byCategory).sort().forEach(cat => {
    const block = document.createElement('div');
    block.className = 'category-block';
    block.innerHTML = `<div class="category-title">${cat}</div>`;
    byCategory[cat].forEach(item => {
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <span class="name">${item.name}</span>
        <span style="display:flex; align-items:center; gap:10px;">
          <span class="qty">×${item.qty}</span>
          <button class="remove" data-name="${item.name}" aria-label="Remove ${item.name}">✕</button>
        </span>`;
      block.appendChild(row);
    });
    categoriesEl.appendChild(block);
  });

  categoriesEl.querySelectorAll('.remove').forEach(btn => {
    btn.addEventListener('click', () => removeItem(btn.dataset.name));
  });
}

function renderSuggestions(justAdded){
  suggestionsEl.innerHTML = '';
  const cards = [];

  // 1. substitute suggestion for the item just added
  if(justAdded){
    const key = justAdded.toLowerCase();
    if(SUBSTITUTES[key]){
      cards.push({
        label: `Prefer an alternative to ${justAdded}? Try ${SUBSTITUTES[key].join(' or ')}.`,
        actionLabel: `Add ${SUBSTITUTES[key][0]}`,
        onAdd: () => addItem(SUBSTITUTES[key][0], 1)
      });
    }
  }

  // 2. "running low" — items bought often historically but not currently on the list
  Object.keys(history)
    .filter(k => history[k] >= 2 && !list.some(i => i.name.toLowerCase() === k))
    .slice(0, 1)
    .forEach(k => {
      cards.push({
        label: `It looks like you're running low on ${k}.`,
        actionLabel: `Add ${k}`,
        onAdd: () => addItem(k, 1)
      });
    });

  // 3. seasonal pick
  const month = new Date().getMonth();
  const seasonal = (SEASONAL_BY_MONTH[month] || []).find(s => !list.some(i => i.name.toLowerCase() === s));
  if(seasonal){
    cards.push({
      label: `${cap(seasonal)} is in season right now.`,
      actionLabel: `Add ${seasonal}`,
      onAdd: () => addItem(seasonal, 1)
    });
  }

  cards.slice(0, 3).forEach(c => {
    const div = document.createElement('div');
    div.className = 'suggestion-card';
    div.innerHTML = `<span class="label">${c.label}</span>`;
    const btn = document.createElement('button');
    btn.textContent = c.actionLabel;
    btn.addEventListener('click', c.onAdd);
    div.appendChild(btn);
    suggestionsEl.appendChild(div);
  });
}

function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

function runSearch(query, maxPrice){
  const q = query.toLowerCase();
  let results = CATALOG.filter(p =>
    p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)
  );
  if(maxPrice != null){
    results = results.filter(p => p.price <= maxPrice);
  }
  searchTitle.textContent = maxPrice != null
    ? `Results for "${query}" under $${maxPrice}`
    : `Results for "${query}"`;
  searchResults.innerHTML = '';
  if(results.length === 0){
    searchResults.innerHTML = `<div class="no-results">No matches. Try a different term or price range.</div>`;
  } else {
    results.forEach(p => {
      const card = document.createElement('div');
      card.className = 'result-card';
      card.innerHTML = `
        <div>
          <div class="r-name">${p.name}</div>
          <div class="r-meta">${p.brand} · ${p.category}</div>
        </div>
        <div style="display:flex; align-items:center;">
          <span class="r-price">$${p.price.toFixed(2)}</span>
        </div>`;
      const btn = document.createElement('button');
      btn.textContent = 'Add';
      btn.addEventListener('click', () => { addItem(p.name, 1); btn.textContent = 'Added ✓'; });
      card.querySelector('div[style]').appendChild(btn);
      searchResults.appendChild(card);
    });
  }
  searchDrawer.classList.add('open');
}

document.getElementById('closeSearch').addEventListener('click', () => searchDrawer.classList.remove('open'));

// ---------- command dispatch (with a small simulated processing delay
// so the UI has a real loading state — voice apps commonly hit an API
// here; we mock the latency to demonstrate the UX pattern honestly) ----------

function handleTranscript(raw){
  voiceTranscript.textContent = raw;
  loadingDots.classList.add('active');
  voiceState.textContent = 'Processing…';

  setTimeout(() => {
    loadingDots.classList.remove('active');
    const cmd = parseCommand(raw);

    if(cmd.intent === 'add'){
      addItem(cmd.item, cmd.qty);
      voiceState.textContent = `Added ${cmd.qty > 1 ? cmd.qty + '× ' : ''}${cmd.item} ✓`;
    } else if(cmd.intent === 'remove'){
      const removed = removeItem(cmd.item);
      voiceState.textContent = removed ? `Removed ${removed} ✓` : `Couldn't find "${cmd.item}" on your list`;
    } else if(cmd.intent === 'search'){
      runSearch(cmd.query, cmd.maxPrice);
      voiceState.textContent = `Searched for "${cmd.query}"`;
    } else if(cmd.intent === 'show'){
      voiceState.textContent = `You have ${list.length} item${list.length !== 1 ? 's':''} on your list.`;
    } else {
      voiceState.textContent = `Didn't catch that — try "add milk" or "remove bread"`;
    }
  }, 260);
}

// ---------- voice engine ----------

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;

if(SR){
  recognition = new SR();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onresult = (e) => handleTranscript(e.results[0][0].transcript);
  recognition.onend = () => { isListening = false; micBtn.classList.remove('listening'); if(voiceState.textContent === 'Listening…') voiceState.textContent = 'Tap to speak'; };
  recognition.onerror = (e) => {
    isListening = false;
    micBtn.classList.remove('listening');
    voiceState.textContent = e.error === 'not-allowed'
      ? 'Mic permission denied — use the text box below'
      : `Mic error (${e.error}) — try again or type instead`;
  };
} else {
  voiceState.textContent = 'Voice not supported in this browser — use the text box below';
  micBtn.style.opacity = .4;
}

micBtn.addEventListener('click', () => {
  if(!recognition) return;
  if(isListening){ recognition.stop(); return; }
  isListening = true;
  micBtn.classList.add('listening');
  voiceState.textContent = 'Listening…';
  voiceTranscript.textContent = '';
  try{ recognition.start(); }catch(err){ isListening = false; micBtn.classList.remove('listening'); }
});

textForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if(textInput.value.trim()){ handleTranscript(textInput.value.trim()); textInput.value = ''; }
});

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => handleTranscript(chip.dataset.cmd));
});

// ---------- init ----------
renderList();
renderSuggestions();
