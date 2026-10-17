export const TRAVEL_CURRENCIES = ['KRW', 'JPY', 'USD', 'EUR', 'CNY', 'GBP', 'TWD'];
export const ACTIVITY_TYPES = { SPOT: '관광·장소', MEAL: '식사·카페', HOTEL: '숙소', TRANSPORT: '이동', SHOPPING: '쇼핑', MEETING: '약속' };
export const money = (amount, currency = 'KRW') => `${currency} ${Number(amount || 0).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}`;
export const safeLink = value => /^https?:\/\//i.test(value || '') ? value : undefined;
export const mapsLink = activity => activity.type === 'TRANSPORT'
  ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(activity.departureLocation || '')}&destination=${encodeURIComponent(activity.arrivalLocation || '')}`
  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.location || activity.address || activity.title || '')}`;
const minutes = time => time ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) : null;
export function scheduleWarnings(activities) {
  const warnings = new Map();
  const add = (id, text) => warnings.set(id, [...(warnings.get(id) || []), text]);
  for (let i = 0; i < activities.length; i++) {
    const a = activities[i], start = minutes(a.startTime), end = minutes(a.endTime);
    if (start === null || end === null) continue;
    for (let j = 0; j < i; j++) {
      const b = activities[j], bs = minutes(b.startTime), be = minutes(b.endTime);
      if (bs !== null && be !== null && start < be && bs < end) {
        add(a.id, `${b.title} 일정과 시간이 겹칩니다.`);
        add(b.id, `${a.title} 일정과 시간이 겹칩니다.`);
      }
    }
    const previous = activities[i - 1];
    if (previous && minutes(previous.endTime) !== null) {
      const gap = start - minutes(previous.endTime);
      if (gap >= 0 && gap < Number(a.travelMinutes || 0)) add(a.id, `이동 여유가 ${Number(a.travelMinutes) - gap}분 부족합니다.`);
      if (start < minutes(previous.startTime)) add(a.id, '방문 순서와 시간 순서가 다릅니다.');
    }
  }
  return warnings;
}
