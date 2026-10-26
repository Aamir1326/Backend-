const $ = id => document.getElementById(id);
const h = (t, p = {}, ...k) => {
  const e = document.createElement(t);
  for (const [a, v] of Object.entries(p)) { if (a === "class") e.className = v; else if (a.startsWith("on")) e[a] = v; else if (v !== false && v != null) e.setAttribute(a, v); }
  k.flat().forEach(c => { if (c != null && c !== false) e.append(c instanceof Node ? c : document.createTextNode(c)); });
  return e;
};
async function api(path, body) {
  const r = await fetch("/api/cc" + path, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) { location.replace("login.html"); throw new Error("Please login"); }
  if (!r.ok) throw new Error(d.error || "Error " + r.status);
  return d;
}
let toastT;
function toast(t) { const e = $("toast"); e.textContent = t; e.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => e.hidden = true, 3500); }
const fail = e => toast(e.message || String(e));

let me, convs = [], contacts = [], callsList = [], active = null, msgs = [], more = false, tab = "chats", replyTo = null, missed = 0, searchTerm = "", typingT = 0;
const hue = s => [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
const avatar = (u, cls = "") => {
  const d = h("div", { class: "av " + cls, style: `background:hsl(${hue(u.name || "?")},55%,45%)` });
  if (u.avatar) d.append(h("img", { src: u.avatar, alt: "" })); else d.textContent = (u.name || "?").trim().slice(0, 1).toUpperCase();
  if (u.online) d.append(h("span", { class: "dot" }));
  return d;
};
const tm = d => new Date(d).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
function when(d) {
  const x = new Date(d), n = new Date(), y = new Date(Date.now() - 864e5);
  if (x.toDateString() === n.toDateString()) return tm(x);
  if (x.toDateString() === y.toDateString()) return "Yesterday";
  return x.toLocaleDateString([], { day: "numeric", month: "short" });
}
const dayLabel = d => { const x = new Date(d); if (x.toDateString() === new Date().toDateString()) return "Today"; if (x.toDateString() === new Date(Date.now() - 864e5).toDateString()) return "Yesterday"; return x.toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" }); };
const statusText = u => u.online ? "Online" : (u.lastSeen ? "Last seen " + when(u.lastSeen) + (new Date(u.lastSeen).toDateString() === new Date().toDateString() ? "" : ", " + tm(u.lastSeen)) : "");
const convOf = id => convs.find(c => c.user.id === id);
const updBadges = () => { const n = convs.reduce((a, c) => a + (c.unread || 0), 0); $("nchats").textContent = n; $("nchats").hidden = !n; $("nbell").textContent = missed; $("nbell").hidden = !missed; };

/* ---------- lists ---------- */
async function loadConvs() { convs = (await api("/conversations")).conversations; }
function renderList() {
  const lb = $("lb"); lb.textContent = ""; $("lt").textContent = { chats: "Chats", contacts: "Contacts", calls: "Calls" }[tab] || "";
  const q = $("gs").value.trim().toLowerCase();
  if (tab === "chats") {
    const rows = convs.filter(c => !q || c.user.name.toLowerCase().includes(q) || c.user.username.includes(q) || (c.last.text || "").toLowerCase().includes(q));
    if (!rows.length) lb.append(h("div", { class: "empty" }, "No chats yet. Search a username above to start."));
    rows.forEach(c => lb.append(h("div", { class: "row" + (active && active.id === c.user.id ? " on" : ""), onclick: () => openChat(c.user) },
      avatar(c.user), h("div", { class: "mid" }, h("b", {}, c.user.name), h("small", {}, (c.last.from === me.id ? "You: " : "") + (c.last.text || ""))),
      h("div", { class: "rt" }, h("span", {}, c.last.at ? when(c.last.at) : ""), c.unread ? h("span", { class: "badge" }, c.unread) : null))));
  } else if (tab === "contacts") {
    if (!contacts.length) lb.append(h("div", { class: "empty" }, "No contacts yet. Search a username and tap Add."));
    contacts.filter(c => !q || c.name.toLowerCase().includes(q) || c.username.includes(q)).forEach(c => lb.append(h("div", { class: "row" }, avatar(c),
      h("div", { class: "mid", onclick: () => openChat(c) }, h("b", {}, c.name), h("small", {}, "@" + c.username + (c.blocked ? " · blocked" : ""))),
      h("div", { class: "acts" }, h("button", { onclick: () => openChat(c) }, "Chat"), h("button", { onclick: async () => { try { await api("/contacts/remove", { userId: c.id }); await loadContacts(); renderList(); } catch (e) { fail(e); } } }, "Remove")))));
  } else if (tab === "calls") {
    if (!callsList.length) lb.append(h("div", { class: "empty" }, "No calls yet."));
    callsList.forEach(c => lb.append(h("div", { class: "row" }, avatar(c.user),
      h("div", { class: "mid" }, h("b", {}, c.user.name), h("small", { style: c.status === "missed" ? "color:#dc2626" : "" },
        (c.direction === "incoming" ? "↙ " : "↗ ") + (c.type === "video" ? "Video" : "Voice") + " · " + (c.status === "ended" ? (c.duration + "s") : c.status))),
      h("div", { class: "rt" }, h("span", {}, when(c.startedAt)), h("div", { class: "acts" }, h("button", { onclick: () => startCall(c.user, "audio") }, "📞"), h("button", { onclick: () => startCall(c.user, "video") }, "🎥"))))));
  }
  updBadges();
}
async function loadContacts() { contacts = (await api("/contacts")).contacts; }
async function loadCalls() { callsList = (await api("/calls")).calls; }

/* ---------- tabs ---------- */
async function setTab(t) {
  tab = t; document.querySelectorAll("#nav [data-tab]").forEach(b => b.classList.toggle("on", b.dataset.tab === t));
  $("panes").classList.toggle("single", t === "profile" || t === "settings");
  if (t === "contacts") await loadContacts().catch(fail);
  if (t === "calls") { missed = 0; await loadCalls().catch(fail); }
  renderList(); renderRight();
}
function renderRight() { if (tab === "profile") return renderProfile(); if (tab === "settings") return renderSettings(); renderChat(); }
document.querySelectorAll("#nav [data-tab]").forEach(b => b.onclick = () => { if (b.dataset.tab !== "chats") { document.body.classList.remove("chat-open"); } setTab(b.dataset.tab); });
$("logout").onclick = async () => { try { await api("/logout", {}); } catch (e) {} location.replace("login.html"); };
$("bell").onclick = () => setTab("calls");
$("newchat").onclick = () => { $("gs").focus(); toast("Type a username to find people"); };

/* ---------- search users ---------- */
let sT;
$("gs").oninput = () => {
  renderList(); clearTimeout(sT); const q = $("gs").value.trim();
  if (q.length < 2) { $("sres").hidden = true; return; }
  sT = setTimeout(async () => {
    try {
      const { users } = await api("/users/search?q=" + encodeURIComponent(q)), box = $("sres"); box.textContent = ""; box.hidden = false;
      if (!users.length) box.append(h("div", { class: "empty" }, "No users found"));
      users.forEach(u => box.append(h("div", { class: "row" }, avatar(u, "sm"), h("div", { class: "mid" }, h("b", {}, u.name), h("small", {}, "@" + u.username)),
        h("div", { class: "acts" }, h("button", { onclick: () => { box.hidden = true; $("gs").value = ""; openChat(u); } }, "Chat"),
          h("button", { onclick: async ev => { try { await api("/contacts/add", { userId: u.id }); ev.target.textContent = "Added ✓"; } catch (e) { fail(e); } } }, u.isContact ? "Added ✓" : "Add")))));
    } catch (e) { fail(e); }
  }, 300);
};
document.addEventListener("click", e => { if (!e.target.closest(".sw")) $("sres").hidden = true; });

/* ---------- chat ---------- */
async function openChat(u) {
  tab = "chats"; document.querySelectorAll("#nav [data-tab]").forEach(b => b.classList.toggle("on", b.dataset.tab === "chats")); $("panes").classList.remove("single");
  active = u; replyTo = null; msgs = []; more = false; renderList(); renderChat();
  try { const d = await api("/messages/" + u.id); msgs = d.messages; more = d.more; renderMsgs(true); markRead(); } catch (e) { fail(e); }
}
function markRead() {
  if (!active || document.hidden) return; const c = convOf(active.id);
  if (c && c.unread) { c.unread = 0; renderList(); }
  socket.emit("message:read", { with: active.id }, () => {});
}
function renderChat() {
  const cp = $("cp"); cp.textContent = "";
  if (!active) { document.body.classList.remove("chat-open"); cp.append(h("div", { class: "empty" }, h("div", { class: "big" }, "💬"), h("h3", {}, "Select a chat"), h("p", {}, "Or search a username above to start a conversation."))); return; }
  document.body.classList.add("chat-open");
  const st = h("small", { id: "hst" }, statusText(active)); st.className = active.online ? "on" : "";
  const menu = h("button", { title: "More", onclick: chatMenu }, "⋮");
  cp.append(h("div", { class: "chead" }, h("button", { class: "back", onclick: () => { document.body.classList.remove("chat-open"); } }, "←"), avatar(active, "sm"),
    h("div", { class: "t" }, h("b", {}, active.name), st), h("button", { title: "Video call", onclick: () => startCall(active, "video") }, "🎥"), h("button", { title: "Voice call", onclick: () => startCall(active, "audio") }, "📞"), menu));
  cp.append(h("div", { id: "msgs" }), h("div", { id: "rbar", hidden: true }));
  const input = h("input", { id: "txt", placeholder: "Type a message...", maxlength: 4000, autocomplete: "off" });
  input.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } };
  input.oninput = () => { const now = Date.now(); if (now - typingT > 2000) { typingT = now; socket.emit("typing", { to: active.id, typing: true }); } };
  const emo = h("div", { id: "emo", hidden: true }, ..."😀😂😍😊😉😎🥰😢😭😡👍👎🙏👏🎉❤️🔥💯✨🤝👋😅🤔😴🥳😇🙌💙🇫🇷📚☕🌸".match(/\p{Extended_Pictographic}(?:\uFE0F)?|\p{Regional_Indicator}{2}/gu).map(x => h("button", { onclick: () => { input.value += x; input.focus(); } }, x)));
  cp.append(h("div", { class: "comp" }, emo, h("div", { class: "box" }, h("button", { title: "Emoji", onclick: () => emo.hidden = !emo.hidden }, "😊"), input,
    h("button", { title: "Attach", onclick: () => $("file").click() }, "📎"), h("button", { id: "mic", title: "Voice message", onclick: toggleRec }, "🎤")), h("button", { id: "send", onclick: sendText }, "➤")));
  renderMsgs(true); renderReply();
}
function renderMsgs(bottom) {
  const box = $("msgs"); if (!box) return; const prev = box.scrollHeight; box.textContent = "";
  if (more) box.append(h("button", { class: "more", onclick: loadOlder }, "Load earlier messages"));
  let day = "";
  msgs.forEach(m => { const d = dayLabel(m.createdAt); if (d !== day) { day = d; box.append(h("div", { class: "day" }, d)); } box.append(msgEl(m)); });
  if (bottom) box.scrollTop = box.scrollHeight; else box.scrollTop = box.scrollHeight - prev;
}
async function loadOlder() { try { const d = await api("/messages/" + active.id + "?before=" + encodeURIComponent(msgs[0].createdAt)); msgs = d.messages.concat(msgs); more = d.more; renderMsgs(false); } catch (e) { fail(e); } }
function msgEl(m) {
  const mine = m.from === me.id, b = h("div", { class: "b " + (mine ? "out" : "in") + (m.deleted ? " del" : ""), "data-id": m.id });
  if (m.replyTo) b.append(h("div", { class: "rp" }, h("b", {}, m.replyTo.from === me.id ? "You" : active.name), h("span", {}, (m.replyTo.text || "").slice(0, 80))));
  if (m.deleted) b.append("🚫 This message was deleted");
  else {
    if (m.type === "image") b.append(h("a", { href: m.mediaUrl, target: "_blank" }, h("img", { class: "mi", src: m.mediaUrl, alt: "photo" })));
    if (m.type === "voice") b.append(h("audio", { controls: true, src: m.mediaUrl }));
    if (m.type === "file") b.append(h("a", { class: "fl", href: m.mediaUrl, download: m.fileName || "file" }, "📄 " + (m.fileName || "File")));
    if (m.text) b.append(h("div", { class: "tx" }, m.text));
  }
  b.append(h("span", { class: "mt" }, tm(m.createdAt) + (m.editedAt && !m.deleted ? " · edited" : ""), mine && !m.deleted ? h("span", { class: "tk " + m.status }, m.status === "sent" ? "✓" : "✓✓") : null));
  b.onclick = e => {
    if (e.target.closest("a,audio,button")) return;
    const old = b.querySelector(".act"); document.querySelectorAll(".act").forEach(x => x.remove()); if (old) return;
    if (m.deleted) return;
    const a = h("div", { class: "act" }, h("button", { onclick: () => { replyTo = m; renderReply(); $("txt").focus(); } }, "↩ Reply"),
      m.text ? h("button", { onclick: () => navigator.clipboard && navigator.clipboard.writeText(m.text).then(() => toast("Copied")) }, "Copy") : null,
      mine && m.type === "text" ? h("button", { onclick: () => { const t = prompt("Edit message", m.text); if (t && t.trim()) socket.emit("message:edit", { id: m.id, text: t }, r => r && r.error && toast(r.error)); } }, "✎ Edit") : null,
      mine ? h("button", { onclick: () => { if (confirm("Delete this message for everyone?")) socket.emit("message:delete", { id: m.id }, r => r && r.error && toast(r.error)); } }, "🗑 Delete") : null);
    b.append(a);
  };
  return b;
}
function renderReply() {
  const r = $("rbar"); if (!r) return; r.hidden = !replyTo; r.textContent = ""; if (!replyTo) return;
  r.append(h("span", {}, "↩ Replying to " + (replyTo.from === me.id ? "yourself" : active.name) + ": " + (replyTo.text || replyTo.fileName || replyTo.type).slice(0, 60)), h("button", { onclick: () => { replyTo = null; renderReply(); } }, "✖"));
}
function addMsg(m) { if (!msgs.some(x => x.id === m.id)) msgs.push(m); }
function sendRaw(payload) {
  if (!active) return;
  socket.emit("message:send", { to: active.id, replyTo: replyTo ? replyTo.id : undefined, ...payload }, r => {
    if (!r || !r.ok) return toast((r && r.error) || "Could not send");
    addMsg(r.message); touch(active, r.message); replyTo = null; renderReply(); renderMsgs(true);
  });
}
function sendText() { const i = $("txt"), t = i.value.trim(); if (!t) return; i.value = ""; $("emo").hidden = true; sendRaw({ type: "text", text: t }); }
function touch(user, m) {
  let c = convOf(user.id);
  if (!c) { c = { user, last: {}, unread: 0 }; convs.unshift(c); }
  c.last = { text: m.type === "text" ? m.text : (m.type === "image" ? "📷 Photo" : m.type === "voice" ? "🎤 Voice message" : "📄 " + (m.fileName || "File")), type: m.type, at: m.createdAt, from: m.from };
  convs = [c, ...convs.filter(x => x !== c)]; renderList();
}
async function upload(blob, kind, name) {
  const r = await fetch(`/api/cc/upload?kind=${kind}&to=${active ? active.id : ""}&name=${encodeURIComponent(name || "")}`, { method: "POST", headers: { "Content-Type": blob.type || "application/octet-stream" }, body: blob });
  const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "Upload failed"); return d;
}
$("file").onchange = async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f || !active) return;
  try { toast("Uploading…"); const kind = f.type.startsWith("image/") ? "image" : "file"; const d = await upload(f, kind, f.name); sendRaw({ type: kind, mediaId: d.mediaId }); }
  catch (x) { fail(x); }
};
let rec = null;
async function toggleRec() {
  const mic = $("mic"); if (rec) { rec.stop(); return; }
  try {
    const st = await navigator.mediaDevices.getUserMedia({ audio: true }), chunks = [], mr = new MediaRecorder(st); rec = mr;
    mr.ondataavailable = e => chunks.push(e.data);
    mr.onstop = async () => { st.getTracks().forEach(t => t.stop()); rec = null; if (mic) mic.classList.remove("rec"); const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
      if (blob.size > 800) try { const d = await upload(blob, "voice", "voice"); sendRaw({ type: "voice", mediaId: d.mediaId }); } catch (x) { fail(x); } };
    mr.start(); mic.classList.add("rec"); toast("Recording… tap the mic again to send");
  } catch { toast("Microphone permission is needed"); }
}
function chatMenu() {
  const c = convOf(active.id), blocked = c && c.user.blocked;
  const pick = prompt("Type a number:\n1 = Search in chat\n2 = " + (blocked ? "Unblock" : "Block") + " user\n3 = Report user\n4 = Add to contacts");
  if (pick === "1") { const t = prompt("Search messages for:"); if (t) api("/messages/" + active.id + "?q=" + encodeURIComponent(t)).then(d => { msgs = d.messages; more = false; renderMsgs(true); toast(d.messages.length + " result(s). Reopen the chat to see all."); }).catch(fail); }
  else if (pick === "2") api("/block", { userId: active.id, blocked: !blocked }).then(() => { if (c) c.user.blocked = !blocked; toast(blocked ? "Unblocked" : "Blocked"); }).catch(fail);
  else if (pick === "3") { const r = prompt("Why are you reporting this user?"); if (r) api("/report", { userId: active.id, reason: r }).then(() => toast("Report sent")).catch(fail); }
  else if (pick === "4") api("/contacts/add", { userId: active.id }).then(() => toast("Added to contacts")).catch(fail);
}

/* ---------- profile & settings ---------- */
function renderProfile() {
  const cp = $("cp"); cp.textContent = ""; document.body.classList.add("chat-open");
  const f = {}; const fld = (k, l, v, tag = "input") => { f[k] = h(tag, { value: v, maxlength: k === "bio" ? 160 : 60 }); if (tag === "textarea") f[k].textContent = v; return [h("label", {}, l), f[k]]; };
  const pic = h("div", { id: "pp" }, avatar(me, "lgx"));
  cp.append(h("div", { class: "form" }, h("h2", {}, "My profile"), pic,
    h("button", { class: "btn gray", onclick: () => { const i = h("input", { type: "file", accept: "image/*" }); i.onchange = async () => { try { const d = await upload(i.files[0], "avatar", i.files[0].name); me.avatar = d.url; pic.textContent = ""; pic.append(avatar(me, "lgx")); setMeBtn(); toast("Photo updated"); } catch (x) { fail(x); } }; i.click(); } }, "Change photo"),
    ...fld("name", "Full name", me.name), ...fld("username", "Username", me.username), ...fld("bio", "Bio", me.bio || "", "textarea"),
    h("button", { class: "btn", onclick: async () => { try { await api("/profile", { name: f.name.value, username: f.username.value, bio: f.bio.value }); me.name = f.name.value; me.username = f.username.value.toLowerCase(); me.bio = f.bio.value; toast("Saved"); } catch (x) { fail(x); } } }, "Save changes")));
}
async function renderSettings() {
  const cp = $("cp"); cp.textContent = ""; document.body.classList.add("chat-open");
  await loadContacts().catch(() => {});
  const tg = h("input", { type: "checkbox", checked: me.showStatus ? "checked" : null });
  tg.onchange = async () => { try { await api("/profile", { showStatus: tg.checked }); me.showStatus = tg.checked; toast("Privacy updated"); } catch (x) { fail(x); } };
  const blocked = contacts.filter(c => c.blocked);
  cp.append(h("div", { class: "form" }, h("h2", {}, "Settings"),
    h("div", { class: "sw2" }, h("div", {}, h("b", {}, "Show online status & last seen"), h("br"), h("small", {}, "If off, others cannot see yours.")), tg),
    h("h3", {}, "Blocked users"), blocked.length ? blocked.map(u => h("div", { class: "sw2" }, h("span", {}, u.name + " (@" + u.username + ")"), h("button", { class: "btn gray", onclick: async () => { try { await api("/block", { userId: u.id, blocked: false }); renderSettings(); } catch (x) { fail(x); } } }, "Unblock"))) : h("small", {}, "No blocked users."),
    h("button", { class: "btn gray", onclick: () => $("logout").click() }, "Logout"),
    h("button", { class: "btn red", onclick: async () => { const pw = prompt("Delete your account and all your messages? Enter your password to confirm:"); if (!pw) return; try { await api("/account/delete", { password: pw }); location.replace("login.html"); } catch (x) { fail(x); } } }, "Delete my account")));
}
function setMeBtn() { const b = $("meb"); b.textContent = ""; b.append(avatar(me)); }
$("meb").onclick = () => setTab("profile");

/* ---------- sockets ---------- */
const socket = io();
socket.on("connect_error", e => { if (/unauthorized/i.test(e.message)) location.replace("login.html"); });
socket.on("message:new", m => {
  const other = m.from === me.id ? m.to : m.from; let c = convOf(other);
  const isActive = active && active.id === other;
  if (isActive) { addMsg(m); renderMsgs(true); if (!document.hidden && m.from !== me.id) markRead(); }
  if (!c) { loadConvs().then(renderList).catch(() => {}); return; }
  touch(c.user, m); if (!isActive && m.from !== me.id) { c.unread = (c.unread || 0) + 1; renderList(); }
});
socket.on("message:updated", m => { const i = msgs.findIndex(x => x.id === m.id); if (i >= 0) { msgs[i] = m; renderMsgs(false); } });
socket.on("message:status", ({ ids, status }) => { let ch = false; msgs.forEach(m => { if (ids.includes(m.id)) { m.status = status; ch = true; } }); if (ch) renderMsgs(false); });
socket.on("presence", p => {
  const c = convOf(p.userId); if (c) { c.user.online = p.online; c.user.lastSeen = p.lastSeen; renderList(); }
  if (active && active.id === p.userId) { active.online = p.online; active.lastSeen = p.lastSeen; const s = $("hst"); if (s) { s.textContent = statusText(active); s.className = active.online ? "on" : ""; } }
});
socket.on("typing", ({ from, typing }) => {
  if (!active || active.id !== from) return; const s = $("hst"); if (!s) return; s.textContent = "typing…"; s.className = "on";
  clearTimeout(socket._tt); socket._tt = setTimeout(() => { s.textContent = statusText(active); s.className = active.online ? "on" : ""; }, 3000);
});
document.addEventListener("visibilitychange", () => { if (!document.hidden) markRead(); });

/* ---------- calls (WebRTC, signaling through Socket.IO) ---------- */
let call = null, incoming = null, iceServers = null, ringT;
async function getMedia(type, facing = "user") { return navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" ? { facingMode: facing } : false }); }
async function ensureIce() { if (!iceServers) iceServers = (await api("/ice")).iceServers; }
function showCall(state) {
  $("callbox").hidden = false; $("cin").hidden = state !== "in"; $("cact").hidden = state === "in";
  if (state !== "in") {
    $("cname").textContent = call.peer.name; $("lv").hidden = call.type !== "video"; $("c-cam").hidden = $("c-flip").hidden = call.type !== "video";
    $("lv").srcObject = call.local; $("rav").textContent = ""; if (call.type !== "video") $("rav").append(avatar(call.peer, "lgx"));
  }
}
function cleanupCall() {
  if (call) { clearInterval(call.timer); call.local && call.local.getTracks().forEach(t => t.stop()); call.pc && call.pc.close(); }
  call = null; incoming = null; $("callbox").hidden = true; $("rv").hidden = false; $("rv").srcObject = null; $("lv").srcObject = null;
  ["c-mute", "c-cam"].forEach(i => $(i).classList.remove("off"));
}
function startTimer() {
  if (!call || call.start) return; call.start = Date.now();
  call.timer = setInterval(() => { const s = Math.floor((Date.now() - call.start) / 1000); $("cstat").textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }, 1000);
}
function makePc() {
  const pc = new RTCPeerConnection({ iceServers });
  pc.onicecandidate = e => e.candidate && call && socket.emit("call:signal", { callId: call.id, data: { candidate: e.candidate } });
  pc.ontrack = e => { $("rv").srcObject = e.streams[0]; $("rv").hidden = call.type !== "video"; if (call.type !== "video") { const a = $("rv"); a.hidden = true; a.play && a.play().catch(() => {}); } startTimer(); };
  pc.onconnectionstatechange = () => { if (pc.connectionState === "failed") { toast("Call connection failed"); endCall(); } };
  call.local.getTracks().forEach(t => pc.addTrack(t, call.local)); return pc;
}
async function startCall(u, type) {
  if (call || incoming) return toast("You are already in a call");
  let local; try { await ensureIce(); local = await getMedia(type); } catch (e) { return toast("Allow microphone" + (type === "video" ? " and camera" : "") + " access to call"); }
  socket.emit("call:invite", { to: u.id, type }, r => {
    if (!r || !r.ok) { local.getTracks().forEach(t => t.stop()); loadCalls().catch(() => {}); return toast((r && r.error) || "Call failed"); }
    call = { id: r.callId, peer: u, type, local, queue: [], facing: "user" }; showCall("out"); $("cstat").textContent = "Calling…";
  });
}
socket.on("call:incoming", ({ callId, type, from }) => {
  if (call || incoming) { socket.emit("call:reject", { callId }, () => {}); return; }
  incoming = { callId, type, from }; $("cin-av").textContent = ""; $("cin-av").append(avatar(from, "lgx")); $("cin-name").textContent = from.name;
  $("cin-type").textContent = "Incoming " + (type === "video" ? "video" : "voice") + " call…"; $("callbox").hidden = false; $("cin").hidden = false; $("cact").hidden = true;
});
$("c-rej").onclick = () => { if (incoming) socket.emit("call:reject", { callId: incoming.callId }, () => {}); cleanupCall(); loadCalls().catch(() => {}); };
$("c-acc").onclick = async () => {
  const inc = incoming; if (!inc) return; let local;
  try { await ensureIce(); local = await getMedia(inc.type); } catch (e) { toast("Allow microphone" + (inc.type === "video" ? " and camera" : "") + " access to answer"); return $("c-rej").onclick(); }
  call = { id: inc.callId, peer: inc.from, type: inc.type, local, queue: [], facing: "user" }; incoming = null; showCall("act"); $("cstat").textContent = "Connecting…";
  socket.emit("call:accept", { callId: inc.callId }, r => { if (!r || !r.ok) { toast((r && r.error) || "Call is no longer available"); cleanupCall(); } });
};
socket.on("call:accepted", async ({ callId }) => {
  if (!call || call.id !== callId) return; $("cstat").textContent = "Connecting…"; call.pc = makePc();
  const o = await call.pc.createOffer(); await call.pc.setLocalDescription(o); socket.emit("call:signal", { callId, data: { sdp: call.pc.localDescription } });
});
socket.on("call:signal", async ({ callId, data }) => {
  if (!call || call.id !== callId) return;
  try {
    if (data.sdp) {
      if (!call.pc) call.pc = makePc(); await call.pc.setRemoteDescription(data.sdp);
      for (const c of call.queue) await call.pc.addIceCandidate(c); call.queue = [];
      if (data.sdp.type === "offer") { const a = await call.pc.createAnswer(); await call.pc.setLocalDescription(a); socket.emit("call:signal", { callId, data: { sdp: call.pc.localDescription } }); }
    } else if (data.candidate) { if (call.pc && call.pc.remoteDescription) await call.pc.addIceCandidate(data.candidate); else call.queue.push(data.candidate); }
  } catch (e) { console.error("signal", e); }
});
socket.on("call:ended", ({ callId, reason }) => {
  const mine = (call && call.id === callId) || (incoming && incoming.callId === callId);
  if (mine) {
    const who = (call && call.peer.name) || (incoming && incoming.from.name) || "";
    if (reason === "missed" && incoming) { missed++; toast("Missed call from " + who); } else if (reason === "rejected") toast("Call declined"); else if (reason !== "self") toast("Call ended");
    cleanupCall();
  }
  loadCalls().then(() => tab === "calls" && renderList()).catch(() => {}); updBadges();
});
function endCall() { if (call) socket.emit("call:end", { callId: call.id }, () => {}); cleanupCall(); loadCalls().catch(() => {}); }
$("c-end").onclick = endCall;
$("c-mute").onclick = () => { const t = call.local.getAudioTracks()[0]; if (!t) return; t.enabled = !t.enabled; $("c-mute").classList.toggle("off", !t.enabled); $("c-mute").textContent = t.enabled ? "🎤" : "🔇"; };
$("c-cam").onclick = () => { const t = call.local.getVideoTracks()[0]; if (!t) return; t.enabled = !t.enabled; $("c-cam").classList.toggle("off", !t.enabled); };
$("c-flip").onclick = async () => {
  try {
    const old = call.local.getVideoTracks()[0]; if (!old) return; call.facing = call.facing === "user" ? "environment" : "user";
    const nt = (await getMedia("video", call.facing)).getVideoTracks()[0]; const sender = call.pc && call.pc.getSenders().find(s => s.track && s.track.kind === "video");
    if (sender) await sender.replaceTrack(nt); old.stop(); call.local.removeTrack(old); call.local.addTrack(nt); $("lv").srcObject = call.local;
  } catch (e) { toast("Cannot switch camera on this device"); }
};

/* ---------- start ---------- */
(async () => {
  try {
    me = (await api("/me")).user; setMeBtn(); await Promise.all([loadConvs(), loadCalls()]);
    missed = callsList.filter(c => c.direction === "incoming" && c.status === "missed" && Date.now() - new Date(c.startedAt) < 864e5).length;
    renderList(); renderChat();
    const u = new URLSearchParams(location.search).get("u"); if (u) { const { users } = await api("/users/search?q=" + encodeURIComponent(u)); const f = users.find(x => x.username === u.toLowerCase()); if (f) openChat(f); }
  } catch (e) { if (e.message !== "Please login") fail(e); }
})();
