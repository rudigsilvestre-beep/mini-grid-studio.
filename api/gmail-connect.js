const crypto=require('node:crypto');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).send('Method not allowed');
 const id=process.env.GOOGLE_CLIENT_ID,secret=process.env.GOOGLE_CLIENT_SECRET;
 if(!id||!secret)return res.status(503).send('Gmail OAuth not configured');
 const payload=Buffer.from(JSON.stringify({time:Date.now(),nonce:crypto.randomBytes(16).toString('hex')})).toString('base64url');
 const signature=crypto.createHmac('sha256',secret).update(payload).digest('base64url');
 const params=new URLSearchParams({client_id:id,redirect_uri:'https://mini-grid-studio-site.vercel.app/api/gmail-callback',response_type:'code',scope:'openid email https://www.googleapis.com/auth/gmail.send',access_type:'offline',prompt:'consent select_account',state:payload+'.'+signature});
 res.writeHead(302,{Location:'https://accounts.google.com/o/oauth2/v2/auth?'+params.toString(),'Cache-Control':'no-store'});res.end();
};
