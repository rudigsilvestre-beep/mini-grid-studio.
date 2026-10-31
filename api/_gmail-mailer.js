const crypto=require('node:crypto');
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const money=c=>(Number(c||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
async function db(table,query,method='GET',body){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 const r=await fetch(url+'/rest/v1/'+table+'?'+query,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},body:body?JSON.stringify(body):undefined});
 if(!r.ok)throw Error('Database '+table+' '+r.status);return r.json();
}
async function sendApprovalEmail(orderId){
 const secret=process.env.GOOGLE_CLIENT_SECRET,id=process.env.GOOGLE_CLIENT_ID,sender=process.env.GMAIL_SENDER;
 if(!secret||!id||!sender)throw Error('Gmail credentials missing');
 const orders=await db('orders','id=eq.'+encodeURIComponent(orderId)+'&select=id,payment_status,approval_email_sent_at,shipping_address,subtotal_cents,shipping_cents,total_cents');
 const o=orders[0];if(!o||o.payment_status!=='approved'||o.approval_email_sent_at)return false;
 const recipient=String(o.shipping_address?.email||'').trim();
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient))throw Error('Invalid customer email');
 const claim=await fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/claim_approval_email',{method:'POST',headers:{apikey:process.env.SUPABASE_SECRET_KEY,Authorization:'Bearer '+process.env.SUPABASE_SECRET_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_order_id:o.id})});
 if(!claim.ok)throw Error('Email claim failed '+claim.status);
 if((await claim.json())!==true)return false;
 try{
 const creds=await db('gmail_oauth_credentials','account_email=eq.'+encodeURIComponent(sender.toLowerCase())+'&select=refresh_token_ciphertext');
 if(creds.length!==1)throw Error('Gmail authorization missing');
 const encrypted=Buffer.from(creds[0].refresh_token_ciphertext,'base64');
 const key=crypto.createHash('sha256').update(secret).digest();
 const decipher=crypto.createDecipheriv('aes-256-gcm',key,encrypted.subarray(0,12));
 decipher.setAuthTag(encrypted.subarray(12,28));
 const refreshToken=Buffer.concat([decipher.update(encrypted.subarray(28)),decipher.final()]).toString('utf8');
 const auth=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:id,client_secret:secret,refresh_token:refreshToken,grant_type:'refresh_token'})});
 if(!auth.ok)throw Error('Gmail token refresh failed '+auth.status);
 const access=(await auth.json()).access_token;if(!access)throw Error('Gmail access token missing');
 const number=o.id.slice(0,8).toUpperCase();
 const sig=crypto.createHmac('sha256',secret).update('order-track-v1:'+o.id).digest('hex');
 const link='https://mini-grid-studio-site.vercel.app/acompanhar.html?token='+encodeURIComponent('v1.'+o.id+'.'+sig);
 const items=await db('order_items','order_id=eq.'+encodeURIComponent(o.id)+'&select=product_name,quantity,unit_price_cents');
 const rows=items.map(i=>'<li>'+esc(i.product_name)+' — '+Number(i.quantity)+' × '+money(i.unit_price_cents)+'</li>').join('');
 const html='<div style="font:16px Arial,sans-serif;max-width:600px;margin:auto;color:#171717"><h1>MINI GRID STUDIO</h1><h2>Pagamento aprovado!</h2><p>Seu pedido <strong>#'+esc(number)+'</strong> foi confirmado.</p><ul>'+rows+'</ul><p>Produtos: '+money(o.subtotal_cents)+'<br>Frete: '+money(o.shipping_cents)+'<br><strong>Total: '+money(o.total_cents)+'</strong></p><p><a href="'+esc(link)+'">Acompanhar meu pedido</a></p><p>Este link é privado. Não compartilhe com outras pessoas.</p><p>Obrigado por comprar na Mini Grid Studio.</p></div>';
 const subject='Pagamento aprovado — Pedido #'+number+' | Mini Grid Studio';
 const message=['From: Mini Grid Studio <'+sender+'>','To: '+recipient,'Subject: =?UTF-8?B?'+Buffer.from(subject).toString('base64')+'?=','MIME-Version: 1.0','Content-Type: text/html; charset=UTF-8','Content-Transfer-Encoding: base64','',Buffer.from(html).toString('base64')].join('\r\n');
 const raw=Buffer.from(message).toString('base64url');
 const sent=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},body:JSON.stringify({raw})});
 if(!sent.ok)throw Error('Gmail send failed '+sent.status);
 await db('orders','id=eq.'+encodeURIComponent(o.id),'PATCH',{approval_email_sent_at:new Date().toISOString()});
 console.info('Gmail approval email sent',{order:number});return true;
 }catch(error){
  try{await db('orders','id=eq.'+encodeURIComponent(o.id)+'&approval_email_sent_at=is.null','PATCH',{approval_email_last_error:String(error.message).slice(0,250)})}catch(e){console.error('Email error log failed',e.message)}
  throw error;
 }
}
module.exports={sendApprovalEmail};
