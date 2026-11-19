(() => {
const cfg=window.NOVA_CONFIG||{},form=document.getElementById("reset-form"),message=document.getElementById("reset-message"),button=document.getElementById("reset-button");
const show=(text,type="")=>{message.textContent=text;message.className="reset-message "+type;};
if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||!window.supabase){show("Portal connection is unavailable. Contact your administrator.","error");button.disabled=true;return;}
const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
(async()=>{const {data:{session},error}=await db.auth.getSession();if(error||!session){show("This reset link is invalid or has expired. Request a new password reset from the sign-in page.","error");button.disabled=true;}})().catch(()=>{show("Unable to verify this reset link. Request a new one.","error");button.disabled=true;});
form.addEventListener("submit",async e=>{
 e.preventDefault();show("");const password=document.getElementById("new-password").value,confirm=document.getElementById("confirm-password").value;
 if(password.length<10){show("Please use at least 10 characters.","error");return;}if(password!==confirm){show("The passwords do not match.","error");return;}
 button.disabled=true;button.querySelector("span").textContent="Updating…";
 try{const {data:{session}}=await db.auth.getSession();if(!session)throw new Error("This reset link is invalid or has expired. Request a new one.");const {error}=await db.auth.updateUser({password});if(error)throw error;show("Password updated successfully. You can now sign in.","success");await db.auth.signOut();form.reset();}
 catch(err){show(err.message||"Unable to update password.","error");button.disabled=false;button.querySelector("span").textContent="Update password";}
});
})();