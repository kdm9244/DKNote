import assert from 'node:assert/strict';
import {loadTaxReferenceRates} from '../src/services/taxReferenceRates.js';

const calls=[];
const result=await loadTaxReferenceRates(['KRW_JPY','JPY_KRW','USD_JPY','USD_KRW'],async(base,quote)=>{
  calls.push(`${base}/${quote}`);
  return {base,quote,rate:base==='JPY'?1000:1500,baseUnit:base==='JPY'?100:1,provider:'외환 시장 실시세',updatedAt:'2026-10-20T09:00:00'};
});
assert.deepEqual(calls.sort(),['JPY/KRW','USD/KRW']);
assert.deepEqual(result.rates,{KRW_JPY:'0.1',JPY_KRW:'10',USD_JPY:'150',USD_KRW:'1500'});
assert.deepEqual(result.failed,[]);
assert.deepEqual(result.sources.KRW_JPY,['2026-10-20T09:00:00']);
const kis=await loadTaxReferenceRates(['KRW_JPY'],async()=>({rate:10,baseUnit:1,provider:'KIS'}));
assert.equal(kis.rates.KRW_JPY,'0.1');
const partial=await loadTaxReferenceRates(['KRW_JPY','USD_KRW','USD_JPY'],async base=>{
  if(base==='JPY')throw new Error('offline');
  return {rate:1500,baseUnit:1};
});
assert.deepEqual(partial.rates,{USD_KRW:'1500'});
assert.deepEqual(partial.failed,['KRW_JPY','USD_JPY']);
for(const quote of [{rate:0},{rate:-1},{rate:'bad'},{rate:10,base:'USD'},{rate:10,quote:'JPY'}]){
  assert.deepEqual((await loadTaxReferenceRates(['KRW_JPY'],async()=>quote)).failed,['KRW_JPY']);
}
const rounded=await loadTaxReferenceRates(['KRW_JPY'],async()=>({rate:931.37,baseUnit:100}));
assert.equal(rounded.rates.KRW_JPY,'0.10736871');
console.log('PASS existing FX units, inverse/cross conversion, request deduplication, partial failure, invalid quotes, eight-decimal estimate precision.');
