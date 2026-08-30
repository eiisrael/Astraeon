import { timingSafeEqual } from 'node:crypto';

const REQUEST_LIMIT_BYTES=12*1024;
const UPSTREAM_TIMEOUT_MS=9000;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ITEM_ID=/^[a-z0-9][a-z0-9_:\-]{0,95}$/i;

function plainObject(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const prototype=Object.getPrototypeOf(value);
  return prototype===Object.prototype||prototype===null;
}
function boundedJson(value,maxBytes=8192){
  if(!plainObject(value))return false;
  try{return Buffer.byteLength(JSON.stringify(value),'utf8')<=maxBytes;}
  catch(_){return false;}
}
function isUuid(value){return typeof value==='string'&&UUID.test(value);}
function constantTimeEqual(expected,received){
  const a=Buffer.from(String(expected||''),'utf8');
  const b=Buffer.from(String(received||''),'utf8');
  return a.length===b.length&&a.length>0&&timingSafeEqual(a,b);
}
function fail(code){const error=new Error(code);error.code=code;return error;}

export function normalizeProgressionEvent(body){
  if(!plainObject(body))throw fail('invalid_request');
  const kind=body.kind;
  const characterId=body.characterId;
  const operationId=body.operationId;
  if(!isUuid(characterId)||!isUuid(operationId))throw fail('invalid_identifier');
  if(kind==='award_xp'){
    if(!Number.isSafeInteger(body.amount)||body.amount<1||body.amount>1_000_000)throw fail('invalid_xp_amount');
    return{target_character:characterId,event_kind:kind,event_amount:body.amount,event_item:null,event_quantity:null,event_metadata:{},request_id:operationId};
  }
  if(kind==='grant_drop'){
    if(typeof body.itemId!=='string'||!ITEM_ID.test(body.itemId))throw fail('invalid_item');
    if(!Number.isSafeInteger(body.quantity)||body.quantity<1||body.quantity>9999)throw fail('invalid_quantity');
    const metadata=body.metadata===undefined?{}:body.metadata;
    if(!boundedJson(metadata))throw fail('invalid_metadata');
    return{target_character:characterId,event_kind:kind,event_amount:null,event_item:body.itemId,event_quantity:body.quantity,event_metadata:metadata,request_id:operationId};
  }
  throw fail('invalid_event_kind');
}

async function fetchTimed(url,options={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),UPSTREAM_TIMEOUT_MS);
  try{return await fetch(url,{...options,signal:controller.signal});}
  finally{clearTimeout(timer);}
}
function send(res,status,payload){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  return res.status(status).json(payload);
}

export default async function handler(req,res){
  if(req.method!=='POST'){
    res.setHeader('Allow','POST');
    return send(res,405,{ok:false,error:'method_not_allowed'});
  }
  if(process.env.VERCEL_ENV&&process.env.VERCEL_ENV!=='production'&&process.env.ASTRAEON_AUTHORITY_ALLOW_NONPRODUCTION!=='true'){
    return send(res,404,{ok:false,error:'not_found'});
  }
  const declaredLength=Number(req.headers['content-length']||0);
  if(Number.isFinite(declaredLength)&&declaredLength>REQUEST_LIMIT_BYTES)return send(res,413,{ok:false,error:'payload_too_large'});

  const authorityToken=process.env.ASTRAEON_AUTHORITY_TOKEN||'';
  const serverKey=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
  const supabaseUrl=process.env.SUPABASE_URL||'';
  if(authorityToken.length<32||!serverKey||!supabaseUrl)return send(res,503,{ok:false,error:'authority_unavailable'});
  if(!constantTimeEqual(authorityToken,req.headers['x-astraeon-authority']))return send(res,401,{ok:false,error:'unauthorized'});

  let payload;
  try{payload=normalizeProgressionEvent(req.body);}
  catch(error){return send(res,400,{ok:false,error:error.code||'invalid_request'});}

  try{
    const upstream=await fetchTimed(`${supabaseUrl}/rest/v1/rpc/apply_astraeon_progression_event`,{
      method:'POST',
      headers:{
        apikey:serverKey,
        Authorization:`Bearer ${serverKey}`,
        Accept:'application/json',
        'Content-Type':'application/json'
      },
      body:JSON.stringify(payload)
    });
    if(!upstream.ok){
      console.error('[Astraeon Progression Authority] rpc_failed',upstream.status);
      return send(res,upstream.status>=500?503:422,{ok:false,error:upstream.status>=500?'authority_unavailable':'event_rejected'});
    }
    return send(res,200,{ok:true,result:await upstream.json()});
  }catch(error){
    console.error('[Astraeon Progression Authority]',error?.name==='AbortError'?'upstream_timeout':'upstream_failed');
    return send(res,error?.name==='AbortError'?504:503,{ok:false,error:'authority_unavailable'});
  }
}
