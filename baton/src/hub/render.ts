import { services } from '../data/services';
import { site } from '../data/site';
import { trackServiceClick } from '../lib/analytics';
import { append, el, externalAttrs, pad2, withBase } from '../lib/dom';
import { logo } from '../lib/logo';
import { gsap, isCoarsePointer, prefersReducedMotion } from '../lib/motion';

const arrow = () => {
  const span = el('span', { class: 'hub-card__arrow', 'aria-hidden': 'true' });
  span.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9h12M10 4l5 5-5 5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return span;
};

/** 目次のカード。並べるだけ。誘導も煽りもしない */
function card(index: number, id: string): HTMLAnchorElement {
  const s = services.find((x) => x.id === id)!;
  const stat = s.stats[0];

  const link = el('a', {
    class: 'hub-card',
    href: withBase(`/${s.slug}/`),
    'data-reveal': true,
    'data-service': s.id,
    style: `--card-primary:${s.theme.primary};--card-accent:${s.theme.accent}`,
  }) as HTMLAnchorElement;

  append(link, [
    el('div', { class: 'hub-card__row' }, [
      el('span', { class: 'hub-card__index', text: pad2(index + 1) }),
      el('div', { class: 'hub-card__names' }, [
        el('p', { class: 'hub-card__name', text: s.serviceName }),
        s.company === s.serviceName
          ? null
          : el('p', { class: 'hub-card__company', text: s.company }),
      ]),
      el('p', { class: 'hub-card__tagline', text: s.tagline }),
      stat
        ? el('p', { class: 'hub-card__stat' }, [
            el('b', { text: stat.value }),
            stat.unit ? el('span', { class: 'hub-card__unit', text: stat.unit }) : null,
            el('span', { text: stat.label }),
          ])
        : null,
    ]),
    arrow(),
  ]);

  link.addEventListener('pointerdown', () => trackServiceClick(s.id));

  return link;
}

/** ホバーでそのカードだけがわずかに浮き上がる。指の環境では動かさない */
function attachTilt(link: HTMLAnchorElement): void {
  if (isCoarsePointer() || prefersReducedMotion()) return;

  const setRotX = gsap.quickTo(link, 'rotateX', { duration: 0.6, ease: 'power3.out' });
  const setRotY = gsap.quickTo(link, 'rotateY', { duration: 0.6, ease: 'power3.out' });
  const setZ = gsap.quickTo(link, 'z', { duration: 0.6, ease: 'power3.out' });

  link.addEventListener('pointermove', (e) => {
    const rect = link.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setRotX(-py * 3.2);
    setRotY(px * 3.2);
    setZ(18);
  });

  link.addEventListener('pointerleave', () => {
    setRotX(0);
    setRotY(0);
    setZ(0);
  });
}

function renderIndexSection(): HTMLElement {
  const section = el('section', { class: 'section', id: 'services' }, [
    el('div', { class: 'wrap' }, [
      el('div', { class: 'section__head', 'data-reveal-group': true }, [
        el('span', { class: 'section__label', text: 'Index', 'data-reveal': true }),
        el('h2', { class: 'section__title', text: '6つのサービス', 'data-reveal': true }),
        el('p', {
          class: 'hub-intro section__note',
          text: '合同会社Music Japanが提携しています。気になったものから開いてください。',
          'data-reveal': true,
        }),
      ]),
    ]),
  ]);

  const list = el('div', { class: 'hub-list wrap', 'data-reveal-group': true });
  services.forEach((s, i) => {
    const link = card(i, s.id);
    attachTilt(link);
    list.append(link);
  });
  section.append(list);

  return section;
}

function renderAbout(): HTMLElement {
  return el('section', { class: 'section hub-about', id: 'about' }, [
    el('div', { class: 'wrap' }, [
      el('div', { class: 'hub-about__inner', 'data-reveal-group': true }, [
        Object.assign(logo('musicjapan', 'hub-about__logo', site.operator.name), {}),
        el('p', {
          class: 'hub-about__text',
          text: `${site.operator.name} が運営しています。`,
          'data-reveal': true,
        }),
        el('a', {
          class: 'hub-about__link',
          href: site.operator.url,
          ...externalAttrs,
          text: site.operator.name,
          'data-reveal': true,
        }),
      ]),
    ]),
  ]);
}

/** ハブの本文。目次と Music Japan について */
export function renderHub(app: HTMLElement): void {
  app.append(renderIndexSection(), renderAbout());
}
