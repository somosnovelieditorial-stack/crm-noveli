// Browser-side HTTP probes use the real local session, without importing a second
// application/GoTrue module. No mock data and no privileged key enter the page.
export function browserProbes(base, anon) {
  const session = () => {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
      try { const value=JSON.parse(localStorage.getItem(key));if(value.access_token)return value; } catch { /* another key */ }
    }
    return null;
  };
  const request = async (path,method='GET',body) => {
    const headers={apikey:anon,Authorization:'Bearer '+(session()?.access_token||anon)};
    let payload;
    if(body instanceof Blob){headers['Content-Type']=body.type||'application/octet-stream';payload=body;}
    else if(body!==undefined){headers['Content-Type']='application/json';payload=JSON.stringify(body);}
    const response=await fetch(base+path,{method,headers,body:payload});
    const data=await response.json();
    return response.ok?{data,error:null}:{data:null,error:{...data,statusCode:data.statusCode||String(response.status)}};
  };
  window.__smokeProbe={
    auth:{getUser:async()=>{const r=await request('/auth/v1/user');return {data:{user:r.data},error:r.error};}},
    from:table=>{
      const query=new URLSearchParams();
      const chain={select:columns=>{query.set('select',columns);return chain;},eq:(column,value)=>{query.set(column,'eq.'+value);return chain;},then:(resolve,reject)=>request('/rest/v1/'+table+'?'+query).then(resolve,reject)};
      return chain;
    },
    storage:{from:bucket=>({
      createSignedUrl:async(path,expiresIn)=>{const r=await request('/storage/v1/object/sign/'+bucket+'/'+path,'POST',{expiresIn});if(r.error)return r;const value=r.data.signedURL||r.data.signedUrl;return {data:{signedUrl:base+'/storage/v1'+value},error:null};},
      upload:(path,body)=>request('/storage/v1/object/'+bucket+'/'+path,'POST',body),
      update:(path,body)=>request('/storage/v1/object/'+bucket+'/'+path,'PUT',body),
      remove:prefixes=>request('/storage/v1/object/'+bucket,'DELETE',{prefixes}),
      list:prefix=>request('/storage/v1/object/list/'+bucket,'POST',{prefix,limit:100}),
    })},
  };
}
