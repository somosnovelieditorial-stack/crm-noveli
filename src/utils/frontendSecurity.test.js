import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_BRANDING, loadMemberBranding } from './branding.js';
import { mutationPermissions, insertClientRecord, deleteDocumentConfirmed } from './frontendMutations.js';
import { hasDirectTenant, hasActorColumn, fetchBookCategoryLinks, replaceBookCategoryLinks, optionalExchangeRate } from './querySchema.js';
import { readFileSync } from 'node:fs';

test('CMS automatic actor fields agree with the actual baseline, including category insertion', () => {
  const baseline=readFileSync(new URL('../../supabase/migrations/20261014031607_noveli_baseline.sql',import.meta.url),'utf8');
  const tables=[...baseline.matchAll(/CREATE TABLE IF NOT EXISTS "public"\."(website_[^"]+)" \(([\s\S]*?)\n\);/g)];
  assert.equal(tables.length,13);
  for(const [,table,definition] of tables)assert.equal(hasActorColumn(table),definition.includes('"user_id"'),table);
  assert.equal(hasDirectTenant('website_book_categories'),true);
  assert.equal(hasActorColumn('website_book_categories'),false);
});

test('book and service-agenda mutation contracts use real baseline columns and event types', () => {
  const baseline=readFileSync(new URL('../../supabase/migrations/20261014031607_noveli_baseline.sql',import.meta.url),'utf8');
  const columns=table=>new Set([...baseline.match(new RegExp('CREATE TABLE IF NOT EXISTS "public"\\."'+table+'" \\(([\\s\\S]*?)\\n\\);'))[1].matchAll(/^\s+"([^"]+)"/gm)].map(m=>m[1]));
  const website=readFileSync(new URL('../components/Website.jsx',import.meta.url),'utf8');
  const bookPayload=website.split('const handleSaveBook =')[1].split('const payload = {')[1].split('\n      };')[0];
  for(const [,field] of bookPayload.matchAll(/^\s+(\w+):/gm))assert.ok(columns('website_books').has(field),field);
  for(const file of ['../components/Services.jsx','../utils.js']){
    const code=readFileSync(new URL(file,import.meta.url),'utf8');
    const payload=code.split('const eventPayload = {')[1].split(/\n\s+};/)[0];
    for(const [,field] of payload.matchAll(/^\s+(\w+):/gm))assert.ok(columns('agenda_events').has(field),file+':'+field);
    assert.match(payload,/type: 'evento'/);assert.match(payload,/action_key: 'etapa_servicio'/);
  }
});

test('private branding is never requested before auth or for stale/absent membership', async () => {
  let calls = 0;
  const rpc = async org => { calls++; assert.equal(org, 'org-A'); return { data: [{ editorial_name: 'Custom' }] }; };
  for (const [user, membership] of [[null,null],['A',null],['B',{userId:'A',organizationId:'org-A'}]])
    assert.equal(await loadMemberBranding(user,membership,rpc), DEFAULT_BRANDING);
  assert.equal(calls,0);
  assert.equal((await loadMemberBranding('A',{userId:'A',organizationId:'org-A'},rpc)).editorial_name,'Custom');
  assert.equal(calls,1);
  assert.equal(await loadMemberBranding(null,{userId:'A',organizationId:'org-A'},rpc),DEFAULT_BRANDING);
});

test('client insertion returns a usable id for continuation, exactly once, without retries', async () => {
  for (const data of [{id:'client-1'},[{id:'client-1'}]]) {
    let inserts=0;
    const client={from:table=>{assert.equal(table,'clients');return {insert:payload=>{
      inserts++;assert.equal(payload.name,'Fixture');return {select:()=>({single:async()=>({data})})};
    }}}};
    const created=await insertClientRecord(client,{name:'Fixture'});
    const activity={client_id:created.id};
    assert.equal(activity.client_id,'client-1');assert.equal(inserts,1);
  }
  await assert.rejects(()=>insertClientRecord({from:()=>({insert:()=>({select:()=>({single:async()=>({error:Error('denied')})})})})},{}),/denied/);
});

test('viewer/unknown cannot mutate services or documents; central canonical permissions apply', () => {
  for(const role of ['visualizador','solo lectura','future-role',null,'constructor'])
    for(const module of ['services','documents'])
      assert.deepEqual(mutationPermissions(role,module,module),{write:false,delete:false});
  assert.deepEqual(mutationPermissions('admin','services','services'),{write:true,delete:true});
  assert.deepEqual(mutationPermissions('editor','services','services'),{write:true,delete:false});
  assert.deepEqual(mutationPermissions('editor','documents','documents'),{write:true,delete:true});
  assert.deepEqual(mutationPermissions('admin','documents','documents',true),{write:false,delete:false});
});

test('document delete errors and zero-row responses never commit UI removal', async () => {
  const doc={id:'doc-1',file_path:'org-A/general/file.pdf'};
  for(const [storage,db] of [
    [{error:Error('Storage denied')},null], [{data:[]},null],
    [{data:[{name:doc.file_path}]},{error:Error('DB denied')}],
    [{data:[{name:doc.file_path}]},{data:[]}],
    [{data:[{name:doc.file_path}]},{data:[{id:doc.id}]}],
  ]) {
    let visible=[doc],dbCalls=0;
    const client={storage:{from:()=>({remove:async()=>storage})},from:()=>({delete:()=>{
      dbCalls++;return {eq:()=>({select:async()=>db})};
    }})};
    try {await deleteDocumentConfirmed(client,doc);visible=visible.filter(d=>d.id!==doc.id);} catch { /* UI retains row */ }
    assert.equal(visible.length,db?.data?.length===1?0:1);
    assert.equal(dbCalls,storage.error||!storage.data.length?0:1);
  }
});

test('category links use only existing parent FK columns, without tenant/user injection', async () => {
  assert.equal(hasDirectTenant('website_book_category_links'),false);
  assert.equal(hasDirectTenant('website_books'),true);
  let inserted;
  const client={from:table=>{
    assert.equal(table,'website_book_category_links');
    return {select:async columns=>{assert.equal(columns,'id,book_id,category_id');return {data:[]};},
      delete:()=>({eq:async(column,id)=>{assert.equal(column,'book_id');assert.equal(id,'book-A');return {};}}),
      insert:async rows=>{inserted=rows;assert.equal(hasDirectTenant(table),false);return {};}};
  }};
  assert.deepEqual(await fetchBookCategoryLinks(client),[]);
  await replaceBookCategoryLinks(client,'book-A',['cat-A','cat-A']);
  assert.deepEqual(inserted,[{book_id:'book-A',category_id:'cat-A'}]);
});

test('missing optional daily FX rate is valid, scoped, and uses maybeSingle; CLP needs no lookup', async () => {
  let calls=0;const filters=[];
  const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q;},limit:n=>{assert.equal(n,1);return q;},maybeSingle:async()=>({data:null})};
  const client={from:()=>{calls++;return q;}};
  assert.equal(await optionalExchangeRate(client,'org-A','CLP',1,'2026-10-16'),1);assert.equal(calls,0);
  assert.equal(await optionalExchangeRate(client,'org-A','USD',940,'2026-10-16'),940);
  assert.deepEqual(filters,[['organization_id','org-A'],['currency_from','USD'],['date','2026-10-16']]);
});
