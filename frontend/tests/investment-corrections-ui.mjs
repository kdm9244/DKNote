// Only changed investment and notice-publisher flows; every API is mocked.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4178'],{stdio:'ignore'});
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:1366,height:900},reducedMotion:'reduce'}),page=await context.newPage();
page.setDefaultTimeout(10000);await mkdir('../.local/investment-qa',{recursive:true});
await context.addInitScript(()=>sessionStorage.setItem('accessToken','ui-test'));
const errors=[],unexpected=[],writes=[],years=[];page.on('pageerror',e=>errors.push(e.message));
let publisher=false,fail=false,type='UNSET',annualLoads=0,newTradePayload=null;
const account={accountId:'a',accountName:'日本の証券口座',accountType:'INVESTMENT',accountPurpose:'STOCK_BROKERAGE',currency:'JPY',cachedBookBalance:10000,isActive:true};
let tx={investmentTransactionId:'tx',investmentId:'h',tradeType:'SELL',tradeDate:'2026-05-10T12:00:00',quantity:1,unitPrice:2000,grossAmount:2000,feeAmount:10,taxAmount:100,netAmount:1890,realizedProfitLoss:390,currency:'JPY',exchangeRate:1,taxKind:'UNCLASSIFIED',version:0,memo:''};
const detail=()=>({account,profile:{taxAccountType:type},summary:{cashBalance:account.cachedBookBalance},holdings:[{investmentId:'h',tickerCode:'7203',symbolName:'日本株',assetClass:'FOREIGN_STOCK',market:'TSE',currency:'JPY',quantity:5,currentPrice:2000}],allocations:[],performance:{},alerts:[],notes:[],targetAllocations:[],recentTrend:[]});
const json=(r,data,status=200)=>r.fulfill({status,json:data});
await page.route('**/api/**',async route=>{
 const req=route.request(),url=new URL(req.url()),p=url.pathname,m=req.method();if(!p.startsWith('/api/'))return route.continue();
 if(publisher&&(p.startsWith('/api/workspace/')||p.startsWith('/api/ledger/')))unexpected.push('publisher requested '+p);
 const body=req.headers()['content-type']?.includes('application/json')?req.postDataJSON():null;
 if(p==='/api/users/myProfile')return json(route,{userId:publisher?'publisher':'u',email:publisher?'kdeok':'u@example.com',role:publisher?'NOTICE_PUBLISHER':'USER'});
 if(p==='/api/auth/policy')return json(route,{signupEnabled:false});
 if(p==='/api/workspace/entries')return json(route,[]);
 if(p==='/api/workspace/settings')return json(route,{});
 if(p==='/api/ledger/taxes/trade-context')return json(route,{residence:'JP',accountCountry:'JP',accountType:'GENERAL',treatment:'ANNUAL'});
 if(p.endsWith('/overview'))return json(route,{year:Number(p.split('/')[4]),current:{totals:[],transactionTaxes:{},unclassifiedTaxes:{},accounts:[],issues:[],requiredRates:[]},estimate:null,rates:{},payments:{},legacyRecords:[],changed:false,version:null});
 if(p==='/api/ledger/accounts')return json(route,{accounts:[account],totalAccounts:1,totalCachedBalance:10000});
 if(p==='/api/ledger/investment-accounts/price-provider/status')return json(route,{configured:false});
 if(p==='/api/ledger/investment-accounts/a/detail')return json(route,detail());
 if(p==='/api/ledger/investment-accounts/a/transactions'){
  if(m==='POST'){newTradePayload=body;return json(route,{...tx,...body,investmentTransactionId:'new-tx'},201);}
  return json(route,{content:[tx]});
 }
 if(p==='/api/ledger/investment-accounts/a/fee-settings')return json(route,['JP','KR','US'].map(marketGroup=>({marketGroup,buyFeeRate:0,sellFeeRate:0,sellTaxRate:20.315,dividendTaxRate:0})));
 if(p==='/api/ledger/investment-accounts/a/transactions/tx/costs'){
  writes.push(body);if(fail)return json(route,{message:'검증용 수정 충돌'},409);
  tx={...tx,...body,version:tx.version+1,netAmount:2000-body.feeAmount-body.taxAmount,realizedProfitLoss:500-body.feeAmount-body.taxAmount};return json(route,tx);
 }
 if(p==='/api/ledger/investment-accounts/a/profile'){
  if(fail)return json(route,{message:'유형 저장 실패'},500);type=body.taxAccountType;return json(route,{taxAccountType:type});
 }
 if(p==='/api/ledger/investment-accounts/a/annual-summary'){
  annualLoads++;const year=Number(url.searchParams.get('year'));years.push(year);
  const trades=year===2026?Array.from({length:65},(_,i)=>({symbolName:i===64?'=SUM(1,2)':'日本株',market:'TSE',transaction:{...tx,investmentTransactionId:`annual-${i}`}})):[];
  return json(route,{year,baseCurrency:'JPY',taxAccountType:type,realizedBeforeTax:490,realizedAfterTax:tx.realizedProfitLoss,currencies:trades.length?[{currency:'JPY',purchases:1500,sales:2000,dividends:100,fees:tx.feeAmount,taxes:tx.taxAmount,taxBreakdown:{[tx.taxKind]:tx.taxAmount}}]:[],trades});
 }
 if(p==='/api/notices'){
  if(m==='POST'){writes.push(body);return json(route,{...body,id:'notice',createdAt:'2026-10-19T12:00:00',version:0},201);}
  return json(route,{canManage:publisher,canPublish:publisher,notices:[]});
 }
 unexpected.push(p);return json(route,{message:'Unexpected API'},501);
});
const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal page overflow');
try{
 await new Promise(resolve=>setTimeout(resolve,1000));await page.goto('http://127.0.0.1:4178/ledger/investment');
 const annual=page.getByRole('region',{name:'연간 투자 정리'});
 await page.getByRole('button',{name:'세금 정산 보기 →'}).waitFor();assert.equal(await annual.count(),0);
 await page.getByRole('tab',{name:'거래 내역',exact:true}).click();await page.getByRole('button',{name:'비용 수정',exact:true}).click();
 const editor=page.getByRole('region',{name:'거래 비용 수정',exact:true});await editor.getByLabel('세금',{exact:true}).fill('120');await editor.getByLabel('세금 구분').selectOption('WITHHOLDING_TAX');await editor.getByLabel('메모').fill('明細と照合済み');
 fail=true;await editor.getByRole('button',{name:'수정 저장'}).click();await editor.getByRole('alert').filter({hasText:'검증용 수정 충돌'}).waitFor();assert.equal(await editor.getByLabel('세금',{exact:true}).inputValue(),'120');
 const previousLoads=annualLoads;fail=false;await editor.getByRole('button',{name:'수정 저장'}).click();await editor.waitFor({state:'hidden'});assert.equal(tx.taxAmount,120);assert.equal(tx.version,1);assert.equal(writes.at(-1).version,0);assert.equal(writes.at(-1).taxKind,'WITHHOLDING_TAX');
 await page.getByRole('button',{name:'세금 정산 보기 →'}).click();await annual.getByRole('heading',{name:'JPY 거래 합계'}).waitFor();
 await page.getByLabel('정산 연도',{exact:true}).selectOption('2025');await annual.getByText('이 연도에 등록된 투자 거래가 없습니다.',{exact:true}).waitFor();
 await page.getByLabel('정산 연도',{exact:true}).selectOption('2026');
 await annual.locator('dd').filter({hasText:'120'}).first().waitFor();assert.ok(annualLoads>previousLoads);
 const [download]=await Promise.all([page.waitForEvent('download'),annual.getByRole('button',{name:'CSV 내려받기'}).click()]);await download.saveAs('../.local/investment-qa/annual.csv');const csv=await readFile('../.local/investment-qa/annual.csv','utf8');assert.equal(csv.trim().split('\r\n').length,66);assert.ok(csv.includes("'=SUM(1,2)"));assert.ok(csv.includes('원천징수 세금'));
 for(const width of [360,390,768]){await page.setViewportSize({width,height:844});await noOverflow();}
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'../.local/investment-qa/annual-mobile.png',fullPage:true});
 await page.goto('http://127.0.0.1:4178/ledger/investment');await page.getByRole('button',{name:'＋ 거래 추가',exact:true}).click();await page.locator('.investment-trade-type-grid').getByRole('button',{name:/매도/}).click();await page.locator('.investment-holding-selector').getByRole('button',{name:/日本株/}).click();await page.getByLabel('수량 *',{exact:true}).fill('1');
 assert.match(await page.locator('.investment-transaction-preview').getByText('예상 세금',{exact:true}).evaluate(e=>e.nextElementSibling.textContent),/0/);
 await page.getByLabel('실제 납부 세금',{exact:true}).fill('120');await noOverflow();await page.getByRole('button',{name:'거래 저장',exact:true}).click();await page.getByRole('button',{name:'세금 정산 보기 →'}).waitFor();assert.equal(newTradePayload.taxAmount,120);assert.equal(newTradePayload.currency,'JPY');
 publisher=true;await page.goto('http://127.0.0.1:4178/learning/words');await page.waitForURL('**/updates');assert.notEqual(await page.getByRole('button',{name:'공지 작성'}).evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');await page.getByRole('button',{name:'공지 작성'}).click();
 assert.equal(await page.locator('.feature-sidebar').count(),0);assert.equal(await page.getByRole('button',{name:'수정',exact:true}).count(),0);await page.getByLabel('제목',{exact:true}).fill('공지 등록 시험');await page.getByLabel('버전',{exact:true}).fill('1.2');await page.getByLabel('업데이트 내용').fill('등록 전용 계정 확인');await page.getByRole('button',{name:'공지 저장'}).click();await page.getByRole('heading',{name:'공지 등록 시험',exact:true}).waitFor();await noOverflow();
 await page.screenshot({path:'../.local/investment-qa/publisher-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);assert.ok(years.includes(2025)&&years.includes(2026));
 console.log('PASS: cost correction/revision/failure preservation, relocated annual refresh/year, full 65-row CSV and formula escaping, 360/390/768px layout, publisher redirect and post-only UI. APIs mocked.');
}catch(e){console.error({url:page.url(),errors,unexpected,screen:(await page.locator('body').innerText()).slice(-2000)});throw e;}finally{await browser.close();server.kill();}
