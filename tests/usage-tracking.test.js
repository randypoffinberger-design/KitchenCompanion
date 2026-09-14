const assert = require('node:assert/strict');
const usage = require('../usage-tracking.js');

function purchases(days, quantities = []) {
  return days.map((purchasedAt,index) => ({
    id:`purchase-${index}`,
    purchasedAt,
    quantity:quantities[index] ?? 1,
    unit:'bag',
    source:'Test purchase'
  }));
}

const seventeenDayPattern = usage.analyze({
  enabled:true,
  expectedIntervalDays:14,
  purchases:purchases(['2026-05-01','2026-05-18','2026-06-04','2026-06-21','2026-07-08','2026-07-25'])
});
assert.equal(seventeenDayPattern.ready,true);
assert.equal(seventeenDayPattern.observedAverageDays,17);
assert.equal(seventeenDayPattern.recommendation,17);

const muted = usage.analyze({ ...seventeenDayPattern.tracking, suggestionsMuted:true });
assert.equal(muted.observedAverageDays,17);
assert.equal(muted.recommendation,0);

const tooLittleHistory = usage.analyze({ enabled:true, expectedIntervalDays:14, purchases:purchases(['2026-07-01','2026-07-18','2026-08-04']) });
assert.equal(tooLittleHistory.ready,false);
assert.equal(tooLittleHistory.recommendation,0);

const closePattern = usage.analyze({ enabled:true, expectedIntervalDays:14, purchases:purchases(['2026-06-01','2026-06-16','2026-07-01','2026-07-16']) });
assert.equal(closePattern.observedAverageDays,15);
assert.equal(closePattern.recommendation,0);

const quantityOutlier = usage.analyze({
  enabled:true,
  expectedIntervalDays:14,
  purchases:purchases(['2026-04-01','2026-04-18','2026-05-05','2026-05-22','2026-06-08','2026-06-25'],[1,1,8,1,1,1])
});
assert.ok(quantityOutlier.excluded.some(item => item.reason === 'Unusual quantity'));

const deduplicated = usage.recordPurchase(
  usage.recordPurchase({ enabled:true, expectedIntervalDays:14 }, { id:'same', purchasedAt:'2026-09-01', quantity:1, unit:'bag', source:'Shopping list purchase' }),
  { id:'same', purchasedAt:'2026-09-01', quantity:1, unit:'bag', source:'Shopping list purchase' }
);
assert.equal(deduplicated.purchases.length,1);

console.log('Usage tracking regression passed: learning thresholds, meaningful differences, muted suggestions, quantity safeguards, and duplicate protection work.');
