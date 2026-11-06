const catalog=require('../assets/catalog');
module.exports=function shippingPayload(cep,entries){
 if(!Array.isArray(entries)||entries.length<1||entries.length>4)throw Error('Selecione os produtos na sacola.');
 const seen=new Set();const products=entries.map(e=>{const p=catalog[e.id];if(p?.sold)throw Error('Este quadro já foi vendido. Remova-o da sacola.');if(!p||seen.has(String(e.id))||!Number.isInteger(e.quantity)||e.quantity<1||e.quantity>10)throw Error('Produto ou quantidade inválidos');seen.add(String(e.id));return{id:String(e.id),width:25,height:8,length:30,weight:0.525,insurance_value:p.price,quantity:e.quantity}});
 return {from:{postal_code:'03191160'},to:{postal_code:cep},products,options:{receipt:false,own_hand:false}};
};
