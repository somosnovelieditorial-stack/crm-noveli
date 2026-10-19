// Focused smoke of the existing CRM: real login, routes, logout/login and errors.
import assert from 'node:assert/strict';
export async function runSmoke({act,events,steps}){
 const check=(name,ok)=>{assert.ok(ok,name);steps.push({phase:name,assertion:'PASS'});console.log('PASS '+name);};
 check('prelogin-no-private-branding',!events.some(e=>e.type==='response'&&/get_org_branding|company_settings/.test(e.url)));
 await act({type:'login',role:'admin',phase:'login-admin'});
 const start=await act({type:'inspect',phase:'login-ready'});
 check('login-existing-crm',start.path==='/dashboard'&&!start.inputs.some(i=>i.type==='password'));
 const routes=['/dashboard','/clientes','/prospects','/propuestas-comerciales','/services','/documentos','/ingresos','/gastos','/catalogo','/packs','/sitio-web/servicios','/sitio-web/libros','/sitio-web/identidad','/configuration','/reportes'];
 for(const path of routes){
  // Exercise the existing SPA route handler (same popstate path as back/forward),
  // rather than aborting document navigations while React/Auth are mounted.
  await act({type:'eval',phase:'navigate-'+path,expression:'(()=>{history.pushState(null,"",'+JSON.stringify(path)+');window.dispatchEvent(new PopStateEvent("popstate"));return true})()'});
  const view=await act({type:'inspect',phase:'route-'+path});
  check('route-rendered '+path,view.path===path&&view.text.length>150&&!view.inputs.some(i=>i.type==='password')&&!/Acceso denegado|No tienes permiso para acceder/i.test(view.text));
  check('images-loaded '+path,await act({type:'eval',phase:'images-'+path,expression:'[...document.images].every(i=>i.complete&&i.naturalWidth>0)'}));
 }
 await act({type:'click',text:'Salir',exact:true,phase:'logout'});
 const loggedOut=await act({type:'inspect',phase:'logout-ready'});
 check('logout-shows-login',loggedOut.inputs.some(i=>i.type==='password'));
 await act({type:'login',role:'admin',phase:'login-again'});
 const loggedIn=await act({type:'inspect',phase:'login-again-ready'});
 check('second-login-works',loggedIn.path==='/dashboard'&&!loggedIn.inputs.some(i=>i.type==='password'));
 const unexpected=events.filter(e=>e.type==='response'&&e.status>=400);
 const errors=events.filter(e=>e.type==='pageerror'||['console.error','console.warning','console.warn'].includes(e.type));
 check('zero-unexpected-http',unexpected.length===0);
 check('zero-console-errors-warnings-and-js-exceptions',errors.length===0);
 check('no-remote-api',!events.some(e=>e.type==='response'&&/supabase\.co/.test(e.url||'')));
}
