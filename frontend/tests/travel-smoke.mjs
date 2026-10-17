import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
const base=process.env.TRAVEL_TEST_URL,token=process.env.TRAVEL_TEST_TOKEN;
if(!base||!token)throw new Error('Run using isolated PersonalTravelBrowserTest.');
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1366,height:768}});
const page=await context.newPage();page.setDefaultTimeout(12000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await context.addInitScript(t=>sessionStorage.setItem('accessToken',t),token);
const call=async(url)=>{const r=await context.request.get(`${base}${url}`,{headers:{Authorization:`Bearer ${token}`}});assert.ok(r.ok(),`${url}: ${r.status()}`);return r.json();};
const dialog=()=>page.locator('.travel-editor');
const submit=async()=>{await dialog().getByRole('button',{name:'저장',exact:true}).click();await dialog().waitFor({state:'hidden'});};
const fill=(name,value)=>dialog().getByLabel(name,{exact:true}).fill(value);
const nav=async label=>{const mobile=(await page.viewportSize()).width<=760;if(mobile)await page.getByRole('button',{name:'여행 메뉴 열기',exact:true}).click();await page.getByRole('navigation',{name:'여행 메뉴'}).getByRole('link',{name:label,exact:true}).click();if(mobile)await page.waitForFunction(()=>!document.querySelector('.feature-sidebar').classList.contains('is-mobile-open')&&document.querySelector('.feature-sidebar').getBoundingClientRect().right<=1);};
const screenshot=async name=>page.screenshot({path:path.resolve('../.local',`qa-travel-${name}.png`),fullPage:true});
try {
  await page.goto(`${base}/planner`);await page.getByRole('heading',{name:'나의 여행'}).waitFor();
  await page.getByRole('button',{name:'＋ 새 여행',exact:true}).click();await fill('여행 이름','교토 개인 여행');await fill('목적지','교토');await fill('시작일','2026-11-01');await fill('종료일','2026-11-03');await dialog().getByLabel('여행지 시간대').selectOption('Asia/Tokyo');await submit();await page.waitForURL('**/itinerary');
  const id=page.url().split('/trips/')[1].split('/')[0];
  await page.getByRole('button',{name:'＋ 장소',exact:true}).click();await fill('장소 이름','기요미즈데라');await fill('주소','교토 기요미즈');await submit();
  await page.getByRole('button',{name:'이 날짜에 추가',exact:true}).click();await fill('시작 시간','10:00');await fill('종료 시간','11:00');await submit();
  const first=page.locator('.travel-activity').first();await first.getByRole('combobox',{name:'기요미즈데라 날짜 이동'}).selectOption({label:'2일차'});
  await page.getByRole('button',{name:'2일차',exact:false}).click();await page.locator('.travel-activity').getByRole('heading',{name:'기요미즈데라'}).waitFor();
  await page.getByRole('button',{name:'＋ 일정 추가',exact:true}).click();await fill('일정 이름','겹치는 카페');await fill('시작 시간','10:30');await fill('종료 시간','11:30');await submit();assert.ok(await page.getByText('기요미즈데라 일정과 시간이 겹칩니다.').isVisible());
  await page.getByRole('button',{name:'겹치는 카페 위로 이동'}).click();await page.waitForFunction(()=>document.querySelector('.travel-activity h3')?.textContent==='겹치는 카페');
  await nav('예약·자료');await page.getByRole('button',{name:'＋ 예약 추가'}).click();await fill('예약 이름','교토 숙소');await fill('예약번호','QA-123');await fill('이용·체크인 일시','2026-11-02T15:00');await dialog().getByLabel('예약 상태').selectOption('BOOKED');
  const detail=await call(`/api/travel/trips/${id}`);const activity=detail.days.flatMap(d=>d.activities).find(a=>a.title==='기요미즈데라');await dialog().getByText('추가 정보',{exact:true}).click();await dialog().getByLabel('연결할 일정').selectOption(activity.id);await submit();
  await page.getByRole('button',{name:'첨부파일 0'}).click();await page.getByLabel('파일 추가',{exact:true}).setInputFiles({name:'숙소-확인서.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF')});await page.getByRole('button',{name:'숙소-확인서.pdf ↓'}).waitFor();
  const afterUpload=await call(`/api/travel/trips/${id}`);const file=afterUpload.checklist[0].attachments[0];const anonymous=await browser.newContext();const rejected=await anonymous.request.get(`${base}${file.fileUrl}`);assert.equal(rejected.status(),401);await anonymous.close();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'숙소-확인서.pdf ↓'}).click();await downloadPromise;await page.getByRole('button',{name:'파일 접기'}).click();await page.getByRole('button',{name:'첨부파일 1'}).click();await page.locator('.travel-files-inline').waitFor();assert.equal(await page.getByRole('dialog').count(),0);await page.getByRole('button',{name:'파일 접기'}).click();
  await nav('준비물');await page.getByRole('button',{name:'＋ 준비물'}).click();await fill('준비물 이름','여권');await fill('분류','서류');await submit();await page.getByRole('checkbox',{name:'여권'}).click();await page.getByText('1 / 1 준비 완료').waitFor();
  await nav('예산·지출');await page.getByRole('button',{name:'＋ 지출 추가'}).click();await fill('지출 이름','점심');await fill('실제 지출 금액','3000');await dialog().getByLabel('통화',{exact:true}).selectOption('JPY');await fill('1 외화 단위당 원화 환율','9');await submit();await page.getByText('KRW 27,000',{exact:true}).waitFor();
  const persisted=await call(`/api/travel/trips/${id}`);assert.equal(persisted.expenses[0].currency,'JPY');assert.equal(persisted.budget.actualKrw,27000);assert.equal(persisted.reservations[0].activityId,activity.id);assert.equal(persisted.days[1].activities[0].title,'겹치는 카페');
  await page.reload();await page.getByText('KRW 27,000',{exact:true}).waitFor();
  // A failed write must keep the editor and never manufacture a saved row.
  await page.route('**/api/travel/trips/*/expenses',r=>r.request().method()==='POST'?r.fulfill({status:500,json:{message:'검증용 저장 실패'}}):r.continue());
  await page.getByRole('button',{name:'＋ 지출 추가'}).click();await fill('지출 이름','실패 입력 보존');await fill('실제 지출 금액','500');await dialog().getByRole('button',{name:'저장',exact:true}).click();await dialog().getByRole('alert').waitFor();assert.equal(await dialog().getByLabel('지출 이름').inputValue(),'실패 입력 보존');assert.equal(await page.locator('.travel-expenses h3').filter({hasText:'실패 입력 보존'}).count(),0);await dialog().getByRole('button',{name:'취소'}).click();await page.unroute('**/api/travel/trips/*/expenses');
  for(const size of [{width:1366,height:768},{width:1280,height:640},{width:390,height:844}]) {
    await page.setViewportSize(size);
    for(const section of ['일정','예약·자료','준비물','예산·지출']) {
      await nav(section);await page.locator('.travel-section-title h2').first().waitFor();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${section} horizontal overflow`);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),`${section} outer scroll`);
    }
    await nav('일정');await page.getByRole('button',{name:'2일차',exact:false}).click();await page.locator('.travel-activity').first().waitFor();await screenshot(`${size.width}-${size.height}`);
    if(size.width>760){await page.getByRole('button',{name:'사이드바 접기'}).click();assert.equal(Math.round((await page.locator('.feature-sidebar').boundingBox()).width),76);await page.getByRole('button',{name:'사이드바 펼치기'}).click();}
  }
  assert.deepEqual(errors,[]);console.log('PASS: personal trip, place, manual schedule/move/order/conflicts, reservation link/private files, checklist, FX expenses, reload, failed save preservation, laptop/mobile sidebar and scroll.');
}catch(e){await screenshot('failure');throw e;}finally{await browser.close();}
