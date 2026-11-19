(() => {
  const cfg=window.NOVA_CONFIG||{},notice=document.getElementById("notice"),body=document.getElementById("users-body"),modal=document.getElementById("create-modal"),form=document.getElementById("create-form"),roleSelect=document.getElementById("account-role");
  let db,currentUser;
  const show=(message,type="success")=>{notice.textContent=message;notice.className="user-alert show "+type;},hide=()=>{notice.textContent="";notice.className="user-alert";};
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  document.getElementById("today").textContent=new Intl.DateTimeFormat(undefined,{weekday:"short",month:"short",day:"numeric",year:"numeric"}).format(new Date());
  document.getElementById("menu-toggle").addEventListener("click",()=>document.getElementById("sidebar").classList.toggle("open"));
  const close=()=>{modal.hidden=true;form.reset();document.getElementById("modal-title").textContent="Create a portal user";document.getElementById("submit-create").textContent="Create account";document.getElementById("password-field").hidden=false;document.getElementById("role-field").hidden=currentUser?.role==="admin";roleSelect.disabled=false;if(currentUser?.role==="admin")roleSelect.value="nurse";};
  document.getElementById("open-create").addEventListener("click",()=>{hide();close();modal.hidden=false;});
  document.getElementById("close-create").addEventListener("click",close);document.getElementById("cancel-create").addEventListener("click",close);modal.addEventListener("click",e=>{if(e.target===modal)close();});
  const getToken=async()=>{const {data,error}=await db.auth.refreshSession();if(error||!data.session?.access_token)throw new Error("Your session expired. Please sign in again.");return data.session.access_token;};
  const manage=async payload=>{const token=await getToken();const {data,error}=await db.functions.invoke("manage-user",{body:payload,headers:{Authorization:"Bearer "+token}});if(error){let message=data?.error||error.message;try{const response=error.context;if(response?.json){const detail=await response.clone().json();message=detail.error||message;}}catch(_){}throw new Error(message);}if(data?.error)throw new Error(data.error);return data;};
  async function loadUsers(){
    body.innerHTML='<tr><td colspan="6" class="table-empty">Loading users…</td></tr>';
    let query=db.from("profiles").select("id,full_name,email,login_id,phone,role,is_active,created_at").order("created_at",{ascending:false});
    if(currentUser.role==="admin")query=query.eq("role","nurse");
    const {data,error}=await query;if(error)throw error;
    document.getElementById("user-count").textContent=(data.length||0)+(currentUser.role==="admin"?" nurse accounts":" accounts");
    if(!data.length){body.innerHTML='<tr><td colspan="6" class="table-empty">No accounts found yet.</td></tr>';return;}
    body.innerHTML=data.map(u=>`<tr><td>${esc(u.full_name)}</td><td>${esc(u.email||u.login_id)}</td><td><span class="role-pill">${esc(u.role.replace("_"," "))}</span></td><td><span class="status-pill ${u.is_active?"active":"inactive"}">${u.is_active?"Active":"Deleted / Disabled"}</span></td><td>${u.created_at?new Date(u.created_at).toLocaleDateString():"—"}</td><td>${u.id===currentUser.id?'<span class="security-hint">Current account</span>':u.is_active?`<button class="row-action" data-action="edit" data-id="${esc(u.id)}">Edit</button> <button class="row-action" data-action="password" data-id="${esc(u.id)}">Password</button> <button class="row-action" data-action="delete" data-id="${esc(u.id)}">Delete</button>`:'<span class="security-hint">Access disabled</span>'}</td></tr>`).join("");
    body.querySelectorAll("button[data-action]").forEach(btn=>btn.addEventListener("click",async()=>{
      const user=data.find(x=>x.id===btn.dataset.id);if(!user)return;
      if(btn.dataset.action==="edit"){hide();form.elements.full_name.value=user.full_name||"";form.elements.email.value=user.email||user.login_id||"";form.elements.phone.value=user.phone||"";form.elements.password.value="";roleSelect.value=user.role;roleSelect.disabled=true;document.getElementById("password-field").hidden=true;document.getElementById("role-field").hidden=true;document.getElementById("modal-title").textContent="Edit account details";document.getElementById("submit-create").textContent="Save changes";form.dataset.editId=user.id;modal.hidden=false;return;}
      if(btn.dataset.action==="password"){const next=prompt("Enter the new password (minimum 8 characters) for "+user.full_name+":");if(next===null)return;if(next.length<8||next.length>72){show("Password must be between 8 and 72 characters.","error");return;}if(!confirm("Change this user's password now?"))return;btn.disabled=true;try{await manage({action:"set_password",user_id:user.id,password:next});show("Password updated. The user can sign in with the new password.");}catch(e){show(e.message,"error");}finally{btn.disabled=false;}return;}
      if(btn.dataset.action==="delete"){if(!confirm("Delete access for "+user.full_name+"? They will no longer be able to sign in. Payroll history and audit records will be retained."))return;btn.disabled=true;try{await manage({action:"delete",user_id:user.id});show("Account access deleted. Historical records have been retained.");await loadUsers();}catch(e){show(e.message,"error");btn.disabled=false;}}
    }));
  }
  form.addEventListener("submit",async e=>{
    e.preventDefault();hide();const submit=document.getElementById("submit-create");submit.disabled=true;submit.textContent=form.dataset.editId?"Saving…":"Creating account…";
    const values=Object.fromEntries(new FormData(form).entries());
    try{
      if(form.dataset.editId){await manage({action:"update_profile",user_id:form.dataset.editId,full_name:values.full_name,email:values.email,phone:values.phone});delete form.dataset.editId;close();show("Account details updated.");await loadUsers();return;}
      if(currentUser?.role==="admin")values.role="nurse";
      const token=await getToken();const {data,error}=await db.functions.invoke("admin-create-user",{body:values,headers:{Authorization:"Bearer "+token}});
      if(error){let detail=data?.error||error.message||"Unable to create account.";try{if(error.context?.json){const payload=await error.context.clone().json();detail=payload.error||detail;}}catch(_){}throw new Error(detail);}
      if(data?.error)throw new Error(data.error);
      close();show("Account created successfully. User can sign in immediately using the password you set.");await loadUsers();
    }catch(error){show(error.message||"Unable to save account.","error");}
    finally{submit.disabled=false;submit.textContent=form.dataset.editId?"Save changes":"Create account";}
  });
  (async()=>{
    if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||!window.supabase){show("Supabase configuration is missing.","error");return;}
    db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
    const {data:{session}}=await db.auth.getSession();if(!session){location.replace("/");return;}
    const {data:user}=await db.from("profiles").select("id,full_name,role,is_active").eq("id",session.user.id).single();
    if(!user||!user.is_active||!["super_admin","admin"].includes(user.role)){location.replace("/dashboard.html");return;}
    currentUser=user;document.getElementById("avatar").textContent=(user.full_name||"NC").split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase();
    if(user.role==="admin"){document.getElementById("workspace-label").textContent="ADMIN WORKSPACE";document.getElementById("page-description").textContent="Create and manage Nurse / Employee accounts.";document.getElementById("list-title").textContent="Nurse accounts";document.getElementById("role-field").hidden=true;roleSelect.value="nurse";}
    await loadUsers();
  })().catch(error=>{body.innerHTML='<tr><td colspan="6" class="table-empty">'+esc(error.message||"Unable to load users.")+'</td></tr>';});
  document.getElementById("logout").addEventListener("click",async()=>{if(db)await db.auth.signOut();location.replace("/");});
})();