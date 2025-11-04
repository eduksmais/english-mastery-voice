// app.js — UI clean + fluxo sequencial + Groq + Formspree + alunos salvos

// ====== CONFIG ======
const FORMSPREE_LEADS = "https://formspree.io/f/mdkproyy";
const FORMSPREE_STUDENTS = "https://formspree.io/f/xjkpqvjp";
const USE_GROQ = true; // usa /api/chat no seu server

// ====== DOM ======
const $ = (s) => document.querySelector(s);
const intro = $("#introScreen");
const qScreen = $("#questionScreen");
const rScreen = $("#resultScreen");
const cScreen = $("#coachScreen");

const bar = $("#bar");
const qEl = $("#question");
const aEl = $("#answers");
const helper = $("#helper");
const resultText = $("#resultText");
const leadForm = $("#leadForm");
const bonus = $("#bonus");

const loginModal = $("#loginModal");
const closeLogin = $("#closeLogin");
const chat = $("#chat");
const composer = $("#composerInput");

// ====== ESTADO ======
const state = {
  // placement
  level: "A2",
  asked: 0,
  max: 9,
  current: null,
  seen: new Set(),
  score: { A1: 0, A2: 0, B1: 0 },
  finished: false,

  // dados
  pools: null,
  canDos: null,

  // usuário
  lead: null,       // {name,email,whats}
  student: null,    // {firstName,lastName,login}
  history: [],      // chat log p/ Groq e insights
};

// ====== HELPERS ======
function setProgress(p){ bar.style.width = `${p}%`; }
function addMsg(role, text){
  const row = document.createElement("div");
  row.className = `msg ${role}`;
  row.innerHTML = `<div class="bubble">${text}</div>`;
  chat.appendChild(row); chat.scrollTop = chat.scrollHeight;
  state.history.push({ ts: Date.now(), role, text });
}
function keyStudent(s){ return `student:${(s.firstName+s.lastName).toLowerCase().replace(/\s+/g,"")}`; }
function keyLead(l){ return `lead:${(l.email||l.name).toLowerCase().replace(/\s+/g,"_")}`; }
function saveLocal(k, obj){ const prev = JSON.parse(localStorage.getItem(k)||"{}"); localStorage.setItem(k, JSON.stringify({...prev, ...obj, updatedAt:Date.now()})); }
function loadLocal(k){ try{ return JSON.parse(localStorage.getItem(k)||"{}"); }catch{return{}} }

// ====== TELA 1 — AÇÕES ======
$("#startBtn").onclick = async () => {
  intro.classList.add("hidden");
  qScreen.classList.remove("hidden");
  await startPlacement();
};
$("#loginBtn").onclick = () => loginModal.classList.remove("hidden");
closeLogin.onclick = () => loginModal.classList.add("hidden");

// ====== LOGIN ALUNO (sem dica de senha) ======
$("#studentLogin").addEventListener("submit", (e)=>{
  e.preventDefault();
  const fd = new FormData(e.target);
  const firstName = fd.get("firstName").trim();
  const lastName  = fd.get("lastName").trim();
  const password  = fd.get("password").trim();

  // validação silenciosa — sem revelar senha no front
  if(!firstName || !lastName || !password) return;

  if(password !== "destrave"){ // não exibir qual é a senha
    e.target.reset();
    e.target.password?.focus();
    return;
  }
  const stu = { firstName, lastName, login:(firstName+lastName).toLowerCase() };
  state.student = stu;
  saveLocal(keyStudent(stu), stu);
  sendForm(FORMSPREE_STUDENTS, { ...stu, unlockedAt: new Date().toISOString() });

  loginModal.classList.add("hidden");
  intro.classList.add("hidden");
  qScreen.classList.add("hidden");
  rScreen.classList.add("hidden");
  cScreen.classList.remove("hidden");

  addMsg("bot","Bem-vindo(a)! Escolha um tema para começarmos ou mande sua mensagem.");
});

// ====== PLACEMENT ======
async function loadPools(){
  if(state.pools) return;
  const r = await fetch("./data/questions.json"); state.pools = await r.json();
}
async function startPlacement(){
  state.level="A2"; state.asked=0; state.seen=new Set(); state.finished=false;
  state.score={A1:0,A2:0,B1:0}; setProgress(0);
  helper.textContent = "Responda no chat abaixo. Uma pergunta por vez.";
  await loadPools();
  nextQ();
}
function nextQ(){
  const pool = state.pools[state.level].filter(q=>!state.seen.has(q.id));
  if(pool.length===0 || state.asked>=state.max){ return endPlacement(); }
  const q = pool[Math.floor(Math.random()*pool.length)];
  state.current=q; state.seen.add(q.id); state.asked++;
  setProgress(Math.min(95, Math.round(state.asked/state.max*100)));

  qEl.innerHTML = q.q;
  if(q.type==="mc"){
    aEl.innerHTML = q.options.map((o,i)=>`<button class="btn ghost" data-i="${i}">${o}</button>`).join("");
  }else{
    aEl.innerHTML = `
      <input id="gapAns" class="gap" placeholder="Digite sua resposta" />
      <button id="gapBtn" class="btn primary">Responder</button>`;
  }
}
aEl.addEventListener("click",(e)=>{
  if(!(e.target instanceof HTMLElement))return;
  if(e.target.matches("[data-i]")){
    const sel = parseInt(e.target.dataset.i,10);
    checkAnswer(sel);
  }
});
aEl.addEventListener("click",(e)=>{
  if(!(e.target instanceof HTMLElement))return;
  if(e.target.id==="gapBtn"){
    const v = $("#gapAns")?.value?.trim()||"";
    checkAnswer(v);
  }
});
function checkAnswer(val){
  const q=state.current; if(!q) return;
  let ok=false;
  if(q.type==="mc"){ ok = (val===q.answer); }
  else{ ok = (String(val).toLowerCase()===q.answer.toLowerCase()); }

  helper.innerHTML = ok ? "✅ Boa!" : `❌ Quase. Correto: <b>${q.type==="mc"?q.options[q.answer]:q.answer}</b>`;
  if(ok){ state.score[state.level]++; if(state.level==="A2") state.level="B1"; }
  else{ if(state.level==="A2") state.level="A1"; }

  setTimeout(()=>{ helper.textContent=""; nextQ(); }, 700);
}
function endPlacement(){
  state.finished=true;
  const best = Object.entries(state.score).sort((a,b)=>b[1]-a[1])[0]?.[0] || "A2";
  qScreen.classList.add("hidden");
  rScreen.classList.remove("hidden");
  setProgress(100);
  resultText.innerHTML = `
    <p><b>Nível estimado:</b> ${best}</p>
    <p><b>Pontos fortes:</b> ${strengths(best)}</p>
    <p><b>O que melhorar:</b> ${weakness(best)}</p>
  `;
  // mantém gate de lead — só revela quando enviar o form
}

// ====== LEAD GATE (revela diagnóstico + bônus e envia ao Formspree) ======
leadForm.addEventListener("submit",(e)=>{
  e.preventDefault();
  const fd = new FormData(leadForm);
  const lead = {
    name: (fd.get("name")||"").trim(),
    email: (fd.get("email")||"").trim(),
    whats: (fd.get("whats")||"").trim(),
  };
  if(!lead.name || !lead.email) return;

  state.lead = lead;
  saveLocal(keyLead(lead), lead);
  sendForm(FORMSPREE_LEADS, {
    ...lead,
    diagnosticLevel: currentLevel(),
    finishedAt: new Date().toISOString()
  });

  // Revela bônus
  $("#revealBtn").disabled = true;
  bonus.classList.remove("hidden");
});

// ====== CONVERSA (ALUNO) ======
$("#themesBtn").onclick = async ()=>{
  const level = currentLevel();
  const list = await getThemes(level);
  addMsg("bot", "Escolha um tema:");
  list.forEach((t,i)=>{
    addMsg("bot", `<button class="btn ghost" data-theme="${encodeURIComponent(t)}">${i+1}. ${t}</button>`);
    // delegação simples
    const last = chat.lastElementChild.querySelector("button");
    last.onclick = () => addMsg("bot", `Tema: <b>${t}</b>. Conte um exemplo real.`);
  });
};
$("#sendBtn").onclick = onUserSend;
composer.addEventListener("keydown",(e)=>{ if(e.key==="Enter") onUserSend(); });

async function onUserSend(){
  const text = composer.value.trim(); if(!text) return;
  composer.value=""; addMsg("user", text);

  const level = currentLevel();
  const reply = USE_GROQ ? await aiReplyGroq(text, level) : coachReply(text, level);
  addMsg("bot", reply);

  // insights + salvar aluno
  if(state.student){
    const key = keyStudent(state.student);
    saveLocal(key, { lastInteractionAt: Date.now() });
    sendForm(FORMSPREE_STUDENTS, { ...state.student, level, textLen:text.length });
  }
}

// ====== AI (Groq) ======
async function aiReplyGroq(userText, level){
  const history = state.history.map(h=>({ role: h.role==="bot"?"assistant":"user", content: h.text }));
  const system = `
    You are Mastrius, an educational coach for English Mastery.
    Speak ${level}-level English. Be warm, curious, encouraging.
    Give short contextual replies, one micro feedback, and one light challenge.
    Never reveal you are an AI or mention passwords.
  `;
  const payload = { messages: [{role:"system",content:system}, ...history, {role:"user",content:userText}] };
  try{
    const r = await fetch("/api/chat", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
    const data = await r.json();
    return data?.choices?.[0]?.message?.content || "(sem resposta)";
  }catch(e){
    console.warn("Groq error", e);
    return coachReply(userText, level);
  }
}

// ====== DADOS AUX ======
function strengths(l){ if(l==="A1") return "vocabulário básico e clareza"; if(l==="A2") return "tópicos do dia a dia"; return "opiniões e conexão de ideias"; }
function weakness(l){ if(l==="A1") return "verbos e preposições"; if(l==="A2") return "collocations e tempos verbais"; return "precisão e variedade lexical"; }
function currentLevel(){
  if(!state.finished) return "A2";
  return Object.entries(state.score).sort((a,b)=>b[1]-a[1])[0]?.[0] || "A2";
}
function coachReply(_t,l){ return ({"A1":"Nice! Tell me one more example.","A2":"Good! Add one detail or reason.","B1":"Great! Try linking ideas with because/although."}[l]||"Tell me more."); }
async function getThemes(level){
  if(!state.canDos){ const r = await fetch("./data/can-dos.json"); state.canDos = await r.json(); }
  return state.canDos[level] || ["Daily routine","Work tasks","Travel plans"];
}

// ====== FORMSPREE ======
async function sendForm(endpoint, data){
  try{
    await fetch(endpoint,{ method:"POST", headers:{Accept:"application/json"}, body: JSON.stringify(data) });
  }catch(e){ console.warn("Formspree", e); }
}

// ====== BOOT ======
addEventListener("DOMContentLoaded", ()=>{
  // apenas inicia — tudo é acionado por botões
});
