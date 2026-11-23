import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"https://payrollnovacarestaffing.netlify.app","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Max-Age":"86400"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply({error:"Method not allowed."},405);
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key)return reply({error:"Server configuration is incomplete."},500);
 const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
 if(!token)return reply({error:"Authentication required."},401);
 const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:auth,error:authErr}=await db.auth.getUser(token);
 if(authErr||!auth.user)return reply({error:"Session expired. Sign in again."},401);
 const {data:actor,error:actorErr}=await db.from("profiles").select("id,role,is_active").eq("id",auth.user.id).maybeSingle();
 if(actorErr||!actor?.is_active)return reply({error:"Active account required."},403);
 let input:{action?:string;user_id?:string;full_name?:string;email?:string;phone?:string;password?:string;job_title?:string;avatar_url?:string};

 try{input=await req.json();}catch{return reply({error:"Invalid request."},400);}
 if(input.action==="record_login"){
  if(!actor?.is_active)return reply({error:"Active account required."},403);
  const {error}=await db.from("login_activity").insert({user_id:auth.user.id,event_type:"login_success",user_agent:req.headers.get("user-agent")||null});
  if(error)return reply({error:"Could not record login activity: "+error.message},500);
  return reply({success:true});
 }
 if(input.action!=="record_login"&&!["admin","super_admin"].includes(actor.role))return reply({error:"Administrator access required."},403);
 if(input.action==="self_update_profile"){
  const full_name=String(input.full_name||"").trim(),phone=String(input.phone||"").trim(),avatar_url=String(input.avatar_url||"").trim()||null;
  if(!full_name||full_name.length>120||phone.length>30)return reply({error:"Enter a valid name and phone number."},400);
  const {error}=await db.from("profiles").update({full_name,phone:phone||null,avatar_url,updated_at:new Date().toISOString()}).eq("id",actor.id);
  if(error)return reply({error:error.message},400);
  await db.auth.admin.updateUserById(actor.id,{user_metadata:{...auth.user.user_metadata,full_name}});
  return reply({success:true});
 }
 if(!input.user_id)return reply({error:"User ID is required."},400);
 const {data:target,error:targetErr}=await db.from("profiles").select("id,role,is_active,email,login_id").eq("id",input.user_id).maybeSingle();
 if(targetErr||!target)return reply({error:"Account not found."},404);
 const protectedEmail="ajaym4654@gmail.com";
 if(["delete","set_password","update_profile","promote_to_super_admin"].includes(input.action)){
  const {data:targetAuth}=await db.auth.admin.getUserById(target.id);
  const targetEmails=[target.email,target.login_id,targetAuth?.user?.email].map(value=>String(value||"").trim().toLowerCase());
  if(targetEmails.includes(protectedEmail))return reply({error:"This Primary Super Admin account is protected. Other administrators cannot delete it, change its password, or modify its account."},403);
 }
 if(actor.role==="admin"&&target.role!=="nurse")return reply({error:"Admins can manage Nurse / Employee accounts only."},403);
 if(actor.role==="super_admin"&&!["admin","nurse"].includes(target.role))return reply({error:"This account cannot be managed here."},403);
 if(target.id===actor.id)return reply({error:"You cannot modify your own administrator account here."},403);
 if(input.action==="promote_to_super_admin"){
  if(actor.role!=="super_admin")return reply({error:"Only a Super Admin can promote another account."},403);
  if(!target.is_active||target.role!=="admin")return reply({error:"Only an active Admin account can be promoted."},400);
  const {error}=await db.from("profiles").update({role:"super_admin",updated_at:new Date().toISOString()}).eq("id",target.id);
  if(error)return reply({error:error.message},400);
  await db.from("audit_logs").insert({actor_id:actor.id,action:"admin_promoted_to_super_admin",entity_type:"profile",entity_id:target.id,details:{previous_role:"admin",new_role:"super_admin"}});
  return reply({success:true,role:"super_admin"});
 }
 if(input.action==="set_password"){
  const password=String(input.password||"");
  if(password.length<8||password.length>72)return reply({error:"Password must be between 8 and 72 characters."},400);
  const {error}=await db.auth.admin.updateUserById(target.id,{password});
  if(error)return reply({error:error.message},400);
  await db.from("audit_logs").insert({actor_id:actor.id,action:"user_password_changed",entity_type:"profile",entity_id:target.id,details:{}});
  return reply({success:true});
 }
 if(input.action==="update_profile"){
  const full_name=String(input.full_name||"").trim(),email=String(input.email||"").trim().toLowerCase(),phone=String(input.phone||"").trim(),job_title=String(input.job_title||"").trim().slice(0,40)||null;
  if(!full_name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply({error:"Enter a valid name and email address."},400);
  const {data:old}=await db.from("profiles").select("full_name,email").eq("id",target.id).single();
  const {error:authUpdate}=await db.auth.admin.updateUserById(target.id,{email,email_confirm:true,user_metadata:{full_name}});
  if(authUpdate)return reply({error:authUpdate.message},400);
  const {error:profileUpdate}=await db.from("profiles").update({full_name,email,login_id:email,phone:phone||null,job_title:target.role==="nurse"?job_title:null,updated_at:new Date().toISOString()}).eq("id",target.id);
  if(profileUpdate){await db.auth.admin.updateUserById(target.id,{email:old.email,email_confirm:true,user_metadata:{full_name:old.full_name}});return reply({error:profileUpdate.message},400);}
  await db.from("audit_logs").insert({actor_id:actor.id,action:"user_profile_updated",entity_type:"profile",entity_id:target.id,details:{email}});
  return reply({success:true});
 }
 if(input.action==="delete"){
  const {data:oldProfile,error:oldError}=await db.from("profiles").select("email,login_id").eq("id",target.id).single();
  if(oldError||!oldProfile)return reply({error:"Unable to load account details."},400);
  const archivedEmail="archived+"+target.id+"@accounts.novacares.invalid";
  const {error:profileError}=await db.from("profiles").update({is_active:false,email:archivedEmail,login_id:archivedEmail,updated_at:new Date().toISOString()}).eq("id",target.id);
  if(profileError)return reply({error:profileError.message},400);
  const {error:authUpdateError}=await db.auth.admin.updateUserById(target.id,{email:archivedEmail,email_confirm:true,ban_duration:"876000h"});
  if(authUpdateError){
   await db.from("profiles").update({email:oldProfile.email,login_id:oldProfile.login_id,is_active:true,updated_at:new Date().toISOString()}).eq("id",target.id);
   return reply({error:"Could not revoke and release this account email: "+authUpdateError.message},400);
  }
  await db.from("audit_logs").insert({actor_id:actor.id,action:"account_archived_email_released",entity_type:"profile",entity_id:target.id,details:{previous_email:oldProfile.email}});
  return reply({success:true,records_retained:true,email_released:true});
 }
 return reply({error:"Unknown action."},400);
});