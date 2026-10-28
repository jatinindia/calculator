// Unit and currency conversion. Pure data + pure functions.

/** @typedef {{ id: string, name: string, symbol: string, toBase: (n: number) => number, fromBase: (n: number) => number }} Unit */
/** @typedef {{ id: string, name: string, units: Unit[] }} Category */
/** @typedef {{ base: string, updatedAt: number, rates: Record<string, number> }} RatesSnapshot */

/**
 * A unit that is a fixed multiple of its category's base unit.
 * @param {string} id
 * @param {string} name
 * @param {string} symbol
 * @param {number} factor how many base units one of this unit is
 * @returns {Unit}
 */
function linear(id, name, symbol, factor) {
  return { id, name, symbol, toBase: (n) => n * factor, fromBase: (n) => n / factor };
}

/** @type {readonly Category[]} */
export const CATEGORIES = [
  {
    id: 'length', name: 'Length', units: [
      linear('mm', 'Millimetre', 'mm', 0.001),
      linear('cm', 'Centimetre', 'cm', 0.01),
      linear('m', 'Metre', 'm', 1),
      linear('km', 'Kilometre', 'km', 1000),
      linear('in', 'Inch', 'in', 0.0254),
      linear('ft', 'Foot', 'ft', 0.3048),
      linear('yd', 'Yard', 'yd', 0.9144),
      linear('mi', 'Mile', 'mi', 1609.344),
      linear('nmi', 'Nautical mile', 'nmi', 1852),
    ],
  },
  {
    id: 'weight', name: 'Weight', units: [
      linear('mg', 'Milligram', 'mg', 1e-6),
      linear('g', 'Gram', 'g', 0.001),
      linear('kg', 'Kilogram', 'kg', 1),
      linear('t', 'Tonne', 't', 1000),
      linear('oz', 'Ounce', 'oz', 0.028349523125),
      linear('lb', 'Pound', 'lb', 0.45359237),
      linear('st', 'Stone', 'st', 6.35029318),
      linear('ct', 'Carat', 'ct', 0.0002),
      linear('tola', 'Tola', 'tola', 0.0116638125),
    ],
  },
  {
    id: 'temperature', name: 'Temperature', units: [
      { id: 'c', name: 'Celsius', symbol: '°C', toBase: (n) => n, fromBase: (n) => n },
      { id: 'f', name: 'Fahrenheit', symbol: '°F', toBase: (n) => (n - 32) * 5 / 9, fromBase: (n) => n * 9 / 5 + 32 },
      { id: 'k', name: 'Kelvin', symbol: 'K', toBase: (n) => n - 273.15, fromBase: (n) => n + 273.15 },
    ],
  },
  {
    id: 'area', name: 'Area', units: [
      linear('mm2', 'Square millimetre', 'mm²', 1e-6),
      linear('cm2', 'Square centimetre', 'cm²', 1e-4),
      linear('m2', 'Square metre', 'm²', 1),
      linear('ha', 'Hectare', 'ha', 1e4),
      linear('km2', 'Square kilometre', 'km²', 1e6),
      linear('in2', 'Square inch', 'in²', 0.00064516),
      linear('ft2', 'Square foot', 'ft²', 0.09290304),
      linear('yd2', 'Square yard', 'yd²', 0.83612736),
      linear('acre', 'Acre', 'ac', 4046.8564224),
      linear('mi2', 'Square mile', 'mi²', 2589988.110336),
    ],
  },
  {
    id: 'volume', name: 'Volume', units: [
      linear('ml', 'Millilitre', 'mL', 0.001),
      linear('l', 'Litre', 'L', 1),
      linear('m3', 'Cubic metre', 'm³', 1000),
      linear('tsp', 'Teaspoon (US)', 'tsp', 0.00492892159375),
      linear('tbsp', 'Tablespoon (US)', 'tbsp', 0.01478676478125),
      linear('floz', 'Fluid ounce (US)', 'fl oz', 0.0295735295625),
      linear('cup', 'Cup (US)', 'cup', 0.2365882365),
      linear('pt', 'Pint (US)', 'pt', 0.473176473),
      linear('qt', 'Quart (US)', 'qt', 0.946352946),
      linear('gal', 'Gallon (US)', 'gal', 3.785411784),
      linear('galuk', 'Gallon (UK)', 'gal UK', 4.54609),
      linear('ft3', 'Cubic foot', 'ft³', 28.316846592),
    ],
  },
  {
    id: 'speed', name: 'Speed', units: [
      linear('ms', 'Metres per second', 'm/s', 1),
      linear('kmh', 'Kilometres per hour', 'km/h', 1 / 3.6),
      linear('mph', 'Miles per hour', 'mph', 0.44704),
      linear('kn', 'Knot', 'kn', 1852 / 3600),
      linear('fts', 'Feet per second', 'ft/s', 0.3048),
    ],
  },
  {
    id: 'time', name: 'Time', units: [
      linear('ms', 'Millisecond', 'ms', 0.001),
      linear('s', 'Second', 's', 1),
      linear('min', 'Minute', 'min', 60),
      linear('h', 'Hour', 'h', 3600),
      linear('d', 'Day', 'd', 86400),
      linear('wk', 'Week', 'wk', 604800),
      linear('mo', 'Month (average)', 'mo', 2629746),
      linear('yr', 'Year (average)', 'yr', 31556952),
    ],
  },
  {
    id: 'data', name: 'Data', units: [
      linear('bit', 'Bit', 'bit', 0.125),
      linear('b', 'Byte', 'B', 1),
      linear('kb', 'Kilobyte', 'KB', 1e3),
      linear('mb', 'Megabyte', 'MB', 1e6),
      linear('gb', 'Gigabyte', 'GB', 1e9),
      linear('tb', 'Terabyte', 'TB', 1e12),
      linear('kib', 'Kibibyte', 'KiB', 1024),
      linear('mib', 'Mebibyte', 'MiB', 1024 ** 2),
      linear('gib', 'Gibibyte', 'GiB', 1024 ** 3),
      linear('tib', 'Tebibyte', 'TiB', 1024 ** 4),
    ],
  },
  {
    id: 'pressure', name: 'Pressure', units: [
      linear('pa', 'Pascal', 'Pa', 1),
      linear('kpa', 'Kilopascal', 'kPa', 1000),
      linear('bar', 'Bar', 'bar', 1e5),
      linear('psi', 'Pound per sq inch', 'psi', 6894.757293168),
      linear('atm', 'Atmosphere', 'atm', 101325),
      linear('mmhg', 'Millimetre of mercury', 'mmHg', 133.322387415),
    ],
  },
  {
    id: 'energy', name: 'Energy', units: [
      linear('j', 'Joule', 'J', 1),
      linear('kj', 'Kilojoule', 'kJ', 1000),
      linear('cal', 'Calorie', 'cal', 4.184),
      linear('kcal', 'Kilocalorie', 'kcal', 4184),
      linear('wh', 'Watt-hour', 'Wh', 3600),
      linear('kwh', 'Kilowatt-hour', 'kWh', 3.6e6),
      linear('btu', 'British thermal unit', 'BTU', 1055.05585262),
    ],
  },
  {
    id: 'angle', name: 'Angle', units: [
      linear('deg', 'Degree', '°', 1),
      linear('rad', 'Radian', 'rad', 180 / Math.PI),
      linear('grad', 'Gradian', 'grad', 0.9),
      linear('turn', 'Turn', 'turn', 360),
    ],
  },
];

/**
 * @param {string} categoryId
 * @returns {Category}
 */
export function findCategory(categoryId) {
  const category = CATEGORIES.find((c) => c.id === categoryId);
  if (!category) throw new Error(`Unknown category "${categoryId}"`);
  return category;
}

/**
 * @param {Category} category
 * @param {string} unitId
 * @returns {Unit}
 */
export function findUnit(category, unitId) {
  const unit = category.units.find((u) => u.id === unitId);
  if (!unit) throw new Error(`Unknown unit "${unitId}" in ${category.id}`);
  return unit;
}

/**
 * @param {number} value
 * @param {string} categoryId
 * @param {string} fromId
 * @param {string} toId
 * @returns {number}
 */
export function convertUnit(value, categoryId, fromId, toId) {
  const category = findCategory(categoryId);
  return findUnit(category, toId).fromBase(findUnit(category, fromId).toBase(value));
}

/**
 * Rates are "units of currency per one base currency", all sharing one base.
 * @param {number} value
 * @param {string} from
 * @param {string} to
 * @param {Readonly<Record<string, number>>} rates
 * @returns {number}
 */
export function convertCurrency(value, from, to, rates) {
  const fromRate = rates[from];
  const toRate = rates[to];
  if (fromRate === undefined) throw new Error(`No rate for ${from}`);
  if (toRate === undefined) throw new Error(`No rate for ${to}`);
  return from === to ? value : (value / fromRate) * toRate;
}

/**
 * Validate a response from https://open.er-api.com/v6/latest/<BASE>.
 * @param {unknown} json
 * @returns {RatesSnapshot}
 */
export function parseRatesResponse(json) {
  const obj = /** @type {Record<string, unknown>} */ (typeof json === 'object' && json !== null ? json : {});
  if (obj.result !== 'success') {
    throw new Error(`Rates service returned an error: ${String(obj['error-type'] ?? JSON.stringify(json))}`);
  }
  const rates = obj.rates;
  const valid = typeof obj.base_code === 'string'
    && typeof obj.time_last_update_unix === 'number'
    && typeof rates === 'object' && rates !== null
    && Object.values(rates).every((r) => typeof r === 'number' && r > 0);
  if (!valid) throw new Error(`Unexpected rates response: ${JSON.stringify(json).slice(0, 200)}`);
  return {
    base: /** @type {string} */ (obj.base_code),
    updatedAt: /** @type {number} */ (obj.time_last_update_unix) * 1000,
    rates: /** @type {Record<string, number>} */ (rates),
  };
}

/** @typedef {{ id: string, code: string, name: string }} PickerOption */

/**
 * Filter picker options by a search query, best matches first:
 * exact code, code prefix, word prefix in the name, then anywhere.
 * @param {readonly PickerOption[]} options
 * @param {string} query
 * @returns {readonly PickerOption[]}
 */
export function searchOptions(options, query) {
  const q = query.trim().toLowerCase();
  if (q === '') return options;
  /** @param {PickerOption} option */
  const score = (option) => {
    const code = option.code.toLowerCase();
    const name = option.name.toLowerCase();
    if (code === q) return 0;
    if (code.startsWith(q)) return 1;
    if (name.split(/[\s()-]+/).some((word) => word.startsWith(q))) return 2;
    if (name.includes(q) || code.includes(q)) return 3;
    return -1;
  };
  return options
    .map((option, index) => ({ option, index, rank: score(option) }))
    .filter((r) => r.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((r) => r.option);
}
