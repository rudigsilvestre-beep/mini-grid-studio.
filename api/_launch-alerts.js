const crypto=require('node:crypto');
const catalog=require('../assets/catalog');
const {sendTransactionalEmail}=require('./_gmail-mailer');
const launchKey='racing-57';
const origin='https://mini-grid-studio-site.vercel.app';
function availableProduct(){return Object.entries(catalog).find(([,p])=>p.launchKey===launchKey&&!p.sold&&p.price>0)}
async function db(path,method='GET',body){
 const key=process.env.SUPABASE_SECRET_KEY,base=process.env.SUPABASE_URL;
 if(!key||!base)throw Error('Database unavailable');
 const r=await fetch(base+'/rest/v1/'+path,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
 if(!r.ok)throw Error('Launch database request failed '+r.status);
 return r.status===204?null:r.json();
}
function unsubscribeToken(id){const secret=process.env.GOOGLE_CLIENT_SECRET;if(!secret)throw Error('Signing unavailable');return id+'.'+crypto.createHmac('sha256',secret).update('launch-unsubscribe:'+id).digest('hex')}
function validToken(token){if(!/^[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(token))return false;const expected=unsubscribeToken(token.split('.')[0]);return crypto.timingSafeEqual(Buffer.from(token),Buffer.from(expected))}
async function dispatch(){
 const product=availableProduct();if(!product)return {sent:0,failed:0,pending:true};
 const rows=await db('rpc/claim_launch_alerts','POST',{});let sent=0,failed=0;
 for(const row of rows){try{
  const current=await db('launch_subscribers?id=eq.'+row.id+'&unsubscribed_at=is.null&sent_at=is.null&select=id');if(!current.length)continue;
  const url=origin+'/?produto='+encodeURIComponent(product[0]);
  const unsubscribe=origin+'/api/launch-alerts?unsubscribe='+encodeURIComponent(unsubscribeToken(row.id));
  await sendTransactionalEmail(row.email,'Racing nº 57 disponível | Mini Grid Studio','<div style="font:16px/1.7 Arial;max-width:560px;margin:auto;color:#171717"><h2>MINI GRID STUDIO</h2><h1>O Racing nº 57 chegou.</h1><p>Você pediu para ser avisado: o quadro já está à venda no site.</p><p><a style="display:inline-block;padding:16px 24px;background:#171717;color:white;text-decoration:none" href="'+url+'">CONHECER O QUADRO</a></p><p>A disponibilidade pode mudar após este aviso.</p><p style="font-size:12px;color:#777">Este é o aviso de lançamento que você solicitou. <a href="'+unsubscribe+'">Cancelar aviso</a></p></div>');
  await db('launch_subscribers?id=eq.'+row.id,'PATCH',{sent_at:new Date().toISOString()});sent++;
 }catch(e){failed++;console.error('Launch email failed',row.id,e.message)}}
 return {sent,failed,pending:false};
}
module.exports={db,dispatch,availableProduct,unsubscribeToken,validToken,origin};
