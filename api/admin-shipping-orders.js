// Consulta administrativa de envios: leitura somente, sem compra ou emissao de etiqueta.
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Método não permitido'});
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 if(!base||!key)return res.status(503).json({error:'Integração indisponível'});
 const auth=String(req.headers.authorization||'');
 const jwt=auth.startsWith('Bearer ')?auth.slice(7).trim():'';
 if(!jwt)return res.status(401).json({error:'Entre como administrador'});
 const publicKey=process.env.SUPABASE_ANON_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||key;
 const userResponse=await fetch(base+'/auth/v1/user',{headers:{apikey:publicKey,Authorization:'Bearer '+jwt}});
 if(!userResponse.ok)return res.status(401).json({error:'Sessão inválida'});
 const user=await userResponse.json();
 if(!/^[0-9a-f-]{36}$/i.test(String(user.id||'')))return res.status(401).json({error:'Sessão inválida'});
 const headers={apikey:key,Authorization:'Bearer '+key,Accept:'application/json'};
 const adminResponse=await fetch(base+'/rest/v1/admin_users?user_id=eq.'+encodeURIComponent(user.id)+'&select=user_id&limit=1',{headers});
 if(!adminResponse.ok)return res.status(503).json({error:'Não foi possível verificar a permissão'});
 const admins=await adminResponse.json();
 if(!admins.length)return res.status(403).json({error:'Acesso restrito a administradores'});
 const ordersResponse=await fetch(base+'/rest/v1/orders?select=id,created_at,payment_status,fulfillment_status,shipping_service,shipping_service_id,shipping_cents,shipping_address,tracking_code,melhor_envio_shipment_id,shipping_label_status,shipping_label_url&payment_status=eq.approved&order=created_at.desc&limit=50',{headers});
 if(!ordersResponse.ok)return res.status(502).json({error:'Falha ao consultar pedidos'});
 const orders=await ordersResponse.json();
 return res.status(200).json({orders:orders.map(o=>({...o,shipping_label_url:o.shipping_label_url||null,ready_for_label:o.payment_status==='approved'&&!o.melhor_envio_shipment_id}))});
};