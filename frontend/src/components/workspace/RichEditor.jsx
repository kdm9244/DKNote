import { useEffect, useRef } from 'react';
import { useEditor, EditorContent, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import { TableKit } from '@tiptap/extension-table';
import { cleanRichHtml,editorHtml } from '../../services/richText';
import '../../styles/learning-editor.css';

export default function RichEditor({body='',format='richtext',onChange,onSave,label='노트 본문',disabled=false}) {
  const callbacks=useRef({onChange,onSave});callbacks.current={onChange,onSave};
  const plainPaste=useRef(false);
  const editor=useEditor({extensions:[StarterKit.configure({link:false}),TextStyle,Color,Highlight.configure({multicolor:true}),TableKit.configure({table:{resizable:true}})],content:editorHtml(body,format),editable:!disabled,
    editorProps:{attributes:{role:'textbox','aria-label':label,'aria-multiline':'true'},transformPastedHTML:html=>plainPaste.current?'':cleanRichHtml(html),handlePaste:(view,event)=>{if(!plainPaste.current)return false;event.preventDefault();view.dispatch(view.state.tr.insertText(event.clipboardData.getData('text/plain')));return true;},handleKeyDown:(_,event)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();callbacks.current.onSave?.();return true;}return false;}},
    onUpdate:({editor:e})=>callbacks.current.onChange?.(cleanRichHtml(e.getHTML()),'richtext'),
  });
  const state=useEditorState({editor,selector:({editor:e})=>e?{bold:e.isActive('bold'),list:e.isActive('bulletList'),heading:e.isActive('heading'),code:e.isActive('codeBlock')}:null});
  useEffect(()=>{if(!editor)return;const html=editorHtml(body,format);if(html!==cleanRichHtml(editor.getHTML()))editor.commands.setContent(html,{emitUpdate:false});},[editor,body,format]);
  useEffect(()=>{editor?.setEditable(!disabled);},[editor,disabled]);
  const action=(command)=>editor?.chain().focus()[command]().run();
  return <div className="rich-editor">
    <div className="rich-toolbar" role="toolbar" aria-label="글쓰기 서식">
      <button type="button" disabled={disabled} onClick={()=>action('undo')} title="실행 취소">↶</button>
      <button type="button" disabled={disabled} onClick={()=>action('redo')} title="다시 실행">↷</button>
      <button type="button" disabled={disabled} aria-label="굵게" aria-pressed={state?.bold || false} onClick={()=>action('toggleBold')}><b>B</b></button>
      <button type="button" disabled={disabled} aria-label="제목 서식" aria-pressed={state?.heading || false} onClick={()=>editor?.chain().focus().toggleHeading({level:2}).run()}>제목</button>
      <button type="button" disabled={disabled} aria-label="목록" aria-pressed={state?.list || false} onClick={()=>action('toggleBulletList')}>목록</button>
      <button type="button" disabled={disabled} aria-label="코드블록" aria-pressed={state?.code || false} onClick={()=>action('toggleCodeBlock')}>{'{ }'}</button>
      <button type="button" disabled={disabled} onClick={()=>editor?.chain().focus().insertTable({rows:3,cols:3,withHeaderRow:true}).run()}>표</button>
      <button type="button" disabled={disabled} onClick={()=>action('deleteTable')}>표 삭제</button>
      <select aria-label="글자 색" disabled={disabled} defaultValue="" onChange={e=>e.target.value?editor?.chain().focus().setColor(e.target.value).run():editor?.chain().focus().unsetColor().run()}><option value="">글자 색</option><option value="#d33b45">빨강</option><option value="#315cbb">파랑</option><option value="#238268">초록</option><option value="#8a4db5">보라</option></select>
      <select aria-label="형광펜" disabled={disabled} defaultValue="" onChange={e=>e.target.value?editor?.chain().focus().setHighlight({color:e.target.value}).run():editor?.chain().focus().unsetHighlight().run()}><option value="">형광펜 해제</option><option value="#fff2a8">노랑</option><option value="#ffd6df">분홍</option><option value="#cfe4ff">하늘</option></select>
      <button type="button" disabled={disabled} onClick={()=>action('unsetAllMarks')}>서식 지우기</button>
      <label><input type="checkbox" onChange={e=>{plainPaste.current=e.target.checked;}}/> 서식 없이 붙여넣기</label>
    </div>
    <EditorContent editor={editor} />
    <small className="ws-muted">Ctrl+B 굵게 · Ctrl+Z 취소 · Ctrl+S 저장 · 표에서 Tab으로 다음 칸 이동</small>
  </div>;
}
