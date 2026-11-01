export const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const localDate = value => { const [y,m,d] = value.split('-').map(Number); return new Date(y,m-1,d); };
export function periodRange(mode, anchor = dateKey()) {
  const start = localDate(anchor), end = localDate(anchor);
  if (mode === 'weekly') { start.setDate(start.getDate() - (start.getDay()+6)%7); end.setTime(start.getTime()); end.setDate(end.getDate()+6); }
  if (mode === 'monthly') { start.setDate(1); end.setMonth(end.getMonth()+1,0); }
  return {from:dateKey(start), to:dateKey(end)};
}
export function shiftPeriod(mode, anchor, direction) {
  const date = localDate(anchor);
  if (mode === 'monthly') { date.setDate(1); date.setMonth(date.getMonth()+direction); }
  else date.setDate(date.getDate()+direction*(mode === 'weekly' ? 7 : 1));
  return dateKey(date);
}
export function previousRange({from,to}) {
  const start = localDate(from), end = localDate(to);
  const days = Math.round((end-start)/86400000)+1;
  end.setTime(start.getTime()); end.setDate(end.getDate()-1); start.setDate(start.getDate()-days);
  return {from:dateKey(start),to:dateKey(end)};
}
export const ledgerMoney = (amount, currency='KRW') => new Intl.NumberFormat('ko-KR',{style:'currency',currency,maximumFractionDigits:currency==='KRW'?0:2}).format(Number(amount || 0));
