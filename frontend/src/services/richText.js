import DOMPurify from 'dompurify';
import { marked } from 'marked';
export function cleanRichHtml(value) {
  const html=DOMPurify.sanitize(value || '',{ALLOWED_TAGS:['p','br','strong','em','s','u','span','mark','h1','h2','h3','ul','ol','li','blockquote','pre','code','hr','table','thead','tbody','tr','th','td'],ALLOWED_ATTR:['style','data-color','colspan','rowspan','colwidth']});
  const host=document.createElement('div');host.innerHTML=html;
  for(const node of host.querySelectorAll('[colwidth]')) {
    if(!['TD','TH'].includes(node.tagName)||!/^\d{1,4}(,\d{1,4}){0,11}$/.test(node.getAttribute('colwidth')))node.removeAttribute('colwidth');
  }
  for(const node of host.querySelectorAll('[style]')) {
    const color=node.style.color,background=node.style.backgroundColor;node.removeAttribute('style');
    if(/^(#[a-f0-9]{3,8}|rgba?\([\d\s,.%]+\))$/i.test(color))node.style.color=color;
    if(node.tagName==='MARK'&&/^(#[a-f0-9]{3,8}|rgba?\([\d\s,.%]+\))$/i.test(background))node.style.backgroundColor=background;
  }
  return host.innerHTML;
}
export function editorHtml(body,format) {
  if(format==='richtext')return cleanRichHtml(body);
  if(format==='markdown')return cleanRichHtml(marked.parse(body || '',{async:false}));
  return (body || '').split('\n').map(line=>`<p>${line.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}</p>`).join('');
}
