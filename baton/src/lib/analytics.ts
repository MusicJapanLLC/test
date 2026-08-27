/**
 * GA4 と Meta Pixel。どちらも ID が空なら一切読み込まない。
 * 広告最適化の軸は survey_complete = Meta の Lead イベント。
 */

const GA4_ID = (import.meta.env.VITE_GA4_ID ?? '').trim();
const META_PIXEL_ID = (import.meta.env.VITE_META_PIXEL_ID ?? '').trim();

type Params = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
    _fbq?: unknown;
  }
}

let ready = false;

function loadGA4(): void {
  if (!GA4_ID) return;

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_ID)}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA4_ID, { send_page_view: true });
}

function loadMetaPixel(): void {
  if (!META_PIXEL_ID) return;

  /* Meta 公式スニペットの最小構成 */
  const n: any = (window.fbq = function (...args: unknown[]) {
    n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
  });
  if (!window._fbq) window._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = '2.0';
  n.queue = [];

  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(s);

  window.fbq!('init', META_PIXEL_ID);
  window.fbq!('track', 'PageView');
}

export function initAnalytics(): void {
  if (ready) return;
  ready = true;
  loadGA4();
  loadMetaPixel();
}

function ga(event: string, params: Params = {}): void {
  window.gtag?.('event', event, params);
}

/** ハブのカードクリック */
export function trackServiceClick(serviceId: string): void {
  ga('service_click', { service_id: serviceId });
  window.fbq?.('trackCustom', 'ServiceClick', { service_id: serviceId });
}

/** アンケートの最初の設問が表示された時点 */
export function trackSurveyStart(serviceId: string): void {
  ga('survey_start', { service_id: serviceId });
  window.fbq?.('trackCustom', 'SurveyStart', { service_id: serviceId });
}

/** 各設問の回答時。question は 1 始まり */
export function trackSurveyProgress(serviceId: string, question: number): void {
  ga('survey_progress', { service_id: serviceId, question });
  window.fbq?.('trackCustom', 'SurveyProgress', { service_id: serviceId, question });
}

/** 送信完了。Meta 側は Lead として送る（広告最適化の軸） */
export function trackSurveyComplete(serviceId: string): void {
  ga('survey_complete', { service_id: serviceId });
  window.fbq?.('track', 'Lead', { content_name: serviceId, service_id: serviceId });
}
