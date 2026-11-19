import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return reply({ error: "Server configuration is incomplete." }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return reply({ error: "Authentication required." }, 401);

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return reply({ error: "Invalid session." }, 401);

  const adminClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: actor, error: actorError } = await adminClient.from("profiles")
    .select("role,is_active").eq("id", authData.user.id).single();
  if (actorError || !actor?.is_active || actor.role !== "super_admin") {
    return reply({ error: "Only an active Super Admin can create accounts." }, 403);
  }

  let input: { full_name?: string; email?: string; phone?: string; role?: string };
  try { input = await req.json(); } catch { return reply({ error: "Invalid request body." }, 400); }
  const fullName = String(input.full_name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const phone = String(input.phone || "").trim();
  const role = input.role;
  if (!fullName || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return reply({ error: "Enter a valid name and email address." }, 400);
  }
  if (role !== "admin" && role !== "nurse") return reply({ error: "Choose Admin or Nurse/Employee." }, 400);

  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
  });
  if (inviteError || !invited.user) return reply({ error: inviteError?.message || "Unable to send invitation." }, 400);

  const { error: profileError } = await adminClient.from("profiles").insert({
    id: invited.user.id,
    login_id: email,
    email,
    full_name: fullName,
    phone: phone || null,
    role,
    is_active: true,
    must_change_password: true,
    created_by: authData.user.id,
  });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(invited.user.id);
    return reply({ error: profileError.message }, 400);
  }
  return reply({ success: true, message: "Invitation sent. The user can set their password from the email link." });
});
