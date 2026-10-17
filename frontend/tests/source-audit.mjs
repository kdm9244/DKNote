import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const frontend=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.join(frontend,'src');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const files=walk(root),code=files.filter(f=>/\.(jsx?|css)$/.test(f));
const resolve=(from,ref)=>{
  if(!ref.startsWith('.'))return null;
  const base=path.resolve(path.dirname(from),ref);
  return [base,...['.js','.jsx','.css','/index.js','/index.jsx'].map(ext=>base+ext)].find(f=>fs.existsSync(f)&&fs.statSync(f).isFile());
};
const edges=new Map();
for(const f of code){
  const text=fs.readFileSync(f,'utf8'),refs=[...text.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|@import\s*)['"]([^'"]+)['"]/g)].map(m=>m[1]);
  if(f.endsWith('.css'))refs.push(...[...text.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)].map(m=>m[1]));
  edges.set(f,refs.map(ref=>resolve(f,ref)).filter(Boolean));
}
const reachable=new Set();
const visit=f=>{if(reachable.has(f))return;reachable.add(f);for(const next of edges.get(f)||[])visit(next);};
visit(path.join(root,'main.jsx'));
const unused=code.filter(f=>!reachable.has(f));
console.log(JSON.stringify({reachableModules:code.length-unused.length,unreachable:unused.map(f=>({path:path.relative(frontend,f).replaceAll('\\','/'),lines:fs.readFileSync(f,'utf8').split('\n').length})),totalUnreachableLines:unused.reduce((n,f)=>n+fs.readFileSync(f,'utf8').split('\n').length,0)},null,2));
if(process.argv.includes('--check')&&unused.length)process.exitCode=1;
