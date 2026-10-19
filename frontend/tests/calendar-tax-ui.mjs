// Focused browser regression: mock APIs, never writes application data.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4186'],{stdio:'ignore'});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1920,height:1080},reducedMotion:'reduce'}),page=await context.newPage();
page.setDefaultTimeout(10000);
await context.addInitScript(()=>sessionStorage.setItem('accessToken','ui-test'));
await mkdir('../.local/calendar-tax-qa',{recursive:true});
const errors=[],unexpected=[],records=[],accounts=[{accountId:'a',accountName:'일본 투자',accountType:'INVESTMENT',currency:'JPY'},{accountId:'b',accountName:'한국 투자',accountType:'INVESTMENT',currency:'KRW'}];
const date='2026-10-20',checks=Array.from({length:11},(_,i)=>({id:`c${i}`,title:`긴 체크리스트 항목 ${i+1} — 내용을 읽고 준비합니다.`,done:false}));
const entries=[{id:'e1',kind:'EVENT',title:'업데이트 체크리스트',startDate:date,endDate:date,details:{allDay:true,checks},version:0}];
let rejectSave=false;
await context.route('**/api/**',async route=>{
 const req=route.request(),url=new URL(req.url()),path=url.pathname,json=data=>route.fulfill({json:data});
 if(path==='/api/users/myProfile')return json({userId:'u',nickname:'검증 사용자',role:'USER'});
 if(path==='/api/ledger/accounts')return json({accounts,totalAccounts:2,totalCachedBalance:0});
 if(path==='/api/workspace/settings')return json({calendarView:'month',weekStart:0});
 if(path==='/api/workspace/entries')return json(entries);
 if(path==='/api/calendar/google/status')return json({tokenAvailable:false,calendarReady:false});
 if(path==='/api/workspace/entries/e1'){Object.assign(entries[0],req.postDataJSON());return json(entries[0]);}
 if(path.includes('/annual-summary'))return json({year:Number(url.searchParams.get('year')),baseCurrency:path.includes('/a/')?'JPY':'KRW',taxAccountType:'UNSET',realizedBeforeTax:1000,realizedAfterTax:900,currencies:[{currency:path.includes('/a/')?'JPY':'KRW',purchases:100,sales:1100,dividends:50,fees:10,taxes:100,taxBreakdown:{TRANSACTION_TAX:20,WITHHOLDING_TAX:80}}],trades:[]});
 if(path.startsWith('/api/ledger/taxes/')){
  const year=Number(path.split('/')[4]);if(req.method()==='GET')return json(records.filter(r=>r.taxYear===year));
  if(rejectSave)return route.fulfill({status:409,json:{message:'다른 화면에서 수정했습니다. 새로고침 후 다시 시도하세요.'}});
  const body=req.postDataJSON(),accountId=path.split('/')[6]||null,id=`${year}:${accountId||'year'}`,record={...body,id,taxYear:year,accountId,version:(records.find(r=>r.id===id)?.version??-1)+1};
  records.splice(0,records.length,...records.filter(r=>r.id!==id),record);return json(record);
 }
 unexpected.push(path);return route.fulfill({status:501,json:{message:'Unexpected API'}});
});
page.on('pageerror',e=>errors.push(e.message));
const visit=path=>page.goto(`http://127.0.0.1:4186${path}`);
try{
 await new Promise(r=>setTimeout(r,900));await visit(`/calendar?date=${date}`);
 const detail=page.locator('aside.calendar-day-detail');await detail.waitFor();assert.ok(await detail.evaluate(e=>e.getBoundingClientRect().width>=350));
 await detail.getByRole('button',{name:'나머지 6개 보기'}).click();assert.equal(await detail.getByRole('checkbox').count(),11);
 const row=detail.locator('.calendar-check-row').first();await row.getByRole('button',{name:/메뉴/}).click();await row.getByRole('button',{name:/수정/}).click();await row.getByRole('textbox').fill('수정한 체크 항목');await row.getByRole('button',{name:'저장',exact:true}).click();await detail.getByText('수정한 체크 항목',{exact:true}).waitFor();
 await page.screenshot({path:'../.local/calendar-tax-qa/calendar-desktop.png'});
 await page.setViewportSize({width:768,height:900});await visit(`/calendar?date=${date}`);await page.locator('.calendar-workspace').waitFor();
 assert.ok(await page.locator('.workspace-main').evaluate(e=>e.getBoundingClientRect().left>=250));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await page.setViewportSize({width:390,height:844});await visit(`/calendar?date=${date}`);await page.locator('.calendar-date').first().waitFor();
 const scrollBefore=await page.locator('.workspace-main').evaluate(e=>e.scrollTop);await page.getByRole('button',{name:`${date} 일정 보기`,exact:true}).click();
 const sheet=page.getByRole('dialog',{name:'선택 날짜 상세'});await sheet.waitFor();assert.equal(await sheet.evaluate(e=>e.open),true);
 await page.screenshot({path:'../.local/calendar-tax-qa/calendar-mobile.png'});await sheet.getByRole('button',{name:'닫기',exact:true}).click();assert.equal(await page.locator('.workspace-main').evaluate(e=>e.scrollTop),scrollBefore);
 await page.setViewportSize({width:1440,height:1000});await visit('/ledger?tab=tax');await page.getByRole('heading',{name:'세금 관리',exact:true}).waitFor();await page.getByRole('table').waitFor();
 await page.getByLabel('세법상 거주지',{exact:true}).selectOption('JP');await page.getByRole('button',{name:'신고 기준 저장'}).click();await page.getByRole('status').waitFor();
 await page.getByRole('button',{name:'일본 투자 →'}).click();await page.getByLabel('계좌 개설 국가').selectOption('JP');await page.getByLabel('과세 계좌 유형',{exact:true}).selectOption('NISA');await page.getByLabel('연간보고서 확인 실현손익',{exact:false}).fill('-100');await page.getByLabel('신고·납부 기록').selectOption('REVIEW');await page.getByRole('button',{name:'계좌 설정 저장'}).click();await page.getByRole('status').waitFor();
 await page.reload();await page.getByRole('button',{name:'일본 투자 →'}).waitFor();await page.getByRole('button',{name:'일본 투자 →'}).click();assert.equal(await page.getByLabel('과세 계좌 유형',{exact:true}).inputValue(),'NISA');assert.equal(await page.getByLabel('연간보고서 확인 실현손익',{exact:false}).inputValue(),'-100');
 await page.screenshot({path:'../.local/calendar-tax-qa/tax-desktop.png'});
 await page.getByLabel('연도',{exact:true}).selectOption('2025');await page.getByRole('button',{name:'계좌 설정 저장'}).waitFor();assert.equal(await page.getByLabel('세법상 거주지',{exact:true}).inputValue(),'UNSET');assert.equal(await page.getByLabel('연간보고서 확인 실현손익',{exact:false}).inputValue(),'');
 await page.getByLabel('계좌 개설 국가').selectOption('KR');assert.equal(await page.getByLabel('과세 계좌 유형',{exact:true}).getByRole('option',{name:'NISA',exact:true}).count(),0);
 rejectSave=true;await page.getByRole('button',{name:'계좌 설정 저장'}).click();await page.getByRole('alert').waitFor();rejectSave=false;await page.getByRole('button',{name:'다시 불러오기'}).click();await page.getByRole('button',{name:'계좌 설정 저장'}).waitFor();
 for(const width of [768,390,360]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
 await page.screenshot({path:'../.local/calendar-tax-qa/tax-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);console.log('PASS calendar width/check editing/mobile dialog, tax country/type/save/reload/year separation/conflict retry, responsive widths. Mock APIs only.');
}finally{await browser.close();server.kill();}
