// test-v2-market-pricing.ts — Tests for dynamic supply/demand trade pricing

import {
  TRADE_PRICES, getDynamicPrice,
  PRICE_SURPLUS_THRESHOLD, PRICE_SCARCITY_THRESHOLD, PRICE_MAX_MODIFIER,
  emptyResources,
} from '../world.js';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; if (!process.argv.includes('-q')) console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}
function heading(s: string) { if (!process.argv.includes('-q')) console.log(`\n=== ${s} ===`); }

// ================================================================
// TEST 1: Constants exist
// ================================================================
heading('Pricing Constants');
{
  assert(PRICE_SURPLUS_THRESHOLD === 50, `surplus threshold is 50 (${PRICE_SURPLUS_THRESHOLD})`);
  assert(PRICE_SCARCITY_THRESHOLD === 10, `scarcity threshold is 10 (${PRICE_SCARCITY_THRESHOLD})`);
  assert(PRICE_MAX_MODIFIER === 0.3, `max modifier is 0.3 (${PRICE_MAX_MODIFIER})`);
}

// ================================================================
// TEST 2: Normal supply returns base prices
// ================================================================
heading('Normal Supply Prices');
{
  const res = { ...emptyResources(), wood: 30 }; // between thresholds
  const price = getDynamicPrice('wood', res);
  assert(price !== null, 'wood has a price');
  assert(price!.buy === TRADE_PRICES.wood!.buy, `buy price unchanged at normal supply (${price!.buy})`);
  assert(price!.sell === TRADE_PRICES.wood!.sell, `sell price unchanged at normal supply (${price!.sell})`);
}

// ================================================================
// TEST 3: Surplus lowers sell price (market flooded)
// ================================================================
heading('Surplus Pricing');
{
  const res = { ...emptyResources(), wood: 100 }; // well above surplus threshold
  const price = getDynamicPrice('wood', res);
  const base = TRADE_PRICES.wood!;
  assert(price!.sell <= base.sell, `sell price drops at surplus (${price!.sell} <= ${base.sell})`);
  assert(price!.buy <= base.buy, `buy price drops at surplus (${price!.buy} <= ${base.buy})`);
}

// ================================================================
// TEST 4: Scarcity raises buy price (desperate demand)
// ================================================================
heading('Scarcity Pricing');
{
  const res = { ...emptyResources(), wood: 0 }; // zero supply
  const price = getDynamicPrice('wood', res);
  const base = TRADE_PRICES.wood!;
  assert(price!.buy >= base.buy, `buy price rises at scarcity (${price!.buy} >= ${base.buy})`);
  assert(price!.sell >= base.sell, `sell price rises at scarcity (${price!.sell} >= ${base.sell})`);
}

// ================================================================
// TEST 5: Price modifier caps at ±30%
// ================================================================
heading('Price Cap');
{
  const res = { ...emptyResources(), ingots: 500 }; // extreme surplus
  const price = getDynamicPrice('ingots', res);
  const base = TRADE_PRICES.ingots!;
  const minBuy = Math.max(1, Math.round(base.buy * (1 - PRICE_MAX_MODIFIER)));
  assert(price!.buy >= minBuy, `buy doesn't drop below -30% cap (${price!.buy} >= ${minBuy})`);

  const res2 = { ...emptyResources(), ingots: 0 }; // extreme scarcity
  const price2 = getDynamicPrice('ingots', res2);
  const maxBuy = Math.round(base.buy * (1 + PRICE_MAX_MODIFIER));
  assert(price2!.buy <= maxBuy, `buy doesn't exceed +30% cap (${price2!.buy} <= ${maxBuy})`);
}

// ================================================================
// TEST 6: Non-tradeable resource returns null
// ================================================================
heading('Non-Tradeable Resource');
{
  const res = emptyResources();
  const price = getDynamicPrice('gold' as any, res);
  assert(price === null, 'gold has no trade price');
}

// ================================================================
// TEST 7: Prices always at least 1
// ================================================================
heading('Minimum Price');
{
  // food sell price is 1 base — even with surplus modifier it should stay >= 1
  const res = { ...emptyResources(), food: 200 };
  const price = getDynamicPrice('food', res);
  assert(price!.buy >= 1, `buy price always >= 1 (${price!.buy})`);
  assert(price!.sell >= 1, `sell price always >= 1 (${price!.sell})`);
}

// ================================================================
// TEST 8: Different resources have different prices
// ================================================================
heading('Resource Price Variety');
{
  const res = { ...emptyResources(), wood: 30, ingots: 30 };
  const woodPrice = getDynamicPrice('wood', res);
  const ingotPrice = getDynamicPrice('ingots', res);
  assert(ingotPrice!.buy > woodPrice!.buy, `ingots cost more than wood (${ingotPrice!.buy} > ${woodPrice!.buy})`);
}

// ================================================================
// RESULTS
// ================================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`V2 Market Pricing Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
