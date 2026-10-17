import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeAssets,normalizeAssetRate,convertAssetsToKrw } from '../src/services/assetSummary.js';
test('balances and market values are assets, monthly cash flow is not an asset balance', () => {
  const result=summarizeAssets([{currency:'KRW',accountType:'CHECKING',cachedBookBalance:1000000},{currency:'KRW',accountType:'INVESTMENT',cachedBookBalance:100000}],{totals:[{currency:'KRW',marketValue:2000000,cashBalance:100000,totalAsset:2100000}]});
  assert.equal(result.rows[0].amount,3100000);
});
test('currencies are never summed together and debt affects net assets only', () => {
  const result=summarizeAssets([{currency:'USD',accountType:'CHECKING',cachedBookBalance:1000},{currency:'KRW',accountType:'CHECKING',cachedBookBalance:1000000},{currency:'KRW',accountType:'DEBT',cachedBookBalance:-200000}]);
  assert.deepEqual(result.currencies,['KRW','USD']);assert.equal(result.rows[0].amount,1000000);assert.equal(result.rows[0].net,800000);assert.equal(result.rows[1].amount,1000);
});
test('inactive accounts are excluded and an empty account list has a real zero balance',()=>{
  assert.equal(summarizeAssets([{currency:'KRW',accountType:'CHECKING',cachedBookBalance:500,active:false}]).rows[0].amount,0);
});
test('yen is included in the KRW total with explicit one-yen and 100-yen quote units',()=>{
  assert.equal(normalizeAssetRate({rate:900,baseUnit:100},'JPY'),9);
  assert.equal(normalizeAssetRate({rate:9,baseUnit:1,provider:'KIS'},'JPY'),9);
  const assets=summarizeAssets([{currency:'KRW',accountType:'CHECKING',cachedBookBalance:5510042},{currency:'JPY',accountType:'FOREIGN_CURRENCY',cachedBookBalance:288211}]);
  const converted=convertAssetsToKrw(assets,{JPY:{rate:9}});assert.equal(converted.amount,8103941);assert.equal(converted.cash,8103941);assert.equal(converted.complete,true);
});
test('a missing FX rate does not produce a misleading partial total',()=>{
  const summary=summarizeAssets([{currency:'JPY',accountType:'CHECKING',cachedBookBalance:1000}]);const value=convertAssetsToKrw(summary,{});assert.equal(value.complete,false);assert.deepEqual(value.missing,['JPY']);
});
