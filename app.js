import { evaluate, formatNumber, toExpressionString, compileFunction, indianGrouping, formatDecimals, CalcError } from './calc.js';
import { pressKey, backspace, seedFromResult, insertValue, pressKeyAt, backspaceAt, insertValueAt, snapCursor } from './editor.js';
import { CATEGORIES, findCategory, findUnit, convertUnit, convertCurrency, parseRatesResponse, searchOptions, sanitizeRates, allUnitOptions } from './convert.js';
import { filterHistory, setLabel } from './history.js';
import { TOOLS } from './tools.js';
import { createGraphView } from './graph-view.js';

/** @typedef {import('./calc.js').AngleMode} AngleMode */
/**
 * @typedef {{
 *   theme: 'system' | 'light' | 'dark',
 *   keySize: 'compact' | 'regular' | 'large',
 *   grouping: 'international' | 'indian',
 *   decimals: 'auto' | '2' | '4' | '6',
 *   recent: 0 | 1 | 2 | 3,
 *   sound: boolean,
 *   startAngle: AngleMode,
 * }} Settings
 */
/** @typedef {import('./history.js').HistoryEntry} HistoryEntry */
/** @typedef {import('./convert.js').RatesSnapshot} RatesSnapshot */
/** @typedef {import('./convert.js').PickerOption} PickerOption */
/** @typedef {import('./tools.js').ToolMode} ToolMode */
/** @typedef {{ tool: string, modes: Record<string, string>, values: Record<string, Record<string, string>> }} ToolsState */
/** @typedef {{ category: string, units: Record<string, { from: string, to: string }>, input: string }} ConvState */
/** @typedef {{ kind: 'idle' | 'loading' | 'ok' | 'error', message: string }} RatesStatus */
/**
 * @typedef {{
 *   mode: 'calc' | 'convert' | 'tools' | 'graph',
 *   expr: string,
 *   cursor: number | null,
 *   result: number | null,
 *   error: string | null,
 *   angle: AngleMode,
 *   sci: boolean,
 *   second: boolean,
 *   memory: number | null,
 *   historyOpen: boolean,
 *   historyQuery: string,
 *   picker: 'from' | 'to' | null,
 *   pickerQuery: string,
 *   history: HistoryEntry[],
 *   conv: ConvState,
 *   tools: ToolsState,
 *   graph: { fns: string[] },
 *   settings: Settings,
 *   settingsOpen: boolean,
 *   rates: RatesSnapshot | null,
 *   ratesFetchedAt: number | null,
 *   ratesStatus: RatesStatus,
 * }} State
 */

const STORAGE = {
  history: 'calc.history.v1',
  prefs: 'calc.prefs.v1',
  expr: 'calc.expr.v1',
  memory: 'calc.memory.v1',
  conv: 'calc.conv.v1',
  rates: 'calc.rates.v1',
  tools: 'calc.tools.v1',
  graph: 'calc.graph.v1',
  settings: 'calc.settings.v1',
  ratesFetchedAt: 'calc.ratesFetchedAt.v1',
};
const HISTORY_LIMIT = 500;
const CURRENCY = 'currency';
const RATES_URL = 'https://open.er-api.com/v6/latest/USD';
const RATES_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const POPULAR_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AED', 'JPY', 'CNY', 'CAD', 'AUD', 'SGD', 'CHF'];
const DEFAULT_UNITS = /** @type {Readonly<Record<string, { from: string, to: string }>>} */ ({
  currency: { from: 'USD', to: 'INR' },
  length: { from: 'm', to: 'ft' },
  weight: { from: 'kg', to: 'lb' },
  temperature: { from: 'c', to: 'f' },
  area: { from: 'm2', to: 'ft2' },
  volume: { from: 'l', to: 'gal' },
  speed: { from: 'kmh', to: 'mph' },
  time: { from: 'h', to: 'min' },
  data: { from: 'gb', to: 'mb' },
  pressure: { from: 'bar', to: 'psi' },
  energy: { from: 'kcal', to: 'kj' },
  angle: { from: 'deg', to: 'rad' },
  force: { from: 'n', to: 'kgf' },
  fuel: { from: 'kml', to: 'l100km' },
  numbers: { from: 'lakh', to: 'million' },
  power: { from: 'kw', to: 'hp' },
});
const currencyNames = new Intl.DisplayNames(['en'], { type: 'currency' });
const ALT_LABELS = /** @type {Readonly<Record<string, string>>} */ ({
  asin: 'sin⁻¹', acos: 'cos⁻¹', atan: 'tan⁻¹', asinh: 'sinh⁻¹', acosh: 'cosh⁻¹', atanh: 'tanh⁻¹',
  cube: 'x³', exp: 'eˣ', pow10: '10ˣ',
});

/** @param {string} id */
const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
const el = {
  calc: /** @type {HTMLElement} */ (document.querySelector('.calc')),
  display: $('display'),
  expr: $('expr'),
  exprWrap: /** @type {HTMLElement} */ (document.querySelector('.expr-wrap')),
  result: $('result'),
  sci: $('sci'),
  sciBtn: $('sciBtn'),
  angleBtn: $('angleBtn'),
  secondBtn: $('secondBtn'),
  history: $('history'),
  historyBtn: $('historyBtn'),
  settingsBtn: $('settingsBtn'),
  settings: $('settings'),
  settingsBody: $('settingsBody'),
  settingsClose: $('settingsClose'),
  historyList: $('historyList'),
  historyEmpty: $('historyEmpty'),
  clearHistoryBtn: /** @type {HTMLButtonElement} */ ($('clearHistoryBtn')),
  closeHistoryBtn: $('closeHistoryBtn'),
  historySearch: /** @type {HTMLInputElement} */ ($('historySearch')),
  scrim: $('scrim'),
  toast: $('toast'),
  calcTab: $('calcTab'),
  convTab: $('convTab'),
  toolsTab: $('toolsTab'),
  tools: $('tools'),
  toolChips: $('toolChips'),
  toolModes: $('toolModes'),
  toolForm: /** @type {HTMLFormElement} */ ($('toolForm')),
  toolResults: $('toolResults'),
  pad: $('pad'),
  graphTab: $('graphTab'),
  graph: $('graph'),
  graphCanvas: /** @type {HTMLCanvasElement} */ ($('graphCanvas')),
  graphReset: $('graphReset'),
  graphReadout: $('graphReadout'),
  graphKeys: $('graphKeys'),
  graphFns: $('graphFns'),
  graphAdd: $('graphAdd'),
  memBadge: $('memBadge'),
  recent: $('recent'),
  mem: $('mem'),
  conv: $('conv'),
  convChips: $('convChips'),
  fromPick: $('fromPick'),
  toPick: $('toPick'),
  picker: $('picker'),
  pickerTitle: $('pickerTitle'),
  pickerSearch: /** @type {HTMLInputElement} */ ($('pickerSearch')),
  pickerList: $('pickerList'),
  pickerClose: $('pickerClose'),
  fromCode: $('fromCode'),
  fromName: $('fromName'),
  toCode: $('toCode'),
  toName: $('toName'),
  fromValue: $('fromValue'),
  toValue: $('toValue'),
  swapBtn: $('swapBtn'),
  convMeta: $('convMeta'),
  ratesRefreshBtn: $('ratesRefreshBtn'),
  ratesCredit: $('ratesCredit'),
};

// ---------- Storage ----------

/** @param {string} message */
function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add('show');
  clearTimeout(Number(el.toast.dataset.timer));
  el.toast.dataset.timer = String(setTimeout(() => el.toast.classList.remove('show'), 1600));
}

/**
 * Fallback copy for pages that aren't a secure context (plain http over Wi-Fi), where the
 * browser hides navigator.clipboard. Must run synchronously inside the tap.
 * @param {string} value
 */
function copyWithTextarea(value) {
  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  Object.assign(area.style, { position: 'fixed', top: '0', left: '0', opacity: '0', fontSize: '16px' });
  document.body.append(area);
  area.select();
  area.setSelectionRange(0, value.length);
  const copied = document.execCommand('copy');
  area.remove();
  if (!copied) throw new Error(`document.execCommand("copy") refused to copy "${value}"`);
}

/**
 * Copy text and confirm with a toast.
 * @param {string} value
 */
async function copyText(value) {
  try {
    if (window.isSecureContext && navigator.clipboard) await navigator.clipboard.writeText(value);
    else copyWithTextarea(value);
    showToast(`Copied ${value}`);
  } catch (err) {
    console.error(`Copy failed for "${value}"`, err);
    showToast('Couldn’t copy');
  }
}

/**
 * @param {string} key
 * @returns {unknown}
 */
function readStored(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch (err) {
    console.error(`Could not read "${key}" from storage`, err);
    showToast('Saved data could not be loaded');
    return null;
  }
}

/**
 * @param {string} key
 * @param {unknown} value
 */
function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Could not save "${key}" to storage`, err);
    showToast('History can’t be saved in this browser');
  }
}

/**
 * @param {unknown} value
 * @returns {value is HistoryEntry}
 */
function isHistoryEntry(value) {
  if (typeof value !== 'object' || value === null) return false;
  const v = /** @type {Record<string, unknown>} */ (value);
  return typeof v.id === 'string' && typeof v.expr === 'string'
    && typeof v.result === 'number' && typeof v.at === 'number'
    && (v.label === undefined || typeof v.label === 'string');
}

/**
 * Saved converter settings, keeping only units that still exist.
 * @param {unknown} stored
 * @returns {ConvState}
 */
function loadConv(stored) {
  const s = /** @type {Record<string, unknown>} */ (typeof stored === 'object' && stored !== null ? stored : {});
  const savedUnits = /** @type {Record<string, { from?: unknown, to?: unknown }>} */ (typeof s.units === 'object' && s.units !== null ? s.units : {});
  /** @type {Record<string, { from: string, to: string }>} */
  const units = {};
  for (const [categoryId, defaults] of Object.entries(DEFAULT_UNITS)) {
    const saved = savedUnits[categoryId];
    const valid = (/** @type {unknown} */ id) => typeof id === 'string'
      && (categoryId === CURRENCY ? /^[A-Z]{3}$/.test(id) : findCategory(categoryId).units.some((u) => u.id === id));
    units[categoryId] = {
      from: saved && valid(saved.from) ? /** @type {string} */ (saved.from) : defaults.from,
      to: saved && valid(saved.to) ? /** @type {string} */ (saved.to) : defaults.to,
    };
  }
  const category = typeof s.category === 'string' && s.category in DEFAULT_UNITS ? s.category : CURRENCY;
  return { category, units, input: typeof s.input === 'string' ? s.input : '' };
}

/**
 * @param {unknown} stored
 * @returns {RatesSnapshot | null}
 */
function loadRates(stored) {
  if (stored === null) return null;
  const s = /** @type {Record<string, unknown>} */ (typeof stored === 'object' ? stored : {});
  const rates = sanitizeRates(s.rates);
  if (typeof s.base !== 'string' || typeof s.updatedAt !== 'number' || rates === null) {
    console.error('Ignoring malformed saved exchange rates', stored);
    return null;
  }
  return { base: s.base, updatedAt: s.updatedAt, rates };
}

/**
 * Saved tool inputs, keeping only tools and modes that still exist.
 * @param {unknown} stored
 * @returns {ToolsState}
 */
function loadTools(stored) {
  const s = /** @type {Record<string, unknown>} */ (typeof stored === 'object' && stored !== null ? stored : {});
  const savedModes = /** @type {Record<string, unknown>} */ (typeof s.modes === 'object' && s.modes !== null ? s.modes : {});
  const savedValues = /** @type {Record<string, unknown>} */ (typeof s.values === 'object' && s.values !== null ? s.values : {});
  /** @type {Record<string, string>} */
  const modes = {};
  /** @type {Record<string, Record<string, string>>} */
  const values = {};
  for (const tool of TOOLS) {
    const mode = savedModes[tool.id];
    modes[tool.id] = typeof mode === 'string' && tool.modes.some((m) => m.id === mode) ? mode : tool.modes[0].id;
    const raw = savedValues[tool.id];
    const saved = /** @type {Record<string, unknown>} */ (typeof raw === 'object' && raw !== null ? raw : {});
    values[tool.id] = Object.fromEntries(Object.entries(saved).filter(([, v]) => typeof v === 'string'));
  }
  const tool = typeof s.tool === 'string' && TOOLS.some((t) => t.id === s.tool) ? s.tool : TOOLS[0].id;
  return { tool, modes, values };
}

const MAX_GRAPHS = 3;

/**
 * @param {unknown} stored
 * @returns {{ fns: string[] }}
 */
function loadGraph(stored) {
  const fns = typeof stored === 'object' && stored !== null ? /** @type {Record<string, unknown>} */ (stored).fns : null;
  const valid = Array.isArray(fns) && fns.length >= 1 && fns.length <= MAX_GRAPHS && fns.every((f) => typeof f === 'string');
  return { fns: valid ? /** @type {string[]} */ (fns) : ['x^2-3', 'sin(x)'] };
}

/** @type {Readonly<Settings>} */
const DEFAULT_SETTINGS = {
  theme: 'system', keySize: 'regular', grouping: 'international', decimals: 'auto', recent: 3, sound: false, startAngle: 'deg',
};

/**
 * Allowed values for each setting, in the order the Settings sheet shows them.
 * @type {Readonly<Record<keyof Settings, readonly (string | number | boolean)[]>>}
 */
const SETTING_CHOICES = {
  theme: ['system', 'light', 'dark'],
  keySize: ['compact', 'regular', 'large'],
  grouping: ['international', 'indian'],
  decimals: ['auto', '2', '4', '6'],
  recent: [0, 1, 2, 3],
  sound: [false, true],
  startAngle: ['deg', 'rad'],
};

/**
 * Saved settings, keeping only known keys with allowed values.
 * @param {unknown} stored
 * @returns {Settings}
 */
function loadSettings(stored) {
  const s = /** @type {Record<string, unknown>} */ (typeof stored === 'object' && stored !== null ? stored : {});
  const settings = /** @type {Record<string, unknown>} */ ({ ...DEFAULT_SETTINGS });
  for (const [key, choices] of Object.entries(SETTING_CHOICES)) {
    if (choices.includes(/** @type {string} */ (s[key]))) settings[key] = s[key];
  }
  return /** @type {Settings} */ (settings);
}

/** @returns {State} */
function loadState() {
  const history = readStored(STORAGE.history);
  const prefs = /** @type {Record<string, unknown> | null} */ (readStored(STORAGE.prefs));
  const expr = readStored(STORAGE.expr);
  const memory = readStored(STORAGE.memory);
  const ratesFetchedAt = readStored(STORAGE.ratesFetchedAt);
  const settings = loadSettings(readStored(STORAGE.settings));
  return {
    mode: prefs?.mode === 'convert' || prefs?.mode === 'tools' || prefs?.mode === 'graph' ? prefs.mode : 'calc',
    expr: typeof expr === 'string' ? expr : '',
    cursor: null,
    result: null,
    error: null,
    angle: settings.startAngle,
    sci: prefs?.sci === true,
    second: false,
    memory: typeof memory === 'number' ? memory : null,
    historyOpen: false,
    historyQuery: '',
    picker: null,
    pickerQuery: '',
    history: Array.isArray(history) ? history.filter(isHistoryEntry) : [],
    conv: loadConv(readStored(STORAGE.conv)),
    tools: loadTools(readStored(STORAGE.tools)),
    graph: loadGraph(readStored(STORAGE.graph)),
    settings,
    settingsOpen: false,
    rates: loadRates(readStored(STORAGE.rates)),
    ratesFetchedAt: typeof ratesFetchedAt === 'number' ? ratesFetchedAt : null,
    ratesStatus: { kind: 'idle', message: '' },
  };
}

/**
 * @param {State} prev
 * @param {State} next
 */
function persist(prev, next) {
  if (prev.history !== next.history) writeStored(STORAGE.history, next.history);
  if (prev.angle !== next.angle || prev.sci !== next.sci || prev.mode !== next.mode) {
    writeStored(STORAGE.prefs, { angle: next.angle, sci: next.sci, mode: next.mode });
  }
  if (prev.memory !== next.memory) writeStored(STORAGE.memory, next.memory);
  if (prev.conv !== next.conv) writeStored(STORAGE.conv, next.conv);
  if (prev.tools !== next.tools) writeStored(STORAGE.tools, next.tools);
  if (prev.graph !== next.graph) writeStored(STORAGE.graph, next.graph);
  if (prev.settings !== next.settings) writeStored(STORAGE.settings, next.settings);
  if (prev.rates !== next.rates) writeStored(STORAGE.rates, next.rates);
  if (prev.ratesFetchedAt !== next.ratesFetchedAt) writeStored(STORAGE.ratesFetchedAt, next.ratesFetchedAt);
  const exprToKeep = next.result === null ? next.expr : '';
  const prevExprKept = prev.result === null ? prev.expr : '';
  if (exprToKeep !== prevExprKept) writeStored(STORAGE.expr, exprToKeep);
}

// ---------- State transitions (pure) ----------

/**
 * Close any parentheses the user left open so history reads cleanly.
 * @param {string} expr
 * @returns {string}
 */
function closeParens(expr) {
  const depth = [...expr].reduce((d, ch) => d + (ch === '(' ? 1 : ch === ')' ? -1 : 0), 0);
  return expr + ')'.repeat(Math.max(depth, 0));
}

/**
 * @param {State} state
 * @param {string} key
 * @returns {State}
 */
function onKey(state, key) {
  if (state.result !== null) {
    return { ...state, expr: pressKey(seedFromResult(key, state.result), key), cursor: null, result: null, error: null };
  }
  return withEdit(state, pressKeyAt(state.expr, cursorOf(state), key));
}

/**
 * Where typing goes: the tapped position, or the end (null).
 * @param {State} state
 * @returns {number}
 */
function cursorOf(state) {
  return state.cursor === null ? state.expr.length : Math.min(state.cursor, state.expr.length);
}

/**
 * Apply an edit; a cursor at the very end is stored as null so later appends follow it.
 * @param {State} state
 * @param {import('./editor.js').Edit} edit
 * @returns {State}
 */
function withEdit(state, edit) {
  const cursor = edit.cursor >= edit.expr.length ? null : edit.cursor;
  return { ...state, expr: edit.expr, cursor, result: null, error: null };
}

/**
 * Move the cursor one step, skipping over "sin(" / "mod" as single units.
 * @param {State} state
 * @param {-1 | 1} direction
 * @returns {State}
 */
function moveCursor(state, direction) {
  if (state.result !== null) return state;
  let pos = cursorOf(state) + direction;
  while (pos > 0 && pos < state.expr.length && snapCursor(state.expr, pos) !== pos) pos += direction;
  const clamped = Math.min(Math.max(pos, 0), state.expr.length);
  return withEdit(state, { expr: state.expr, cursor: clamped });
}

/**
 * @param {State} state
 * @returns {State}
 */
function onBackspace(state) {
  if (state.result !== null) return { ...state, cursor: null, result: null, error: null };
  return withEdit(state, backspaceAt(state.expr, cursorOf(state)));
}

/**
 * @param {State} state
 * @param {number} now
 * @returns {State}
 */
function onEquals(state, now) {
  if (state.result !== null || state.expr === '') return state;
  try {
    const result = evaluate(state.expr, state.angle);
    const expr = closeParens(state.expr);
    const entry = { id: `${now}-${Math.random().toString(36).slice(2, 8)}`, expr, result, at: now };
    return { ...state, expr, cursor: null, result, error: null, history: [entry, ...state.history].slice(0, HISTORY_LIMIT) };
  } catch (err) {
    if (err instanceof CalcError) return { ...state, error: err.message };
    throw err;
  }
}

/**
 * Put a stored value (history, memory, Ans) into whatever is being typed.
 * @param {State} state
 * @param {number} value
 * @returns {State}
 */
function onInsert(state, value) {
  if (state.mode === 'convert') {
    return { ...state, conv: { ...state.conv, input: insertValue(state.conv.input, value) }, historyOpen: false };
  }
  const edit = state.result !== null ? insertValueAt('', 0, value) : insertValueAt(state.expr, cursorOf(state), value);
  return { ...withEdit(state, edit), mode: 'calc', historyOpen: false };
}

/**
 * The number currently on screen: the answer, or the live value of what's typed.
 * @param {State} state
 * @returns {number | null}
 */
function currentValue(state) {
  if (state.result !== null) return state.result;
  try {
    return evaluate(state.expr, state.angle);
  } catch (err) {
    if (err instanceof CalcError) return null;
    throw err;
  }
}

// ---------- Converter ----------

/**
 * @param {ConvState} conv
 * @returns {{ from: string, to: string }}
 */
function activeUnits(conv) {
  return conv.units[conv.category];
}

/**
 * @param {State} state
 * @param {(units: { from: string, to: string }) => { from: string, to: string }} change
 * @returns {State}
 */
function updateUnits(state, change) {
  const units = { ...state.conv.units, [state.conv.category]: change(activeUnits(state.conv)) };
  return { ...state, conv: { ...state.conv, units } };
}

/**
 * Pick a unit for one side, switching category if it came from a search of all units.
 * Picking the unit already on the other side swaps them.
 * @param {State} state
 * @param {string} category
 * @param {'from' | 'to'} side
 * @param {string} id
 * @returns {State}
 */
function chooseUnit(state, category, side, id) {
  const inCategory = { ...state, conv: { ...state.conv, category } };
  const next = updateUnits(inCategory, (u) => {
    const other = side === 'from' ? 'to' : 'from';
    return u[other] === id ? { [side]: id, [other]: u[side] } : { ...u, [side]: id };
  });
  return { ...next, picker: null };
}

/**
 * Convert `amount` with the current settings. Null when it can't be done yet (no rates).
 * @param {State} state
 * @param {number} amount
 * @returns {number | null}
 */
function convertAmount(state, amount) {
  const { from, to } = activeUnits(state.conv);
  if (state.conv.category !== CURRENCY) {
    const value = convertUnit(amount, state.conv.category, from, to);
    return Number.isFinite(value) ? value : null; // e.g. 0 km/L has no L/100 km
  }
  if (state.rates === null || !Object.hasOwn(state.rates.rates, from) || !Object.hasOwn(state.rates.rates, to)) return null;
  return convertCurrency(amount, from, to, state.rates.rates);
}

/**
 * Value of the converter's input expression, or null while it's incomplete.
 * @param {string} input
 * @returns {number | null}
 */
function inputValue(input) {
  if (input === '') return null;
  try {
    return evaluate(input, 'deg');
  } catch (err) {
    if (err instanceof CalcError) return null;
    throw err;
  }
}

/**
 * Keypad handling while the converter is showing.
 * @param {State} state
 * @param {string} key
 * @returns {State}
 */
function onConvKey(state, key) {
  const input = state.conv.input;
  /** @type {string} */
  let next;
  switch (key) {
    case 'clear': next = ''; break;
    case 'back': next = backspace(input); break;
    case 'equals': {
      const value = inputValue(input);
      next = value === null ? input : toExpressionString(value);
      break;
    }
    default: next = pressKey(input, key);
  }
  return next === input ? state : { ...state, conv: { ...state.conv, input: next } };
}

// ---------- Rendering ----------

/**
 * Apply the number-style setting to finished display text.
 * @param {Settings} settings
 * @param {string} text
 * @returns {string}
 */
function group(settings, text) {
  return settings.grouping === 'indian' ? indianGrouping(text) : text;
}

/**
 * A number as the user wants to see it: decimal places, then digit grouping.
 * @param {Settings} settings
 * @param {number} n
 * @returns {string}
 */
function fmt(settings, n) {
  return group(settings, settings.decimals === 'auto' ? formatNumber(n) : formatDecimals(n, Number(settings.decimals)));
}

/**
 * Live preview of the result while typing, or '' when not meaningful.
 * @param {State} state
 * @returns {string}
 */
function previewText(state) {
  if (!/[+−×÷^%!√a-zπ(]/.test(state.expr.replace(/e[+-]\d/, ''))) return '';
  try {
    return fmt(state.settings, evaluate(state.expr, state.angle));
  } catch (err) {
    if (err instanceof CalcError) return '';
    throw err;
  }
}

/**
 * Expression as coloured spans. Each span records where its text starts in the expression
 * (data-start) so a tap can be turned back into a cursor position.
 * @param {string} expr
 * @param {number | null} caretAt null hides the caret
 * @returns {DocumentFragment}
 */
function exprNodes(expr, caretAt) {
  const frag = document.createDocumentFragment();
  const caret = Object.assign(document.createElement('span'), { className: 'caret' });
  /** @param {string} text @param {string} className @param {number} start */
  const piece = (text, className, start) => {
    const span = Object.assign(document.createElement('span'), { textContent: text, className });
    span.dataset.start = String(start);
    return span;
  };
  let pos = 0;
  for (const part of expr.split(/(asinh|acosh|atanh|asin|acos|atan|sinh|cosh|tanh|sin|cos|tan|ln|log|mod|ʸ√|[+−×÷^])/)) {
    if (part === '') continue;
    const start = pos;
    pos += part.length;
    const className = /^([+−×÷^]|mod|ʸ√)$/.test(part)
      ? (part === 'mod' ? 'o word' : 'o')
      : (/^[a-z]+$/.test(part) && part !== 'e' ? 'f' : '');
    if (caretAt === start) frag.append(caret);
    if (caretAt !== null && caretAt > start && caretAt < pos) {
      frag.append(piece(part.slice(0, caretAt - start), className, start), caret, piece(part.slice(caretAt - start), className, caretAt));
    } else {
      frag.append(piece(part, className, start));
    }
  }
  const missing = closeParens(expr).length - expr.length;
  if (caretAt !== null && caretAt === expr.length) frag.append(caret);
  if (missing > 0) {
    const ghost = document.createElement('span');
    ghost.className = 'ghost';
    ghost.textContent = ')'.repeat(missing);
    frag.append(ghost);
  }
  return frag;
}

/**
 * Shrink text until it fits its container (down to a minimum, after which it scrolls).
 * @param {HTMLElement} node
 * @param {HTMLElement} container
 * @param {number} max
 * @param {number} min
 */
function fitText(node, container, max, min) {
  node.style.fontSize = `${max}px`;
  const overflow = node.scrollWidth / Math.max(container.clientWidth, 1);
  if (overflow > 1) node.style.fontSize = `${Math.max(min, Math.floor((max / overflow) * 0.97))}px`;
}

/** @param {number} at */
function dayLabel(at) {
  const day = new Date(at);
  const today = new Date();
  const startOf = (/** @type {Date} */ d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(day)) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return day.toLocaleDateString(undefined, { weekday: diffDays < 7 ? 'long' : undefined, month: 'short', day: 'numeric', year: day.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

const DELETE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const LABEL_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/></svg>';

/**
 * @param {HistoryEntry[]} history
 * @param {string} query
 * @param {Settings} settings
 */
function renderHistory(history, query, settings) {
  const shown = filterHistory(history, query);
  el.historyList.replaceChildren();
  el.historyEmpty.hidden = shown.length > 0;
  el.historyEmpty.textContent = history.length === 0
    ? 'Your calculations will appear here.'
    : `No matches for “${query.trim()}”.`;
  el.clearHistoryBtn.disabled = history.length === 0;
  let lastLabel = '';
  for (const entry of shown) {
    const label = dayLabel(entry.at);
    if (label !== lastLabel) {
      const li = document.createElement('li');
      li.className = 'history-day';
      li.textContent = label;
      el.historyList.append(li);
      lastLabel = label;
    }
    const li = document.createElement('li');
    li.className = 'history-item';
    li.dataset.id = entry.id;

    const box = document.createElement('div');
    box.className = 'entry';
    const exprBtn = document.createElement('button');
    exprBtn.className = 'entry-expr';
    exprBtn.dataset.action = 'load';
    exprBtn.textContent = entry.expr;
    exprBtn.setAttribute('aria-label', `Edit ${entry.expr}`);
    const resultBtn = document.createElement('button');
    resultBtn.className = 'entry-result';
    resultBtn.dataset.action = 'use';
    resultBtn.textContent = fmt(settings, entry.result);
    resultBtn.classList.toggle('long', resultBtn.textContent.length > 15);
    resultBtn.setAttribute('aria-label', `Use result ${resultBtn.textContent}`);
    const time = document.createElement('span');
    time.className = 'entry-time';
    time.textContent = new Date(entry.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    if (entry.label !== undefined) {
      const tag = document.createElement('span');
      tag.className = 'entry-label';
      tag.textContent = entry.label;
      box.append(tag);
    }
    box.append(exprBtn, resultBtn, time);

    const actions = document.createElement('div');
    actions.className = 'entry-actions';
    const labelBtn = document.createElement('button');
    labelBtn.className = 'entry-icon';
    labelBtn.dataset.action = 'label';
    labelBtn.setAttribute('aria-label', entry.label === undefined ? 'Add label' : 'Edit label');
    labelBtn.innerHTML = LABEL_ICON;
    const del = document.createElement('button');
    del.className = 'entry-icon delete';
    del.dataset.action = 'delete';
    del.setAttribute('aria-label', 'Delete entry');
    del.innerHTML = DELETE_ICON;
    actions.append(labelBtn, del);

    li.append(box, actions);
    el.historyList.append(li);
  }
}

/**
 * @param {State} state
 * @param {string} id
 * @returns {{ code: string, name: string }}
 */
function unitLabel(state, id) {
  if (state.conv.category === CURRENCY) return { code: id, name: currencyNames.of(id) ?? id };
  const unit = findUnit(findCategory(state.conv.category), id);
  return { code: unit.symbol, name: unit.name };
}

/**
 * Currencies the picker can offer (just the selected pair until rates have loaded).
 * @param {State} state
 * @returns {PickerOption[]}
 */
function currencyOptions(state) {
  const { from, to } = state.conv.units[CURRENCY];
  const codes = state.rates === null ? [...new Set([from, to])] : Object.keys(state.rates.rates).sort();
  return codes.map((code) => ({ id: code, code, name: currencyNames.of(code) ?? code, category: CURRENCY }));
}

/**
 * Everything the unit picker can offer for the current category.
 * @param {State} state
 * @returns {PickerOption[]}
 */
function unitOptions(state) {
  if (state.conv.category === CURRENCY) return currencyOptions(state);
  const category = state.conv.category;
  return findCategory(category).units.map((u) => ({ id: u.id, code: u.symbol, name: u.name, category }));
}

/** @param {string} categoryId */
const categoryName = (categoryId) => (categoryId === CURRENCY ? 'Currency' : findCategory(categoryId).name);

/**
 * @param {string | null} title
 * @param {readonly PickerOption[]} options
 * @param {string} selected
 * @returns {HTMLElement[]}
 */
function pickerSection(title, options, selected) {
  /** @type {HTMLElement[]} */
  const items = [];
  if (title !== null) {
    items.push(Object.assign(document.createElement('li'), { className: 'history-day', textContent: title }));
  }
  for (const option of options) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'picker-item';
    btn.dataset.id = option.id;
    btn.dataset.category = option.category;
    btn.classList.toggle('selected', option.id === selected);
    btn.append(
      Object.assign(document.createElement('span'), { className: 'picker-code', textContent: option.code }),
      Object.assign(document.createElement('span'), { className: 'picker-name', textContent: option.name }),
    );
    li.append(btn);
    items.push(li);
  }
  return items;
}

/** @param {State} state */
function renderPicker(state) {
  if (state.picker === null) return;
  el.pickerTitle.textContent = state.picker === 'from' ? 'Convert from' : 'Convert to';
  const selected = activeUnits(state.conv)[state.picker];
  const query = state.pickerQuery.trim();
  /** @type {readonly PickerOption[]} */
  let matches;
  if (query === '') {
    // Browsing: just this category.
    const options = unitOptions(state);
    matches = options;
    const browsingCurrencies = state.conv.category === CURRENCY && state.rates !== null;
    const popular = POPULAR_CURRENCIES.flatMap((code) => options.filter((o) => o.id === code));
    el.pickerList.replaceChildren(...(browsingCurrencies
      ? [...pickerSection('Popular', popular, selected), ...pickerSection('All currencies', options, selected)]
      : pickerSection(null, options, selected)));
  } else {
    // Searching: every category, the current one first, each under its own heading.
    matches = searchOptions([...currencyOptions(state), ...allUnitOptions()], query);
    const order = [...new Set([state.conv.category, CURRENCY, ...CATEGORIES.map((c) => c.id)])];
    el.pickerList.replaceChildren(...order.flatMap((categoryId) => {
      const inCategory = matches.filter((o) => o.category === categoryId);
      if (inCategory.length === 0) return [];
      return pickerSection(categoryName(categoryId), inCategory, categoryId === state.conv.category ? selected : '');
    }));
  }
  if (matches.length === 0) {
    el.pickerList.append(Object.assign(document.createElement('li'), {
      className: 'history-empty', textContent: `No matches for “${state.pickerQuery.trim()}”.`,
    }));
  }
}

/**
 * Typed input with thousands separators, keeping a trailing "." while typing.
 * @param {string} input
 * @returns {string}
 */
function groupTyped(input) {
  return input.replace(/(^|[^.\d])(\d{4,})/g, (_m, before, digits) => before + digits.replace(/\B(?=(\d{3})+$)/g, ','));
}

/** @param {number} at */
function relativeTime(at) {
  const minutes = Math.round((at - Date.now()) / 60000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  if (Math.abs(minutes) < 60 * 24) return rtf.format(Math.round(minutes / 60), 'hour');
  return rtf.format(Math.round(minutes / 1440), 'day');
}

/**
 * @param {State} state
 * @returns {string}
 */
function convMetaText(state) {
  const { from, to } = activeUnits(state.conv);
  const rate = convertAmount(state, 1);
  if (state.conv.category !== CURRENCY) {
    return `1 ${unitLabel(state, from).code} = ${rate === null ? '—' : fmt(state.settings, rate)} ${unitLabel(state, to).code}`;
  }
  if (state.rates === null) {
    return state.ratesStatus.kind === 'error'
      ? `Couldn’t load exchange rates: ${state.ratesStatus.message}`
      : 'Fetching latest exchange rates…';
  }
  if (rate === null) return `No rate available for ${Object.hasOwn(state.rates.rates, from) ? to : from}`;
  const offline = state.ratesStatus.kind === 'error' ? ' · couldn’t refresh, using saved rates' : '';
  const loading = state.ratesStatus.kind === 'loading' ? ' · refreshing…' : '';
  return `1 ${from} = ${fmt(state.settings, rate)} ${to} · updated ${relativeTime(state.rates.updatedAt)}${loading}${offline}`;
}

/**
 * @param {State} state
 * @param {State | null} prev
 */
function renderConverter(state) {
  const { from, to } = activeUnits(state.conv);
  for (const chip of el.convChips.children) {
    const c = /** @type {HTMLElement} */ (chip);
    const active = c.dataset.category === state.conv.category;
    c.classList.toggle('active', active);
    c.setAttribute('aria-selected', String(active));
  }
  const fromLabel = unitLabel(state, from);
  const toLabel = unitLabel(state, to);
  el.fromCode.textContent = fromLabel.code;
  el.fromName.textContent = fromLabel.name;
  el.toCode.textContent = toLabel.code;
  el.toName.textContent = toLabel.name;

  const amount = inputValue(state.conv.input);
  const converted = amount === null ? null : convertAmount(state, amount);
  const caret = Object.assign(document.createElement('span'), { className: 'caret' });
  el.fromValue.replaceChildren(state.conv.input === '' ? '0' : group(state.settings, groupTyped(state.conv.input)), caret);
  el.fromValue.classList.toggle('ghost', state.conv.input === '');
  el.toValue.textContent = converted === null ? (state.conv.input === '' ? '0' : '—') : fmt(state.settings, converted);
  el.toValue.classList.toggle('ghost', converted === null);
  fitText(el.fromValue, el.fromValue, 40, 20);
  fitText(el.toValue, el.toValue, 40, 20);

  el.convMeta.textContent = convMetaText(state);
  const isCurrency = state.conv.category === CURRENCY;
  el.ratesRefreshBtn.hidden = !isCurrency || state.ratesStatus.kind === 'loading';
  el.ratesCredit.hidden = !isCurrency;
}

// ---------- Tools ----------

/** @param {State} state */
function activeTool(state) {
  const tool = TOOLS.find((t) => t.id === state.tools.tool);
  if (!tool) throw new Error(`Unknown tool "${state.tools.tool}"`);
  const mode = tool.modes.find((m) => m.id === state.tools.modes[tool.id]);
  if (!mode) throw new Error(`Unknown mode "${state.tools.modes[tool.id]}" for ${tool.id}`);
  return { tool, mode };
}

/** Today as YYYY-MM-DD in the phone's time zone. */
function todayIso() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/**
 * The values a tool's form shows: what was typed, with dates defaulting to today.
 * @param {State} state
 * @param {ToolMode} mode
 * @returns {Record<string, string>}
 */
function toolValues(state, mode) {
  const typed = state.tools.values[state.tools.tool] ?? {};
  const defaults = Object.fromEntries(mode.fields.filter((f) => f.kind === 'date').map((f) => [f.id, todayIso()]));
  return { ...defaults, ...typed };
}

/**
 * @param {State} state
 * @param {string} fieldId
 * @param {string} value
 * @returns {State}
 */
function setToolValue(state, fieldId, value) {
  const toolId = state.tools.tool;
  const values = { ...state.tools.values, [toolId]: { ...state.tools.values[toolId], [fieldId]: value } };
  return { ...state, tools: { ...state.tools, values } };
}

/**
 * @param {string} text
 * @param {string} step
 * @param {string} label
 * @returns {HTMLButtonElement}
 */
function stepButton(text, step, label) {
  const btn = Object.assign(document.createElement('button'), { type: 'button', className: 'step', textContent: text });
  btn.dataset.step = step;
  btn.setAttribute('aria-label', label);
  return btn;
}

/**
 * @param {import('./tools.js').ToolField} field
 * @param {string} value
 * @returns {HTMLElement}
 */
function fieldNode(field, value) {
  const wrap = Object.assign(document.createElement('div'), { className: `field field-${field.kind}` });
  const id = `tool-${field.id}`;
  wrap.append(Object.assign(document.createElement('label'), { htmlFor: id, textContent: field.label }));
  const input = Object.assign(document.createElement('input'), { id, name: field.id, value, placeholder: field.placeholder });
  if (field.kind === 'date') {
    input.type = 'date';
  } else {
    input.type = 'text';
    input.inputMode = field.kind === 'count' ? 'numeric' : 'decimal';
  }
  const box = Object.assign(document.createElement('div'), { className: 'field-box' });
  if (field.kind === 'count') {
    box.append(stepButton('−', '-1', 'Fewer'), input, stepButton('+', '1', 'More'));
  } else {
    box.append(input);
    if (field.suffix !== '') box.append(Object.assign(document.createElement('span'), { className: 'suffix', textContent: field.suffix }));
  }
  wrap.append(box);
  if (field.presets.length > 0) {
    const presets = Object.assign(document.createElement('div'), { className: 'presets' });
    for (const preset of field.presets) {
      const btn = Object.assign(document.createElement('button'), {
        type: 'button', className: 'preset', textContent: `${preset}${field.suffix === '%' ? '%' : ''}`,
      });
      btn.dataset.preset = String(preset);
      btn.dataset.field = field.id;
      presets.append(btn);
    }
    wrap.append(presets);
  }
  return wrap;
}

/**
 * @param {State} state
 * @param {State | null} prev
 */
function renderTools(state, prev) {
  const { tool, mode } = activeTool(state);
  for (const chip of el.toolChips.children) {
    const c = /** @type {HTMLElement} */ (chip);
    const active = c.dataset.tool === tool.id;
    c.classList.toggle('active', active);
    c.setAttribute('aria-selected', String(active));
  }
  const values = toolValues(state, mode);
  const structureChanged = prev === null || prev.tools.tool !== state.tools.tool
    || prev.tools.modes[tool.id] !== state.tools.modes[tool.id] || prev.mode !== state.mode;
  if (structureChanged) {
    el.toolModes.hidden = tool.modes.length < 2;
    el.toolModes.replaceChildren(...tool.modes.map((m) => {
      const btn = Object.assign(document.createElement('button'), { className: 'seg-btn', textContent: m.label });
      btn.dataset.mode = m.id;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(m.id === mode.id));
      return btn;
    }));
    el.toolForm.replaceChildren(...mode.fields.map((f) => fieldNode(f, values[f.id] ?? '')));
  }
  for (const btn of el.toolForm.querySelectorAll('.preset')) {
    const b = /** @type {HTMLElement} */ (btn);
    b.classList.toggle('active', values[/** @type {string} */ (b.dataset.field)] === b.dataset.preset);
  }

  const rows = mode.compute(values);
  if (rows === null) {
    el.toolResults.replaceChildren(Object.assign(document.createElement('p'), { className: 'tool-hint', textContent: 'Fill in the fields to see the result.' }));
    return;
  }
  const ordered = [...rows.filter((r) => r.primary), ...rows.filter((r) => !r.primary)];
  el.toolResults.replaceChildren(...ordered.map((r) => {
    const line = Object.assign(document.createElement(r.primary ? 'button' : 'div'), { className: r.primary ? 'tool-row primary' : 'tool-row' });
    line.append(
      Object.assign(document.createElement('span'), { className: 'tool-label', textContent: r.label }),
      Object.assign(document.createElement('span'), { className: 'tool-value', textContent: group(state.settings, r.value) }),
    );
    if (r.primary) line.dataset.copy = r.value;
    return line;
  }));
}

// ---------- Graph ----------

const graphView = createGraphView(el.graphCanvas, el.graphReadout);
const GRAPH_COLORS = ['--graph-1', '--graph-2', '--graph-3'];
const REMOVE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

/**
 * One input row per function. Rebuilt only when rows are added or removed, so typing keeps focus.
 * @param {State} state
 */
function renderGraphRows(state) {
  el.graphFns.replaceChildren(...state.graph.fns.map((formula, i) => {
    const row = Object.assign(document.createElement('div'), { className: 'graph-fn' });
    row.style.setProperty('--fn-color', `var(${GRAPH_COLORS[i]})`);
    const input = Object.assign(document.createElement('input'), {
      type: 'text', value: formula, placeholder: 'e.g. 2x+1', spellcheck: false, autocomplete: 'off', enterKeyHint: 'done',
    });
    input.dataset.index = String(i);
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('aria-label', `Function ${i + 1}`);
    const remove = Object.assign(document.createElement('button'), { className: 'entry-icon', innerHTML: REMOVE_ICON });
    remove.dataset.remove = String(i);
    remove.setAttribute('aria-label', state.graph.fns.length > 1 ? 'Remove function' : 'Clear function');
    row.append(
      Object.assign(document.createElement('span'), { className: 'graph-dot' }),
      Object.assign(document.createElement('span'), { className: 'graph-y', textContent: 'y =' }),
      input,
      remove,
      Object.assign(document.createElement('span'), { className: 'graph-error' }),
    );
    return row;
  }));
  el.graphAdd.hidden = state.graph.fns.length >= MAX_GRAPHS;
}

/**
 * Compile every formula, show errors next to the bad ones, and plot the good ones.
 * @param {State} state
 */
function updateGraph(state) {
  /** @type {import('./graph-view.js').Curve[]} */
  const curves = [];
  state.graph.fns.forEach((formula, i) => {
    const row = el.graphFns.children[i];
    const error = /** @type {HTMLElement | null} */ (row?.querySelector('.graph-error') ?? null);
    /** @type {string} */
    let message = '';
    if (formula.trim() !== '') {
      try {
        curves.push({ fn: compileFunction(formula), color: GRAPH_COLORS[i] });
      } catch (err) {
        if (!(err instanceof CalcError)) throw err;
        message = err.message;
      }
    }
    if (error) error.textContent = message;
    row?.classList.toggle('invalid', message !== '');
  });
  graphView.setCurves(curves);
}

// Everything in the display must stay below the memory badge and DEG / f(x) buttons in its top corners.
const TOP_BUTTONS_CLEARANCE_PX = 40;
const MIN_MAIN_FONT_PX = 24;

/**
 * The last few answers, faded, above the current sum (oldest at the top).
 * Right after "=", the newest entry is the sum on screen, so it's skipped.
 * @param {State} state
 */
function renderRecent(state) {
  const entries = state.history.slice(state.result !== null ? 1 : 0).slice(0, state.settings.recent).reverse();
  el.recent.replaceChildren(...entries.map((entry, i) => {
    const li = document.createElement('li');
    const btn = Object.assign(document.createElement('button'), { className: 'recent-item' });
    btn.dataset.id = entry.id;
    btn.style.opacity = String(0.45 + (0.55 * (i + 1)) / entries.length);
    btn.setAttribute('aria-label', `Use ${fmt(state.settings, entry.result)} from ${entry.expr}`);
    btn.append(
      Object.assign(document.createElement('span'), { className: 'recent-expr', textContent: entry.label ?? entry.expr }),
      Object.assign(document.createElement('span'), { className: 'recent-result', textContent: `= ${fmt(state.settings, entry.result)}` }),
    );
    li.append(btn);
    return li;
  }));
}

/** Remove the oldest recent rows until the list sits clear of the display's top buttons. */
function fitRecent() {
  const top = () => el.recent.getBoundingClientRect().top - el.display.getBoundingClientRect().top;
  while (el.recent.firstElementChild && top() < TOP_BUTTONS_CLEARANCE_PX) el.recent.firstElementChild.remove();
}

/**
 * On short displays, shrink the big line (the sum while typing, the answer after "=") until
 * the sum sits clear of the top buttons. Call with the recent rows empty.
 * @param {boolean} done
 */
function fitDisplayHeight(done) {
  const main = done ? el.result : el.expr;
  const top = () => el.exprWrap.getBoundingClientRect().top - el.display.getBoundingClientRect().top;
  let size = Number.parseFloat(getComputedStyle(main).fontSize);
  while (top() < TOP_BUTTONS_CLEARANCE_PX && size > MIN_MAIN_FONT_PX) {
    size -= 2;
    main.style.fontSize = `${size}px`;
  }
}

// ---------- Settings ----------

const THEME_COLORS = { light: '#f4f2ee', dark: '#0d0e12' };
const themeMetas = /** @type {HTMLMetaElement[]} */ ([...document.querySelectorAll('meta[name="theme-color"]')]);

/**
 * Push settings that live outside the app's own markup: theme, key size, status-bar colour.
 * @param {Settings} settings
 */
function applySettings(settings) {
  const root = document.documentElement;
  if (settings.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = settings.theme;
  root.dataset.keySize = settings.keySize;
  for (const meta of themeMetas) {
    const systemColor = meta.media.includes('dark') ? THEME_COLORS.dark : THEME_COLORS.light;
    meta.content = settings.theme === 'system' ? systemColor : THEME_COLORS[settings.theme];
  }
  for (const seg of el.settingsBody.querySelectorAll('[data-setting]')) {
    const key = /** @type {keyof Settings} */ (/** @type {HTMLElement} */ (seg).dataset.setting);
    for (const btn of seg.children) {
      const b = /** @type {HTMLElement} */ (btn);
      b.setAttribute('aria-selected', String(b.dataset.value === String(settings[key])));
    }
  }
  graphView.redraw();
}

/** @type {AudioContext | null} */
let audio = null;

/** A short, quiet tick. Uses the "ambient" audio session so the iPhone silent switch mutes it. */
function playClick() {
  const nav = /** @type {Navigator & { audioSession?: { type: string } }} */ (navigator);
  if (nav.audioSession) nav.audioSession.type = 'ambient';
  audio ??= new AudioContext();
  if (audio.state === 'suspended') void audio.resume();
  const t = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1600, t);
  gain.gain.setValueAtTime(0.06, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  osc.connect(gain).connect(audio.destination);
  osc.start(t);
  osc.stop(t + 0.035);
}

/**
 * @param {State} state
 * @param {State | null} prev
 */
function render(state, prev) {
  const converting = state.mode === 'convert';
  const calculating = state.mode === 'calc';
  const tooling = state.mode === 'tools';
  const graphing = state.mode === 'graph';
  el.calcTab.setAttribute('aria-selected', String(calculating));
  el.convTab.setAttribute('aria-selected', String(converting));
  el.toolsTab.setAttribute('aria-selected', String(tooling));
  el.graphTab.setAttribute('aria-selected', String(graphing));
  el.calc.classList.toggle('conv-mode', converting);
  el.display.hidden = !calculating;
  el.mem.hidden = !calculating;
  el.conv.hidden = !converting;
  el.tools.hidden = !tooling;
  el.graph.hidden = !graphing;
  el.pad.hidden = tooling || graphing;
  if (prev === null || prev.graph.fns.length !== state.graph.fns.length) renderGraphRows(state);
  if (prev === null || prev.graph !== state.graph) updateGraph(state);
  if (tooling) renderTools(state, prev);
  el.memBadge.hidden = state.memory === null;
  el.memBadge.textContent = state.memory === null ? '' : `M  ${fmt(state.settings, state.memory)}`;
  if (converting) renderConverter(state);
  el.picker.classList.toggle('open', state.picker !== null);
  const pickerChanged = prev === null || prev.picker !== state.picker || prev.pickerQuery !== state.pickerQuery
    || prev.conv !== state.conv || prev.rates !== state.rates;
  if (pickerChanged) renderPicker(state);

  const done = state.result !== null;
  el.display.classList.toggle('done', done);
  el.display.classList.toggle('error', state.error !== null);

  el.expr.replaceChildren(exprNodes(state.expr, done ? null : cursorOf(state)));
  if (state.expr === '' && !done) {
    const zero = document.createElement('span');
    zero.className = 'ghost';
    zero.textContent = '0';
    el.expr.prepend(zero);
  }
  fitText(el.expr, el.exprWrap, done ? 28 : 64, done ? 18 : 34);
  if (!done && calculating) el.expr.querySelector('.caret')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });

  if (state.error !== null) {
    el.result.textContent = state.error;
  } else if (done) {
    const text = fmt(state.settings, /** @type {number} */ (state.result));
    el.result.textContent = text;
    fitText(el.result, el.result, 64, 28);
  } else {
    const preview = previewText(state);
    el.result.textContent = preview === '' ? '' : `= ${preview}`;
    el.result.style.fontSize = '';
  }

  el.angleBtn.textContent = state.angle.toUpperCase();
  el.sci.hidden = !state.sci || !calculating;
  el.calc.classList.toggle('sci-open', state.sci && calculating);
  el.sciBtn.setAttribute('aria-pressed', String(state.sci));
  el.secondBtn.classList.toggle('on', state.second);
  for (const btn of el.sci.querySelectorAll('[data-alt]')) {
    const b = /** @type {HTMLElement} */ (btn);
    b.textContent = state.second ? ALT_LABELS[/** @type {string} */ (b.dataset.alt)] : b.dataset.label ?? '';
  }

  el.history.classList.toggle('open', state.historyOpen);
  el.scrim.classList.toggle('show', state.historyOpen || state.picker !== null || state.settingsOpen);
  el.settings.classList.toggle('open', state.settingsOpen);
  if (prev === null || prev.settings !== state.settings) applySettings(state.settings);
  if (prev === null || prev.history !== state.history || prev.historyQuery !== state.historyQuery || prev.settings !== state.settings) {
    renderHistory(state.history, state.historyQuery, state.settings);
  }
  // Last, once the keys have taken their space: make the sum fit, then fill what's left with recent rows.
  if (calculating) {
    el.recent.replaceChildren();
    fitDisplayHeight(state.result !== null);
    renderRecent(state);
    fitRecent();
  }
}

// ---------- Wiring ----------

for (const btn of el.sci.querySelectorAll('[data-alt]')) {
  const b = /** @type {HTMLElement} */ (btn);
  b.dataset.label = b.textContent ?? '';
}

let state = loadState();
render(state, null);

/** @param {(s: State) => State} transition */
function dispatch(transition) {
  const prev = state;
  state = transition(state);
  if (state === prev) return;
  render(state, prev);
  persist(prev, state);
  if (state.error !== null && prev.error === null) {
    el.display.classList.remove('shake');
    void el.display.offsetWidth; // restart animation
    el.display.classList.add('shake');
  }
}

/** @param {string} key */
function handleMemoryKey(key) {
  switch (key) {
    case 'mc':
      dispatch((s) => ({ ...s, memory: null }));
      return showToast('Memory cleared');
    case 'mr':
      if (state.memory === null) return showToast('Memory is empty');
      return dispatch((s) => onInsert(s, /** @type {number} */ (s.memory)));
    case 'ans': {
      const last = state.history[0];
      if (last === undefined) return showToast('No previous answer yet');
      return dispatch((s) => onInsert(s, last.result));
    }
    case 'm+':
    case 'm−': {
      const value = currentValue(state);
      if (value === null) return showToast('Nothing to store yet');
      const signed = key === 'm+' ? value : -value;
      dispatch((s) => ({ ...s, memory: (s.memory ?? 0) + signed }));
      return showToast(`Memory: ${fmt(state.settings, /** @type {number} */ (state.memory))}`);
    }
    default: throw new Error(`Unknown memory key "${key}"`);
  }
}

/** @param {string} key */
function handleKey(key) {
  if (state.mode === 'tools' || state.mode === 'graph') return undefined;
  if (state.mode === 'convert') return dispatch((s) => onConvKey(s, key));
  switch (key) {
    case 'mc': case 'mr': case 'm+': case 'm−': case 'ans': return handleMemoryKey(key);
    case 'rand': return dispatch((s) => onInsert(s, Math.round(Math.random() * 1e10) / 1e10));
    case 'clear': return dispatch((s) => ({ ...s, expr: '', cursor: null, result: null, error: null }));
    case 'left': return dispatch((s) => moveCursor(s, -1));
    case 'right': return dispatch((s) => moveCursor(s, 1));
    case 'back': return dispatch(onBackspace);
    case 'equals': return dispatch((s) => onEquals(s, Date.now()));
    case '2nd': return dispatch((s) => ({ ...s, second: !s.second }));
    default: return dispatch((s) => onKey(s, key));
  }
}

// Hold − to flip the sign, hold ( to wrap the whole expression in brackets.
const LONG_PRESS = /** @type {Readonly<Record<string, string>>} */ ({ '−': 'neg', '(': 'wrap' });
const LONG_PRESS_MS = 450;
let longPressTimer = 0;
let suppressNextClick = false;

document.addEventListener('pointerdown', (event) => {
  const keyBtn = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (event.target).closest('.key'));
  const alt = keyBtn ? LONG_PRESS[/** @type {string} */ (keyBtn.dataset.key)] : undefined;
  if (!keyBtn || alt === undefined) return;
  clearTimeout(longPressTimer);
  longPressTimer = window.setTimeout(() => {
    suppressNextClick = true;
    handleKey(alt);
    keyBtn.classList.add('pressed');
    setTimeout(() => keyBtn.classList.remove('pressed'), 150);
  }, LONG_PRESS_MS);
});
for (const type of ['pointerup', 'pointercancel']) {
  document.addEventListener(type, () => clearTimeout(longPressTimer));
}

document.addEventListener('click', (event) => {
  const target = /** @type {HTMLElement} */ (event.target);
  const keyBtn = /** @type {HTMLElement | null} */ (target.closest('.key'));
  if (keyBtn && suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  if (keyBtn) {
    const key = state.second && keyBtn.dataset.alt ? keyBtn.dataset.alt : /** @type {string} */ (keyBtn.dataset.key);
    if (state.settings.sound) playClick();
    handleKey(key);
  }
});

el.angleBtn.addEventListener('click', () => dispatch((s) => ({ ...s, angle: s.angle === 'deg' ? 'rad' : 'deg', result: null })));
el.sciBtn.addEventListener('click', () => dispatch((s) => ({ ...s, sci: !s.sci })));
el.historyBtn.addEventListener('click', () => dispatch((s) => ({ ...s, historyOpen: true })));
el.settingsBtn.addEventListener('click', () => dispatch((s) => ({ ...s, settingsOpen: true })));
el.settingsClose.addEventListener('click', () => dispatch((s) => ({ ...s, settingsOpen: false })));
el.settingsBody.addEventListener('click', (event) => {
  const btn = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (event.target).closest('.seg-btn'));
  const seg = /** @type {HTMLElement | null} */ (btn?.closest('[data-setting]') ?? null);
  if (!btn || !seg) return;
  const key = /** @type {keyof Settings} */ (seg.dataset.setting);
  const value = SETTING_CHOICES[key].find((choice) => String(choice) === btn.dataset.value);
  if (value === undefined) throw new Error(`Unknown value "${btn.dataset.value}" for setting ${key}`);
  dispatch((s) => ({ ...s, settings: { ...s.settings, [key]: value } }));
  if (key === 'sound' && value === true) playClick(); // a sample, so you hear what you turned on
});
el.closeHistoryBtn.addEventListener('click', () => dispatch((s) => ({ ...s, historyOpen: false })));
el.scrim.addEventListener('click', () => dispatch((s) => ({ ...s, historyOpen: false, picker: null, settingsOpen: false })));
el.clearHistoryBtn.addEventListener('click', () => {
  if (confirm('Clear all history? This can’t be undone.')) dispatch((s) => ({ ...s, history: [] }));
});

/**
 * Swap an entry's label line for a text field; Enter or leaving the field saves it.
 * @param {HTMLElement} item
 * @param {HistoryEntry} entry
 */
function editLabel(item, entry) {
  const box = /** @type {HTMLElement} */ (item.querySelector('.entry'));
  box.querySelector('.entry-label')?.remove();
  const input = Object.assign(document.createElement('input'), {
    className: 'entry-label-input',
    value: entry.label ?? '',
    placeholder: 'Add a label, e.g. Electricity bill',
    maxLength: 60,
  });
  input.setAttribute('aria-label', 'Label');
  box.prepend(input);
  input.focus();
  let finished = false;
  const finish = (/** @type {boolean} */ save) => {
    if (finished) return;
    finished = true;
    if (save) dispatch((s) => ({ ...s, history: setLabel(s.history, entry.id, input.value) }));
    else renderHistory(state.history, state.historyQuery, state.settings);
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
}

el.historyList.addEventListener('click', (event) => {
  const btn = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (event.target).closest('[data-action]'));
  const item = /** @type {HTMLElement | null} */ (btn?.closest('.history-item') ?? null);
  if (!btn || !item) return;
  const entry = state.history.find((h) => h.id === item.dataset.id);
  if (!entry) throw new Error(`History entry ${item.dataset.id} not found`);
  switch (btn.dataset.action) {
    case 'load': return dispatch((s) => ({ ...s, mode: 'calc', expr: entry.expr, cursor: null, result: null, error: null, historyOpen: false }));
    case 'use': return dispatch((s) => onInsert(s, entry.result));
    case 'label': return editLabel(item, entry);
    case 'delete': return dispatch((s) => ({ ...s, history: s.history.filter((h) => h.id !== entry.id) }));
    default: throw new Error(`Unknown history action ${btn.dataset.action}`);
  }
});

// Re-fit the display when it changes size (rotation, scientific keys, window resize).
new ResizeObserver(() => {
  if (state.mode === 'calc') render(state, state);
}).observe(el.display);

el.recent.addEventListener('click', (event) => {
  const btn = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (event.target).closest('.recent-item'));
  if (!btn) return;
  const entry = state.history.find((h) => h.id === btn.dataset.id);
  if (!entry) throw new Error(`Recent entry ${btn.dataset.id} not found in history`);
  dispatch((s) => onInsert(s, entry.result));
});

el.historySearch.addEventListener('input', () => dispatch((s) => ({ ...s, historyQuery: el.historySearch.value })));

// ---------- Converter wiring ----------

for (const category of [{ id: CURRENCY, name: 'Currency' }, ...CATEGORIES]) {
  const chip = Object.assign(document.createElement('button'), { className: 'chip', textContent: category.name });
  chip.dataset.category = category.id;
  chip.setAttribute('role', 'tab');
  el.convChips.append(chip);
}

/**
 * GET with retries; warns on each failed attempt and throws the last error.
 * @param {string} url
 * @param {number} attempts
 * @returns {Promise<unknown>}
 */
async function fetchJsonWithRetry(url, attempts) {
  /** @type {unknown} */
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}: ${(await response.text()).slice(0, 200)}`);
      return await response.json();
    } catch (err) {
      lastError = err;
      console.warn(`Fetching ${url} failed (attempt ${attempt}/${attempts})`, err);
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
    }
  }
  throw lastError;
}

/** @param {boolean} force */
async function refreshRates(force) {
  const fresh = state.rates !== null && state.ratesFetchedAt !== null && Date.now() - state.ratesFetchedAt < RATES_MAX_AGE_MS;
  if (state.ratesStatus.kind === 'loading' || (fresh && !force)) return;
  dispatch((s) => ({ ...s, ratesStatus: { kind: 'loading', message: '' } }));
  try {
    const rates = parseRatesResponse(await fetchJsonWithRetry(RATES_URL, 3));
    dispatch((s) => ({ ...s, rates, ratesFetchedAt: Date.now(), ratesStatus: { kind: 'ok', message: '' } }));
  } catch (err) {
    console.error('Exchange rates unavailable', err);
    const message = navigator.onLine === false ? 'you’re offline' : 'the rates service didn’t respond';
    dispatch((s) => ({ ...s, ratesStatus: { kind: 'error', message } }));
  }
}

/** @param {State} s */
const needsRates = (s) => s.mode === 'convert' && s.conv.category === CURRENCY;

el.calcTab.addEventListener('click', () => dispatch((s) => ({ ...s, mode: 'calc' })));
el.toolsTab.addEventListener('click', () => dispatch((s) => ({ ...s, mode: 'tools' })));
el.graphTab.addEventListener('click', () => dispatch((s) => ({ ...s, mode: 'graph' })));

// ---------- Graph wiring ----------

/** @type {HTMLInputElement | null} */
let lastGraphInput = null;
const GRAPH_KEYS = [['x', 'x'], ['xʸ', '^'], ['x²', '^2'], ['√', '√('], ['(', '('], [')', ')'], ['π', 'π'], ['sin', 'sin('], ['cos', 'cos('], ['tan', 'tan('], ['ln', 'ln('], ['log', 'log('], ['e', 'e']];
for (const [label, text] of GRAPH_KEYS) {
  const key = Object.assign(document.createElement('button'), { className: 'graph-key', textContent: label });
  key.dataset.insert = text;
  el.graphKeys.append(key);
}
// Keep the text field focused (and the iPhone keyboard up) while tapping these keys.
el.graphKeys.addEventListener('pointerdown', (event) => event.preventDefault());
el.graphKeys.addEventListener('click', (event) => {
  const key = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (event.target).closest('.graph-key'));
  // The focused formula (keys don't take focus), else the last one used, else the first.
  const focused = document.activeElement instanceof HTMLInputElement && el.graphFns.contains(document.activeElement)
    ? document.activeElement
    : null;
  const input = focused ?? (lastGraphInput && el.graphFns.contains(lastGraphInput)
    ? lastGraphInput
    : /** @type {HTMLInputElement | null} */ (el.graphFns.querySelector('input')));
  if (!key || !input) return;
  const text = /** @type {string} */ (key.dataset.insert);
  input.focus();
  input.setRangeText(text, input.selectionStart ?? input.value.length, input.selectionEnd ?? input.value.length, 'end');
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
el.graphFns.addEventListener('focusin', (event) => {
  if (event.target instanceof HTMLInputElement) lastGraphInput = event.target;
});
el.graphFns.addEventListener('input', (event) => {
  const input = /** @type {HTMLInputElement} */ (event.target);
  const index = Number(input.dataset.index);
  dispatch((s) => ({ ...s, graph: { fns: s.graph.fns.map((f, i) => (i === index ? input.value : f)) } }));
});
el.graphFns.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') /** @type {HTMLInputElement} */ (event.target).blur();
});
el.graphFns.addEventListener('click', (event) => {
  const btn = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (event.target).closest('[data-remove]'));
  if (!btn) return;
  const index = Number(btn.dataset.remove);
  dispatch((s) => ({ ...s, graph: { fns: s.graph.fns.length > 1 ? s.graph.fns.filter((_, i) => i !== index) : [''] } }));
  renderGraphRows(state); // clearing the last row keeps the count, so redraw it explicitly
});
el.graphAdd.addEventListener('click', () => {
  dispatch((s) => (s.graph.fns.length >= MAX_GRAPHS ? s : { ...s, graph: { fns: [...s.graph.fns, ''] } }));
  /** @type {HTMLInputElement | null} */ (el.graphFns.querySelector('.graph-fn:last-child input'))?.focus();
});
el.graphReset.addEventListener('click', () => graphView.resetView());
el.convTab.addEventListener('click', () => {
  dispatch((s) => ({ ...s, mode: 'convert' }));
  if (needsRates(state)) void refreshRates(false);
});
el.convChips.addEventListener('click', (event) => {
  const chip = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (event.target).closest('.chip'));
  if (!chip) return;
  const category = /** @type {string} */ (chip.dataset.category);
  dispatch((s) => (s.conv.category === category ? s : { ...s, conv: { ...s.conv, category } }));
  chip.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  if (needsRates(state)) void refreshRates(false);
});
/** @param {'from' | 'to'} side */
function openPicker(side) {
  el.pickerSearch.value = '';
  dispatch((s) => ({ ...s, picker: side, pickerQuery: '' }));
  el.pickerList.scrollTop = 0;
  // Long currency lists start with the keyboard up; short unit lists don't need it.
  if (state.conv.category === CURRENCY) el.pickerSearch.focus();
}
el.fromPick.addEventListener('click', () => openPicker('from'));
el.toPick.addEventListener('click', () => openPicker('to'));
el.pickerClose.addEventListener('click', () => dispatch((s) => ({ ...s, picker: null })));
el.pickerSearch.addEventListener('input', () => dispatch((s) => ({ ...s, pickerQuery: el.pickerSearch.value })));
el.pickerSearch.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') dispatch((s) => ({ ...s, picker: null }));
  if (e.key === 'Enter') {
    const first = /** @type {HTMLElement | null} */ (el.pickerList.querySelector('.picker-item'));
    first?.click();
  }
});
el.pickerList.addEventListener('click', (event) => {
  const item = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (event.target).closest('.picker-item'));
  if (!item || state.picker === null) return;
  const side = state.picker;
  el.pickerSearch.blur();
  dispatch((s) => chooseUnit(s, /** @type {string} */ (item.dataset.category), side, /** @type {string} */ (item.dataset.id)));
  if (needsRates(state)) void refreshRates(false);
});
el.swapBtn.addEventListener('click', () => dispatch((s) => updateUnits(s, (u) => ({ from: u.to, to: u.from }))));
el.ratesRefreshBtn.addEventListener('click', () => void refreshRates(true));
el.toValue.addEventListener('click', () => {
  const amount = inputValue(state.conv.input);
  const converted = amount === null ? null : convertAmount(state, amount);
  if (converted === null) return;
  const value = toExpressionString(converted);
  void copyText(value);
});
if (needsRates(state)) void refreshRates(false);

// ---------- Tools wiring ----------

for (const tool of TOOLS) {
  const chip = Object.assign(document.createElement('button'), { className: 'chip', textContent: tool.name });
  chip.dataset.tool = tool.id;
  chip.setAttribute('role', 'tab');
  el.toolChips.append(chip);
}
el.toolChips.addEventListener('click', (event) => {
  const chip = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (event.target).closest('.chip'));
  if (!chip) return;
  const tool = /** @type {string} */ (chip.dataset.tool);
  dispatch((s) => (s.tools.tool === tool ? s : { ...s, tools: { ...s.tools, tool } }));
  chip.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
});
el.toolModes.addEventListener('click', (event) => {
  const btn = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (event.target).closest('.seg-btn'));
  if (!btn) return;
  const mode = /** @type {string} */ (btn.dataset.mode);
  dispatch((s) => ({ ...s, tools: { ...s.tools, modes: { ...s.tools.modes, [s.tools.tool]: mode } } }));
});
el.toolForm.addEventListener('submit', (event) => event.preventDefault());
el.toolForm.addEventListener('input', (event) => {
  const input = /** @type {HTMLInputElement} */ (event.target);
  dispatch((s) => setToolValue(s, input.name, input.value));
});
el.toolForm.addEventListener('click', (event) => {
  const target = /** @type {HTMLElement} */ (event.target);
  const preset = /** @type {HTMLElement | null} */ (target.closest('.preset'));
  const step = /** @type {HTMLElement | null} */ (target.closest('.step'));
  if (preset) {
    const fieldId = /** @type {string} */ (preset.dataset.field);
    const value = /** @type {string} */ (preset.dataset.preset);
    /** @type {HTMLInputElement} */ (el.toolForm.elements.namedItem(fieldId)).value = value;
    dispatch((s) => setToolValue(s, fieldId, value));
  }
  if (step) {
    const input = /** @type {HTMLInputElement} */ (/** @type {HTMLElement} */ (step.parentElement).querySelector('input'));
    const current = Number.parseInt(input.value, 10);
    const next = String(Math.max(1, (Number.isNaN(current) ? 1 : current) + Number(step.dataset.step)));
    input.value = next;
    dispatch((s) => setToolValue(s, input.name, next));
  }
});
el.toolResults.addEventListener('click', (event) => {
  const line = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (event.target).closest('[data-copy]'));
  if (!line) return;
  const text = /** @type {string} */ (line.dataset.copy);
  // Numbers are copied without separators so they paste cleanly; dates are copied as shown.
  const value = /^[\d,.+\-%]+$/.test(text) ? text.replace(/,/g, '') : text;
  void copyText(value);
});

el.result.addEventListener('click', () => {
  // Copy the full-precision value, whatever the decimal-places setting shows.
  const current = currentValue(state);
  const nothingShown = state.result === null && previewText(state) === '';
  const value = current === null || nothingShown ? '' : toExpressionString(current);
  if (value === '' || state.error !== null) return;
  void copyText(value);
});

/**
 * Expression index under a screen point, or null when the point isn't on the expression text.
 * @param {number} x
 * @param {number} y
 * @returns {number | null}
 */
function exprIndexAt(x, y) {
  const doc = /** @type {Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node, offset: number } | null }} */ (document);
  const hit = doc.caretPositionFromPoint
    ? doc.caretPositionFromPoint(x, y)
    : (() => { const r = document.caretRangeFromPoint(x, y); return r && { offsetNode: r.startContainer, offset: r.startOffset }; })();
  const span = hit?.offsetNode.parentElement?.closest('[data-start]');
  if (hit && span && el.expr.contains(span)) return Number(/** @type {HTMLElement} */ (span).dataset.start) + hit.offset;
  // Tapped beside the text: left edge means the start, anywhere else the end.
  const first = el.expr.querySelector('[data-start]');
  return first && x < first.getBoundingClientRect().left ? 0 : null;
}

// Tap the expression to move the cursor; swipe sideways (when it isn't scrolling) to delete.
/** @type {{ x: number, y: number, scrollable: boolean } | null} */
let gestureStart = null;
el.display.addEventListener('pointerdown', (e) => {
  gestureStart = { x: e.clientX, y: e.clientY, scrollable: el.exprWrap.scrollWidth > el.exprWrap.clientWidth };
});
el.display.addEventListener('pointerup', (e) => {
  const start = gestureStart;
  gestureStart = null;
  if (!start) return;
  const dx = Math.abs(e.clientX - start.x);
  const dy = Math.abs(e.clientY - start.y);
  if (dx > 40 && dy < 30 && !start.scrollable) {
    handleKey('back');
    return;
  }
  const onExpr = el.exprWrap.contains(/** @type {Node} */ (e.target));
  if (dx < 8 && dy < 8 && onExpr) {
    const index = exprIndexAt(e.clientX, e.clientY);
    dispatch((s) => {
      const pos = snapCursor(s.expr, index ?? s.expr.length);
      // Tapping a finished sum reopens it for editing.
      return withEdit({ ...s, result: null }, { expr: s.expr, cursor: pos });
    });
  }
});

const KEYBOARD = /** @type {Readonly<Record<string, string>>} */ ({
  '+': '+', '-': '−', '*': '×', x: '×', '/': '÷', '^': '^', '%': '%', '!': '!', '(': '(', ')': ')', '.': '.', ',': '.',
  Enter: 'equals', '=': 'equals', Backspace: 'back', Escape: 'clear', Delete: 'clear', p: 'π', e: 'e',
  ArrowLeft: 'left', ArrowRight: 'right',
});

document.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (/** @type {HTMLElement} */ (event.target).closest('input, select, textarea')) return;
  const key = /^[0-9]$/.test(event.key) ? event.key : KEYBOARD[event.key];
  if (key === undefined) return;
  event.preventDefault();
  if (key === 'clear' && (state.historyOpen || state.picker !== null || state.settingsOpen)) {
    dispatch((s) => ({ ...s, historyOpen: false, picker: null, settingsOpen: false }));
    return;
  }
  handleKey(key);
  const btn = document.querySelector(`.key[data-key="${CSS.escape(key)}"]`);
  if (btn) {
    btn.classList.add('pressed');
    setTimeout(() => btn.classList.remove('pressed'), 110);
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((err) => console.error('Service worker registration failed', err));
}
