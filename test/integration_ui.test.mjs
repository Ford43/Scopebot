import { build } from 'esbuild';
import { writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const result=await build({entryPoints:['src/app/components/admin/Integration.tsx'],bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',write:false,
 plugins:[{name:'boundaries',setup(b){
 b.onResolve({filter:/^react$|lib\/bots$|contexts\/AdminScopeContext$/},a=>({path:a.path,namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='react'?`
 let current,slots=new Map();
 globalThis.__integration={begin(key){current=slots.get(key);if(!current){current={values:[],i:0};slots.set(key,current);}current.i=0;},reset(){slots=new Map([["parent",{values:[[{bot_id:"A",name:"A"},{bot_id:"B",name:"B"}],"A",false],i:0}]]);}};
 export function useState(v){const s=current,i=s.i++;if(!(i in s.values))s.values[i]=v;return [s.values[i],v=>s.values[i]=typeof v==='function'?v(s.values[i]):v];}
 export const useEffect=()=>{},useMemo=f=>f(),useCallback=f=>f;
 `:a.path.endsWith('bots')?`export const fetchBots=async()=>[],toggleBotLine=async()=>true,updateBot=(...a)=>globalThis.__saveBot(...a);`:`export const useAdminScope=()=>({scopeParam:'all'});`}));
 }}]});
const file=new URL(`./.integration-${randomUUID()}.mjs`,import.meta.url);await writeFile(file,result.outputFiles[0].text);
const {default:Integration}=await import(file.href);await unlink(file);
const nodes=t=>Array.isArray(t)?t.flatMap(nodes):t&&typeof t==='object'?[t,...nodes(t.props?.children)]:[];
function parent(){globalThis.__integration.begin('parent');return Integration();}
function selected(){return nodes(parent()).find(n=>n.type==='select');}
function panel(){const n=nodes(parent()).find(n=>n.type?.name==='LineConfigPanel');globalThis.__integration.begin(`panel:${n.key??'unkeyed'}`);return n.type(n.props);}
const inputs=()=>nodes(panel()).filter(n=>n.type==='input');
const fill=(a,b)=>{inputs()[0].props.onChange({target:{value:a}});inputs()[1].props.onChange({target:{value:b}});};
const save=()=>nodes(panel()).find(n=>n.type==='button').props.onClick();
const switchBot=id=>selected().props.onChange({target:{value:id}});

test('switching bots cannot submit the previous bot credentials',async()=>{
 globalThis.__integration.reset();const requests=[];
 globalThis.__saveBot=async(id,payload)=>{requests.push({id,payload});return {bot_id:id};};
 fill('A token','A secret');switchBot('B');await save();
 assert.deepEqual(requests,[],"B must not receive A credentials");
 assert.deepEqual(inputs().map(n=>n.props.value),['','']);
 fill('B token','B secret');await save();
 assert.deepEqual(requests,[{id:'B',payload:{line_channel_token:'B token',line_channel_secret:'B secret'}}]);
});
test('late save for A preserves B selection and credentials',async()=>{
 globalThis.__integration.reset();let resolve;
 globalThis.__saveBot=()=>new Promise(r=>{resolve=r;});
 fill('A token','A secret');const pending=save();switchBot('B');fill('B token','B secret');
 resolve({bot_id:'A',name:'Updated A'});await pending;
 assert.equal(selected().props.value,'B');
 assert.deepEqual(inputs().map(n=>n.props.value),['B token','B secret']);
});
