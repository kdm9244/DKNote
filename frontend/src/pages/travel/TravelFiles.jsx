export default function TravelFiles({ item, busy, error, onUpload, onDelete, onDownload, onClose }) {
  return <section className="travel-files-inline" role="region" aria-label={`${item.title} 첨부파일`}>
    <header className="travel-editor-header"><h3>첨부파일</h3><button type="button" disabled={busy} onClick={onClose}>파일 접기</button></header>
    <p className="travel-help">내 계정에서만 열 수 있습니다. 최대 10개입니다.</p>
    <label className="travel-upload">파일 추가<input aria-label="파일 추가" disabled={busy} type="file" multiple onChange={async e=>{const input=e.currentTarget;const files=[...input.files];if(files.length&&await onUpload(files))input.value='';}}/></label>
    {item.attachments.map(file=><article className="travel-file-row" key={file.attachmentId}><button onClick={()=>onDownload(file)}>{file.fileName} ↓</button>{file.deletable&&<button disabled={busy} onClick={()=>onDelete(file)}>삭제</button>}</article>)}
    {error&&<p role="alert" className="travel-error">{error}</p>}
  </section>;
}
