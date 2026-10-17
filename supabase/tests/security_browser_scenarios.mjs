// Repeatable assertions for the same real Chrome/React/local-Supabase flows.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

export async function runSmoke({act,org,base,anon,api,events,steps,profile,sql}) {
  const check=(name,ok)=>{assert.ok(ok,name);steps.push({phase:name,assertion:'PASS'});console.log('PASS '+name);};
  const ev=(phase,expression)=>act({type:'eval',phase,expression});
  const nav=(path,phase)=>act({type:'nav',path,phase});
  const click=(text,phase)=>act({type:'click',text,exact:true,phase});
  const selector=(selector,phase)=>act({type:'click',selector,phase});
  const fill=(selector,value,phase,index=0)=>act({type:'fill',selector,value,index,phase});
  const wait=(phase,expression)=>ev(phase,`(async()=>{const start=Date.now();while(Date.now()-start<12000){const value=(${expression});if(value)return value;await new Promise(r=>setTimeout(r,100));}throw Error('UI condition timeout: '+${JSON.stringify(phase)})})()`);
  const rows=(table,extra='')=>api(`/rest/v1/${table}?select=*&organization_id=eq.${org}${extra}`);
  const sdk="const {supabase:s}=await import('/src/supabaseClient.js');";
  const forbidden="[...document.querySelectorAll('button')].filter(e=>e.getClientRects().length&&!e.disabled&&(/Añadir|Registrar|Guardar|Subir|Configurar|Nueva Propuesta/.test(e.innerText)||e.title==='Eliminar'||e.querySelector('svg.lucide-pen,svg[class*=lucide-trash]'))).map(e=>e.innerText||e.title||'icon')";
  const pdf=join(profile,'local-smoke.pdf'),png=join(profile,'local-smoke.png');
  await writeFile(pdf,'%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
  await writeFile(png,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1cAAAAASUVORK5CYII=','base64'));
  const file=(phase)=>act({type:'files',selector:'input[type=file]',files:[pdf],phase});

  check('prelogin-no-private-branding-or-company-settings',!events.some(e=>e.type==='response'&&/get_org_branding|company_settings/.test(e.url)));
  check('prelogin-local-fallback',await ev('prelogin-fallback',"document.title==='Somos Noveli'&&document.querySelector('link[rel=icon]').getAttribute('href')==='/favicon.svg'"));
  await act({type:'login',role:'admin',phase:'auth-admin'});
  check('admin-redirect-and-custom-branding',await wait('auth-branding',"location.pathname==='/dashboard'&&document.title==='LOCAL Smoke Editorial'"));
  check('admin-profile',await ev('auth-profile',`(async()=>{${sdk}const u=(await s.auth.getUser()).data.user;return (await s.from('user_profiles').select('*').eq('id',u.id)).data[0].full_name==='Local admin'})()`));
  await click('Salir','auth-logout');
  check('logout-clears-branding',await wait('logout-fallback',"!!document.querySelector('input[type=password]')&&document.title==='Somos Noveli'"));
  const logoutIndex=events.length;
  await ev('logout-idle',"new Promise(r=>setTimeout(()=>r(true),800))");
  check('logout-no-private-rpc',!events.slice(logoutIndex).some(e=>e.type==='response'&&/get_org_branding|company_settings/.test(e.url)));
  await act({type:'login',role:'admin',phase:'auth-relogin'});
  await wait('dashboard-widgets',"document.body.innerText.includes('Resumen Financiero')&&!document.body.innerText.includes('Cargando métricas')");

  await nav('/clientes','clients-list');await click('Añadir Cliente','clients-form');
  await fill('input[placeholder="e.g. Isabel Allende"]','LOCAL Browser Client','clients-name');
  await click('Guardar','clients-save');
  check('client-create-completes',await wait('clients-completed',"!document.querySelector('input[placeholder=\"e.g. Isabel Allende\"]')&&document.body.innerText.includes('LOCAL Browser Client')"));
  const clients=await rows('clients');check('client-exactly-one-row',clients.length===1);
  check('client-exactly-one-insert',events.filter(e=>e.method==='POST'&&e.url===base+'/rest/v1/clients').length===1);
  check('client-postsave-activity', (await rows('activity_log')).some(r=>r.entity_id===clients[0].id));
  await selector('button[title="Editar"]','clients-edit-open');
  await fill('input[placeholder="e.g. Isabel Allende"]','LOCAL Browser Client Edited','clients-edit-name');
  await click('Guardar','clients-edit-save');
  await wait('clients-edit-done',"!document.querySelector('input[placeholder=\"e.g. Isabel Allende\"]')&&document.body.innerText.includes('LOCAL Browser Client Edited')");
  await selector('button[title="Ver detalles"]','clients-detail');await click('DOCUMENTOS (0)','client-documents');
  await file('client-document-file');await fill('input[placeholder="Título del documento"]','LOCAL Client Attachment','client-document-name');
  await click('Subir Documento','client-document-save');
  await wait('client-document-visible',"document.body.innerText.includes('DOCUMENTOS (1)')");
  await selector('button[title="Ver"]','client-document-ui-open');
  check('ui-signed-url-ttl-300',events.some(e=>e.phase==='client-document-ui-open'&&e.type==='storage_sign_request'&&e.expiresIn===300));

  await nav('/prospects','prospects-list');await click('Añadir Prospecto','prospect-form');
  await fill('input[required]','LOCAL Browser Prospect','prospect-name');await click('Guardar','prospect-save');
  await wait('prospect-saved',"!document.querySelector('input[required]')&&document.body.innerText.includes('LOCAL Browser Prospect')");
  check('prospect-one-row',(await rows('prospects')).length===1);
  await selector('button[title="Editar"]','prospect-edit-open');await fill('input[required]','LOCAL Browser Prospect Edited','prospect-edit-name');
  await click('Guardar','prospect-edit-save');await wait('prospect-edit-done',"document.body.innerText.includes('LOCAL Browser Prospect Edited')&&!document.querySelector('input[required]')");

  await nav('/propuestas-comerciales','quotation-list');await click('Nueva Propuesta','quotation-form');
  await fill('input[placeholder="Nombre completo"]','LOCAL Quote Author','quotation-name');
  await click('Añadir Ítem Manual','quotation-add-item');await fill('input[value="Concepto Personalizado"]','LOCAL Browser Item','quotation-item');
  await fill('input[type=number]','1000','quotation-price',1);await click('Guardar Propuesta','quotation-save');
  await wait('quotation-save-completed',"!document.querySelector('input[placeholder=\"Nombre completo\"]')&&document.body.innerText.includes('LOCAL Quote Author')");
  check('quotation-and-item-created',(await rows('quotations')).length===1&&(await rows('quotation_items')).length===1);
  await selector('button[title="Editar"]','quotation-edit-open');
  check('quotation-preview-renders',await ev('quotation-preview',"document.body.innerText.includes('LOCAL Browser Item')&&document.body.innerText.includes('VISTA PREVIA')"));
  await fill('input[type=number]','2','quotation-quantity',2);await click('Guardar Propuesta','quotation-edit-save');
  await wait('quotation-total-updated',"document.body.innerText.includes('$2.000')&&!document.querySelector('input[placeholder=\"Nombre completo\"]')");

  await nav('/services','services-list');await click('Añadir Contrato','services-form');
  await fill('input[placeholder="e.g. Cien Años de Soledad"]','LOCAL Browser Book','service-name');await click('Guardar','service-save');
  await wait('service-created',"document.body.innerText.includes('LOCAL Browser Book')&&!document.querySelector('input[placeholder=\"e.g. Cien Años de Soledad\"]')");
  await ev('service-edit-open',"document.querySelector('svg.lucide-pen').closest('button').click();true");
  await wait('service-edit-ready',"!!document.querySelector('input[placeholder=\"e.g. Cien Años de Soledad\"]')");
  await fill('input[placeholder="e.g. Cien Años de Soledad"]','LOCAL Browser Book Edited','service-edit-name');await click('Guardar','service-edit-save');
  await wait('service-edit-done',"document.body.innerText.includes('LOCAL Browser Book Edited')&&!document.querySelector('input[placeholder=\"e.g. Cien Años de Soledad\"]')");

  await nav('/sitio-web/identidad','cms-identity');await fill('input[placeholder="Ej. NOVELI"]','LOCAL Browser Brand','cms-name');
  await act({type:'files',selector:'input[type=file]',files:[png],phase:'cms-upload-brand'});await click('Guardar Identidad Visual','cms-identity-save');
  const settings=(await rows('website_settings'))[0];check('cms-brand-reference',settings.logo_url.includes('/public/brand-assets/'));
  check('cms-brand-preview',await wait('cms-image-loaded',"[...document.images].some(e=>e.src.includes('/public/brand-assets/')&&e.complete&&e.naturalWidth>0)"));

  await nav('/sitio-web/libros','cms-books');await click('Categorías','cms-categories');
  await fill('form input[type=text]:not([readonly])','LOCAL Browser Genre','cms-category-name');await click('Guardar','cms-category-save');
  check('cms-category-created',(await rows('website_book_categories')).length===1);
  await click('Libros','cms-books-tab');await fill('form input[required]','LOCAL Published Book','cms-book-title');
  await fill('form input[required]','LOCAL Author','cms-book-author',1);
  await ev('cms-book-category-select',"[...document.querySelectorAll('label')].find(e=>e.innerText.includes('LOCAL Browser Genre')).querySelector('input').click();true");
  await click('Guardar Libro','cms-book-save');
  const books=await rows('website_books');check('cms-book-created',books.length===1);
  const links=await api('/rest/v1/website_book_category_links?select=*&book_id=eq.'+books[0].id);
  check('cms-book-category-real-schema',links.length===1&&!('organization_id' in links[0]));
  const publicRead=()=>ev('cms-publication-read',`(async()=>{const r=await fetch(${JSON.stringify(base+'/rest/v1/website_books?select=id,title&id=eq.'+books[0].id)},{headers:{apikey:${JSON.stringify(anon)}}});return {status:r.status,rows:await r.json()}})()`);
  check('cms-publication-public',(await publicRead()).rows.length===1);
  await ev('cms-book-edit-open',"document.querySelector('svg.lucide-square-pen,svg.lucide-pen').closest('button').click();true");
  await wait('cms-book-edit-ready',"document.body.innerText.includes('Editar Libro')");
  await fill('form input[required]','LOCAL Published Book Edited','cms-book-edit');
  await ev('cms-book-hide',"[...document.querySelectorAll('label')].find(e=>e.innerText==='Visible en Web').querySelector('input').click();true");
  await click('Guardar Libro','cms-book-hide-save');check('cms-hidden-book-not-public',(await publicRead()).rows.length===0);
  await ev('cms-book-reedit',"document.querySelector('svg.lucide-square-pen,svg.lucide-pen').closest('button').click();true");
  await wait('cms-book-reedit-ready',"document.body.innerText.includes('Editar Libro')");
  await ev('cms-book-republish',"[...document.querySelectorAll('label')].find(e=>e.innerText==='Visible en Web').querySelector('input').click();true");
  await click('Guardar Libro','cms-book-republish-save');check('cms-republished-book-public',(await publicRead()).rows.length===1);

  await nav('/documentos','documents-list');await click('Subir Documento','documents-form');await file('documents-file');
  await fill('input[required]','LOCAL Center Attachment','documents-title');await click('Subir','documents-save');
  await wait('documents-upload-complete',"!document.querySelector('input[required]')");
  await ev('documents-open-general',"[...document.querySelectorAll('h3')].find(e=>e.innerText==='General / Otros').parentElement.parentElement.click();true");
  await wait('documents-general-ready',"document.body.innerText.includes('LOCAL Center Attachment')");
  // Deliberate transport denial tests UI error handling, not an RLS workaround.
  await act({type:'fault',phase:'expected-ui-storage-denial',fault:{method:'DELETE',path:'/storage/v1/object/documents',status:403,body:{statusCode:'403',error:'Forbidden',message:'LOCAL deliberate Storage denial'}}});
  await selector('button[title="Eliminar"]','expected-ui-storage-denial');
  check('failed-delete-keeps-visible-row',await ev('expected-ui-storage-row-retained',"document.body.innerText.includes('LOCAL Center Attachment')"));
  check('failed-delete-keeps-db-row',(await rows('documents')).length===2);
  check('signed-and-private',await ev('expected-private-public-url',`(async()=>{${sdk}const d=(await s.from('documents').select('*')).data[0];const {createDocumentUrl}=await import('/src/utils/storageDocuments.js');const signed=await createDocumentUrl(s.storage,d);const token=JSON.parse(atob(new URL(signed).searchParams.get('token').split('.')[1].replaceAll('-','+').replaceAll('_','/')));const good=await fetch(signed);const bad=await fetch(${JSON.stringify(base+'/storage/v1/object/public/documents/')}+d.file_path);return good.status===200&&bad.status!==200&&token.exp-token.iat===300})()`));
  check('signed-expiry',await ev('expected-signed-expiry',`(async()=>{${sdk}const d=(await s.from('documents').select('*')).data[0];const {data}=await s.storage.from('documents').createSignedUrl(d.file_path,1);const first=await fetch(data.signedUrl);await new Promise(r=>setTimeout(r,2600));return first.status===200&&(await fetch(data.signedUrl)).status!==200})()`));
  check('public-brand-image',await ev('brand-public-access',`(async()=>{const r=await fetch(${JSON.stringify(settings.logo_url)});return r.status===200})()`));

  for(const [path,verb,amount,edited] of [['/ingresos','Ingreso','1500','1600'],['/gastos','Gasto','500','600']]){
    await nav(path,verb+'-list');await click('Registrar '+verb,verb+'-form');await fill('input[type=number][required]',amount,verb+'-amount');await click('Guardar',verb+'-save');
    await wait(verb+'-saved',"!document.querySelector('input[type=number][required]')");
    await ev(verb+'-edit-open',"[...document.querySelectorAll('svg.lucide-pen')].at(-1).closest('button').click();true");
    await wait(verb+'-edit-ready',"!!document.querySelector('input[type=number][required]')");await fill('input[type=number][required]',edited,verb+'-edit-amount');await click('Guardar',verb+'-edit-save');
    await wait(verb+'-edit-done',"!document.querySelector('input[type=number][required]')");
    check(verb+'-persisted',(await rows(verb==='Ingreso'?'incomes':'expenses')).some(r=>Number(r.amount)===Number(edited)));
  }

  for(const role of ['finanzas','editor','diseñador','corrector','visualizador','unknown']){
    await act({type:'login',role,phase:'role-'+role+'-login'});
    for(const [module,path] of [['clients','/clientes'],['documents','/documentos'],['cms','/sitio-web/identidad'],['finance','/ingresos'],['admin','/configuration']]){
      await nav(path,`role-${role}-${module}`);
      if(role==='visualizador'&&module==='clients'){
        await selector('button[title="Ver detalles"]','viewer-client-detail');
        await click('DOCUMENTOS (1)','viewer-client-documents');
        check('viewer-client-document-upload-disabled',await ev('viewer-client-document-permissions',"[...document.querySelectorAll('input[type=file]')].every(e=>e.disabled)"));
      }
      if(role==='visualizador'&&module==='documents'){
        await ev('viewer-document-folder',"[...document.querySelectorAll('h3')].find(e=>e.innerText==='General / Otros').parentElement.parentElement.click();true");
        await wait('viewer-document-row',"document.body.innerText.includes('LOCAL Center Attachment')");
      }
      const state=await ev(`role-${role}-${module}-controls`,`({buttons:${forbidden},denied:document.body.innerText.includes('No tienes permiso para acceder')})`);
      if(['visualizador','unknown'].includes(role))check(`readonly-${role}-${module}`,state.buttons.length===0);
      if(module==='finance')check(`finance-route-${role}`,state.denied===(role!=='finanzas'));
      if(module==='admin')check(`no-global-admin-${role}`,state.denied);
    }
    if(['visualizador','unknown'].includes(role)){
      for(const path of ['/prospects','/propuestas-comerciales','/services']){
        await nav(path,`readonly-${role}-${path}`);
        if(role==='visualizador'&&path==='/services')await wait('viewer-service-row',"document.body.innerText.includes('LOCAL Browser Book Edited')");
        check(`no-write-controls-${role}-${path}`,(await ev(`controls-${role}-${path}`,forbidden)).length===0);
      }
      check(`backend-rejects-${role}`,await ev(`expected-storage-${role}-write`,`(async()=>{${sdk}const r=await s.storage.from('documents').upload(${JSON.stringify(org+'/general/negative-'+role+'.txt')},new Blob(['LOCAL negative']));return !!r.error})()`));
    }
  }

  await act({type:'login',role:'admin',phase:'admin-final-login'});
  const other=randomUUID(),otherPath=other+'/general/local-other.txt';
  await api('/rest/v1/organizations','POST',{id:other,name:'LOCAL Browser Other Tenant'});
  try{
    await api('/storage/v1/object/documents/'+otherPath,'POST',{local_fixture:true});
    const before=sql(`SELECT metadata::text FROM storage.objects WHERE name='${otherPath}' AND bucket_id='documents';`);
    check('cross-tenant-isolation',await ev('expected-cross-tenant',`(async()=>{${sdk}const list=await s.storage.from('documents').list(${JSON.stringify(other+'/general')});const sign=await s.storage.from('documents').createSignedUrl(${JSON.stringify(otherPath)},300);const update=await s.storage.from('documents').update(${JSON.stringify(otherPath)},new Blob(['LOCAL forbidden']));const remove=await s.storage.from('documents').remove([${JSON.stringify(otherPath)}]);return list.data.length===0&&!!sign.error&&!!update.error&&remove.data.length===0})()`));
    check('cross-tenant-object-unchanged',before===sql(`SELECT metadata::text FROM storage.objects WHERE name='${otherPath}' AND bucket_id='documents';`));
  }finally{await api('/storage/v1/object/documents','DELETE',{prefixes:[otherPath]});await api('/rest/v1/organizations?id=eq.'+other,'DELETE');}

  // Same admin DELETE flows as the original diagnostic, with read-back assertions.
  for(const [path,table] of [['/ingresos','incomes'],['/gastos','expenses'],['/services','services'],['/propuestas-comerciales','quotations']]){
    await nav(path,'delete-'+table);
    for(let i=0;i<3;i++){
      const count=await ev('delete-'+table+'-controls',"document.querySelectorAll('svg[class*=lucide-trash]').length");if(!count)break;
      await ev('delete-'+table+'-click',"document.querySelector('svg[class*=lucide-trash]').closest('button').click();true");
      await ev('delete-'+table+'-settle',"new Promise(r=>setTimeout(()=>r(true),1300))");
    }
    check('deleted-'+table,(await rows(table)).length===0);
  }
  await nav('/documentos','delete-document-nav');await ev('delete-document-general',"[...document.querySelectorAll('h3')].find(e=>e.innerText==='General / Otros').parentElement.parentElement.click();true");
  await wait('delete-document-general-ready',"!!document.querySelector('button[title=Eliminar]')");await selector('button[title="Eliminar"]','delete-document-general');
  check('admin-document-delete-real',(await rows('documents')).length===1);
  await nav('/clientes','delete-client-doc-nav');await selector('button[title="Ver detalles"]','delete-client-doc-open');await click('DOCUMENTOS (1)','delete-client-doc-tab');
  await ev('delete-client-doc',"[...document.querySelectorAll('button[title=Eliminar]')].at(-1).click();true");await ev('delete-client-doc-settle',"new Promise(r=>setTimeout(()=>r(true),1300))");
  check('all-documents-deleted',(await rows('documents')).length===0);
  for(const [path,table] of [['/clientes','clients'],['/prospects','prospects']]){
    await nav(path,'delete-'+table);await selector('button[title="Eliminar"]','delete-'+table+'-click');check('deleted-'+table,(await rows(table)).length===0);
  }
  await nav('/sitio-web/identidad','cms-restore');await fill('input[placeholder="Ej. NOVELI"]','NOVELI','cms-restore-name');await fill('input[placeholder="https://..."]','','cms-restore-logo');await click('Guardar Identidad Visual','cms-restore-save');
  await nav('/dashboard','idle-nav');await wait('idle-ready',"!document.body.innerText.includes('Cargando métricas')&&document.body.innerText.includes('Resumen Financiero')");
  const idleIndex=events.length;await ev('idle-observation',"new Promise(r=>setTimeout(()=>r(true),7000))");
  check('no-sustained-request-loop',!events.slice(idleIndex).some(e=>e.type==='response'));
  const expectedDenial=e=>e.phase.startsWith('expected-')&&e.url?.includes('/storage/v1/')&&[400,401,403,404].includes(e.status);
  const unexpected=events.filter(e=>e.type==='response'&&e.status>=400&&!expectedDenial(e));
  const errors=events.filter(e=>e.type==='pageerror'||(['console.error','console.warning','console.warn'].includes(e.type)&&!(e.phase.startsWith('expected-ui-storage')&&e.message.includes('LOCAL deliberate Storage denial'))));
  check('zero-unexpected-http',unexpected.length===0);check('zero-unexpected-console-or-react-errors',errors.length===0);
}
