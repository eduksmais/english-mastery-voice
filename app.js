// ===== CONFIG =====
const GROQ_API = "/api/chat"; // seu backend no Render
const FORMSPREE_LEADS = "https://formspree.io/f/mdkproyy";
const FORMSPREE_STUDENTS = "https://formspree.io/f/xjkpqvjp";

const $ = (s) => document.querySelector(s);
const screens = ["welcome","intake","placement","result","login","chat"];
function show(id){ screens.forEach(sc => $("#"+sc).classList.toggle("active", sc===id)); }

// ===== NAV =====
$("#btnStartIntake").onclick = () => show("intake");
$("#btnStudentLogin").onclick = () => show("login");
$("#btnBackLogin").onclick = () => show("welcome");

// ===== STATE =====
const state = {
  spinIndex: 0,
  spin: { situation:"", problem:"", implication:"", need:"" },

  placementIdx: 0,
  placementMax: 10,
  levelScores: { A1:0, A2:0, B1:0, B2:0 },
  currentLevel: "A2",
  questions: [],

  lead: null,
  student: null,

  chatHistory: [] // {role: "user"|"assistant", content: "..."}
};

// ===== INTAKE (SPIN) =====
const spinQs = [
  {key:"situation", q:"Qual é sua situação atual com o inglês? (rotina, uso no trabalho/viagem)"},
  {key:"problem",   q:"O que mais te trava quando tenta usar ou estudar inglês?"},
  {key:"implication", q:"Como isso tem impactado seu trabalho, estudos ou oportunidades?"},
  {key:"need",      q:"Se você resolvesse isso nos próximos meses, o que mudaria pra você?"}
];

const intakeArea = $("#intakeArea");
renderSpin();

function renderSpin(){
  if(state.spinIndex >= spinQs.length){
    startPlacement();
    return;
  }
  const item = spinQs[state.spinIndex];
  intakeArea.innerHTML = `
    <h3>${item.q}</h3>
    <textarea id="spinAns" rows="4" placeholder="Escreva aqui..."></textarea>
    <button id="nextSpin" class="btn btn-primary">Continuar</button>
  `;
  $("#nextSpin").onclick = async () => {
    const val = $("#spinAns").value.trim();
    if(!val) return;
    state.spin[item.key] = val;

    // micro-resposta empática (Groq) — curta e motivadora
    const follow = await groqReply(
      [{role:"user",content:val}],
      "Give a short, empathetic, motivating reply. Portuguese. One sentence."
    );
    intakeArea.innerHTML += `<p class="ai-reply">${follow}</p>`;

    setTimeout(() => { state.spinIndex++; renderSpin(); }, 700);
  };
}

// ===== PLACEMENT (Groq + base local) =====
async function startPlacement(){
  show("placement");
  state.placementIdx = 0;
  state.currentLevel = "A2";
  state.levelScores = { A1:0, A2:0, B1:0, B2:0 };

  // carrega base local (garante confiabilidade e foco CEFR)
  const res = await fetch("./data/questions.json");
  const pools = await res.json();

  // cria trilha inicial balanceada (mistura por nível)
  state.questions = buildQuestionPath(pools, state.placementMax);
  renderPlacementQ();
}

function buildQuestionPath(pools, max){
  const out = [];
  const order = ["A2","A1","A2","B1","A2","B1","B2","B1","A2","A1"]; // começa mediano e ajusta
  for(let i=0;i<max;i++){
    const lvl = order[i] || "A2";
    const pool = pools[lvl] || [];
    const q = pool[Math.floor(Math.random()*pool.length)];
    out.push({...q, lvl});
  }
  return out;
}

function renderPlacementQ(){
  const i = state.placementIdx;
  if(i >= state.placementMax){ return endPlacement(); }

  const q = state.questions[i];
  $("#questionCounter").textContent = `Pergunta ${i+1} de ${state.placementMax}`;
  $("#placementBar").style.width = `${(i/state.placementMax)*100}%`;

  if(q.type === "mc"){
    $("#questionArea").innerHTML = `
      <h3>${q.q}</h3>
      ${q.options.map((o,idx)=>`<button class="option-btn" data-i="${idx}">${o}</button>`).join("")}
    `;
    document.querySelectorAll(".option-btn").forEach(b => {
      b.onclick = () => checkPlacementAnswer(q, parseInt(b.dataset.i,10));
    });
  } else {
    $("#questionArea").innerHTML = `
      <h3>${q.q}</h3>
      <input id="gapInput" class="option-btn" placeholder="Digite sua resposta" />
      <button id="gapBtn" class="option-btn" style="text-align:center">Responder</button>
    `;
    $("#gapBtn").onclick = () => {
      const ans = $("#gapInput").value.trim();
      if(!ans) return;
      checkPlacementAnswer(q, ans);
    };
  }
}

async function checkPlacementAnswer(q, userAnswer){
  // verificação local
  const isCorrectLocal = q.type==="mc"
    ? userAnswer === q.answer
    : String(userAnswer).toLowerCase() === String(q.answer).toLowerCase();

  // validação + micro-feedback via Groq (aumenta confiabilidade e dá coaching)
  const feedback = await groqReply(
    [{role:"user", content:
`Question: ${q.q}
Options: ${q.type==="mc"? q.options.join(" | ") : "(gap)"}
User answer: ${q.type==="mc" ? q.options[userAnswer] : userAnswer}
Is correct (local check): ${isCorrectLocal ? "yes" : "no"}`}],
    "Give a concise, encouraging comment for a learner. Portuguese. One sentence."
  );

  // aplica pontuação/ajuste de nível
  if(isCorrectLocal){ state.levelScores[q.lvl]++; adjustLevelUp(); }
  else { adjustLevelDown(); }

  // mostra feedback curto e continua
  const p = document.createElement("p");
  p.className = "ai-reply";
  p.textContent = feedback;
  $("#questionArea").appendChild(p);

  state.placementIdx++;
  setTimeout(renderPlacementQ, 800);
}

function adjustLevelUp(){
  if(state.currentLevel==="A1") state.currentLevel="A2";
  else if(state.currentLevel==="A2") state.currentLevel="B1";
  else if(state.currentLevel==="B1") state.currentLevel="B2";
}
function adjustLevelDown(){
  if(state.currentLevel==="B2") state.currentLevel="B1";
  else if(state.currentLevel==="B1") state.currentLevel="A2";
  else if(state.currentLevel==="A2") state.currentLevel="A1";
}

function endPlacement(){
  $("#placementBar").style.width = "100%";

  // nível = vencedor por score; desempate pelo currentLevel
  const best = Object.entries(state.levelScores).sort((a,b)=>b[1]-a[1])[0]?.[0] || state.currentLevel;
  $("#levelText").textContent = best;
  $("#diagnosticBox").innerHTML = `
    <p><b>Pontos fortes:</b> ${strengths(best)}</p>
    <p><b>Oportunidades:</b> ${weakness(best)}</p>
  `;
  show("result");
}

function strengths(l){ return l==="A1"?"vocabulário básico e clareza"
  : l==="A2"?"tópicos familiares e rotina"
  : l==="B1"?"opiniões e conexão de ideias"
  : "consistência e autonomia em temas variados"; }
function weakness(l){ return l==="A1"?"verbos básicos e preposições"
  : l==="A2"?"collocations e tempos verbais"
  : l==="B1"?"precisão gramatical e variedade lexical"
  : "naturalidade avançada e finesse lexical"; }

// ===== RESULT + LEAD (Formspree, com SPIN)
$("#leadForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const name = $("#leadName").value.trim();
  const email = $("#leadEmail").value.trim();
  const whats = $("#leadWhats").value.trim();
  if(!name || !email) return;

  const payload = {
    name, email, whats,
    level: $("#levelText").textContent,
    ...state.spin,
    finishedAt: new Date().toISOString()
  };
  try{
    await fetch(FORMSPREE_LEADS, { method:"POST", headers:{Accept:"application/json"}, body: JSON.stringify(payload) });
  }catch(e){ console.warn("Formspree lead error", e); }

  state.lead = {name,email,whats};
  $("#leadForm").classList.add("hidden");
  $("#rewardBox").classList.remove("hidden");
});

// ===== LOGIN (sem revelar senha)
$("#btnLogin").onclick = ()=>{
  const pass = $("#studentPass").value.trim();
  const name = $("#studentName").value.trim();
  if(!name || !pass) return;
  if(pass !== "destrave"){ // valida, sem mensagens de dica
    $("#studentPass").value = "";
    $("#studentPass").focus();
    return;
  }
  const student = { name, login: name.toLowerCase().replace(/\s+/g,"") };
  state.student = student;
  localStorage.setItem("em:students:"+student.login, JSON.stringify(student));

  try{
    fetch(FORMSPREE_STUDENTS, { method:"POST", headers:{Accept:"application/json"}, body: JSON.stringify({ name, loginAt: new Date().toISOString() }) });
  }catch(e){}

  show("chat");
  addMsg("assistant","Bem-vindo(a)! Vamos praticar em inglês? Envie uma mensagem quando estiver pronto(a).");
};

// ===== CHAT (Groq)
const chatBox = $("#chatBox");
$("#sendBtn").onclick = onChatSend;
$("#userInput").addEventListener("keydown",(e)=>{ if(e.key==="Enter") onChatSend(); });

function addMsg(role, content){
  const el = document.createElement("div");
  el.className = `chat-message ${role==="user"?"user-message":"ai-message"}`;
  el.innerHTML = content;
  chatBox.appendChild(el);
  chatBox.scrollTop = chatBox.scrollHeight;
  state.chatHistory.push({ role, content: stripHtml(content) });
}
function stripHtml(s){ const d=document.createElement("div"); d.innerHTML=s; return d.textContent||""; }

async function onChatSend(){
  const t = $("#userInput").value.trim();
  if(!t) return;
  $("#userInput").value = "";
  addMsg("user", t);

  const reply = await groqReply(
    [...toGroqHistory(state.chatHistory), {role:"user", content:t}],
    // prompt mínimo no front; o tom/estratégia fina ficam no backend
    "Responda de forma natural, amigável e objetiva em inglês, ajustando ao nível do falante."
  );
  addMsg("assistant", reply);

  // telemetria leve de aluno
  if(state.student){
    try{
      fetch(FORMSPREE_STUDENTS, { method:"POST", headers:{Accept:"application/json"},
        body: JSON.stringify({ name: state.student.name, textLen: t.length, ts: new Date().toISOString() }) });
    }catch(e){}
  }
}

function toGroqHistory(hist){
  // converte mensagens anteriores p/ formato Groq compatível (user/assistant)
  return hist.map(m => ({ role: m.role==="assistant" ? "assistant" : "user", content: m.content }));
}

// ===== Groq helper (usa seu /api/chat)
async function groqReply(messages, systemText){
  try{
    const body = { messages: [{role:"system", content: systemText}, ...messages] };
    const r = await fetch(GROQ_API, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) });
    const data = await r.json();
    return data?.choices?.[0]?.message?.content || "";
  }catch(e){
    console.warn("Groq fail", e);
    return "Desculpe, tive um problema de conexão. Tente novamente.";
  }
}
