'use strict';

/* 今日の振り返り — iPhone 向け Web アプリ
 * データはこの端末のブラウザ（localStorage）にだけ保存する。 */

(function () {
  const root = document.getElementById('root');
  const STORE_KEY = 'kyou-furikaeri-web-v1';

  // ---------- 定数 ----------
  const GUILD = '1425417938680152105';
  const CAT_NAMES = ['シナリオ', '現実タイミング', '理想タイミング', '過去相場検証'];
  const QMIN = 1, QMAX = 20;
  const MARKS = [
    { key: 'o', sym: '○', label: 'できた', btn: '#7FE0C4', chart: '#2E9E86' },
    { key: 't', sym: '△', label: 'あと少し', btn: '#FFC47A', chart: '#BE8A12' },
    { key: 'x', sym: '×', label: 'できなかった', btn: '#FF9A8F', chart: '#E4507A' }
  ];
  const MARK = {};
  MARKS.forEach((m) => { MARK[m.key] = m; });
  const PERSIST = ['questionCount', 'qMode', 'qDoneDate', 'qDoneTime', 'projects', 'currentId', 'catOff', 'missedProjOff'];

  const state = {
    screen: 'home',
    questionCount: 5,
    qMode: 'browser',
    qDoneDate: null, qDoneTime: '',
    projects: [],
    currentId: null,
    catOff: {},
    missedOn: false,
    missedProjOff: {},
    dialog: null,
    newName: '',
    confirmDeleteId: null,
    anaPeriod: 'all',
    anaProject: 'all',
    bank: null,
    bankError: false,
    toast: '',
    locked: false,
    lockBusy: false,
    lockError: ''
  };

  // ---------- ユーティリティ ----------
  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const pad2 = (n) => String(n).padStart(2, '0');
  const todayKey = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  const hhmm = (d) => d.getHours() + ':' + pad2(d.getMinutes());
  const dateLabel = (ms) => { const d = new Date(ms); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + hhmm(d); };
  const qUrlOf = (it) => 'https://discord.com/channels/' + GUILD + '/' + it[1] + '/' + it[2];
  const qHrefOf = (it) => state.qMode === 'discord' ? 'discord://-/channels/' + GUILD + '/' + it[1] + '/' + it[2] : qUrlOf(it);
  const aHrefOf = (it) => 'https://youtu.be/' + it[3] + '?t=' + it[4];
  const current = () => state.projects.find((p) => p.id === state.currentId) || null;

  // ---------- 保存 ----------
  let saveTimer = null;
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 300); }
  function flush() {
    clearTimeout(saveTimer);
    const data = {};
    PERSIST.forEach((k) => { data[k] = state[k]; });
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) {
      toast('保存できませんでした。端末の空き容量やプライベートブラウズを確認してください');
    }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (saved) PERSIST.forEach((k) => { if (saved[k] !== undefined && saved[k] !== null) state[k] = saved[k]; });
    } catch (e) { /* 読めなければ初期状態 */ }
    if (state.qDoneDate !== todayKey()) { state.qDoneDate = null; state.qDoneTime = ''; }
  }

  function set(patch, opts) {
    Object.assign(state, patch);
    if (!opts || opts.persist !== false) save();
    render();
  }

  let toastTimer = null;
  function toast(text) {
    clearTimeout(toastTimer);
    state.toast = text;
    render();
    toastTimer = setTimeout(() => { state.toast = ''; render(); }, 3200);
  }

  // ---------- アイコン ----------
  const svg = (w, body, extra) => '<svg width="' + w + '" height="' + w + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || '') + '>' + body + '</svg>';
  const I = {
    home: svg(24, '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v11h14V9"/>'),
    chart: svg(24, '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>'),
    gear: svg(24, '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    play: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4l14 8-14 8z"/></svg>',
    ext: svg(16, '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),
    plus: svg(18, '<path d="M12 5v14M5 12h14"/>'),
    folder: svg(18, '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    back: svg(22, '<path d="m15 18-6-6 6-6"/>', ' stroke-width="2.2"'),
    trash: svg(20, '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v5M14 11v5"/>'),
    check: '<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#FFC47A"/><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#1F1204" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  // ---------- プロジェクト処理 ----------
  function withBatch(p) {
    const size = state.questionCount;
    let index = p.index;
    let start = p.batchStart;
    let bsize = p.batchSize || size;
    if (index >= p.total) { index = 0; start = null; }
    if (start == null || index < start || index - start >= bsize) { start = index; bsize = size; }
    return Object.assign({}, p, { index: index, batchStart: start, batchSize: bsize, updatedAt: Date.now() });
  }

  function beginSession(id, list) {
    state.projects = (list || state.projects).map((x) => x.id === id ? withBatch(x) : x);
    state.currentId = id;
    set({ dialog: null, screen: 'review', toast: '' });
    window.scrollTo(0, 0);
  }

  function updateCurrent(patch) {
    state.projects = state.projects.map((p) => p.id === state.currentId ? Object.assign({}, p, patch, { updatedAt: Date.now() }) : p);
    save();
  }

  function setResult(idx, patch, rerender) {
    const cur = current();
    if (!cur) return;
    const results = Object.assign({}, cur.results || {});
    results[idx] = Object.assign({}, results[idx] || {}, patch, patch.mark ? { at: Date.now() } : {});
    updateCurrent({ results: results });
    if (rerender !== false) render();
  }

  function nextQuestion() {
    const cur = current();
    if (!cur) return;
    const n = cur.index + 1;
    const tk = todayKey();
    const today = cur.today && cur.today.date === tk ? { date: tk, count: cur.today.count + 1 } : { date: tk, count: 1 };
    const bEnd = cur.batchStart + Math.min(cur.batchSize, cur.total - cur.batchStart);
    if (n >= bEnd) {
      updateCurrent({ index: n, today: today, batchStart: null });
      set({ screen: 'home' });
      window.scrollTo(0, 0);
      if (n >= cur.total) toast('おめでとうございます。「' + cur.name + '」の全' + cur.total + '問を振り返りました');
      else toast('今日の' + (bEnd - cur.batchStart) + '問が終わりました。全体 ' + n + ' / ' + cur.total + ' 問');
    } else {
      updateCurrent({ index: n, today: today });
      render();
      window.scrollTo(0, 0);
    }
  }

  function projectMissed(p) {
    const out = [];
    if (!p.items) return out;
    const results = p.results || {};
    p.items.forEach((it, i) => {
      const m = results[i] && results[i].mark;
      if (m === 't' || m === 'x') out.push(it);
    });
    return out;
  }

  function missedPool(onlySelected) {
    const out = [];
    const seen = {};
    state.projects.forEach((p) => {
      if (onlySelected && state.missedProjOff[p.id]) return;
      projectMissed(p).forEach((it) => { if (!seen[it[2]]) { seen[it[2]] = true; out.push(it); } });
    });
    return out;
  }

  function buildPool() {
    const all = [];
    if (!state.bank) return all;
    state.bank.categories.forEach((c, ci) => {
      if (state.catOff[c.name]) return;
      c.items.forEach((it) => all.push([ci].concat(it)));
    });
    if (state.missedOn) missedPool(true).forEach((it) => all.push(it));
    const seen = {};
    return all.filter((it) => { if (seen[it[2]]) return false; seen[it[2]] = true; return true; });
  }

  function createProject() {
    const name = state.newName.trim();
    if (!name || !state.bank) return;
    const pool = buildPool();
    if (!pool.length) return;
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    const now = Date.now();
    const p = { id: 'p' + now, name: name, total: pool.length, index: 0, items: pool, batchStart: null, batchSize: state.questionCount, createdAt: now, updatedAt: now };
    beginSession(p.id, [p].concat(state.projects));
  }

  function deleteProject(id) {
    const target = state.projects.find((p) => p.id === id);
    state.projects = state.projects.filter((p) => p.id !== id);
    if (state.currentId === id) state.currentId = null;
    state.confirmDeleteId = null;
    save();
    if (target) toast('「' + target.name + '」を削除しました');
    else render();
  }

  // ---------- 画面：共通 ----------
  function tabbar() {
    const s = state.screen;
    const tab = (action, icon, label, on) => '<button type="button" class="tab" data-action="' + action + '"' + (on ? ' aria-current="page"' : '') + '>' + icon + label + '</button>';
    return '<nav class="tabbar" aria-label="メイン">' +
      tab('go-home', I.home, 'ホーム', s === 'home') +
      tab('go-analysis', I.chart, '結果分析', s === 'analysis') +
      tab('go-settings', I.gear, '設定', s === 'settings') + '</nav>';
  }

  // ---------- 画面：ホーム ----------
  function home() {
    const d = new Date();
    const qDone = state.qDoneDate === todayKey();
    const cur = current();
    const total = cur ? cur.total : 0;
    const rIdx = cur ? Math.min(cur.index, total) : 0;
    const todayCount = cur && cur.today && cur.today.date === todayKey() ? cur.today.count : 0;
    const resumeHint = !cur ? 'プロジェクトはまだありません。「新規開始」で作成します'
      : (rIdx >= total ? '「' + cur.name + '」は全' + total + '問を振り返り済みです'
        : '「' + cur.name + '」 次は ' + (rIdx + 1) + ' 問目から');

    return '<main class="screen">' +
      '<div class="head"><span class="eyebrow">' + (d.getMonth() + 1) + '月' + d.getDate() + '日（' + '日月火水木金土'[d.getDay()] + '）</span><h1>今日の振り返り</h1></div>' +
      '<section class="glass card' + (qDone ? ' done' : '') + '">' +
        '<div class="stat-row"><span class="muted">' + (qDone ? '振り返り · ' + esc(state.qDoneTime) + ' に完了' : '振り返り') + '</span>' +
        '<span class="muted" style="color:var(--ink-2)">今日 ' + todayCount + ' / ' + state.questionCount + ' 回答</span></div>' +
        '<h2 class="card-title">' + (qDone ? I.check : '') + '<span>今日の振り返り<span class="num">' + state.questionCount + '</span>問</span></h2>' +
        (cur ? '<div class="block" style="gap:6px"><div class="progress"><div style="width:' + Math.max(0.5, rIdx * 100 / Math.max(1, total)) + '%"></div></div>' +
          '<span class="muted">全体 ' + rIdx + ' / ' + total + ' 問（' + Math.floor(rIdx * 100 / Math.max(1, total)) + '%）</span></div>' : '') +
        '<button type="button" class="btn btn-amber btn-block" data-action="resume"' + (!cur || rIdx >= total ? ' disabled' : '') + '>' + I.play + '続きから開始</button>' +
        '<div class="two">' +
          '<button type="button" class="btn btn-sub" data-action="new-project">' + I.plus + '新規開始</button>' +
          '<button type="button" class="btn btn-sub" data-action="open-picker"' + (state.projects.length ? '' : ' disabled') + '>' + I.folder + 'プロジェクト</button>' +
        '</div>' +
        '<span class="muted">' + esc(resumeHint) + '</span>' +
        '<div class="divider"></div>' +
        '<div class="toggle-row"><span class="grow" style="font-size:16px">' + (qDone ? '今日は完了済み' : '今日の振り返りを完了にする') + '</span>' +
        '<button type="button" role="switch" class="switch" aria-checked="' + (qDone ? 'true' : 'false') + '" aria-label="今日の振り返りを完了にする" data-action="toggle-done"><span></span></button></div>' +
        (qDone ? '<span class="muted" style="margin-top:-8px">明日の0:00に自動で未完了に戻ります</span>' : '') +
      '</section>' +
    '</main>' + tabbar();
  }

  // ---------- 画面：振り返り ----------
  function review() {
    const cur = current();
    if (!cur) {
      return '<main class="screen"><button type="button" class="back" data-action="go-home">' + I.back + 'ホーム</button>' +
        '<section class="glass qcard"><span>プロジェクトが選ばれていません。ホームの「新規開始」から作成してください。</span></section></main>';
    }
    const total = cur.total;
    const rIdx = Math.min(cur.index, total);
    const bStart = cur.batchStart != null ? cur.batchStart : rIdx;
    const bSize = Math.max(1, Math.min(cur.batchSize || state.questionCount, total - bStart));
    const bPos = rIdx - bStart;
    const item = cur.items && rIdx < cur.items.length ? cur.items[rIdx] : null;
    const result = (cur.results && cur.results[rIdx]) || {};
    const catName = item ? (state.bank && state.bank.categories[item[0]] ? state.bank.categories[item[0]].name : CAT_NAMES[item[0]] || '') : '';
    const t = item ? item[4] : 0;
    const segs = [];
    for (let i = 0; i < bSize; i++) segs.push('<div class="' + (i < bPos ? 'done' : (i === bPos ? 'now' : '')) + '"></div>');
    const needMark = !!item && !result.mark;

    let body;
    if (!item) {
      body = '<span>このプロジェクトには問題データがありません。</span>';
    } else {
      body =
        '<div class="block"><span class="label">問題 <span class="chip">' + esc(catName) + '</span></span>' +
          '<a class="btn btn-discord btn-block" href="' + esc(qHrefOf(item)) + '" target="_blank" rel="noopener">問題を' + (state.qMode === 'discord' ? 'Discordアプリ' : 'ブラウザ') + 'で開く' + I.ext + '</a>' +
          '<span class="url">' + esc(qUrlOf(item)) + '</span></div>' +
        '<div class="divider"></div>' +
        '<div class="block"><span class="label">回答</span>' +
          '<a class="btn btn-youtube btn-block" href="' + esc(aHrefOf(item)) + '" target="_blank" rel="noopener">' + I.play + 'YouTubeで見る（' + Math.floor(t / 60) + ':' + pad2(t % 60) + '〜）</a></div>' +
        '<div class="divider"></div>' +
        '<div class="block"><span class="label" id="mark-label">自己評価 <span class="required">*必須</span></span>' +
          '<div class="marks" role="radiogroup" aria-labelledby="mark-label">' +
          MARKS.map((m) => '<button type="button" role="radio" class="mark" style="--mc:' + m.btn + '" aria-checked="' + (result.mark === m.key ? 'true' : 'false') + '" data-action="mark" data-arg="' + m.key + '">' + m.sym + '<small>' + m.label + '</small></button>').join('') +
          '</div></div>' +
        '<div class="block"><label class="label" for="review-note">反省・備考</label>' +
          '<textarea id="review-note" class="input" data-input="note" placeholder="気づいたこと、次に活かすことなど">' + esc(result.note || '') + '</textarea></div>';
    }

    return '<main class="screen review">' +
      '<button type="button" class="back" data-action="go-home">' + I.back + 'ホーム</button>' +
      '<div class="head" style="padding-top:0"><span class="eyebrow">' + esc(cur.name) + ' · 全体 ' + Math.min(rIdx + 1, total) + ' / ' + total + '</span>' +
        '<h1>今日の <span class="num">' + Math.min(bPos + 1, bSize) + '</span><span style="font-size:20px;color:var(--ink-3)"> / ' + bSize + ' 問目</span></h1></div>' +
      '<div class="segs">' + segs.join('') + '</div>' +
      '<section class="glass qcard">' + body + '</section>' +
    '</main>' +
    '<div class="actionbar"><div class="actionbar-inner">' +
      (needMark ? '<span class="warn">○△×のどれかを選ぶと次へ進めます</span>' : '') +
      '<div class="row" style="gap:10px"><button type="button" class="btn btn-sub" data-action="prev"' + (rIdx <= bStart ? ' disabled' : '') + '>前へ</button>' +
      '<button type="button" class="btn btn-amber grow" data-action="next"' + (needMark ? ' disabled' : '') + '>' + (bPos + 1 >= bSize ? '今日の振り返りを終える' : '次へ') + '</button></div>' +
    '</div></div>';
  }

  // ---------- 画面：結果分析 ----------
  function analysis() {
    const period = state.anaPeriod;
    const projId = state.anaProject;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const since = period === 'all' ? null : startOfToday - (parseInt(period, 10) - 1) * 86400000;
    const recs = [];
    state.projects.forEach((p) => {
      if (projId !== 'all' && p.id !== projId) return;
      const res = p.results || {};
      Object.keys(res).forEach((k) => {
        const r = res[k];
        const it = p.items && p.items[k];
        if (!r || !r.mark || !it) return;
        if (since != null && !(r.at && r.at >= since)) return;
        recs.push({ mark: r.mark, at: r.at || 0, note: r.note || '', item: it, project: p.name });
      });
    });
    const n = recs.length;
    const cnt = { o: 0, t: 0, x: 0 };
    recs.forEach((r) => { cnt[r.mark]++; });
    const pct = (v) => n ? Math.round(v * 100 / n) + '%' : '–';

    const filters =
      '<div class="seg-ctl" role="group" aria-label="期間">' +
        [['all', 'すべて'], ['7', '7日'], ['30', '30日']].map((o) => '<button type="button" aria-pressed="' + (period === o[0] ? 'true' : 'false') + '" data-action="ana-period" data-arg="' + o[0] + '">' + o[1] + '</button>').join('') +
      '</div>' +
      '<select class="input" aria-label="プロジェクト" data-change="ana-project"><option value="all">すべてのプロジェクト</option>' +
        state.projects.map((p) => '<option value="' + esc(p.id) + '"' + (projId === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('') +
      '</select>';

    const head = '<div class="head"><span class="eyebrow">過去問の振り返り結果</span><h1>結果分析</h1></div>';
    if (!n) {
      return '<main class="screen">' + head + filters +
        '<section class="glass panel"><h2>この条件の結果はまだありません</h2><span class="muted">振り返り画面で○△×を付けると、ここに集計されます。</span></section></main>' + tabbar();
    }

    const kpi = (label, value, sub, color) => '<div class="glass kpi"><span class="muted row" style="gap:6px"><span class="key" style="background:' + color + '"></span>' + label + '</span><span class="v">' + value + '</span><span class="muted">' + sub + '</span></div>';
    const kpis = '<div class="kpis">' +
      kpi('振り返った問題', String(n), period === 'all' ? '全期間' : '直近' + period + '日', 'rgba(255,255,255,0.5)') +
      MARKS.map((m) => kpi(m.sym + ' ' + m.label, pct(cnt[m.key]), cnt[m.key] + '問', m.chart)).join('') + '</div>';
    const legend = '<div class="legend">' + MARKS.map((m) => '<span><span class="key" style="background:' + m.chart + '"></span>' + m.sym + ' ' + m.label + '</span>').join('') + '</div>';

    const cats = CAT_NAMES.map((name, ci) => {
      const rs = recs.filter((r) => r.item[0] === ci);
      const c = { o: 0, t: 0, x: 0 };
      rs.forEach((r) => { c[r.mark]++; });
      const tot = rs.length;
      const segs = tot ? MARKS.filter((m) => c[m.key] > 0).map((m) => '<div style="width:' + (c[m.key] * 100 / tot) + '%;background:' + m.chart + '"></div>').join('') : '';
      return '<div class="cat"><div class="row" style="justify-content:space-between"><span style="font-size:14px">' + name + '</span>' +
        '<span class="muted">' + (tot ? '○' + c.o + ' △' + c.t + ' ×' + c.x + '（' + tot + '問）' : 'まだありません') + '</span></div><div class="stack">' + segs + '</div></div>';
    }).join('');

    const dayList = [];
    for (let i = 13; i >= 0; i--) {
      const d0 = startOfToday - i * 86400000;
      const c = { o: 0, t: 0, x: 0 };
      recs.forEach((r) => { if (r.at >= d0 && r.at < d0 + 86400000) c[r.mark]++; });
      dayList.push({ d: new Date(d0), c: c, tot: c.o + c.t + c.x });
    }
    const goal = state.questionCount;
    const maxDay = Math.max(goal, ...dayList.map((x) => x.tot), 1);
    const days = dayList.map((x) => {
      const ms = MARKS.filter((m) => x.c[m.key] > 0);
      const tip = (x.d.getMonth() + 1) + '月' + x.d.getDate() + '日：' + x.tot + '問（○' + x.c.o + ' △' + x.c.t + ' ×' + x.c.x + '）';
      return '<div class="day" role="img" aria-label="' + esc(tip) + '" title="' + esc(tip) + '">' +
        ms.map((m, i) => '<div style="height:' + (x.c[m.key] * 120 / maxDay) + 'px;background:' + m.chart + ';border-radius:' + (i === ms.length - 1 ? '3px 3px 0 0' : '0') + '"></div>').join('') + '</div>';
    }).join('');
    const dayLabels = dayList.map((x, i) => '<span>' + (i % 2 === 1 ? (x.d.getMonth() + 1) + '/' + x.d.getDate() : '') + '</span>').join('');

    const weak = recs.filter((r) => r.mark === 't' || r.mark === 'x').sort((a, b) => b.at - a.at);
    const weakRows = weak.slice(0, 20).map((r) => {
      const d = new Date(r.at);
      const m = MARK[r.mark];
      return '<div class="weak"><div class="row" style="gap:10px"><span class="sym" style="background:' + m.btn + '" aria-label="' + m.sym + ' ' + m.label + '">' + m.sym + '</span>' +
        '<div class="grow"><div style="font-size:14px;font-weight:700">' + esc(CAT_NAMES[r.item[0]] || '') + '</div><div class="muted ellipsis">' + esc(r.project) + ' · ' + (r.at ? (d.getMonth() + 1) + '/' + d.getDate() : '日付なし') + '</div></div></div>' +
        (r.note ? '<div style="font-size:13px;color:var(--ink-2);line-height:1.5">' + esc(r.note) + '</div>' : '') +
        '<div class="two"><a class="btn btn-sub btn-sm" href="' + esc(qHrefOf(r.item)) + '" target="_blank" rel="noopener">問題</a>' +
        '<a class="btn btn-sub btn-sm" href="' + esc(aHrefOf(r.item)) + '" target="_blank" rel="noopener">回答</a></div></div>';
    }).join('');

    return '<main class="screen">' + head + filters + kpis +
      '<section class="glass panel"><h2>出題元ごとの結果</h2>' + legend + cats + '</section>' +
      '<section class="glass panel"><div class="row" style="justify-content:space-between"><h2>日ごとの振り返り数</h2><span class="muted">直近14日・点線＝目標' + goal + '問</span></div>' +
        '<div class="days"><div class="goal" style="bottom:' + (goal * 120 / maxDay) + 'px"></div>' + days + '</div><div class="day-labels">' + dayLabels + '</div></section>' +
      '<section class="glass panel"><div class="row" style="justify-content:space-between"><h2>苦手な問題（△×）</h2><span class="muted">新しい順 · ' + weak.length + '問</span></div>' +
        (weak.length ? weakRows : '<span class="muted">△×を付けた問題はありません。</span>') + '</section>' +
    '</main>' + tabbar();
  }

  // ---------- 画面：設定 ----------
  function settings() {
    const radio = (name, value, checked, label) => '<div class="item"><label for="' + name + '-' + value + '">' + label + '</label><input type="radio" id="' + name + '-' + value + '" name="' + name + '" value="' + value + '" data-change="radio"' + (checked ? ' checked' : '') + '></div>';
    return '<main class="screen">' +
      '<div class="head"><h1>設定</h1></div>' +
      '<div class="section-title">1日の問題数</div>' +
      '<div class="glass group"><div class="item"><div class="grow"><div style="font-size:16px">振り返りの問題数</div><div class="muted">ホームの「今日の振り返り' + state.questionCount + '問」</div></div>' +
        '<div class="stepper"><button type="button" aria-label="問題数を減らす" data-action="q-dec"' + (state.questionCount <= QMIN ? ' disabled' : '') + '>−</button><span>' + state.questionCount + '</span>' +
        '<button type="button" aria-label="問題数を増やす" data-action="q-inc"' + (state.questionCount >= QMAX ? ' disabled' : '') + '>+</button></div></div></div>' +
      '<div class="section-title">問題の開き方</div>' +
      '<div class="glass group">' + radio('qMode', 'browser', state.qMode !== 'discord', 'ブラウザで開く') + radio('qMode', 'discord', state.qMode === 'discord', 'Discordアプリで開く') + '</div>' +
      '<div class="section-title">パスワード</div>' +
      '<div class="glass group"><div class="item"><div class="grow"><div style="font-size:16px">この端末でロックする</div><div class="muted">次に開くときにパスワードが必要になります。振り返りのデータは消えません。</div></div>' +
        '<button type="button" class="btn btn-sub btn-sm" data-action="lock">ロック</button></div></div>' +
      '<div class="section-title">データについて</div>' +
      '<div class="glass group"><div class="item"><span class="muted">プロジェクトと結果は、この iPhone のこのアプリの中にだけ保存されます。ほかの端末やPC版とは共有されません。消えないように、Safari の共有メニューから「ホーム画面に追加」して使ってください。</span></div></div>' +
      '<p class="muted" style="text-align:center;margin:8px 0 0">今日の振り返り Web版 1.0.0</p>' +
    '</main>' + tabbar();
  }

  // ---------- シート ----------
  function sheet(title, body, foot, labelId) {
    return '<div class="overlay" data-overlay="1"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="' + labelId + '">' +
      '<div class="sheet-head"><div class="grabber" aria-hidden="true"></div><div class="sheet-title"><h2 id="' + labelId + '">' + title + '</h2>' +
      '<button type="button" class="link-btn" data-action="close-dialog">閉じる</button></div></div>' +
      '<div class="sheet-body">' + body + '</div>' + (foot ? '<div class="sheet-foot">' + foot + '</div>' : '') + '</div></div>';
  }

  function dialogNew() {
    const bank = state.bank;
    const missed = missedPool(false);
    const selectedIds = {};
    if (bank) bank.categories.forEach((c) => { if (!state.catOff[c.name]) c.items.forEach((it) => { selectedIds[it[1]] = 1; }); });
    if (state.missedOn) missedPool(true).forEach((it) => { selectedIds[it[2]] = 1; });
    const selectedCount = Object.keys(selectedIds).length;
    const missedOn = state.missedOn && missed.length > 0;

    const cats = !bank
      ? '<span class="muted">' + (state.bankError ? '問題リストを読み込めませんでした。通信状況を確認して開き直してください' : '問題リストを読み込み中…') + '</span>'
      : bank.categories.map((c) => '<label class="check"><input type="checkbox" data-change="cat" data-arg="' + esc(c.name) + '"' + (state.catOff[c.name] ? '' : ' checked') + '><span class="grow">' + esc(c.name) + '</span><span class="muted">' + c.items.length + '問</span></label>').join('');

    let missedHtml = '';
    if (missed.length) {
      missedHtml = '<label class="check missed"><input type="checkbox" data-change="missed"' + (missedOn ? ' checked' : '') + '><span class="grow">過去に間違えた問題</span><span class="muted">△×の' + missed.length + '問</span></label>';
      if (missedOn) {
        missedHtml += '<span class="muted" style="margin-left:16px">どのプロジェクトから出すか</span>' + state.projects.map((p) => {
          const res = p.results || {};
          let tri = 0, cross = 0;
          Object.keys(res).forEach((k) => { if (res[k].mark === 't') tri++; if (res[k].mark === 'x') cross++; });
          if (!tri && !cross) return '';
          return '<label class="check sub"><input type="checkbox" data-change="missed-proj" data-arg="' + esc(p.id) + '"' + (state.missedProjOff[p.id] ? '' : ' checked') + '><span class="grow ellipsis">' + esc(p.name) + '</span><span class="muted">△' + tri + ' ×' + cross + '</span></label>';
        }).join('');
      }
    }
    const cannot = !state.newName.trim() || !bank || !selectedCount;
    const body =
      '<div class="block" style="gap:6px"><label class="label" for="new-project-name">プロジェクト名</label>' +
      '<input id="new-project-name" class="input" type="text" enterkeyhint="done" autocomplete="off" placeholder="プロジェクト名を入力" value="' + esc(state.newName) + '" data-input="newName"></div>' +
      '<fieldset><legend>出題元（複数選べます）</legend>' + cats + missedHtml + '</fieldset>' +
      '<span class="muted">選んだ出題元の全' + selectedCount + '問をランダムな順番で保存し、1日' + state.questionCount + '問ずつ振り返ります。</span>';
    const foot = '<button type="button" id="create-btn" class="btn btn-amber btn-block" data-action="create"' + (cannot ? ' disabled' : '') + '>作成して開始</button>';
    return sheet('新しいプロジェクト', body, foot, 'dlg-new');
  }

  function dialogPick() {
    const rows = state.projects.slice().sort((a, b) => b.updatedAt - a.updatedAt).map((p) => {
      if (state.confirmDeleteId === p.id) {
        return '<div class="proj"><div class="proj-confirm"><span>「' + esc(p.name) + '」を削除しますか？自己評価と反省・備考も消えます。</span>' +
          '<div class="two"><button type="button" class="btn btn-danger btn-sm" data-action="do-delete" data-arg="' + esc(p.id) + '">削除</button>' +
          '<button type="button" class="btn btn-sub btn-sm" data-action="cancel-delete">キャンセル</button></div></div></div>';
      }
      const idx = Math.min(p.index, p.total);
      const finished = p.index >= p.total;
      return '<div class="proj"><button type="button" class="proj-open' + (p.id === state.currentId ? ' current' : '') + '" data-action="open-project" data-arg="' + esc(p.id) + '">' +
        '<span class="proj-name">' + esc(p.name) + '</span>' +
        '<span class="muted">全体 ' + idx + ' / ' + p.total + ' 問（' + Math.floor(idx * 100 / Math.max(1, p.total)) + '%）· ' + dateLabel(p.createdAt) + '作成</span>' +
        '<span style="font-size:13px;color:' + (finished ? 'var(--ink-3)' : 'var(--amber)') + '">' + (finished ? '全問終了（最初から）' : (p.index === 0 ? '未着手' : (p.index + 1) + ' 問目から')) + '</span></button>' +
        '<button type="button" class="proj-del" aria-label="「' + esc(p.name) + '」を削除" data-action="ask-delete" data-arg="' + esc(p.id) + '">' + I.trash + '</button></div>';
    }).join('');
    return sheet('プロジェクトを選ぶ', rows || '<span class="muted">保存されているプロジェクトはありません。</span>', '', 'dlg-pick');
  }

  // ---------- 描画 ----------
  function render() {
    const active = document.activeElement;
    const activeId = active && root.contains(active) && active.id ? active.id : null;
    const sel = activeId && typeof active.selectionStart === 'number' ? [active.selectionStart, active.selectionEnd] : null;
    const sheetBody = root.querySelector('.sheet-body');
    const sheetScroll = sheetBody ? sheetBody.scrollTop : 0;

    if (state.locked) {
      root.innerHTML = lockScreen();
      if (activeId) { const el = document.getElementById(activeId); if (el) el.focus({ preventScroll: true }); }
      return;
    }
    let page = '';
    if (state.screen === 'home') page = home();
    else if (state.screen === 'review') page = review();
    else if (state.screen === 'analysis') page = analysis();
    else page = settings();
    let dlg = '';
    if (state.dialog === 'new') dlg = dialogNew();
    else if (state.dialog === 'pick') dlg = dialogPick();

    root.innerHTML = page + dlg + (state.toast ? '<div class="glass toast" role="status">' + esc(state.toast) + '</div>' : '');
    document.body.style.overflow = state.dialog ? 'hidden' : '';

    const sb = root.querySelector('.sheet-body');
    if (sb) sb.scrollTop = sheetScroll;
    if (activeId) {
      const el = document.getElementById(activeId);
      if (el) {
        el.focus({ preventScroll: true });
        if (sel && el.setSelectionRange) { try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* 無視 */ } }
      }
    }
  }

  // ---------- 操作 ----------
  const actions = {
    'go-home': () => { set({ screen: 'home', toast: '' }, { persist: false }); window.scrollTo(0, 0); },
    'go-analysis': () => { set({ screen: 'analysis', toast: '' }, { persist: false }); window.scrollTo(0, 0); },
    'go-settings': () => { set({ screen: 'settings', toast: '' }, { persist: false }); window.scrollTo(0, 0); },
    'toggle-done': () => {
      if (state.qDoneDate === todayKey()) set({ qDoneDate: null, qDoneTime: '' });
      else set({ qDoneDate: todayKey(), qDoneTime: hhmm(new Date()) });
    },
    'resume': () => { const c = current(); if (c) beginSession(c.id); },
    'new-project': () => set({ dialog: 'new', newName: '', missedOn: false, toast: '' }, { persist: false }),
    'open-picker': () => set({ dialog: 'pick', confirmDeleteId: null, toast: '' }, { persist: false }),
    'close-dialog': () => set({ dialog: null, confirmDeleteId: null }, { persist: false }),
    'create': () => createProject(),
    'open-project': (id) => beginSession(id),
    'ask-delete': (id) => set({ confirmDeleteId: id }, { persist: false }),
    'cancel-delete': () => set({ confirmDeleteId: null }, { persist: false }),
    'do-delete': (id) => deleteProject(id),
    'mark': (k) => { const c = current(); if (c) setResult(c.index, { mark: k }); },
    'prev': () => { const c = current(); if (c) { updateCurrent({ index: Math.max(c.batchStart != null ? c.batchStart : 0, c.index - 1) }); render(); window.scrollTo(0, 0); } },
    'next': () => { const c = current(); if (!c) return; const r = (c.results || {})[c.index]; if (!r || !r.mark) return; nextQuestion(); },
    'q-dec': () => set({ questionCount: Math.max(QMIN, state.questionCount - 1) }),
    'q-inc': () => set({ questionCount: Math.min(QMAX, state.questionCount + 1) }),
    'ana-period': (v) => set({ anaPeriod: v }, { persist: false }),
    'lock': () => {
      flush();
      try { localStorage.removeItem(KEY_STORE); } catch (e) { /* 無視 */ }
      state.bank = null;
      set({ locked: true, lockError: '', screen: 'home', dialog: null, toast: '' }, { persist: false });
    },
    'unlock': () => unlock()
  };

  root.addEventListener('click', (e) => {
    if (e.target.dataset && e.target.dataset.overlay) { actions['close-dialog'](); return; }
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled || !root.contains(el)) return;
    const fn = actions[el.dataset.action];
    if (fn) { e.preventDefault(); fn(el.dataset.arg); }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.dialog) actions['close-dialog']();
    if (e.key === 'Enter' && e.target.id === 'new-project-name') { e.preventDefault(); createProject(); }
    if (e.key === 'Enter' && e.target.id === 'lock-password') { e.preventDefault(); unlock(); }
  });

  root.addEventListener('change', (e) => {
    const el = e.target;
    const kind = el.dataset.change;
    if (!kind) return;
    if (kind === 'radio') set({ [el.name]: el.value });
    else if (kind === 'cat') set({ catOff: Object.assign({}, state.catOff, { [el.dataset.arg]: !el.checked }) });
    else if (kind === 'missed') set({ missedOn: el.checked }, { persist: false });
    else if (kind === 'missed-proj') set({ missedProjOff: Object.assign({}, state.missedProjOff, { [el.dataset.arg]: !el.checked }) });
    else if (kind === 'ana-project') set({ anaProject: el.value }, { persist: false });
  });

  // 文字入力は再描画せずに保存（入力中のカーソルやキーボードを保つ）
  root.addEventListener('input', (e) => {
    const el = e.target;
    const key = el.dataset.input;
    if (!key) return;
    if (key === 'note') {
      const c = current();
      if (c) setResult(c.index, { note: el.value }, false);
      return;
    }
    if (key === 'newName') {
      state.newName = el.value;
      const btn = document.getElementById('create-btn');
      if (btn) btn.disabled = !el.value.trim() || !state.bank || buildPool().length === 0;
    }
  });

  // 日付が変わったら完了スイッチを戻す（アプリに戻ってきたときも確認）
  function checkDay() {
    if (state.qDoneDate && state.qDoneDate !== todayKey()) set({ qDoneDate: null, qDoneTime: '' });
    else if (state.screen === 'home' && !state.dialog) render();
  }
  setInterval(checkDay, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkDay(); });


  // ---------- パスワード（問題リストの暗号を解く） ----------
  // data/questions.enc は tools/パスワード設定.html で作る。
  // 形式: { v:1, iter, salt, iv, ct }（PBKDF2-SHA256 で鍵を作り AES-GCM で暗号化、すべて base64）
  const KEY_STORE = 'kyou-furikaeri-key-v1';
  let encData = null;
  const b64 = (buf) => { let s = ''; new Uint8Array(buf).forEach((b) => { s += String.fromCharCode(b); }); return btoa(s); };
  const unb64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

  async function deriveKey(password, enc) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(enc.salt), iterations: enc.iter },
      base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
  }

  async function decryptBank(key, enc) {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(enc.iv) }, key, unb64(enc.ct));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  async function startBank() {
    try {
      const r = await fetch('data/questions.enc', { cache: 'no-cache' });
      if (!r.ok) throw new Error(r.status);
      encData = await r.json();
    } catch (e) {
      state.bankError = true;
      state.locked = true;
      state.lockError = '問題リストを読み込めませんでした。通信状況を確認して開き直してください。';
      render();
      return;
    }
    // この端末で覚えている鍵があれば、それで開く
    try {
      const saved = localStorage.getItem(KEY_STORE);
      if (saved) {
        const key = await crypto.subtle.importKey('raw', unb64(saved), { name: 'AES-GCM' }, false, ['decrypt']);
        state.bank = await decryptBank(key, encData);
        state.locked = false;
        render();
        return;
      }
    } catch (e) {
      try { localStorage.removeItem(KEY_STORE); } catch (e2) { /* 無視 */ }
    }
    state.locked = true;
    render();
  }

  async function unlock() {
    const input = document.getElementById('lock-password');
    const remember = document.getElementById('lock-remember');
    const pw = input ? input.value : '';
    if (!pw || !encData || state.lockBusy) return;
    state.lockBusy = true;
    state.lockError = '';
    render();
    try {
      const key = await deriveKey(pw, encData);
      const bank = await decryptBank(key, encData);
      if (!remember || remember.checked) {
        try { localStorage.setItem(KEY_STORE, b64(await crypto.subtle.exportKey('raw', key))); } catch (e) { /* 覚えられなくても続ける */ }
      }
      state.bank = bank;
      state.locked = false;
      state.lockBusy = false;
      render();
    } catch (e) {
      state.lockBusy = false;
      state.lockError = 'パスワードが違います';
      render();
      const el = document.getElementById('lock-password');
      if (el) { el.value = ''; el.focus(); }
    }
  }

  function lockScreen() {
    const ready = !!encData;
    return '<main class="screen lock">' +
      '<div class="lock-box glass">' +
        '<img src="icons/icon-192.png" alt="" width="72" height="72" class="lock-icon">' +
        '<h1 style="font-size:26px">今日の振り返り</h1>' +
        '<p class="muted" style="margin:0;text-align:center">パスワードを入力してください</p>' +
        '<form class="lock-form" onsubmit="return false">' +
          '<label class="label" for="lock-password">パスワード</label>' +
          '<input id="lock-password" class="input" type="password" autocomplete="current-password" enterkeyhint="go"' + (ready && !state.lockBusy ? '' : ' disabled') + '>' +
          '<label class="remember"><input id="lock-remember" type="checkbox" checked>この端末で覚える</label>' +
          (state.lockError ? '<p class="warn" role="alert">' + esc(state.lockError) + '</p>' : '') +
          '<button type="button" class="btn btn-amber btn-block" data-action="unlock"' + (ready && !state.lockBusy ? '' : ' disabled') + '>' + (state.lockBusy ? '確認中…' : '開く') + '</button>' +
        '</form>' +
      '</div>' +
    '</main>';
  }

  // ---------- 起動 ----------
  load();
  state.locked = true;
  render();
  startBank();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* オフライン対応なしで動く */ });
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();
