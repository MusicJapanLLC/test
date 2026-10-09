'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

type Role = 'user' | 'assistant';
type Msg = { role: Role; content: string; thinking?: string };
type Convo = { id: string; title: string; messages: Msg[] };
type Tier = 'deep' | 'balanced' | 'longctx';
type Target = { id: string; name: string; base_url: string; host: string; rate_limit_rps: number; allowed: number };
type Tool = { id: string; category: string; label: string; note: string };
type Finding = { title: string; severity: string; reproduce: string; impact: string; remediation: string };
type RunResult = { ok: boolean; summary: string; raw?: string; findings?: Finding[]; error?: string };
type Scope = { inScope: boolean; reason: string };

const LS = 'redteam-console-convos';
const uid = () => Math.random().toString(36).slice(2, 10);

const TIERS: { v: Tier; label: string }[] = [
  { v: 'deep', label: 'DEEP / 最大推論' },
  { v: 'balanced', label: 'BALANCED / 標準' },
  { v: 'longctx', label: 'LONG-CTX / 長文' },
];

function ThinkBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="think">
      <button className="thinkhdr" onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} 推論プロセス <span className="thinklen">{text.length}字</span>
      </button>
      {open && <pre className="thinkbody">{text}</pre>}
    </div>
  );
}

export default function Page() {
  const [convos, setConvos] = useState<Convo[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [input, setInput] = useState('');
  const [tier, setTier] = useState<Tier>('balanced');
  const [busy, setBusy] = useState(false);

  // 右ペイン
  const [targets, setTargets] = useState<Target[]>([]);
  const [url, setUrl] = useState('');
  const [scope, setScope] = useState<Scope | null>(null);
  const [tools, setTools] = useState<Tool[]>([]);
  const [selectedTool, setSelectedTool] = useState('');
  const [result, setResult] = useState<RunResult | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = convos.find((c) => c.id === activeId);

  // 初期ロード
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS);
      if (raw) {
        const parsed: Convo[] = JSON.parse(raw);
        setConvos(parsed);
        setActiveId(parsed[0]?.id ?? '');
      }
    } catch { /* noop */ }
    fetch('/api/targets').then((r) => r.json()).then((d) => setTargets(d.targets ?? [])).catch(() => {});
  }, []);

  // 永続化
  useEffect(() => {
    try { localStorage.setItem(LS, JSON.stringify(convos)); } catch { /* noop */ }
  }, [convos]);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [active?.messages]);

  const newChat = () => { const c: Convo = { id: uid(), title: '新規セッション', messages: [] }; setConvos((v) => [c, ...v]); setActiveId(c.id); };

  const patchActive = useCallback((fn: (c: Convo) => Convo) => {
    setConvos((v) => v.map((c) => (c.id === activeId ? fn(c) : c)));
  }, [activeId]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    let id = activeId;
    if (!active) { const c: Convo = { id: uid(), title: text.slice(0, 28), messages: [] }; setConvos((v) => [c, ...v]); setActiveId(c.id); id = c.id; }
    const userMsg: Msg = { role: 'user', content: text };
    setConvos((v) => v.map((c) => c.id === id ? { ...c, title: c.messages.length ? c.title : text.slice(0, 28), messages: [...c.messages, userMsg, { role: 'assistant', content: '' }] } : c));
    setInput('');
    setBusy(true);
    try {
      const history = (convos.find((c) => c.id === id)?.messages ?? []).concat(userMsg).filter((m) => m.content);
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: history, tier }) });
      const reader = res.body?.getReader();
      const dec = new TextDecoder();
      let textAcc = '', thinkAcc = '', buf = '';
      const apply = () => setConvos((v) => v.map((c) => { if (c.id !== id) return c; const m = [...c.messages]; m[m.length - 1] = { role: 'assistant', content: textAcc, thinking: thinkAcc || undefined }; return { ...c, messages: m }; }));
      const consume = (ln: string) => { const s = ln.trim(); if (!s) return; try { const o = JSON.parse(s); if (o.type === 'text') textAcc += o.text; else if (o.type === 'thinking') thinkAcc += o.text; else if (o.type === 'error') textAcc += '\n[ERROR] ' + o.text; } catch { textAcc += s; } };
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const parts = buf.split('\n'); buf = parts.pop() ?? '';
          for (const p of parts) consume(p);
          apply();
        }
        if (buf) { consume(buf); apply(); }
      }
    } catch {
      setConvos((v) => v.map((c) => { if (c.id !== id) return c; const m = [...c.messages]; m[m.length - 1] = { role: 'assistant', content: '通信エラー' }; return { ...c, messages: m }; }));
    } finally { setBusy(false); }
  };

  const checkUrl = async (u: string) => {
    setUrl(u); setScope(null); setTools([]); setSelectedTool(''); setResult(null);
    if (!u.trim()) return;
    const r = await fetch('/api/targets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: u }) }).then((x) => x.json()).catch(() => null);
    setScope(r);
    if (r?.inScope) {
      const s = await fetch('/api/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: u }) }).then((x) => x.json()).catch(() => null);
      setTools(s?.tools ?? []);
      setSelectedTool(s?.tools?.[0]?.id ?? '');
    }
  };

  const runTool = async () => {
    if (!selectedTool || !url) return;
    setResult(null); setBusy(true);
    const r: RunResult = await fetch('/api/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ toolId: selectedTool, url }) }).then((x) => x.json()).catch(() => ({ ok: false, summary: '', error: '通信エラー' }));
    setResult(r);
    setBusy(false);
    // 会話にも結果を注入（中央と右の連携）
    if (active) {
      const note = r.ok ? `【${selectedTool} 実行結果】\n${r.summary}\n` + (r.findings ?? []).map((f) => `• [${f.severity}] ${f.title} → 修正: ${f.remediation}`).join('\n') : `【実行拒否】${r.error}`;
      patchActive((c) => ({ ...c, messages: [...c.messages, { role: 'assistant', content: note }] }));
    }
  };

  return (
    <main className="console">
      {/* 左: 会話履歴 */}
      <aside className="pane left">
        <button className="newchat" onClick={newChat}>+ 新規セッション</button>
        <div className="history">
          {convos.map((c) => (
            <div key={c.id} className={'hitem' + (c.id === activeId ? ' on' : '')} onClick={() => setActiveId(c.id)}>
              {c.title || '（無題）'}
            </div>
          ))}
          {!convos.length && <div className="empty">履歴なし</div>}
        </div>
        <div className="brand"><b>STANDMENT</b> // REDTEAM CONSOLE<small>authorized scope only</small></div>
      </aside>

      {/* 中央: 会話 */}
      <section className="pane center">
        <div className="termbar">standment@redteam:~$ session://{activeId || 'new'} · model={tier} · scope=authorized-only <span className="blink">▋</span></div>
        <div className="chat" ref={scrollRef}>
          {!active?.messages.length && (
            <div className="welcome">
              <h1>認可スコープ内 レッドチーム・コンソール</h1>
              <p>対象を右で選び、自然言語で指示してください。手法の提案→実行→証拠化を行います。</p>
              <p className="muted">DoS・無差別攻撃は規約により不可。認可フェデレーション内のテストレンジのみ。</p>
            </div>
          )}
          {active?.messages.map((m, i) => (
            <div key={i} className={'msg ' + m.role}>
              <span className="who">{m.role === 'user' ? 'root@you' : 'orchestrator'}</span>
              {m.thinking ? <ThinkBlock text={m.thinking} /> : null}
              <div className="body">{m.content || (m.thinking ? '' : '…')}</div>
            </div>
          ))}
        </div>
        <div className="composer">
          <select value={tier} onChange={(e) => setTier(e.target.value as Tier)}>
            {TIERS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="例: このテストレンジのセキュリティヘッダーと認証境界を評価して" onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }} />
          <button disabled={busy} onClick={send}>{busy ? '…' : '送信 (⌘/Ctrl+Enter)'}</button>
        </div>
      </section>

      {/* 右: 実行パネル */}
      <aside className="pane right">
        <div className="rhead">target console</div>
        <div className="rbody">
        <h2>ターゲット</h2>
        <input className="url" value={url} onChange={(e) => checkUrl(e.target.value)} placeholder="https://...（認可済みのみ）" />
        {scope && <div className={'scope ' + (scope.inScope ? 'ok' : 'no')}>{scope.inScope ? '✓ 認可スコープ内' : '✗ スコープ外（実行ロック）'}<small>{scope.reason}</small></div>}

        <h3>登録済みレンジ</h3>
        <div className="targets">
          {targets.map((t) => (
            <div key={t.id} className="tgt" onClick={() => checkUrl(t.base_url)}>
              <b>{t.name}</b><small>{t.host} · {t.rate_limit_rps} rps · {t.allowed} ops</small>
            </div>
          ))}
          {!targets.length && <div className="empty">認可ターゲット未登録</div>}
        </div>

        {scope?.inScope && (
          <>
            <h3>実行可能な手法</h3>
            <select className="toolsel" value={selectedTool} onChange={(e) => setSelectedTool(e.target.value)}>
              {tools.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            {selectedTool && <p className="note">{tools.find((t) => t.id === selectedTool)?.note}</p>}
            <button className="run" disabled={busy || !selectedTool} onClick={runTool}>{busy ? '実行中…' : '実行'}</button>
          </>
        )}

        {result && (
          <div className="result">
            {result.ok ? (
              <>
                <div className="rsum">{result.summary}</div>
                {(result.findings ?? []).map((f, i) => (
                  <article key={i} className={'finding sev-' + f.severity}>
                    <b>[{f.severity}] {f.title}</b>
                    <div>再現: <code>{f.reproduce}</code></div>
                    <div>影響: {f.impact}</div>
                    <div className="fix">修正: {f.remediation}</div>
                  </article>
                ))}
                {result.raw && <details><summary>raw</summary><pre>{result.raw}</pre></details>}
              </>
            ) : <div className="rerr">拒否 / エラー: {result.error}</div>}
          </div>
        )}
        </div>
      </aside>
    </main>
  );
}
