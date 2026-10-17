export function parseWordPaste(text) {
  const lines=text.replaceAll('\r','').split('\n').map(s=>s.trim()).filter(Boolean);
  if(lines.length>200)throw new Error('한 번에 200줄까지 붙여넣을 수 있습니다.');
  return lines.filter(s=>!/^\|?\s*:?-{3,}/.test(s)).map(line=>{
    let cells=line.includes('\t')?line.split('\t'):line.includes('|')?line.replace(/^\||\|$/g,'').split('|'):null;
    if(!cells){const japanese=line.match(/^([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々・]+)\s+([\p{Script=Hiragana}\p{Script=Katakana}ー・]+)\s+(.+)$/u);const two=line.match(/^(\S+)\s+([\p{Script=Hangul}].*)$/u);cells=japanese?japanese.slice(1):two?[two[1],'',two[2]]:line.split(/\s+[-–—]\s+|\s*[:：]\s*/);}
    cells=cells.map(s=>s.trim());
    if(cells.length===1)return {title:cells[0],reading:'',body:''};
    if(cells.length===2)return {title:cells[0],reading:'',body:cells[1]};
    return {title:cells[0],reading:cells[1],body:cells.slice(2).join(' ')};
  }).filter(row=>!['단어','word','単語'].includes(row.title.toLowerCase()));
}
export const wordIdentity=(title,language)=>`${language}:${title.normalize('NFKC').trim().toLowerCase()}`;
