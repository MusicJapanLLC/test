import { el, withBase } from './dom';

/**
 * 実ロゴ（public/logo-*.png）が置かれるまでは、社名を文字で組んで出す。
 * 他社のロゴを近似で描くと事故になるので、マークは作らない。
 */
type LogoKind = 'musicjapan' | 'standment';

const WORDMARK: Record<LogoKind, { text: string; sub?: string }> = {
  musicjapan: { text: 'MUSIC JAPAN', sub: 'LLC' },
  standment: { text: 'Standment', sub: 'Co., Ltd.' },
};

declare global {
  interface Window {
    /** 単一ファイルのプレビューで、ロゴを data URI に差し替えるための入口 */
    __BATON_LOGOS?: Partial<Record<LogoKind, string>>;
  }
}

export function logo(kind: LogoKind, className: string, alt: string): HTMLElement {
  const img = el('img', {
    class: className,
    src: window.__BATON_LOGOS?.[kind] ?? withBase(`/logo-${kind}.png`),
    alt,
    loading: 'lazy',
    decoding: 'async',
  });

  img.addEventListener(
    'error',
    () => {
      const mark = WORDMARK[kind];
      const holder = el('span', { class: `${className} wordmark wordmark--${kind}` }, [
        el('span', { class: 'wordmark__name', text: mark.text }),
        mark.sub ? el('span', { class: 'wordmark__sub', text: mark.sub }) : null,
      ]);
      img.replaceWith(holder);
    },
    { once: true },
  );

  return img;
}
