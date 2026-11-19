(() => {
  const cfg=window.NOVA_CONFIG||{},root=document.getElementById("main-content"),nav=document.getElementById("navigation");
  const ready=cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY&&window.supabase;
  const icon={"User management":"♙",Dashboard:"⌂",Candidates:"♙",Facilities:"▦",Paystubs:"▤",Recruiters:"♧","Login activity":"◷","Audit logs":"◫","My facilities":"▦","My paystubs":"▤",Profile:"◎"};
  const setStats=items=>document.getElementById("stats").innerHTML=items.map(x=>'<article class="stat-card"><div class="stat-top"><span>'+x.label+'</span><span class="stat-icon">'+x.icon+'</span></div><div class="stat-value">'+x.value+'</div><div class="stat-note">'+x.note+'</div></article>').join("");
  const empty=(title,message)=>root.innerHTML='<div class="empty-state"><div class="empty-icon">▤</div><b>'+title+'</b><p>'+message+'</p></div>';
  const safe=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const showError=e=>root.innerHTML='<div class="error-box">'+safe(e?.message||"Unable to load this section. Please try again.")+'</div>';
  document.getElementById("today").textContent=new Intl.DateTimeFormat(undefined,{weekday:"short",month:"short",day:"numeric",year:"numeric"}).format(new Date());
  document.getElementById("menu-toggle").addEventListener("click",()=>document.getElementById("sidebar").classList.toggle("open"));
  if(!ready){document.getElementById("greeting").textContent="Portal setup required";setStats([{label:"Account status",value:"Pending",icon:"◷",note:"Connect Supabase to continue"},{label:"Documents",value:"—",icon:"▤",note:"Not loaded"},{label:"Facilities",value:"—",icon:"▦",note:"Not loaded"}]);root.innerHTML='<div class="error-box">Supabase is not configured. Check js/config.js.</div>';return;}
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  (async()=>{
    const {data:{session}}=await db.auth.getSession();if(!session){location.replace("/");return;}
    const {data:p,error}=await db.from("profiles").select("id,full_name,email,login_id,phone,role,is_active,recruiter_id,created_at").eq("id",session.user.id).single();
    if(error||!p||!p.is_active){await db.auth.signOut();location.replace("/");return;}
    const role=p.role,isNurse=role==="nurse";
    document.getElementById("greeting").textContent="Welcome back, "+(p.full_name||"there");
    document.getElementById("role-label").textContent=role.replace("_"," ").toUpperCase()+" PORTAL";
    document.getElementById("avatar").textContent=(p.full_name||"NC").split(" ").map(s=>s[0]).slice(0,2).join("").toUpperCase();
    const menus=role==="super_admin"?["Dashboard","User management","Candidates","Facilities","Recruiters","Paystubs","Login activity","Audit logs","Profile"]:role==="admin"?["Dashboard","User management","Candidates","Facilities","Recruiters","Paystubs","Profile"]:["Dashboard","My facilities","My paystubs","Profile"];
    nav.innerHTML=menus.map((m,i)=>'<a href="#" class="'+(i===0?"active":"")+'" data-menu="'+m+'"><span class="nav-icon">'+(icon[m]||"•")+'</span>'+m+'</a>').join("");
    document.getElementById("section-title").textContent=isNurse?"My facilities":"Portal overview";
    document.getElementById("section-subtitle").textContent=isNurse?"Facilities and weekly pay documents assigned to you.":"Manage your Nova Cares portal from one place.";
    const [fac,cands,docs]=await Promise.all([
      db.from("candidate_facilities").select("facility_id,facilities(name,city,state)").eq("candidate_id",p.id),
      isNurse?Promise.resolve({count:0}):db.from("profiles").select("id",{count:"exact",head:true}).eq("role","nurse"),
      db.from("paystub_documents").select("id",{count:"exact",head:true}).eq("candidate_id",p.id)
    ]);
    if(fac.error)throw fac.error;if(docs.error)throw docs.error;
    setStats([{label:isNurse?"My facilities":"Nurse accounts",value:isNurse?(fac.data?.length??0):(cands.count??0),icon:"♙",note:isNurse?"Assigned to your profile":"Visible under your permissions"},{label:"My paystubs",value:docs.count??0,icon:"▤",note:"Available documents"},{label:"Account role",value:role==="super_admin"?"Super Admin":role==="admin"?"Admin":"Nurse",icon:"◈",note:"Access-controlled account"}]);
    async function renderFacilities(){
      document.getElementById("section-title").textContent="My facilities";document.getElementById("section-subtitle").textContent="Healthcare facilities assigned to your account.";
      root.innerHTML='<div class="loading">Loading your facilities…</div>';
      const {data,error}=await db.from("candidate_facilities").select("facility_id,assigned_at,facilities(name,city,state,address)").eq("candidate_id",p.id);
      if(error)throw error;const rows=data||[];
      if(!rows.length)return empty("No facilities assigned yet","Your administrator will add your facility details when your account is set up.");
      root.innerHTML='<div class="facility-list">'+rows.map(r=>'<article class="facility-card"><h3>'+safe(r.facilities?.name||"Healthcare facility")+'</h3><p>'+safe([r.facilities?.city,r.facilities?.state].filter(Boolean).join(", ")||"Location not provided")+'</p>'+(r.facilities?.address?'<p>'+safe(r.facilities.address)+'</p>':"")+'</article>').join("")+'</div>';
    }
    async function renderPaystubs(){
      document.getElementById("section-title").textContent="My paystubs";document.getElementById("section-subtitle").textContent="View and securely download your uploaded pay documents.";
      root.innerHTML='<div class="loading">Loading your paystubs…</div>';
      const {data,error}=await db.from("paystub_documents").select("id,original_filename,storage_path,description,created_at,facilities(name,city,state),pay_periods(week_label,period_start,period_end,pay_date)").eq("candidate_id",p.id).order("created_at",{ascending:false});
      if(error)throw error;const rows=data||[];
      if(!rows.length)return empty("No paystubs available yet","Your pay documents will appear here once Nova Cares uploads them.");
      root.innerHTML='<div class="facility-list">'+rows.map((r,i)=>'<article class="facility-card"><h3>'+safe(r.original_filename)+'</h3><p>'+safe(r.facilities?.name||"Facility")+' · '+safe(r.pay_periods?.week_label||"Pay period")+'</p><p>'+safe(r.pay_periods?.period_start||"")+(r.pay_periods?.period_end?" – "+safe(r.pay_periods.period_end):"")+'</p><p>'+safe(r.description||"")+'</p><button class="download-paystub" data-path="'+safe(r.storage_path)+'" style="margin-top:12px;padding:9px 13px;border:0;border-radius:7px;background:#315f91;color:white;cursor:pointer">Download paystub</button></article>').join("")+'</div>';
      root.querySelectorAll(".download-paystub").forEach(btn=>btn.addEventListener("click",async()=>{btn.disabled=true;btn.textContent="Preparing…";try{const {data,error}=await db.storage.from("paystubs").createSignedUrl(btn.dataset.path,60);if(error)throw error;window.open(data.signedUrl,"_blank","noopener");}catch(e){showError(e);}finally{btn.disabled=false;btn.textContent="Download paystub";}}));
    }
    function renderProfile(){
      document.getElementById("section-title").textContent="My profile";document.getElementById("section-subtitle").textContent="Your account information.";
      root.innerHTML='<div class="facility-list"><article class="facility-card"><h3>Personal details</h3><p><b>Full name:</b> '+safe(p.full_name)+'</p><p><b>Email:</b> '+safe(p.email||session.user.email)+'</p><p><b>Phone:</b> '+safe(p.phone||"Not provided")+'</p></article><article class="facility-card"><h3>Portal access</h3><p><b>Login ID:</b> '+safe(p.login_id||p.email||"—")+'</p><p><b>Role:</b> '+safe(role.replace("_"," "))+'</p><p><b>Account status:</b> Active</p></article></div><p style="font-size:11px;color:#7a8998;margin-top:16px">To update your personal details, please contact your Nova Cares administrator.</p>';
    }
    async function renderDashboard(){
      document.getElementById("section-title").textContent=isNurse?"My facilities":"Portal overview";
      document.getElementById("section-subtitle").textContent=isNurse?"Facilities and weekly pay documents assigned to you.":"Manage your Nova Cares portal from one place.";
      if(isNurse)return renderFacilities();
      empty("Your management workspace is ready","Use User management to manage portal accounts. Other management sections will be enabled as their workflows are completed.");
    }
    async function navigate(name){
      nav.querySelectorAll("a").forEach(n=>n.classList.toggle("active",n.dataset.menu===name));
      document.getElementById("sidebar").classList.remove("open");
      try{
        if(name==="User management"&&(role==="super_admin"||role==="admin")){location.href="/users.html";return;}
        if(name==="My facilities"||name==="Facilities")return await renderFacilities();
        if(name==="My paystubs"||name==="Paystubs")return isNurse?await renderPaystubs():empty("Paystubs","Paystub management will be available here.");
        if(name==="Profile")return renderProfile();
        if(name==="Dashboard")return await renderDashboard();
        document.getElementById("section-title").textContent=name;empty(name+" module","This management workflow is not available yet.");
      }catch(e){showError(e);}
    }
    nav.querySelectorAll("a").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();navigate(a.dataset.menu);}));
    document.getElementById("logout").addEventListener("click",async()=>{await db.auth.signOut();location.replace("/");});
    await renderDashboard();
  })().catch(e=>{root.innerHTML='<div class="error-box">'+safe(e.message||"Unable to load portal data.")+'</div>';});
})();
