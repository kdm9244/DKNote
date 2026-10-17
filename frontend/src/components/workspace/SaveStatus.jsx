const labels={idle:'저장된 상태',draft:'저장 필요',saving:'저장 중…',saved:'저장됨',error:'저장 실패 · 초안 유지'};
export default function SaveStatus({mode='manual',phase='idle',message,label}) {
  return <div className={`save-status is-${phase}`} role="status" aria-live="polite"><span className="save-mode">{mode==='auto'?'자동 저장':'직접 저장'}</span>{label&&<span className="save-scope">{label}</span>}<strong>{message || labels[phase] || labels.idle}</strong></div>;
}
