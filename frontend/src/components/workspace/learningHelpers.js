export function dateKey(date = new Date()) {
  const d = typeof date === "string" ? new Date(`${date}T12:00:00`) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function addDays(key, amount) {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + amount);
  return dateKey(d);
}
export function descendants(entries, id) {
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of entries)
      if (ids.has(e.parentId) && !ids.has(e.id)) {
        ids.add(e.id);
        changed = true;
      }
  }
  return entries.filter((e) => ids.has(e.id) && e.id !== id);
}
export function progress(entries, id) {
  const tasks = descendants(entries, id).filter((e) => e.kind === "TASK");
  return {
    total: tasks.length,
    done: tasks.filter((e) => e.completed).length,
    percent: tasks.length
      ? Math.round(
          (tasks.filter((e) => e.completed).length / tasks.length) * 100,
        )
      : 0,
  };
}
export function parentLabel(entries, entry) {
  const titles = [];
  let current = entry;
  const seen = new Set();
  while (current?.parentId && !seen.has(current.parentId)) {
    seen.add(current.parentId);
    current = entries.find((e) => e.id === current.parentId);
    if (current) titles.unshift(current.title);
  }
  return titles.join(" / ");
}
export const KIND_LABEL = {
  ROADMAP: "로드맵",
  MILESTONE: "세부 목표",
  TASK: "할 일",
  RECORD: "학습노트",
  PDF: "PDF 노트",
  WORD: "단어",
  COMMENT: "댓글",
  SCHEDULE: "학습 일정",
  EVENT: "일정",
  TEMPLATE: "체크리스트 템플릿",
};
export function codeFingerprint(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
