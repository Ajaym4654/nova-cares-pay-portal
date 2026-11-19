(() => {
  const cfg=window.NOVA_CONFIG||{};
  const notice=document.getElementById("notice");
  const body=document.getElementById("users-body");
  const modal=document.getElementById("create-modal");
  const form=document.getElementById("create-form");
  let db, currentUser;
  const show=(message,type="success")=>{notice.textContent=message;notice.className="user-alert show "+type;};
  const hide=()=>{notice.textContent="";notice.className="user-alert";};
  const esc=(v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  document.getElementById("today").textContent=new Intl.DateTimeFormat(undefined,{weekday:"short",month:"short",day:"numeric",year:"numeric"}).format(new Date());
  document.getElementById("menu-toggle").addEventListener("click",()=>document.getElementById("sidebar").classList.toggle("open"));
  const close=()=>{modal.hidden=true;form.reset();};
  document.getElementById("open-create").addEventListener("click",()=>{hide();modal.hidden=false;});
  document.getElementById("close-create").addEventListener("click",close);
  document.getElementById("cancel-create").addEventListener("click",close);
  modal.addEventListener("click",e=>{if(e.target===modal)close();});

  async function loadUsers(){
    body.innerHTML='<tr><td colspan="6" class="table-empty">Loading users…</td></tr>';
    const {data,error}=await db.from("profiles").select("id,full_name,email,login_id,role,is_active,created_at").order("created_at",{ascending:false});
    if(error) throw error;
    document.getElementById("user-count").textContent=(data.length||0)+" accounts";
    if(!data.length){body.innerHTML='<tr><td colspan="6" class="table-empty">No user accounts found.</td></tr>';return;}
    body.innerHTML=data.map(u=>`<tr><td>${esc(u.full_name)}</td><td>${esc(u.email||u.login_id)}</td><td><span class="role-pill">${esc(u.role.replace("_"," "))}</span></td><td><span class="status-pill ${u.is_active?"active":"inactive"}">${u.is_active?"Active":"Inactive"}</span></td><td>${u.created_at?new Date(u.created_at).toLocaleDateString():"—"}</td><td>${u.id===currentUser.id?'<span class="security-hint">Current account</span>':`<button class="row-action ${u.is_active?"":"restore"}" data-id="${esc(u.id)}" data-active="${u.is_active}">${u.is_active?"Deactivate":"Reactivate"}</button>`}</td></tr>`).join("");
    body.querySelectorAll("button[data-id]").forEach(btn=>btn.addEventListener("click",async()=>{
      const next=btn.dataset.active!=="true";
      if(!confirm((next?"Reactivate":"Deactivate")+" this account?"))return;
      btn.disabled=true;
      const {error}=await db.from("profiles").update({is_active:next}).eq("id",btn.dataset.id);
      if(error){show(error.message,"error");btn.disabled=false;return;}
      show(next?"Account access restored.":"Account deactivated. Existing records are retained.");
      await loadUsers();
    }));
  }

  form.addEventListener("submit",async e=>{
    e.preventDefault();hide();
    const submit=document.getElementById("submit-create");
    submit.disabled=true;submit.textContent="Creating account…";
    const values=Object.fromEntries(new FormData(form).entries());
    try{
      // Refresh the signed-in session and explicitly pass its fresh access token.
      const {data: refreshed,error: refreshError}=await db.auth.refreshSession();
      const freshSession=refreshed?.session;
      if(refreshError||!freshSession?.access_token){
        throw new Error("Your login session expired. Please sign out and sign in again.");
      }
      const {data,error}=await db.functions.invoke("admin-create-user",{
        body:values,
        headers:{Authorization:"Bearer "+freshSession.access_token}
      });
      if(error){
        let detail=data?.details||data?.error||error.message||"Unable to create account.";
        try{
          const response=error.context;
          if(response&&typeof response.json==="function"){
            const payload=await response.clone().json();
            detail=payload.details||payload.error||detail;
          }
        }catch(_){}
        throw new Error(detail);
      }
      if(data?.error)throw new Error(data.details||data.error);
      close();show(data?.message||"Account created successfully. No invitation email was sent.");await loadUsers();
    }catch(error){show(error.message||"Unable to create account.","error");}
    finally{submit.disabled=false;submit.textContent="Create account";}
  });

  (async()=>{
    if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||!window.supabase){show("Supabase configuration is missing.","error");return;}
    db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
    const {data:{session}}=await db.auth.getSession();
    if(!session){location.replace("/");return;}
    const {data:user}=await db.from("profiles").select("id,full_name,role,is_active").eq("id",session.user.id).single();
    if(!user||!user.is_active||user.role!=="super_admin"){location.replace("/dashboard.html");return;}
    currentUser=user;
    document.getElementById("avatar").textContent=(user.full_name||"NC").split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase();
    await loadUsers();
  })().catch(error=>{body.innerHTML='<tr><td colspan="6" class="table-empty">'+esc(error.message||"Unable to load users.")+'</td></tr>';});
  document.getElementById("logout").addEventListener("click",async()=>{if(db)await db.auth.signOut();location.replace("/");});
})();