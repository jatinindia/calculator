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

const FT2 = 0.09290304; // square foot in m²
const TOLA = 0.0116638038; // 180 grains, the 1833 British India standard, in kg

/**
 * An area unit defined in square feet (how Indian land units are recorded).
 * @param {string} id
 * @param {string} name
 * @param {string} symbol
 * @param {number} squareFeet
 * @returns {Unit}
 */
function sqft(id, name, symbol, squareFeet) {
  return linear(id, name, symbol, squareFeet * FT2);
}

/** @type {readonly Category[]} */
export const CATEGORIES = [
  {
    id: 'angle', name: 'Angle', units: [
      linear('deg', 'Degree', '°', 1),
      linear('rad', 'Radian', 'rad', 180 / Math.PI),
      linear('grad', 'Gradian', 'grad', 0.9),
      linear('arcmin', 'Arcminute', '′', 1 / 60),
      linear('arcsec', 'Arcsecond', '″', 1 / 3600),
      linear('mil', 'Mil (NATO)', 'mil', 360 / 6400),
      linear('turn', 'Turn', 'turn', 360),
    ],
  },
  {
    id: 'area', name: 'Area', units: [
      linear('mm2', 'Square millimetre', 'mm²', 1e-6),
      linear('cm2', 'Square centimetre', 'cm²', 1e-4),
      linear('m2', 'Square metre', 'm²', 1),
      linear('are', 'Are', 'a', 100),
      linear('decare', 'Decare', 'daa', 1000),
      linear('ha', 'Hectare', 'ha', 1e4),
      linear('km2', 'Square kilometre', 'km²', 1e6),
      linear('in2', 'Square inch', 'in²', 0.00064516),
      sqft('ft2', 'Square foot', 'ft²', 1),
      linear('yd2', 'Square yard', 'yd²', 0.83612736),
      linear('perch', 'Square perch (rod)', 'perch', 25.29285264),
      linear('rood', 'Rood', 'rood', 1011.7141056),
      linear('acre', 'Acre', 'ac', 4046.8564224),
      linear('mi2', 'Square mile', 'mi²', 2589988.110336),
      // India (all India unless a place is named)
      sqft('gaj', 'Gaj (square yard)', 'gaj', 9),
      sqft('cent', 'Cent (Kerala, Tamil Nadu, Karnataka)', 'cent', 435.6),
      sqft('decimal', 'Decimal (Bihar, Bengal, Odisha, Jharkhand)', 'dec', 435.6),
      sqft('guntha', 'Guntha (Maharashtra, Karnataka, Telangana, AP)', 'guntha', 1089),
      sqft('ground', 'Ground (Tamil Nadu)', 'ground', 2400),
      sqft('kuncham', 'Kuncham (Andhra Pradesh)', 'kuncham', 484),
      sqft('ankanam', 'Ankanam (Andhra Pradesh)', 'ankanam', 72),
      // Punjab and Haryana: killa = 8 kanal, kanal = 20 marla, marla = 9 sarsai
      sqft('killa', 'Killa (Punjab, Haryana)', 'killa', 43560),
      sqft('kanal', 'Kanal (Punjab, Haryana)', 'kanal', 5445),
      sqft('marla', 'Marla (Punjab, Haryana)', 'marla', 272.25),
      sqft('sarsai', 'Sarsai (Punjab, Haryana)', 'sarsai', 30.25),
      sqft('bigha_pb', 'Bigha (Punjab, Haryana)', 'bigha PB/HR', 21780),
      sqft('biswa_pb', 'Biswa (Punjab, Haryana)', 'biswa PB/HR', 1089),
      sqft('biswansi_pb', 'Biswansi (Punjab, Haryana)', 'biswansi PB/HR', 54.45),
      // Other states' bigha
      sqft('bigha_hp', 'Bigha (Himachal Pradesh)', 'bigha HP', 8712),
      sqft('bigha_uk_hill', 'Bigha (Uttarakhand hills)', 'bigha UK hills', 6806.25),
      sqft('bigha_uk_plain', 'Bigha (Uttarakhand plains)', 'bigha UK plains', 17424),
      sqft('nali_uk', 'Nali (Uttarakhand hills)', 'nali', 2160),
      sqft('bigha_rj_pucca', 'Bigha, pucca (Rajasthan)', 'bigha RJ pucca', 27225),
      sqft('bigha_rj_kachha', 'Bigha, kachha (Rajasthan)', 'bigha RJ kachha', 17424),
      sqft('bigha_gj', 'Bigha (Gujarat)', 'bigha GJ', 17424),
      sqft('bigha_mp', 'Bigha (Madhya Pradesh)', 'bigha MP', 12000),
      sqft('katha_mp', 'Katha (Madhya Pradesh)', 'katha MP', 600),
      sqft('bigha_up_east', 'Bigha (Eastern UP, Lucknow)', 'bigha UP east', 27225),
      sqft('bigha_up_west', 'Bigha (Western UP, 5 biswa)', 'bigha UP west', 6806.25),
      sqft('bigha_up_west_b', 'Bigha (Western UP, 6⅔ biswa)', 'bigha UP west 6⅔', 9075),
      sqft('biswa_up', 'Biswa (Uttar Pradesh)', 'biswa UP', 1361.25),
      sqft('biswansi_up', 'Biswansi (Uttar Pradesh)', 'biswansi UP', 68.0625),
      // Bihar and Jharkhand: katha differs by district; bigha = 20 katha, katha = 20 dhur
      sqft('bigha_patna', 'Bigha (Patna, Arrah)', 'bigha Patna', 27225),
      sqft('katha_patna', 'Katha (Patna, Arrah)', 'katha Patna', 1361.25),
      sqft('dhur_patna', 'Dhur (Patna, Arrah)', 'dhur Patna', 68.0625),
      sqft('dhurki_patna', 'Dhurki (Patna, Arrah)', 'dhurki Patna', 3.403125),
      sqft('bigha_hajipur', 'Bigha (Hajipur)', 'bigha Hajipur', 38025),
      sqft('katha_hajipur', 'Katha (Hajipur)', 'katha Hajipur', 1901.25),
      sqft('bigha_chhapra', 'Bigha (Chhapra)', 'bigha Chhapra', 34848),
      sqft('katha_chhapra', 'Katha (Chhapra)', 'katha Chhapra', 1742.4),
      sqft('bigha_bettiah', 'Bigha (Bettiah, West Champaran)', 'bigha Bettiah', 65340),
      sqft('katha_bettiah', 'Katha (Bettiah, West Champaran)', 'katha Bettiah', 3267),
      sqft('bigha_ranchi', 'Bigha (Ranchi)', 'bigha Ranchi', 14400),
      sqft('katha_ranchi', 'Katha (Ranchi)', 'katha Ranchi', 720),
      // West Bengal: bigha = 20 katha, katha = 16 chatak
      sqft('bigha_wb', 'Bigha (West Bengal)', 'bigha WB', 14400),
      sqft('katha_wb', 'Katha (West Bengal)', 'katha WB', 720),
      sqft('chatak_wb', 'Chatak (West Bengal)', 'chatak WB', 45),
      // Assam: pura = 4 bigha, bigha = 5 katha, katha = 20 lecha
      sqft('pura_assam', 'Pura (Assam)', 'pura Assam', 57600),
      sqft('bigha_assam', 'Bigha (Assam)', 'bigha Assam', 14400),
      sqft('katha_assam', 'Katha (Assam)', 'katha Assam', 2880),
      sqft('lecha_assam', 'Lecha (Assam)', 'lecha Assam', 144),
      // Nepal: ropani = 16 aana = 64 paisa = 256 daam (hills); bigha = 20 katha = 400 dhur (Terai)
      sqft('ropani', 'Ropani (Nepal)', 'ropani', 5476),
      sqft('aana_np', 'Aana (Nepal)', 'aana', 342.25),
      sqft('paisa_np', 'Paisa (Nepal)', 'paisa', 85.5625),
      sqft('daam_np', 'Daam (Nepal)', 'daam', 21.390625),
      sqft('bigha_np', 'Bigha (Nepal)', 'bigha Nepal', 72900),
      sqft('katha_np', 'Katha (Nepal)', 'katha Nepal', 3645),
      sqft('dhur_np', 'Dhur (Nepal)', 'dhur Nepal', 182.25),
    ],
  },
  {
    id: 'data', name: 'Data', units: [
      linear('bit', 'Bit', 'bit', 0.125),
      linear('nibble', 'Nibble', 'nibble', 0.5),
      linear('b', 'Byte', 'B', 1),
      linear('kbit', 'Kilobit', 'kbit', 125),
      linear('mbit', 'Megabit', 'Mbit', 1.25e5),
      linear('gbit', 'Gigabit', 'Gbit', 1.25e8),
      linear('tbit', 'Terabit', 'Tbit', 1.25e11),
      linear('kb', 'Kilobyte', 'KB', 1e3),
      linear('mb', 'Megabyte', 'MB', 1e6),
      linear('gb', 'Gigabyte', 'GB', 1e9),
      linear('tb', 'Terabyte', 'TB', 1e12),
      linear('pb', 'Petabyte', 'PB', 1e15),
      linear('eb', 'Exabyte', 'EB', 1e18),
      linear('kib', 'Kibibyte', 'KiB', 1024),
      linear('mib', 'Mebibyte', 'MiB', 1024 ** 2),
      linear('gib', 'Gibibyte', 'GiB', 1024 ** 3),
      linear('tib', 'Tebibyte', 'TiB', 1024 ** 4),
      linear('pib', 'Pebibyte', 'PiB', 1024 ** 5),
    ],
  },
  {
    id: 'energy', name: 'Energy', units: [
      linear('ev', 'Electronvolt', 'eV', 1.602176634e-19),
      linear('erg', 'Erg', 'erg', 1e-7),
      linear('j', 'Joule', 'J', 1),
      linear('kj', 'Kilojoule', 'kJ', 1000),
      linear('mj', 'Megajoule', 'MJ', 1e6),
      linear('gj', 'Gigajoule', 'GJ', 1e9),
      linear('cal', 'Calorie', 'cal', 4.184),
      linear('kcal', 'Kilocalorie (food Calorie)', 'kcal', 4184),
      linear('wh', 'Watt-hour', 'Wh', 3600),
      linear('kwh', 'Kilowatt-hour (unit of electricity)', 'kWh', 3.6e6),
      linear('mwh', 'Megawatt-hour', 'MWh', 3.6e9),
      linear('btu', 'British thermal unit', 'BTU', 1055.05585262),
      linear('ftlbf', 'Foot-pound', 'ft·lbf', 1.3558179483314004),
      linear('tnt', 'Tonne of TNT', 't TNT', 4.184e9),
    ],
  },
  {
    id: 'force', name: 'Force', units: [
      linear('dyn', 'Dyne', 'dyn', 1e-5),
      linear('n', 'Newton', 'N', 1),
      linear('kn', 'Kilonewton', 'kN', 1000),
      linear('mn', 'Meganewton', 'MN', 1e6),
      linear('gf', 'Gram-force', 'gf', 0.00980665),
      linear('kgf', 'Kilogram-force', 'kgf', 9.80665),
      linear('tf', 'Tonne-force', 'tf', 9806.65),
      linear('pdl', 'Poundal', 'pdl', 0.138254954376),
      linear('ozf', 'Ounce-force', 'ozf', 0.27801385095378125),
      linear('lbf', 'Pound-force', 'lbf', 4.4482216152605),
      linear('kip', 'Kip', 'kip', 4448.2216152605),
    ],
  },
  {
    // Base unit km/L. Litres per 100 km is the reciprocal, so it can't be a plain factor.
    id: 'fuel', name: 'Fuel economy', units: [
      linear('kml', 'Kilometres per litre', 'km/L', 1),
      { id: 'l100km', name: 'Litres per 100 km', symbol: 'L/100 km', toBase: (n) => 100 / n, fromBase: (n) => 100 / n },
      linear('mpgus', 'Miles per gallon (US)', 'mpg US', 1.609344 / 3.785411784),
      linear('mpguk', 'Miles per gallon (UK)', 'mpg UK', 1.609344 / 4.54609),
      linear('mil', 'Miles per litre', 'mi/L', 1.609344),
      linear('kmgal', 'Kilometres per gallon (US)', 'km/gal US', 1 / 3.785411784),
    ],
  },
  {
    id: 'length', name: 'Length', units: [
      linear('nm', 'Nanometre', 'nm', 1e-9),
      linear('um', 'Micrometre', 'µm', 1e-6),
      linear('mm', 'Millimetre', 'mm', 0.001),
      linear('cm', 'Centimetre', 'cm', 0.01),
      linear('dm', 'Decimetre', 'dm', 0.1),
      linear('m', 'Metre', 'm', 1),
      linear('km', 'Kilometre', 'km', 1000),
      linear('thou', 'Thou (mil)', 'thou', 0.0000254),
      linear('in', 'Inch', 'in', 0.0254),
      linear('hand', 'Hand', 'hand', 0.1016),
      linear('ft', 'Foot', 'ft', 0.3048),
      linear('yd', 'Yard', 'yd', 0.9144),
      linear('fathom', 'Fathom', 'ftm', 1.8288),
      linear('rod', 'Rod', 'rod', 5.0292),
      linear('chain', 'Chain', 'ch', 20.1168),
      linear('furlong', 'Furlong', 'fur', 201.168),
      linear('mi', 'Mile', 'mi', 1609.344),
      linear('league', 'League', 'lea', 4828.032),
      linear('nmi', 'Nautical mile', 'nmi', 1852),
      linear('angstrom', 'Ångström', 'Å', 1e-10),
      linear('au', 'Astronomical unit', 'au', 149597870700),
      linear('ly', 'Light-year', 'ly', 9.4607304725808e15),
      linear('pc', 'Parsec', 'pc', 3.0856775814913673e16),
      // India
      linear('gaj', 'Gaj (yard)', 'gaj', 0.9144),
      linear('hath', 'Hath (cubit, 18 in)', 'hath', 0.4572),
      linear('karam', 'Karam (Punjab, Haryana; 5½ ft)', 'karam', 1.6764),
    ],
  },
  {
    id: 'numbers', name: 'Numbers', units: [
      linear('one', 'One', '1', 1),
      linear('dozen', 'Dozen', 'dozen', 12),
      linear('score', 'Score', 'score', 20),
      linear('hundred', 'Hundred', 'hundred', 100),
      linear('gross', 'Gross', 'gross', 144),
      linear('thousand', 'Thousand', 'thousand', 1e3),
      linear('lakh', 'Lakh', 'lakh', 1e5),
      linear('million', 'Million', 'million', 1e6),
      linear('crore', 'Crore', 'crore', 1e7),
      linear('arab', 'Arab (100 crore)', 'arab', 1e9),
      linear('billion', 'Billion', 'billion', 1e9),
      linear('kharab', 'Kharab (100 arab)', 'kharab', 1e11),
      linear('trillion', 'Trillion', 'trillion', 1e12),
      linear('neel', 'Neel (100 kharab)', 'neel', 1e13),
      linear('padma', 'Padma (100 neel)', 'padma', 1e15),
      linear('quadrillion', 'Quadrillion', 'quadrillion', 1e15),
      linear('shankh', 'Shankh (100 padma)', 'shankh', 1e17),
    ],
  },
  {
    id: 'power', name: 'Power', units: [
      linear('mw_milli', 'Milliwatt', 'mW', 0.001),
      linear('w', 'Watt', 'W', 1),
      linear('kw', 'Kilowatt', 'kW', 1000),
      linear('mw', 'Megawatt', 'MW', 1e6),
      linear('gw', 'Gigawatt', 'GW', 1e9),
      linear('hp', 'Horsepower (mechanical)', 'hp', 745.69987158227022),
      linear('ps', 'Horsepower (metric, PS)', 'PS', 735.49875),
      linear('btuh', 'BTU per hour', 'BTU/h', 0.29307107017222),
      linear('tr', 'Ton of refrigeration (AC tonnage)', 'TR', 3516.8528420667),
      linear('kcalh', 'Kilocalorie per hour', 'kcal/h', 4184 / 3600),
      linear('cals', 'Calorie per second', 'cal/s', 4.184),
      linear('ftlbfs', 'Foot-pound per second', 'ft·lbf/s', 1.3558179483314004),
    ],
  },
  {
    id: 'pressure', name: 'Pressure', units: [
      linear('pa', 'Pascal', 'Pa', 1),
      linear('hpa', 'Hectopascal', 'hPa', 100),
      linear('kpa', 'Kilopascal', 'kPa', 1000),
      linear('mpa', 'Megapascal', 'MPa', 1e6),
      linear('mbar', 'Millibar', 'mbar', 100),
      linear('bar', 'Bar', 'bar', 1e5),
      linear('atm', 'Atmosphere', 'atm', 101325),
      linear('at', 'Technical atmosphere (kgf/cm²)', 'at', 98066.5),
      linear('psi', 'Pound per square inch', 'psi', 6894.757293168),
      linear('ksi', 'Kilopound per square inch', 'ksi', 6894757.293168),
      linear('torr', 'Torr', 'Torr', 101325 / 760),
      linear('mmhg', 'Millimetre of mercury', 'mmHg', 133.322387415),
      linear('inhg', 'Inch of mercury', 'inHg', 3386.389),
      linear('cmh2o', 'Centimetre of water', 'cmH₂O', 98.0665),
      linear('inh2o', 'Inch of water', 'inH₂O', 249.08891),
    ],
  },
  {
    id: 'speed', name: 'Speed', units: [
      linear('cms', 'Centimetres per second', 'cm/s', 0.01),
      linear('ms', 'Metres per second', 'm/s', 1),
      linear('kmh', 'Kilometres per hour', 'km/h', 1 / 3.6),
      linear('kms', 'Kilometres per second', 'km/s', 1000),
      linear('fts', 'Feet per second', 'ft/s', 0.3048),
      linear('mph', 'Miles per hour', 'mph', 0.44704),
      linear('kn', 'Knot', 'kn', 1852 / 3600),
      linear('mach', 'Mach (sea level, 15 °C)', 'Mach', 340.294),
      linear('c0', 'Speed of light', 'c', 299792458),
    ],
  },
  {
    id: 'temperature', name: 'Temperature', units: [
      { id: 'c', name: 'Celsius', symbol: '°C', toBase: (n) => n, fromBase: (n) => n },
      { id: 'f', name: 'Fahrenheit', symbol: '°F', toBase: (n) => (n - 32) * 5 / 9, fromBase: (n) => n * 9 / 5 + 32 },
      { id: 'k', name: 'Kelvin', symbol: 'K', toBase: (n) => n - 273.15, fromBase: (n) => n + 273.15 },
      { id: 'r', name: 'Rankine', symbol: '°R', toBase: (n) => n * 5 / 9 - 273.15, fromBase: (n) => (n + 273.15) * 9 / 5 },
      { id: 're', name: 'Réaumur', symbol: '°Ré', toBase: (n) => n * 1.25, fromBase: (n) => n * 0.8 },
    ],
  },
  {
    id: 'time', name: 'Time', units: [
      linear('ns', 'Nanosecond', 'ns', 1e-9),
      linear('us', 'Microsecond', 'µs', 1e-6),
      linear('ms', 'Millisecond', 'ms', 0.001),
      linear('s', 'Second', 's', 1),
      linear('min', 'Minute', 'min', 60),
      linear('h', 'Hour', 'h', 3600),
      linear('d', 'Day', 'd', 86400),
      linear('wk', 'Week', 'wk', 604800),
      linear('fortnight', 'Fortnight', 'fortnight', 1209600),
      linear('mo', 'Month (average)', 'mo', 2629746),
      linear('yr', 'Year (average)', 'yr', 31556952),
      linear('decade', 'Decade', 'decade', 315569520),
      linear('century', 'Century', 'century', 3155695200),
      linear('millennium', 'Millennium', 'millennium', 31556952000),
    ],
  },
  {
    id: 'volume', name: 'Volume', units: [
      linear('mm3', 'Cubic millimetre', 'mm³', 1e-6),
      linear('ml', 'Millilitre', 'mL', 0.001),
      linear('cm3', 'Cubic centimetre', 'cm³', 0.001),
      linear('cl', 'Centilitre', 'cL', 0.01),
      linear('dl', 'Decilitre', 'dL', 0.1),
      linear('l', 'Litre', 'L', 1),
      linear('m3', 'Cubic metre', 'm³', 1000),
      linear('tspm', 'Teaspoon (metric)', 'tsp', 0.005),
      linear('tbspm', 'Tablespoon (metric)', 'tbsp', 0.015),
      linear('cupm', 'Cup (metric)', 'cup', 0.25),
      linear('tsp', 'Teaspoon (US)', 'tsp US', 0.00492892159375),
      linear('tbsp', 'Tablespoon (US)', 'tbsp US', 0.01478676478125),
      linear('floz', 'Fluid ounce (US)', 'fl oz US', 0.0295735295625),
      linear('cup', 'Cup (US)', 'cup US', 0.2365882365),
      linear('pt', 'Pint (US)', 'pt US', 0.473176473),
      linear('qt', 'Quart (US)', 'qt US', 0.946352946),
      linear('gal', 'Gallon (US)', 'gal US', 3.785411784),
      linear('flozuk', 'Fluid ounce (UK)', 'fl oz UK', 0.0284130625),
      linear('ptuk', 'Pint (UK)', 'pt UK', 0.56826125),
      linear('qtuk', 'Quart (UK)', 'qt UK', 1.1365225),
      linear('galuk', 'Gallon (UK)', 'gal UK', 4.54609),
      linear('in3', 'Cubic inch', 'in³', 0.016387064),
      linear('ft3', 'Cubic foot', 'ft³', 28.316846592),
      linear('yd3', 'Cubic yard', 'yd³', 764.554857984),
      linear('bbl', 'Barrel (oil)', 'bbl', 158.987294928),
      linear('acreft', 'Acre-foot', 'ac·ft', 1233481.83754752),
    ],
  },
  {
    id: 'weight', name: 'Weight', units: [
      linear('ug', 'Microgram', 'µg', 1e-9),
      linear('mg', 'Milligram', 'mg', 1e-6),
      linear('g', 'Gram', 'g', 0.001),
      linear('kg', 'Kilogram', 'kg', 1),
      linear('quintal', 'Quintal', 'q', 100),
      linear('t', 'Tonne', 't', 1000),
      linear('gr', 'Grain', 'gr', 0.00006479891),
      linear('ct', 'Carat', 'ct', 0.0002),
      linear('oz', 'Ounce', 'oz', 0.028349523125),
      linear('ozt', 'Troy ounce', 'oz t', 0.0311034768),
      linear('lb', 'Pound', 'lb', 0.45359237),
      linear('st', 'Stone', 'st', 6.35029318),
      linear('shton', 'Short ton (US)', 'ton US', 907.18474),
      linear('lgton', 'Long ton (UK)', 'ton UK', 1016.0469088),
      // India, 1833 British India standard: maund = 40 seer, seer = 80 tola, tola = 12 masha, masha = 8 ratti
      linear('ratti', 'Ratti', 'ratti', TOLA / 96),
      linear('masha', 'Masha', 'masha', TOLA / 12),
      linear('tola', 'Tola', 'tola', TOLA),
      linear('chhatank', 'Chhatank', 'chhatank', TOLA * 5),
      linear('seer', 'Seer', 'seer', TOLA * 80),
      linear('maund', 'Maund', 'maund', TOLA * 3200),
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
  // Own properties only, so names like "toString" can't resolve to Object.prototype members.
  if (!Object.hasOwn(rates, from)) throw new Error(`No rate for ${from}`);
  if (!Object.hasOwn(rates, to)) throw new Error(`No rate for ${to}`);
  return from === to ? value : (value / rates[from]) * rates[to];
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
  const rates = sanitizeRates(obj.rates);
  const valid = typeof obj.base_code === 'string' && typeof obj.time_last_update_unix === 'number' && rates !== null;
  if (!valid) throw new Error(`Unexpected rates response: ${JSON.stringify(json).slice(0, 200)}`);
  return {
    base: /** @type {string} */ (obj.base_code),
    updatedAt: /** @type {number} */ (obj.time_last_update_unix) * 1000,
    rates,
  };
}

const CURRENCY_CODE = /^[A-Z]{3}$/;

/**
 * Keep only three-letter currency codes. Returns null if there are none, or if any code
 * has a rate that isn't a finite positive number (the data can't be trusted then).
 * Used for both network responses and rates read back from storage.
 * @param {unknown} value
 * @returns {Record<string, number> | null}
 */
export function sanitizeRates(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const entries = Object.entries(value).filter(([code]) => CURRENCY_CODE.test(code));
  const allValid = entries.every(([, rate]) => typeof rate === 'number' && Number.isFinite(rate) && rate > 0);
  return entries.length > 0 && allValid ? Object.fromEntries(entries) : null;
}

/** @typedef {{ id: string, code: string, name: string, category: string }} PickerOption */

/**
 * Every unit in every category, for searching across all of them.
 * @returns {PickerOption[]}
 */
export function allUnitOptions() {
  return CATEGORIES.flatMap((c) => c.units.map((u) => ({ id: u.id, code: u.symbol, name: u.name, category: c.id })));
}

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
