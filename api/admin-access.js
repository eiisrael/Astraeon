const UPSTREAM_TIMEOUT_MS=8000;

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
  const supabaseUrl=process.env.SUPABASE_URL||'';
  const supabaseKey=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||'';
  if(!supabaseUrl||!supabaseKey)return res.status(503).json({authenticated:false,allowed:false,error:'online_not_configured'});
  const authHeader=String(req.headers.authorization||'');
  const token=authHeader.startsWith('Bearer ')?authHeader.slice(7).trim():'';
  if(!token)return res.status(401).json({authenticated:false,allowed:false,error:'missing_session'});
  try{
    const headers={apikey:supabaseKey,Authorization:`Bearer ${token}`};
    const userResponse=await fetchTimed(`${supabaseUrl}/auth/v1/user`,{headers});
    if(!userResponse.ok)return res.status(401).json({authenticated:false,allowed:false,error:'invalid_session'});
    const user=await userResponse.json();
    const profileResponse=await fetchTimed(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,username,display_name,access`,{headers:{...headers,Accept:'application/vnd.pgrst.object+json'}});
    if(!profileResponse.ok)return res.status(403).json({authenticated:true,allowed:false,error:'profile_unavailable'});
    const profile=await profileResponse.json();
    const access=Number(profile?.access??1);
    return res.status(200).json({authenticated:true,allowed:access===3,access,profile:{id:profile.id,username:profile.username,displayName:profile.display_name}});
  }catch(error){
    const timedOut=error?.name==='AbortError';
    console.error('[Astraeon Admin Access]',error);
    return res.status(timedOut?504:500).json({authenticated:false,allowed:false,error:timedOut?'verification_timeout':'verification_failed'});
  }
}
