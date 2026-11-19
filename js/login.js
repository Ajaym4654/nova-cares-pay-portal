(() => {
  const form = document.getElementById("login-form");
  const message = document.getElementById("login-message");
  const button = document.getElementById("sign-in");
  const password = document.getElementById("password");
  document.getElementById("year").textContent = new Date().getFullYear();

  document.getElementById("toggle-password").addEventListener("click", () => {
    const visible = password.type === "password";
    password.type = visible ? "text" : "password";
    document.getElementById("toggle-password").setAttribute("aria-label", visible ? "Hide password" : "Show password");
  });

  function showMessage(text, type) {
    message.textContent = text;
    message.className = "message " + (type || "");
  }

  document.getElementById("forgot-link").addEventListener("click", async () => {
    const email = document.getElementById("email").value.trim();
    if (!email) return showMessage("Enter your registered email address first.", "error");
    const cfg = window.NOVA_CONFIG || {};
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !window.supabase) {
      return showMessage("Password recovery will be available after the portal administrator connects Supabase.", "error");
    }
    const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/reset-password.html" });
    showMessage(error ? error.message : "If this email is registered, password reset instructions will be sent.", error ? "error" : "success");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage("", "");
    const email = document.getElementById("email").value.trim();
    const pass = password.value;
    if (!email || !pass) return showMessage("Please enter both your email address and password.", "error");
    const cfg = window.NOVA_CONFIG || {};
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !window.supabase) {
      return showMessage("The login design is ready. Authentication will activate after Supabase is configured by the project owner.", "error");
    }
    button.disabled = true;
    button.querySelector("span").textContent = "Signing in…";
    try {
      const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      const { data, error } = await client.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
      const { data: profile, error: profileError } = await client.from("profiles").select("role, is_active, must_change_password").eq("id", data.user.id).single();
      if (profileError || !profile || !profile.is_active) {
        await client.auth.signOut();
        throw new Error("Your portal profile is unavailable or inactive. Please contact your administrator.");
      }
      const destinations = { super_admin: "/dashboard.html", admin: "/dashboard.html", nurse: "/dashboard.html" };
      location.href = profile.must_change_password ? "/change-password.html" : (destinations[profile.role] || "/dashboard.html");
    } catch (error) {
      showMessage(error.message || "Unable to sign in. Please try again.", "error");
    } finally {
      button.disabled = false;
      button.querySelector("span").textContent = "Sign in securely";
    }
  });
})();