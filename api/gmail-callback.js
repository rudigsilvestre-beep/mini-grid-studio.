const crypto=require('node:crypto');
const home='https://mini-grid-studio-site.vercel.app';
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Type','text/html; charset=utf-8');
 if(req.method!=='GET')return res.status(405).send('Method not allowed');
 const id=process.env.GOOGLE_CLIENT_ID,secret=process.env.GOOGLE_CLIENT_SECRET,dbUrl=process.env.SUPABASE_URL,dbKey=process.env.SUPABASE_SECRET_KEY;
 if(!id||!secret||!dbUrl||!dbKey)return res.status(503).send('Integração ainda não configurada.');
 const state=String(req.query.state||'').split('.');
 if(state.length!==2)return res.status(400).send('Autorização inválida.');
 const expected=crypto.createHmac('sha256',secret).update(state[0]).digest();
 let actual,payload;
 try{actual=Buffer.from(state[1],'base64url');payload=JSON.parse(Buffer.from(state[0],'base64url').toString('utf8'))}catch{return res.status(400).send('Autorização inválida.')}
 if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected)||!Number.isFinite(payload.time)||Math.abs(Date.now()-payload.time)>600000)return res.status(400).send('Autorização expirada. Tente novamente.');
 const code=String(req.query.code||'');if(!code)return res.status(400).send('Autorização não concedida.');
 try{
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:id,client_secret:secret,redirect_uri:home+'/api/gmail-callback',grant_type:'authorization_code'})});
  if(!response.ok)throw Error('Google token exchange '+response.status);
  const tokens=await response.json();
  if(!tokens.id_token||!tokens.refresh_token)throw Error('Missing identity or refresh token');
  const identityResponse=await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(tokens.id_token));
  if(!identityResponse.ok)throw Error('Identity verification failed');
  const identity=await identityResponse.json();
  const sender=String(process.env.GMAIL_SENDER||'').trim().toLowerCase();
  if(identity.aud!==id||identity.email_verified!== 'true'||String(identity.email||'').toLowerCase()!==sender||sender!=='rudigsilvestre@gmail.com')return res.status(403).send('Esta conta Google não está autorizada para a Mini Grid Studio.');
  const key=crypto.createHash('sha256').update(secret).digest();
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  const encrypted=Buffer.concat([cipher.update(tokens.refresh_token,'utf8'),cipher.final()]);
  const value=Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64');
  const saved=await fetch(dbUrl+'/rest/v1/gmail_oauth_credentials?on_conflict=account_email',{method:'POST',headers:{apikey:dbKey,Authorization:'Bearer '+dbKey,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({account_email:sender,refresh_token_ciphertext:value,updated_at:new Date().toISOString()})});
  if(!saved.ok)throw Error('Credential storage failed '+saved.status);
  return res.status(200).send('<html lang="pt-BR"><meta charset="utf-8"><title>Mini Grid Studio</title><body style="font:18px Arial;max-width:620px;margin:70px auto"><h1>Mini Grid Studio</h1><p>Gmail autorizado com sucesso.</p><p>A autorização foi armazenada de forma criptografada. O envio automático de pedidos ainda precisa ser testado antes da ativação.</p><a href="'+home+'">Voltar à loja</a></body></html>');
 }catch(e){console.error('Gmail OAuth callback failed',e.message);return res.status(502).send('Não foi possível concluir a conexão. Verifique as configurações e tente novamente.')}
};
