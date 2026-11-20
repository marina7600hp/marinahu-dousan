// 有限会社 仁方大森マリーナー HP（Cloudflare Workers）
// ・ふだんのページ（HTML・画像など）は静的ファイルとしてそのまま配信されます。
// ・/api/fetch-page だけ、このプログラムが動きます。
//   スマイミーはGoogleのサーバーからの読み取りを受け付けないため、
//   物件一覧のスプレッドシート（Apps Script）からの取得をここで中継します。
//   悪用を防ぐため、スマイミーの物件ページ以外は取得しません。

const ALLOWED_HOSTS = ['www.fudohsan.jp', 'fudohsan.jp'];
const CACHE_SECONDS = 600;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/fetch-page') {
      return fetchPage(url, request, ctx);
    }
    // 静的ファイルにないパスは、通常どおり静的配信側に任せる（404など）
    return env.ASSETS.fetch(request);
  },
};

async function fetchPage(url, request, ctx) {
  if (request.method !== 'GET') return text('GET only', 405);

  let target;
  try {
    target = new URL(url.searchParams.get('url') || '');
  } catch (e) {
    return text('url パラメータが正しくありません', 400);
  }
  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.includes(target.hostname)) {
    return text('このURLは取得できません（スマイミーの物件ページのみ）', 403);
  }

  // 同じページへの短時間の繰り返しアクセスはキャッシュで返す（相手サイトへの負担を減らす）
  const cache = caches.default;
  const cacheKey = new Request('https://cache.local/fetch-page?u=' + encodeURIComponent(target.href));
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let upstream;
  try {
    upstream = await fetch(target.href, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.5',
      },
    });
  } catch (e) {
    return text('スマイミーに接続できませんでした：' + (e && e.message ? e.message : e), 502);
  } finally {
    clearTimeout(timer);
  }

  const headers = new Headers({
    'Content-Type': upstream.headers.get('Content-Type') || 'text/html',
    'X-Upstream-Status': String(upstream.status),
    'X-Robots-Tag': 'noindex',
    'Cache-Control': 'private, max-age=0',
  });
  const body = await upstream.arrayBuffer();
  const response = new Response(body, { status: upstream.ok ? 200 : 502, headers });
  if (upstream.ok) {
    const toCache = response.clone();
    toCache.headers.set('Cache-Control', 'public, max-age=' + CACHE_SECONDS);
    ctx.waitUntil(cache.put(cacheKey, toCache));
  }
  return response;
}

function text(message, status) {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex' },
  });
}
