(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SKUsageTracking = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DAY_MS = 86400000;
  const MIN_PURCHASE_DAYS = 4;
  const MAX_HISTORY = 100;
  const ANALYSIS_PURCHASE_DAYS = 12;

  function localDate(value) {
    const text = String(value || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) && Number.isFinite(Date.parse(`${text}T12:00:00Z`)) ? text : '';
  }

  function normalizeUnit(value) {
    return String(value || '').trim().toLowerCase().replace(/[.]/g, '').replace(/\s+/g, ' ');
  }

  function normalizePurchase(source = {}) {
    const quantity = Number(source.quantity);
    return {
      id:String(source.id || `usage-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      purchasedAt:localDate(source.purchasedAt),
      quantity:Number.isFinite(quantity) && quantity > 0 ? quantity : 0,
      unit:normalizeUnit(source.unit),
      source:String(source.source || 'Purchase').trim(),
      createdAt:source.createdAt || new Date().toISOString()
    };
  }

  function normalizeTracking(source = {}) {
    const expected = Math.round(Number(source.expectedIntervalDays));
    const purchases = Array.isArray(source.purchases) ? source.purchases.map(normalizePurchase).filter(item => item.purchasedAt) : [];
    const unique = new Map();
    purchases.forEach(item => unique.set(item.id, item));
    return {
      enabled:source.enabled === true && expected >= 1 && expected <= 3650,
      expectedIntervalDays:expected >= 1 && expected <= 3650 ? expected : 0,
      suggestionsMuted:source.suggestionsMuted === true,
      purchases:[...unique.values()].sort((a,b) => a.purchasedAt.localeCompare(b.purchasedAt) || a.createdAt.localeCompare(b.createdAt)).slice(-MAX_HISTORY),
      ignoredPurchaseIds:[...new Set((Array.isArray(source.ignoredPurchaseIds) ? source.ignoredPurchaseIds : []).map(String))]
    };
  }

  function median(numbers) {
    const values = [...numbers].sort((a,b) => a-b);
    if (!values.length) return 0;
    const middle = Math.floor(values.length / 2);
    return values.length % 2 ? values[middle] : (values[middle-1] + values[middle]) / 2;
  }

  function analyze(source = {}) {
    const tracking = normalizeTracking(source);
    const ignored = new Set(tracking.ignoredPurchaseIds);
    const excluded = [];
    const byDate = new Map();
    tracking.purchases.forEach(purchase => {
      if (ignored.has(purchase.id)) { excluded.push({ ...purchase, reason:'Ignored by user' }); return; }
      if (purchase.purchasedAt > new Date().toISOString().slice(0,10)) { excluded.push({ ...purchase, reason:'Future date' }); return; }
      const existing = byDate.get(purchase.purchasedAt);
      if (!existing) byDate.set(purchase.purchasedAt, { ...purchase, ids:[purchase.id] });
      else {
        existing.ids.push(purchase.id);
        if (existing.unit && existing.unit === purchase.unit && purchase.quantity) existing.quantity += purchase.quantity;
        else if (purchase.quantity) { existing.quantity = 0; existing.unit = ''; }
        excluded.push({ ...purchase, reason:'Same-day purchase combined' });
      }
    });
    let purchases = [...byDate.values()].sort((a,b) => a.purchasedAt.localeCompare(b.purchasedAt)).slice(-ANALYSIS_PURCHASE_DAYS);

    const comparableGroups = new Map();
    purchases.forEach(purchase => {
      if (!purchase.quantity || !purchase.unit) return;
      const group = comparableGroups.get(purchase.unit) || [];
      group.push(purchase.quantity); comparableGroups.set(purchase.unit, group);
    });
    if (purchases.length >= 5) {
      purchases = purchases.filter(purchase => {
        const values = comparableGroups.get(purchase.unit) || [];
        if (!purchase.quantity || values.length < 4) return true;
        const typical = median(values);
        const outlier = typical > 0 && (purchase.quantity > typical * 2.5 || purchase.quantity < typical * 0.4);
        if (outlier) excluded.push({ ...purchase, reason:'Unusual quantity' });
        return !outlier;
      });
    }

    let intervals = [];
    for (let index=1; index<purchases.length; index+=1) {
      const days = Math.round((Date.parse(`${purchases[index].purchasedAt}T12:00:00Z`) - Date.parse(`${purchases[index-1].purchasedAt}T12:00:00Z`)) / DAY_MS);
      if (days > 0) intervals.push({ days, from:purchases[index-1].purchasedAt, to:purchases[index].purchasedAt });
    }
    if (intervals.length >= 5) {
      const typical = median(intervals.map(item => item.days));
      intervals = intervals.filter(interval => {
        const outlier = typical > 0 && (interval.days < typical * 0.35 || interval.days > typical * 2.75);
        if (outlier) excluded.push({ id:`gap:${interval.from}:${interval.to}`, purchasedAt:interval.to, reason:'Unusual time gap' });
        return !outlier;
      });
    }

    const observedAverageDays = intervals.length >= 3 ? Math.round(intervals.reduce((sum,item) => sum + item.days, 0) / intervals.length) : 0;
    const expected = tracking.expectedIntervalDays;
    const meaningfulDifference = observedAverageDays && expected && Math.abs(observedAverageDays - expected) >= Math.max(3, Math.ceil(expected * 0.2));
    const firstDate = purchases[0]?.purchasedAt || '';
    const lastDate = purchases.at(-1)?.purchasedAt || '';
    const spanDays = firstDate && lastDate ? Math.round((Date.parse(`${lastDate}T12:00:00Z`) - Date.parse(`${firstDate}T12:00:00Z`)) / DAY_MS) : 0;
    return {
      tracking, purchases, excluded, intervals,
      purchaseDayCount:purchases.length,
      minimumPurchaseDays:MIN_PURCHASE_DAYS,
      observedAverageDays,
      spanDays,
      ready:purchases.length >= MIN_PURCHASE_DAYS && intervals.length >= 3,
      recommendation:tracking.enabled && !tracking.suggestionsMuted && meaningfulDifference ? observedAverageDays : 0
    };
  }

  function recordPurchase(source = {}, purchase = {}) {
    const tracking = normalizeTracking(source);
    const normalized = normalizePurchase(purchase);
    if (!normalized.purchasedAt) return tracking;
    const duplicate = tracking.purchases.some(item => item.id === normalized.id || (item.purchasedAt === normalized.purchasedAt && item.source === normalized.source && item.quantity === normalized.quantity && item.unit === normalized.unit));
    if (!duplicate) tracking.purchases.push(normalized);
    return normalizeTracking(tracking);
  }

  return { MIN_PURCHASE_DAYS, normalizeTracking, normalizePurchase, analyze, recordPurchase };
});
