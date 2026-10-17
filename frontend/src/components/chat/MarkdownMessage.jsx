import React, { useState } from 'react';

/**
 * 코드 블록 컴포넌트 (복사 버튼 포함)
 */
function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('코드 복사 실패:', err);
    }
  };

  return (
    <div style={codeBlockContainerStyle}>
      <div style={codeBlockHeaderStyle}>
        <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: '#94a3b8' }}>
          {language || 'code'}
        </span>
        <button type="button" onClick={handleCopy} style={copyBtnStyle}>
          {copied ? '✓ 복사됨' : '복사'}
        </button>
      </div>
      <pre style={codePreStyle}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * 인라인 스타일 파서 (`code`, **bold**, *action*)
 */
function renderInlineStyles(text) {
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    if (!part) return null;

    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code key={idx} style={inlineCodeStyle}>
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={idx} style={{ fontWeight: 800, color: '#0f172a' }}>
          {part.slice(2, -2)}
        </strong>
      );
    }

    // 롤플레이 지문 (*...*) -> localAI 스타일: 깔끔하고 자연스러운 은은한 이탤릭 (박스/배경 없음)
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <span key={idx} style={roleplaySpanStyle}>
          {part}
        </span>
      );
    }

    return part;
  });
}

function parseMarkdownBlocks(rawText) {
  const parts = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(rawText)) !== null) {
    const textBefore = rawText.slice(lastIndex, match.index);
    if (textBefore) {
      parts.push({ type: 'text', content: textBefore });
    }

    parts.push({
      type: 'code',
      language: match[1].trim() || 'text',
      content: match[2].replace(/\n$/, ''),
    });

    lastIndex = match.index + match[0].length;
  }

  const remaining = rawText.slice(lastIndex);
  if (remaining) {
    parts.push({ type: 'text', content: remaining });
  }

  return parts;
}

/**
 * ** 소제목/강조 부분이 붙어있을 때 가독성을 위해 한 줄 띄우기(\n\n) 사전 전처리
 */
function preprocessMarkdownSpacing(text) {
  if (!text) return '';
  // 문장 끝 뒤에 공백이 있고 새로운 **소제목:** 이 시작될 때만 안전하게 줄바꿈
  return text.replace(/([.!?~])\s{1,2}(?=\*\*[^\n*]+:\*\*)/g, '$1\n\n');
}

/**
 * 🌸 미카 챗봇 전용 마크다운 렌더러
 */
export default function MarkdownMessage({ content }) {
  if (!content) return null;
  const processed = preprocessMarkdownSpacing(content);
  const parts = parseMarkdownBlocks(processed);

  return (
    <div style={{ lineHeight: 1.68, fontSize: '14px', wordBreak: 'break-word', color: 'inherit' }}>
      {parts.map((part, index) => {
        if (part.type === 'code') {
          return <CodeBlock key={index} language={part.language} code={part.content} />;
        }

        const lines = part.content.split('\n');
        return (
          <div key={index}>
            {lines.map((line, lineIdx) => {
              const trimmed = line.trim();

              // 1. 단독 행동 롤플레이 줄 (*행동*)
              if (trimmed.startsWith('*') && trimmed.endsWith('*') && trimmed.length >= 2) {
                return (
                  <div key={lineIdx} style={roleplayBlockStyle}>
                    *{trimmed.slice(1, -1)}*
                  </div>
                );
              }

              // ** 강조 소제목으로 시작하는 라인인지 확인 (가독성을 위한 한줄 띄우기 마진 적용)
              const isBoldSection = trimmed.startsWith('**') && trimmed.length >= 4;

              // 2. 헤딩
              if (trimmed.startsWith('### ')) {
                return (
                  <h4 key={lineIdx} style={{ margin: '14px 0 6px', fontSize: '14.5px', fontWeight: 800, color: '#0284c7' }}>
                    {renderInlineStyles(trimmed.slice(4))}
                  </h4>
                );
              }
              if (trimmed.startsWith('## ')) {
                return (
                  <h3 key={lineIdx} style={{ margin: '16px 0 6px', fontSize: '15.5px', fontWeight: 800, color: '#7e22ce' }}>
                    {renderInlineStyles(trimmed.slice(3))}
                  </h3>
                );
              }
              if (trimmed.startsWith('# ')) {
                return (
                  <h2 key={lineIdx} style={{ margin: '18px 0 8px', fontSize: '17px', fontWeight: 800, color: '#db2777' }}>
                    {renderInlineStyles(trimmed.slice(2))}
                  </h2>
                );
              }

              // 3. 인용구
              if (trimmed.startsWith('> ')) {
                return (
                  <blockquote key={lineIdx} style={blockquoteStyle}>
                    {renderInlineStyles(trimmed.slice(2))}
                  </blockquote>
                );
              }

              // 4. 목록
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                  <div key={lineIdx} style={{ display: 'flex', gap: '8px', margin: '4px 0', paddingLeft: '4px' }}>
                    <span style={{ color: '#db2777', fontWeight: 'bold' }}>•</span>
                    <div>{renderInlineStyles(trimmed.slice(2))}</div>
                  </div>
                );
              }

              const numberListMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
              if (numberListMatch) {
                return (
                  <div key={lineIdx} style={{ display: 'flex', gap: '8px', margin: '4px 0', paddingLeft: '4px' }}>
                    <span style={{ color: '#4f46e5', fontWeight: 700, minWidth: '16px' }}>
                      {numberListMatch[1]}.
                    </span>
                    <div>{renderInlineStyles(numberListMatch[2])}</div>
                  </div>
                );
              }

              if (!trimmed) {
                return <div key={lineIdx} style={{ height: '6px' }} />;
              }

              return (
                <p
                  key={lineIdx}
                  style={{
                    margin: isBoldSection ? '12px 0 4px' : '4px 0',
                    lineHeight: 1.68,
                  }}
                >
                  {renderInlineStyles(line)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

const codeBlockContainerStyle = {
  margin: '10px 0',
  borderRadius: '10px',
  overflow: 'hidden',
  border: '1px solid #334155',
  background: '#0f172a',
};

const codeBlockHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 12px',
  background: 'rgba(255, 255, 255, 0.05)',
  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
};

const copyBtnStyle = {
  background: 'transparent',
  border: 'none',
  color: '#94a3b8',
  cursor: 'pointer',
  fontSize: '11px',
  fontWeight: 700,
};

const codePreStyle = {
  margin: 0,
  padding: '12px',
  overflowX: 'auto',
  color: '#f8fafc',
  fontSize: '12.5px',
  fontFamily: 'Consolas, Monaco, monospace',
};

const inlineCodeStyle = {
  background: 'rgba(99, 102, 241, 0.1)',
  color: '#4338ca',
  padding: '2px 6px',
  borderRadius: '5px',
  fontSize: '12.5px',
  fontFamily: 'Consolas, Monaco, monospace',
  border: '1px solid rgba(99, 102, 241, 0.2)',
  fontWeight: 600,
};

// localAI 프로젝트와 100% 동일한 Zeta 스타일 (박스/배경 없음)
const roleplaySpanStyle = {
  fontStyle: 'italic',
  fontSize: '13px',
  color: '#64748b',
  opacity: 0.88,
  margin: '0 2px',
};

const roleplayBlockStyle = {
  margin: '4px 0',
  fontSize: '13px',
  fontStyle: 'italic',
  color: '#64748b',
  lineHeight: 1.5,
  opacity: 0.88,
};

const blockquoteStyle = {
  margin: '6px 0',
  paddingLeft: '12px',
  borderLeft: '3px solid #cbd5e1',
  color: '#475569',
  fontStyle: 'italic',
};
