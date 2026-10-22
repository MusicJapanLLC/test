// worker.mjs
// 灯の旅路は 2026-10-22 から非公開。配信元（ChatGPT で作った版）が止まり、素材も手元に無いので、
// /fire 以下はすべて MJ STORE の作品一覧へ一時リダイレクトする（上流へは中継しない）
var closed = "https://store.music-japan.com/games/";
var worker_default = {
  async fetch(request) {
    const incoming = new URL(request.url);
    if (incoming.pathname !== "/fire" && !incoming.pathname.startsWith("/fire/")) return fetch(request);
    const result = Response.redirect(closed, 302);
    return new Response(null, { status: result.status, headers: { location: closed, "cache-control": "no-store", "X-Fire-Origin": "closed" } });
  }
};
export {
  worker_default as default
};
