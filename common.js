/* Shared by every page: session, sidebar menu, logout, About Developer */
const Session = {
  get() {
    try {
      const s = JSON.parse(localStorage.getItem("su_session") || "null");
      if (s && s.token && Number(String(s.token).split(".")[0]) > Date.now()) return s;
    } catch (e) {}
    try { localStorage.removeItem("su_session"); } catch (e) {}
    return null;
  },
  set(o) { try { localStorage.setItem("su_session", JSON.stringify({ ...(Session.get() || {}), ...o })); } catch (e) {} },
  clear() { try { localStorage.removeItem("su_session"); } catch (e) {} }
};

(function () {
  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const on = n => page === n ? ' class="on"' : "";
  document.getElementById("side").innerHTML =
    '<div class="logo"><div style="font-size:40px">💜</div><b>JMI Student Charity</b><small>Support Our Work</small></div>' +
    '<a href="index.html"' + on("index.html") + '>🏠 Home</a>' +
    '<a href="AI.html"' + on("ai.html") + '>🤖 Talk with AI</a>' +
    '<a href="jmi.html"' + on("jmi.html") + '>🎓 JMI</a>' +
    '<a href="community.html"' + on("community.html") + '>👥 Community</a>' +
    '<button class="nav" id="share">🔗 Share</button>' +
    '<a href="privacy.html"' + on("privacy.html") + '>🛡️ Privacy Policy</a>' +
    '<button class="nav" data-info="about">ℹ️ About</button>' +
    '<button class="nav" data-info="contact">✉️ Contact</button>' +
    '<button class="nav" id="devBtn">👨‍💻 About Developer</button>' +
    '<button class="nav" id="logout">🚪 Logout</button>' +
    '<div class="made">Made with ❤️<br>for a better future</div>';

  document.body.insertAdjacentHTML("beforeend",
    '<dialog id="info"><h3 id="it"></h3><p id="ib"></p><button class="btn" id="infoX">Close</button></dialog>' +
    '<dialog id="dev"></dialog>');
  const $ = id => document.getElementById(id);

  $("burger").onclick = () => { $("side").classList.toggle("open"); $("scrim").classList.toggle("on"); };
  $("scrim").onclick = $("burger").onclick;
  const closeMenu = () => { $("side").classList.remove("open"); $("scrim").classList.remove("on"); };

  $("share").onclick = async () => {
    const d = { title: "Support Us", text: "Support our work", url: location.origin };
    try { navigator.share ? await navigator.share(d) : (await navigator.clipboard.writeText(d.url), alert("Link copied")); } catch (e) {}
  };
  $("infoX").onclick = () => $("info").close();
  document.querySelectorAll("[data-info]").forEach(b => b.onclick = () => {
    const about = b.dataset.info === "about";
    $("it").textContent = about ? "About" : "Contact";
    $("ib").textContent = about
      ? "Support Us collects voluntary contributions for education, charity and community projects."
      : "Email us at " + CONFIG.CONTACT;
    closeMenu(); $("info").showModal();
  });

  $("logout").onclick = () => {
    Session.clear();
    if (page === "index.html" || page === "") location.reload(); else location.href = "index.html";
  };

  /* About Developer: 6-digit password is checked on the server */
  function devForm() {
    $("dev").innerHTML =
      '<h3>👨‍💻 About Developer</h3>' +
      '<p>Enter the 6-digit password.<br><small>Password chahiye? Admin se contact karo: ' + CONFIG.CONTACT + '</small></p>' +
      '<input id="devPin" type="password" inputmode="numeric" maxlength="6" placeholder="6 digit password" autocomplete="off">' +
      '<div class="msg" id="devMsg"></div>' +
      '<button class="btn" id="devGo" style="margin-top:12px">Unlock</button>' +
      '<button class="lnk" id="devX">Close</button>';
    $("devX").onclick = () => $("dev").close();
    $("devGo").onclick = async () => {
      const pin = $("devPin").value.trim(), m = $("devMsg");
      if (!/^\d{6}$/.test(pin)) { m.className = "msg err"; m.textContent = "Enter the 6 digit password."; return; }
      $("devGo").disabled = true; m.className = "msg ok"; m.textContent = "Checking…";
      try {
        const r = await fetch(CONFIG.API + "/dev-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Error " + r.status);
        sessionStorage.setItem("su_dev", d.token); location.href = "developer.html";
      } catch (e) { m.className = "msg err"; m.textContent = e.message; $("devGo").disabled = false; }
    };
  }
  $("devBtn").onclick = () => { closeMenu(); devForm(); $("dev").showModal(); };
})();
