/**
 * SEARCH LOG — 検索で確かめられた記録だけを書く。
 *
 * 「誰のページ」「どの検索語」「いつ公開」「いつ確認」「何位付近」「どう確かめたか」が
 * すべて埋まるものだけを足す（Search Console の画面や、シークレットウィンドウでの検索画面など）。
 * 1件もないあいだは、ページには「確かめられたものから、ここに記録していきます」と出る。
 *
 * 例：
 * { page: '株式会社Central AX（Baton Partners）', url: 'https://partners.music-japan.com/central-ax/',
 *   query: 'Central AX 名古屋', published: '2026.09.30', checked: '2026.10.20', position: '3位付近',
 *   how: 'Search Console（過去7日の平均掲載順位）' },
 */
export type SearchRecord = {
  page: string;
  url: string;
  query: string;
  published: string;
  checked: string;
  position: string;
  how: string;
};

export const searchLog: SearchRecord[] = [];
