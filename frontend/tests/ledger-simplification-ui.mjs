// Isolated UI regressions: API writes remain in memory and never touch user data.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4179','--strictPort'],{stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{server.stdout.on('data',chunk=>{if(String(chunk).includes('Local:'))resolve();});server.on('exit',code=>reject(new Error('Preview server exit '+code)));setTimeout(()=>reject(new Error('Preview startup timeout')),15000).unref();});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1366,height:900},timezoneId:'Asia/Seoul',reducedMotion:'reduce'});
await context.addInitScript(()=>sessionStorage.setItem('accessToken','ui-test'));
await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
const page=await context.newPage();page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(30000);
const errors=[],unexpected=[],ranges=[],writes=[];
page.on('pageerror',e=>errors.push(e.message));
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
const account={accountId:'a',accountName:'단타 계좌',accountType:'INVESTMENT',accountPurpose:'STOCK_BROKERAGE',currency:'KRW',cachedBookBalance:1500000,isActive:true,initialBalanceDate:'2020-01-01'};
const cashAccount={...account,accountId:'c',accountName:'생활비 통장',accountType:'CHECKING',accountPurpose:'LIVING_CHECKING',cachedBookBalance:1000000};
let transactions=[],hasPositions=false,writeFailure=false;
let entries=[{id:'r',kind:'ROADMAP',title:'개발 공부',body:'',format:'plain',startDate:today,endDate:'2027-12-31',position:0,details:{},version:0,createdAt:today+'T12:00:00'},
 {id:'note',kind:'RECORD',title:'테스트 노트',body:'<p>저장된 내용</p>',format:'richtext',parentId:'r',startDate:today,position:0,details:{},version:0,createdAt:today+'T12:00:00'}];
const detail=()=>({account,profile:{},summary:{cashBalance:account.cachedBookBalance,totalAsset:account.cachedBookBalance},holdings:hasPositions?[{investmentId:'h',symbolName:'보유 종목',assetClass:'DOMESTIC_STOCK',quantity:1,currency:'KRW'}]:[],allocations:[],performance:{realizedProfitLoss:transactions.reduce((s,t)=>s+t.realizedProfitLoss,0)},alerts:[],notes:[],targetAllocations:[],recentTrend:[]});
const json=(r,data,status=200)=>r.fulfill({status,json:data});
await context.route('**/api/**',async r=>{
 const req=r.request(),u=new URL(req.url()),p=u.pathname,m=req.method(),body=req.postData()?req.postDataJSON():null;
 if(!p.startsWith('/api/'))return r.continue();
 if(p==='/api/users/myProfile')return json(r,{userId:'u',role:'USER',email:'test@example.com'});
 if(p==='/api/workspace/entries')return json(r,entries);
 if(p==='/api/workspace/settings')return json(r,{});
 if(p.startsWith('/api/workspace/entries/')&&m==='PUT'){entries=entries.map(e=>e.id==='note'?{...e,...body,version:e.version+1}:e);writes.push(body);return json(r,entries.find(e=>e.id==='note'));}
 if(p==='/api/ledger/accounts')return json(r,{accounts:[cashAccount,account],totalAccounts:2});
 if(p==='/api/ledger/dashboard'){
  ranges.push(Object.fromEntries(u.searchParams));
  return json(r,{month:u.searchParams.get('month')||today.slice(0,7),monthlyIncome:{KRW:100000},monthlyExpense:{KRW:25000},monthlyNetCashFlow:{KRW:75000},categorySpending:[{category:'식비',currency:'KRW',amount:25000,ratio:100}],recentTransactions:[{transactionId:'t1',transactionDate:today+'T23:59:00',transactionType:'EXPENSE',title:'저녁 식사',category:'식비',amount:25000,currency:'KRW',accountName:'생활비 통장'}],investment:{accountCount:1,totals:[]},debt:{}});
 }
 if(p==='/api/ledger/investment-accounts/price-provider/status')return json(r,{configured:false});
 if(p==='/api/ledger/investment-accounts/a/detail')return json(r,detail());
 if(p==='/api/ledger/investment-accounts/a/transactions')return json(r,{content:transactions,totalPages:1});
 if(p==='/api/ledger/investment-accounts/transactions')return json(r,transactions.map(t=>({...t,accountCurrency:'KRW',accountId:'a'})));
 if(p==='/api/ledger/investment-accounts/a/settlements'&&m==='POST'){
  writes.push(body);if(writeFailure)return json(r,{message:'잔액이 변경되었습니다.'},409);
  const profit=body.profitLoss??body.finalCashBalance-account.cachedBookBalance;
  const tx={investmentTransactionId:'s',investmentId:'cash',tradeType:'PROFIT_SETTLEMENT',tradeDate:body.date+'T12:00:00',netAmount:profit,realizedProfitLoss:profit,grossAmount:Math.abs(profit),currency:'KRW',feeAmount:0,taxAmount:0,quantity:0,unitPrice:0,memo:body.memo,version:0};
  account.cachedBookBalance+=profit;transactions=[tx];return json(r,tx);
 }
 if(p==='/api/ledger/investment-accounts/a/settlements/s'&&m==='PUT'){
  const tx=transactions[0];account.cachedBookBalance+=body.profitLoss-tx.netAmount;Object.assign(tx,{netAmount:body.profitLoss,realizedProfitLoss:body.profitLoss,version:tx.version+1});return json(r,tx);
 }
 if(p==='/api/ledger/investment-accounts/a/settlements/s'&&m==='DELETE'){account.cachedBookBalance-=transactions[0].netAmount;transactions=[];return r.fulfill({status:204});}
 if(p==='/api/ledger/transactions'&&m==='POST'){writes.push(body);return json(r,{...body,transactionId:'quick'});}
 if(p==='/api/notices')return json(r,{notices:[]});
 unexpected.push(m+' '+p);return json(r,{message:'Unexpected API'},501);
});
const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal document overflow');
await mkdir('../.local/ledger-simplification-qa',{recursive:true});
try{
 await page.goto('http://127.0.0.1:4179/ledger');
 await page.getByRole('button',{name:/이번 달 사용액/}).waitFor();
 await noOverflow();await page.screenshot({path:'../.local/ledger-simplification-qa/dashboard-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'＋ 지출 입력',exact:true}).click();
 const quick=page.getByRole('region',{name:'지출 빠른 입력'});await quick.getByLabel('금액').fill('3000');await quick.getByLabel('사용 내역').fill('커피');await quick.getByRole('button',{name:'지출 저장',exact:true}).click();await quick.waitFor({state:'hidden'});assert.equal(writes.at(-1).transactionType,'EXPENSE');
 await page.getByRole('button',{name:/이번 달 사용액/}).click();
 await page.getByRole('heading',{name:'사용 내역 통계'}).waitFor();await page.getByRole('heading',{name:'카테고리별 사용액'}).waitFor();
 await page.getByRole('button',{name:'일간',exact:true}).click();await page.getByRole('heading',{name:'카테고리별 사용액'}).waitFor();
 assert.ok(ranges.some(r=>r.from===today&&r.to===today));
 await page.getByRole('button',{name:'주간',exact:true}).click();await page.getByRole('heading',{name:'카테고리별 사용액'}).waitFor();
 await page.getByRole('button',{name:'직접 선택',exact:true}).click();await page.getByLabel('시작일',{exact:true}).fill('2026-02-01');await page.getByLabel('종료일',{exact:true}).fill('2026-02-28');await page.getByRole('heading',{name:'카테고리별 사용액'}).waitFor();assert.ok(ranges.some(r=>r.from==='2026-02-01'&&r.to==='2026-02-28'));
 await page.screenshot({path:'../.local/ledger-simplification-qa/statistics-desktop.png',fullPage:true});
 await page.getByRole('button',{name:/대시보드/,exact:false}).first().click();
 await page.getByRole('button',{name:'투자 손익 정산',exact:true}).click();
 let settlement=page.getByRole('region',{name:'투자 손익 정산',exact:true});await settlement.waitFor();
 await settlement.getByLabel('최종 예수금').fill('1600000');await settlement.getByRole('checkbox').check();
 writeFailure=true;await settlement.getByRole('button',{name:'손익 정산 저장',exact:true}).click();await settlement.getByRole('alert').filter({hasText:'잔액이 변경'}).waitFor();assert.equal(await settlement.getByLabel('최종 예수금').inputValue(),'1600000');
 writeFailure=false;await settlement.getByRole('button',{name:'손익 정산 저장',exact:true}).click();await settlement.waitFor({state:'hidden'});assert.equal(account.cachedBookBalance,1600000);
 await page.getByRole('tab',{name:'거래 내역',exact:true}).click();await page.getByRole('button',{name:'정산 수정',exact:true}).click();
 settlement=page.getByRole('region',{name:'투자 손익 정산 수정',exact:true});await settlement.getByLabel('정산 순손익').fill('70000');await settlement.getByRole('checkbox').check();await settlement.getByRole('button',{name:'정산 수정 저장',exact:true}).click();await settlement.waitFor({state:'hidden'});assert.equal(account.cachedBookBalance,1570000);
 await page.getByRole('button',{name:'정산 수정',exact:true}).click();page.once('dialog',d=>d.accept());await settlement.getByRole('button',{name:'정산 취소',exact:true}).click();await settlement.waitFor({state:'hidden'});assert.equal(account.cachedBookBalance,1500000);
 hasPositions=true;await page.reload();await page.getByRole('button',{name:'투자 손익 정산',exact:true}).click();settlement=page.getByRole('region',{name:'투자 손익 정산',exact:true});assert.equal(await settlement.getByRole('button',{name:'최종 예수금으로 계산'}).isDisabled(),true);await settlement.getByRole('button',{name:'닫기',exact:true}).click();
 await page.goto('http://127.0.0.1:4179/learning/roadmaps/r');await page.getByRole('heading',{name:'개발 공부',exact:true}).waitFor();await page.getByRole('button',{name:/모든 유형/}).waitFor();
 await page.getByRole('link',{name:/테스트 노트/}).click();await page.locator('.record-detail-columns').getByRole('button',{name:'편집',exact:true}).click();
 const editor=page.getByRole('region',{name:'학습노트 편집',exact:true});await editor.getByLabel('제목',{exact:true}).fill('수정한 제목');
 let dialogs=0;const dismissed=page.waitForEvent('dialog');await editor.getByRole('button',{name:'편집 닫기'}).click();await (await dismissed).dismiss();dialogs++;await editor.waitFor();assert.equal(dialogs,1);assert.equal(await editor.getByLabel('제목',{exact:true}).inputValue(),'수정한 제목');
 const accepted=page.waitForEvent('dialog');await editor.getByRole('button',{name:'편집 닫기'}).click();await (await accepted).accept();dialogs++;await editor.waitFor({state:'hidden'});assert.equal(dialogs,2);
 await page.locator('.record-detail-columns').getByRole('button',{name:'편집',exact:true}).click();await editor.getByLabel('제목',{exact:true}).fill('저장한 제목');await editor.getByRole('button',{name:'저장',exact:true}).click();await page.getByRole('heading',{name:'저장한 제목',exact:true}).waitFor();assert.equal(dialogs,2);
 await page.getByRole('link',{name:'← 돌아가기',exact:true}).click();await page.getByRole('heading',{name:'개발 공부',exact:true}).waitFor();
 // No-change cancellation is immediate; browser back is protected before leaving.
 await page.getByRole('link',{name:/저장한 제목/}).click();await page.locator('.record-detail-columns').getByRole('button',{name:'편집',exact:true}).click();
 await editor.getByRole('button',{name:'편집 닫기'}).click();await editor.waitFor({state:'hidden'});
 await page.locator('.record-detail-columns').getByRole('button',{name:'편집',exact:true}).click();await editor.getByLabel('제목',{exact:true}).fill('뒤로가기 미저장');
 const backDialog=page.waitForEvent('dialog');const back=page.goBack();await (await backDialog).dismiss();await back;await editor.waitFor();
 const leaveDialog=page.waitForEvent('dialog');await editor.getByRole('button',{name:'편집 닫기'}).click();await (await leaveDialog).accept();await editor.waitFor({state:'hidden'});
 await page.goto('http://127.0.0.1:4179/learning/records');await page.getByLabel('노트 검색',{exact:true}).fill('저장한 제목');await page.getByRole('link',{name:/저장한 제목/}).click();await page.getByRole('link',{name:'← 돌아가기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('input[aria-label="노트 검색"]')?.value==='저장한 제목');assert.equal(await page.getByLabel('노트 검색',{exact:true}).inputValue(),'저장한 제목');
 await page.goto('http://127.0.0.1:4179/ledger');await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:/이번 달 사용액/}).waitFor();await noOverflow();await page.screenshot({path:'../.local/ledger-simplification-qa/dashboard-mobile.png',fullPage:true});await page.getByRole('button',{name:/이번 달 사용액/}).click();await page.getByRole('heading',{name:'카테고리별 사용액'}).waitFor();await noOverflow();await page.screenshot({path:'../.local/ledger-simplification-qa/statistics-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);console.log('PASS dashboard, quick expense, daily/weekly/custom statistics, settlement save/edit/cancel, open-position guard, note cancellation/save/return, desktop/mobile layout');
}catch(e){console.error({errors,unexpected,url:page.url(),body:(await page.locator('body').innerText({timeout:1000}).catch(()=>'<body unavailable>')).slice(0,1800)});await page.screenshot({path:'../.local/ledger-simplification-qa/failure.png',fullPage:true,timeout:2000}).catch(()=>{});throw e;}finally{await browser.close();server.kill();}
