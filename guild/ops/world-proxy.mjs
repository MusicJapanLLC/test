// worker.mjs
var origin = "https://nightfall-05.music-japan-the-world.pages.dev";
var worker_default = {
  async fetch(request) {
    const incoming = new URL(request.url);
    if (incoming.pathname === "/world") {
      incoming.pathname = "/world/";
      return Response.redirect(incoming.href, 308);
    }
    if (!incoming.pathname.startsWith("/world/")) return fetch(request);
    const upstream = new URL(origin);
    upstream.pathname = incoming.pathname.slice("/world".length);
    upstream.search = incoming.search;
    const headers = new Headers(request.headers);
    headers.delete("cookie");
    headers.delete("authorization");
    headers.delete("host");
    const response = await fetch(new Request(upstream, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? void 0 : request.body,
      redirect: "manual"
    }));
    const result = new Response(response.body, response);
    result.headers.delete("set-cookie");
    result.headers.set("X-World-Origin", "nightfall-05-pages");
    const location = result.headers.get("location");
    if (location) {
      const redirect = new URL(location, upstream);
      if (redirect.origin === origin) {
        incoming.pathname = "/world" + redirect.pathname;
        incoming.search = redirect.search;
        incoming.hash = redirect.hash;
        result.headers.set("location", incoming.href);
      }
    }
    if (request.method === "GET" && result.ok && (result.headers.get("content-type") || "").includes("text/html")) {
      return new HTMLRewriter().on("head", { element(el) {
        el.append('<script defer src="/analytics.js?v=20261020" data-ga4-id="G-S2P0JCW50M" data-ga4-host="game.music-japan.com"></script>', {html: true});
      }}).on("body", { element(el) {
        el.append('<a href="https://music-japan.com/privacy/" target="_blank" rel="noopener" style="position:fixed;right:8px;bottom:4px;z-index:20;font:10px sans-serif;color:#bbb;background:#111b;padding:2px 5px;border-radius:3px">プライバシー・アクセス解析</a>', {html: true});
      }}).transform(result);
    }
    return result;
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
