// Reconcile a checkout return using Mercado Pago's authoritative payment API.
// Browser parameters are identifiers only, never proof of approval.
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 const id=String(req.body?.payment_id||'');
 const reference=String(req.body?.external_reference||'');
 if(!/^\d{1,25}$/.test(id)||!/^mini-grid-[0-9a-f-]{36}$/.test(reference))return res.status(400).json({error:'Invalid identifiers'});
 const token=process.env.MERCADO_PAGO_ACCESS_TOKEN,key=process.env.SUPABASE_SECRET_KEY,url=process.env.SUPABASE_URL;
 if(!token||!key||!url)return res.status(503).json({error:'Service unavailable'});
 const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'};
 try{
  const p=await fetch('https://api.mercadopago.com/v1/payments/'+id,{headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
  if(!p.ok){console.error('Reconcile payment lookup failed',p.status);return res.status(502).json({error:'Payment lookup unavailable'});}
  const payment=await p.json();
  if(String(payment.id)!==id||payment.external_reference!==reference||payment.currency_id!=='BRL')return res.status(409).json({error:'Payment reference mismatch'});
  const q=await fetch(url+'/rest/v1/orders?external_reference=eq.'+encodeURIComponent(reference)+'&select=id,total_cents,payment_id,payment_status,fulfillment_status',{headers});
  if(!q.ok){console.error('Reconcile order lookup failed',q.status);return res.status(502).json({error:'Order lookup unavailable'});}
  const orders=await q.json();
  if(orders.length!==1)return res.status(404).json({error:'Order not found'});
  const order=orders[0],paid=Math.round(Number(payment.transaction_amount)*100);
  if(!Number.isSafeInteger(paid)||paid!==order.total_cents)return res.status(409).json({error:'Amount mismatch'});
  if(order.payment_id&&String(order.payment_id)!==id)return res.status(409).json({error:'Payment ID mismatch'});
  const allowed=['approved','pending','in_process','rejected','cancelled','refunded','charged_back','authorized'];
  const status=allowed.includes(payment.status)?payment.status:'pending';
  if(order.payment_status===status||order.payment_status==='approved'&&['pending','in_process','authorized','rejected','cancelled'].includes(status))return res.status(200).json({status:order.payment_status});
  const patch=await fetch(url+'/rest/v1/orders?id=eq.'+encodeURIComponent(order.id)+'&payment_status=eq.'+encodeURIComponent(order.payment_status)+'&fulfillment_status=eq.'+encodeURIComponent(order.fulfillment_status),{method:'PATCH',headers,body:JSON.stringify({payment_id:id,payment_status:status,fulfillment_status:status==='approved'?(order.payment_status==='approved'?order.fulfillment_status:'awaiting_fulfillment'):order.fulfillment_status,updated_at:new Date().toISOString()})});
  if(!patch.ok){console.error('Reconcile update failed',patch.status);return res.status(502).json({error:'Order update unavailable'});}
  console.info('Payment reconciled',{status});
  return res.status(200).json({status});
 }catch(e){console.error('Payment reconciliation failed',e.message);return res.status(502).json({error:'Reconciliation unavailable'});}
};
