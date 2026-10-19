// Focused update checks. All APIs are mocked; no application data is changed.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4176'],{stdio:'ignore'});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1366,height:900},timezoneId:'Asia/Seoul',reducedMotion:'reduce'}),page=await context.newPage();
page.setDefaultTimeout(10000);
const base='http://127.0.0.1:4176',errors=[],unexpected=[],writes=[];
await mkdir('../.local/updates-qa',{recursive:true});
await context.addInitScript(()=>sessionStorage.setItem('accessToken','ui-test'));
page.on('pageerror',e=>errors.push(e.message));
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
const item=(id,kind,title,extra={})=>({id,kind,title,body:'',details:{},version:0,position:0,createdAt:'2026-10-19T12:00:00',...extra});
const entries=[item('event','EVENT','오늘 일정',{startDate:today,endDate:today,details:{allDay:true,checks:[{id:'c1',title:'준비물 확인',done:false},{id:'c2',title:'서류 챙기기',done:false}]}}),
 item('note','RECORD','표 연습',{format:'richtext',startDate:today,body:'<p>학습 내용</p>'}),
 item('pdf','PDF','일본어 자료',{details:{fileName:'일본어.pdf'}}),item('word','WORD','旅行',{body:'여행을 떠나다',details:{language:'ja',reading:'りょこう',page:1}})];
let fail=false,admin=true,notices=[],accountPayload;
const accounts=[];
let feeSettings=['KR','JP','US'].map(marketGroup=>({marketGroup,buyFeeRate:0,sellFeeRate:0,sellTaxRate:0,dividendTaxRate:0}));
const json=(r,data,status=200)=>r.fulfill({status,json:data});
await page.route('**/api/**',async route=>{
 const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method();
 if(!path.startsWith('/api/'))return route.continue();
 const body=req.headers()['content-type']?.includes('application/json')?req.postDataJSON():null;
 if(path==='/api/users/myProfile')return json(route,{userId:'ui-test',email:'ui@example.com',role:admin?'ADMIN':'USER'});
 if(path==='/api/workspace/settings')return json(route,{});
 if(path==='/api/workspace/entries')return json(route,entries);
 if(path==='/api/calendar/google/status')return json(route,{tokenAvailable:false,calendarReady:false});
 if(path.startsWith('/api/workspace/entries/')){
  if(fail)return json(route,{message:'테스트 저장 실패'},500);
  const id=path.split('/').at(-1),index=entries.findIndex(e=>e.id===id),next={...entries[index],...body,id,version:(entries[index]?.version||0)+1};
  entries[index]=next;writes.push(next);return json(route,next);
 }
 if(path==='/api/notices'){
  if(method==='GET')return json(route,{canManage:admin,notices});
  if(fail)return json(route,{message:'공지 저장 실패'},500);
  const n={...body,id:'notice',version:0,createdAt:'2026-10-19T12:00:00'};notices=[n];return json(route,n,201);
 }
 if(path.startsWith('/api/notices/')){
  if(method==='DELETE'){notices=[];return route.fulfill({status:204});}
  const n={...notices[0],...body,version:body.version+1};notices=[n];return json(route,n);
 }
 if(path==='/api/ledger/accounts'){
  if(method==='POST'){accountPayload=body;const a={...body,accountId:'jpy',cachedBookBalance:body.initialBalance,isActive:true};accounts.push(a);return json(route,a);}
  return json(route,{accounts,totalAccounts:accounts.length,totalCachedBalance:0,totalsByCurrency:{}});
 }
 if(path==='/api/ledger/accounts/jpy/stats')return json(route,{monthlyIncomeTotal:0,monthlyExpenseTotal:0,monthlyTransactionCount:0});
 if(['/api/ledger/accounts/jpy/transactions','/api/ledger/accounts/jpy/reconciliations','/api/ledger/fixed-expenses'].includes(path))return json(route,[]);
 if(path==='/api/ledger/investment-accounts/inv/detail')return json(route,{account:accounts.find(a=>a.accountId==='inv'),profile:{},summary:{cashBalance:100000},holdings:[],allocations:[],performance:{},alerts:[],notes:[],targetAllocations:[],recentTrend:[]});
 if(path==='/api/ledger/investment-accounts/price-provider/status')return json(route,{configured:false});
 if(path==='/api/ledger/investment-accounts/inv/annual-summary')return json(route,{year:Number(url.searchParams.get('year')),baseCurrency:'KRW',taxAccountType:'UNSET',realizedBeforeTax:0,realizedAfterTax:0,currencies:[],trades:[]});
 if(path==='/api/ledger/investment-accounts/inv/fee-settings'){
  if(method==='PUT'){if(fail)return json(route,{message:'요율 저장 실패'},500);feeSettings=body.settings;}
  return json(route,feeSettings);
 }
 if(path==='/api/ledger/investment-accounts/inv/transactions')return json(route,{content:[{investmentTransactionId:'tx',investmentId:'holding',tradeType:'SELL',tradeDate:'2026-10-19T12:00:00',quantity:1,unitPrice:1000,grossAmount:1000,netAmount:980,feeAmount:3,taxAmount:17,currency:'KRW',exchangeRate:1}]});
 // The dashboard is briefly shown after account creation.
 if(path==='/api/ledger/dashboard')return json(route,{});
 unexpected.push(path);return json(route,{message:'Unmocked API'},501);
});
const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflows horizontally');
try {
 await new Promise(resolve=>setTimeout(resolve,1200));
 await page.goto(`${base}/learning/records/note/edit`);
 const editor=page.getByRole('textbox',{name:'학습 내용',exact:true});await editor.waitFor();
 await page.getByRole('button',{name:'▦ 표 만들기',exact:true}).click();await page.getByText('크기 직접 입력',{exact:true}).click();
 await page.getByLabel('표 행 수').fill('2');await page.getByLabel('표 열 수').fill('4');await page.getByRole('button',{name:'표 삽입',exact:true}).click();
 assert.equal(await editor.locator('tr').count(),2);assert.equal(await editor.locator('tr').first().locator('th,td').count(),4);
 await editor.locator('th').first().click();
 await page.getByText('행·열 편집',{exact:true}).click();
 await page.getByRole('button',{name:'아래에 행 추가',exact:true}).click();assert.equal(await editor.locator('tr').count(),3);
 await page.getByRole('button',{name:'오른쪽에 열 추가',exact:true}).click();assert.equal(await editor.locator('tr').first().locator('th,td').count(),5);
 await page.getByRole('button',{name:'행 삭제',exact:true}).click();assert.equal(await editor.locator('tr').count(),2);
 await page.getByRole('button',{name:'열 삭제',exact:true}).click();assert.equal(await editor.locator('tr').first().locator('th,td').count(),4);
 // Drag a column boundary and ensure width metadata survives save + reload.
 const cell=await editor.locator('th,td').first().boundingBox();
 await page.mouse.move(cell.x+cell.width-1,cell.y+cell.height/2);await page.mouse.down();await page.mouse.move(cell.x+cell.width+35,cell.y+cell.height/2,{steps:8});await page.mouse.up();
 await page.getByRole('button',{name:'저장',exact:true}).click();await page.waitForURL('**/learning/records/note');
 assert.match(entries.find(e=>e.id==='note').body,/colwidth=/);
 await page.goto(`${base}/learning/records/note/edit`);await editor.waitFor();assert.ok(await editor.locator('[colwidth]').count());
 await editor.locator('th,td').first().click();await page.getByText('행·열 편집',{exact:true}).click();await page.getByRole('button',{name:'표 삭제',exact:true}).click();assert.equal(await editor.locator('table').count(),0);
 await editor.press('Control+z');assert.equal(await editor.locator('table').count(),1);
 await page.setViewportSize({width:360,height:800});await noOverflow();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'../.local/updates-qa/note-mobile.png',fullPage:true});

 await page.goto(`${base}/learning/records`);await page.getByRole('heading',{name:'학습노트·PDF',exact:true}).last().waitFor();
 assert.equal(await page.locator('.record-list-item').count(),2);
 await page.getByLabel('자료 종류').selectOption('PDF');assert.equal(await page.locator('.record-list-item').count(),1);assert.match(await page.locator('.record-list-item').innerText(),/일본어 자료/);await noOverflow();

 await page.goto(`${base}/learning/words`);const row=page.locator('.word-library-row');await row.waitFor();
 assert.equal(await page.locator('.ws-pagination + .ws-actions').count(),0);
 await row.getByRole('button',{name:'편집',exact:true}).click();const wordEdit=page.getByRole('region',{name:'단어 편집',exact:true});
 assert.equal(await wordEdit.evaluate(e=>e.previousElementSibling.classList.contains('word-library-row')),true);
 await wordEdit.getByLabel('단어',{exact:true}).fill('旅');await wordEdit.getByRole('button',{name:'저장',exact:true}).click();await wordEdit.waitFor({state:'hidden'});
 assert.equal(entries.find(e=>e.id==='word').title,'旅');await noOverflow();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'../.local/updates-qa/words-mobile.png',fullPage:true});

 await page.goto(`${base}/calendar/today`);const card=page.locator('.calendar-event-card');await card.waitFor();
 await page.getByRole('button',{name:'준비물 확인 수정',exact:true}).click();await page.getByLabel('체크 항목 내용').fill('여권 확인');
 fail=true;await page.locator('.calendar-check-edit').getByRole('button',{name:'저장',exact:true}).click();await page.getByRole('alert').filter({hasText:'테스트 저장 실패'}).waitFor();assert.equal(await page.getByLabel('체크 항목 내용').inputValue(),'여권 확인');
 fail=false;await page.locator('.calendar-check-edit').getByRole('button',{name:'저장',exact:true}).click();await page.getByRole('button',{name:'여권 확인 수정',exact:true}).waitFor();
 await page.getByRole('button',{name:'서류 챙기기 삭제',exact:true}).click();await page.waitForFunction(()=>!document.body.innerText.includes('서류 챙기기'));
 assert.equal(entries.find(e=>e.id==='event').details.checks.length,1);
 await card.getByRole('button',{name:'상세 보기',exact:true}).click();const eventEdit=page.locator('.ws-inline-editor');await eventEdit.waitFor();
 assert.equal(await eventEdit.evaluate(e=>e.previousElementSibling.classList.contains('calendar-event-card')),true);await noOverflow();await page.screenshot({path:'../.local/updates-qa/calendar-mobile.png',fullPage:true});

 await page.goto(`${base}/updates`);await page.getByRole('button',{name:'공지 작성'}).click();await page.getByLabel('제목',{exact:true}).fill('기능 개선');await page.getByLabel('버전',{exact:true}).fill('1.1');await page.getByLabel('업데이트 내용').fill('표 행·열 편집과 모바일 화면 개선');
 fail=true;await page.getByRole('button',{name:'공지 저장'}).click();await page.getByRole('alert').filter({hasText:'공지 저장 실패'}).waitFor();assert.equal(await page.getByLabel('제목',{exact:true}).inputValue(),'기능 개선');
 fail=false;await page.getByRole('button',{name:'공지 저장'}).click();await page.getByRole('heading',{name:'기능 개선',exact:true}).waitFor();await noOverflow();
 await page.getByRole('button',{name:'수정',exact:true}).click();await page.getByLabel('제목',{exact:true}).fill('기능 개선 2');await page.getByRole('button',{name:'공지 저장'}).click();await page.getByRole('heading',{name:'기능 개선 2',exact:true}).waitFor();assert.equal(notices[0].version,1);
 admin=false;await page.reload();await page.getByRole('heading',{name:'기능 개선 2',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'공지 작성'}).count(),0);assert.equal(await page.getByRole('button',{name:'수정',exact:true}).count(),0);
 await page.screenshot({path:'../.local/updates-qa/updates-mobile.png',fullPage:true});
 admin=true;await page.reload();await page.getByRole('button',{name:'삭제',exact:true}).waitFor();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'삭제',exact:true}).click();await page.getByText('첫 소식을 기다리고 있어요.',{exact:true}).waitFor();

 await page.goto(`${base}/ledger?tab=accounts`);await page.getByRole('button',{name:'+ 신규 계좌 등록',exact:true}).click();
 const yen=page.getByRole('button',{name:/엔화 \(JPY\)/});await yen.click();
 await page.getByRole('button',{name:'외화',exact:true}).click();assert.equal(await yen.getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'입출금',exact:true}).click();assert.equal(await yen.getAttribute('aria-pressed'),'true');
 await page.getByPlaceholder('예: 신한 급여 주통장, 카카오 생활비통장').fill('일본 생활비');await page.locator('input[type=number]').first().fill('12000');await noOverflow();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'../.local/updates-qa/account-mobile.png',fullPage:true});
 await page.getByRole('button',{name:/신규 계좌 등록 완료/}).click();await page.getByRole('tab',{name:'입출금 등록',exact:true}).click();await page.getByText('금액 (JPY)',{exact:true}).waitFor();assert.equal(accountPayload.currency,'JPY');assert.equal(accountPayload.initialBalance,12000);assert.equal(await page.getByText('₩ 0',{exact:true}).count(),0);await noOverflow();

 accounts.push({accountId:'inv',accountName:'투자 검증',accountType:'INVESTMENT',accountPurpose:'STOCK_BROKERAGE',currency:'KRW',cachedBookBalance:100000,isActive:true});
 await page.goto(`${base}/ledger/investment`);await page.getByRole('tab',{name:'거래 내역',exact:true}).click();
 const history=page.locator('.investment-table.is-transaction');await history.getByRole('columnheader',{name:'세금',exact:true}).waitFor();assert.match(await history.locator('tbody td').nth(6).innerText(),/3/);assert.match(await history.locator('tbody td').nth(7).innerText(),/17/);await noOverflow();
 await page.getByRole('button',{name:'수수료·세금 수정',exact:true}).click();const fees=page.getByRole('region',{name:'수수료·세금 설정',exact:true});await fees.waitFor();const sellTax=fees.locator('article').first().getByLabel(/매도 세금/);await sellTax.fill('0.15');
 fail=true;await fees.getByRole('button',{name:'설정 저장',exact:true}).click();await page.getByRole('alert').filter({hasText:'요율 저장 실패'}).waitFor();assert.equal(await sellTax.inputValue(),'0.15');fail=false;await fees.getByRole('button',{name:'설정 저장',exact:true}).click();await fees.waitFor({state:'hidden'});assert.equal(feeSettings[0].sellTaxRate,0.15);await noOverflow();
 for(const width of [390,768])for(const route of ['/learning/records/note/edit','/learning/words','/calendar/today','/learning/records','/updates']){await page.setViewportSize({width,height:844});await page.goto(base+route);await page.locator('.workspace-main > .ws-panel,.learning-entry-composer,.calendar-event-card').first().waitFor();await noOverflow();}
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 console.log('PASS: table edits/width persistence, unified materials, word editing, checklist/failure recovery, event placement, notices CRUD/permissions, JPY account save/type changes/display, separate tax/fee columns, 360/390/768px layouts. No DB writes.');
} catch(e){console.error({url:page.url(),errors,unexpected,screen:(await page.locator('body').innerText()).slice(-1600)});throw e;}
finally{await browser.close();server.kill();}
