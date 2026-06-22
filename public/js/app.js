import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, doc, setDoc, getDoc, getDocs,
  deleteDoc, query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ════════════════════════════════════════════════
//  Utilities
// ════════════════════════════════════════════════
function $(id) { return document.getElementById(id); }
function show(id) { $(id).classList.remove("hidden"); }
function hide(id) { $(id).classList.add("hidden"); }

function toast(msg, ms = 2200) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add("hidden"), ms);
}

function loading(on) {
  on ? show("loading") : hide("loading");
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ════════════════════════════════════════════════
//  Screen router
// ════════════════════════════════════════════════
window.App = {
  currentUser: null,
  currentGame: null,   // game data being played
  editingGame: null,   // game id being edited (null = new)

  goScreen(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    $(id).classList.add("active");
  },

  goTeacherLogin() {
    if (this.currentUser) {
      this.loadDashboard();
      this.goScreen("screen-dashboard");
    } else {
      this.goScreen("screen-teacher-login");
    }
  },

  // ── Auth ──────────────────────────────────────
  async signup() {
    const name  = $("signup-name").value.trim();
    const email = $("signup-email").value.trim();
    const pw    = $("signup-pw").value;
    hide("signup-error");
    if (!name || !email || !pw) { return showErr("signup-error", "모든 항목을 입력해주세요."); }
    loading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pw);
      await updateProfile(cred.user, { displayName: name });
      this.currentUser = cred.user;
      await this.loadDashboard();
      this.goScreen("screen-dashboard");
    } catch (e) {
      showErr("signup-error", firebaseErrMsg(e));
    } finally { loading(false); }
  },

  async login() {
    const email = $("login-email").value.trim();
    const pw    = $("login-pw").value;
    hide("login-error");
    loading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pw);
      this.currentUser = cred.user;
      await this.loadDashboard();
      this.goScreen("screen-dashboard");
    } catch (e) {
      showErr("login-error", firebaseErrMsg(e));
    } finally { loading(false); }
  },

  async logout() {
    await signOut(auth);
    this.currentUser = null;
    this.goScreen("screen-home");
  },

  // ── Dashboard ─────────────────────────────────
  async loadDashboard() {
    if (!this.currentUser) return;
    $("dash-user-name").textContent = this.currentUser.displayName + " 선생님";
    loading(true);
    try {
      const q = query(
        collection(db, "games"),
        where("uid", "==", this.currentUser.uid),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const list = $("game-list");
      list.innerHTML = "";
      if (snap.empty) {
        list.innerHTML = `<div class="empty-state"><i class="ti ti-mood-empty"></i><p>아직 만든 게임이 없어요</p></div>`;
        return;
      }
      snap.forEach(d => {
        const g = d.data();
        const card = document.createElement("div");
        card.className = "game-card";
        const date = g.createdAt?.toDate().toLocaleDateString("ko-KR") ?? "";
        card.innerHTML = `
          <div class="game-card-title">${esc(g.title || "제목 없음")}</div>
          <div class="game-card-code"><i class="ti ti-key" style="font-size:13px"></i>${g.code}</div>
          <div class="game-card-meta">${g.items?.length ?? 0}개 카드 &middot; ${date}</div>
          <div class="game-card-actions">
            <button class="btn-secondary btn-sm" onclick="App.editGame('${d.id}')">
              <i class="ti ti-pencil"></i> 편집
            </button>
            <button class="btn-secondary btn-sm" onclick="App.startGameAs('${d.id}')">
              <i class="ti ti-player-play"></i> 시작
            </button>
            <button class="btn-danger" onclick="App.deleteGame('${d.id}', this)">
              <i class="ti ti-trash"></i>
            </button>
          </div>`;
        list.appendChild(card);
      });
    } finally { loading(false); }
  },

  // ── Editor ────────────────────────────────────
  async editGame(id) {
    loading(true);
    try {
      const snap = await getDoc(doc(db, "games", id));
      if (!snap.exists()) { toast("게임을 찾을 수 없습니다"); return; }
      const g = snap.data();
      this.editingGame = id;
      Editor.load(g);
      this.goScreen("screen-editor");
      $("share-panel").style.display = "block";
      $("share-code").textContent = g.code;
    } finally { loading(false); }
  },

  newGame() {
    this.editingGame = null;
    Editor.reset();
    this.goScreen("screen-editor");
    $("share-panel").style.display = "none";
  },

  async saveGame() {
    if (!this.currentUser) { toast("로그인이 필요합니다"); return; }
    const data = Editor.getData();
    if (!data) return;
    loading(true);
    try {
      const id = this.editingGame || doc(collection(db, "games")).id;
      const code = this.editingGame
        ? (await getDoc(doc(db, "games", id))).data().code
        : randomCode();
      await setDoc(doc(db, "games", id), {
        ...data,
        code,
        uid: this.currentUser.uid,
        createdAt: this.editingGame ? (await getDoc(doc(db, "games", id))).data().createdAt : serverTimestamp()
      }, { merge: true });
      this.editingGame = id;
      $("share-panel").style.display = "block";
      $("share-code").textContent = code;
      toast("저장했습니다 ✓");
    } finally { loading(false); }
  },

  async deleteGame(id, btn) {
    if (!confirm("이 게임을 삭제할까요?")) return;
    loading(true);
    try {
      await deleteDoc(doc(db, "games", id));
      btn.closest(".game-card").remove();
      toast("삭제했습니다");
      if (!$("game-list").querySelector(".game-card")) {
        $("game-list").innerHTML = `<div class="empty-state"><i class="ti ti-mood-empty"></i><p>아직 만든 게임이 없어요</p></div>`;
      }
    } finally { loading(false); }
  },

  copyCode() {
    const code = $("share-code").textContent;
    navigator.clipboard?.writeText(code).then(() => toast("코드를 복사했습니다: " + code));
  },

  // ── Game join (student) ───────────────────────
  async joinGame() {
    const code = $("join-code").value.trim().toUpperCase();
    hide("join-error");
    if (code.length < 4) { return showErr("join-error", "게임 코드를 입력하세요."); }
    loading(true);
    try {
      const q = query(collection(db, "games"), where("code", "==", code));
      const snap = await getDocs(q);
      if (snap.empty) { showErr("join-error", "게임을 찾을 수 없습니다. 코드를 확인해주세요."); return; }
      const g = snap.docs[0].data();
      this.currentGame = g;
      Game.start(g);
      this.goScreen("screen-game");
    } finally { loading(false); }
  },

  // ── Game start (teacher preview) ─────────────
  async startGameAs(id) {
    loading(true);
    try {
      const snap = await getDoc(doc(db, "games", id));
      if (!snap.exists()) { toast("게임을 찾을 수 없습니다"); return; }
      this.currentGame = snap.data();
      Game.start(this.currentGame);
      this.goScreen("screen-game");
    } finally { loading(false); }
  },

  previewGame() {
    const data = Editor.getData();
    if (!data) return;
    this.currentGame = data;
    Game.start(data);
    this.goScreen("screen-game");
  },

  exitGame() {
    Game.stop();
    if (this.currentUser) {
      this.goScreen("screen-dashboard");
    } else {
      this.goScreen("screen-home");
    }
  }
};

// ════════════════════════════════════════════════
//  Editor
// ════════════════════════════════════════════════
window.Editor = {
  items: [],
  answers: [],   // indices into items[]
  mode: "visual",
  cardType: "word",

  reset() {
    this.items = ["", "", "", ""];
    this.answers = [];
    this.mode = "visual";
    this.cardType = "word";
    $("game-title").value = "";
    $("btn-preview-game").disabled = true;
    this.render();
    this.setMode("visual");
    this.setType("word");
  },

  load(g) {
    this.items   = g.items ? [...g.items] : [""];
    this.answers = g.answers ? [...g.answers] : [];
    this.mode    = g.mode || "visual";
    this.cardType= g.cardType || "word";
    $("game-title").value = g.title || "";
    $("speed-slider").value = g.speed ?? 7;
    this.updateSpeedLabel();
    this.render();
    this.setMode(this.mode);
    this.setType(this.cardType);
  },

  getData() {
    const title = $("game-title").value.trim();
    const items  = this.items.map(s => s.trim()).filter(Boolean);
    if (!title)    { toast("게임 제목을 입력하세요"); return null; }
    if (items.length < 2) { toast("카드를 2개 이상 입력하세요"); return null; }
    if (this.answers.length < 1) { toast("정답 카드를 1개 이상 선택하세요"); return null; }
    return {
      title,
      items,
      answers: this.answers.filter(i => i < items.length),
      mode: this.mode,
      cardType: this.cardType,
      speed: parseInt($("speed-slider").value)
    };
  },

  addItem(val = "") {
    this.items.push(val);
    this.render();
  },

  removeItem(i) {
    this.items.splice(i, 1);
    this.answers = this.answers.filter(a => a !== i).map(a => a > i ? a - 1 : a);
    this.render();
  },

  setType(t) {
    this.cardType = t;
    $("type-word-btn").classList.toggle("active", t === "word");
    $("type-sent-btn").classList.toggle("active", t === "sentence");
    this.renderItems();
  },

  setMode(m) {
    this.mode = m;
    ["visual", "audio", "both"].forEach(x => {
      $("mode-" + x + "-btn").classList.toggle("active", x === m);
    });
    const showAudio = m === "audio" || m === "both";
    $("audio-settings").classList.toggle("hidden", !showAudio);
  },

  updateSpeedLabel() {
    const labels = ["매우 느림","느림","느림","보통","보통","보통","빠름","빠름","매우 빠름","최고속"];
    $("speed-label").textContent = labels[+$("speed-slider").value - 1];
  },

  speakPreview() {
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel();
    const words = this.answers.map(i => this.items[i]).filter(Boolean);
    const rate  = +$("speed-slider").value / 8;
    let idx = 0;
    const next = () => {
      if (idx >= words.length) return;
      const u = new SpeechSynthesisUtterance(words[idx]);
      u.lang = "en-US"; u.rate = Math.max(.5, Math.min(2, rate));
      u.onend = () => { idx++; setTimeout(next, 350); };
      speechSynthesis.speak(u);
    };
    next();
  },

  toggleAnswer(origIdx) {
    const pos = this.answers.indexOf(origIdx);
    if (pos >= 0) this.answers.splice(pos, 1);
    else this.answers.push(origIdx);
    this.renderAnswerChips();
    this.renderPreview();
    this.checkReady();
  },

  render() {
    this.renderItems();
    this.renderAnswerChips();
    this.renderPreview();
    this.checkReady();
  },

  renderItems() {
    const area = $("card-items");
    area.innerHTML = "";
    this.items.forEach((val, i) => {
      const row = document.createElement("div");
      row.className = "card-item-row";
      const inp = document.createElement("input");
      inp.className = "card-inp";
      inp.value = val;
      inp.placeholder = this.cardType === "word" ? "단어 입력..." : "문장 입력...";
      inp.style.fontSize = this.cardType === "sentence" ? "12px" : "13px";
      inp.oninput = () => {
        this.items[i] = inp.value;
        this.renderAnswerChips();
        this.renderPreview();
        this.checkReady();
      };
      const num = document.createElement("span");
      num.className = "card-num"; num.textContent = i + 1;
      const del = document.createElement("button");
      del.className = "del-btn"; del.innerHTML = '<i class="ti ti-x"></i>';
      del.onclick = () => this.removeItem(i);
      row.append(num, inp, del);
      area.appendChild(row);
    });
  },

  renderAnswerChips() {
    const area = $("answer-chips");
    area.innerHTML = "";
    this.items.forEach((val, i) => {
      if (!val.trim()) return;
      const orderPos = this.answers.indexOf(i);
      const chip = document.createElement("div");
      chip.className = "ans-chip" + (orderPos >= 0 ? " on" : "");
      chip.innerHTML = `<span class="chip-order">${orderPos >= 0 ? orderPos + 1 : "?"}</span>${esc(val.length > 18 ? val.slice(0,18)+"…" : val)}`;
      chip.onclick = () => this.toggleAnswer(i);
      area.appendChild(chip);
    });
    const summary = $("answer-summary");
    if (this.answers.length === 0) {
      summary.textContent = "정답 카드를 선택하지 않았습니다";
    } else {
      summary.textContent = "정답 순서: " + this.answers.map(i => this.items[i]).join(" → ");
    }
  },

  renderPreview() {
    const area = $("preview-cards");
    area.innerHTML = "";
    const answerItems = new Set(this.answers.map(i => this.items[i]));
    this.items.forEach(val => {
      if (!val.trim()) return;
      const d = document.createElement("div");
      d.className = "prev-card" + (answerItems.has(val) ? " answer" : "");
      d.textContent = val.length > 16 ? val.slice(0,16)+"…" : val;
      area.appendChild(d);
    });
  },

  checkReady() {
    const validItems  = this.items.filter(s => s.trim()).length;
    const validAnswer = this.answers.length > 0;
    $("btn-preview-game").disabled = !(validItems >= 2 && validAnswer);
  }
};

// ════════════════════════════════════════════════
//  Game engine
// ════════════════════════════════════════════════
window.Game = {
  data: null,
  round: 0,
  ok: 0,
  fail: 0,
  clicked: [],
  shuffled: [],
  done: false,
  speakTimer: null,

  start(data) {
    this.data = data;
    this.round = 1; this.ok = 0; this.fail = 0;
    this.loadRound();
  },

  stop() {
    speechSynthesis?.cancel();
    clearTimeout(this.speakTimer);
  },

  loadRound() {
    this.clicked = []; this.done = false;
    hide("game-result");
    $("game-cards").style.display = "grid";

    const { items, answers, mode, cardType } = this.data;
    this.shuffled = shuffle(items.filter(s => s.trim()));

    $("g-round").textContent  = this.round;
    $("g-ok").textContent     = this.ok;
    $("g-fail").textContent   = this.fail;

    const listenBtn = $("btn-listen");
    listenBtn.style.display = (mode === "audio" || mode === "both") ? "flex" : "none";

    this.renderPrompt();
    this.renderSeq();
    this.renderCards();

    if (mode === "audio" || mode === "both") {
      this.speakTimer = setTimeout(() => this.speak(), 500);
    }
  },

  renderPrompt() {
    const { answers, items, mode, cardType } = this.data;
    const pt = $("prompt-content");
    const ph = $("prompt-hint");
    if (mode === "visual" || mode === "both") {
      pt.textContent = answers.map((ai, n) => `${n+1}. ${items[ai]}`).join("   ");
      pt.style.fontSize = cardType === "sentence" ? "13px" : "16px";
      ph.textContent = `${answers.length}개를 순서대로 클릭하세요`;
    } else {
      pt.textContent = "소리를 잘 듣고 순서대로 클릭하세요";
      pt.style.fontSize = "15px";
      ph.textContent = "";
    }
  },

  renderSeq() {
    const { answers, items } = this.data;
    const row = $("seq-row");
    row.innerHTML = "";
    answers.forEach((ai, n) => {
      const pill = document.createElement("div");
      const done = this.clicked[n];
      pill.className = "seq-pill " + (done ? "done" : "empty");
      pill.textContent = done ? `${n+1}. ${items[ai]}` : `${n+1}. ?`;
      row.appendChild(pill);
    });
  },

  renderCards() {
    const { cardType } = this.data;
    const grid = $("game-cards");
    grid.innerHTML = "";
    const n = this.shuffled.length;
    const cols = n <= 12 ? 4 : n <= 20 ? 5 : 6;
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

    this.shuffled.forEach(word => {
      const card = document.createElement("div");
      card.className = "game-card-item";
      card.dataset.word = word;
      card.textContent = word;
      card.style.fontSize = cardType === "sentence" ? "11px" : "13px";
      const ci = this.clicked.indexOf(word);
      if (ci >= 0) {
        card.classList.add("used", "correct");
        const b = document.createElement("span");
        b.className = "card-order-badge"; b.textContent = ci + 1;
        card.appendChild(b);
      }
      card.onclick = () => this.handleClick(word, card);
      grid.appendChild(card);
    });
  },

  handleClick(word, card) {
    if (this.done || card.classList.contains("used")) return;
    const { items, answers } = this.data;
    const expected = items[answers[this.clicked.length]];
    if (word === expected) {
      this.clicked.push(word);
      card.classList.add("correct");
      const b = document.createElement("span");
      b.className = "card-order-badge"; b.textContent = this.clicked.length;
      card.appendChild(b);
      setTimeout(() => card.classList.add("used"), 200);
      this.renderSeq();
      if (this.clicked.length === answers.length) {
        this.done = true; this.ok++;
        setTimeout(() => this.showResult(true), 400);
      }
    } else {
      this.fail++;
      $("g-fail").textContent = this.fail;
      card.classList.add("wrong");
      setTimeout(() => card.classList.remove("wrong"), 350);
    }
  },

  speak() {
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel();
    const btn = $("btn-listen");
    if (btn) btn.disabled = true;
    const { items, answers, speed } = this.data;
    const words = answers.map(i => items[i]);
    const rate  = (speed ?? 7) / 8;
    let idx = 0;
    const next = () => {
      if (idx >= words.length) { if (btn) btn.disabled = false; return; }
      const u = new SpeechSynthesisUtterance(words[idx]);
      u.lang = "en-US"; u.rate = Math.max(.5, Math.min(2, rate));
      u.onend = () => { idx++; setTimeout(next, 350); };
      speechSynthesis.speak(u);
    };
    next();
  },

  showResult(success) {
    $("game-cards").style.display = "none";
    show("game-result");
    const { items, answers } = this.data;
    $("result-emoji").textContent = success ? "🎉" : "😅";
    $("result-title").textContent = success ? "성공!" : "아쉬워요!";
    $("result-sub").textContent   = success
      ? `라운드 ${this.round} 완료! 정답 순서: ${answers.map(i => items[i]).join(" → ")}`
      : `정답 순서: ${answers.map(i => items[i]).join(" → ")}`;
    speechSynthesis?.cancel();
  },

  next()  { this.round++; this.loadRound(); },
  retry() { this.loadRound(); }
};

// ════════════════════════════════════════════════
//  Helpers
// ════════════════════════════════════════════════
function esc(s) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function showErr(id, msg) {
  const el = $(id);
  el.textContent = msg;
  el.classList.remove("hidden");
}

function firebaseErrMsg(e) {
  const map = {
    "auth/email-already-in-use": "이미 사용 중인 이메일입니다.",
    "auth/invalid-email": "올바른 이메일 형식이 아닙니다.",
    "auth/weak-password": "비밀번호는 6자 이상이어야 합니다.",
    "auth/wrong-password": "비밀번호가 올바르지 않습니다.",
    "auth/user-not-found": "등록된 계정이 없습니다.",
    "auth/invalid-credential": "이메일 또는 비밀번호가 올바르지 않습니다.",
    "auth/too-many-requests": "잠시 후 다시 시도해주세요.",
  };
  return map[e.code] || e.message;
}

// ════════════════════════════════════════════════
//  Auth state listener & init
// ════════════════════════════════════════════════
onAuthStateChanged(auth, async user => {
  App.currentUser = user;
});

// Wire up dashboard "새 게임 만들기"
document.addEventListener("DOMContentLoaded", () => {
  document.querySelector("#screen-dashboard .btn-primary").onclick = () => {
    App.newGame();
  };
  Editor.reset();
});
