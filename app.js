(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const KEY = 'hangul-v2', OLD = 'hangul-progress-v1';
  const GOAL = 50;                       // 1日の目標XP
  const LEVELS = ['たまご', 'ひよこ', '見習い', 'がんばり屋', '中級者', 'もの知り', '先生', '名人', 'ハングル博士'];

  // ---------- 保存 ----------
  let S = { items: {}, lessons: {}, days: {}, xp: 0, sound: true, unlockAll: false };
  try {
    const j = JSON.parse(localStorage.getItem(KEY));
    if (j) S = Object.assign(S, j);
    else {
      const o = JSON.parse(localStorage.getItem(OLD));       // 第一弾の記録を引き継ぐ
      if (o) for (const k in o) S.items['l:' + k] = o[k];
    }
  } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  const rec = (id) => S.items[id] || (S.items[id] = { ok: 0, ng: 0, streak: 0 });

  const pad = (n) => String(n).padStart(2, '0');
  const dkey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const todayXP = () => S.days[dkey(new Date())] || 0;
  function streak() {
    const d = new Date();
    if (!S.days[dkey(d)]) d.setDate(d.getDate() - 1);
    let n = 0;
    while (S.days[dkey(d)] > 0) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  const level = () => Math.floor(S.xp / 100);
  const levelName = () => LEVELS[Math.min(level(), LEVELS.length - 1)];
  function addXP(n) {
    const k = dkey(new Date());
    S.days[k] = (S.days[k] || 0) + n;
    S.xp += n;
    save();
  }

  // ---------- 音声・効果音 ----------
  let voice = null;
  function pickVoice() {
    if (!window.speechSynthesis) return;
    voice = speechSynthesis.getVoices().filter((v) => /^ko/i.test(v.lang.replace('_', '-')))[0] || null;
  }
  if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  // 録音ずみの音声(audio/)があればそれを使い、なければ端末の音声合成を使う
  const player = new Audio();
  function speak(text, slow) {
    if (typeof AUDIO_MAP !== 'undefined' && AUDIO_MAP[text]) {
      if (window.speechSynthesis) speechSynthesis.cancel();
      player.src = AUDIO_MAP[text];
      player.playbackRate = slow ? 0.6 : 1;
      player.play().catch(() => {});
      return;
    }
    if (!window.speechSynthesis) { toast('このブラウザでは 音が出せません'); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    if (voice) u.voice = voice;
    u.rate = slow ? 0.5 : 0.75;
    speechSynthesis.speak(u);
  }
  let ac = null;
  function tone(seq) {
    if (!S.sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      let t = ac.currentTime;
      seq.forEach((n) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine'; o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + n[1]);
        o.connect(g); g.connect(ac.destination);
        o.start(t); o.stop(t + n[1] + 0.02);
        t += n[1] * 0.8;
      });
    } catch (e) {}
  }
  const SND = { ok: [[660, 0.12], [880, 0.2]], ng: [[300, 0.25]], win: [[523, 0.15], [659, 0.15], [784, 0.15], [1047, 0.4]] };

  let toastT = null;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2200);
  }
  function confetti() {
    const c = $('#confetti'); c.width = innerWidth; c.height = innerHeight; c.style.display = 'block';
    const g = c.getContext('2d'), cols = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#fb8c00'];
    const ps = [];
    for (let i = 0; i < 90; i++) ps.push({ x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.5, vy: 2 + Math.random() * 4, vx: -1.5 + Math.random() * 3, s: 6 + Math.random() * 8, c: cols[i % cols.length], r: Math.random() * 6 });
    let f = 0;
    (function tick() {
      g.clearRect(0, 0, c.width, c.height);
      ps.forEach((p) => { p.x += p.vx; p.y += p.vy; p.r += 0.15; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); });
      if (++f < 150) requestAnimationFrame(tick); else { g.clearRect(0, 0, c.width, c.height); c.style.display = 'none'; }
    })();
  }

  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];

  // ---------- 画面切り替え ----------
  function show(v) {
    document.querySelectorAll('.view').forEach((e) => e.classList.toggle('active', e.id === 'view-' + v));
    document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
    if (v === 'home') renderHome();
    if (v === 'stats') renderStats();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('nav button').forEach((b) => { b.onclick = () => show(b.dataset.v); });

  // タップで発音（どの画面でも data-say を持つ要素）
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-say]');
    if (t) speak(t.dataset.say.split('→').pop().trim());   // 「가다 → 갑니다」は 右側を読む
  });

  // ---------- ホーム ----------
  const FLAT = [];
  UNITS.forEach((u) => u.lessons.forEach((l) => { l.unit = u; FLAT.push(l); }));
  const isDone = (l) => !!S.lessons[l.id];
  function unlocked(i) { return S.unlockAll || i === 0 || FLAT[i].free || isDone(FLAT[i - 1]); }
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

  function mascotSays() {
    const st = streak(), td = todayXP(), done = FLAT.filter(isDone).length;
    if (!done) return 'はじめまして！いっしょに ハングルを おぼえましょう。';
    if (td >= GOAL) return '今日の目標 たっせい！すばらしい！';
    if (td > 0) return 'いい調子です。あと ' + (GOAL - td) + ' XP で 今日の目標です。';
    if (st > 0) return '昨日も がんばりましたね。今日も 1レッスン やりましょう。';
    return rnd(['おかえりなさい！また 少しだけ やってみましょう。', '1日 5分で だいじょうぶ。続けるのが いちばんです。']);
  }
  function renderHome() {
    const st = streak(), td = Math.min(todayXP(), GOAL), seen = Object.keys(S.items).length;
    const firstOpen = FLAT.findIndex((l, i) => unlocked(i) && !isDone(l));
    let h = '<div class="chips"><div class="chip">🔥<b>' + st + '</b><small>日れんぞく</small></div>' +
      '<div class="chip">⭐<b>' + S.xp + '</b><small>XP</small></div>' +
      '<div class="chip">🎓<b>Lv' + (level() + 1) + '</b><small>' + levelName() + '</small></div></div>';
    h += '<div class="goal"><div class="goalt"><span>今日の目標</span><b>' + td + ' / ' + GOAL + ' XP</b></div>' +
      '<div class="pbar"><i style="width:' + (td / GOAL * 100) + '%"></i></div></div>';
    h += '<div class="mascot"><span class="mface">🐰</span><div class="bubble">' + mascotSays() + '</div></div>';
    if (seen >= 5) h += '<button class="big review" id="review">🔁 ふくしゅう（にがてを中心に）</button>';
    UNITS.forEach((u) => {
      h += '<div class="unit" style="background:' + u.color + '"><b>' + u.title + '</b><span>' + u.sub + '</span></div>';
      u.lessons.forEach((l) => {
        const i = FLAT.indexOf(l), ok = unlocked(i), s = S.lessons[l.id];
        h += '<button class="lrow' + (ok ? '' : ' lock') + (i === firstOpen ? ' next' : '') + '" data-l="' + l.id + '">' +
          '<span class="licon" style="background:' + (ok ? u.color : '#757575') + '">' + (ok ? l.icon : '🔒') + '</span>' +
          '<span class="ltxt"><b>' + l.title + '</b><small>' + (i === firstOpen ? '▶ つぎは ここ！' : ok ? (s ? stars(s.stars) : l.free ? 'いつでも どうぞ' : 'まだ') : 'ロック中') + '</small></span>' +
          (s ? '<span class="lst">' + stars(s.stars) + '</span>' : '') + '</button>';
      });
    });
    $('#view-home').innerHTML = h;
    document.querySelectorAll('.lrow').forEach((b) => {
      b.onclick = () => {
        const l = FLAT.filter((x) => x.id === b.dataset.l)[0], i = FLAT.indexOf(l);
        if (!unlocked(i)) { toast('前のレッスンを おわらせると 開きます'); return; }
        openLesson(l);
      };
    });
    const r = $('#review'); if (r) r.onclick = startReview;
  }

  // ---------- 問題を作る ----------
  const isKo = (s) => /[가-힣]/.test(s);
  const TYPES = {
    letter: ['ko2read', 'read2ko', 'listen2ko'],
    syl: ['ko2read', 'read2ko', 'listen2ko'],
    pat: ['ko2read', 'read2ko', 'listen2ko', 'ko2mean'],
    word: ['ko2mean', 'mean2ko', 'listen2mean', 'ko2read']
  };
  function distractors(item, field, n) {
    let pool = shuffle(BY_KIND[item.kind].filter((o) => o !== item && o[field] !== item[field]));
    if (item.kind === 'syl') pool.sort((a, b) => (a.c === item.c || a.v === item.v ? 0 : 1) - (b.c === item.c || b.v === item.v ? 0 : 1));
    else if (item.kind === 'letter') pool.sort((a, b) => (a.grp === item.grp ? 0 : 1) - (b.grp === item.grp ? 0 : 1));
    else pool.sort((a, b) => (a.lesson === item.lesson ? 0 : 1) - (b.lesson === item.lesson ? 0 : 1));
    const out = [];
    pool.forEach((o) => { if (out.length < n && out.indexOf(o[field]) < 0) out.push(o[field]); });
    return out;
  }
  function makeQ(item, type) {
    const w = item.kind === 'word';
    const P = {
      ko2read: [w ? 'この言葉の 読みかたは どれ？' : 'この文字の 読みは どれ？', item.ko, '', 'read', 'read'],
      read2ko: ['この読みの 文字は どれ？', item.read, 'kana', 'ko', 'ko'],
      listen2ko: ['音を きいて、文字を えらんでください', '🔊', 'icon', 'ko', 'ko'],
      ko2mean: ['どんな意味？', item.ko, '', 'mean', 'mean'],
      mean2ko: ['この意味の 韓国語は どれ？', item.mean, 'kana', 'ko', 'ko'],
      listen2mean: ['音を きいて、意味を えらんでください', '🔊', 'icon', 'mean', 'mean']
    }[type];
    const ans = item[P[3]];
    return {
      kind: 'choice', id: item.id, prompt: P[0], big: P[1], bigCls: P[2],
      options: shuffle([ans].concat(distractors(item, P[3], 3))), answer: ans,
      say: item.say, listen: type.indexOf('listen') === 0 ? item.say : (type === 'ko2read' || type === 'ko2mean' ? item.say : null),
      auto: type.indexOf('listen') === 0,
      info: item.ko + '（' + item.read + '）' + (item.mean ? ' ＝ ' + item.mean : '')
    };
  }
  function buildItemQs(items, count) {
    const qs = [];
    for (let p = 0; qs.length < count; p++) {
      shuffle(items).forEach((it, k) => {
        if (qs.length < count) qs.push(makeQ(it, TYPES[it.kind][(k + p) % TYPES[it.kind].length]));
      });
    }
    return qs;
  }
  function weightOf(id) { const r = S.items[id]; return r ? Math.max(0.5, 1 + r.ng * 2 - r.streak) : 1; }
  function buildReview() {
    let pool = Object.keys(S.items).filter((id) => ITEMS[id]);
    const qs = [];
    while (qs.length < 10 && pool.length) {
      const ws = pool.map(weightOf); let x = Math.random() * ws.reduce((a, b) => a + b, 0), k = 0;
      for (; k < pool.length - 1; k++) { x -= ws[k]; if (x <= 0) break; }
      const it = ITEMS[pool[k]]; pool.splice(k, 1);
      qs.push(makeQ(it, rnd(TYPES[it.kind])));
    }
    return qs;
  }

  // ---------- レッスン本体 ----------
  let sess = null;
  const lessonEl = () => $('#lesson');
  function openLesson(l) {
    let h = '<div class="lbar" style="background:' + l.unit.color + '"><button class="lx" id="lx">✕</button><b>' + l.title + '</b></div><div class="lbody">';
    if (l.grammar) h += l.grammar.intro;
    else if (l.intro) h += '<div class="rule">' + l.intro + '</div>';
    if (!l.noCards && l.items.length) {
      h += '<p class="help">タップすると 音が 聞けます。</p><div class="grid">';
      l.items.forEach((it) => {
        h += '<button class="card" data-say="' + it.say + '"><div class="ch' + (it.ko.length > 3 ? ' sm' : '') + '">' + it.ko + '</div><div class="kn">' + it.read + '</div>' +
          (it.mean ? '<div class="nt">' + it.mean + '</div>' : '') + '</button>';
      });
      h += '</div>';
    }
    h += '<button class="big go" id="go" style="background:' + l.unit.color + '">れんしゅう スタート！</button></div>';
    lessonEl().innerHTML = h; lessonEl().hidden = false; lessonEl().scrollTop = 0;
    $('#lx').onclick = closeLesson;
    $('#go').onclick = () => {
      let qs;
      if (l.listen) qs = buildListen(l.listen);
      else if (l.speak) qs = shuffle(l.items).slice(0, 8).map((it) => ({ kind: 'say', id: it.id, item: it }));
      else if (l.grammar) qs = shuffle(l.grammar.qs).slice(0, 8).concat(sentListen(l.grammar.qs, 2));
      else qs = buildItemQs(l.items, 10);
      if (!qs) { toast('先に レッスンを すすめると 使えます'); return; }
      startSession({ lesson: l, color: l.unit.color, qs: qs });
    };
  }

  // ---------- ききとり ----------
  // 文の聞き取り問題：音を聞いて、日本語の意味 か 韓国語の文 を選ぶ
  function sentListen(pool, n) {
    const ords = pool.filter((q) => q.kind === 'order');
    return shuffle(ords).slice(0, n).map((q, k) => {
      const ko = q.tiles.join(' '), others = shuffle(ords.filter((o) => o !== q));
      const toJa = k % 2 === 0;
      const field = (o) => (toJa ? o.ja : o.tiles.join(' '));
      const opts = [];
      others.forEach((o) => { if (opts.length < 3 && opts.indexOf(field(o)) < 0 && field(o) !== field(q)) opts.push(field(o)); });
      return {
        kind: 'choice', prompt: toJa ? '音を きいて、意味を えらんでください' : '音を きいて、韓国語の文を えらんでください',
        big: '🔊', bigCls: 'icon', listen: ko, auto: true, say: ko, answer: field(q), options: shuffle([field(q)].concat(opts)), info: ko + ' ＝ ' + q.ja
      };
    });
  }
  function learnedItems(kinds) {
    const out = [];
    FLAT.forEach((l) => { if (isDone(l) || S.unlockAll) l.items.forEach((it) => { if (kinds.indexOf(it.kind) >= 0 && out.indexOf(it) < 0) out.push(it); }); });
    return out;
  }
  function buildListen(type) {
    if (type === 'sents') {
      let pool = [];
      FLAT.forEach((l) => { if (l.grammar && (isDone(l) || S.unlockAll) && l.id !== 'g5') pool = pool.concat(l.grammar.qs); });
      return pool.length >= 8 ? sentListen(pool, 8) : null;
    }
    const items = learnedItems(type === 'chars' ? ['letter', 'syl', 'pat'] : ['word']);
    if (items.length < 6) return null;
    return shuffle(items).slice(0, 10).map((it) => makeQ(it, type === 'chars' ? 'listen2ko' : 'listen2mean'));
  }
  function closeLesson() {
    lessonEl().hidden = true;
    if (window.speechSynthesis) speechSynthesis.cancel();
    player.pause();
    show($('#view-table').classList.contains('active') ? 'table' : 'home');
  }
  function startReview() {
    startSession({ lesson: null, color: '#e65100', qs: buildReview(), title: 'ふくしゅう' });
  }
  function startSession(cfg) {
    sess = { cfg: cfg, queue: cfg.qs.map((q) => Object.assign({ tries: 0 }, q)), total: cfg.qs.length, done: 0, first: 0, combo: 0, xp: 0, mistakes: 0 };
    nextQ();
  }
  const PRAISE = ['せいかい！', 'すごい！', 'その調子！', 'ばっちり！', 'お見事！', 'いいですね！'];
  const COMBO = { 3: '🔥 3れんぞく！', 5: '🔥🔥 5れんぞく！すごい！', 8: '🌟 8れんぞく！天才です！', 10: '🏆 10れんぞく！！' };

  function nextQ() {
    if (!sess.queue.length) return finish();
    const q = sess.queue[0], c = sess.cfg;
    let h = '<div class="lbar" style="background:' + c.color + '"><button class="lx" id="lx">✕</button>' +
      '<div class="pbar light"><i style="width:' + (sess.done / sess.total * 100) + '%"></i></div>' +
      '<span class="lcombo">' + (sess.combo >= 3 ? '🔥' + sess.combo : '') + '</span></div><div class="lbody">';
    if (q.kind === 'say') return renderSay(q, h);
    h += '<p class="help">' + (q.kind === 'order' ? 'この文を 韓国語に しましょう（タップで ならべる）' : q.prompt) + '</p>';
    if (q.kind === 'order') {
      h += '<div class="qbig sent jp">' + q.ja + '</div><div id="ans" class="ans"></div><div id="bank" class="bank"></div>' +
        '<button class="big" id="chk" disabled>かくにん</button>';
    } else {
      h += '<div class="qbig ' + (q.bigCls || '') + '" ' + (q.listen ? 'data-say="' + q.listen + '"' : '') + '>' + q.big + '</div>';
      if (q.listen && q.bigCls !== 'icon') h += '<button class="listen" data-say="' + q.listen + '">🔊 音を きく</button>';
      if (q.bigCls === 'icon') h += '<p class="help" style="text-align:center">🔊 を タップで もう一度</p>';
      h += '<div id="choices">';
      q.options.forEach((o) => {
        const k = isKo(o) ? (o.length > 7 ? ' k3' : o.length > 3 ? ' k2' : ' k') : (o.length > 9 ? ' t2' : '');
        h += '<button class="opt' + k + '">' + o + '</button>';
      });
      h += '</div>';
    }
    h += '</div><div id="fbk" class="fbk" hidden></div>';
    lessonEl().innerHTML = h; lessonEl().hidden = false; lessonEl().scrollTop = 0;
    $('#lx').onclick = () => { if (confirm('レッスンを やめますか？（ここまでの XP は 残りません）')) closeLesson(); };
    if (q.kind === 'order') setupOrder(q);
    else {
      document.querySelectorAll('.opt').forEach((b) => { b.onclick = () => answer(q, b.textContent === q.answer, b); });
      if (q.auto) speak(q.say);
    }
  }
  // 声に出す練習：自分で言えたら「言えた！」を押す
  function renderSay(q, h) {
    const it = q.item, tip = TIPS[it.ko] || '';
    const syl = Array.from(it.ko.replace(/[ ?]/g, '')).join(' ・ ');
    h += '<p class="help">声に出して 言ってみましょう</p><div class="qbig sent">' + it.ko + '</div>' +
      '<p class="sayread">' + it.read + '</p><p class="sayread jp">' + it.mean + '</p>' +
      '<div class="row2"><button class="listen" data-say="' + it.say + '">🔊 きく</button><button class="listen" id="slow">🐢 ゆっくり</button></div>' +
      '<div class="rule">区切って 言うと：<b>' + syl + '</b>' + (tip ? '<br>' + tip : '') + '</div>' +
      '<button class="big" id="said">言えた！ 👍</button></div>';
    lessonEl().innerHTML = h; lessonEl().hidden = false; lessonEl().scrollTop = 0;
    $('#lx').onclick = () => { if (confirm('レッスンを やめますか？（ここまでの XP は 残りません）')) closeLesson(); };
    $('#slow').onclick = () => speak(it.say, true);
    $('#said').onclick = () => {
      rec(q.id).ok++;
      sess.queue.shift(); sess.done++; sess.first++; sess.combo++; sess.xp += 8;
      tone(SND.ok); save(); toast(rnd(PRAISE));
      nextQ();
    };
    speak(it.say);
  }
  function setupOrder(q) {
    const tiles = shuffle(q.tiles.concat(q.extra).map((t, i) => ({ t: t, used: false })));
    const placed = [];
    function draw() {
      $('#ans').innerHTML = placed.map((i) => '<button class="tile on" data-i="' + i + '">' + tiles[i].t + '</button>').join('') || '<span class="ph">ここに ならべます</span>';
      $('#bank').innerHTML = tiles.map((x, i) => '<button class="tile' + (x.used ? ' gone' : '') + '" data-i="' + i + '">' + x.t + '</button>').join('');
      $('#chk').disabled = !placed.length;
      document.querySelectorAll('#bank .tile').forEach((b) => { b.onclick = () => { const i = +b.dataset.i; if (!tiles[i].used) { tiles[i].used = true; placed.push(i); draw(); } }; });
      document.querySelectorAll('#ans .tile').forEach((b) => { b.onclick = () => { const i = +b.dataset.i; tiles[i].used = false; placed.splice(placed.indexOf(i), 1); draw(); }; });
    }
    draw();
    $('#chk').onclick = () => {
      const got = placed.map((i) => tiles[i].t).join(' ');
      document.querySelectorAll('.tile').forEach((b) => { b.disabled = true; });
      $('#chk').hidden = true;
      answer(q, got === q.tiles.join(' '), null);
    };
  }
  function answer(q, good, btn) {
    document.querySelectorAll('.opt').forEach((b) => {
      b.disabled = true;
      if (b.textContent === q.answer) b.classList.add('right');
    });
    if (btn && !good) btn.classList.add('wrong');
    if (q.id) { const r = rec(q.id); if (good) { r.ok++; r.streak++; } else { r.ng++; r.streak = 0; } }
    let title, detail = '';
    if (good) {
      sess.combo++; sess.done++;
      if (q.tries === 0) { sess.first++; sess.xp += 10; } else sess.xp += 5;
      title = COMBO[sess.combo] || ('⭕ ' + rnd(PRAISE));
      tone(SND.ok);
      sess.queue.shift();
    } else {
      sess.combo = 0; sess.mistakes++;
      title = '❌ ' + rnd(['おしい！', 'だいじょうぶ、次は できます', '惜しい！もう一度 見ましょう']);
      detail = '正解は <b>' + (q.kind === 'order' ? q.tiles.join(' ') : q.answer) + '</b>';
      tone(SND.ng);
      const cur = sess.queue.shift();
      if (cur.tries < 2) { cur.tries++; sess.queue.push(cur); }
      else sess.done++;
    }
    if (q.info) detail += (detail ? '<br>' : '') + q.info;
    if (q.why) detail += (detail ? '<br>' : '') + q.why;
    if (q.say && (q.kind === 'order' || q.listen == null)) detail += '<br><button class="mini" data-say="' + q.say + '">🔊 もう一度 聞く</button>';
    const f = $('#fbk');
    f.className = 'fbk ' + (good ? 'ok' : 'ng');
    f.innerHTML = '<div class="ft">' + title + '</div><div class="fd">' + detail + '</div><button class="big" id="nx">つぎへ →</button>';
    f.hidden = false;
    $('#nx').onclick = nextQ;
    save();
    if (q.say) speak(q.say);
  }
  function finish() {
    const c = sess.cfg, acc = sess.first / sess.total;
    const st = c.lesson ? (acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1) : 0;
    const bonus = 10 + st * 5, gain = sess.xp + bonus;
    const wasGoal = todayXP() >= GOAL, hadStreak = streak() > 0 && todayXP() > 0;
    addXP(gain);
    if (c.lesson) { const prev = S.lessons[c.lesson.id]; S.lessons[c.lesson.id] = { stars: Math.max(st, prev ? prev.stars : 0) }; }
    save();
    const goalNow = !wasGoal && todayXP() >= GOAL, newStreak = streak();
    const msg = st === 3 ? 'かんぺきです！' : st === 2 ? 'よくできました！' : st === 1 ? 'さいごまで できました。もう一度 やると もっと 身につきます。' : 'ふくしゅう おつかれさま！';
    let h = '<div class="lbar" style="background:' + c.color + '"><b>' + (c.lesson ? c.lesson.title : 'ふくしゅう') + '</b></div><div class="lbody res">' +
      '<div class="mface big">🐰</div><h2>' + (c.lesson ? 'レッスン クリア！' : 'ふくしゅう おわり！') + '</h2>' +
      (c.lesson ? '<div class="starbig">' + stars(st) + '</div>' : '') + '<p class="help">' + msg + '</p>' +
      '<div class="stat"><span>はじめて 正解した 問題</span><b>' + sess.first + ' / ' + sess.total + '</b></div>' +
      '<div class="stat"><span>もらった XP</span><b>＋' + gain + '</b></div>' +
      '<div class="stat"><span>🔥 れんぞく日数</span><b>' + newStreak + '日</b></div>' +
      '<div class="stat"><span>今日の目標</span><b>' + Math.min(todayXP(), GOAL) + ' / ' + GOAL + '</b></div>' +
      (goalNow ? '<div class="rule good">🎉 今日の目標を たっせい しました！</div>' : '') +
      (!hadStreak && newStreak === 1 ? '<div class="rule good">🔥 れんぞく記録が はじまりました！</div>' : '');
    const idx = c.lesson ? FLAT.indexOf(c.lesson) : -1;
    if (idx >= 0 && idx + 1 < FLAT.length) h += '<button class="big go" id="rn" style="background:' + c.color + '">つぎの レッスンへ →</button>';
    if (c.lesson && st < 3) h += '<button class="big alt" id="again">もう一度 やる</button>';
    h += '<button class="big alt" id="home">ホームに もどる</button></div>';
    lessonEl().innerHTML = h; lessonEl().scrollTop = 0;
    tone(SND.win); confetti();
    const rn = $('#rn'); if (rn) rn.onclick = () => openLesson(FLAT[idx + 1]);
    const ag = $('#again'); if (ag) ag.onclick = () => openLesson(c.lesson);
    $('#home').onclick = () => { lessonEl().hidden = true; show('home'); };
    sess = null;
  }

  // ---------- 表 ----------
  let tab = 'letters';
  document.querySelectorAll('#table-seg button').forEach((b) => {
    b.onclick = () => { tab = b.dataset.t; document.querySelectorAll('#table-seg button').forEach((x) => x.classList.toggle('on', x === b)); renderTable(); };
  });
  function cardsHTML(items) {
    return '<div class="grid">' + items.map((it) =>
      '<button class="card" data-say="' + it.say + '"><div class="ch' + (it.ko.length > 3 ? ' sm' : '') + '">' + it.ko + '</div><div class="kn">' + it.read + '</div>' +
      (it.mean ? '<div class="nt">' + it.mean + '</div>' : it.note ? '<div class="nt">' + it.note + '</div>' : '') + '</button>').join('') + '</div>';
  }
  function renderTable() {
    let h = '';
    if (tab === 'letters') {
      h += '<p class="help">文字を タップすると 音が 聞けます。</p>';
      GROUPS.forEach((g) => { h += '<h3>' + g.title + '</h3><p class="sub">' + g.sub + '</p>' + cardsHTML(g.items.map((it) => ITEMS['l:' + it.ch])); });
    } else if (tab === 'syl') {
      h += '<p class="help">横：母音　たて：子音。タップで 音が 聞けます。</p><table class="stbl"><tr><th></th>' + SYL_VCH.map((v) => '<th>' + v + '</th>').join('') + '</tr>';
      SYL_ROWS.forEach((r) => {
        h += '<tr><th>' + r[0] + '</th>' + r[2].map((k, vi) => {
          const s = compose(r[1], SYL_V[vi]);
          return '<td><button data-say="' + s + '"><b>' + s + '</b><small>' + k.replace(/（.*）/, '') + '</small></button></td>';
        }).join('') + '</tr>';
      });
      h += '</table>';
    } else if (tab === 'pat') {
      h += '<div class="rule">文字の いちばん下に つく子音が <b>パッチム</b> です。<br>ㄴ＝ン（舌）／ㅇ＝ン（のど）／ㅁ＝ム／ㄹ＝ル／ㄱ＝ク／ㅂ＝プ／ㅅ ㅈ ㅊ ㄷ ㅌ＝ッ</div>';
      UNITS[2].lessons.slice(0, 4).forEach((l) => { h += '<h3>' + l.title + '</h3>' + cardsHTML(l.items); });
    } else {
      UNITS[3].lessons.forEach((l) => {
        h += '<h3>' + l.icon + ' ' + l.title + '</h3>';
        l.items.forEach((it) => { h += '<button class="wrow" data-say="' + it.say + '"><span class="wk">' + it.ko + '</span><span class="wt"><b>' + it.read + '</b><small>' + it.mean + '</small></span><span>🔊</span></button>'; });
      });
    }
    $('#table-area').innerHTML = h;
  }

  // ---------- きろく ----------
  function renderStats() {
    const ids = Object.keys(S.items).filter((k) => ITEMS[k]);
    let ok = 0, ng = 0, mastered = 0, weak = [];
    ids.forEach((id) => { const r = S.items[id]; ok += r.ok; ng += r.ng; if (r.streak >= 3) mastered++; if (r.ng > 0 && r.streak < 3) weak.push(id); });
    weak.sort((a, b) => S.items[b].ng - S.items[a].ng);
    const total = Object.keys(ITEMS).length, lessonsDone = FLAT.filter(isDone).length;
    let h = '<h2>これまでの きろく</h2>' +
      '<div class="stat"><span>🔥 れんぞく日数</span><b>' + streak() + '日</b></div>' +
      '<div class="stat"><span>⭐ XP ぜんぶで</span><b>' + S.xp + '</b></div>' +
      '<div class="stat"><span>🎓 レベル</span><b>Lv' + (level() + 1) + ' ' + levelName() + '</b></div>' +
      '<div class="stat"><span>おわった レッスン</span><b>' + lessonsDone + ' / ' + FLAT.length + '</b></div>' +
      '<div class="stat"><span>れんしゅうした 項目</span><b>' + ids.length + ' / ' + total + '</b></div>' +
      '<div class="stat"><span>3回れんぞく 正解した 項目</span><b>' + mastered + '</b></div>' +
      '<div class="stat"><span>正解 / まちがい</span><b>' + ok + ' / ' + ng + '</b></div>' +
      '<h2>にがてな もの</h2>';
    h += weak.length ? weak.slice(0, 12).map((id) => '<button class="weak" data-say="' + ITEMS[id].say + '">' + ITEMS[id].ko + '<small>' + S.items[id].ng + '回まちがい</small></button>').join('')
      : '<p class="help">まだ ありません。レッスンを やってみましょう！</p>';
    h += '<h2>せってい</h2>' +
      '<button class="small" id="snd">効果音：' + (S.sound ? 'ON' : 'OFF') + '</button> ' +
      '<button class="small" id="unl">レッスンを ぜんぶ 開く：' + (S.unlockAll ? 'ON' : 'OFF') + '</button><br>' +
      '<button class="small danger" id="reset">きろくを ぜんぶ消す</button>';
    $('#view-stats').innerHTML = h;
    $('#snd').onclick = () => { S.sound = !S.sound; save(); renderStats(); };
    $('#unl').onclick = () => { S.unlockAll = !S.unlockAll; save(); renderStats(); };
    $('#reset').onclick = () => {
      if (confirm('きろくを ぜんぶ消します。よろしいですか？')) { S = { items: {}, lessons: {}, days: {}, xp: 0, sound: S.sound, unlockAll: false }; save(); renderStats(); }
    };
  }

  renderHome(); renderTable();
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) navigator.serviceWorker.register('sw.js').catch(() => {});
  window.__hangul = { S: () => S, ITEMS, FLAT, buildItemQs, makeQ };
})();
