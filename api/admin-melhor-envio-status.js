// Diagnostico seguro da integracao Melhor Envio. Nao cria nem compra etiquetas.
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Metodo nao permitido'});
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 const jwt=String(req.headers.authorization||'').replace(/^Bearer /,'').trim();
 if(!base||!key||!jwt)return res.status(401).json({error:'Acesso nao autorizado'});
 try{
  const userRes=await fetch(base+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+jwt}});
  if(!userRes.ok)return res.status(401).json({error:'Sessao invalida'});
  const user=await userRes.json();
  if(!/^[0-9a-f-]{36}$/i.test(String(user.id||'')))return res.status(401).json({error:'Sessao invalida'});
  const headers={apikey:key,Authorization:'Bearer '+key};
  const admin=await fetch(base+'/rest/v1/admin_users?user_id=eq.'+encodeURIComponent(user.id)+'&select=user_id&limit=1',{headers});
  if(!admin.ok)return res.status(503).json({error:'Falha na verificacao administrativa'});
  if(!(await admin.json()).length)return res.status(403).json({error:'Acesso restrito'});
  const token=process.env.MELHOR_ENVIO_TOKEN;
  if(!token)return res.status(200).json({connected:false,status:'Token nao configurado'});
  const me=await fetch('https://melhorenvio.com.br/api/v2/me',{headers:{Authorization:'Bearer '+token,Accept:'application/json','User-Agent':'MiniGridStudio (contato via Instagram @minigridstudio80)'},signal:AbortSignal.timeout(9000)});
  return res.status(200).json({connected:me.ok,status:me.ok?'Conta Melhor Envio acessivel':me.status===401?'Token nao autorizado':me.status===403?'Permissao insuficiente':'Nao foi possivel validar a conta',http_status:me.status,can_purchase_labels:false,notes:'Consulta somente; permissoes de emissao e compra ainda nao verificadas'});
 }catch(e){return res.status(502).json({connected:false,status:'Falha ao consultar Melhor Envio',can_purchase_labels:false})}
};