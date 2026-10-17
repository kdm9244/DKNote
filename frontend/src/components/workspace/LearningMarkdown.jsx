import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { codeFingerprint } from "./learningHelpers";
import { cleanRichHtml } from "../../services/richText";
function CodeLines({ className, children, onSelect }) {
  const code = String(children).replace(/\n$/, "");
  const [anchor, setAnchor] = useState(null);
  const [range, setRange] = useState(null);
  const [copied, setCopied] = useState(false);
  const pick = (i, event) => {
    const from = event.shiftKey && anchor !== null ? Math.min(anchor, i) : i;
    const to = event.shiftKey && anchor !== null ? Math.max(anchor, i) : i;
    if (!event.shiftKey) setAnchor(i);
    setRange([from, to]);
    onSelect?.({
      codeFingerprint: codeFingerprint(code),
      lineStart: from + 1,
      lineEnd: to + 1,
      quote: code
        .split("\n")
        .slice(from, to + 1)
        .join("\n"),
    });
  };
  return (
    <div className="learning-code">
      <header>
        <span>{className?.replace("language-", "") || "code"}</span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "복사됨" : "복사"}
        </button>
      </header>
      <div className="learning-code-lines">
        {code.split("\n").map((line, i) => (
          <div
            className={
              range && i >= range[0] && i <= range[1] ? "selected" : ""
            }
            key={i}
          >
            {onSelect ? (
              <button
                type="button"
                title="줄 선택 · Shift로 범위 선택"
                onClick={(e) => pick(i, e)}
              >
                {i + 1}
              </button>
            ) : (
              <span>{i + 1}</span>
            )}
            <code>{line || " "}</code>
          </div>
        ))}
      </div>
    </div>
  );
}
export default function LearningMarkdown({
  body,
  format = "markdown",
  onSelect,
}) {
  if(format === "richtext") {
    const host=document.createElement('div');host.innerHTML=cleanRichHtml(body);
    return <div className="rich-view">{Array.from(host.childNodes).map((node,i)=>node.nodeType===1&&node.tagName==='PRE'?<CodeLines key={i} onSelect={onSelect}>{node.textContent}</CodeLines>:node.nodeType===1?<div key={i} dangerouslySetInnerHTML={{__html:node.outerHTML}} />:<span key={i}>{node.textContent}</span>)}</div>;
  }
  if (format === "plain") return <div className="learning-plain">{body}</div>;
  return (
    <div className="learning-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <div>{children}</div>,
          code: ({ className, children }) =>
            className || String(children).includes("\n") ? (
              <CodeLines className={className} onSelect={onSelect}>
                {children}
              </CodeLines>
            ) : (
              <code>{children}</code>
            ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {body || ""}
      </ReactMarkdown>
    </div>
  );
}
