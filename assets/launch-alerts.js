(()=>{
 const dialog=document.getElementById('launchDialog'),form=document.getElementById('launchForm'),strip=document.getElementById('launchStrip');
 if(!dialog||!form||!strip)return;
 let seen=false,subscribed=false;try{seen=!!sessionStorage.getItem('racing57Seen');subscribed=!!localStorage.getItem('racing57Subscribed')}catch(e){}
 function markSeen(){try{sessionStorage.setItem('racing57Seen','1')}catch(e){}}
 function open(){if(dialog.open)return;markSeen();dialog.showModal()}
 document.querySelectorAll('[data-launch-open]').forEach(b=>b.addEventListener('click',open));
 document.getElementById('launchClose').onclick=()=>dialog.close();
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
 form.onsubmit=async e=>{
  e.preventDefault();const button=document.getElementById('launchSubmit'),status=document.getElementById('launchStatus');
  if(button.disabled)return;button.disabled=true;button.textContent='CADASTRANDO…';status.textContent='';status.classList.remove('error');
  try{const r=await fetch('/api/launch-alerts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.elements.email.value,consent:form.elements.consent.checked,website:form.elements.website.value})});const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível cadastrar.');status.textContent='Cadastro recebido! Vamos avisar por e-mail quando o Racing nº 57 estiver à venda.';button.textContent='AVISO SOLICITADO';form.querySelectorAll('input').forEach(i=>i.disabled=true);try{localStorage.setItem('racing57Subscribed','1')}catch(e){}}
  catch(err){status.classList.add('error');status.textContent=err.message;button.disabled=false;button.textContent='QUERO SER AVISADO'}
 };
 fetch('/api/launch-alerts').then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>{
  if(d.available){strip.hidden=true;strip.style.display='none';dialog.close();return}
  strip.hidden=false;
  if(!seen&&!subscribed&&!location.search)setTimeout(()=>{if(!document.querySelector('.overlay.open,.cart-panel.open')&&!document.hidden)open()},2500);
 }).catch(()=>{});
})();
