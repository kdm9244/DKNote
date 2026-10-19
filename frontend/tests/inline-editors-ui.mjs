// All API requests are mocked: this test never writes to the server or DB.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.INLINE_UI_URL || 'http://127.0.0.1:4173';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1366,height:768}});
const page=await context.newPage();page.setDefaultTimeout(10000);
const errors=[],unexpected=[];page.on('pageerror',e=>errors.push(e.message));
await context.addInitScript(()=>{if(window.top===window)sessionStorage.setItem('accessToken','ui-test');});
let serial=0,failWrite=false;
const trip={id:'trip',title:'교토 여행',destination:'교토',startDate:'2026-11-01',endDate:'2026-11-02',timezone:'Asia/Tokyo',targetBudget:100000,status:'계획 중',version:0};
const data={trip,days:[{id:'day1',date:'2026-11-01',number:1,activities:[]},{id:'day2',date:'2026-11-02',number:2,activities:[]}],places:[],reservations:[],expenses:[],checklist:[],budget:{actualKrw:0,plannedKrw:0,nativeTotals:{}}};
const entries=[{id:'task',kind:'TASK',title:'공부할 일',startDate:'2026-10-01',endDate:'2026-12-31',details:{},position:0,createdAt:'2026-10-01',version:0},{id:'word',kind:'WORD',title:'旅行',body:'여행',details:{language:'ja',reading:'りょこう',page:1},position:1,createdAt:'2026-10-01',version:0}];
entries.push(...['project1','project2'].map(id=>({id,kind:'EVENT',title:id,startDate:'2026-10-01',endDate:'2026-10-28',details:{},position:0,createdAt:'2026-10-01',version:0})));
const item=(body,extra={})=>({id:`new${++serial}`,version:0,position:0,createdAt:'2026-10-11',...body,...extra});
const accounts=['CHECKING','SAVINGS','INVESTMENT'].map((type,i)=>({accountId:`account${i}`,accountName:`검증 ${type}`,currency:'KRW',accountType:type,accountPurpose:i===0?'GENERAL_CHECKING':i===1?'FREE_SAVINGS':'STOCK_BROKERAGE',cachedBookBalance:100000,isActive:true}));
const goals=[],tx={transactionId:'tx',title:'검증 거래',amount:1000,transactionType:'EXPENSE',categoryId:'기타',transactionDate:'2026-10-11T12:00:00'};
const investmentDetail={account:accounts[2],profile:{},summary:{cashBalance:100000,totalAssetValue:100000},holdings:[],allocations:[],performance:{},alerts:[],notes:[],targetAllocations:[],recentTrend:[]};
const json=(route,value,status=200)=>route.fulfill({status,json:value});
await page.route('**/api/**',async route=>{
  const req=route.request(),p=new URL(req.url()).pathname,m=req.method();
  if(!p.startsWith('/api/'))return route.continue();
  const body=req.headers()['content-type']?.includes('application/json')?req.postDataJSON():{};
  if(p==='/api/users/myProfile')return json(route,{userId:'ui-test',displayName:'테스트',email:'ui@example.com'});
  if(p==='/api/workspace/settings')return json(route,{});
  if(p==='/api/calendar/google/status')return json(route,{tokenAvailable:false,calendarReady:false});
  if(p==='/api/workspace/pdf/pdf/file')return route.fulfill({contentType:'application/pdf',body:'%PDF-1.4\n%%EOF'});
  if(p==='/api/workspace/entries')return json(route,entries);
  if(p==='/api/ledger/accounts')return json(route,{accounts,totalAccounts:3,totalCachedBalance:300000});
  if(p==='/api/ledger/planning')return json(route,{currency:new URL(req.url()).searchParams.get('currency')||'KRW',goals,categoryBudgets:[]});
  if(p==='/api/ledger/planning/goals'){const next={...body,goalId:`goal${++serial}`,progressRate:0,currentAmount:0,status:'ACTIVE'};goals.push(next);return json(route,next);}
  if(p.match(/\/planning\/goals\/.+\/contributions$/))return json(route,{});
  if(p==='/api/ledger/planning/investment-plans')return json(route,[]);
  if(p.endsWith('/detail')&&p.includes('/investment-accounts/'))return json(route,investmentDetail);
  if(p.endsWith('/price-provider/status'))return json(route,{configured:false});
  if(p.endsWith('/fee-settings'))return json(route,['KR','US','JP'].map(marketGroup=>({marketGroup,buyFeeRate:0,sellFeeRate:0,sellTaxRate:0,dividendTaxRate:0})));
  if(p.endsWith('/target-allocations'))return json(route,body.items);
  if(p.endsWith('/notes'))return json(route,{...body,noteId:'note'});
  if(p.includes('/ledger/accounts/')&&p.endsWith('/transactions'))return json(route,[tx]);
  if(p.endsWith('/transactions')&&p.includes('/investment-accounts/'))return json(route,{content:[],totalElements:0,totalPages:0});
  if(p.includes('/ledger/accounts/')&&p.endsWith('/stats'))return json(route,{});
  if(p.endsWith('/reconciliations')||p==='/api/ledger/fixed-expenses')return json(route,[]);
  if(p==='/api/ledger/transactions/tx'){Object.assign(tx,body);return json(route,tx);}
  if(p.startsWith('/api/workspace/entries/')){
    const key=p.split('/').at(-1),next=m==='POST'?item(body,{kind:key}):{...entries.find(e=>e.id===key),...body,version:1};
    const index=entries.findIndex(e=>e.id===next.id);if(index<0)entries.push(next);else entries[index]=next;
    return json(route,next);
  }
  if(p==='/api/travel/trips'){if(m==='GET')return json(route,[trip]);Object.assign(trip,body);return json(route,trip);}
  if(p==='/api/travel/trips/trip'){if(m==='GET')return json(route,data);Object.assign(trip,body);return json(route,trip);}
  const activities=p.match(/^\/api\/travel\/days\/(day\d)\/activities(?:\/(.+))?$/);
  if(activities){const day=data.days.find(d=>d.id===activities[1]),next=item(body,{dayId:day.id});if(activities[2])Object.assign(day.activities.find(a=>a.id===activities[2]),body);else day.activities.push(next);return json(route,next);}
  const resource=p.match(/^\/api\/travel\/trips\/trip\/(places|reservations|expenses)(?:\/(.+))?$/);
  if(resource){
    if(failWrite)return json(route,{message:'검증용 저장 실패'},500);
    const next=item(body),collection=data[resource[1]];
    if(resource[2])Object.assign(collection.find(a=>a.id===resource[2]),body);
    else{if(resource[1]==='reservations'){next.attachmentItemId=`file${serial}`;data.checklist.push({itemId:next.attachmentItemId,title:next.title,attachments:[]});}collection.push(next);}
    data.budget.actualKrw=data.expenses.reduce((n,e)=>n+Number(e.amount)*(e.currency==='KRW'?1:Number(e.fxRate)),0);
    return json(route,next);
  }
  if(p==='/api/trips/trip/checklist'){const next=item(body,{itemId:`check${serial+1}`,editable:true,deletable:true,toggleable:true,isChecked:false,attachments:[]});data.checklist.push(next);return json(route,next);}
  const files=p.match(/^\/api\/checklist\/(.+)\/attachments$/);
  if(files){data.checklist.find(c=>c.itemId===files[1]).attachments.push({attachmentId:'uploaded',fileName:'확인서.pdf',deletable:true,fileUrl:'/api/files/ui-only'});return json(route,{});}
  unexpected.push(`${m} ${p}`);return json(route,{message:`Unmocked: ${p}`},501);
});
const te=()=>page.locator('.travel-editor'),we=()=>page.locator('.ws-inline-editor,.learning-entry-composer');
const fill=(name,value)=>te().getByLabel(name,{exact:true}).fill(value);
const save=async()=>{await te().getByRole('button',{name:'저장',exact:true}).click();await te().waitFor({state:'hidden'});};
const nav=async(scope,label)=>{if(page.viewportSize().width<=760)await page.getByRole('button',{name:`${scope} 메뉴 열기`,exact:true}).click();await page.getByRole('navigation',{name:`${scope} 메뉴`}).getByRole(scope==='가계부'?'button':'link',{name:label,exact:true}).click();};
const layout=async()=>{assert.equal(await page.getByRole('dialog').count(),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');};
try{
  await page.goto(`${base}/planner`);await page.getByRole('button',{name:'＋ 새 여행',exact:true}).click();await layout();await fill('여행 이름','교토 개인 여행');await fill('시작일','2026-11-01');await fill('종료일','2026-11-02');await save();await page.waitForURL('**/itinerary');
  await page.getByRole('button',{name:'＋ 장소',exact:true}).click();await fill('장소 이름','기요미즈데라');await fill('주소','교토');await save();
  await page.getByRole('button',{name:'이 날짜에 추가',exact:true}).click();await fill('시작 시간','10:00');await save();await page.locator('.travel-activity h3').getByText('기요미즈데라').waitFor();
  await page.getByRole('button',{name:'＋ 일정 추가',exact:true}).click();await fill('일정 이름','작성 중인 일정');await nav('여행','예약·자료');await nav('여행','일정');assert.equal(await te().getByLabel('일정 이름').inputValue(),'작성 중인 일정');
  await te().getByRole('button',{name:'일정 추가 닫기'}).click();await page.getByRole('button',{name:'＋ 일정 추가',exact:true}).click();assert.equal(await te().getByLabel('일정 이름').inputValue(),'작성 중인 일정');
  await page.getByRole('button',{name:'2일차',exact:false}).click();assert.ok(await te().getByText('2026-11-01에 저장됩니다.').isVisible());await save();assert.equal(data.days[0].activities[1].title,'작성 중인 일정');
  await nav('여행','예약·자료');await page.getByRole('button',{name:'＋ 예약 추가'}).click();await fill('예약 이름','교토 숙소');await fill('예약번호','BOOK123');await save();await page.getByRole('button',{name:'첨부파일 0'}).click();await page.getByLabel('파일 추가',{exact:true}).setInputFiles({name:'확인서.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4')});await page.getByRole('button',{name:'확인서.pdf ↓'}).waitFor();await layout();await page.getByRole('button',{name:'파일 접기'}).click();
  await nav('여행','준비물');await page.getByRole('button',{name:'＋ 준비물'}).click();await fill('준비물 이름','여권');await fill('분류','서류');await save();await page.getByRole('checkbox',{name:'여권'}).waitFor();
  await nav('여행','예산·지출');await page.getByRole('button',{name:'＋ 지출 추가'}).click();await fill('지출 이름','점심');await fill('실제 지출 금액','3000');await te().getByLabel('통화',{exact:true}).selectOption('JPY');await fill('1 외화 단위당 원화 환율','9');await save();assert.equal(data.budget.actualKrw,27000);
  await page.getByRole('button',{name:'＋ 지출 추가'}).click();await fill('지출 이름','실패해도 유지');failWrite=true;await te().getByRole('button',{name:'저장',exact:true}).click();await te().getByRole('alert').waitFor();assert.equal(await te().getByLabel('지출 이름').inputValue(),'실패해도 유지');failWrite=false;await te().getByRole('button',{name:'취소'}).click();
  for(const size of [{width:1280,height:640},{width:390,height:844}]){await page.setViewportSize(size);await nav('여행','일정');await page.getByRole('button',{name:'＋ 일정 추가',exact:true}).click();await layout();await te().getByRole('button',{name:'취소'}).click();}
  await page.setViewportSize({width:1366,height:768});await page.goto(`${base}/calendar`);await page.getByRole('button',{name:'＋ 일정 추가',exact:true}).click();await layout();await we().getByLabel('제목',{exact:true}).fill('페이지 일정');await we().getByRole('button',{name:'＋ 체크 항목',exact:true}).click();await we().getByLabel('체크 항목 1').fill('준비 확인');
  await we().getByRole('button',{name:'편집 닫기'}).click();await page.getByRole('button',{name:'＋ 일정 추가',exact:true}).click();assert.equal(await we().getByLabel('제목',{exact:true}).inputValue(),'페이지 일정');await we().getByRole('button',{name:'저장',exact:true}).click();await we().waitFor({state:'hidden'});assert.ok(entries.some(e=>e.title==='페이지 일정'));
  await page.getByRole('button',{name:/주 기간 프로젝트/}).first().click();await page.getByRole('region',{name:'기간 프로젝트'}).waitFor();await layout();await page.locator('.calendar-project-row').filter({hasText:'project2'}).click();await we().getByLabel('제목',{exact:true}).waitFor();assert.equal(await we().getByLabel('제목',{exact:true}).inputValue(),'project2');await we().getByRole('button',{name:'편집 닫기'}).click();
  await nav('캘린더','체크리스트 템플릿');await page.getByRole('button',{name:'＋ 템플릿 만들기'}).click();await we().getByLabel('제목',{exact:true}).fill('출발 준비');await we().getByRole('button',{name:'저장',exact:true}).click();await we().waitFor({state:'hidden'});
  await page.goto(`${base}/learning/roadmaps`);await page.getByRole('button',{name:'＋ 학습 목표',exact:true}).click();await we().getByLabel('제목',{exact:true}).fill('새 학습 목표');await we().getByRole('button',{name:'저장',exact:true}).click();await we().waitFor({state:'hidden'});assert.ok(entries.some(e=>e.title==='새 학습 목표'));
  await page.goto(`${base}/learning/tasks/task`);await page.getByRole('button',{name:'＋ 공부 날짜',exact:true}).click();await we().getByLabel('공부할 날짜').fill('2026-11-01');await we().getByRole('button',{name:'예정일 저장'}).click();await we().waitFor({state:'hidden'});assert.ok(entries.some(e=>e.kind==='SCHEDULE'));
  await page.getByRole('button',{name:'＋ 노트 작성',exact:true}).click();await we().getByLabel('제목',{exact:true}).fill('작성 중인 학습노트');await layout();await we().getByRole('button',{name:'편집 닫기'}).click();await page.getByRole('button',{name:'＋ 노트 작성',exact:true}).click();assert.equal(await we().getByLabel('제목',{exact:true}).inputValue(),'작성 중인 학습노트');await we().getByRole('button',{name:'편집 닫기'}).click();
  await page.goto(`${base}/learning/words`);await page.getByRole('button',{name:'旅行 편집'}).click();await we().getByLabel('뜻 / 예문').fill('여행 / 예문');await we().getByRole('button',{name:'저장',exact:true}).click();await we().waitFor({state:'hidden'});assert.equal(entries.find(e=>e.id==='word').body,'여행 / 예문');
  entries.push({id:'pdf',kind:'PDF',title:'검증 PDF',details:{fileName:'검증.pdf',pageNotes:{}},position:0,createdAt:'2026-10-11',version:0});entries.find(e=>e.id==='word').parentId='pdf';await page.goto(`${base}/learning/pdf/pdf`);await page.getByRole('button',{name:/단어/,exact:false}).filter({hasText:/단어/}).first().click();await page.locator('.word-row-actions summary').first().click();await page.getByRole('button',{name:'언어·페이지 편집'}).click();await page.locator('.pdf-notes-pane .ws-inline-editor').waitFor();await layout();await we().getByRole('button',{name:'편집 닫기'}).click();
  for(const size of [{width:1280,height:640},{width:390,height:844}]){await page.setViewportSize(size);await page.goto(`${base}/calendar`);await page.getByRole('button',{name:'＋ 일정 추가',exact:true}).click();await we().waitFor();await layout();await page.goto(`${base}/learning/roadmaps`);await page.getByRole('button',{name:'＋ 학습 목표',exact:true}).click();await we().waitFor();await layout();}
  await page.setViewportSize({width:1366,height:768});await page.goto(`${base}/ledger?tab=accounts`);await nav('가계부','자금 계획');await page.getByRole('button',{name:/목표·위시리스트/}).click();await page.getByRole('button',{name:'+ 새 목표',exact:true}).click();await we().getByLabel('목표 이름 *').fill('여행 경비');await we().getByLabel('목표 금액 *').fill('100000');await layout();await we().getByRole('button',{name:'목표 저장'}).click();await we().waitFor({state:'hidden'});assert.equal(goals[0].title,'여행 경비');
  await page.getByRole('button',{name:'목표에 적립하기'}).click();await we().getByLabel('적립 금액 *').fill('1000');await we().getByRole('button',{name:'적립 반영'}).click();await we().waitFor({state:'hidden'});
  await page.getByRole('button',{name:'투자 계획',exact:true}).click();await page.getByRole('button',{name:'+ 투자 계획',exact:true}).click();await layout();await we().getByRole('button',{name:'편집 닫기'}).click();
  for(const account of accounts.slice(0,2)){await nav('가계부','계좌');await page.locator('.ledger-account-tile').filter({hasText:account.accountName}).click();await page.locator('tbody').getByRole('button',{name:/수정/}).first().click();await we().waitFor();await layout();await we().getByRole('button',{name:'편집 닫기'}).click();}
  await page.goto(`${base}/ledger/investment`);await page.getByRole('tab',{name:/알림·메모/}).click();await page.getByRole('button',{name:'＋ 메모 등록'}).click();await we().getByLabel('제목',{exact:true}).fill('투자 메모');await we().getByRole('button',{name:'메모 저장'}).click();await we().waitFor({state:'hidden'});
  await page.getByRole('button',{name:'목표 설정'}).click();await we().locator('input[type=number]').first().fill('100');await we().getByRole('button',{name:'목표 비중 저장'}).click();await we().waitFor({state:'hidden'});await page.getByRole('button',{name:'＋ 거래 추가'}).click();await page.getByRole('button',{name:'수수료·세금 설정',exact:true}).click();await we().waitFor();await layout();await we().getByRole('button',{name:'설정 저장'}).click();await we().waitFor({state:'hidden'});
  for(const size of [{width:1280,height:640},{width:390,height:844}]){await page.setViewportSize(size);await page.goto(`${base}/ledger?tab=accounts`);await nav('가계부','자금 계획');await page.getByRole('button',{name:/목표·위시리스트/}).click();await page.getByRole('button',{name:'+ 새 목표',exact:true}).click();await we().waitFor();await layout();await we().getByRole('button',{name:'편집 닫기'}).click();}
  if(process.env.INLINE_UI_SCREENSHOTS){await page.goto(`${base}/calendar`);await page.getByRole('button',{name:'＋ 일정 추가',exact:true}).click();await we().waitFor();await page.screenshot({path:'../.local/runtime/qa-inline-calendar.png'});await page.goto(`${base}/trips/trip/itinerary`);await page.getByRole('button',{name:'＋ 일정 추가',exact:true}).click();await te().waitFor();await page.screenshot({path:'../.local/runtime/qa-inline-travel.png'});}
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);console.log('PASS: travel/calendar/learning/ledger inline inputs, files, FX, drafts, failed save, laptop/mobile. No DB writes.');
}catch(error){console.error({url:page.url(),errors,unexpected,screen:(await page.locator('body').innerText()).slice(0,1800)});throw error;}finally{await browser.close();}
