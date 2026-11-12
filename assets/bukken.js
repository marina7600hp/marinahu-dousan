// 物件一覧（Googleスプレッドシート連携）
// ─────────────────────────────────────────────
// ▼ ここに、Google Apps Script を「ウェブアプリ」として公開したURLを貼ってください。
//   （手順は BUKKEN_SETUP.md を参照）
const BUKKEN_API_URL = '';
// ─────────────────────────────────────────────

(function () {
    const lists = document.querySelectorAll('[data-bukken-list]');
    if (!lists.length) return;

    const apiUrl = window.BUKKEN_API_URL || BUKKEN_API_URL;

    const esc = (v) => String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const safeUrl = (u) => (/^https:\/\//i.test(String(u || '')) ? String(u) : '');

    const sourceLabel = (url) => {
        if (/suumo\.jp/i.test(url)) return 'SUUMO';
        if (/fudohsan\.jp/i.test(url)) return 'スマイミー';
        return '掲載ページ';
    };

    function card(item) {
        const url = safeUrl(item.url);
        const img = safeUrl(item.image);
        const isRent = item.type === '賃貸';
        const badge = item.type
            ? `<span class="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold text-white ${isRent ? 'bg-sky-700' : 'bg-teal-700'}">${esc(item.type)}</span>`
            : '';
        const photo = '<div class="absolute inset-0 flex items-center justify-center text-slate-300 text-5xl"><i class="fa-solid fa-house"></i></div>'
            + (img ? `<img src="${esc(img)}" alt="${esc(item.title)}" class="absolute inset-0 w-full h-full object-cover" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.style.display='none'">` : '');
        const specs = [item.layout, item.area].filter(Boolean).map(esc).join('<span class="mx-1.5 text-slate-300">|</span>');
        return `
        <article class="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
            <div class="relative aspect-[4/3] bg-slate-100">${photo}${badge}</div>
            <div class="p-5 flex-1 flex flex-col">
                <h3 class="text-base sm:text-lg font-bold text-slate-900 leading-snug">${esc(item.title) || '物件情報'}</h3>
                ${item.price ? `<p class="mt-2 text-xl font-bold text-orange-700">${esc(item.price)}</p>` : ''}
                <dl class="mt-3 space-y-1 text-sm text-slate-600 flex-1">
                    ${item.address ? `<div class="flex gap-2"><dt class="sr-only">所在地</dt><i class="fa-solid fa-location-dot text-slate-400 mt-1"></i><dd>${esc(item.address)}</dd></div>` : ''}
                    ${specs ? `<div class="flex gap-2"><dt class="sr-only">間取り・面積</dt><i class="fa-solid fa-ruler-combined text-slate-400 mt-1"></i><dd>${specs}</dd></div>` : ''}
                </dl>
                ${item.comment ? `<p class="mt-3 text-sm text-slate-700 bg-slate-50 rounded-xl p-3">${esc(item.comment)}</p>` : ''}
                ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="mt-4 inline-flex items-center justify-center py-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold transition-colors">詳しく見る（${sourceLabel(url)}）<i class="fa-solid fa-arrow-up-right-from-square ml-2 text-xs"></i></a>` : ''}
            </div>
        </article>`;
    }

    function message(el, html) {
        el.innerHTML = `<div class="max-w-xl mx-auto text-center bg-white rounded-3xl border border-slate-100 p-8 text-sm sm:text-base text-slate-600">${html}</div>`;
    }

    function render(el, items) {
        const limit = parseInt(el.dataset.limit || '0', 10);
        const type = el.dataset.type || '';
        let list = type ? items.filter((i) => i.type === type) : items;
        if (limit > 0) list = list.slice(0, limit);
        if (!list.length) {
            message(el, '現在ご紹介できる物件はありません。<br>物件のお探し・ご相談はお気軽にお問い合わせください。');
            return;
        }
        el.innerHTML = `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">${list.map(card).join('')}</div>`;
    }

    if (!apiUrl) {
        lists.forEach((el) => message(el, '最新の物件情報は、下の「スマイミー」「SUUMO」からご覧いただけます。'));
        return;
    }

    lists.forEach((el) => message(el, '<i class="fa-solid fa-spinner animate-spin mr-2"></i>物件情報を読み込んでいます…'));

    let cache = null;
    fetch(apiUrl)
        .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then((data) => {
            cache = Array.isArray(data.items) ? data.items : [];
            lists.forEach((el) => render(el, cache));
        })
        .catch((err) => {
            console.error('物件情報の読み込みに失敗しました', err);
            lists.forEach((el) => message(el, '物件情報を読み込めませんでした。お手数ですが、下の「スマイミー」「SUUMO」からご覧ください。'));
        });

    // 種別の絞り込みボタン（bukken.html）
    document.querySelectorAll('[data-bukken-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const target = document.querySelector(btn.dataset.bukkenFilter);
            if (!target) return;
            target.dataset.type = btn.dataset.type || '';
            document.querySelectorAll('[data-bukken-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
            if (cache) render(target, cache);
        });
    });
})();
