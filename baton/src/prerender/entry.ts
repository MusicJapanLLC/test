/**
 * ビルド時の静的HTML生成（vite.config.ts から呼ぶ）。
 *
 * AIクローラー（GPTBot / ClaudeBot / PerplexityBot など）はJavaScriptを実行しない。
 * ブラウザで組み立てている本文・内部リンクを、同じ描画コードのままビルド時に
 * 軽量DOM（linkedom）で組み立て、HTMLに焼き込む。ブラウザでは読み込み後に
 * 動く版へ置き換えるので、見た目と動きは変わらない。
 */
import { parseHTML } from 'linkedom';

type Output = { profiles: Record<string, string>; hub: string; footer: string };

export async function renderStatic(): Promise<Output> {
  const { document } = parseHTML('<!doctype html><html><body></body></html>');
  const g = globalThis as unknown as { document?: unknown };
  const previous = g.document;
  g.document = document;
  try {
    const [{ profiles }, { renderProfileSections }, { renderProfileHub }, { renderProfileFooter }] =
      await Promise.all([
        import('../data/profiles'),
        import('../profile/render'),
        import('../profile/hub-render'),
        import('../profile/footer'),
      ]);

    const out: Output = { profiles: {}, hub: '', footer: '' };
    for (const profile of profiles) {
      const app = document.createElement('main');
      renderProfileSections(app as unknown as HTMLElement, profile, { static: true });
      out.profiles[profile.id] = app.innerHTML;
    }
    const hub = document.createElement('main');
    renderProfileHub(hub as unknown as HTMLElement, { static: true });
    out.hub = hub.innerHTML;
    const footer = document.createElement('footer');
    renderProfileFooter(footer as unknown as HTMLElement);
    out.footer = footer.innerHTML;
    return out;
  } finally {
    g.document = previous;
  }
}
