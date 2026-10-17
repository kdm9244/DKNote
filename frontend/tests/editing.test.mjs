import test from 'node:test';import assert from 'node:assert/strict';
import {parseWordPaste} from '../src/services/wordPaste.js';
import {layoutWeekSpans,prioritizeDailyEvents} from '../src/services/calendarSpans.js';
test('unfinished Google events and local tasks precede completed tasks without mutating source',()=>{
 const source=[{id:'done',completed:true},{id:'google'},{id:'task',completed:false}];
 assert.deepEqual(prioritizeDailyEvents(source).map(e=>e.id),['google','task','done']);assert.equal(source[0].id,'done');
});
test('paste accepts TSV, Japanese reading, Korean meanings and bare words',()=>{
  assert.deepEqual(parseWordPaste('可用性\tかようせい\t가용성\n冗長化\t이중화\n整合性'),[{title:'可用性',reading:'かようせい',body:'가용성'},{title:'冗長化',reading:'',body:'이중화'},{title:'整合性',reading:'',body:''}]);
  assert.equal(parseWordPaste('可用性 かようせい 가용성')[0].reading,'かようせい');
  assert.throws(()=>parseWordPaste(Array(201).fill('word').join('\n')));
});
test('calendar clips spanning projects at week edges and avoids lane overlaps',()=>{
 const days=['2026-10-04','2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-10'];
 const result=layoutWeekSpans([{id:'long',startDate:'2026-10-01',endDate:'2026-10-31'},{id:'short',startDate:'2026-10-06',endDate:'2026-10-08'},{id:'next',startDate:'2026-10-09',endDate:'2026-10-10'}],days);
 assert.deepEqual(result.map(({event,start,end,lane,continuesBefore,continuesAfter})=>[event.id,start,end,lane,continuesBefore,continuesAfter]),[['long',0,6,0,true,true],['short',2,4,1,false,false],['next',5,6,1,false,false]]);
});
