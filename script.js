const $ = id => document.getElementById(id);

async function api(path, body) {
  if (CONFIG.DEMO) {
    await new Promise(r => setTimeout(r, 600));
    if (path === "/verify-otp") return { ok: /^\d{6}$/.test(body.otp) };
    if (path === "/verify-payment") return { ok: true, txnId: "DEMO-" + Date.now(), amount: "—" };
    return { ok: true };
  }
  const r = await fetch(CONFIG.API + path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) throw new Error("Server error " + r.status);
  return r.json();
}
function say(id, t, ok) { const e = $(id); e.textContent = t; e.className = "msg " + (ok ? "ok" : "err"); }
function busy(btn, on) { btn.disabled = on; }
function show(n) { document.querySelectorAll(".page").forEach(p => p.classList.toggle("show", p.id === "p" + n)); window.scrollTo(0, 0); }

/* Navigation */
$("burger").onclick = () => { $("side").classList.toggle("open"); $("scrim").classList.toggle("on"); };
$("scrim").onclick = $("burger").onclick;
$("share").onclick = async () => {
  const d = { title: "Support Us", text: "Support our work", url: location.href };
  try { navigator.share ? await navigator.share(d) : (await navigator.clipboard.writeText(d.url), alert("Link copied")); } catch (e) {}
};
document.querySelectorAll("[data-info]").forEach(b => b.onclick = () => {
  const about = b.dataset.info === "about";
  $("it").textContent = about ? "About" : "Contact";
  $("ib").textContent = about
    ? "Support Us collects voluntary contributions for education, charity and community projects."
    : "Email us at " + CONFIG.CONTACT;
  $("info").showModal();
});

/* Step 1: Send OTP */
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
async function sendOtp() {
  const name = $("name").value.trim(), email = $("email").value.trim();
  if (name.length < 2) return say("m1", "Enter your name.");
  if (!emailOk(email)) return say("m1", "Enter a valid email address.");
  busy($("sendOtp"), true); say("m1", "Sending OTP…", true);
  try { await api("/send-otp", { name, email }); say("m1", "OTP sent. Check your inbox.", true); show(2); $("otp").focus(); }
  catch (e) { say("m1", "Could not send OTP. Try again."); }
  busy($("sendOtp"), false);
}
$("sendOtp").onclick = sendOtp; $("resend").onclick = sendOtp;

/* Step 2: Verify OTP */
$("verify").onclick = async () => {
  const otp = $("otp").value.trim();
  if (!/^\d{6}$/.test(otp)) return say("m2", "Enter the 6 digit code.");
  busy($("verify"), true); say("m2", "Verifying…", true);
  try {
    const r = await api("/verify-otp", { email: $("email").value.trim(), otp });
    if (!r.ok) throw 0;
    say("m2", "Email verified ✔", true); show(3);
  } catch (e) { say("m2", "Wrong or expired OTP."); }
  busy($("verify"), false);
};

/* Step 3: Comment */
$("sendC").onclick = async () => {
  const comment = $("comment").value.trim();
  if (!comment) return say("m3", "Write a comment first.");
  busy($("sendC"), true);
  try { await api("/comment", { email: $("email").value.trim(), comment }); say("m3", "Comment sent. Thank you!", true); $("comment").value = ""; setTimeout(() => show(4), 700); }
  catch (e) { say("m3", "Could not send comment."); }
  busy($("sendC"), false);
};

/* Step 4: Payments */
function upi(extra) {
  const p = new URLSearchParams({ pa: CONFIG.UPI_ID, pn: CONFIG.PAYEE, cu: "INR", tn: "Support Us" });
  if (CONFIG.AMOUNT) p.set("am", CONFIG.AMOUNT);
  return extra + p.toString();
}
$("gpay").href = upi("tez://upi/pay?");
$("paytm").href = upi("paytmmp://pay?");
$("upi").href = upi("upi://pay?");
[ "gpay", "paytm", "upi" ].forEach(id => $(id).addEventListener("click", () => setTimeout(() => say("m4", "After paying, tap Generate QR → “I've paid” to verify."), 400)));

$("genQr").onclick = () => {
  $("qr").innerHTML = "";
  new QRCode($("qr"), { text: upi("upi://pay?"), width: 160, height: 160 });
  show(5);
};
$("back").onclick = () => show(4);

/* Step 5: success ONLY after server-side verification */
$("paid").onclick = async () => {
  busy($("paid"), true); say("m5", "Checking with payment gateway…", true);
  try {
    const r = await api("/verify-payment", { email: $("email").value.trim() });
    if (!r.ok) throw 0;
    $("txn").textContent = "Transaction ID: " + r.txnId + (r.amount ? " · Amount: " + r.amount : "");
    $("ok").showModal();
  } catch (e) { say("m5", "Payment not confirmed yet. Try again in a minute."); }
  busy($("paid"), false);
};
$("home").onclick = () => location.reload();
