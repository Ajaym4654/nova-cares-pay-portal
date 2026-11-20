(() => {
  const cfg=window.NOVA_CONFIG||{},root=document.getElementById("main-content"),nav=document.getElementById("navigation");
  const ready=cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY&&window.supabase;
  const icon={"User management":"♙",Dashboard:"⌂",Paystubs:"▤","My paystubs":"▤",Profile:"◎","Login activity":"◷","Audit logs":"◫"};
  const safe=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const setStats=items=>document.getElementById("stats").innerHTML=items.map(x=>'<article class="stat-card"><div class="stat-top"><span>'+x.label+'</span><span class="stat-icon">'+x.icon+'</span></div><div class="stat-value">'+x.value+'</div><div class="stat-note">'+x.note+'</div></article>').join("");
  const empty=(title,message)=>root.innerHTML='<div class="empty-state"><div class="empty-icon">▤</div><b>'+title+'</b><p>'+message+'</p></div>';
  const showError=e=>root.innerHTML='<div class="error-box">'+safe(e?.message||"Unable to load this section. Please try again.")+'</div>';
  document.getElementById("today").textContent=new Intl.DateTimeFormat(undefined,{weekday:"short",month:"short",day:"numeric",year:"numeric"}).format(new Date());
  document.getElementById("menu-toggle").addEventListener("click",()=>document.getElementById("sidebar").classList.toggle("open"));
  if(!ready){document.getElementById("greeting").textContent="Portal setup required";setStats([{label:"Account status",value:"Pending",icon:"◷",note:"Connect Supabase to continue"},{label:"Paystubs",value:"—",icon:"▤",note:"Not loaded"},{label:"Account",value:"—",icon:"◎",note:"Not loaded"}]);root.innerHTML='<div class="error-box">Supabase is not configured. Check js/config.js.</div>';return;}
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  (async()=>{
    const {data:{session}}=await db.auth.getSession();if(!session){location.replace("/");return;}
    const {data:p,error}=await db.from("profiles").select("id,full_name,email,login_id,phone,role,is_active,created_at,avatar_url,job_title").eq("id",session.user.id).single();
    if(error||!p||!p.is_active){await db.auth.signOut();location.replace("/");return;}
    const role=p.role,isNurse=role==="nurse";
    document.getElementById("greeting").textContent="Welcome back, "+(p.full_name||"there");
    document.getElementById("role-label").textContent=role.replace("_"," ").toUpperCase()+" PORTAL";
    const avatar=document.getElementById("avatar");avatar.innerHTML=p.avatar_url?'<img src="'+safe(p.avatar_url)+'" alt="Profile photo">':(p.full_name||"NC").split(" ").map(s=>s[0]).slice(0,2).join("").toUpperCase();
    if(p.avatar_url){avatar.title="Open profile photo";avatar.style.cursor="pointer";avatar.addEventListener("click",()=>window.open(p.avatar_url,"_blank","noopener"));}
    const spotlight=document.getElementById("dashboard-profile");if(spotlight){spotlight.innerHTML=(p.avatar_url?'<button type="button" class="dashboard-photo-open" title="Open full-size profile photo"><img src="'+safe(p.avatar_url)+'" alt="Profile photo"></button>':'<div class="dashboard-photo-fallback">'+safe((p.full_name||"NC").split(" ").map(s=>s[0]).slice(0,2).join("").toUpperCase())+'</div>')+'<div class="dashboard-profile-copy"><b>'+safe(p.full_name||"Portal user")+'</b><span>'+safe(role.replace("_"," ")) +'</span><small>Nova Cares account</small></div>';const photoButton=spotlight.querySelector(".dashboard-photo-open");if(photoButton)photoButton.addEventListener("click",()=>window.open(p.avatar_url,"_blank","noopener"));}
    const menus=role==="super_admin"?["Dashboard","User management","Paystubs","Login activity","Audit logs","Profile"]:role==="admin"?["Dashboard","User management","Paystubs","Profile"]:["Dashboard","My paystubs","Profile"];
    nav.innerHTML=menus.map((m,i)=>'<a href="#" class="'+(i===0?"active":"")+'" data-menu="'+m+'"><span class="nav-icon">'+(icon[m]||"•")+'</span>'+m+'</a>').join("");
    document.getElementById("section-title").textContent=isNurse?"My paystubs":"Portal overview";
    document.getElementById("section-subtitle").textContent=isNurse?"Your weekly pay documents.":"Manage employee accounts and payroll documents.";
    let paystubCount=0,nurseCount=0;
    if(isNurse){
      const {count,error}=await db.from("paystub_documents").select("id",{count:"exact",head:true}).eq("candidate_id",p.id);
      if(error)throw new Error("Unable to load your paystub summary: "+error.message);
      paystubCount=count??0;
    }else{
      const {count,error}=await db.from("profiles").select("id",{count:"exact",head:true}).eq("role","nurse");
      if(error)throw new Error("Unable to load nurse account summary: "+error.message);
      nurseCount=count??0;
    }
    setStats([{label:isNurse?"Position / Designation":"Account role",value:isNurse?(p.job_title||"Nurse"):(role==="super_admin"?"Super Admin":"Admin"),icon:"◈",note:isNurse?"Your employee designation":"Access-controlled account"}]);
    async function renderPaystubs(){
      document.getElementById("section-title").textContent="My paystubs";document.getElementById("section-subtitle").textContent="View and securely download your weekly pay documents.";
      root.innerHTML='<div class="loading">Loading your paystubs…</div>';
      const {data,error}=await db.from("paystub_documents").select("id,original_filename,storage_path,description,created_at,pay_periods(week_label,period_start,period_end,pay_date)").eq("candidate_id",p.id).order("created_at",{ascending:false});
      if(error)throw error;const rows=data||[];
      if(!rows.length)return empty("No paystubs available yet","Your pay documents will appear here once Nova Cares uploads them.");
      root.innerHTML='<div class="facility-list">'+rows.map(r=>'<article class="facility-card"><h3>'+safe(r.original_filename)+'</h3><p>'+safe(r.pay_periods?.week_label||"Pay period")+'</p><p>'+safe(r.pay_periods?.period_start||"")+(r.pay_periods?.period_end?" – "+safe(r.pay_periods.period_end):"")+'</p><p>'+safe(r.description||"")+'</p><button class="preview-paystub" data-path="'+safe(r.storage_path)+'" style="margin:12px 8px 0 0;padding:9px 13px;border:0;border-radius:7px;background:#315f91;color:white;cursor:pointer">Preview</button><button class="download-paystub" data-path="'+safe(r.storage_path)+'" style="margin-top:12px;padding:9px 13px;border:0;border-radius:7px;background:#315f91;color:white;cursor:pointer">Download paystub</button></article>').join("")+'</div>';
      root.querySelectorAll(".preview-paystub,.download-paystub").forEach(btn=>btn.addEventListener("click",async()=>{btn.disabled=true;const preview=btn.classList.contains("preview-paystub"),tab=window.open("about:blank","_blank");try{const {data,error}=await db.storage.from("paystubs").createSignedUrl(btn.dataset.path,60,preview?{}:{download:true});if(error)throw error;if(tab)tab.location.href=data.signedUrl;else showError(new Error("Please allow pop-ups to open the PDF."));}catch(e){if(tab)tab.close();showError(e);}finally{btn.disabled=false;}}));
    }
    function renderProfile(){
      document.getElementById("section-title").textContent="My profile";document.getElementById("section-subtitle").textContent=role==="super_admin"?"View and update your Super Admin account.":"Your account information.";
      const canEdit=role==="super_admin";
      root.innerHTML='<div class="facility-list"><article class="facility-card"><div class="profile-photo-large">'+(p.avatar_url?'<button type="button" class="profile-photo-open" title="Open full-size profile photo"><img src="'+safe(p.avatar_url)+'" alt="Profile photo"></button>':'<span>'+safe((p.full_name||"NC").split(" ").map(s=>s[0]).slice(0,2).join("").toUpperCase())+'</span>')+'</div><h3>Personal details</h3><p><b>Full name:</b> '+safe(p.full_name)+'</p><p><b>Email:</b> '+safe(p.email||session.user.email)+'</p><p><b>Phone:</b> '+safe(p.phone||"Not provided")+'</p></article><article class="facility-card"><h3>Portal access</h3><p><b>Login ID:</b> '+safe(p.login_id||p.email||"—")+'</p><p><b>Role:</b> '+safe(role.replace("_"," "))+'</p><p><b>Account status:</b> Active</p></article></div>'+(canEdit?'<article class="facility-card profile-edit-card"><h3>Edit your Super Admin account</h3><p class="profile-edit-note">Update your name, phone, profile photo, or password.</p><form id="self-profile-form" class="self-profile-form"><label>Full name<input name="full_name" required maxlength="120" value="'+safe(p.full_name||"")+'"></label><label>Phone number<input name="phone" type="tel" maxlength="30" value="'+safe(p.phone||"")+'"></label><label>Profile photo <span>JPG, PNG or WebP · max 5 MB</span><input name="avatar" type="file" accept="image/jpeg,image/png,image/webp"></label><label>New password <span>Leave blank to keep your current password</span><input name="password" type="password" minlength="10" maxlength="72" autocomplete="new-password" placeholder="At least 10 characters"></label><label>Confirm new password<input name="confirm_password" type="password" minlength="10" maxlength="72" autocomplete="new-password" placeholder="Re-enter new password"></label><button type="submit" class="profile-save-btn">Save profile changes</button><p id="profile-save-message" class="profile-save-message" role="status" aria-live="polite"></p></form></article>':'<p style="font-size:11px;color:#7a8998;margin-top:16px">To update your account details, please contact your Nova Cares administrator.</p>');
      const photoButton=root.querySelector(".profile-photo-open");if(photoButton)photoButton.addEventListener("click",()=>window.open(p.avatar_url,"_blank","noopener"));
      const profileForm=root.querySelector("#self-profile-form");if(profileForm)profileForm.addEventListener("submit",async e=>{
        e.preventDefault();const save=profileForm.querySelector("button[type=submit]"),msg=profileForm.querySelector("#profile-save-message"),fd=new FormData(profileForm),full_name=String(fd.get("full_name")||"").trim(),phone=String(fd.get("phone")||"").trim(),password=String(fd.get("password")||""),confirmPassword=String(fd.get("confirm_password")||""),photo=profileForm.elements.avatar.files[0];
        const report=(text,type="")=>{msg.textContent=text;msg.className="profile-save-message "+type;};
        if(!full_name){report("Please enter your full name.","error");return;}
        if(password&&(password.length<10||password.length>72)){report("Password must be between 10 and 72 characters.","error");return;}
        if(password!==confirmPassword){report("The passwords do not match.","error");return;}
        if(photo&&(!["image/jpeg","image/png","image/webp"].includes(photo.type)||photo.size>5*1024*1024)){report("Choose a JPG, PNG or WebP photo up to 5 MB.","error");return;}
        save.disabled=true;save.textContent="Saving…";report("");
        try{
          let avatar_url=p.avatar_url||null;
          if(photo){const ext=photo.type==="image/png"?"png":photo.type==="image/webp"?"webp":"jpg",path=p.id+"/"+crypto.randomUUID()+"."+ext;const {error:uploadError}=await db.storage.from("profile-photos").upload(path,photo,{contentType:photo.type,upsert:false});if(uploadError)throw uploadError;avatar_url=db.storage.from("profile-photos").getPublicUrl(path).data.publicUrl;}
          const {error:profileUpdateError}=await db.from("profiles").update({full_name,phone:phone||null,avatar_url,updated_at:new Date().toISOString()}).eq("id",p.id);if(profileUpdateError)throw profileUpdateError;
          if(password){const {error:passwordError}=await db.auth.updateUser({password});if(passwordError)throw passwordError;}
          p.full_name=full_name;p.phone=phone||null;p.avatar_url=avatar_url;
          document.getElementById("greeting").textContent="Welcome back, "+full_name;
          const avatar=document.getElementById("avatar");avatar.innerHTML=avatar_url?'<img src="'+safe(avatar_url)+'" alt="Profile photo">':safe(full_name.split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase());
          const spotlight=document.getElementById("dashboard-profile");if(spotlight)spotlight.innerHTML=(avatar_url?'<button type="button" class="dashboard-photo-open" title="Open full-size profile photo"><img src="'+safe(avatar_url)+'" alt="Profile photo"></button>':'<div class="dashboard-photo-fallback">'+safe(full_name.split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase())+'</div>')+'<div class="dashboard-profile-copy"><b>'+safe(full_name)+'</b><span>'+safe(role.replace("_"," "))+'</span><small>Nova Cares account</small></div>';
          report(password?"Profile and password updated successfully.":"Profile updated successfully.","success");profileForm.elements.password.value="";profileForm.elements.confirm_password.value="";
          profileForm.querySelector('input[name="avatar"]').value="";
          root.querySelector(".facility-card h3").textContent="Personal details";renderProfile();
        }catch(err){report(err.message||"Unable to update your profile.","error");}
        finally{save.disabled=false;save.textContent="Save profile changes";}
      });
    }
    async function renderDashboard(){
      document.getElementById("section-title").textContent=isNurse?"My paystubs":"Portal overview";
      document.getElementById("section-subtitle").textContent=isNurse?"Your weekly pay documents.":"Manage employee accounts and payroll documents.";
      if(isNurse)return renderPaystubs();
      empty("Your management workspace is ready","Use User management to manage employee accounts and Paystubs to upload weekly statements.");
    }
    async function navigate(name){
      nav.querySelectorAll("a").forEach(n=>n.classList.toggle("active",n.dataset.menu===name));document.getElementById("sidebar").classList.remove("open");
      try{
        if(name==="User management"&&(role==="super_admin"||role==="admin")){location.href="/users.html";return;}
        if(name==="Paystubs"&&(role==="admin"||role==="super_admin")){location.href="/paystubs.html";return;}
        if(name==="My paystubs"||name==="Paystubs")return isNurse?await renderPaystubs():empty("Paystubs","Paystub management is available to authorized administrators.");
        if(name==="Profile")return renderProfile();
        if(name==="Dashboard")return await renderDashboard();
        if(name==="Login activity"||name==="Audit logs")return empty(name,"This section is not enabled yet.");
      }catch(e){showError(e);}
    }
    nav.querySelectorAll("a").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();navigate(a.dataset.menu);}));
    document.getElementById("logout").addEventListener("click",async()=>{await db.auth.signOut();location.replace("/");});
    await renderDashboard();
  })().catch(e=>{root.innerHTML='<div class="error-box">'+safe(e.message||"Unable to load portal data.")+'</div>';});
})();
