import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://payrollnovacarestaffing.netlify.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return reply({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Missing Edge Function environment configuration.");
    return reply({ error: "Server configuration is incomplete." }, 500);
  }

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) {
    return reply({ error: "Authentication required." }, 401);
  }

  // Verify the caller's Supabase session using the public anon key.
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) {
    console.error("Session verification failed:", authError?.message);
    return reply({ error: "Your session is invalid or expired. Please sign in again." }, 401);
  }

  // Use the service-role client for the role check so profile RLS cannot block it.
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: actor, error: actorError } = await adminClient
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (actorError) {
    console.error("Super Admin profile lookup failed:", {
      userId: authData.user.id,
      message: actorError.message,
      code: actorError.code,
    });
    return reply({
      error: "Could not verify your administrator profile.",
      details: actorError.message,
      code: actorError.code,
    }, 500);
  }

  if (!actor) {
    console.error("No profile row found for authenticated user:", authData.user.id);
    return reply({
      error: "No portal profile is linked to your signed-in account.",
      details: "Authenticated user ID did not match a row in public.profiles.",
    }, 403);
  }

  if (actor.role !== "super_admin" || actor.is_active !== true) {
    console.error("Caller is not an active Super Admin:", {
      userId: authData.user.id,
      role: actor.role,
      isActive: actor.is_active,
    });
    return reply({
      error: "Only an active Super Admin can create accounts.",
      details: `Profile role: ${actor.role}; active: ${actor.is_active}`,
    }, 403);
  }

  let input: {
    full_name?: string;
    email?: string;
    password?: string;
    phone?: string;
    role?: string;
  };

  try {
    input = await req.json();
  } catch {
    return reply({ error: "Invalid request body." }, 400);
  }

  const fullName = String(input.full_name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const password = String(input.password || "");
  const phone = String(input.phone || "").trim();
  const role = input.role;

  if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return reply({ error: "Enter a valid full name and email address." }, 400);
  }

  if (password.length < 8 || password.length > 72) {
    return reply({ error: "Password must be between 8 and 72 characters." }, 400);
  }

  if (role !== "admin" && role !== "nurse") {
    return reply({ error: "Choose Admin or Nurse / Employee." }, 400);
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created.user) {
    console.error("Auth user creation failed:", createError?.message);
    return reply({ error: createError?.message || "Unable to create account." }, 400);
  }

  const { error: profileError } = await adminClient.from("profiles").insert({
    id: created.user.id,
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
    console.error("Profile insert failed; rolling back auth user:", profileError.message);
    const { error: rollbackError } = await adminClient.auth.admin.deleteUser(created.user.id);
    if (rollbackError) {
      console.error("Auth rollback failed:", rollbackError.message);
    }
    return reply({ error: profileError.message }, 400);
  }

  return reply({
    success: true,
    message: "Account created successfully. No invitation email was sent.",
  });
});
