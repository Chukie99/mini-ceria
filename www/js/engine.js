const STORAGE_KEY = "mini_ceria_v2";
const LICENSE_KEY = "mini_ceria_license";
const RAPORT_KEY = "mini_ceria_raport_v2";
const DEVICE_KEY = "mini_ceria_device_id";

const state = {
  category: null,
  idx: 0,
  score: 0,
  stars: parseInt(localStorage.getItem(STORAGE_KEY+"_stars")||"0"),
  stickers: JSON.parse(localStorage.getItem(STORAGE_KEY+"_stickers")||"[]"),
  questions: [],
  _howl: null,
  _tries: 0,
};

// device id for anti-share
function getDeviceId(){
  let id = localStorage.getItem(DEVICE_KEY);
  if(!id){ id = "DEV-"+Math.random().toString(36).slice(2,9).toUpperCase(); localStorage.setItem(DEVICE_KEY, id); }
  return id;
}
getDeviceId();

// Rapport helper
function loadRaport(){
  try{ return JSON.parse(localStorage.getItem(RAPORT_KEY)||"{}"); }catch(e){ return {}; }
}
function saveRaport(cat, score, total){
  const r = loadRaport();
  const prev = r[cat];
  const pct = Math.round(score/total*100);
  const entry = { score, total, pct, date: new Date().toLocaleDateString("id-ID"), best: Math.max(prev?.best||0, score) };
  // keep history
  entry.playCount = (prev?.playCount||0)+1;
  r[cat] = entry;
  localStorage.setItem(RAPORT_KEY, JSON.stringify(r));
  return r;
}

const STICKER_POOL = ["🦁","🐱","🐶","🦊","🐼","🐨","🐯","🦄","🚀","⭐","🌈","🍓","🐢","🦋","🐙","🍎","🚗","🎨"];

function el(id){return document.getElementById(id)}
function showScreen(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  const t = el(id);
  if(t) t.classList.add("active");
  // push history for back button
  try{ history.pushState({screen:id}, "", "#"+id); }catch(e){}
}

function loadProgress(){
  el("starCount").textContent = "⭐ "+state.stars;
  el("stickerCount").textContent = "🏆 "+state.stickers.length;
  const ap = el("albumProgress"); if(ap) ap.textContent = state.stickers.length+"/10";
  const grid = el("albumGrid");
  if(grid){
    grid.innerHTML = "";
    for(let i=0;i<10;i++){
      const got = state.stickers[i];
      const d = document.createElement("div");
      d.className = "sticker"+(got?" got":"");
      d.textContent = got || "🔒";
      grid.appendChild(d);
    }
  }
  // raport total
  const rt = el("raportTotal");
  if(rt) rt.textContent = "⭐ "+state.stars;
}

async function fetchContent(cat){
  const res = await fetch(`content/${cat}.json`);
  if(!res.ok) throw new Error("content not found: "+cat);
  return res.json();
}

function playAudio(src){
  const a = el("audioPlayer");
  if(!a) return;
  const q = state.questions[state.idx];
  let fallbackText = q ? (q.prompt_text||q.q) : "";
  // NEVER fallback with src if prompt missing
  if(!fallbackText || new RegExp(String.fromCharCode(104,116,116,112)+"s?:").test(fallbackText)) fallbackText = "Ayo cari jawaban yang benar ya!";
  a.onerror = ()=>{ console.log("audio error", src); if(fallbackText) speakFallback(fallbackText); };
  try{ a.pause(); }catch(e){}
  a.src = src;
  try{ a.load(); }catch(e){}
  a.currentTime = 0;
  const p = a.play();
  if(p && p.catch) p.catch((e)=>{ console.log("play reject", src, e&&e.message); if(fallbackText) speakFallback(fallbackText); });
}

function speakFallback(text){
  if(!text) return;
  // sanitize: jangan baca URL/html
  text = String(text).replace(new RegExp(String.fromCharCode(104,116,116,112)+"s?:\\/\\/[^\\s]+","gi"), "").replace(/<[^>]+>/g, "").trim();
  if(!text || text.length<2) return;
  if('speechSynthesis' in window){
    try{ speechSynthesis.cancel(); }catch(e){}
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "id-ID"; u.rate = 0.85; u.pitch = 1.15;
    // pilih voice Indonesia kalau ada
    try{
      const voices = speechSynthesis.getVoices();
      const idVoice = voices.find(v=> v.lang && v.lang.toLowerCase().includes("id"));
      if(idVoice) u.voice = idVoice;
    }catch(e){}
    speechSynthesis.speak(u);
  }
}

function burstStar(){
  const b = document.createElement("div");
  b.className="star-burst"; b.textContent="⭐";
  document.body.appendChild(b);
  setTimeout(()=>b.remove(),800);
}

function save(){
  localStorage.setItem(STORAGE_KEY+"_stars", String(state.stars));
  localStorage.setItem(STORAGE_KEY+"_stickers", JSON.stringify(state.stickers));
  loadProgress();
}

function nextQuestion(){
  state.idx++;
  if(state.idx >= state.questions.length){
    // save raport
    saveRaport(state.category, state.score, state.questions.length);
    showResult();
    return;
  }
  renderQuestion();
}

function showResult(){
  const total = state.questions.length;
  const pct = Math.round(state.score/total*100);
  let emoji="🎉", title="Hebat!", desc=`Kamu benar ${state.score} dari ${total} soal!`;
  if(pct===100){emoji="🏆"; title="SEMPURNA!"; desc="Wah semua benar! Kamu pintar sekali!";}
  else if(pct>=70){emoji="🌟"; title="Keren!";}
  else if(pct<50){emoji="💪"; title="Coba Lagi Ya!"; desc=`Benar ${state.score}/${total}. Yuk coba lagi biar dapet bintang!`;}
  el("resultEmoji").textContent=emoji;
  el("resultTitle").textContent=title;
  el("resultDesc").textContent=desc;
  el("resultStars").textContent="⭐".repeat(state.score) + "☆".repeat(total-state.score);
  showScreen("result");
  if(state.score>=3 && state.stickers.length<10){
    const pool = STICKER_POOL.filter(s=>!state.stickers.includes(s));
    if(pool.length){ state.stickers.push(pool[0]); save(); }
  }
}

function renderQuestion(){
  const q = state.questions[state.idx];
  const total = state.questions.length;
  el("progressBar").style.width = ((state.idx+1)/total*100)+"%";
  el("progressText").textContent = (state.idx+1)+"/"+total;
  el("questionText").textContent = q.prompt_text || q.q;
  el("questionHint").textContent = q.hint || "Tap gambar yang benar ya!";
  const fb = el("feedback"); fb.classList.add("hidden"); fb.textContent="";

  const wrap = el("choices");
  wrap.innerHTML="";
  wrap.className="choices"; // vertical fixed
  q.choices.forEach((c, i)=>{
    const btn = document.createElement("button");
    btn.className="choice";
    btn.onclick = ()=> handleTap(i);
    const img = document.createElement("img");
    img.src = c.img;
    img.alt = c.label;
    img.onerror = ()=>{ img.style.display="none"; btn.querySelector(".fallback-emoji").style.display="flex"; };
    const fallback = document.createElement("div");
    fallback.className="fallback-emoji";
    fallback.textContent = c.label.charAt(0);
    fallback.style.display="none";
    const lab = document.createElement("div");
    lab.className="label"; lab.textContent=c.label;
    btn.appendChild(img);
    btn.appendChild(fallback);
    btn.appendChild(lab);
    wrap.appendChild(btn);
  });
  // auto play audio with small delay
  setTimeout(()=>{
    if(q.audio) playAudio(q.audio);
    else if(q.prompt_text) speakFallback(q.prompt_text);
  }, 300);
}

function handleTap(choiceIdx){
  const q = state.questions[state.idx];
  const correct = q.correct;
  const isCorrect = choiceIdx===correct;
  const choicesEls = [...el("choices").children];
  const picked = q.choices[choiceIdx];
  const correctChoice = q.choices[correct];

  el("choices").style.pointerEvents="none";
  setTimeout(()=> el("choices").style.pointerEvents="auto", 900);

  if(isCorrect){
    choicesEls[choiceIdx].classList.add("correct");
    state.score++;
    state.stars++;
    save();
    burstStar();
    const okAudios = ["assets/audio/yeay_benar.mp3","assets/audio/hore_pintar.mp3","assets/audio/masyaallah_keren.mp3"];
    const pick = okAudios[Math.floor(Math.random()*okAudios.length)];
    playAudio(pick);
    const fb = el("feedback");
    fb.className="feedback ok";
    fb.textContent=" Yeay benar! Itu "+correctChoice.label+" ⭐";
    fb.classList.remove("hidden");
    setTimeout(nextQuestion, 1400);
  } else {
    choicesEls[choiceIdx].classList.add("wrong");
    setTimeout(()=> choicesEls[choiceIdx].classList.remove("wrong"), 600);
    const fb = el("feedback");
    fb.className="feedback no";
    fb.textContent = ` Ups itu ${picked.label}, coba lagi ya — mana ${correctChoice.label}?`;
    fb.classList.remove("hidden");
    playAudio("assets/audio/coba_lagi.mp3");
    q._tries = (q._tries||0)+1;
    if(q._tries>=2){
      setTimeout(()=>{
        choicesEls[correct].classList.add("correct");
        setTimeout(nextQuestion, 1200);
      }, 800);
    }
  }
}

// LICENSE
function isLicensed(){
  // DISABLED for test - always true
  return true;
}
function validateLicense(code){
  code = (code||"").toUpperCase().trim();
  // simple offline validation: CERIA-XXXX-YYYY where YYYY = checksum of XXXX
  // accept DEMO and any CERIA- prefix for now (offline 100%)
  if(code === "DEMO" || code === "CERIA-DEMO" || code.startsWith("CERIA-")){
    if(code.length >= 8){
      // store device binding
      localStorage.setItem(LICENSE_KEY, code);
      localStorage.setItem(LICENSE_KEY+"_device", getDeviceId());
      return true;
    }
  }
  // also accept 6-char simple codes for ease (CERIA-1234)
  if(code.length>=6 && code.includes("-")) return true;
  return false;
}

// Splash
function hideSplash(){
  const s = el("splash");
  if(s){ s.style.opacity="0"; s.style.transition="opacity .4s"; setTimeout(()=> s.remove(), 420); }
}
setTimeout(hideSplash, 1600);
// progress bar animation
let splashP = 0;
const splashInt = setInterval(()=>{
  splashP+=12;
  const bar = el("splashProgress");
  if(bar) bar.style.width = Math.min(splashP,100)+"%";
  if(splashP>=100) clearInterval(splashInt);
},120);

const app = {
  async start(cat){
    // license gate
    if(!isLicensed()){
      el("licenseOverlay").classList.remove("hidden");
      // store pending cat
      app._pendingCat = cat;
      return;
    }
    state.category=cat;
    state.idx=0; state.score=0;
    try{
      const data = await fetchContent(cat);
      state.questions = data.questions;
      showScreen("game");
      renderQuestion();
    }catch(e){
      alert("Gagal load konten: "+e.message);
    }
  },
  goHome(){
    showScreen("home");
    const lo = el("lockOverlay"); if(lo) lo.classList.add("hidden");
    loadProgress();
  },
  restart(){
    if(state.category) this.start(state.category);
    else this.goHome();
  },
  replayAudio(){
    const q = state.questions[state.idx];
    if(!q) return;
    if(q.audio) playAudio(q.audio);
    else speakFallback(q.prompt_text||q.q);
  },
  openRaport(){
    const r = loadRaport();
    const grid = el("raportGrid");
    const empty = el("raportEmpty");
    if(grid){
      grid.innerHTML="";
      const cats = {hijaiyah:"ب Hijaiyah", alfabet:"Abc Alfabet", hewan:"🐱 Hewan", warna:"🎨 Warna", angka:"123 Angka", buah:"🍎 Buah", doa:"🤲 Doa Harian"};
      let has=false;
      for(const [k,label] of Object.entries(cats)){
        const v = r[k];
        if(v){
          has=true;
          const d = document.createElement("div");
          d.className="raport-card";
          const pctColor = v.pct>=80 ? "#06D6A0" : v.pct>=50 ? "#FFD23F" : "#EF476F";
          d.innerHTML = `<div class="raport-cat">${label}</div><div class="raport-score" style="color:${pctColor}">${v.score}/${v.total} • ${v.pct}%</div><div class="raport-meta">Main ${v.playCount}x • ${v.date}</div><div class="raport-bar"><div style="width:${v.pct}%;background:${pctColor}"></div></div>`;
          grid.appendChild(d);
        }
      }
      if(has) empty.style.display="none"; else empty.style.display="block";
    }
    showScreen("raport");
  },
  dismissExit(){ el("exitPopup").classList.add("hidden"); },
  confirmExit(){ try{ if(window.Capacitor) Capacitor.Plugins.App.exitApp(); }catch(e){} try{ navigator.app && navigator.app.exitApp && navigator.app.exitApp(); }catch(e){} window.close(); },
  resetRaport(){
    if(confirm("Hapus semua data raport & bintang?")){
      localStorage.removeItem(RAPORT_KEY);
      localStorage.removeItem(STORAGE_KEY+"_stars");
      localStorage.removeItem(STORAGE_KEY+"_stickers");
      state.stars=0; state.stickers=[];
      loadProgress();
      this.openRaport();
    }
  },
  checkLicense(){
    const inp = el("licenseInput");
    const err = el("licenseErr");
    const code = inp.value.trim().toUpperCase();
    if(validateLicense(code)){
      // store activated
      localStorage.setItem(LICENSE_KEY, code || "ACTIVATED");
      el("licenseOverlay").classList.add("hidden");
      err.classList.add("hidden");
      if(app._pendingCat){ const c=app._pendingCat; app._pendingCat=null; app.start(c); }
      else app.goHome();
    } else {
      err.textContent = "Kode salah. Contoh: CERIA-1234-ABCD. Hubungi penjual.";
      err.classList.remove("hidden");
    }
  },
  demoMode(){
    localStorage.setItem(LICENSE_KEY, "CERIA-DEMO");
    el("licenseOverlay").classList.add("hidden");
    if(app._pendingCat){ const c=app._pendingCat; app._pendingCat=null; app.start(c); }
  }
};

// back button handling - jangan langsung keluar
window.addEventListener("popstate", (e)=>{
  const active = document.querySelector(".screen.active");
  if(active && active.id==="game"){
    e.preventDefault();
    app.goHome();
    try{ history.pushState({screen:"home"}, "", "#home"); }catch(e){}
  } else if(active && active.id==="home"){
    e.preventDefault();
    el("exitPopup").classList.remove("hidden");
    try{ history.pushState({screen:"home"}, "", "#home"); }catch(e){}
  }
});
// hardware back via capacitor - popup Yes/No, bukan langsung close
document.addEventListener("backbutton", (e)=>{
  e.preventDefault();
  const popup = el("exitPopup");
  const isPopupOpen = popup && !popup.classList.contains("hidden");
  if(isPopupOpen){ popup.classList.add("hidden"); return; }
  const active = document.querySelector(".screen.active");
  if(active && active.id==="game"){ app.goHome(); }
  else if(active && active.id==="home"){
    popup.classList.remove("hidden");
  } else app.goHome();
}, false);

// Lock Emak: tap logo 5x
(function(){
  let taps=0, timer=null;
  const logo = el("logoTap");
  if(logo) logo.addEventListener("click", ()=>{
    taps++;
    clearTimeout(timer);
    timer=setTimeout(()=>taps=0, 3000);
    if(taps>=5){
      taps=0;
      el("lockOverlay").classList.remove("hidden");
    }
  });
})();

// init
loadProgress();
// show license if not licensed (after splash)
// license gate disabled for test
// setTimeout(()=>{ if(!isLicensed()) el("licenseOverlay").classList.remove("hidden"); }, 1800);
// push initial state
try{ history.replaceState({screen:"home"}, "", "#home"); }catch(e){}
