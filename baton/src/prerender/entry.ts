/**
 * ビルド時の静的HTML生成（vite.config.ts から呼ぶ）。
 *
 * JavaScriptを実行しないクローラーにも本文を渡せるようにする。
 * ブラウザで組み立てている本文・内部リンクを、同じ描画コードのままビルド時に
 * 軽量DOM（linkedom）で組み立て、HTMLに焼き込む。ブラウザでは読み込み後に
 * 動く版へ置き換えるので、見た目と動きは変わらない。
 */
import { parseHTML } from 'linkedom';

type Output = { profiles: Record<string, string>; hub: string; faq: string; footer: string; services: Record<string, string>; serviceHub: string; privacy: string; serviceFooter: string; hubFooter: string };

export async function renderStatic(): Promise<Output> {
  const { document } = parseHTML('<!doctype html><html><body></body></html>');
  const g = globalThis as unknown as { document?: unknown };
  const previous = g.document;
  g.document = document;
  try {
    const [{ profiles }, { renderProfileSections }, { renderProfileHub }, { renderProfileFooter }, { renderFaqPage }] =
      await Promise.all([
        import('../data/profiles'),
        import('../profile/render'),
        import('../profile/hub-render'),
        import('../profile/footer'),
        import('../profile/faq-page'),
      ]);

    const out: Output = { profiles: {}, hub: '', faq: '', footer: '', services: {}, serviceHub: '', privacy: '', serviceFooter: '', hubFooter: '' };
    for (const profile of profiles) {
      const app = document.createElement('main');
      renderProfileSections(app as unknown as HTMLElement, profile, { static: true });
      out.profiles[profile.id] = app.innerHTML;
    }
    const hub = document.createElement('main');
    renderProfileHub(hub as unknown as HTMLElement, { static: true });
    out.hub = hub.innerHTML;
    const faq = document.createElement('main');
    renderFaqPage(faq as unknown as HTMLElement);
    out.faq = faq.innerHTML;
    const footer = document.createElement('footer');
    renderProfileFooter(footer as unknown as HTMLElement);
    out.footer = footer.innerHTML;
    const [{ services }, { renderServiceSections }, { renderHub }, { renderPrivacy }, { renderFooter }] = await Promise.all([
      import('../data/services'), import('../service/render'), import('../hub/render'),
      import('../entries/privacy-content'), import('../lib/footer'),
    ]);
    for (const service of services) {
      const app = document.createElement('main');
      renderServiceSections(app as unknown as HTMLElement, service, { static: true });
      out.services[service.id] = app.innerHTML;
    }
    const serviceHub = document.createElement('main');
    renderHub(serviceHub as unknown as HTMLElement, { static: true });
    out.serviceHub = serviceHub.innerHTML;
    const privacy = document.createElement('main');
    renderPrivacy(privacy as unknown as HTMLElement);
    out.privacy = privacy.innerHTML;
    const serviceFooter = document.createElement('footer');
    renderFooter(serviceFooter as unknown as HTMLElement, { backToHub: true });
    out.serviceFooter = serviceFooter.innerHTML;
    const hubFooter = document.createElement('footer');
    renderFooter(hubFooter as unknown as HTMLElement);
    out.hubFooter = hubFooter.innerHTML;
    return out;
  } finally {
    g.document = previous;
  }
}
