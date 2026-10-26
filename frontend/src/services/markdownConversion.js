import { cleanRichHtml, editorHtml } from './richText';

// Compare visible structure after parsing Markdown, including whitespace inside paragraphs.
// Markdown parsers omit <p> around tight list items and add one newline to fenced code.
function structure(root, markdown = false) {
  const blockTags = new Set(['P', 'H1', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'HR']);
  const inline = nodes => {
    const result = [];
    for (const node of nodes) {
      const values = node.nodeType === Node.TEXT_NODE ? [node.textContent]
        : node.tagName === 'SPAN' ? inline(node.childNodes)
        : [[node.tagName, inline(node.childNodes)]];
      for (const value of values) {
        if (typeof value === 'string' && typeof result.at(-1) === 'string') result[result.length - 1] += value;
        else if (value !== '') result.push(value);
      }
    }
    return result;
  };
  const container = node => {
    const result = [];
    let pending = [];
    const flush = () => { if (pending.length) result.push(['P', inline(pending)]); pending = []; };
    for (const child of node.childNodes) {
      if (blockTags.has(child.tagName)) {
        flush(); result.push(block(child));
      } else if (child.nodeType !== Node.TEXT_NODE || child.textContent.trim() || pending.length) pending.push(child);
    }
    flush(); return result;
  };
  const block = node => {
    if (node.tagName === 'PRE') return ['PRE', markdown ? node.textContent.replace(/\n$/, '') : node.textContent];
    if (['UL', 'OL', 'LI', 'BLOCKQUOTE'].includes(node.tagName)) return [node.tagName, container(node)];
    return [node.tagName, inline(node.childNodes)];
  };
  const blocks = container(root);
  // Tiptap adds an empty paragraph after a terminal code block for cursor placement.
  if (blocks.length > 1 && JSON.stringify(blocks.at(-1)) === '["P",[]]') blocks.pop();
  return JSON.stringify(blocks);
}

// Reject unsupported formatting before changing the source, so it is never lost silently.
export function toMarkdown(body) {
  const host = document.createElement('div');
  host.innerHTML = cleanRichHtml(body);
  if (host.querySelector('table,mark,u,[style]')) {
    throw new Error('Markdown으로 돌아가실 수 없습니다. 표·밑줄·색상·형광펜 서식이 포함되어 있습니다. 해당 서식을 제거한 뒤 다시 시도하세요.');
  }
  const escape = text => text.replace(/\\/g, '\\\\').replace(/([`*_[\]<>~#+.!|=()-])/g, '\\$1');
  const render = node => {
    if (node.nodeType === Node.TEXT_NODE) return escape(node.textContent);
    const children = () => [...node.childNodes].map(render).join('');
    const text = () => node.textContent;
    switch (node.tagName) {
      case 'BR': return '  \n';
      case 'P': return `${children()}\n\n`;
      case 'H1': case 'H2': case 'H3': return `${'#'.repeat(Number(node.tagName[1]))} ${children()}\n\n`;
      case 'STRONG': return `**${children()}**`;
      case 'EM': return `*${children()}*`;
      case 'S': return `~~${children()}~~`;
      case 'CODE': {
        const fence = '`'.repeat(Math.max(1, ...(text().match(/`+/g) || []).map(s => s.length + 1)));
        return `${fence} ${text().replace(/\n/g, ' ')} ${fence}`;
      }
      case 'PRE': {
        const fence = '`'.repeat(Math.max(3, ...(text().match(/`+/g) || []).map(s => s.length + 1)));
        return `${fence}\n${text()}${text().endsWith('\n') ? '\n\n' : '\n'}${fence}\n\n`;
      }
      case 'BLOCKQUOTE': return `${children().trimEnd().split('\n').map(line => `> ${line}`).join('\n')}\n\n`;
      case 'UL': case 'OL': return [...node.children].map((li, index) => {
        const marker = node.tagName === 'OL' ? `${index + 1}. ` : '- ';
        return marker + render(li).trimEnd().replace(/\n/g, '\n' + ' '.repeat(marker.length));
      }).join('\n') + '\n\n';
      case 'HR': return '---\n\n';
      default: return children();
    }
  };
  const markdown = [...host.childNodes].map(render).join('').trimEnd();
  const restored = document.createElement('div');
  restored.innerHTML = editorHtml(markdown, 'markdown');
  // An empty document has equivalent empty representations in both formats.
  if (host.textContent || host.querySelector('br,hr,pre,li') || host.querySelectorAll('p').length > 1) {
    if (structure(host) !== structure(restored, true)) {
      throw new Error('Markdown으로 돌아가실 수 없습니다. 줄바꿈·들여쓰기 또는 일부 서식을 그대로 보존할 수 없습니다. 문서 편집에서 내용을 유지합니다.');
    }
  }
  return markdown;
}
