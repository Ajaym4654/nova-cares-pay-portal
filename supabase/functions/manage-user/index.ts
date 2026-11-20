import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-supabase-api-version","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Max-Age":"86400"};
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
 if(actorErr||!actor?.is_active||!["admin","super_admin"].includes(actor.role))return reply({error:"Administrator access required."},403);
 let input:{action?:string;user_id?:string;full_name?:string;email?:string;phone?:string;password?:string;job_title?:string};
 try{input=await req.json();}catch{return reply({error:"Invalid request."},400);}
 if(!input.user_id)return reply({error:"User ID is required."},400);
 const {data:target,error:targetErr}=await db.from("profiles").select("id,role,is_active").eq("id",input.user_id).maybeSingle();
 if(targetErr||!target)return reply({error:"Account not found."},404);
 if(actor.role==="admin"&&target.role!=="nurse")return reply({error:"Admins can manage Nurse / Employee accounts only."},403);
 if(actor.role==="super_admin"&&!["admin","nurse"].includes(target.role))return reply({error:"This account cannot be managed here."},403);
 if(target.id===actor.id)return reply({error:"You cannot modify your own administrator account here."},403);
 if(input.action==="set_password"){
  const password=String(input.password||"");
  if(password.length<8||password.length>72)return reply({error:"Password must be between 8 and 72 characters."},400);
  const {error}=await db.auth.admin.updateUserById(target.id,{password});
  if(error)return reply({error:error.message},400);
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
  return reply({success:true});
 }
 if(input.action==="delete"){
  const {error}=await db.from("profiles").update({is_active:false,updated_at:new Date().toISOString()}).eq("id",target.id);
  if(error)return reply({error:error.message},400);
  const {error:banError}=await db.auth.admin.updateUserById(target.id,{ban_duration:"876000h"});
  if(banError)console.error("Auth ban failed; inactive profile still prevents portal access:",banError.message);
  return reply({success:true,records_retained:true});
 }
 return reply({error:"Unknown action."},400);
});