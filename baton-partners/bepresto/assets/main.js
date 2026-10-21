/* BE.PRESTO × Baton Partners
   - 五線譜のヒーロー（鐘の波紋で譜線がゆれる）
   - 鐘と和音（Web Audio。押したときだけ鳴る）
   - メトロノーム、8小節のAI研修スコア、表紙のチルト */
(() => {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  /* ---------- audio ---------- */
  let ac = null;
  let master = null;
  function audio() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.5;
      const comp = ac.createDynamicsCompressor();
      master.connect(comp).connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  // 鐘の倍音（整数倍にならない部分音が「鐘らしさ」）: [比率, 音量, 減衰秒]
  const BELL = [
    [0.5, 0.32, 5.0], [1, 1, 3.6], [1.19, 0.42, 2.8], [1.5, 0.26, 2.2], [2, 0.46, 2.0],
    [2.51, 0.2, 1.4], [2.66, 0.16, 1.2], [3.01, 0.14, 1.0], [4.1, 0.08, 0.6], [5.43, 0.05, 0.4],
  ];
  function ringBell(freq = 523.25, vel = 1) {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + 0.01;
    for (const [ratio, amp, decay] of BELL) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = freq * ratio;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16 * amp * vel, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + decay + 0.05);
    }
  }
  function softNote(freq, delay = 0, len = 2.4) {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + 0.01 + delay;
    [[1, 0.5, 'triangle'], [2, 0.12, 'sine'], [3, 0.05, 'sine']].forEach(([mul, amp, type]) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.value = freq * mul;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2 * amp, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len / mul);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + len + 0.05);
    });
  }
  function flagRinging(el, ms = 900) {
    el.classList.remove('is-ringing');
    void el.offsetWidth;
    el.classList.add('is-ringing');
    setTimeout(() => el.classList.remove('is-ringing'), ms);
  }

  /* ---------- header ---------- */
  const hdr = $('[data-hdr]');
  const onScroll = () => hdr && hdr.classList.toggle('is-solid', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- reveal ---------- */
  const revealEls = $$('[data-reveal]');
  if (reduce || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    revealEls.forEach((el) => io.observe(el));
  }

  /* ---------- hero: staff canvas ---------- */
  const staff = (() => {
    const canvas = $('[data-staff]');
    if (!canvas) return { ripple() {} };
    const ctx = canvas.getContext('2d');
    const hero = canvas.parentElement;
    const origin = $('[data-bell-origin]');
    let w = 0, h = 0, dpr = 1, gap = 12, staffY = 0;
    let ripples = [];
    let notes = [];
    let running = false;
    let raf = 0;
    let last = 0;
    let nextAuto = 0;
    const BEAT = (60 / 184) * 4 * 1000; // 1小節（4拍）ごとに小さく鳴る

    function originPoint() {
      if (!origin) return { x: w * 0.8, y: staffY };
      const r = origin.getBoundingClientRect();
      const c = canvas.getBoundingClientRect();
      return { x: r.left + r.width / 2 - c.left, y: r.top + r.height / 2 - c.top };
    }
    function seedNotes() {
      const count = Math.round(w / 70);
      notes = Array.from({ length: count }, (_, i) => ({
        x: (i / count) * w + Math.random() * 40,
        step: Math.floor(Math.random() * 11) - 1,
        speed: 14 + Math.random() * 18,
        stem: Math.random() > 0.35,
        teal: Math.random() > 0.72,
        open: Math.random() > 0.8,
      }));
    }
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gap = Math.max(10, Math.min(16, w / 95));
      // PC：ヒーローの下端（本文と重ねない）／スマホ：鐘のバッジを五線が通る
      if (w < 880 && origin) {
        const r = origin.getBoundingClientRect();
        const c = canvas.getBoundingClientRect();
        staffY = r.top + r.height / 2 - c.top;
      } else {
        staffY = h - 96;
      }
      seedNotes();
      if (!running) draw(performance.now(), 0);
    }
    function disp(x, y, now) {
      let dy = 0;
      for (const r of ripples) {
        const age = (now - r.t) / 1000;
        const rad = age * 340;
        const fade = Math.max(0, 1 - age / 3.4);
        if (fade <= 0) continue;
        const k = Math.hypot(x - r.x, y - r.y) - rad;
        if (Math.abs(k) > 90) continue;
        dy += 9 * r.p * fade * Math.exp(-(k * k) / 1800) * Math.sin(k * 0.11);
      }
      return dy;
    }
    function draw(now, dt) {
      ctx.clearRect(0, 0, w, h);
      ripples = ripples.filter((r) => now - r.t < 3600);

      // 波紋
      for (const r of ripples) {
        const age = (now - r.t) / 1000;
        const rad = age * 340;
        const fade = Math.max(0, 1 - age / 3.4);
        ctx.beginPath();
        ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(10,186,181,${0.32 * fade * r.p})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        if (r.p > 0.8) {
          ctx.beginPath();
          ctx.arc(r.x, r.y, rad * 0.82, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(201,161,91,${0.22 * fade})`;
          ctx.stroke();
        }
      }

      // 五線
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const y0 = staffY + (i - 2) * gap;
        ctx.beginPath();
        for (let x = 0; x <= w + 8; x += 8) {
          const y = y0 + (ripples.length ? disp(x, y0, now) : 0);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(244,241,234,0.16)';
        ctx.stroke();
      }

      // 音符
      const rx = gap * 0.62;
      const ry = gap * 0.44;
      for (const n of notes) {
        if (dt) {
          n.x -= n.speed * dt;
          if (n.x < -30) {
            n.x = w + 20 + Math.random() * 60;
            n.step = Math.floor(Math.random() * 11) - 1;
          }
        }
        const baseY = staffY + 2 * gap - n.step * (gap / 2);
        const y = baseY + (ripples.length ? disp(n.x, baseY, now) : 0);
        const color = n.teal ? 'rgba(10,186,181,0.75)' : 'rgba(244,241,234,0.38)';
        ctx.save();
        ctx.translate(n.x, y);
        ctx.rotate(-0.38);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        if (n.open) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.6;
          ctx.stroke();
        } else {
          ctx.fillStyle = color;
          ctx.fill();
        }
        ctx.restore();
        if (n.stem) {
          ctx.beginPath();
          ctx.moveTo(n.x + rx * 0.9, y - 1);
          ctx.lineTo(n.x + rx * 0.9, y - gap * 3.2);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
        // 加線
        if (n.step < 0 || n.step > 8) {
          const ly = n.step < 0 ? staffY + 3 * gap : staffY - 3 * gap;
          ctx.beginPath();
          ctx.moveTo(n.x - rx * 1.6, ly);
          ctx.lineTo(n.x + rx * 1.6, ly);
          ctx.strokeStyle = 'rgba(244,241,234,0.16)';
          ctx.stroke();
        }
      }
    }
    function loop(now) {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (now > nextAuto) {
        const o = originPoint();
        ripples.push({ x: o.x, y: o.y, t: now, p: 0.38 });
        nextAuto = now + BEAT;
      }
      draw(now, dt);
      raf = requestAnimationFrame(loop);
    }
    function start() {
      if (running || reduce) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(loop);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }
    function ripple(power = 1) {
      const o = originPoint();
      const now = performance.now();
      ripples.push({ x: o.x, y: o.y, t: now, p: power });
      ripples.push({ x: o.x, y: o.y, t: now + 160, p: power * 0.6 });
      if (reduce) draw(now, 0);
    }

    resize();
    let rT = 0;
    window.addEventListener('resize', () => {
      clearTimeout(rT);
      rT = setTimeout(resize, 120);
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => (e.isIntersecting && !document.hidden ? start() : stop())).observe(hero);
    } else {
      start();
    }
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    return { ripple };
  })();

  /* ---------- bell buttons ---------- */
  $$('[data-ring]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ringBell(523.25, 1);
      staff.ripple(1.25);
      $$('[data-ring]').forEach((b) => flagRinging(b));
    });
  });
  $$('[data-ring-note]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ringBell(parseFloat(btn.dataset.ringNote), 0.9);
      flagRinging(btn, 1000);
    });
  });

  /* ---------- hero ticker ---------- */
  const tickerEl = $('[data-ticker]');
  if (tickerEl && !reduce) {
    const words = ['採用につながる発信', '現場で使えるAI', '企業と個人の、正しい出会い', '言葉になっていなかった魅力'];
    let i = 0;
    setInterval(() => {
      if (document.hidden) return;
      tickerEl.classList.add('is-out');
      setTimeout(() => {
        i = (i + 1) % words.length;
        tickerEl.textContent = words[i];
        tickerEl.classList.remove('is-out');
        tickerEl.classList.add('is-in');
        void tickerEl.offsetWidth;
        tickerEl.classList.remove('is-in');
      }, 480);
    }, 2600);
  }

  /* ---------- prologue: scale pin ---------- */
  const scaleBox = $('[data-scale]');
  if (scaleBox) {
    const pin = $('.scale-pin', scaleBox);
    const target = $('.is-presto', scaleBox);
    const place = () => {
      const y = target.offsetTop + target.offsetHeight / 2 - 15 + 20;
      pin.style.setProperty('--pin-y', `${y}px`);
    };
    if (reduce || !('IntersectionObserver' in window)) {
      place();
    } else {
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        setTimeout(place, 250);
        io.disconnect();
      }, { threshold: 0.4 });
      io.observe(scaleBox);
    }
    window.addEventListener('resize', () => {
      if (pin.style.getPropertyValue('--pin-y')) place();
    });
  }

  /* ---------- tempo / metronome ---------- */
  const tempo = $('[data-tempo]');
  if (tempo) {
    const STAGES = [
      {
        name: 'Largo', bpm: 40, jp: '幅広く、ゆるやかに', state: '止まっている',
        pain: '投稿が続かない。SNS運用を外注に頼りきりで、社内では回せない。',
        fix: 'TikTok・Instagram・YouTube・X・Threadsの運用を、企画から撮影、運用、広告までまとめて引き受けます。',
      },
      {
        name: 'Adagio', bpm: 66, jp: 'ゆっくりと', state: '学んで終わる',
        pain: 'AI研修はやった。でもChatGPTの使い方を覚えただけで、現場では使われていない。',
        fix: '職務別のAI研修を、全8回・11時間20分で。ゴールは「現場で明日から実装できる状態」に置いています。',
      },
      {
        name: 'Andante', bpm: 92, jp: '歩くような速さで', state: '届いていない',
        pain: '大手の求人サイトに載せても応募が来ない。若手やZ世代に、そもそも情報が届いていない。',
        fix: '採用に特化したSNS運用。リール・TikTok・YouTubeショートで、会社の魅力をリアルに伝えます。',
      },
      {
        name: 'Allegro', bpm: 132, jp: '速く、快活に', state: '回りはじめる',
        pain: '興味を持ってくれる人は出てきた。けれど、応募の一歩手前で止まってしまう。',
        fix: '採用専用の公式LINEを構築し、求職者と手動でやりとり。事前面談で、ミスマッチも防ぎます。',
      },
      {
        name: 'Presto', bpm: 184, jp: 'きわめて速く', state: '鐘が鳴る',
        pain: '価値が埋もれる前に、本来届くべき人のところへ届いていく。',
        fix: 'ヒアリングから運用開始まで、最短20日。SNS運用代行・動画制作・事前面談まで含めて、月額10万円から。',
      },
    ];
    const range = $('[data-range]', tempo);
    const out = $('.tempo-out', tempo);
    const ticks = $$('[data-step]', tempo);
    const field = (k) => $(`[data-t="${k}"]`, tempo);
    const weightEl = $('.m-weight', tempo);

    const set = (i, animate = true) => {
      const s = STAGES[i];
      tempo.dataset.step = String(i);
      tempo.style.setProperty('--beat', `${(60 / s.bpm).toFixed(3)}s`);
      tempo.style.setProperty('--heat', String(i / 4));
      // 速いほど錘は下へ（実物のメトロノームと同じ）
      weightEl.style.setProperty('--wy', `${i * 18}px`);
      range.style.setProperty('--fill', `${(i / 4) * 100}%`);
      range.setAttribute('aria-valuetext', `${s.name}、四分音符イコール${s.bpm}。${s.state}`);
      field('name').textContent = s.name;
      field('bpm').textContent = String(s.bpm);
      field('jp').textContent = s.jp;
      field('state').textContent = s.state;
      field('pain').textContent = s.pain;
      field('fix').textContent = s.fix;
      ticks.forEach((t) => t.classList.toggle('is-on', Number(t.dataset.step) === i));
      if (animate && !reduce) {
        out.classList.remove('is-swap');
        void out.offsetWidth;
        out.classList.add('is-swap');
      }
    };
    range.addEventListener('input', () => set(Number(range.value)));
    ticks.forEach((t) => t.addEventListener('click', () => {
      range.value = t.dataset.step;
      set(Number(t.dataset.step));
    }));
    set(Number(range.value), false);
  }

  /* ---------- AI score ---------- */
  const score = $('[data-score]');
  if (score) {
    const OFFICE = ['生成AIの基礎と、自社の利用ルールづくり', 'AIツールの使い分けと、活用業務の選定'];
    const FIELD = ['生成AIの基礎と、現場での利用ルールづくり', 'スマホで使う生成AIと、活用作業の選定'];
    const JOBS = [
      { id: 'mkt', name: 'マーケティング・販促', common: OFFICE,
        parts: ['販促原稿・素材を生成AIで作る', '顧客の声と実績データを生成AIで分析する', '編集計画とレポートを生成AIで仕組み化する'],
        out: ['1か月分の投稿案を、テーマ別に振り分けた状態で用意する', '問い合わせと口コミから、よく使われている言い回しを抜き出す', '訴求軸ごとに広告文を書き分け、比較できる一覧にする', '月次レポートを、数字と次の打ち手をセットにして下書きする'] },
      { id: 'fin', name: '経理・財務', common: OFFICE,
        parts: ['経理の定型文書と表計算を生成AIで効率化する', '試算表・帳票データを生成AIで読み解く', '月次締めとレポートを生成AIで仕組み化する'],
        out: ['売掛の滞留を年齢別に並べ、督促の文面まで用意する', '経費の増減が大きい科目を抜き出し、要因の当たりをつける', '表計算の集計・突合を、関数と手順ごとAIに書かせる', '月次締めの手順を、担当と期日入りのチェックリストにする'] },
      { id: 'sales', name: '営業・企画・提案', common: OFFICE,
        parts: ['商談準備と営業文面を生成AIで効率化する', '商談記録と過去の提案書を生成AIで活用する', '提案の型とナレッジを生成AIで仕組み化する'],
        out: ['訪問前に、相手企業と業界の要点を1枚にまとめる', '商談の録音を、決まったことと持ち帰りが分かれた記録に変える', '過去の提案書を組み替えて、目の前の案件用の初稿を出す', '案件ごとの次アクションを、期日つきで洗い出す'] },
      { id: 'hr', name: '人事（採用・育成）', common: OFFICE,
        parts: ['求人票と応募者対応を生成AIで効率化する', '面接設計と応募者データを生成AIで整理する', '採用フローと評価資料を生成AIで仕組み化する'],
        out: ['職種ごとの求人票とスカウト文を、訴求を変えて数パターン用意する', '面接で聞くことを、評価項目とひもづけた質問リストにする', '面接の記録を、候補者どうしを比べられる形に整える', '応募から入社までの連絡文を、状況別にひととおり揃える'] },
      { id: 'labor', name: '労務', common: OFFICE,
        parts: ['社内通達と規程ドラフトを生成AIで作成する', '就業規則・勤怠データを生成AIで読み解く', '社内FAQと手続き手順を生成AIで仕組み化する'],
        out: ['社内通達や案内文を、対象者ごとに書き分けて出す', '規程の改訂で変わる箇所を、新旧対照の形に整える', '勤怠・残業データから、注意が要る部署と人を抜き出す', 'よくある問い合わせを、社内が自分で引ける形にまとめる'] },
      { id: 'mfg', name: '製造業の現場', common: FIELD,
        parts: ['日報・作業記録を生成AIでその場で作る', '不具合報告と点検記録を生成AIで分析する', '作業手順書と教育資料を生成AIで仕組み化する'],
        out: ['手書きメモや写真から、日報と作業連絡をその場で整える', '不具合報告を集めて、繰り返し起きている事象を抜き出す', 'ベテランへの聞き取りを、そのまま読める手順書の形にする', '手順書と掲示物を、現場で使う言語に置き換える'] },
      { id: 'const', name: '建設業の現場', common: FIELD,
        parts: ['日報・所見・連絡文を生成AIでその場で作る', '打合せ記録と仕様書を生成AIで読み解く', '安全書類とチェックリストを生成AIで仕組み化する'],
        out: ['現場写真とメモから、日報と所見をその場でまとめる', '打合せの録音を、決まったことと持ち帰りに分けて残す', '仕様書・図面注記から、確認すべき点を洗い出す', '安全書類の作成手順を、抜けが出ない形に整える'] },
      { id: 'logi', name: '運送業の現場', common: FIELD,
        parts: ['連絡文・日報を生成AIでその場で作る', '運行記録とヒヤリハットを生成AIで分析する', '点呼手順と教育資料を生成AIで仕組み化する'],
        out: ['点呼や日報の記録を、話した言葉から整える', '運行記録から、負荷が偏っている乗務員と路線を抜き出す', 'ヒヤリハット報告をまとめて、繰り返し起きている場所を特定する', '乗務員教育の資料を、自社の事故事例に基づいて作る'] },
    ];
    const TOOLS = [
      { id: 'chatgpt', name: 'ChatGPT', by: 'OpenAI', parts: ['ChatGPTの基本操作と、文書・ビジュアル作成', 'ファイル分析とDeep Researchによる情報活用', 'GPTsとタスク機能による業務の仕組み化'] },
      { id: 'gemini', name: 'Gemini', by: 'Google', parts: ['Geminiの基本操作と、資料・ビジュアル作成', 'Google Workspace連携とNotebookLMによる情報活用', 'GemsとGASによる業務の自動化'] },
      { id: 'copilot', name: 'Microsoft Copilot', by: 'Microsoft', parts: ['Copilotの基本操作と、Word・PowerPointでの資料作成', 'Microsoft 365連携によるデータ・情報活用', 'エージェントとCopilot Studioによる業務の自動化'] },
      { id: 'claude', name: 'Claude', by: 'Anthropic', parts: ['Claudeの基本操作と、Artifactsによる成果物作成', 'Coworkによる作業の委任と外部連携', 'Claude Codeと文脈設計による業務の仕組み化'] },
    ];
    const PART_LABEL = { 1: '第1部 共通', 2: '第2部 職務別', 3: '第3部 ツール別' };
    const jobsBox = $('[data-jobs]', score);
    const toolsBox = $('[data-tools]', score);
    const list = $('[data-measures]', score);
    const outcomes = $('[data-outcomes]', score);
    let job = JOBS[0];
    let tool = TOOLS[0];

    const chip = (label, sub, pressed) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(pressed));
      b.textContent = label;
      if (sub) {
        const s = document.createElement('small');
        s.textContent = sub;
        b.append(s);
      }
      return b;
    };
    JOBS.forEach((j, i) => {
      const b = chip(j.name, '', i === 0);
      b.addEventListener('click', () => { job = j; press(jobsBox, b); render(true); });
      jobsBox.append(b);
    });
    TOOLS.forEach((t, i) => {
      const b = chip(t.name, t.by, i === 0);
      b.addEventListener('click', () => { tool = t; press(toolsBox, b); render(true); });
      toolsBox.append(b);
    });
    function press(box, on) {
      $$('button', box).forEach((b) => b.setAttribute('aria-pressed', String(b === on)));
    }

    // 8小節を先に作り、中身だけ差し替える
    const cells = Array.from({ length: 8 }, (_, i) => {
      const li = document.createElement('li');
      li.className = 'measure';
      const part = i < 2 ? 1 : i < 5 ? 2 : 3;
      li.dataset.part = String(part);
      li.dataset.partLabel = PART_LABEL[part];
      li.style.setProperty('--ny', `${[8, -4, 4, -8, 0, -6, 6, -2][i]}px`);
      const vol = document.createElement('p');
      vol.className = 'm-vol';
      vol.textContent = `Vol.${i + 1}`;
      const title = document.createElement('p');
      title.className = 'm-title';
      li.append(vol, title);
      list.append(li);
      return { li, title, part };
    });

    function render(animate) {
      const titles = [...job.common, ...job.parts, ...tool.parts];
      cells.forEach((c, i) => {
        const changed = c.title.textContent !== titles[i];
        c.title.textContent = titles[i];
        if (animate && changed && !reduce) {
          c.li.classList.remove('is-swap');
          void c.li.offsetWidth;
          c.li.classList.add('is-swap');
        }
      });
      outcomes.replaceChildren(...job.out.map((t) => {
        const li = document.createElement('li');
        li.textContent = t;
        return li;
      }));
      $('[data-s="job"]', score).textContent = job.name;
      $('[data-s="tool"]', score).textContent = tool.name;
    }
    render(false);
  }

  /* ---------- chord ---------- */
  const chord = $('[data-chord]');
  if (chord) {
    const light = (i, ms = 1400) => {
      $$(`[data-note="${i}"]`, chord).forEach((el) => {
        el.classList.add('is-on');
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove('is-on'), ms);
      });
    };
    const heads = $$('.cn', chord);
    heads.forEach((li) => {
      const btn = $('.nh', li);
      btn.addEventListener('click', () => {
        softNote(parseFloat(btn.dataset.pitch));
        light(li.dataset.note);
      });
    });
    $('[data-chord-all]', chord).addEventListener('click', () => {
      heads.forEach((li, i) => {
        softNote(parseFloat($('.nh', li).dataset.pitch), i * 0.09, 3.2);
        setTimeout(() => light(li.dataset.note, 2400), i * 90);
      });
      softNote(130.81, 0.27, 3.6);
    });
  }

  /* ---------- measures count-up ---------- */
  const counters = $$('[data-count]');
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        const to = Number(el.dataset.count);
        const t0 = performance.now();
        const dur = 1400;
        const step = (now) => {
          const k = Math.min(1, (now - t0) / dur);
          el.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
          if (k < 1) requestAnimationFrame(step);
        };
        el.textContent = '0';
        requestAnimationFrame(step);
        io.unobserve(el);
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => io.observe(el));
  }

  /* ---------- cover tilt ---------- */
  const tilt = $('[data-tilt]');
  if (tilt && !reduce && window.matchMedia('(hover: hover)').matches) {
    const inner = $('.mag-inner', tilt);
    tilt.addEventListener('pointermove', (e) => {
      const r = tilt.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      inner.style.setProperty('--ry', `${x * 10}deg`);
      inner.style.setProperty('--rx', `${-y * 8}deg`);
    });
    tilt.addEventListener('pointerleave', () => {
      inner.style.setProperty('--ry', '0deg');
      inner.style.setProperty('--rx', '0deg');
    });
  }
})();
