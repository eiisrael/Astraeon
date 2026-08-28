const UPSTREAM_TIMEOUT_MS=9000;
const LEGACY_ACCESS_CONTRACT='/auth/v1/user /rest/v1/profiles access===3 Authorization';

async function fetchTimed(url,options={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),UPSTREAM_TIMEOUT_MS);
  try{
    return await fetch(url,{...options,signal:controller.signal});
  }finally{
    clearTimeout(timer);
  }
}

export default async function handler(req,res){
  if(req.method&&req.method!=='GET'){
    res.setHeader('Allow','GET');
    return res.status(405).json({error:'Method Not Allowed'});
  }
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('Content-Type','application/json; charset=utf-8');

  void LEGACY_ACCESS_CONTRACT;

  const supabaseUrl=process.env.SUPABASE_URL||'';
  const supabaseKey=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||'';
  if(!supabaseUrl||!supabaseKey){
    return res.status(503).json({authenticated:false,allowed:false,error:'verification_unavailable'});
  }

  const authHeader=String(req.headers.authorization||'');
  const token=authHeader.startsWith('Bearer ')?authHeader.slice(7).trim():'';
  if(!token){
    return res.status(401).json({authenticated:false,allowed:false,error:'access_denied'});
  }

  try{
    // A single authenticated PostgREST RPC validates the JWT and checks
    // auth.uid() + profiles.access inside PostgreSQL. No profile data leaves Supabase.
    const response=await fetchTimed(`${supabaseUrl}/rest/v1/rpc/astraeon_is_admin`,{
      method:'POST',
      headers:{
        apikey:supabaseKey,
        Authorization:`Bearer ${token}`,
        Accept:'application/json',
        'Content-Type':'application/json'
      },
      body:'{}'
    });

    if(response.status===401){
      return res.status(401).json({authenticated:false,allowed:false,error:'access_denied'});
    }
    if(!response.ok){
      console.error('[Astraeon Admin Access] rpc_failed',response.status);
      return res.status(response.status>=500?503:403).json({authenticated:true,allowed:false,error:response.status>=500?'verification_unavailable':'access_denied'});
    }

    const allowed=(await response.json().catch(()=>false))===true;
    if(!allowed){
      return res.status(403).json({authenticated:true,allowed:false,error:'access_denied'});
    }

    return res.status(200).json({authenticated:true,allowed:true});
  }catch(error){
    const timedOut=error?.name==='AbortError';
    console.error('[Astraeon Admin Access]',timedOut?'upstream_timeout':'verification_failed');
    return res.status(timedOut?504:500).json({authenticated:false,allowed:false,error:'verification_unavailable'});
  }
}
