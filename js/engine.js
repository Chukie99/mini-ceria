const STORAGE_KEY = "mini_ceria_v1";
const state = {
  category: null,
  idx: 0,
  score: 0,
  stars: parseInt(localStorage.getItem(STORAGE_KEY+"_stars")||"0"),
  stickers: JSON.parse(localStorage.getItem(STORAGE_KEY+"_stickers")||"[]"),
  questions: [],
  _howl: null,
  _lockTaps: 0,
  _lockTimer: null,
};

const STICKER_POOL = ["🦁","🐱","🐶","🦊","🐼","🐨","🐯","🦄","🚀","⭐","🌈","🍓","🐢","🦋","🐙"];

function el(id){return document.getElementById(id)}
function showScreen(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  el(id).classList.add("active");
}

function loadProgress(){
  el("starCount").textContent = "⭐ "+state.stars;
  el("stickerCount").textContent = "🏆 "+state.stickers.length;
  el("albumProgress").textContent = state.stickers.length+"/10";
  const grid = el("albumGrid");
  grid.innerHTML = "";
  for(let i=0;i<10;i++){
    const got = state.stickers[i];
    const d = document.createElement("div");
    d.className = "sticker"+(got?" got":"");
    d.textContent = got || "🔒";
    grid.appendChild(d);
  }
}

async function fetchContent(cat){
  const res = await fetch(`content/${cat}.json`);
  if(!res.ok) throw new Error("content not found: "+cat);
  return res.json();
}

function playAudio(src){
  const a = el("audioPlayer");
  a.src = src;
  a.currentTime = 0;
  a.play().catch(()=>{});
}

function speakFallback(text){
  if('speechSynthesis' in window){
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "id-ID"; u.rate = 0.9;
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
    showResult();
    return;
  }
  renderQuestion();
}

function showResult(){
  const total = state.questions.length;
  const pct = Math.round(state.score/total*100);
  let emoji="🎉", title="Hebat!", desc=`Kamu benar ${state.score} dari ${total} soal!`;
  if(pct===100){emoji="🏆"; title="Sempurna!"; desc="Wah semua benar! Kamu pintar sekali!";}
  else if(pct>=70){emoji="🌟"; title="Keren!";}
  else if(pct<50){emoji="💪"; title="Coba Lagi Ya!"; desc=`Benar ${state.score}/${total}. Yuk coba lagi biar dapet bintang!`;}
  el("resultEmoji").textContent=emoji;
  el("resultTitle").textContent=title;
  el("resultDesc").textContent=desc;
  el("resultStars").textContent="⭐".repeat(state.score) + "☆".repeat(total-state.score);
  showScreen("result");
  // reward sticker if score >=3
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
  const cols = q.choices.length===2 ? "cols2" : q.choices.length===3 ? "cols3" : "cols2";
  wrap.className="choices "+cols;
  q.choices.forEach((c, i)=>{
    const btn = document.createElement("button");
    btn.className="choice";
    btn.onclick = ()=> handleTap(i);
    // image
    const img = document.createElement("img");
    img.src = c.img;
    img.alt = c.label;
    img.onerror = ()=>{ img.style.display="none"; };
    const lab = document.createElement("div");
    lab.className="label"; lab.textContent=c.label;
    btn.appendChild(img); btn.appendChild(lab);
    wrap.appendChild(btn);
  });
  // auto play audio
  const audioSrc = q.audio;
  if(audioSrc){
    playAudio(audioSrc);
  } else if(q.prompt_text){
    setTimeout(()=>speakFallback(q.prompt_text), 300);
  }
}

function handleTap(choiceIdx){
  const q = state.questions[state.idx];
  const correct = q.correct;
  const isCorrect = choiceIdx===correct;
  const choicesEls = [...el("choices").children];
  const picked = q.choices[choiceIdx];
  const correctChoice = q.choices[correct];

  // disable further taps briefly
  el("choices").style.pointerEvents="none";
  setTimeout(()=> el("choices").style.pointerEvents="auto", 900);

  if(isCorrect){
    choicesEls[choiceIdx].classList.add("correct");
    state.score++;
    state.stars++;
    save();
    burstStar();
    const okAudios = q.audio_ok ? [q.audio_ok] : ["assets/audio/yeay_benar.mp3","assets/audio/hore_pintar.mp3","assets/audio/masyaallah_keren.mp3"];
    const pick = okAudios[Math.floor(Math.random()*okAudios.length)];
    // try play picked, fallback to TTS
    playAudio(pick);
    // also speak label if needed via fallback after 500ms
    const fb = el("feedback");
    fb.className="feedback ok";
    fb.textContent=" Yeay benar! Itu "+correctChoice.label+" ⭐";
    fb.classList.remove("hidden");
    setTimeout(nextQuestion, 1400);
  } else {
    choicesEls[choiceIdx].classList.add("wrong");
    // shake
    setTimeout(()=> choicesEls[choiceIdx].classList.remove("wrong"), 600);
    const fb = el("feedback");
    fb.className="feedback no";
    // nyebutin nama yang salah biar anak belajar: "Ups itu huruf TA"
    fb.textContent = ` Ups itu ${picked.label}, coba lagi ya — mana ${correctChoice.label}?`;
    fb.classList.remove("hidden");
    const tryAudio = q.audio_try || "assets/audio/coba_lagi.mp3";
    playAudio(tryAudio);
    // jangan auto next, biar anak coba lagi 1x, kalau masih salah baru kasih hint kedua dan next
    // hit second try
    q._tries = (q._tries||0)+1;
    if(q._tries>=2){
      // highlight correct subtly after 2 fails
      setTimeout(()=>{
        choicesEls[correct].classList.add("correct");
        setTimeout(nextQuestion, 1200);
      }, 800);
    }
  }
}

const app = {
  async start(cat){
    state.category=cat;
    state.idx=0; state.score=0;
    try{
      const data = await fetchContent(cat);
      state.questions = data.questions;
      // shuffle choices? keep correct tracking - we keep order for learning
      showScreen("game");
      renderQuestion();
    }catch(e){
      alert("Gagal load konten: "+e.message);
    }
  },
  goHome(){
    showScreen("home");
    el("lockOverlay").classList.add("hidden");
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
  }
};

// Lock Emak: tap logo 5x dalam 3 detik
(function(){
  let taps=0;
  el("logoTap").addEventListener("click", ()=>{
    taps++;
    clearTimeout(state._lockTimer);
    state._lockTimer=setTimeout(()=>taps=0, 3000);
    if(taps>=5){
      taps=0;
      el("lockOverlay").classList.remove("hidden");
    }
  });
})();

// init
loadProgress();
