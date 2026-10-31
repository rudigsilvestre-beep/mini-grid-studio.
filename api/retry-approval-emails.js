const {sendApprovalEmail}=require('./_gmail-mailer');
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const expected=process.env.CRON_SECRET;
 const provided=String(req.headers.authorization||'');
 if(!expected||provided!=='Bearer '+expected)return res.status(401).json({error:'Unauthorized'});
 try{
  const key=process.env.SUPABASE_SECRET_KEY,url=process.env.SUPABASE_URL;
  if(!key||!url)throw Error('Database unavailable');
  const params=new URLSearchParams({payment_status:'eq.approved',approval_email_sent_at:'is.null',approval_email_attempts:'lt.10',select:'id,approval_email_claimed_at',order:'created_at.asc',limit:'15'});
  const response=await fetch(url+'/rest/v1/orders?'+params,{headers:{apikey:key,Authorization:'Bearer '+key}});
  if(!response.ok)throw Error('Order scan failed '+response.status);
  const rows=await response.json();let sent=0,failed=0,skipped=0;
  for(const row of rows){
   if(row.approval_email_claimed_at&&Date.now()-new Date(row.approval_email_claimed_at).getTime()<10*60*1000){skipped++;continue}
   try{if(await sendApprovalEmail(row.id))sent++;else skipped++}
   catch(e){failed++;console.error('Email retry failed',{order:row.id.slice(0,8),error:e.message})}
  }
  return res.status(200).json({ok:true,checked:rows.length,sent,failed,skipped});
 }catch(e){console.error('Email retry job failed',e.message);return res.status(500).json({error:'Retry unavailable'})}
};