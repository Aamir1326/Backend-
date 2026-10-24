const $ = id => document.getElementById(id);
let token = "";

async function api(path, body) {
  const url = CONFIG.API + path;
  let r;
  try {
    r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch (e) {
    throw new Error("Cannot reach server: " + url);   // DEBUG: remove the URL part later
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d.error || "Error " + r.status) + " [" + r.status + " " + url + "]");   // DEBUG
  return d;
}
function say(id, t, ok) { const e = $(id); e.textContent = t; e.className = "msg " + (ok ? "ok" : "err"); }
function busy(btn, on) { btn.disabled = on; }
function show(n) { document.querySelectorAll(".page").forEach(p => p.classList.toggle("show", p.id === "p" + n)); window.scrollTo(0, 0); }

/* Menu */
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
  catch (e) { say("m1", e.message); say("m2", e.message); }
  busy($("sendOtp"), false);
}
$("sendOtp").onclick = sendOtp;
$("resend").onclick = async () => { await sendOtp(); };

/* Step 2: Verify OTP */
$("verify").onclick = async () => {
  const otp = $("otp").value.trim();
  if (!/^\d{6}$/.test(otp)) return say("m2", "Enter the 6 digit code.");
  busy($("verify"), true); say("m2", "Verifying…", true);
  try {
    const r = await api("/verify-otp", { email: $("email").value.trim(), otp });
    token = r.token; say("m2", "Email verified ✔", true); show(3);
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

/* Step 4: Payment (Razorpay Checkout; success only after server verification) */
async function pay() {
  const amount = Number($("amount").value);
  if (!(amount >= 1)) return say("m4", "Enter an amount of at least ₹1.");
  if (typeof Razorpay === "undefined") return say("m4", "Payment window did not load. Check your internet.");
  say("m4", "Starting payment…", true);
  try {
    const o = await api("/payments/create-order", {
      username: $("name").value.trim(), email: $("email").value.trim(), amount, token
    });
    const rz = new Razorpay({
      key: o.keyId, order_id: o.orderId, amount: o.amount, currency: o.currency,
      name: "Support Us", description: "Support our work",
      prefill: { ...o.prefill, method: "upi" }, theme: { color: "#652FFF" },
      handler: async resp => {
        say("m4", "Verifying payment…", true);
        try {
          const v = await api("/payments/verify", resp);
          if (v.status === "paid") {
            $("txn").textContent = "Transaction ID: " + v.transactionId + " · Amount: ₹" + v.amount;
            $("ok").showModal();
          } else say("m4", v.message || "Payment is still pending.");
        } catch (e) { say("m4", e.message); }
      },
      modal: { ondismiss: () => say("m4", "Payment cancelled.") }
    });
    rz.on("payment.failed", r => say("m4", (r.error && r.error.description) || "Payment failed."));
    rz.open();
  } catch (e) { say("m4", e.message); }
}
document.querySelectorAll("[data-pay]").forEach(b => b.onclick = pay);
$("home").onclick = () => location.reload();
