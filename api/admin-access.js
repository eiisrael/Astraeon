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
    const userResponse=await fetch(`${supabaseUrl}/auth/v1/user`,{headers:{apikey:supabaseKey,Authorization:`Bearer ${token}`}});
    if(!userResponse.ok)return res.status(401).json({authenticated:false,allowed:false,error:'invalid_session'});
    const user=await userResponse.json();
    const profileResponse=await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,username,display_name,access`,{headers:{apikey:supabaseKey,Authorization:`Bearer ${token}`,Accept:'application/vnd.pgrst.object+json'}});
    if(!profileResponse.ok)return res.status(403).json({authenticated:true,allowed:false,error:'profile_unavailable'});
    const profile=await profileResponse.json();
    const access=Number(profile?.access??1);
    return res.status(200).json({authenticated:true,allowed:access===3,access,profile:{id:profile.id,username:profile.username,displayName:profile.display_name}});
  }catch(error){
    console.error('[Astraeon Admin Access]',error);
    return res.status(500).json({authenticated:false,allowed:false,error:'verification_failed'});
  }
}
