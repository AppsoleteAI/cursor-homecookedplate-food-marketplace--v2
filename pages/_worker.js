const LEGAL_PAGES = {
  "/privacy": "/privacy/index.html",
  "/privacy/": "/privacy/index.html",
  "/terms": "/terms/index.html",
  "/terms/": "/terms/index.html",
};

function isApiPath(pathname) {
  return (
    pathname === "/health" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/webhook/")
  );
}

function assetRequest(request) {
  const url = new URL(request.url);
  const decoded = decodeURIComponent(url.pathname);
  const file = decoded.split("/").pop() || "";
  if (decoded.includes("/Fonts/") && file.endsWith(".ttf")) {
    url.pathname = "/fonts/" + file;
    return new Request(url.toString(), request);
  }
  return request;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const legalPath = LEGAL_PAGES[url.pathname];
    if (legalPath && (request.method === "GET" || request.method === "HEAD")) {
      const legalUrl = new URL(legalPath, url.origin);
      const legal = await env.ASSETS.fetch(new Request(legalUrl.toString(), request));
      if (legal.status !== 404) return legal;
      return new Response("Legal page is unavailable.", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    if (isApiPath(url.pathname)) {
      const upstream = await env.API.fetch(request);
      const headers = new Headers();
      for (const name of [
        "content-type",
        "cache-control",
        "access-control-allow-origin",
        "access-control-allow-credentials",
        "access-control-allow-headers",
        "access-control-allow-methods",
        "access-control-expose-headers",
        "access-control-max-age",
      ]) {
        const value = upstream.headers.get(name);
        if (value) headers.set(name, value);
      }
      return new Response(upstream.body, { status: upstream.status, headers });
    }

    const asset = await env.ASSETS.fetch(assetRequest(request));
    if (asset.status !== 404) return asset;

    if (request.method === "GET" && !decodeURIComponent(url.pathname).includes(".")) {
      const indexUrl = new URL("/index.html", url.origin);
      return env.ASSETS.fetch(new Request(indexUrl.toString(), request));
    }

    return asset;
  },
};
