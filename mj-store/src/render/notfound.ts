import { href, icon, type RenderCtx } from './util';

export function notFoundBody(ctx: RenderCtx): string {
  return `
  <main id="main" class="lost">
    <section class="lost__head container">
      <p class="eyebrow"><span>404</span><span>PAGE NOT FOUND</span></p>
      <h1 class="lost__title">このページは、<br class="sp" />まだ世界にありません。</h1>
      <p class="lost__text">かわりに、MJタウンを歩いていってください。お店の扉から、作品のページへ入れます。</p>
    </section>
    <section class="lost__town container">
      <div class="town-embed" data-town-embed></div>
      <div class="lost__actions">
        <a class="btn btn--primary" href="${href(ctx, '')}" data-sfx><span>ストアにもどる</span>${icon.arrow}</a>
      </div>
    </section>
  </main>`;
}
