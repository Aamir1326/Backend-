const $ = id => document.getElementById(id);
let token = "";

async function api(path, body) {
  const url = CONFIG.API + path;
  let r;
  try {
    r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch (e) {
    throw new Error("Cannot reach server. Check your internet and try again.");
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d.error || "Error " + r.status));
  return d;
}
function say(id, t, ok) { const e = $(id); e.textContent = t; e.className = "msg " + (ok ? "ok" : "err"); }
function busy(btn, on) { btn.disabled = on; }
function show(n) {
  document.querySelectorAll(".page").forEach(p => p.classList.toggle("show", p.id === "p" + n));
  window.scrollTo(0, 0);
  if (n >= 3 && Session.get()) Session.set({ step: n });
  if (n === 4) { $("qrimg").src = (CONFIG.QR_IMAGE || "qr.png") + "?v=" + Date.now(); }
}

/* Step 1: name, email, phone (phone is NOT verified) -> email OTP */
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const phoneOk = p => /^\+?\d{10,15}$/.test(p.replace(/[\s\-()]/g, ""));
async function sendOtp() {
  const name = $("name").value.trim(), email = $("email").value.trim(), phone = $("phone").value.trim();
  if (name.length < 2) return say("m1", "Enter your name.");
  if (!emailOk(email)) return say("m1", "Enter a valid email address.");
  if (!phoneOk(phone)) return say("m1", "Enter a valid phone number (10 to 15 digits).");
  busy($("sendOtp"), true); say("m1", "Sending OTP…", true);
  try { await api("/send-otp", { name, email, phone }); say("m1", "OTP sent. Check your inbox.", true); show(2); $("otp").focus(); }
  catch (e) { say("m1", e.message); say("m2", e.message); }
  busy($("sendOtp"), false);
}
$("sendOtp").onclick = sendOtp;
$("resend").onclick = async () => { await sendOtp(); };

/* Step 2: Verify email OTP */
$("verify").onclick = async () => {
  const otp = $("otp").value.trim();
  if (!/^\d{6}$/.test(otp)) return say("m2", "Enter the 6 digit code.");
  busy($("verify"), true); say("m2", "Verifying…", true);
  try {
    const r = await api("/verify-otp", { email: $("email").value.trim(), otp });
    token = r.token;
    Session.set({ name: $("name").value.trim(), email: $("email").value.trim(), phone: $("phone").value.trim(), token, step: 3 });
    say("m2", "Email verified ✔", true); show(3);
  } catch (e) { say("m2", e.message); }
  busy($("verify"), false);
};

/* Step 3: Comment */
$("sendC").onclick = async () => {
  const comment = $("comment").value.trim();
  if (!comment) return say("m3", "Write a comment first.");
  busy($("sendC"), true);
  try {
    await api("/comment", { name: $("name").value.trim(), email: $("email").value.trim(), comment, token });
    say("m3", "Comment sent. Thank you!", true); $("comment").value = ""; setTimeout(() => show(4), 700);
  } catch (e) { say("m3", e.message); }
  busy($("sendC"), false);
};

/* Step 4: QR only. "I've paid" saves a note for the admin (confirmed manually) */
$("qrimg").onerror = () => say("m4", "QR image not found. Upload your QR as qr.png.");
$("paid").onclick = async () => {
  busy($("paid"), true); say("m4", "Saving…", true);
  try {
    await api("/qr-paid", { name: $("name").value.trim(), email: $("email").value.trim(), amount: $("amount").value.trim(), utr: $("utr").value.trim(), token });
    say("m4", "", true); $("ok").showModal();
  } catch (e) { say("m4", e.message); }
  busy($("paid"), false);
};
$("home").onclick = () => location.reload();

/* Already verified? Skip the OTP steps (e.g. coming back from the AI page) */
(function () {
  const S = Session.get();
  if (!S) return;
  $("name").value = S.name || ""; $("email").value = S.email || ""; $("phone").value = S.phone || ""; token = S.token;
  show(Math.min(Math.max(S.step || 3, 3), 4));
})();
