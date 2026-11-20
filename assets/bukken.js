// 物件一覧（Googleスプレッドシート連携）
// ─────────────────────────────────────────────
// ▼ ここに、Google Apps Script を「ウェブアプリ」として公開したURLを貼ってください。
//   （手順は BUKKEN_SETUP.md を参照）
const BUKKEN_API_URL = 'https://script.google.com/macros/s/AKfycbyvdBXvXkEkezLCJN0YGnnB6upADt4A7VJGVDC13lAzU3YbLiVKItlhOsHiAsBXGwMP/exec';
// ─────────────────────────────────────────────

(function () {
    const lists = document.querySelectorAll('[data-bukken-list]');
    if (!lists.length) return;

    const apiUrl = window.BUKKEN_API_URL || BUKKEN_API_URL;

    const esc = (v) => String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const safeUrl = (u) => (/^https:\/\//i.test(String(u || '')) ? String(u) : '');

    // スマイミーの会社（掲載店）写真は物件写真として使わない
    const isCompanyPhoto = (u) => /fudohsan\.jp\/m_img\//i.test(String(u || ''));
    // スマイミーの長いページ名を短くする：「売土地・売り地の詳細情報 呉市海岸２丁目の売土地・売り地 スマイミー」→「呉市海岸２丁目 売土地」
    const cleanTitle = (t) => {
        let s = String(t || '').replace(/^\S*の詳細情報\s*/, '').replace(/\s*(スマイミー|SUUMO)\s*$/i, '').trim();
        const m = s.match(/^(\S*?(?:市|町|丁目|村)\S*?)の(\S+)$/);
        return m ? m[1] + ' ' + m[2].split('・')[0] : s;
    };

    const sourceLabel = (url) => {
        if (/suumo\.jp/i.test(url)) return 'SUUMO';
        if (/fudohsan\.jp/i.test(url)) return 'スマイミー';
        return '掲載ページ';
    };

    function card(item) {
        const url = safeUrl(item.url);
        const img = isCompanyPhoto(item.image) ? '' : safeUrl(item.image);
        item = Object.assign({}, item, { title: cleanTitle(item.title) });
        const isRent = item.type === '賃貸';
        const badge = item.type
            ? `<span class="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold text-white ${isRent ? 'bg-sky-700' : 'bg-teal-700'}">${esc(item.type)}</span>`
            : '';
        const photo = '<div class="absolute inset-0 flex items-center justify-center text-slate-300 text-5xl"><i class="fa-solid fa-house"></i></div>'
            + (img ? `<img src="${esc(img)}" alt="${esc(item.title)}" class="absolute inset-0 w-full h-full object-cover" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.style.display='none'">` : '');
        const specs = [item.layout, item.area].filter(Boolean).map(esc).join('<span class="mx-1.5 text-slate-300">|</span>');
        return `
        <article class="relative bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
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

    // 「すべて」のときは、売買・賃貸を交互に並べる（どちらかが多くても、もう一方が埋もれないように）
    function mixByType(items) {
        const order = ['売買', '賃貸'];
        const groups = {};
        items.forEach((i) => {
            const t = i.type || 'その他';
            if (!groups[t]) groups[t] = [];
            groups[t].push(i);
        });
        const keys = order.filter((t) => groups[t]).concat(Object.keys(groups).filter((t) => order.indexOf(t) < 0));
        const out = [];
        for (let n = 0; out.length < items.length; n++) {
            keys.forEach((t) => { if (groups[t][n]) out.push(groups[t][n]); });
        }
        return out;
    }

    function render(el, items) {
        const limit = parseInt(el.dataset.limit || '0', 10);
        const type = el.dataset.type || '';
        let list = type ? items.filter((i) => i.type === type) : (el.dataset.mix === 'type' ? mixByType(items) : items);
        if (limit > 0) list = list.slice(0, limit);
        if (!list.length) {
            message(el, '現在ご紹介できる物件はありません。<br>物件のお探し・ご相談はお気軽にお問い合わせください。');
            return;
        }
        if (el.dataset.layout === 'scroll') {
            // 横スクロール（トップページ用）
            el.innerHTML = `
            <div class="relative">
                <div data-scroller class="flex gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 [scrollbar-width:thin]" tabindex="0" aria-label="ご紹介中の物件（横にスクロールできます）">
                    ${list.map((i) => `<div class="snap-start shrink-0 w-[82%] sm:w-[46%] lg:w-[31.5%] flex [&>article]:w-full">${card(i)}</div>`).join('')}
                </div>
                ${list.length > 3 ? `
                <button type="button" data-dir="-1" aria-label="前の物件" class="hidden md:flex absolute -left-4 top-[35%] w-11 h-11 items-center justify-center rounded-full bg-white/95 border border-slate-200 shadow-md text-slate-700 hover:bg-white"><i class="fa-solid fa-chevron-left"></i></button>
                <button type="button" data-dir="1" aria-label="次の物件" class="hidden md:flex absolute -right-4 top-[35%] w-11 h-11 items-center justify-center rounded-full bg-white/95 border border-slate-200 shadow-md text-slate-700 hover:bg-white"><i class="fa-solid fa-chevron-right"></i></button>` : ''}
            </div>
            ${list.length > 1 ? '<p class="mt-1 text-center text-xs text-slate-500 md:hidden"><i class="fa-solid fa-arrows-left-right mr-1"></i>横にスクロールすると、ほかの物件も見られます</p>' : ''}`;
            const scroller = el.querySelector('[data-scroller]');
            el.querySelectorAll('button[data-dir]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    scroller.scrollBy({ left: Number(btn.dataset.dir) * scroller.clientWidth * 0.9, behavior: 'smooth' });
                });
            });
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
            // 物件名が入っていない行（自動取得できなかった行など）は表示しない
            cache = (Array.isArray(data.items) ? data.items : []).filter((i) => i && String(i.title || '').trim());
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
