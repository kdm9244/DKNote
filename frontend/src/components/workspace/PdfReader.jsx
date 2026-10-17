import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
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

export default function PdfReader({ url, title, page, onPageChange }) {
  const [document, setDocument] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const [rendering, setRendering] = useState(true);
  const [renderedPage, setRenderedPage] = useState(null);
  const [error, setError] = useState('');
  const [pageDraft, setPageDraft] = useState(String(page));
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
    let active = true, task;
    setRendering(true);
    setError('');
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
      canvas.setAttribute('aria-label', `${title} ${page}페이지. 텍스트 선택과 검색은 원본 열기를 이용하세요.`);
      task = pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport, transform: [density, 0, 0, density, 0, 0] });
      await task.promise;
      if (!active) return;
      pageRef.current?.replaceChildren(canvas);
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
    return () => { active = false; task?.cancel(); };
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
    if (event.pointerType !== 'touch') return;
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
        canvas.style.width = `${pinch.width * pinch.target / pinch.zoom}px`;
        canvas.style.height = `${pinch.height * pinch.target / pinch.zoom}px`;
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
      <div className="pdf-reader-controls">
        <button type="button" disabled={!document || page <= 1} onClick={() => changePage(page - 1)} aria-label="이전 페이지">‹</button>
        <form onSubmit={event => { event.preventDefault(); changePage(pageDraft); }}>
          <label>페이지 <input aria-label="PDF 페이지 번호" type="number" inputMode="numeric" min="1" max={document?.numPages || 1}
            disabled={!document} value={pageDraft} onChange={event => setPageDraft(event.target.value)} onBlur={() => changePage(pageDraft)} /></label>
          <span>/ {document?.numPages || '…'}</span>
        </form>
        <button type="button" disabled={!document || page >= document.numPages} onClick={() => changePage(page + 1)} aria-label="다음 페이지">›</button>
      </div>
      <div className="pdf-reader-controls" role="group" aria-label="PDF 확대 비율">
        <button type="button" aria-label="PDF 축소" disabled={zoom <= .5} onClick={() => changeZoom(zoom - .25)}>−</button>
        <span className="pdf-reader-zoom" aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="PDF 확대" disabled={zoom >= 4} onClick={() => changeZoom(zoom + .25)}>＋</button>
        <button type="button" onClick={() => changeZoom(1)}>너비 맞춤</button>
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer">원본 열기 ↗</a>
    </div>
    <p className="pdf-reader-hint">두 손가락으로 확대 · 확대한 문서는 밀어서 이동 · 페이지 이동 시 필기도 함께 변경</p>
    {error && <p className="ws-alert" role="alert">{error}</p>}
    <div className="pdf-reader-viewport" ref={viewportRef} tabIndex={0} aria-label="PDF 페이지. 방향키로 스크롤할 수 있습니다."
      aria-busy={rendering} onPointerDown={beginGesture} onPointerMove={moveGesture}
      onPointerUp={endGesture} onPointerCancel={endGesture} onLostPointerCapture={endGesture}>
      {rendering && <div className="pdf-reader-loading" role="status">페이지를 불러오는 중…</div>}
      <div className="pdf-reader-page" ref={pageRef} style={{ visibility: renderedPage === page ? 'visible' : 'hidden' }} />
    </div>
  </div>;
}
