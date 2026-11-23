import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://payrollnovacarestaffing.netlify.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return reply({error:"Method not allowed."},405);
  const supabaseUrl=Deno.env.get("SUPABASE_URL"),serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!supabaseUrl||!serviceRoleKey){console.error("Missing Edge Function environment configuration.");return reply({error:"Server configuration is incomplete."},500);}
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token)return reply({error:"Authentication required."},401);
  const adminClient=createClient(supabaseUrl,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:authData,error:authError}=await adminClient.auth.getUser(token);
  if(authError||!authData.user)return reply({error:"Your session could not be verified. Please sign out and sign in again."},401);
  const {data:actor,error:actorError}=await adminClient.from("profiles").select("id,role,is_active").eq("id",authData.user.id).maybeSingle();
  if(actorError){console.error("Administrator profile lookup failed:",actorError.message);return reply({error:"Could not verify your administrator profile.",details:actorError.message},500);}
  if(!actor||actor.is_active!==true||!["super_admin","admin"].includes(actor.role))return reply({error:"Only an active Admin or Super Admin can create accounts."},403);
  let input:{full_name?:string;email?:string;password?:string;phone?:string;role?:string;avatar_url?:string;job_title?:string};
  try{input=await req.json();}catch{return reply({error:"Invalid request body."},400);}
  const fullName=String(input.full_name||"").trim(),email=String(input.email||"").trim().toLowerCase(),password=String(input.password||""),phone=String(input.phone||"").trim();
  const role=input.role,avatarUrl=String(input.avatar_url||"").trim()||null,jobTitle=String(input.job_title||"").trim().slice(0,40)||null;
  if(actor.role==="admin"&&role!=="nurse")return reply({error:"Admins can create Nurse / Employee accounts only."},403);
  if(actor.role==="super_admin"&&role!=="admin"&&role!=="nurse")return reply({error:"Choose Admin or Nurse / Employee."},400);
  if(!fullName||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply({error:"Enter a valid full name and email address."},400);
  if(password.length<8||password.length>72)return reply({error:"Password must be between 8 and 72 characters."},400);
  // Release emails from legacy soft-deleted accounts before provisioning a new account.
  const {data:authUsers,error:listError}=await adminClient.auth.admin.listUsers({page:1,perPage:1000});
  if(listError)return reply({error:"Unable to verify whether this email is available: "+listError.message},500);
  const prior=authUsers.users.find(u=>(u.email||"").toLowerCase()===email);
  if(prior){
    const {data:priorProfile}=await adminClient.from("profiles").select("id,is_active,email,login_id").eq("id",prior.id).maybeSingle();
    if(priorProfile?.is_active)return reply({error:"A user with this email address is already registered."},409);
    const released="archived+"+prior.id+"@accounts.novacares.invalid";
    const {error:releaseError}=await adminClient.auth.admin.updateUserById(prior.id,{email:released,email_confirm:true,ban_duration:"876000h"});
    if(releaseError)return reply({error:"This email belongs to an older disabled account and could not be released: "+releaseError.message},409);
    if(priorProfile){
      const {error:archiveError}=await adminClient.from("profiles").update({email:released,login_id:released,is_active:false,updated_at:new Date().toISOString()}).eq("id",prior.id);
      if(archiveError)return reply({error:"Email was released from authentication but old profile could not be archived: "+archiveError.message},500);
    }else{
      const {error:removeError}=await adminClient.auth.admin.deleteUser(prior.id);
      if(removeError)return reply({error:"Could not clean up an incomplete previous account: "+removeError.message},500);
    }
  }
  const {data:created,error:createError}=await adminClient.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:fullName}});
  if(createError||!created.user){console.error("Auth user creation failed:",createError?.message);return reply({error:createError?.message||"Unable to create account."},400);}
  const {error:profileError}=await adminClient.from("profiles").insert({id:created.user.id,login_id:email,email,full_name:fullName,phone:phone||null,avatar_url:avatarUrl,job_title:role==="nurse"?jobTitle:null,role,is_active:true,must_change_password:false,created_by:authData.user.id});
  if(profileError){console.error("Profile insert failed; rolling back auth user:",profileError.message);const {error:rollbackError}=await adminClient.auth.admin.deleteUser(created.user.id);if(rollbackError)console.error("Auth rollback failed:",rollbackError.message);return reply({error:profileError.message},400);}
  await adminClient.from("audit_logs").insert({actor_id:authData.user.id,action:"user_created",entity_type:"profile",entity_id:created.user.id,details:{email,role}});
  return reply({success:true,message:"Account created successfully. User can sign in immediately with the password you set."});
});