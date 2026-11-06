const crypto=require('node:crypto');
const {sendTransactionalEmail}=require('./_gmail-mailer');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Método não permitido'});
 if(req.headers.origin&&!['https://mini-grid-studio-site.vercel.app','https://minigridstudio.com.br','https://www.minigridstudio.com.br'].includes(req.headers.origin))return res.status(403).json({error:'Origem inválida'});
 const email=String(req.body?.email||'').trim().toLowerCase();
 if(email.length>180||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return res.status(400).json({error:'Informe um e-mail válido.'});
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 if(!base||!key)return res.status(503).json({error:'Acesso temporariamente indisponível.'});
 const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
 try{
  const ip=String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||'unknown').split(',')[0].trim();
  const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
  const limit=await fetch(base+'/rest/v1/rpc/claim_customer_login',{method:'POST',headers,body:JSON.stringify({p_email_hash:hash(email),p_ip_hash:hash(ip)})});
  if(!limit.ok)throw Error('Login rate limit unavailable');
  if((await limit.json())!==true){res.setHeader('Retry-After','60');return res.status(429).json({error:'Aguarde um minuto antes de solicitar outro código. Limite de 5 códigos por hora.'})}
  const generated=await fetch(base+'/auth/v1/admin/generate_link',{method:'POST',headers,body:JSON.stringify({type:'magiclink',email})});
  if(!generated.ok)throw Error('Login generation unavailable');
  const result=await generated.json();const code=result.email_otp||result.properties?.email_otp;
  if(!/^\d{6,10}$/.test(String(code||'')))throw Error('Login code unavailable');
  await sendTransactionalEmail(email,'Seu código de acesso | Mini Grid Studio','<div style="font:16px Arial;max-width:550px;margin:auto;color:#171717"><h2>MINI GRID STUDIO</h2><h1>Seu código de acesso</h1><p>Use este código para acessar sua conta e seus pedidos:</p><p style="font-size:32px;letter-spacing:8px;font-weight:bold">'+code+'</p><p>O código é temporário e só pode ser usado uma vez. Não compartilhe com ninguém. Se você não solicitou o acesso, ignore esta mensagem.</p></div>');
  return res.status(200).json({ok:true});
 }catch(e){console.error('Customer login unavailable',e.message);return res.status(503).json({error:'Não foi possível enviar o código agora. Tente novamente em instantes ou entre com Google.'})}
};
