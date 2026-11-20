/* =========================================================
   KosmosStudio — аккаунты на Supabase
   ========================================================= */

const config = window.KOSMOS_CONFIG || {};
const configured = Boolean(config.SUPABASE_URL && config.SUPABASE_ANON_KEY);
const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NICK_RE = /^[A-Za-zА-Яа-яЁё0-9_-]{3,24}$/;
const REDIRECT_URL = window.location.origin + window.location.pathname;

const $ = (id) => document.getElementById(id);

const ui = {
  accountBtn: $("accountBtn"),
  accountLabel: document.querySelector("[data-account-label]"),
  accountIcon: document.querySelector("[data-account-icon]"),
  accountAvatar: $("accountAvatar"),

  authDialog: $("authDialog"),
  authMessage: $("authMessage"),
  resendConfirm: $("resendConfirm"),
  tabsWrap: $("authTabs"),
  loginForm: $("loginForm"),
  registerForm: $("registerForm"),
  resetForm: $("resetForm"),
  newPasswordForm: $("newPasswordForm"),
  tabs: Array.from(document.querySelectorAll("[data-tab]")),

  loginEmail: $("loginEmail"),
  loginPassword: $("loginPassword"),
  regNick: $("regNick"),
  regEmail: $("regEmail"),
  regPassword: $("regPassword"),
  regPassword2: $("regPassword2"),
  resetEmail: $("resetEmail"),
  newPassword: $("newPassword"),
  newPassword2: $("newPassword2"),

  profileDialog: $("profileDialog"),
  profileAvatar: $("profileAvatar"),
  profileName: $("profileName"),
  profileEmail: $("profileEmail"),
  profileRole: $("profileRole"),
  profileSince: $("profileSince"),
  nicknameForm: $("nicknameForm"),
  nicknameInput: $("nicknameInput"),
  profileMessage: $("profileMessage"),
  logoutBtn: $("logoutBtn"),
};

let supabase = null;
let currentUser = null;
let currentProfile = null;
let lastFocus = null;
let pendingConfirmEmail = "";

/* ---------- helpers ---------- */

const emailPrefix = (email) => (email || "player").split("@")[0];

const formatDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};

const setMessage = (node, text, type = "") => {
  if (!node) return;
  node.textContent = text || "";
  node.className = "form-msg" + (type ? ` is-${type}` : "");
};

const clearMessage = () => setMessage(ui.authMessage, "");

const showResend = (email) => {
  pendingConfirmEmail = email;
  if (ui.resendConfirm) ui.resendConfirm.hidden = false;
};

const hideResend = () => {
  pendingConfirmEmail = "";
  if (ui.resendConfirm) ui.resendConfirm.hidden = true;
};

const initialOf = (name) => (name || "K").trim().charAt(0).toUpperCase();

const mapError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "");

  if (message.includes("invalid login credentials")) return "Неверный email или пароль.";
  if (message.includes("email not confirmed")) return "Подтвердите почту — письмо уже отправлено. Проверьте «Спам».";
  if (message.includes("user already registered")) return "Аккаунт с таким email уже существует.";
  if (message.includes("password should be at least")) return "Пароль должен быть не короче 6 символов.";
  if (message.includes("unable to validate email") || message.includes("invalid email")) return "Проверьте адрес почты.";
  if (message.includes("for security purposes")) return "Письмо уже отправлено. Повторите через минуту.";
  if (message.includes("email rate limit") || code.includes("over_email_send_rate_limit")) {
    return "Лимит писем Supabase исчерпан: письма временно не уходят. Подождите около часа или отключите «Confirm email» в Supabase.";
  }
  if (message.includes("rate limit") || message.includes("too many")) return "Слишком много попыток. Попробуйте позже.";
  if (message.includes("signup is disabled")) return "Регистрация временно недоступна.";
  if (message.includes("database error saving new user")) return "Этот ник уже занят — выберите другой.";
  if (message.includes("auth session missing")) return "Сессия истекла. Войдите заново.";
  if (message.includes("user not found")) return "Аккаунт с таким email не найден.";
  if (message.includes("not authorized")) return "Письмо не отправилось: проверьте настройки почты в Supabase.";
  if (code === "23505") return "Этот ник уже занят — выберите другой.";
  return "Что-то пошло не так. Попробуйте ещё раз.";
};

/* ---------- modal plumbing ---------- */

function openDialog(dialog) {
  if (!dialog || dialog.open) return;
  lastFocus = document.activeElement;
  dialog.showModal();
  document.body.classList.add("modal-open");
}

function closeDialog(dialog) {
  if (!dialog || !dialog.open) return;
  dialog.close();
  syncScrollLock();
}

const syncScrollLock = () => {
  const open = [ui.authDialog, ui.profileDialog].some((dialog) => dialog?.open);
  document.body.classList.toggle("modal-open", open);
  if (!open && lastFocus instanceof HTMLElement) {
    lastFocus.focus({ preventScroll: true });
    lastFocus = null;
  }
};

/* ---------- auth modal ---------- */

function setTab(mode) {
  const forms = {
    login: ui.loginForm,
    register: ui.registerForm,
    reset: ui.resetForm,
    new: ui.newPasswordForm,
  };

  if (ui.tabsWrap) ui.tabsWrap.hidden = mode === "reset" || mode === "new";

  ui.tabs.forEach((tab) => {
    tab.setAttribute("aria-selected", String(tab.dataset.tab === mode));
    tab.tabIndex = tab.dataset.tab === mode ? 0 : -1;
  });

  Object.entries(forms).forEach(([key, form]) => {
    if (form) form.hidden = key !== mode;
  });

  hideResend();
  clearMessage();
}

function openAuth(mode = "login") {
  openDialog(ui.authDialog);
  setTab(mode);

  const focusTarget = {
    login: ui.loginEmail,
    register: ui.regNick,
    reset: ui.resetEmail,
    new: ui.newPassword,
  }[mode];

  requestAnimationFrame(() => focusTarget?.focus({ preventScroll: true }));
}

/* ---------- user state ---------- */

function renderLoggedOut() {
  if (!ui.accountBtn) return;
  ui.accountBtn.classList.remove("is-user");
  if (ui.accountIcon) ui.accountIcon.hidden = false;
  if (ui.accountAvatar) ui.accountAvatar.hidden = true;
  if (ui.accountLabel) ui.accountLabel.textContent = "Войти";
  ui.accountBtn.setAttribute("aria-label", "Войти в аккаунт");
}

function renderLoggedIn(username) {
  if (!ui.accountBtn) return;
  ui.accountBtn.classList.add("is-user");
  if (ui.accountIcon) ui.accountIcon.hidden = true;
  if (ui.accountAvatar) {
    ui.accountAvatar.hidden = false;
    ui.accountAvatar.textContent = initialOf(username);
  }
  if (ui.accountLabel) ui.accountLabel.textContent = username;
  ui.accountBtn.setAttribute("aria-label", `Профиль ${username}`);
}

async function syncSession(session) {
  currentUser = session?.user || null;

  if (!currentUser) {
    currentProfile = null;
    renderLoggedOut();
    return;
  }

  const fallbackName = currentUser.user_metadata?.username || emailPrefix(currentUser.email);
  currentProfile = {
    username: fallbackName,
    role: "Участник",
    created_at: currentUser.created_at,
  };
  renderLoggedIn(fallbackName);

  const { data, error } = await supabase
    .from("profiles")
    .select("username, role, created_at")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.warn("[auth] profiles select:", error.message);
    return;
  }

  if (data) {
    currentProfile = data;
    renderLoggedIn(data.username);
  }
}

/* ---------- profile modal ---------- */

function fillProfile() {
  if (!currentUser) return;

  const username = currentProfile?.username || emailPrefix(currentUser.email);

  if (ui.profileAvatar) ui.profileAvatar.textContent = initialOf(username);
  if (ui.profileName) ui.profileName.textContent = username;
  if (ui.profileEmail) ui.profileEmail.textContent = currentUser.email || "";
  if (ui.profileRole) ui.profileRole.textContent = currentProfile?.role || "Участник";
  if (ui.profileSince) ui.profileSince.textContent = formatDate(currentUser.created_at);
  if (ui.nicknameInput) ui.nicknameInput.value = username;

  setMessage(ui.profileMessage, "");
}

function openProfile() {
  if (!currentUser) {
    openAuth("login");
    return;
  }
  fillProfile();
  openDialog(ui.profileDialog);
}

/* ---------- forms ---------- */

async function handleLogin(event) {
  event.preventDefault();
  clearMessage();

  const email = ui.loginEmail.value.trim();
  const password = ui.loginPassword.value;

  if (!EMAIL_RE.test(email)) return setMessage(ui.authMessage, "Введите корректный email.", "error");
  if (!password) return setMessage(ui.authMessage, "Введите пароль.", "error");

  const button = ui.loginForm.querySelector('button[type="submit"]');
  button.disabled = true;

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(ui.authMessage, mapError(error), "error");
      if (String(error.message || "").toLowerCase().includes("email not confirmed")) {
        showResend(email);
      }
      return;
    }
    ui.loginForm.reset();
    hideResend();
    setMessage(ui.authMessage, "");
    closeDialog(ui.authDialog);
  } finally {
    button.disabled = false;
  }
}

async function handleRegister(event) {
  event.preventDefault();
  clearMessage();

  const nickname = ui.regNick.value.trim();
  const email = ui.regEmail.value.trim();
  const password = ui.regPassword.value;
  const repeat = ui.regPassword2.value;

  if (!NICK_RE.test(nickname)) {
    return setMessage(
      ui.authMessage,
      "Ник: 3–24 символа, буквы, цифры, дефис или подчёркивание.",
      "error"
    );
  }
  if (!EMAIL_RE.test(email)) return setMessage(ui.authMessage, "Введите корректный email.", "error");
  if (password.length < 6) return setMessage(ui.authMessage, "Пароль должен быть не короче 6 символов.", "error");
  if (password !== repeat) return setMessage(ui.authMessage, "Пароли не совпадают.", "error");

  const button = ui.registerForm.querySelector('button[type="submit"]');
  button.disabled = true;

  try {
    const { data: available, error: checkError } = await supabase.rpc("username_available", {
      candidate: nickname,
    });

    if (checkError) console.warn("[auth] nickname check:", checkError.message);
    if (available === false) {
      return setMessage(ui.authMessage, "Этот ник уже занят — выберите другой.", "error");
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: nickname },
        emailRedirectTo: REDIRECT_URL,
      },
    });

    if (error) {
      setMessage(ui.authMessage, mapError(error), "error");
      return;
    }

    ui.registerForm.reset();

    if (data.session) {
      hideResend();
      setMessage(ui.authMessage, "Аккаунт создан. Добро пожаловать!", "success");
      closeDialog(ui.authDialog);
      return;
    }

    showResend(email);
    setMessage(
      ui.authMessage,
      `Аккаунт создан. Подтвердите почту: письмо отправлено на ${email}. Если его нет — проверьте «Спам».`,
      "success"
    );
  } finally {
    button.disabled = false;
  }
}

async function handleResend(event) {
  event.preventDefault();
  if (!pendingConfirmEmail) return;

  const email = pendingConfirmEmail;
  ui.resendConfirm.disabled = true;

  try {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: REDIRECT_URL },
    });

    if (error) {
      setMessage(ui.authMessage, mapError(error), "error");
      return;
    }

    setMessage(ui.authMessage, `Письмо отправлено повторно на ${email}.`, "success");
  } finally {
    ui.resendConfirm.disabled = false;
  }
}

async function handleReset(event) {
  event.preventDefault();
  clearMessage();

  const email = ui.resetEmail.value.trim();
  if (!EMAIL_RE.test(email)) return setMessage(ui.authMessage, "Введите корректный email.", "error");

  const button = ui.resetForm.querySelector('button[type="submit"]');
  button.disabled = true;

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: REDIRECT_URL });
    if (error) {
      setMessage(ui.authMessage, mapError(error), "error");
      return;
    }
    setMessage(ui.authMessage, `Ссылка для сброса пароля отправлена на ${email}.`, "success");
    ui.resetForm.reset();
  } finally {
    button.disabled = false;
  }
}

async function handleNewPassword(event) {
  event.preventDefault();
  clearMessage();

  const password = ui.newPassword.value;
  const repeat = ui.newPassword2.value;

  if (password.length < 6) {
    return setMessage(ui.authMessage, "Пароль должен быть не короче 6 символов.", "error");
  }
  if (password !== repeat) return setMessage(ui.authMessage, "Пароли не совпадают.", "error");

  const button = ui.newPasswordForm.querySelector('button[type="submit"]');
  button.disabled = true;

  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(ui.authMessage, mapError(error), "error");
      return;
    }
    ui.newPasswordForm.reset();
    setMessage(ui.authMessage, "Пароль обновлён. Теперь можно войти.", "success");
    closeDialog(ui.authDialog);
  } finally {
    button.disabled = false;
  }
}

async function handleNickname(event) {
  event.preventDefault();
  if (!currentUser) return;
  setMessage(ui.profileMessage, "");

  const nickname = ui.nicknameInput.value.trim();
  if (!NICK_RE.test(nickname)) {
    return setMessage(
      ui.profileMessage,
      "Ник: 3–24 символа, буквы, цифры, дефис или подчёркивание.",
      "error"
    );
  }

  const button = ui.nicknameForm.querySelector('button[type="submit"]');
  button.disabled = true;

  try {
    const { error } = await supabase
      .from("profiles")
      .update({ username: nickname })
      .eq("id", currentUser.id);

    if (error) {
      setMessage(ui.profileMessage, mapError(error), "error");
      return;
    }

    await supabase.auth.updateUser({ data: { username: nickname } });
    currentProfile = { ...(currentProfile || {}), username: nickname };
    renderLoggedIn(nickname);
    fillProfile();
    setMessage(ui.profileMessage, "Ник обновлён.", "success");
  } finally {
    button.disabled = false;
  }
}

async function handleLogout() {
  if (!supabase) return;
  ui.logoutBtn.disabled = true;
  try {
    await supabase.auth.signOut();
    closeDialog(ui.profileDialog);
  } finally {
    ui.logoutBtn.disabled = false;
  }
}

/* ---------- wiring ---------- */

function wireEvents() {
  ui.accountBtn?.addEventListener("click", () => {
    if (currentUser) openProfile();
    else openAuth("login");
  });

  ui.tabs.forEach((tab) => {
    tab.addEventListener("click", () => setTab(tab.dataset.tab));
  });

  document.querySelectorAll("[data-close-auth]").forEach((button) => {
    button.addEventListener("click", () => closeDialog(ui.authDialog));
  });

  document.querySelectorAll("[data-close-profile]").forEach((button) => {
    button.addEventListener("click", () => closeDialog(ui.profileDialog));
  });

  $("forgotLink")?.addEventListener("click", (event) => {
    event.preventDefault();
    setTab("reset");
  });

  ui.resendConfirm?.addEventListener("click", handleResend);

  $("backToLogin")?.addEventListener("click", (event) => {
    event.preventDefault();
    setTab("login");
  });

  ui.loginForm?.addEventListener("submit", handleLogin);
  ui.registerForm?.addEventListener("submit", handleRegister);
  ui.resetForm?.addEventListener("submit", handleReset);
  ui.newPasswordForm?.addEventListener("submit", handleNewPassword);
  ui.nicknameForm?.addEventListener("submit", handleNickname);
  ui.logoutBtn?.addEventListener("click", handleLogout);

  [ui.authDialog, ui.profileDialog].forEach((dialog) => {
    if (!dialog) return;
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog(dialog);
    });
    dialog.addEventListener("close", syncScrollLock);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (ui.authDialog?.open) closeDialog(ui.authDialog);
    if (ui.profileDialog?.open) closeDialog(ui.profileDialog);
  });
}

/* ---------- boot ---------- */

async function boot() {
  renderLoggedOut();

  if (!configured) {
    console.warn("[auth] Supabase не настроен: заполните assets/js/config.js");
    return;
  }

  // Ссылка из письма для сброса пароля: #access_token=...&type=recovery
  const recoveryLink = /[#&?]type=recovery/.test(window.location.hash + window.location.search);

  const { createClient } = await import(SUPABASE_CDN);

  supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  wireEvents();

  if (ui.accountBtn) ui.accountBtn.hidden = false;

  const { data } = await supabase.auth.getSession();
  await syncSession(data.session);

  if (recoveryLink) {
    openAuth(data.session ? "new" : "login");
    if (!data.session) {
      setMessage(ui.authMessage, "Ссылка для сброса пароля недействительна или истекла.", "error");
    }
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      openAuth("new");
      return;
    }
    if (event === "INITIAL_SESSION") return;
    setTimeout(() => {
      void syncSession(session);
    }, 0);
  });
}

boot().catch((error) => {
  console.error("[auth] init failed", error);
});
