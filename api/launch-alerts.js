const crypto=require('node:crypto');
const {db,dispatch,availableProduct,validToken,origin}=require('./_launch-alerts');
async function isAdmin(req){
 const authorization=String(req.headers.authorization||'');if(!authorization.startsWith('Bearer '))return false;
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 const r=await fetch(base+'/auth/v1/user',{headers:{apikey:key,Authorization:authorization}});if(!r.ok)return false;
 const user=await r.json();if(!/^[a-f0-9-]{36}$/i.test(user.id||''))return false;
 return (await db('admin_users?user_id=eq.'+encodeURIComponent(user.id)+'&select=user_id')).length>0;
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 try{
  const token=String(req.query?.unsubscribe||'');
  if(token){
   if(!validToken(token))return res.status(400).send('Link inválido.');
   if(req.method==='GET'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.status(200).send('<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width"><title>Cancelar aviso | Mini Grid Studio</title><body style="font:16px Arial;padding:40px;max-width:560px;margin:auto"><h1>Cancelar aviso</h1><p>Deseja deixar de receber o aviso do Racing nº 57?</p><form method="post"><button style="padding:16px;background:#171717;color:white;border:0">CANCELAR AVISO</button></form></body></html>')}
   if(req.method==='POST'){await db('launch_subscribers?id=eq.'+token.split('.')[0],'PATCH',{unsubscribed_at:new Date().toISOString()});return res.status(200).send('Aviso cancelado. Você não receberá o e-mail de lançamento.')}
  }
  if(req.method==='GET')return res.status(200).json({available:!!availableProduct()});
  if(req.method!=='POST')return res.status(405).json({error:'Método não permitido'});
  if(req.body?.action==='notify'){
   if(!await isAdmin(req))return res.status(403).json({error:'Acesso restrito a administradores.'});
   if(!availableProduct())return res.status(409).json({error:'O Racing nº 57 ainda não está disponível no catálogo.'});
   return res.status(200).json(await dispatch());
  }
  if(req.headers.origin&&![origin,'https://minigridstudio.com.br','https://www.minigridstudio.com.br'].includes(req.headers.origin))return res.status(403).json({error:'Origem inválida.'});
  if(req.body?.website)return res.status(200).json({ok:true});
  const email=String(req.body?.email||'').trim().toLowerCase();
  if(email.length>180||!/^[^@\s<>\r\n]+@[^@\s<>\r\n]+\.[^@\s<>\r\n]+$/.test(email))return res.status(400).json({error:'Informe um e-mail válido.'});
  if(req.body?.consent!==true)return res.status(400).json({error:'Autorize o envio do aviso para continuar.'});
  if(availableProduct())return res.status(409).json({error:'O produto já está à venda. Atualize a página para conhecer.'});
  const ip=String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||'unknown').split(',')[0].trim();
  const hash=crypto.createHash('sha256').update('launch:'+ip).digest('hex');
  const ok=await db('rpc/register_launch_alert','POST',{p_email:email,p_ip_hash:hash});
  if(!ok)return res.status(429).json({error:'Muitas tentativas. Tente novamente mais tarde.'});
  return res.status(200).json({ok:true});
 }catch(e){console.error('Launch alert unavailable',e.message);return res.status(503).json({error:'Não foi possível concluir agora. Tente novamente em instantes.'})}
};
