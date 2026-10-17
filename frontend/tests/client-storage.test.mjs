import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareClientStorage} from '../src/services/clientStorage.js';
function storage(entries){const values=new Map(entries);return {get length(){return values.size},key:i=>[...values.keys()][i],getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};}
test('first startup preserves notes and drafts even without an old reset marker',()=>{
  const s=storage([['travel_planner_notes_trip','보존할 여행 메모'],['word_draft_1','단어 초안'],['pdf_note_draft_1','PDF 필기'],['accessToken','obsolete'],['token','obsolete']]);
  prepareClientStorage(s);assert.equal(s.getItem('travel_planner_notes_trip'),'보존할 여행 메모');assert.equal(s.getItem('word_draft_1'),'단어 초안');assert.equal(s.getItem('pdf_note_draft_1'),'PDF 필기');assert.equal(s.getItem('accessToken'),null);assert.equal(s.getItem('token'),null);
});
test('strips only API keys, retaining other settings and malformed legacy preferences',()=>{
  const s=storage([['mika_settings_owner',JSON.stringify({geminiApiKey:'fake',openaiApiKey:'fake',model:'keep-model',fontSize:14})],['mika_settings_broken','bad json'],['unrelated','keep']]);prepareClientStorage(s);
  assert.deepEqual(JSON.parse(s.getItem('mika_settings_owner')),{model:'keep-model',fontSize:14});assert.equal(s.getItem('mika_settings_broken'),'bad json');assert.equal(s.getItem('unrelated'),'keep');
});
