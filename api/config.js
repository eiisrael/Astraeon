export default function handler(req,res){
  if(req.method&&req.method!=='GET'){
    res.setHeader('Allow','GET');
    return res.status(405).json({error:'Method Not Allowed'});
  }
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  const supabaseUrl=process.env.SUPABASE_URL||'';
  const supabaseKey=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||'';
  const realtimeTopic=process.env.ASTRAEON_REALTIME_TOPIC||'world:astraeon:main';
  return res.status(200).json({
    enabled:Boolean(supabaseUrl&&supabaseKey),
    supabaseUrl,
    supabaseKey,
    realtimeTopic,
    databaseProvider:'supabase',
    version:'4.1-online'
  });
}
