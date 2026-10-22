import { useEffect, useRef } from 'react';
import { useEditor, EditorContent, useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { TextSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import { TableKit } from '@tiptap/extension-table';
import { cleanRichHtml,editorHtml } from '../../services/richText';
import '../../styles/learning-editor.css';
import '../../styles/rich-content.css';
import TablePicker from './TablePicker';

const textColors = [['#d33b45','빨강'],['#315cbb','파랑'],['#238268','초록'],['#8a4db5','보라']];
const highlights = [['#fff2a8','노랑'],['#ffd6df','분홍'],['#cfe4ff','하늘']];
const paletteColor = (color, palette) => palette.find(([hex]) => color === hex || color === `rgb(${[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(', ')})`)?.[0] || color || '';

export default function RichEditor({body='',format='richtext',onChange,onSave,label='노트 본문',disabled=false,showHelp=true}) {
  const callbacks=useRef({onChange,onSave});callbacks.current={onChange,onSave};
  const plainPaste=useRef(false);
  const editor=useEditor({immediatelyRender:false,extensions:[StarterKit.configure({link:false}),TextStyle,Color,Highlight.configure({multicolor:true}),TableKit.configure({table:{resizable:true}})],content:editorHtml(body,format),parseOptions:{preserveWhitespace:'full'},editable:!disabled,
    editorProps:{attributes:{role:'textbox','aria-label':label,'aria-multiline':'true'},transformPastedHTML:html=>plainPaste.current?'':cleanRichHtml(html),handlePaste:(view,event)=>{if(!plainPaste.current)return false;event.preventDefault();view.dispatch(view.state.tr.insertText(event.clipboardData.getData('text/plain')));return true;},handleKeyDown:(_,event)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();callbacks.current.onSave?.();return true;}return false;}},
    onUpdate:({editor:e})=>callbacks.current.onChange?.(cleanRichHtml(e.getHTML()),'richtext'),
  });
  const state=useEditorState({editor,selector:({editor:e})=>e&&!e.isDestroyed?{bold:e.isActive('bold'),italic:e.isActive('italic'),underline:e.isActive('underline'),list:e.isActive('bulletList'),ordered:e.isActive('orderedList'),heading:e.getAttributes('heading').level || 0,code:e.isActive('codeBlock'),quote:e.isActive('blockquote'),table:e.isActive('table'),color:e.getAttributes('textStyle').color || '',highlight:e.getAttributes('highlight').color || ''}:null});
  useEffect(()=>{if(!editor||editor.isDestroyed)return;const html=editorHtml(body,format);if(html!==cleanRichHtml(editor.getHTML()))editor.commands.setContent(html,{emitUpdate:false,parseOptions:{preserveWhitespace:'full'}});},[editor,body,format]);
  useEffect(()=>{if(editor&&!editor.isDestroyed&&editor.isEditable!==!disabled)editor.setEditable(!disabled);},[editor,disabled]);
  const action=(command)=>editor?.chain().focus()[command]().run();
  const color = paletteColor(state?.color, textColors), highlight = paletteColor(state?.highlight, highlights);
  const formatControls = () => <>
    <button type="button" disabled={disabled} aria-label="굵게" title="굵게 (Ctrl+B)" aria-pressed={state?.bold || false} onMouseDown={e=>e.preventDefault()} onClick={()=>action('toggleBold')}><b>B</b></button>
    <button type="button" disabled={disabled} aria-label="기울임" aria-pressed={state?.italic || false} onMouseDown={e=>e.preventDefault()} onClick={()=>action('toggleItalic')}><i>I</i></button>
    <button type="button" disabled={disabled} aria-label="밑줄" aria-pressed={state?.underline || false} onMouseDown={e=>e.preventDefault()} onClick={()=>action('toggleUnderline')}><u>U</u></button>
    <label className="rich-color-control"><span>글자색</span><select aria-label="글자 색" disabled={disabled} value={color} onChange={e=>e.target.value?editor?.chain().focus().setColor(e.target.value).run():editor?.chain().focus().unsetColor().run()}><option value="">기본색</option>{color && !textColors.some(([value])=>value===color) && <option value={color}>사용자 색</option>}{textColors.map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label>
    <label className="rich-color-control"><span>강조</span><select aria-label="형광펜" disabled={disabled} value={highlight} onChange={e=>e.target.value?editor?.chain().focus().setHighlight({color:e.target.value}).run():editor?.chain().focus().unsetHighlight().run()}><option value="">해제</option>{highlight && !highlights.some(([value])=>value===highlight) && <option value={highlight}>사용자 색</option>}{highlights.map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label>
    <button type="button" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>action('unsetAllMarks')}>서식 지우기</button>
  </>;
  return <div className="rich-editor">
    <div className="rich-toolbar" role="toolbar" aria-label="글쓰기 서식">
      <div className="rich-tool-group" role="group" aria-label="문서 구조">
      <button type="button" disabled={disabled} onClick={()=>action('undo')} title="실행 취소" aria-label="실행 취소">↶</button>
      <button type="button" disabled={disabled} onClick={()=>action('redo')} title="다시 실행" aria-label="다시 실행">↷</button>
      <select aria-label="제목 서식" disabled={disabled} value={state?.heading || 0} onChange={e=>Number(e.target.value)?editor?.chain().focus().setHeading({level:Number(e.target.value)}).run():editor?.chain().focus().setParagraph().run()}><option value="0">본문</option><option value="1">큰 제목</option><option value="2">중간 제목</option><option value="3">작은 제목</option></select>
      </div>
      <div className="rich-tool-group" role="group" aria-label="텍스트 서식">{formatControls()}</div>
      <div className="rich-tool-group" role="group" aria-label="목록과 삽입">
      <button type="button" disabled={disabled} aria-label="목록" aria-pressed={state?.list || false} onClick={()=>action('toggleBulletList')}>• 목록</button>
      <button type="button" disabled={disabled} aria-label="번호 목록" aria-pressed={state?.ordered || false} onClick={()=>action('toggleOrderedList')}>1. 목록</button>
      <button type="button" disabled={disabled} aria-label="인용" aria-pressed={state?.quote || false} onClick={()=>action('toggleBlockquote')}>인용</button>
      <button type="button" disabled={disabled} aria-label="코드블록" aria-pressed={state?.code || false} onClick={()=>action('toggleCodeBlock')}>{'{ }'}</button>
      <TablePicker disabled={disabled} onInsert={size=>editor?.chain().focus().insertTable(size).run()}/>
      {state?.table && <details className="rich-table-actions" onToggle={e=>{if(e.currentTarget.open)e.currentTarget.style.setProperty('--table-menu-left',`${Math.min(0,window.innerWidth-16-e.currentTarget.getBoundingClientRect().left-220)}px`);}} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))e.currentTarget.open=false;}}><summary>행·열 편집</summary><div role="group" aria-label="표 편집">
        {[['addRowBefore','위에 행 추가'],['addRowAfter','아래에 행 추가'],['deleteRow','행 삭제'],['addColumnBefore','왼쪽에 열 추가'],['addColumnAfter','오른쪽에 열 추가'],['deleteColumn','열 삭제'],['deleteTable','표 삭제']].map(([command,title])=><button key={command} type="button" disabled={disabled} onClick={e=>{action(command);const menu=e.currentTarget.closest('details');if(menu)menu.open=false;}}>{title}</button>)}
      </div></details>}
      </div>
    </div>
    <label className="rich-paste-option"><input type="checkbox" disabled={disabled} onChange={e=>{plainPaste.current=e.target.checked;}}/> 서식 없이 붙여넣기</label>
    <EditorContent editor={editor} />
    {editor && <BubbleMenu editor={editor} className="rich-selection-toolbar" role="toolbar" aria-label="선택한 글자 서식" updateDelay={80}
      shouldShow={({editor:e,state:s,from,to,element})=>e.isEditable && !disabled && (e.isFocused || element.contains(document.activeElement)) && s.selection instanceof TextSelection && from!==to && Boolean(s.doc.textBetween(from,to).trim()) && !e.isActive('codeBlock')}
      options={{placement:'top',offset:8,flip:true,shift:{padding:8}}}>{formatControls()}</BubbleMenu>}
    {showHelp&&<small className="ws-muted">글자를 드래그하면 서식 도구가 나타납니다. · Ctrl+B 굵게 · Ctrl+Z 취소 · Ctrl+S 저장</small>}
  </div>;
}
