(() => {
  const cfg=window.NOVA_CONFIG||{};
  const form=document.getElementById("password-form");
  const message=document.getElementById("message");
  const button=document.getElementById("save-password");
  const show=(text,type="")=>{message.textContent=text;message.className="message "+type;};
  if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||!window.supabase){show("Portal connection is unavailable. Please contact your administrator.","error");return;}
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  (async()=>{
    const {data:{session},error}=await db.auth.getSession();
    if(error||!session){location.replace("/");return;}
    const {data:profile,error:profileError}=await db.from("profiles").select("is_active,must_change_password").eq("id",session.user.id).single();
    if(profileError||!profile||!profile.is_active){await db.auth.signOut();location.replace("/");return;}
    if(!profile.must_change_password){location.replace("/dashboard.html");}
  })().catch(()=>show("Unable to verify your account. Please sign in again.","error"));
  form.addEventListener("submit",async e=>{
    e.preventDefault();show("");
    const password=document.getElementById("new-password").value;
    const confirm=document.getElementById("confirm-password").value;
    if(password.length<10){show("Please use at least 10 characters.","error");return;}
    if(password!==confirm){show("The passwords do not match.","error");return;}
    button.disabled=true;button.querySelector("span").textContent="Updating password…";
    try{
      const {data:{session}}=await db.auth.getSession();
      if(!session)throw new Error("Your session expired. Please sign in again.");
      const {error:updateError}=await db.auth.updateUser({password});
      if(updateError)throw updateError;
      const {error:flagError}=await db.rpc("complete_password_setup");
      if(flagError)throw new Error("Password changed, but account setup could not be completed. Contact your administrator. ("+flagError.message+")");
      show("Password updated. Opening your dashboard…","success");
      setTimeout(()=>location.replace("/dashboard.html"),700);
    }catch(err){show(err.message||"Unable to update password.","error");}
    finally{button.disabled=false;button.querySelector("span").textContent="Save new password";}
  });
  document.getElementById("sign-out").addEventListener("click",async()=>{await db.auth.signOut();location.replace("/");});
})();