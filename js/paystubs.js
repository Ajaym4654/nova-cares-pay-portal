(() => {
const cfg=window.NOVA_CONFIG||{},notice=document.getElementById("notice"),form=document.getElementById("upload-form"),nurseSelect=document.getElementById("nurse"),fileInput=document.getElementById("paystub-file"),uploadButton=document.getElementById("upload-button");
let db,actor,nurses=[],editingRecord=null;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const show=(message,type="success")=>{notice.textContent=message;notice.className="user-alert show "+type;};
const hide=()=>{notice.textContent="";notice.className="user-alert";};
const setOptions=(el,items,placeholder)=>{el.innerHTML='<option value="">'+placeholder+'</option>'+items.map(x=>'<option value="'+esc(x.value)+'">'+esc(x.label)+'</option>').join("");};
const safeName=name=>name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").slice(-100)||"paystub.pdf";
async function loadRecent(){
const selectedNurseId=new URLSearchParams(location.search).get("nurse");
let query=db.from("paystub_documents").select("id,candidate_id,pay_period_id,original_filename,storage_path,description,created_at,pay_periods(week_label,period_start,period_end,pay_date),profiles:profiles!paystub_documents_candidate_id_fkey(full_name)").order("created_at",{ascending:false});
if(selectedNurseId)query=query.eq("candidate_id",selectedNurseId);
const {data,error}=await query.limit(100);
if(error)throw error;const list=document.getElementById("recent-list");
if(!data?.length){list.innerHTML='<div class="recent-empty">No paystubs uploaded yet. Your uploaded weekly documents will appear here.</div>';return;}
list.innerHTML=data.map(r=>'<article class="recent-item"><strong>'+esc(r.profiles?.full_name||"Nurse account")+' · '+esc(r.original_filename)+'</strong><span>'+esc(r.pay_periods?.week_label||"Pay period")+' · Uploaded '+new Date(r.created_at).toLocaleDateString()+'</span><div class="paystub-actions"><button type="button" data-preview-path="'+esc(r.storage_path)+'">Preview</button><button type="button" data-download-path="'+esc(r.storage_path)+'">Download PDF</button><button type="button" class="manage-paystub-btn" data-edit-id="'+esc(r.id)+'">Edit / Replace</button><button type="button" class="delete-paystub-btn" data-delete-id="'+esc(r.id)+'">Delete</button></div></article>').join("");
list.querySelectorAll("button[data-edit-id]").forEach(btn=>btn.addEventListener("click",()=>{const row=data.find(x=>x.id===btn.dataset.editId);if(!row)return;editingRecord=row;const period=row.pay_periods||{};document.getElementById("edit-paystub-id").value=row.id;document.getElementById("edit-week-start").value=period.period_start||"";document.getElementById("edit-week-end").value=period.period_end||"";document.getElementById("edit-pay-date").value=period.pay_date||"";document.getElementById("edit-description").value=row.description||"";document.getElementById("edit-file").value="";document.getElementById("edit-current-file").textContent="Current file: "+row.original_filename;document.getElementById("edit-modal").hidden=false;}));
list.querySelectorAll("button[data-delete-id]").forEach(btn=>btn.addEventListener("click",async()=>{const row=data.find(x=>x.id===btn.dataset.deleteId);if(!row||!confirm("Permanently delete this paystub for "+(row.profiles?.full_name||"this nurse")+"? This cannot be undone."))return;btn.disabled=true;try{const {error:deleteError}=await db.from("paystub_documents").delete().eq("id",row.id);if(deleteError)throw deleteError;const {error:storageError}=await db.storage.from("paystubs").remove([row.storage_path]);if(storageError)show("Paystub record deleted, but the stored PDF could not be removed: "+storageError.message,"error");else show("Paystub deleted successfully.");if(row.pay_periods){const {error:periodError}=await db.from("pay_periods").delete().eq("id",row.pay_period_id);if(periodError)console.warn("Unused pay period cleanup skipped:",periodError.message);}await loadRecent();}catch(e){show(e.message||"Unable to delete paystub.","error");btn.disabled=false;}}));
list.querySelectorAll("button[data-preview-path],button[data-download-path]").forEach(btn=>btn.addEventListener("click",async()=>{btn.disabled=true;const preview=btn.hasAttribute("data-preview-path"),path=preview?btn.dataset.previewPath:btn.dataset.downloadPath;const tab=window.open("about:blank","_blank");try{const {data,error}=await db.storage.from("paystubs").createSignedUrl(path,60,preview?{}:{download:true});if(error)throw error;if(tab)tab.location.href=data.signedUrl;else show("Please allow pop-ups to open the PDF.","error");}catch(e){if(tab)tab.close();show(e.message,"error");}finally{btn.disabled=false;}}));
}
async function loadNurses(){
const {data:people,error:peopleError}=await db.from("profiles").select("id,full_name,email").eq("role","nurse").eq("is_active",true).order("full_name");
if(peopleError)throw peopleError;
nurses=people||[];
setOptions(nurseSelect,nurses.map(n=>({value:n.id,label:n.full_name+" · "+(n.email||"")})),"Choose a nurse");
if(!nurses.length)nurseSelect.innerHTML='<option value="">No active nurse accounts found</option>';
const selectedId=new URLSearchParams(location.search).get("nurse");
if(selectedId){const selected=nurses.find(n=>n.id===selectedId);if(selected){nurseSelect.value=selectedId;document.querySelector(".history-card h2").textContent=selected.full_name+" · Paystubs";document.querySelector(".history-card .pay-card-head p").textContent="All uploaded pay documents for this nurse.";document.querySelector(".page-heading h1").textContent=selected.full_name+" · Paystubs";document.querySelector(".page-heading p").textContent="Review and download this nurse’s weekly pay documents.";}}
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
const editModal=document.getElementById("edit-modal"),editForm=document.getElementById("edit-paystub-form");const closeEdit=()=>{editModal.hidden=true;editingRecord=null;editForm.reset();};document.getElementById("close-edit").addEventListener("click",closeEdit);document.getElementById("cancel-edit").addEventListener("click",closeEdit);editModal.addEventListener("click",e=>{if(e.target===editModal)closeEdit();});editForm.addEventListener("submit",async e=>{e.preventDefault();if(!editingRecord)return;const save=document.getElementById("save-edit-paystub"),start=document.getElementById("edit-week-start").value,end=document.getElementById("edit-week-end").value,payDate=document.getElementById("edit-pay-date").value,description=document.getElementById("edit-description").value.trim(),replacement=document.getElementById("edit-file").files?.[0];if(!start||!end||start>end){show("Enter a valid pay period date range.","error");return;}if(replacement&&(replacement.type!=="application/pdf"&&!replacement.name.toLowerCase().endsWith(".pdf")||replacement.size>20*1024*1024)){show("Replacement must be a PDF up to 20 MB.","error");return;}save.disabled=true;save.textContent="Saving changes…";let newPath=null;try{const periodId=editingRecord.pay_period_id;const {error:periodError}=await db.from("pay_periods").update({week_label:start+" to "+end,period_start:start,period_end:end,pay_date:payDate||null}).eq("id",periodId);if(periodError)throw periodError;const changes={description:description||null};if(replacement){newPath=editingRecord.candidate_id+"/"+periodId+"/"+Date.now()+"-"+safeName(replacement.name);const {error:uploadError}=await db.storage.from("paystubs").upload(newPath,replacement,{contentType:"application/pdf",upsert:false});if(uploadError)throw uploadError;changes.storage_path=newPath;changes.original_filename=replacement.name;changes.mime_type="application/pdf";changes.file_size_bytes=replacement.size;}const {error:updateError}=await db.from("paystub_documents").update(changes).eq("id",editingRecord.id);if(updateError){if(newPath)await db.storage.from("paystubs").remove([newPath]);throw updateError;}if(newPath){const {error:oldRemoveError}=await db.storage.from("paystubs").remove([editingRecord.storage_path]);if(oldRemoveError)show("Paystub updated, but the previous PDF could not be removed: "+oldRemoveError.message,"error");else show("Paystub details and PDF updated successfully.");}else show("Paystub details updated successfully.");closeEdit();await loadRecent();}catch(err){show(err.message||"Unable to update paystub.","error");}finally{save.disabled=false;save.textContent="Save changes";}});
document.getElementById("today").textContent=new Intl.DateTimeFormat(undefined,{weekday:"short",month:"short",day:"numeric",year:"numeric"}).format(new Date());
document.getElementById("menu-toggle").addEventListener("click",()=>document.getElementById("sidebar").classList.toggle("open"));
(async()=>{
if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||!window.supabase)throw new Error("Supabase configuration is missing.");
db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
const {data:{session}}=await db.auth.getSession();if(!session){location.replace("/");return;}
const {data:user,error}=await db.from("profiles").select("id,full_name,role,is_active,avatar_url").eq("id",session.user.id).single();
if(error||!user?.is_active||!["admin","super_admin"].includes(user.role)){location.replace("/dashboard.html");return;}
actor=user;const avatar=document.getElementById("avatar");avatar.innerHTML=user.avatar_url?'<img src="'+esc(user.avatar_url)+'" alt="Profile photo">':(user.full_name||"NC").split(" ").map(s=>s[0]).slice(0,2).join("").toUpperCase();
await Promise.all([loadNurses(),loadRecent()]);
})().catch(e=>{show(e.message||"Unable to load paystub management.","error");document.getElementById("recent-list").innerHTML='<div class="recent-empty">Paystub data could not be loaded. Refresh the page and try again.</div>';});
document.getElementById("logout").addEventListener("click",async()=>{if(db)await db.auth.signOut();location.replace("/");});
})();