(() => {
  'use strict';
  const landing = new URL(location.href);
  const fragment = new URLSearchParams(landing.hash.slice(1));
  let resetToken = fragment.get('resetToken') || landing.searchParams.get('resetToken') || '';
  if (resetToken) {
    landing.searchParams.delete('resetToken');
    fragment.delete('resetToken');
    landing.hash = fragment.toString();
    history.replaceState(history.state, '', landing.pathname + landing.search + landing.hash);
  }
  window.SKPasswordUI = {
    init({ sync, renderAccount, openAccount, resetServer }) {
      const dialog=document.querySelector('#passwordDialog'), form=document.querySelector('#passwordForm');
      const title=document.querySelector('#passwordTitle'), status=document.querySelector('#passwordStatus');
      const email=document.querySelector('#passwordEmail'), current=document.querySelector('#passwordCurrent');
      const password=document.querySelector('#passwordNew'), confirm=document.querySelector('#passwordConfirm');
      const submit=document.querySelector('#passwordSubmit');
      let mode='forgot',busy=false;
      function field(input,visible) { input.closest('label').hidden=!visible; input.disabled=!visible; input.required=visible; }
      function open(action) {
        mode=action;form.reset();status.textContent='';
        title.textContent={forgot:'Reset your password',reset:'Choose a new password',change:'Change your password'}[mode];
        field(email,mode==='forgot');field(current,mode==='change');field(password,mode!=='forgot');field(confirm,mode!=='forgot');
        email.value=sync.config.user?.email || document.querySelector('#cloudEmail').value || '';
        submit.textContent=mode==='forgot'?'Send reset link':'Save password';
        document.querySelector('#cloudAccountDialog').close();
        document.querySelector('#settingsDialog')?.close();
        dialog.showModal();
        (mode==='forgot'?email:mode==='change'?current:password).focus();
      }
      document.querySelector('#forgotPasswordBtn').addEventListener('click',()=>open('forgot'));
      document.querySelector('#changePasswordBtn').addEventListener('click',()=>open('change'));
      document.querySelector('#passwordCancel').addEventListener('click',()=>{if(!busy)dialog.close();});
      dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
      dialog.addEventListener('close',()=>{form.reset();resetToken='';});
      form.addEventListener('submit',async event=>{
        event.preventDefault();if(busy)return;
        if(mode!=='forgot' && password.value!==confirm.value){status.textContent='The new passwords do not match.';confirm.focus();return;}
        busy=true;submit.disabled=true;status.textContent=mode==='forgot'?'Requesting reset link…':'Updating password…';
        try {
          let result;
          if(mode==='reset') {
            const response=await fetch(resetServer+'/api/v1/auth/password/reset',{method:'POST',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify({token:resetToken,password:password.value})});
            result=await response.json();if(!response.ok)throw new Error(result.error||'Could not reset your password.');
          } else {
            if(mode==='forgot')sync.setServerUrl(document.querySelector('#cloudServerUrl').value);
            result=await sync.request('/api/v1/auth/password/'+mode,{method:'POST',body:JSON.stringify(mode==='forgot'?{email:email.value}:{currentPassword:current.value,password:password.value})});
          }
          form.reset();status.textContent=result.message;
          if(mode!=='forgot') {
            resetToken='';sync.stop();
            // Preserve local recipes and household sync metadata; only invalidate authentication.
            sync.config.token='';sync.config.expiresAt='';sync.save();renderAccount();
            dialog.close();openAccount();
            document.querySelector('#cloudDialogStatus').textContent=result.message;
          }
        } catch(error) {status.textContent=error.message||'The request failed. Please try again.';}
        finally {busy=false;submit.disabled=false;}
      });
      if(resetToken)open('reset');
    }
  };
})();
