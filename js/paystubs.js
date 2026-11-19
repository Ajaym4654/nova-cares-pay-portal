(() => {
const cfg=window.NOVA_CONFIG||{},notice=document.getElementById("notice"),form=document.getElementById("upload-form"),nurseSelect=document.getElementById("nurse"),fileInput=document.getElementById("paystub-file"),uploadButton=document.getElementById("upload-button");
let db,actor,nurses=[];
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const show=(message,type="success")=>{notice.textContent=message;notice.className="user-alert show "+type;};
const hide=()=>{notice.textContent="";notice.className="user-alert";};
const setOptions=(el,items,placeholder)=>{el.innerHTML='<option value="">'+placeholder+'</option>'+items.map(x=>'<option value="'+esc(x.value)+'">'+esc(x.label)+'</option>').join("");};
const safeName=name=>name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").slice(-100)||"paystub.pdf";
async function loadRecent(){
const {data,error}=await db.from("paystub_documents").select("id,candidate_id,original_filename,storage_path,created_at,pay_periods(week_label,period_start,period_end),profiles:profiles!paystub_documents_candidate_id_fkey(full_name)").order("created_at",{ascending:false}).limit(12);
if(error)throw error;const list=document.getElementById("recent-list");
if(!data?.length){list.innerHTML='<div class="recent-empty">No paystubs uploaded yet. Your uploaded weekly documents will appear here.</div>';return;}
list.innerHTML=data.map(r=>'<article class="recent-item"><strong>'+esc(r.profiles?.full_name||"Nurse account")+' · '+esc(r.original_filename)+'</strong><span>'+esc(r.pay_periods?.week_label||"Pay period")+' · Uploaded '+new Date(r.created_at).toLocaleDateString()+'</span><button type="button" data-path="'+esc(r.storage_path)+'">Download PDF</button></article>').join("");
list.querySelectorAll("button[data-path]").forEach(btn=>btn.addEventListener("click",async()=>{btn.disabled=true;try{const {data,error}=await db.storage.from("paystubs").createSignedUrl(btn.dataset.path,60);if(error)throw error;window.open(data.signedUrl,"_blank","noopener");}catch(e){show(e.message,"error");}finally{btn.disabled=false;}}));
}
async function loadNurses(){
const {data:people,error:peopleError}=await db.from("profiles").select("id,full_name,email").eq("role","nurse").eq("is_active",true).order("full_name");
if(peopleError)throw peopleError;
nurses=people||[];
setOptions(nurseSelect,nurses.map(n=>({value:n.id,label:n.full_name+" · "+(n.email||"")})),"Choose a nurse");
if(!nurses.length)nurseSelect.innerHTML='<option value="">No active nurse accounts found</option>';
}

form.addEventListener("submit",async e=>{
e.preventDefault();hide();
const nurseId=nurseSelect.value,start=document.getElementById("period-start").value,end=document.getElementById("period-end").value,payDate=document.getElementById("pay-date").value,file=fileInput.files?.[0],description=document.getElementById("description").value.trim();
if(!nurseId||!start||!end||!file){show("Please complete all required fields.","error");return;}
if(start>end){show("Week end must be on or after week start.","error");return;}
if(file.type!=="application/pdf"&&!file.name.toLowerCase().endsWith(".pdf")){show("Please select a PDF file.","error");return;}
if(file.size>20*1024*1024){show("File is larger than 20 MB. Please choose a smaller PDF.","error");return;}
const weekLabel=start+" to "+end,periodStart=start,periodEnd=end;
uploadButton.disabled=true;uploadButton.textContent="Uploading securely…";
let storagePath=null;
try{
const {data:existingPeriod,error:periodCheckError}=await db.from("pay_periods").select("id").eq("candidate_id",nurseId).eq("week_label",weekLabel).maybeSingle();
if(periodCheckError)throw periodCheckError;
let periodId=existingPeriod?.id;
if(periodId){const {data:existingDoc,error:docCheckError}=await db.from("paystub_documents").select("id").eq("pay_period_id",periodId).maybeSingle();if(docCheckError)throw docCheckError;if(existingDoc)throw new Error("A paystub is already uploaded for this nurse and week.");}
else{const {data:newPeriod,error:newPeriodError}=await db.from("pay_periods").insert({candidate_id:nurseId,week_label:weekLabel,period_start:periodStart,period_end:periodEnd,pay_date:payDate||null,created_by:actor.id}).select("id").single();if(newPeriodError)throw newPeriodError;periodId=newPeriod.id;}
const fileName=Date.now()+"-"+safeName(file.name);storagePath=nurseId+"/"+periodId+"/"+fileName;
const {error:storageError}=await db.storage.from("paystubs").upload(storagePath,file,{contentType:"application/pdf",upsert:false});
if(storageError)throw storageError;
const {error:recordError}=await db.from("paystub_documents").insert({pay_period_id:periodId,candidate_id:nurseId,original_filename:file.name,mime_type:"application/pdf",file_size_bytes:file.size,storage_path:storagePath,description:description||null,uploaded_by:actor.id});
if(recordError){await db.storage.from("paystubs").remove([storagePath]);throw recordError;}
show("Paystub uploaded successfully. It is now available only in the selected nurse's account.");
form.reset();await loadRecent();
}catch(err){show(err.message||"Unable to upload paystub.","error");}
finally{uploadButton.disabled=false;uploadButton.textContent="Upload paystub";}
});
document.getElementById("today").textContent=new Intl.DateTimeFormat(undefined,{weekday:"short",month:"short",day:"numeric",year:"numeric"}).format(new Date());
document.getElementById("menu-toggle").addEventListener("click",()=>document.getElementById("sidebar").classList.toggle("open"));
(async()=>{
if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||!window.supabase)throw new Error("Supabase configuration is missing.");
db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
const {data:{session}}=await db.auth.getSession();if(!session){location.replace("/");return;}
const {data:user,error}=await db.from("profiles").select("id,full_name,role,is_active").eq("id",session.user.id).single();
if(error||!user?.is_active||!["admin","super_admin"].includes(user.role)){location.replace("/dashboard.html");return;}
actor=user;document.getElementById("avatar").textContent=(user.full_name||"NC").split(" ").map(s=>s[0]).slice(0,2).join("").toUpperCase();
await Promise.all([loadNurses(),loadRecent()]);
})().catch(e=>{show(e.message||"Unable to load paystub management.","error");document.getElementById("recent-list").innerHTML='<div class="recent-empty">Paystub data could not be loaded. Refresh the page and try again.</div>';});
document.getElementById("logout").addEventListener("click",async()=>{if(db)await db.auth.signOut();location.replace("/");});
})();