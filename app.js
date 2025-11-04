// app.js — English Mastery Voice (Mastrius Edition)
// ✅ Groq AI + Formspree integration + Placement + EM Login

const $ = (s) => document.querySelector(s);
const chat = $("#chat");
const progressBar = $("#progressBar");
const progressText = $("#progressText");
const reward = $("#reward");
const resultModal = $("#resultModal");
const diagnosticBox = $("#diagnostic");

// ==== CONFIGURAÇÕES ====
const FORMSPREE_LEADS = "https://formspree.io/f/mdkproyy";
const FORMSPREE_STUDENTS = "https://formspree.io/f/xjkpqvjp";

// se estiver hospedado com server.js com endpoint /api/chat (Groq)
const USE_GROQ = true;

const state = {
  mode: "visitor", // visitor | student
  lead: null,
  student: null,
  placement: {
    level: "A2",
    correctStreak: 0,
    wrongStreak: 0,
    seen: new Set(),
    asked: 0,
    max: 9,
    score: { A1: 0, A2: 0, B1: 0 },
    finished: false,
  },
  pools: null,
  canDos: null,
  history: [],
};

// ==== UI helpers ====
function addMsg(role, text) {
  const row = document.createElement("div");
  row.className = `msg ${role}`;
  row.innerHTML = `<div class="bubble">${text}</div>`;
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
  state.history.push({ ts: Date.now(), role, text });
}
function setProgress(p) {
  progressBar.style.width = `${p}%`;
  progressText.textContent = `${p}%`;
  if (p >= 100) reward.textContent = "🟢 Reward";
}
function switchTab(tab) {
  document
    .querySelectorAll(".tab")
    .forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  $("#panel-visitor").classList.toggle("hidden", tab !== "visitor");
  $("#panel-student").classList.toggle("hidden", tab !== "student");
  state.mode = tab === "visitor" ? "visitor" : "student";
}
document.querySelectorAll(".tab").forEach((b) =>
  b.addEventListener("click", () => switchTab(b.dataset.tab))
);

// ==== Storage helpers ====
function keyForLead(l) {
  if (l?.email) return `lead:${l.email.toLowerCase()}`;
  return `lead:${l.name?.toLowerCase().replace(/\s+/g, "_")}`;
}
function keyForStudent(s) {
  return `student:${(s.firstName + s.lastName)
    .toLowerCase()
    .replace(/\s+/g, "")}`;
}
function saveLocal(key, data) {
  const prev = JSON.parse(localStorage.getItem(key) || "{}");
  localStorage.setItem(key, JSON.stringify({ ...prev, ...data }));
}
function loadLocal(key) {
  return JSON.parse(localStorage.getItem(key) || "{}");
}

// ==== Form actions ====
$("#startPlacement").addEventListener("click", () => {
  const fd = new FormData($("#leadForm"));
  const lead = {
    name: fd.get("name").trim(),
    email: fd.get("email").trim(),
    whats: fd.get("whats").trim(),
  };
  if (!lead.name || !lead.email) {
    alert("Preencha nome e e-mail.");
    return;
  }
  state.lead = lead;
  saveLocal(keyForLead(lead), { ...lead, startedAt: Date.now() });
  sendForm(FORMSPREE_LEADS, { ...lead, startedAt: new Date().toISOString() });
  startPlacementFlow();
});

$("#unlockStudent").addEventListener("click", () => {
  const fd = new FormData($("#studentLogin"));
  const f = fd.get("firstName").trim();
  const l = fd.get("lastName").trim();
  const p = fd.get("password").trim();
  if (!f || !l) return alert("Preencha nome e sobrenome.");
  if (p !== "destrave") return alert("Senha incorreta.");
  const stu = { firstName: f, lastName: l, login: (f + l).toLowerCase() };
  state.student = stu;
  saveLocal(keyForStudent(stu), { ...stu, unlockedAt: Date.now() });
  sendForm(FORMSPREE_STUDENTS, {
    ...stu,
    unlockedAt: new Date().toISOString(),
  });
  addMsg(
    "bot",
    `Bem-vindo(a), <b>${f}</b>! 🎉 Modo conversa desbloqueado. Escolha um tema para praticar:`
  );
  offerThemes("A2");
});

// ==== Chat controls ====
$("#sendBtn").addEventListener("click", handleUserInput);
$("#composerInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleUserInput();
});

async function handleUserInput() {
  const text = $("#composerInput").value.trim();
  if (!text) return;
  $("#composerInput").value = "";
  addMsg("user", text);

  if (text.toLowerCase() === "reset") return resetPlacement(true);

  if (state.mode === "visitor" && !state.placement.finished)
    return handlePlacementAnswer(text);

  const lev = estimateLevel();
  const reply = USE_GROQ
    ? await aiReplyGroq(text, lev)
    : coachStyleReply(text, lev);
  addMsg("bot", reply);
  collectInsights(text, lev);
  setProgress(Math.min(100, (state.history.length / 40) * 100));
}

// ==== Placement logic ====
async function loadPools() {
  if (!state.pools) {
    const r = await fetch("./data/questions.json");
    state.pools = await r.json();
  }
}
async function startPlacementFlow() {
  resetPlacement();
  addMsg("bot", "Vamos começar! Responda direto no chat. 🎯");
  nextQuestion();
}
function resetPlacement(silent = false) {
  state.placement = {
    level: "A2",
    correctStreak: 0,
    wrongStreak: 0,
    seen: new Set(),
    asked: 0,
    max: 9,
    score: { A1: 0, A2: 0, B1: 0 },
    finished: false,
  };
  setProgress(0);
  if (!silent) addMsg("bot", "Placement reiniciado!");
}
async function nextQuestion() {
  await loadPools();
  const lvl = state.placement.level;
  const pool = state.pools[lvl].filter((q) => !state.placement.seen.has(q.id));
  if (!pool.length) return finalizePlacement();
  const q = pool[Math.floor(Math.random() * pool.length)];
  state.placement.current = q;
  state.placement.seen.add(q.id);
  state.placement.asked++;
  const p = Math.round((state.placement.asked / state.placement.max) * 100);
  setProgress(Math.min(p, 95));
  const txt =
    q.type === "mc"
      ? `${q.q}<br>${q.options
          .map((o, i) => `<br>${i + 1}) ${o}`)
          .join("")}<br><i>Responda com o número.</i>`
      : `${q.q}<i> (responda com a palavra)</i>`;
  addMsg("bot", txt);
}
function handlePlacementAnswer(t) {
  const q = state.placement.current;
  if (!q) return;
  const correct =
    q.type === "mc"
      ? parseInt(t.trim(), 10) - 1 === q.answer
      : t.trim().toLowerCase() === q.answer.toLowerCase();

  if (correct) {
    addMsg("bot", "✅ Boa!");
    state.placement.score[q.level ?? state.placement.level]++;
    state.placement.correctStreak++;
    state.placement.wrongStreak = 0;
    if (state.placement.correctStreak >= 2 && state.placement.level === "A2")
      state.placement.level = "B1";
  } else {
    addMsg(
      "bot",
      `❌ Quase. Resposta esperada: <b>${
        q.type === "mc" ? q.options[q.answer] : q.answer
      }</b>`
    );
    state.placement.wrongStreak++;
    state.placement.correctStreak = 0;
    if (state.placement.wrongStreak >= 2 && state.placement.level === "A2")
      state.placement.level = "A1";
  }
  if (state.placement.asked >= state.placement.max) finalizePlacement();
  else nextQuestion();
}
function finalizePlacement() {
  state.placement.finished = true;
  const { score } = state.placement;
  const best =
    Object.entries(score).sort((a, b) => b[1] - a[1])[0]?.[0] || "A2";
  const diag = `
  <p><b>Nível estimado:</b> ${best}</p>
  <p><b>Pontos fortes:</b> ${strengths(best)}</p>
  <p><b>O que melhorar:</b> ${weakness(best)}</p>`;
  showResult(diag);
  const payload = {
    diagnosticLevel: best,
    finishedAt: new Date().toISOString(),
    usage: state.history.length,
  };
  if (state.mode === "visitor" && state.lead) {
    saveLocal(keyForLead(state.lead), payload);
    sendForm(FORMSPREE_LEADS, { ...state.lead, ...payload });
  } else if (state.student) {
    saveLocal(keyForStudent(state.student), payload);
    sendForm(FORMSPREE_STUDENTS, { ...state.student, ...payload });
  }
}
function showResult(html) {
  diagnosticBox.innerHTML = html;
  resultModal.classList.remove("hidden");
}
$("#closeResult").onclick = () => resultModal.classList.add("hidden");

// ==== Conversation & themes ====
async function offerThemes(level) {
  if (!state.canDos) {
    const r = await fetch("./data/can-dos.json");
    state.canDos = await r.json();
  }
  const list = state.canDos[level] || [];
  const html = list
    .map(
      (t, i) =>
        `<button data-t="${encodeURIComponent(
          t
        )}" class="ghost" style="margin:4px">${i + 1}. ${t}</button>`
    )
    .join("");
  addMsg("bot", `Escolha um tema:<br>${html}`);
  const last = chat.lastElementChild;
  last.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () =>
      startThemeConversation(decodeURIComponent(b.dataset.t), level)
    )
  );
}
function startThemeConversation(theme, level) {
  addMsg("bot", `Tema: <b>${theme}</b>. Conte um exemplo real.`);
  state.currentTheme = { theme, level };
}
function strengths(l) {
  if (l === "A1") return "vocabulário básico e clareza na mensagem";
  if (l === "A2") return "fluência em tópicos familiares";
  return "capacidade de expressar opiniões e conectar ideias";
}
function weakness(l) {
  if (l === "A1") return "verbos e preposições";
  if (l === "A2") return "collocations e tempos verbais";
  return "precisão gramatical e variedade lexical";
}
function estimateLevel() {
  const s = state.placement.score;
  return Object.entries(s).sort((a, b) => b[1] - a[1])[0]?.[0] || "A2";
}

// ==== Formspree sender ====
async function sendForm(endpoint, data) {
  const key = `${endpoint}:${data.email || data.login}`;
  const sent = loadLocal(key)?.sent;
  if (sent) return;
  try {
    await fetch(endpoint, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: JSON.stringify(data),
    });
    saveLocal(key, { sent: true });
  } catch (e) {
    console.warn("Formspree error", e);
  }
}

// ==== Groq AI integration ====
async function aiReplyGroq(userText, level) {
  const history = state.history.map((h) => ({
    role: h.role === "bot" ? "assistant" : "user",
    content: h.text,
  }));
  const system = `
  You are Mastrius, an empathetic but demanding English learning coach.
  Respond in ${level}-level English only.
  Be warm, curious, encouraging.
  Give brief contextual feedback and one challenge.
  Never reveal you are AI.
  `;
  const payload = {
    messages: [{ role: "system", content: system }, ...history, { role: "user", content: userText }],
  };
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "(No reply)";
  } catch (e) {
    console.error("Groq error", e);
    return "(connection issue)";
  }
}

// ==== Backup simple AI (offline fallback) ====
function coachStyleReply(text, level) {
  const tips = {
    A1: "Nice try! Practice verb forms (I am / you are).",
    A2: "Good! Add more detail or reason next time.",
    B1: "Great ideas! Try to use linkers like because or although.",
  };
  return `${tips[level] || "Good!"} Tell me more.`;
}

// ==== Insights tracking ====
function collectInsights(t, level) {
  const pain = /(hard|difícil|stuck|problem)/i.test(t);
  const dream = /(job|promotion|travel|viagem|exchange)/i.test(t);
  const wish = /(wish|gostaria|queria)/i.test(t);
  const payload = {
    level,
    pain,
    dream,
    wish,
    len: t.length,
    ts: new Date().toISOString(),
  };
  if (state.mode === "visitor" && state.lead)
    sendForm(FORMSPREE_LEADS, { ...state.lead, ...payload });
  if (state.mode === "student" && state.student)
    sendForm(FORMSPREE_STUDENTS, { ...state.student, ...payload });
}

// ==== Boot ====
(async function init() {
  addMsg(
    "bot",
    "Olá! Eu sou <b>Mastrius</b> 🤖. Posso avaliar seu inglês ou praticar uma conversa com você."
  );
})();
