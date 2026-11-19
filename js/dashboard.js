(() => {
  const cfg = window.NOVA_CONFIG || {};
  const root = document.getElementById("main-content");
  const nav = document.getElementById("navigation");
  const clientReady = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase;
  const icon = {Dashboard:"⌂",Candidates:"♙",Facilities:"▦",Paystubs:"▤",Recruiters:"♧","Login activity":"◷","Audit logs":"◫",Profile:"◎"};
  const setStats = (items) => document.getElementById("stats").innerHTML = items.map(x => `<article class="stat-card"><div class="stat-top"><span>${x.label}</span><span class="stat-icon">${x.icon}</span></div><div class="stat-value">${x.value}</div><div class="stat-note">${x.note}</div></article>`).join("");
  const empty = (title, text) => root.innerHTML = `<div class="empty-state"><div class="empty-icon">▤</div><b>${title}</b><p>${text}</p></div>`;
  document.getElementById("today").textContent = new Intl.DateTimeFormat(undefined,{weekday:"short",month:"short",day:"numeric",year:"numeric"}).format(new Date());
  document.getElementById("menu-toggle").addEventListener("click",()=>document.getElementById("sidebar").classList.toggle("open"));

  if (!clientReady) {
    document.getElementById("greeting").textContent = "Portal setup required";
    setStats([{label:"Account status",value:"Pending",icon:"◷",note:"Connect Supabase to continue"},{label:"Documents",value:"—",icon:"▤",note:"Not loaded"},{label:"Facilities",value:"—",icon:"▦",note:"Not loaded"}]);
    root.innerHTML = '<div class="error-box">Supabase is not configured yet. Add the project URL and anon key in js/config.js after the database migrations and security policies have been applied.</div>';
    return;
  }
  const db = window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  (async()=>{
    const {data:{session}} = await db.auth.getSession();
    if(!session){location.replace("/");return;}
    const {data:p,error} = await db.from("profiles").select("id,full_name,role,is_active,must_change_password,recruiter_id").eq("id",session.user.id).single();
    if(error||!p||!p.is_active){await db.auth.signOut();location.replace("/");return;}
    if(p.must_change_password){location.replace("/change-password.html");return;}
    const role=p.role;
    document.getElementById("greeting").textContent="Welcome back, "+(p.full_name||"there");
    document.getElementById("role-label").textContent=role.replace("_"," ").toUpperCase()+" PORTAL";
    const menus=role==="super_admin"?["Dashboard","Candidates","Facilities","Recruiters","Paystubs","Login activity","Audit logs","Profile"]:role==="admin"?["Dashboard","Candidates","Facilities","Recruiters","Paystubs","Profile"]:["Dashboard","My facilities","My paystubs","Profile"];
    nav.innerHTML=menus.map((m,i)=>`<a href="#" class="${i===0?"active":""}" data-menu="${m}"><span class="nav-icon">${icon[m]||"•"}</span>${m}</a>`).join("");
    document.getElementById("section-title").textContent=role==="nurse"?"My facilities":"Portal overview";
    document.getElementById("section-subtitle").textContent=role==="nurse"?"Facilities and weekly pay documents assigned to you.":"Manage your Nova Cares portal from one place.";
    document.getElementById("avatar").textContent=(p.full_name||"NC").split(" ").map(s=>s[0]).slice(0,2).join("").toUpperCase();
    const [fac,cands,docs]=await Promise.all([
      db.from("candidate_facilities").select("facility_id,facilities(name,city,state)").eq("candidate_id",role==="nurse"?p.id:"00000000-0000-0000-0000-000000000000"),
      role==="nurse"?Promise.resolve({count:0}):db.from("profiles").select("id",{count:"exact",head:true}).eq("role","nurse"),
      db.from("paystub_documents").select("id",{count:"exact",head:true})
    ]);
    setStats([{label:role==="nurse"?"My facilities":"Candidate accounts",value:role==="nurse"?(fac.data?.length??0):(cands.count??0),icon:"♙",note:role==="nurse"?"Assigned to your profile":"Visible under your permissions"},{label:"Paystub documents",value:docs.count??0,icon:"▤",note:"Available records"},{label:"Account role",value:role==="super_admin"?"Super Admin":role==="admin"?"Admin":"Nurse",icon:"◈",note:"Access-controlled account"}]);
    if(role==="nurse"){
      const rows=fac.data||[];
      if(!rows.length)return empty("No facilities assigned yet","Your administrator will add your facility details when your account is set up.");
      root.innerHTML='<div class="facility-list">'+rows.map(r=>`<article class="facility-card"><h3>${r.facilities?.name||"Healthcare facility"}</h3><p>${[r.facilities?.city,r.facilities?.state].filter(Boolean).join(", ")||"Facility location not provided"}</p></article>`).join("")+'</div>';
    }else{
      empty("Your management workspace is ready","Candidate, facility, recruiter and document management modules are being connected in the next development milestone.");
    }
    nav.querySelectorAll("a").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();nav.querySelectorAll("a").forEach(n=>n.classList.remove("active"));a.classList.add("active");document.getElementById("section-title").textContent=a.dataset.menu;empty(a.dataset.menu+" module","This section will be enabled as its management workflow is implemented.");}));
  })().catch(e=>{root.innerHTML='<div class="error-box">'+(e.message||"Unable to load portal data.")+'</div>';});
  document.getElementById("logout").addEventListener("click",async()=>{await db.auth.signOut();location.replace("/");});
})();
