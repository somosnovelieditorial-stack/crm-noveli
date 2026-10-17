import { browserProbes } from './security_browser_probes.mjs';
// LOCAL browser smoke harness. Uses existing Chrome + Node CDP, no dependencies.
// Never connects to production. Credentials remain in memory.
import {spawn, execFileSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createInterface} from 'node:readline';
const config=JSON.parse(execFileSync('powershell',['-NoProfile','-Command','supabase status -o json'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
const base=config.API_URL;
if(new URL(base).hostname!=='127.0.0.1') throw Error('LOCAL ONLY');
const origin='http://127.0.0.1:5179';
const org=randomUUID(),run=randomUUID(),users={},events=[],steps=[];
let phase='bootstrap',seq=0,ws,chrome;
const pending=new Map(), requestMethods=new Map();
const localRequests=new Set();
let lastLocalActivity=0;
async function settleLocalRequests(){
 const start=Date.now();
 while(localRequests.size||Date.now()-lastLocalActivity<500){
  if(Date.now()-start>20000)throw Error('Local requests did not settle');
  await sleep(100);
 }
}
let fault=null, appClientModuleUrl=null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const redact=s=>String(s).replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g,'[JWT]').replace(/([?&]token=)[^&\s"']+/g,'$1[REDACTED]');
const cleanUrl=s=>{try{const u=new URL(s);return u.origin+u.pathname;}catch{return s;}};
async function api(path,method='GET',data){
 const r=await fetch(base+path,{method,headers:{apikey:config.ANON_KEY,Authorization:`Bearer ${config.SERVICE_ROLE_KEY}`,'Content-Type':'application/json',Prefer:'return=representation'},body:data===undefined?undefined:JSON.stringify(data)});
 const text=await r.text();if(!r.ok)throw Error('Fixture '+path+' '+r.status+' '+text.slice(0,250));return text?JSON.parse(text):null;
}
function sql(q){return execFileSync('docker',['exec','-i','supabase_db_CRM_NOVELI','psql','-U','postgres','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe']});}
async function insert(table,data){return api('/rest/v1/'+table,'POST',{organization_id:org,user_id:users.admin.id,...data});}
function send(method,params={}){const id=++seq;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));setTimeout(()=>{if(pending.has(id)){pending.delete(id);reject(Error('CDP timeout '+method));}},20000).unref();});}
async function evaluate(expression){
 if(expression.includes("import('/src/supabaseClient.js')")){
  if(!appClientModuleUrl)throw Error('Application Supabase module URL not observed');
  expression=expression.replaceAll("import('/src/supabaseClient.js')",'import('+JSON.stringify(appClientModuleUrl)+')');
 }
 const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text+': '+r.exceptionDetails.exception?.description);return r.result.value;}
const domExpression=`JSON.stringify({path:location.pathname,text:document.body.innerText.slice(-23000),buttons:[...document.querySelectorAll('button')].filter(e=>e.getClientRects().length).map((e,i)=>({i,text:e.innerText,title:e.title,disabled:e.disabled})),inputs:[...document.querySelectorAll('input,select,textarea')].filter(e=>e.getClientRects().length).map((e,i)=>({i,tag:e.tagName,type:e.type,name:e.name,placeholder:e.placeholder,value:e.type==='password'?'[REDACTED]':e.value,required:e.required,options:e.tagName==='SELECT'?[...e.options].map(o=>({value:o.value,text:o.text})):undefined}))})`;
async function inspect(){return JSON.parse(await evaluate(domExpression));}
async function value(selector,v,index=0){return evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].filter(e=>e.getClientRects().length)[${index}];if(!e)throw Error('Missing input');const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(v)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);}
async function click(a){
 await evaluate("(async()=>{const start=Date.now();while(Date.now()-start<12000){const list=[...document.querySelectorAll("+JSON.stringify(a.selector||'button')+")];if(list.some(e=>e.getClientRects().length&&!e.disabled"+(a.text?"&&(e.innerText||e.title||'').includes("+JSON.stringify(a.text)+")":"")+"))return true;await new Promise(r=>setTimeout(r,100));}throw Error('Control not ready')})()");
 return evaluate(`(()=>{const list=[...document.querySelectorAll(${JSON.stringify(a.selector||'button')})].filter(e=>e.getClientRects().length);const matches=list.filter(e=>${a.text?`(e.innerText||e.title||'').${a.exact?'trim() === '+JSON.stringify(a.text):'includes('+JSON.stringify(a.text)+')'}`:'true'});const e=matches[${a.index||0}];if(!e)throw Error('Missing control '+${JSON.stringify(a.text||a.selector)});if(e.disabled)throw Error('Disabled control');e.click();return true})()`);}
async function navigate(path){
 if(!path.startsWith('/'))throw Error('Local path only');
 appClientModuleUrl=null;
 await send('Page.navigate',{url:origin+path});
 const start=Date.now();
 while(Date.now()-start<20000){
  try{
   if(await evaluate("!!document.querySelector('input[type=email]')||!!document.body?.innerText.includes('EDITORIAL CRM')")){await sleep(500);return;}
  }catch(error){
   if(!/navigated|context|closed/i.test(error.message))throw error;
  }
  await sleep(100);
 }
 throw Error('Application did not render after navigation: '+path);
}
async function login(role){
 const u=users[role];if(!u)throw Error('Fixture role missing');await evaluate('localStorage.clear();sessionStorage.clear()');await navigate('/');
 await value('input[type=email]',u.email);await value('input[type=password]',u.password);await click({selector:'button[type=submit]'});await sleep(2300);
 return inspect();
}
async function save(){await writeFile('.security-browser-evidence.json',JSON.stringify({run,org,steps,events},null,2));}
async function cleanup(){
 await save();
 // Only the randomly generated tenant from this process is removed.
 for(const bucket of ['documents','brand-assets']){
  // Enumerate this fixture namespace recursively through metadata SQL, never object bodies.
  const names=JSON.parse(sql(`SELECT coalesce(json_agg(name),'[]') FROM storage.objects WHERE bucket_id='${bucket}' AND name LIKE '${org}/%';`));
  if(names.length)await api('/storage/v1/object/'+bucket,'DELETE',{prefixes:names});
 }
 // Tenant FK closure is cleaned by the caller-visible local SQL, with row scope.
 const tables=JSON.parse(sql("SELECT json_agg(tablename) FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('organizations','organization_members','user_profiles') AND EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=tablename AND c.column_name='organization_id');"));
 let remaining=[...tables];for(let pass=0;pass<8&&remaining.length;pass++)remaining=remaining.filter(t=>{try{sql(`DELETE FROM public."${t}" WHERE organization_id='${org}';`);return false;}catch{return true;}});
 if(remaining.length)throw Error('Fixture cleanup incomplete: '+remaining.join(','));
 for(const u of Object.values(users))await api('/auth/v1/admin/users/'+u.id,'DELETE');
 sql(`DELETE FROM public.organization_members WHERE organization_id='${org}';DELETE FROM public.organizations WHERE id='${org}';`);
 console.log('CLEANUP local tenant/users/objects complete');
}
const profile=await mkdtemp(join(tmpdir(),'noveli-smoke-chrome-'));
try{
 await api('/rest/v1/organizations','POST',{id:org,name:'LOCAL Browser Smoke '+run});
 for(const [i,role] of ['admin','finanzas','editor','diseñador','corrector','visualizador','unknown'].entries()){
  const email=`browser-${run}-${i}@example.invalid`,password='Local-only!'+randomUUID();
  const u=await api('/auth/v1/admin/users','POST',{email,password,email_confirm:true,user_metadata:{full_name:'Local '+role}});users[role]={id:u.id,email,password};
  await api('/rest/v1/user_profiles','POST',{id:u.id,full_name:'Local '+role});
  if(role!=='unknown')await api('/rest/v1/organization_members','POST',{organization_id:org,user_id:u.id,role,active:true,full_name:'Local '+role,email});
 }
 await insert('settings',{editorial_name:'LOCAL Smoke Editorial'});
 await insert('company_settings',{company_name:'LOCAL Smoke Company',commercial_name:'LOCAL Smoke',representative_name:'Local admin',official_email:'smoke@example.invalid',signature_name:'Local admin',website_url:'',instagram_url:'',address:'Local fixture only'});
 await insert('website_settings',{site_name:'LOCAL Smoke Site',public_url:origin,contact_email:'smoke@example.invalid'});
 await insert('service_catalog',{name:'LOCAL Smoke Correccion',category:'editorial',base_price:10000});
 chrome=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let port;for(let i=0;i<60;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await sleep(200);}}
 if(!port)throw Error('Chrome DevTools unavailable');
 const targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();const target=targets.find(t=>t.type==='page');
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(m.error.message)):p?.resolve(m.result);return;}const p=m.params||{};
  if(m.method==='Fetch.requestPaused'){
   const url=p.request.url;let allowed=false;try{allowed=['127.0.0.1','localhost'].includes(new URL(url).hostname)||url.startsWith('data:');}catch{}
   if(allowed && fault && p.request.method===fault.method && new URL(url).pathname===fault.path){
    const f=fault;fault=null;send('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:f.status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:origin}],body:Buffer.from(JSON.stringify(f.body)).toString('base64')}).catch(()=>{});
   }else if(allowed)send('Fetch.continueRequest',{requestId:p.requestId}).catch(()=>{});else{events.push({phase,type:'external_blocked',url:cleanUrl(url)});send('Fetch.failRequest',{requestId:p.requestId,errorReason:'BlockedByClient'}).catch(()=>{});}
  }
  if(m.method==='Network.requestWillBeSent'){
   if(p.request.url.startsWith(base)){localRequests.add(p.requestId);lastLocalActivity=Date.now();}
   requestMethods.set(p.requestId,p.request.method);
   if(p.request.method==='POST' && p.request.url.includes('/storage/v1/object/sign/')){
    try{events.push({phase,type:'storage_sign_request',expiresIn:JSON.parse(p.request.postData||'{}').expiresIn});}catch{}
   }
   if(p.request.method==='GET' && p.request.url.startsWith(origin+'/src/supabaseClient.js') && !appClientModuleUrl)
    appClientModuleUrl=p.request.url;
  }
  if(['Network.loadingFinished','Network.loadingFailed'].includes(m.method)&&localRequests.delete(p.requestId))lastLocalActivity=Date.now();
  if(m.method==='Network.responseReceived')events.push({phase,type:'response',method:requestMethods.get(p.requestId),url:cleanUrl(p.response.url),status:p.response.status,mime:p.response.mimeType});
  if(m.method==='Runtime.consoleAPICalled'&&['error','warning','warn'].includes(p.type))events.push({phase,type:'console.'+p.type,message:redact(p.args.map(x=>x.value??x.description??'').join(' '))});
  if(m.method==='Runtime.exceptionThrown')events.push({phase,type:'pageerror',message:redact(p.exceptionDetails.exception?.description||p.exceptionDetails.text)});
  if(m.method==='Log.entryAdded'&&['error','warning'].includes(p.entry.level))events.push({phase,type:'log.'+p.entry.level,message:redact(p.entry.text)});
  if(m.method==='Page.javascriptDialogOpening'){events.push({phase,type:'dialog',message:p.message});send('Page.handleJavaScriptDialog',{accept:true}).catch(()=>{});}
 };
 for(const method of ['Page.enable','Runtime.enable','Network.enable','Log.enable'])await send(method);
 await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});await send('Network.setCacheDisabled',{cacheDisabled:true});
 await navigate('/');console.log('READY LOCAL Chrome; '+JSON.stringify(await inspect()));
 async function act(a){
  phase=a.phase||a.type;
  let result;
  if(a.type==='eval' && a.expression.includes("import('/src/supabaseClient.js')")){
   await evaluate('('+browserProbes.toString()+')('+JSON.stringify(base)+','+JSON.stringify(config.ANON_KEY)+')');
   a={...a,expression:a.expression.replaceAll("const {supabase:s}=await import('/src/supabaseClient.js');","const s=window.__smokeProbe;").replaceAll("const {createDocumentUrl}=await import('/src/utils/storageDocuments.js');","const createDocumentUrl=async(storage,doc)=>(await storage.from('documents').createSignedUrl(doc.file_path,300)).data.signedUrl;")};
  }
  if(a.type==='login')result=await login(a.role);
  else if(a.type==='nav'){await navigate(a.path);result=await inspect();}
  else if(a.type==='inspect')result=await inspect();
  else if(a.type==='fill'){await value(a.selector,a.value,a.index);await sleep(30);result=true;}
  else if(a.type==='click'){await click(a);await sleep(1300);result=await inspect();}
  else if(a.type==='eval')result=await evaluate(a.expression);
  else if(a.type==='files'){const root=await send('DOM.getDocument');const node=await send('DOM.querySelector',{nodeId:root.root.nodeId,selector:a.selector});await send('DOM.setFileInputFiles',{nodeId:node.nodeId,files:a.files});await sleep(1500);result=await inspect();}
  else if(a.type==='seed')result=await insert(a.table,a.data);
  else if(a.type==='fault'){fault=a.fault;result=true;}
  else if(a.type==='summary')result={steps,events:events.filter(e=>e.status>=400||e.type!=='response'),requests:events.filter(e=>e.type==='response').length};
  else throw Error('Unknown action');
  await settleLocalRequests();
  steps.push({phase,action:a.type,result:a.type==='eval'?redact(JSON.stringify(result)):a.type==='nav'||a.type==='login'?{path:result.path}:true});
  await save();console.log('STEP '+phase);return result;
 }
 if(process.argv.includes('--run')){
  const {runSmoke}=await import('./security_browser_scenarios.mjs');
  await runSmoke({act,org,base,anon:config.ANON_KEY,api,events,steps,profile,send,sql});
  steps.push({phase:'complete',result:'ALL_BROWSER_ASSERTIONS_PASSED'});
 }else{
  const rl=createInterface({input:process.stdin,crlfDelay:Infinity});
  for await(const line of rl){
   if(!line.trim())continue;
   try{
    const a=JSON.parse(line);
    if(a.type==='finish'){steps.push({phase:'finish',result:a.result});rl.close();break;}
    const result=await act(a);console.log(JSON.stringify({phase,result}));
   }catch(error){events.push({phase,type:'harness_error',message:redact(error.message)});await save();console.log(JSON.stringify({error:redact(error.message)}));}
  }
 }

}catch(error){steps.push({phase:'failure',message:redact(error.message)});console.error(redact(error.stack));process.exitCode=1;}
finally{
 if(ws?.readyState===1){try{await send('Browser.close');}catch{ /* browser closed before replying */ }ws.close();}
 if(chrome)chrome.kill();await sleep(500);
 try{await cleanup();}catch(e){console.error('CLEANUP ERROR '+redact(e.message));process.exitCode=1;}
 process.stdin.pause();
 // Delete only the uniquely named profile created by mkdtemp in this run.
 if(!resolve(profile).startsWith(resolve(tmpdir())+'\\noveli-smoke-chrome-'))throw Error('Unsafe browser profile cleanup path');
 try{await rm(profile,{recursive:true,force:true,maxRetries:8,retryDelay:300});}catch{console.error('Temporary browser profile removal pending: '+profile);}
}
