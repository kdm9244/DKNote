export default function CalendarChecklist({ event, saving, error, onToggle }) {
  const checks = event.details.checks || [];
  if (!checks.length) return null;
  return <fieldset className="calendar-day-checks" disabled={saving} aria-busy={saving}>
    <legend>체크 {checks.filter(check => check.done).length}/{checks.length}</legend>
    {checks.map((check, index) => <label key={check.id || index} className={check.done ? 'is-done' : ''}>
      <input type="checkbox" checked={Boolean(check.done)} onChange={() => onToggle(event, index)} />
      <span>{check.title}</span>
    </label>)}
    {saving && <small role="status">저장 중…</small>}
    {error && <p className="calendar-check-error" role="alert">{error}</p>}
  </fieldset>;
}
