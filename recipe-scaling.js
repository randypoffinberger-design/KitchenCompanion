(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SKRecipeScaling = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const GLYPHS = Object.freeze({'⅛':.125,'¼':.25,'⅓':1/3,'⅜':.375,'½':.5,'⅝':.625,'⅔':2/3,'¾':.75,'⅞':.875});
  const TOKEN = '(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?[⅛¼⅓⅜½⅝⅔¾⅞]?|[⅛¼⅓⅜½⅝⅔¾⅞])';

  function parseToken(value) {
    const text = String(value || '').trim();
    const compact = text.match(/^(\d+)?([⅛¼⅓⅜½⅝⅔¾⅞])$/);
    if (compact) return Number(compact[1] || 0) + GLYPHS[compact[2]];
    if (text.includes(' ')) {
      const [whole, fraction] = text.split(/\s+/, 2);
      return Number(whole) + parseToken(fraction);
    }
    if (text.includes('/')) {
      const [numerator, denominator] = text.split('/').map(Number);
      return numerator / denominator;
    }
    return Number(text);
  }

  function parseRange(value) {
    const match = String(value || '').trim().match(new RegExp(`^(${TOKEN})\\s*[–—-]\\s*(${TOKEN})(?:\\s+(.*))?$`));
    if (!match) return null;
    const low = parseToken(match[1]);
    const high = parseToken(match[2]);
    if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
    return { low, high, suffix:(match[3] || '').trim() };
  }

  function formatNumber(value) {
    const whole = Math.floor(value + 1e-8);
    const fraction = value - whole;
    const options = [[.125,'⅛'],[.25,'¼'],[.333,'⅓'],[.375,'⅜'],[.5,'½'],[.625,'⅝'],[.667,'⅔'],[.75,'¾'],[.875,'⅞']];
    let best = null;
    options.forEach(([decimal,glyph]) => { if (!best || Math.abs(fraction-decimal) < best.diff) best={diff:Math.abs(fraction-decimal),glyph}; });
    if (best && best.diff < .035) return `${whole || ''}${best.glyph}`;
    return Number(value.toFixed(3)).toString();
  }

  function scaleRange(range, scale) {
    const result = `${formatNumber(range.low * scale)}–${formatNumber(range.high * scale)}`;
    return range.suffix ? `${result} ${range.suffix}` : result;
  }

  function parseIngredientText(value) {
    const parsed = parseRange(value);
    if (!parsed || !parsed.suffix) return null;
    const match = parsed.suffix.match(/^(\S+)(?:\s+(.*))?$/);
    if (!match) return null;
    const candidate = match[1].replace(/[.,]$/, '');
    const units = new Set(['cup','cups','tbsp','tablespoon','tablespoons','tsp','teaspoon','teaspoons','oz','ounce','ounces','lb','lbs','pound','pounds','g','gram','grams','kg','ml','mL','l','L','liter','liters','clove','cloves','can','cans','package','packages','packet','packets','stick','sticks','slice','slices','piece','pieces']);
    const hasUnit = units.has(candidate);
    return {
      range:{ low:parsed.low, high:parsed.high, suffix:'' },
      unit:hasUnit ? candidate : '',
      item:hasUnit ? (match[2] || candidate) : parsed.suffix
    };
  }

  function parseIngredientRange(ingredient) {
    if (!ingredient || typeof ingredient !== 'object') return null;
    // Prefer a complete range preserved in the ingredient text. Legacy URL,
    // OCR, and text imports may also carry a calculated midpoint in quantity.
    return parseIngredientText(ingredient.item);
  }

  function shouldScale(ingredient) { return ingredient?.scalable !== false || Boolean(parseRange(ingredient?.displayQuantity)); }

  return Object.freeze({ parseRange, parseIngredientText, parseIngredientRange, scaleRange, shouldScale });
});
