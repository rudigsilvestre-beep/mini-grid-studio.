const crypto=require('node:crypto');
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Método não permitido'});
 const token=String(req.query?.token||'');
 const signed=/^v1\\.([0-9a-f-]{36})\\.([a-f0-9]{64})$/.exec(token);
 if(!signed&&!/^[a-f0-9]{64}$/.test(token))return res.status(400).json({error:'Link inválido'});
 if(signed){
  const secret=process.env.GOOGLE_CLIENT_SECRET;if(!secret)return res.status(503).json({error:'Serviço indisponível'});
  const expected=crypto.createHmac('sha256',secret).update('order-track-v1:'+signed[1]).digest('hex');
  if(!crypto.timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(signed[2],'hex')))return res.status(404).json({error:'Pedido não encontrado'});
 }
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)return res.status(503).json({error:'Serviço indisponível'});
 const hash=crypto.createHash('sha256').update(token).digest('hex');
 const headers={apikey:key,Authorization:'Bearer '+key,Accept:'application/json'};
 try{
  const r=await fetch(url+'/rest/v1/orders?tracking_token_hash=eq.'+hash+'&select=id,created_at,payment_status,fulfillment_status,tracking_code,shipping_service,subtotal_cents,shipping_cents,total_cents',{headers});
  if(!r.ok)throw Error('Order lookup '+r.status);
  const orders=await r.json();
  if(orders.length!==1)return res.status(404).json({error:'Pedido não encontrado'});
  const o=orders[0];
  const ir=await fetch(url+'/rest/v1/order_items?order_id=eq.'+encodeURIComponent(o.id)+'&select=product_name,quantity,unit_price_cents',{headers});
  if(!ir.ok)throw Error('Items lookup '+ir.status);
  const items=await ir.json();
  return res.status(200).json({order:{number:o.id.slice(0,8).toUpperCase(),created_at:o.created_at,payment_status:o.payment_status,fulfillment_status:o.fulfillment_status,tracking_code:o.tracking_code,shipping_service:o.shipping_service,subtotal_cents:o.subtotal_cents,shipping_cents:o.shipping_cents,total_cents:o.total_cents,items}});
 }catch(e){console.error('Tracking lookup failed',e.message);return res.status(502).json({error:'Não foi possível consultar o pedido'});}
};