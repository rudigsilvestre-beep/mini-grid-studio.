const crypto=require('node:crypto');
const json=(res,status,data)=>res.status(status).json(data);
function validSignature(req,secret,paymentId){
 const header=String(req.headers['x-signature']||'');
 const ts=header.match(/(?:^|,)\s*ts=([^,]+)/)?.[1]?.trim();
 const v1=header.match(/(?:^|,)\s*v1=([^,]+)/)?.[1]?.trim();
 const requestId=String(req.headers['x-request-id']||'');
 if(!ts||!v1||!requestId||!/^[a-f0-9]{64}$/i.test(v1))return false;
 const timestamp=Number(ts);
 if(!Number.isFinite(timestamp)||Math.abs(Date.now()-timestamp)>10*60*1000)return false;
 const id=String(paymentId).toLowerCase();
 const manifest='id:'+id+';request-id:'+requestId+';ts:'+ts+';';
 const digest=crypto.createHmac('sha256',secret).update(manifest).digest('hex');
 return crypto.timingSafeEqual(Buffer.from(digest,'hex'),Buffer.from(v1,'hex'));
}
async function dbRequest(table,method,query,body){
 const url=process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)throw Error('Database not configured');
 const response=await fetch(url+'/rest/v1/'+table+(query?'?'+query:''),{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},body:body?JSON.stringify(body):undefined});
 if(!response.ok)throw Error('Database request failed: '+response.status);
 return response.json();
}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
 const secret=process.env.MERCADO_PAGO_WEBHOOK_SECRET;
 const token=process.env.MERCADO_PAGO_ACCESS_TOKEN;
 if(!secret||!token||!process.env.SUPABASE_SECRET_KEY||!process.env.SUPABASE_URL)return json(res,503,{error:'Webhook not configured'});
 const id=String(req.query?.['data.id']||req.body?.data?.id||'');
 if(!/^\d{1,25}$/.test(id)){console.warn('Webhook rejected: invalid payment id',{type:req.body?.type,action:req.body?.action,hasQueryId:Boolean(req.query?.['data.id']),hasBodyId:Boolean(req.body?.data?.id)});return json(res,400,{error:'Invalid payment id'});}
 if(!validSignature(req,secret,id)){console.warn('Webhook rejected: signature mismatch',{hasSignature:Boolean(req.headers['x-signature']),hasRequestId:Boolean(req.headers['x-request-id'])});return json(res,401,{error:'Invalid signature'});}
 try{
  const paymentResponse=await fetch('https://api.mercadopago.com/v1/payments/'+encodeURIComponent(id),{headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
  if(!paymentResponse.ok)throw Error('Payment verification failed');
  const payment=await paymentResponse.json();
  if(String(payment.id)!==id||!String(payment.external_reference||'').startsWith('mini-grid-'))return json(res,400,{error:'Unrecognized payment'});
  const orders=await dbRequest('orders','GET','external_reference=eq.'+encodeURIComponent(payment.external_reference)+'&select=id,total_cents,payment_id,payment_status',null);
  if(orders.length!==1){console.warn('Webhook rejected: order not found');return json(res,409,{error:'Order not found'});}
  const order=orders[0];
  const paid=Math.round(Number(payment.transaction_amount)*100);
  if(!Number.isSafeInteger(paid)||paid!==order.total_cents||payment.currency_id!=='BRL'){console.warn('Webhook rejected: amount mismatch',{paid,expected:order.total_cents,currency:payment.currency_id});return json(res,409,{error:'Amount mismatch'});}
  if(order.payment_id&&String(order.payment_id)!==id)return json(res,409,{error:'Payment mismatch'});
  const statuses=['approved','pending','in_process','rejected','cancelled','refunded','charged_back','authorized'];
  const status=statuses.includes(payment.status)?payment.status:'pending';
  if(order.payment_status==='approved'&&status!=='approved')return json(res,200,{ok:true});
  await dbRequest('orders','PATCH','id=eq.'+encodeURIComponent(order.id),{payment_id:id,payment_status:status,fulfillment_status:status==='approved'?'awaiting_fulfillment':'awaiting_payment',updated_at:new Date().toISOString()});
  return json(res,200,{ok:true});
 }catch(err){console.error('Payment webhook processing failed',err.message);return json(res,500,{error:'Processing failed'})}
};
