import { el } from './dom';

/**
 * public/ に実ファイルが置かれるまではプレースホルダーで動く。
 * 読み込めなかった場合だけ、同じ寸法のSVGに差し替える。
 */
type LogoKind = 'musicjapan' | 'standment';

const PLACEHOLDER: Record<LogoKind, string> = {
  musicjapan: `<svg viewBox="0 0 64 64" role="img" aria-label="合同会社Music Japan">
    <rect width="64" height="64" rx="8" fill="#1A1A1A"/>
    <circle cx="32" cy="27" r="11" fill="#C8102E"/>
    <rect x="18" y="44" width="28" height="3" rx="1.5" fill="#FFFFFF"/>
  </svg>`,
  standment: `<svg viewBox="0 0 64 64" role="img" aria-label="Standment">
    <rect width="64" height="64" rx="8" fill="#FFFFFF" stroke="#E3E8EF"/>
    <path d="M42 22c-3-4-9-5-13-2s-4 8 0 10l8 4c4 2 4 7 0 10s-10 2-13-2" fill="none" stroke="#1B3A6B" stroke-width="5" stroke-linecap="round"/>
    <path d="M42 22c-3-4-9-5-13-2" fill="none" stroke="#2E9BA8" stroke-width="5" stroke-linecap="round"/>
  </svg>`,
};

export function logo(kind: LogoKind, className: string, alt: string): HTMLElement {
  const img = el('img', {
    class: className,
    src: `/logo-${kind}.png`,
    alt,
    width: 64,
    height: 64,
    loading: 'lazy',
    decoding: 'async',
  });

  img.addEventListener(
    'error',
    () => {
      const holder = el('span', { class: className, role: 'img', 'aria-label': alt });
      holder.innerHTML = PLACEHOLDER[kind];
      const svg = holder.querySelector('svg');
      if (svg) {
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.removeAttribute('role');
        svg.removeAttribute('aria-label');
      }
      img.replaceWith(holder);
    },
    { once: true },
  );

  return img;
}
