type Attrs = Record<string, string | number | boolean | undefined>;

/** 小さなDOMヘルパ。テンプレートを組み立てる用 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string | null | undefined)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key === 'class') node.className = String(value);
    else if (key === 'text') node.textContent = String(value);
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export const frag = (children: (Node | null | undefined)[]): DocumentFragment => {
  const f = document.createDocumentFragment();
  children.forEach((c) => c && f.append(c));
  return f;
};

export const pad2 = (n: number): string => String(n).padStart(2, '0');

/** 外部リンクを新しいタブで安全に開くための属性 */
export const externalAttrs = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** null 混じりの子要素をまとめて追加する */
export function append(parent: Node, children: (Node | string | null | undefined)[]): void {
  children.forEach((c) => {
    if (c === null || c === undefined) return;
    parent.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
}

/**
 * サイト内リンクは必ずこれを通す。
 * ルート直下（Vercel）でもサブパス配信（GitHub Pages の /test/）でも同じコードで動く。
 */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`.replace(/\/{2,}/g, '/');
}
