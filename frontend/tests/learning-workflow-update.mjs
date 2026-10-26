// All API responses are mocked: this suite never changes user data.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.LEARNING_UI_URL || 'http://127.0.0.1:4174';
const browser = await chromium.launch({ channel:'chrome', headless:true });
const context = await browser.newContext({ viewport:{width:1366,height:900} });
await context.addInitScript(()=>{if(window===window.top)sessionStorage?.setItem('accessToken','ui-test');});
await context.route('https://fonts.googleapis.com/**', route=>route.fulfill({contentType:'text/css',body:''}));
const page=await context.newPage(); page.setDefaultTimeout(10000);
const stamp='2026-10-26T12:00:00';
const entry=e=>({body:'',format:'plain',details:{},version:0,position:0,startDate:'2026-10-26',endDate:'2026-10-26',createdAt:stamp,updatedAt:stamp,...e});
const entries=[
 entry({id:'r',kind:'ROADMAP',title:'개발'}),
 entry({id:'m',kind:'MILESTONE',title:'기초',parentId:'r'}),
 entry({id:'t',kind:'TASK',title:'복습',parentId:'m'}),
 entry({id:'note',kind:'RECORD',title:'학습 기록',format:'richtext',body:'<h2>개념</h2><p>내용 <strong>강조</strong></p><pre><code>const a = 1;</code></pre>',parentId:'t'}),
 entry({id:'md',kind:'RECORD',title:'원본 Markdown',format:'markdown',body:'# 제목\n\n- 목록\n- **강조**\n\n```js\nconst a=1;\n```'}),
 entry({id:'styled',kind:'RECORD',title:'색상 문서',format:'richtext',body:'<p><mark style="background-color: #fff2a8">보존할 내용</mark></p>'}),
 entry({id:'pdf',kind:'PDF',title:'PDF 자료',parentId:'t',details:{fileName:'sample.pdf',pages:{}}}),
 entry({id:'rich',kind:'RECORD',title:'문서 코드',format:'richtext',body:'<pre><code>let value = 1;</code></pre>'}),
 entry({id:'memo2',kind:'MEMO',title:'다른 메모',body:'추가 메모'}),
 entry({id:'memo',kind:'MEMO',title:'일반 메모',body:'준비물'}),
 entry({id:'event',kind:'EVENT',title:'테스트 일정',details:{checks:[],allDay:true}}),
 entry({id:'sched',kind:'SCHEDULE',title:'학습 예정',parentId:'t'}),
];
const errors=[],writes=[];
let failScheduleSave = true;
page.on('pageerror',error=>errors.push(error.message));
await context.route('**/api/**',async route=>{
 const request=route.request(),path=new URL(request.url()).pathname;
 if(!path.startsWith('/api/'))return route.continue();
 if(path==='/api/users/myProfile')return route.fulfill({json:{userId:'ui-test',role:'USER'}});
 if(path==='/api/workspace/settings')return route.fulfill({json:{}});
 if(path==='/api/calendar/google/status')return route.fulfill({json:{tokenAvailable:false,calendarReady:false}});
 if(path==='/api/workspace/entries')return route.fulfill({json:entries});
 if(path.startsWith('/api/workspace/entries/')&&['PUT','POST'].includes(request.method())){
  if(path.endsWith('/sched') && failScheduleSave) {
   failScheduleSave=false;return route.fulfill({status:503,json:{message:'검증용 저장 실패'}});
  }
  if(path.endsWith('/note'))await new Promise(resolve=>setTimeout(resolve,700));
  const data=request.postDataJSON(), saved=entry({...data,id:data.id||`new${writes.length}`,version:(data.version||0)+1});
  const i=entries.findIndex(e=>e.id===saved.id); if(i<0)entries.push(saved);else entries[i]=saved;
  writes.push(saved);return route.fulfill({json:saved});
 }
 if(path.endsWith('/file'))return route.fulfill({contentType:'application/pdf',body:'%PDF-1.4\n%%EOF'});
 return route.fulfill({json:[]});
});
const visit=path=>page.goto(base+path);
const body=()=>page.getByRole('textbox',{name:'학습 내용',exact:true});
try {
 await visit('/learning/records/note/edit'); await body().waitFor();
 assert.match(await page.title(),/DKNote/);
 await page.getByRole('button',{name:'Markdown',exact:true}).click();
 const markdown=page.getByRole('textbox',{name:'학습 내용',exact:true});
 assert.match(await markdown.inputValue(),/## 개념/); assert.match(await markdown.inputValue(),/\*\*강조\*\*/);
 await page.getByRole('button',{name:'문서 편집',exact:true}).click();
 assert.equal(await body().locator('h2').textContent(),'개념');
 await body().press('Control+Home'); await body().press('Shift+End');
 await page.getByLabel('선택한 문단 제목',{exact:true}).selectOption('3');
 assert.equal(await body().locator('h3').textContent(),'개념');
 await body().press('Control+End'); await body().pressSequentially('추가 문단');
 await page.getByRole('button',{name:'Markdown',exact:true}).click(); assert.match(await markdown.inputValue(),/추가 문단/);
 await page.getByRole('button',{name:'저장',exact:true}).click(); assert.equal(await markdown.isDisabled(),true); await page.locator('.learning-entry-composer').waitFor({state:'hidden'});
 assert.equal(writes.at(-1).format,'markdown');
 await visit('/learning/records/md/edit');
 const original=await markdown.inputValue(); await page.getByRole('button',{name:'문서 편집',exact:true}).click();
 await page.getByRole('button',{name:'Markdown',exact:true}).click(); assert.equal(await markdown.inputValue(),original);
 await visit('/learning/records/styled/edit'); await body().waitFor();
 let warning=''; page.once('dialog',async dialog=>{warning=dialog.message();await dialog.accept();});
 await page.getByRole('button',{name:'Markdown',exact:true}).click(); assert.match(warning,/Markdown으로 돌아가실 수 없습니다/);
 assert.equal(await body().locator('mark').textContent(),'보존할 내용');
 await visit('/learning/records/note'); await page.locator('.learning-code-lines').getByRole('button',{name:'1',exact:true}).click();
 await page.getByRole('textbox',{name:'필기 제목',exact:true}).fill('변수 선언');
 await page.getByRole('textbox',{name:'설명 작성',exact:true}).fill('상수를 선언합니다.');
 await page.getByRole('button',{name:'댓글 저장',exact:true}).click(); await page.getByText('변수 선언',{exact:true}).waitFor();
 assert.equal(writes.at(-1).title,'변수 선언');
 await visit('/learning/records/rich');
 await page.locator('.learning-code-lines').getByRole('button',{name:'1',exact:true}).click();
 await page.getByRole('textbox',{name:'필기 제목',exact:true}).fill('변수 설명');
 await page.getByRole('textbox',{name:'설명 작성',exact:true}).fill('변수를 선언합니다.');
 await page.getByRole('button',{name:'댓글 저장',exact:true}).click(); await page.getByText('변수 설명',{exact:true}).waitFor();
 assert.equal(await page.getByText('원본 코드 변경됨',{exact:true}).count(),0);
 await page.getByRole('textbox',{name:'필기 제목',exact:true}).fill('일반 댓글');
 await page.getByRole('textbox',{name:'설명 작성',exact:true}).fill('선택 영역 없이 작성합니다.');
 await page.getByRole('button',{name:'댓글 저장',exact:true}).click();
 await page.locator('.record-comment').filter({hasText:'일반 댓글'}).getByRole('button',{name:'수정',exact:true}).click();
 assert.equal(await page.locator('.comment-quote').count(),0);
 await visit('/calendar?date=2026-10-26');
 await page.getByText('테스트 일정',{exact:true}).first().click();
 const materials=page.getByRole('region',{name:'연결된 자료'}); await materials.getByText('자료 연결·해제',{exact:true}).click();
 for(const title of ['학습 기록','PDF 자료','일반 메모'])await materials.getByRole('checkbox',{name:new RegExp(title)}).check();
 await page.getByRole('button',{name:'저장',exact:true}).click();
 assert.deepEqual(writes.at(-1).details.materialIds,['note','pdf','memo']);
 await page.reload();
 await page.getByText('테스트 일정',{exact:true}).first().click(); assert.equal(await materials.getByRole('link').count(),3);
 await materials.getByRole('link',{name:'메모 · 일반 메모',exact:true}).click();
 assert.equal(await page.getByRole('textbox',{name:'메모 제목',exact:true}).inputValue(),'일반 메모');
 await page.locator('.memo-select').filter({hasText:'다른 메모'}).click();
 assert.match(page.url(),/memo=memo2/); await page.reload();
 assert.equal(await page.getByRole('textbox',{name:'메모 제목',exact:true}).inputValue(),'다른 메모');
 await page.goBack(); assert.equal(await page.getByRole('textbox',{name:'메모 제목',exact:true}).inputValue(),'일반 메모');
 await visit('/calendar?date=2026-10-26');
 await page.getByText('복습',{exact:true}).first().click();
 await materials.getByText('자료 연결·해제',{exact:true}).click();
 await materials.getByRole('searchbox',{name:'자료 검색',exact:true}).fill('없는 자료 검색');
 await materials.getByText('검색 결과가 없습니다.',{exact:true}).waitFor();
 await materials.getByRole('searchbox',{name:'자료 검색',exact:true}).fill('');
 await materials.getByRole('checkbox',{name:/PDF 자료/}).click();
 await materials.getByRole('alert').waitFor();
 assert.equal(await materials.getByRole('checkbox',{name:/PDF 자료/}).isChecked(),false);
 assert.equal(entries.find(e=>e.id==='sched').details.materialIds,undefined);
 await materials.getByRole('checkbox',{name:/PDF 자료/}).click();
 await page.waitForFunction(()=>document.querySelector('.linked-materials')?.textContent.includes('연결된 자료 1개'));
 assert.equal(writes.at(-1).id,'sched'); assert.deepEqual(writes.at(-1).details.materialIds,['pdf']);
 await visit('/learning/pdf/pdf');
 await page.getByRole('button',{name:/분류·자료 정보 변경/}).click();
 await page.getByLabel('학습 목표 연결 로드맵',{exact:true}).selectOption('r');
 await page.getByRole('button',{name:'자료 정보 저장',exact:true}).click();
 assert.equal(writes.at(-1).parentId,'r');
 assert.ok(await page.locator('.pdf-resource-footer').evaluate(e=>e.getBoundingClientRect().top < document.querySelector('.pdf-workspace').getBoundingClientRect().top));
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.locator('.rich-format-menu>summary').click();
 assert.ok(await page.locator('.rich-format-menu>.rich-tool-group').evaluate(e=>{const rect=e.getBoundingClientRect();return rect.left>=0 && rect.right<=innerWidth+1;}));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]);
 console.log('PASS: Markdown round trip/edit/save, unsupported-format protection, titled annotation, multiple calendar materials, memo deep link, top PDF hierarchy and mobile width.');
} catch(error) { console.error({url:page.url(), errors, text:(await page.locator('body').innerText()).slice(0,2500)}); throw error; } finally { await browser.close(); }
