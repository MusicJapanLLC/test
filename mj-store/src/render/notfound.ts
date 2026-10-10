import { botHtml } from './brand';
import { href, icon, ph, type RenderCtx } from './util';

export function notFoundBody(ctx: RenderCtx): string {
  return `
  <main id="main" class="lost">
    <section class="lost__head container">
      <p class="eyebrow"><span>404</span><span>PAGE NOT FOUND</span></p>
      <h1 class="lost__title">${ph('このページは、')}<br />${ph('まだ世界にありません。')}</h1>
      <p class="lost__text">${ph('かわりに、MJタウンを歩いていってください。お店の扉から、作品のページへ入れます。')}</p>
      <div class="lost__bot">${botHtml('spin', { note: 'ここ…どこ…？', line: 'ねむくて…道…まちがえた…｜町なら…あっち…' })}</div>
    </section>
    <section class="lost__town container">
      <div class="town-embed" data-town-embed></div>
      <div class="lost__actions">
        <a class="btn btn--primary" href="${href(ctx, '')}" data-sfx><span>ストアにもどる</span>${icon.arrow}</a>
      </div>
    </section>
  </main>`;
}
