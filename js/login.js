(() => {
const form=document.getElementById("login-form"),message=document.getElementById("login-message"),button=document.getElementById("sign-in"),password=document.getElementById("password"),emailInput=document.getElementById("email");
document.getElementById("year").textContent=new Date().getFullYear();
const show=(text,type)=>{message.textContent=text;message.className="message "+(type||"");};
document.getElementById("toggle-password").addEventListener("click",()=>{const visible=password.type==="password";password.type=visible?"text":"password";document.getElementById("toggle-password").setAttribute("aria-label",visible?"Hide password":"Show password");});
document.getElementById("forgot-link").addEventListener("click",async()=>{
 const email=emailInput.value.trim();if(!email)return show("Enter your registered email address first.","error");
 const cfg=window.NOVA_CONFIG||{};if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||!window.supabase)return show("Password recovery is unavailable. Contact your portal administrator.","error");
 const link=document.getElementById("forgot-link");link.disabled=true;
 try{const client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+"/reset-password.html"});if(error)throw error;show("If this email is registered, password reset instructions will be sent.","success");}
 catch(e){show(e.message||"Unable to request a password reset.","error");}finally{link.disabled=false;}
});
form.addEventListener("submit",async e=>{
 e.preventDefault();show("");const email=emailInput.value.trim(),pass=password.value;
 if(!email||!pass)return show("Please enter both your email address and password.","error");
 const cfg=window.NOVA_CONFIG||{};if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||!window.supabase)return show("Portal authentication is not configured.","error");
 button.disabled=true;button.querySelector("span").textContent="Signing in…";
 try{
  const client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  const {data,error}=await client.auth.signInWithPassword({email,password:pass});if(error)throw error;
  const {data:p,error:pe}=await client.from("profiles").select("role,is_active,must_change_password").eq("id",data.user.id).single();
  if(pe||!p||!p.is_active){await client.auth.signOut();throw new Error("Your portal profile is unavailable or inactive. Contact your administrator.");}
  try{
   const {data:trackData,error:trackError}=await client.functions.invoke("rapid-function",{body:{action:"record_login"}});
   if(trackError||!trackData?.success){
    let detail=trackData?.error||trackError?.message||"The tracking function did not confirm the login.";
    try{const response=trackError?.context;if(response&&typeof response.clone==="function"){const payload=await response.clone().json();detail=payload?.error||payload?.message||detail;}}catch{}
    console.error("Login activity tracking failed:",trackError||trackData);
    sessionStorage.setItem("nova_login_tracking_error",detail);
   }else{
    sessionStorage.removeItem("nova_login_tracking_error");
    sessionStorage.setItem("nova_login_tracking_success","1");
   }
  }catch(trackError){
   console.error("Login activity tracking failed:",trackError);
   sessionStorage.setItem("nova_login_tracking_error",trackError?.message||"Unable to contact the login tracking function.");
  }
  location.replace(p.must_change_password?"/change-password.html":"/dashboard.html");
 }catch(err){show(err.message||"Unable to sign in. Please try again.","error");}
 finally{button.disabled=false;button.querySelector("span").textContent="Sign in securely";}
});
})();