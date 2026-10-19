import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, TextLayer } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import '../../styles/pdf-reader.css';

GlobalWorkerOptions.workerSrc = workerUrl;
// Keep fonts, Korean CMaps and image decoders on our origin, including behind Access.
const bundledData = import.meta.glob('../../../node_modules/pdfjs-dist/{cmaps,standard_fonts,wasm}/*.{bcmap,ttf,pfb,wasm}', {
  eager: true, query: '?url', import: 'default',
});
const dataUrls = new Map(Object.entries(bundledData).map(([path, url]) => [path.split('/').at(-1), url]));
class PdfDataFactory {
  async fetch({ filename }) {
    const url = dataUrls.get(filename);
    if (!url) throw new Error('PDF 글꼴 또는 이미지 자료를 찾지 못했습니다.');
    const response = await fetch(url);
    if (!response.ok) throw new Error('PDF 자료를 불러오지 못했습니다.');
    return new Uint8Array(await response.arrayBuffer());
  }
}
const clampZoom = value => Math.max(0.5, Math.min(4, value));

export default function PdfReader({ url, title, page, onPageChange,modeControls }) {
  const [document, setDocument] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const [rendering, setRendering] = useState(true);
  const [renderedPage, setRenderedPage] = useState(null);
  const [error, setError] = useState('');
  const [pageDraft, setPageDraft] = useState(String(page));
  const [interaction,setInteraction]=useState('select'),[textStatus,setTextStatus]=useState('loading');
  const viewportRef = useRef(null), pageRef = useRef(null);
  const touches = useRef(new Map()), gesture = useRef(null), anchor = useRef(null);
  const pageCallback = useRef(onPageChange);
  pageCallback.current = onPageChange;

  useEffect(() => {
    let active = true;
    setDocument(null);
    setError('');
    setRendering(true);
    setZoom(1);
    const task = getDocument({ url, BinaryDataFactory: PdfDataFactory, useWorkerFetch: false });
    task.promise.then(pdf => { if (active) setDocument(pdf); }).catch(() => {
      if (active) { setError('PDF를 표시하지 못했습니다. 원본 열기로 확인해 주세요.'); setRendering(false); }
    });
    return () => { active = false; void task.destroy().catch(() => {}); };
  }, [url]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => setWidth(Math.max(1, viewport.clientWidth - 24)));
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { setPageDraft(String(page)); }, [page]);
  useEffect(() => {
    if (document && (!Number.isInteger(page) || page < 1 || page > document.numPages)) {
      pageCallback.current(Math.max(1, Math.min(document.numPages, Math.trunc(Number(page)) || 1)));
    }
  }, [document, page]);

  useEffect(() => {
    if (!document || !width || page < 1 || page > document.numPages) return;
    let active = true, task, textLayer;
    setRendering(true);
    setError('');
    setTextStatus('loading');
    document.getPage(page).then(async pdfPage => {
      if (!active) return;
      const base = pdfPage.getViewport({ scale: 1 });
      const scale = width / base.width * zoom;
      const viewport = pdfPage.getViewport({ scale });
      // Bound bitmap memory on phones; only the current page is rendered.
      const density = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4_000_000 / (viewport.width * viewport.height)));
      const canvas = window.document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width * density));
      canvas.height = Math.max(1, Math.floor(viewport.height * density));
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `${title} ${page}페이지`);
      task = pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport, transform: [density, 0, 0, density, 0, 0] });
      await task.promise;
      if (!active) return;
      const surface = window.document.createElement('div');
      surface.className = 'pdf-reader-surface';
      surface.style.width = `${viewport.width}px`;
      surface.style.height = `${viewport.height}px`;
      surface.style.setProperty('--total-scale-factor', viewport.scale);
      const textContainer = window.document.createElement('div');
      textContainer.className = 'pdf-reader-text-layer';
      surface.append(canvas, textContainer);
      pageRef.current?.replaceChildren(surface);
      textLayer = new TextLayer({ textContentSource: pdfPage.streamTextContent(), container: textContainer, viewport });
      try { await textLayer.render(); if(active)setTextStatus(textContainer.textContent.trim()?'ready':'empty'); } catch (reason) {
        if (active && reason?.name !== 'AbortException') {textContainer.remove();setTextStatus('error');}
      }
      if (!active) return;
      setRenderedPage(page);
      const scroller = viewportRef.current;
      if (scroller && anchor.current) {
        const point = anchor.current;
        scroller.scrollLeft = 12 + point.left * viewport.width - point.x;
        scroller.scrollTop = 12 + point.top * viewport.height - point.y;
        anchor.current = null;
      }
      setRendering(false);
    }).catch(reason => {
      if (active && reason?.name !== 'RenderingCancelledException') {
        setError('페이지를 표시하지 못했습니다. 다른 페이지나 원본 열기를 확인해 주세요.');
        setRendering(false);
      }
    });
    return () => { active = false; task?.cancel(); textLayer?.cancel(); };
  }, [document, page, width, zoom, title]);

  const changePage = value => {
    const next = Math.max(1, Math.min(document?.numPages || 1, Math.trunc(Number(value)) || 1));
    setPageDraft(String(next));
    viewportRef.current?.scrollTo(0, 0);
    anchor.current = null;
    pageCallback.current(next);
  };
  const changeZoom = value => {
    const viewport = viewportRef.current;
    const canvas = pageRef.current?.firstElementChild;
    if (viewport && canvas) {
      const viewBox = viewport.getBoundingClientRect(), pageBox = canvas.getBoundingClientRect();
      anchor.current = { left: Math.max(0, Math.min(1, (viewBox.left + viewport.clientWidth / 2 - pageBox.left) / canvas.clientWidth)),
        top: Math.max(0, Math.min(1, (viewBox.top + viewport.clientHeight / 2 - pageBox.top) / canvas.clientHeight)),
        x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 };
    }
    setZoom(clampZoom(value));
  };
  const beginGesture = event => {
    if (interaction!=='pan') return;
    const viewport = event.currentTarget;
    viewport.setPointerCapture(event.pointerId);
    touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...touches.current.values()];
    if (points.length === 2) {
      const canvas = pageRef.current?.firstElementChild;
      gesture.current = { distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), zoom,
        target: zoom, width: canvas?.clientWidth, height: canvas?.clientHeight };
    }
  };
  const moveGesture = event => {
    const previous = touches.current.get(event.pointerId);
    if (!previous) return;
    touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...touches.current.values()];
    if (points.length === 2 && gesture.current) {
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      const pinch = gesture.current;
      pinch.target = clampZoom(pinch.zoom * distance / Math.max(1, pinch.distance));
      const canvas = pageRef.current?.firstElementChild;
      if (canvas && pinch.width && pinch.height) {
        // Preview the gesture immediately; render one sharp bitmap when released.
        canvas.style.transform = `scale(${pinch.target / pinch.zoom})`;
      }
    } else if (points.length === 1) {
      event.currentTarget.scrollLeft += previous.x - event.clientX;
      event.currentTarget.scrollTop += previous.y - event.clientY;
    }
  };
  const endGesture = event => {
    touches.current.delete(event.pointerId);
    if (gesture.current) changeZoom(gesture.current.target);
    gesture.current = null;
  };

  return <div className="pdf-reader">
    <div className="pdf-reader-toolbar" aria-label="PDF 읽기 도구">
      {modeControls}
      <div className="pdf-reader-controls">
        <button type="button" disabled={!document || page <= 1} onClick={() => changePage(page - 1)} aria-label="이전 페이지">‹</button>
        <form onSubmit={event => { event.preventDefault(); changePage(pageDraft); }}>
          <label><input aria-label="PDF 페이지 번호" type="number" inputMode="numeric" min="1" max={document?.numPages || 1}
            disabled={!document} value={pageDraft} onChange={event => setPageDraft(event.target.value)} onBlur={() => changePage(pageDraft)} /></label>
          <span>/ {document?.numPages || '…'}</span>
        </form>
        <button type="button" disabled={!document || page >= document.numPages} onClick={() => changePage(page + 1)} aria-label="다음 페이지">›</button>
      </div>
      <div className="pdf-reader-controls" role="group" aria-label="PDF 확대 비율">
        <button type="button" aria-label="PDF 축소" disabled={zoom <= .5} onClick={() => changeZoom(zoom - .25)}>−</button>
        <span className="pdf-reader-zoom" aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="PDF 확대" disabled={zoom >= 4} onClick={() => changeZoom(zoom + .25)}>＋</button>
        <button type="button" aria-label="너비 맞춤" title="너비 맞춤" onClick={() => changeZoom(1)}>맞춤</button>
      </div>
      <div className="pdf-reader-interaction" role="group" aria-label="PDF 조작 방식"><button type="button" aria-label="글자 선택" title="글자 선택" aria-pressed={interaction==='select'} onClick={()=>setInteraction('select')}>선택</button><button type="button" aria-label="화면 이동" title="화면 이동" aria-pressed={interaction==='pan'} onClick={()=>setInteraction('pan')}>이동</button></div>
      {(textStatus==='empty'||textStatus==='error')&&<span className="pdf-text-status" role="status" title={textStatus==='empty'?'선택할 수 있는 텍스트가 없습니다.':'글자 선택 정보를 불러오지 못했습니다.'}>{textStatus==='empty'?'텍스트 없음':'선택 불가'}</span>}
      <a href={url} target="_blank" rel="noopener noreferrer" aria-label="원본 새 창" title="원본 새 창">↗</a>
    </div>
    {error && <p className="ws-alert" role="alert">{error}</p>}
    <div className={`pdf-reader-viewport${interaction==='pan'?' is-panning':''}`} ref={viewportRef} tabIndex={0} aria-label="PDF 페이지. 방향키로 스크롤할 수 있습니다."
      aria-busy={rendering} onPointerDown={beginGesture} onPointerMove={moveGesture}
      onPointerUp={endGesture} onPointerCancel={endGesture} onLostPointerCapture={endGesture}>
      {rendering && <div className="pdf-reader-loading" role="status">페이지를 불러오는 중…</div>}
      <div className="pdf-reader-page" ref={pageRef} style={{ visibility: renderedPage === page ? 'visible' : 'hidden' }} />
    </div>
  </div>;
}
