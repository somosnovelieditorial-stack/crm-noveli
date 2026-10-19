// LOCAL CDP adapter: preserves the original regression harness and its remote block.
import { readFile } from 'node:fs/promises';
const here = new URL('.', import.meta.url);
let source = await readFile(new URL('security_browser_smoke.mjs', here), 'utf8');
function replaceOnce(oldText, newText) {
  if (source.split(oldText).length !== 2) throw Error('Review UI browser adapter: original source changed');
  source = source.replace(oldText, () => newText);
}
replaceOnce("from './security_browser_probes.mjs'", 'from ' + JSON.stringify(new URL('security_browser_probes.mjs', here).href));
replaceOnce("await import('./security_browser_scenarios.mjs')", 'await import(' + JSON.stringify(new URL('phase_1a_ui_scenarios.mjs', here).href) + ')');
replaceOnce("const localRequests=new Set();", 'const localRequests=new Map();');
replaceOnce("let phase='bootstrap',seq=0,ws,chrome;", "let phase='bootstrap',seq=0,ws,chrome,mainLoader;");
replaceOnce("await send('Page.navigate',{url:origin+path});", `const navigation=await send('Page.navigate',{url:origin+path});
 if(navigation.errorText)throw Error('Navigation failed: '+navigation.errorText);
 const deadline=Date.now()+20000;
 while(navigation.loaderId&&mainLoader!==navigation.loaderId){if(Date.now()>deadline)throw Error('Main frame did not commit');await sleep(50);}`);
replaceOnce("if(m.method==='Network.requestWillBeSent'){", "if(m.method==='Page.frameNavigated'&&!p.frame.parentId)mainLoader=p.frame.loaderId;\n  if(m.method==='Network.requestWillBeSent'){");
replaceOnce('localRequests.add(p.requestId);', 'localRequests.set(p.requestId,{url:cleanUrl(p.request.url),method:p.request.method});');
replaceOnce("throw Error('Local requests did not settle')", "throw Error('Local requests did not settle: '+JSON.stringify([...localRequests.values()]))");
replaceOnce("console.error(redact(error.stack))", "console.error('LOCAL UI smoke failure: '+redact(error.message))");
replaceOnce("const f=fault;fault=null;send('Fetch.fulfillRequest',", "const f=fault;fault=null;if(f.networkFailure)send('Fetch.failRequest',{requestId:p.requestId,errorReason:'ConnectionFailed'}).catch(()=>{});else if(f.delay) setTimeout(()=>send('Fetch.continueRequest',{requestId:p.requestId}).catch(()=>{}),f.delay);else send('Fetch.fulfillRequest',");
replaceOnce("'.security-browser-evidence.json'", "'docs/noveli-2/phase-1/phase-1a-ui-browser-evidence.json'");
replaceOnce('await runSmoke({act,org,base,anon:config.ANON_KEY,api,events,steps,profile,send,sql});', 'await runSmoke({act,org,base,api,events,steps,send,sql,users});');
const cleanupStart = source.indexOf('async function cleanup(){');
const cleanupEnd = source.indexOf('const profile=await mkdtemp', cleanupStart);
if (cleanupStart < 0 || cleanupEnd < 0) throw Error('Review cleanup boundary');
// Historical accepted orders cannot be deleted, even by postgres. Do not disable
// triggers to tidy a test. Synthetic LOCAL fixtures remain until the next reset.
source = source.slice(0, cleanupStart) + `async function cleanup(){
 await save();
 console.log('LOCAL synthetic orders retained for inspection; local reset removes fixtures.');
}
` + source.slice(cleanupEnd);
await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
