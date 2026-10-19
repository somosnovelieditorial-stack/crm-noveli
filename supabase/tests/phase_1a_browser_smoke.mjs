// Bounded adapter of the immutable existing CRM smoke. No application changes.
import {readFile} from 'node:fs/promises';
const here=new URL('.',import.meta.url);
let source=await readFile(new URL('security_browser_smoke.mjs',here),'utf8');
function replaceOnce(oldText,newText){
 if(source.split(oldText).length!==2)throw Error('Review browser adapter: source changed');
 source=source.replace(oldText,()=>newText);
}
replaceOnce("from './security_browser_probes.mjs'","from "+JSON.stringify(new URL('security_browser_probes.mjs',here).href));
replaceOnce("await import('./security_browser_scenarios.mjs')","await import("+JSON.stringify(new URL('phase_1a_browser_scenarios.mjs',here).href)+")");
replaceOnce("const localRequests=new Set();","const localRequests=new Map();");
replaceOnce("let phase='bootstrap',seq=0,ws,chrome;","let phase='bootstrap',seq=0,ws,chrome,mainLoader;");
replaceOnce("await send('Page.navigate',{url:origin+path});",`const navigation=await send('Page.navigate',{url:origin+path});
 if(navigation.errorText)throw Error('Navigation failed: '+navigation.errorText);
 const loaderDeadline=Date.now()+20000;
 while(navigation.loaderId&&mainLoader!==navigation.loaderId){if(Date.now()>loaderDeadline)throw Error('Main frame did not commit');await sleep(50);}`);
replaceOnce("if(m.method==='Network.requestWillBeSent'){","if(m.method==='Page.frameNavigated'&&!p.frame.parentId)mainLoader=p.frame.loaderId;\n  if(m.method==='Network.requestWillBeSent'){");
replaceOnce("localRequests.add(p.requestId);","localRequests.set(p.requestId,{url:cleanUrl(p.request.url),method:p.request.method,type:p.type});");
replaceOnce("throw Error('Local requests did not settle')","throw Error('Local requests did not settle: '+JSON.stringify([...localRequests.entries()]))");
replaceOnce("console.error(redact(error.stack))","console.error('LOCAL smoke failure: '+redact(error.message))");
replaceOnce("'.security-browser-evidence.json'","'docs/noveli-2/phase-1/phase-1a-browser-evidence.json'");
await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
