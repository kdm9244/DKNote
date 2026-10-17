import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleWarnings, safeLink } from '../src/services/travelPlanning.js';
test('finds nested time overlaps, not only adjacent events',()=>{
  const rows=[{id:'a',title:'관광',startTime:'10:00',endTime:'13:00'},{id:'b',title:'식사',startTime:'11:00',endTime:'11:30'},{id:'c',title:'카페',startTime:'12:00',endTime:'12:30'}];
  const warnings=scheduleWarnings(rows);assert.ok(warnings.get('c').some(s=>s.includes('관광')));assert.equal(warnings.get('a').length,2);
});
test('compares manual travel allowance and handles undecided times',()=>{
  const rows=[{id:'a',title:'숙소',startTime:'09:00',endTime:'10:00'},{id:'b',title:'관광',startTime:'10:10',endTime:'11:00',travelMinutes:30},{id:'c',title:'쇼핑',startTime:null,endTime:null}];
  const warnings=scheduleWarnings(rows);assert.ok(warnings.get('b').some(s=>s.includes('20분')));assert.equal(warnings.has('c'),false);
});
test('external links exclude javascript and data URLs',()=>{assert.equal(safeLink('javascript:alert(1)'),undefined);assert.equal(safeLink('data:text/html,test'),undefined);assert.equal(safeLink('https://example.test'),'https://example.test');});
