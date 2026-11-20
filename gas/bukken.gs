/**
 * 物件一覧（HP連携）― 有限会社 仁方大森マリーナー
 *
 * 使い方
 *   ・SUUMO：シート「物件一覧」のA列に物件ページのURLを貼る → 数秒で情報が自動で入る
 *   ・スマイミー：ブラウザで物件ページを開き、ブックマークの「HPに掲載」ボタンを押す → 1行追加される
 *     （スマイミーはサーバーからの自動読み取りを受け付けないため、ブラウザで読み取る方式です）
 *   ・取れなかった項目は手で入力してください。手で入れた内容は上書きされません
 *   ・B列「公開」にチェックが入っている物件だけが、HPの物件一覧に表示されます
 *
 * 初回だけ：メニュー「物件一覧」→「初期設定（最初に1回）」を実行し、
 *          その後「デプロイ」→「新しいデプロイ」→ ウェブアプリ として公開してください。
 *          詳しくは BUKKEN_SETUP.md を参照。
 */

const SHEET_NAME = '物件一覧';
const HEADERS = ['掲載URL', '公開', '種別', '物件名', '価格・賃料', '所在地', '間取り', '面積', '写真URL', 'ひとこと', '取得日時', '取得結果'];
const COL = { url: 1, publish: 2, type: 3, title: 4, price: 5, address: 6, layout: 7, area: 8, image: 9, comment: 10, fetchedAt: 11, status: 12 };

// 「HPに掲載」ボタン（ブックマーク）の送り先＝このスクリプトのウェブアプリのURL
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbyvdBXvXkEkezLCJN0YGnnB6upADt4A7VJGVDC13lAzU3YbLiVKItlhOsHiAsBXGwMP/exec';
// サーバーからの自動読み取りを受け付けないサイト（ボタンで登録する）
const BROWSER_ONLY_HOSTS = /(^|\.)fudohsan\.jp$/i;
// ボタンで登録できるサイト
const BUTTON_HOSTS = /(^|\.)(fudohsan\.jp|suumo\.jp)$/i;

/* ───────── メニュー ───────── */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('物件一覧')
    .addItem('URLから情報を取得（空欄だけ埋める）', 'fetchAll')
    .addItem('選択した行を取り直す（上書き）', 'refetchSelected')
    .addSeparator()
    .addItem('「HPに掲載」ボタンを作る（スマイミー用）', 'showButtonDialog')
    .addSeparator()
    .addItem('初期設定（最初に1回）', 'setup')
    .addToUi();
}

/** 初期設定：シートの見出し・チェックボックス・自動取得のトリガーを作る */
function setup() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#e0f2fe');
  sheet.setFrozenRows(1);
  sheet.getRange(2, COL.publish, 500, 1).insertCheckboxes();
  sheet.getRange(2, COL.type, 500, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['売買', '賃貸'], true).setAllowInvalid(false).build());
  sheet.setColumnWidth(COL.url, 320);
  sheet.setColumnWidth(COL.title, 240);
  sheet.setColumnWidth(COL.address, 200);
  sheet.setColumnWidth(COL.image, 200);
  sheet.setColumnWidth(COL.comment, 240);
  sheet.setColumnWidth(COL.status, 220);

  // URLを貼ったら自動で取得するトリガー（重複して作らない）
  const exists = ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === 'onEditInstalled');
  if (!exists) ScriptApp.newTrigger('onEditInstalled').forSpreadsheet(ss).onEdit().create();

  SpreadsheetApp.getUi().alert('初期設定が完了しました。A列に物件ページのURLを貼ってください。');
}

/** A列にURLが貼られたら、その行の情報を取得する */
function onEditInstalled(e) {
  const range = e && e.range;
  if (!range) return;
  const sheet = range.getSheet();
  if (sheet.getName() !== SHEET_NAME) return;
  if (range.getColumn() > COL.url || range.getLastColumn() < COL.url) return;
  for (let r = Math.max(2, range.getRow()); r <= range.getLastRow(); r++) {
    fillRow_(sheet, r, false);
  }
}

/** URLはあるのに未取得の行を、まとめて取得する */
function fetchAll() {
  const sheet = getSheet_();
  const last = sheet.getLastRow();
  for (let r = 2; r <= last; r++) {
    const url = String(sheet.getRange(r, COL.url).getValue()).trim();
    const status = String(sheet.getRange(r, COL.status).getValue());
    if (url && !/^OK/.test(status)) fillRow_(sheet, r, false);
  }
}

/** 選択している行を取り直す（自動取得した項目を上書き） */
function refetchSelected() {
  const sheet = getSheet_();
  const range = sheet.getActiveRange();
  if (!range) return;
  const ui = SpreadsheetApp.getUi();
  const ok = ui.alert('選択した行の物件名・価格などを、掲載ページの内容で上書きします。よろしいですか？', ui.ButtonSet.OK_CANCEL);
  if (ok !== ui.Button.OK) return;
  for (let r = Math.max(2, range.getRow()); r <= range.getLastRow(); r++) fillRow_(sheet, r, true);
}

function getSheet_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('シート「' + SHEET_NAME + '」がありません。メニューの「初期設定」を実行してください。');
  return sheet;
}

/* ───────── 取得処理 ───────── */

function fillRow_(sheet, row, overwrite) {
  const url = String(sheet.getRange(row, COL.url).getValue()).trim();
  if (!url) return;
  const statusCell = sheet.getRange(row, COL.status);
  if (!/^https:\/\//i.test(url)) {
    statusCell.setValue('エラー：URLは https:// から始まるものを貼ってください');
    return;
  }
  const host = (url.match(/^https:\/\/([^\/?#]+)/i) || [])[1] || '';
  if (BROWSER_ONLY_HOSTS.test(host)) {
    // すでにボタンで登録済みの行はそのまま
    if (!/^OK/.test(String(statusCell.getValue()))) {
      statusCell.setValue('スマイミーは自動取得できません → ブラウザで物件ページを開き「HPに掲載」ボタンを押してください（手入力でも掲載できます）');
    }
    return;
  }
  const firstTime = !/^OK/.test(String(statusCell.getValue()));
  try {
    const html = fetchHtml_(url);
    const info = parseListing_(html, url);
    writeInfo_(sheet, row, info, overwrite, firstTime);
  } catch (err) {
    statusCell.setValue('エラー：' + err.message + '（手入力でも掲載できます）');
  }
}

/** 取得した物件情報を行に書き込む（空欄だけ埋める／overwrite=true なら上書き） */
function writeInfo_(sheet, row, info, overwrite, publish) {
  const put = (col, value) => {
    if (!value) return;
    const cell = sheet.getRange(row, col);
    if (overwrite || cell.getValue() === '') cell.setValue(value);
  };
  put(COL.type, info.type);
  put(COL.title, info.title);
  put(COL.price, info.price);
  put(COL.address, info.address);
  put(COL.layout, info.layout);
  put(COL.area, info.area);
  put(COL.image, info.image);
  // 初めて取得できたときは「公開」にチェックを入れる（あとで外せば非公開にできる）
  if (publish) sheet.getRange(row, COL.publish).setValue(true);

  const missing = [['物件名', info.title], ['価格', info.price], ['所在地', info.address], ['写真', info.image]]
    .filter((x) => !x[1]).map((x) => x[0]);
  sheet.getRange(row, COL.fetchedAt).setValue(new Date());
  sheet.getRange(row, COL.status).setValue(missing.length ? 'OK（取れなかった項目：' + missing.join('・') + ' → 手入力してください）' : 'OK');
  return missing;
}

function fetchHtml_(url) {
  const res = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { 'Accept-Language': 'ja,en;q=0.8' },
  });
  const code = res.getResponseCode();
  if (code >= 400) throw new Error('ページを開けませんでした（' + code + '）');
  return decodeResponse_(res);
}

/** 文字コード（UTF-8 / Shift_JIS / EUC-JP）を判定して文字列にする */
function decodeResponse_(res) {
  const headers = res.getHeaders();
  const ct = headers['Content-Type'] || headers['content-type'] || '';
  let cs = (ct.match(/charset=["']?([\w-]+)/i) || [])[1];
  if (!cs) {
    const head = res.getBlob().getDataAsString('ISO-8859-1').slice(0, 4000);
    cs = (head.match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1];
  }
  cs = cs || 'UTF-8';
  if (/shift[_-]?jis|sjis|windows-31j|cp932/i.test(cs)) cs = 'Shift_JIS';
  else if (/euc-?jp/i.test(cs)) cs = 'EUC-JP';
  else cs = 'UTF-8';
  return res.getContentText(cs);
}

/**
 * 物件ページのHTMLから情報を取り出す（SUUMO・スマイミー共通の汎用ルール）
 * ※ 掲載サイトの画面が変わると取れなくなることがあります。その場合は手入力してください。
 */
function parseListing_(html, url, pageText) {
  const meta = (key) => {
    const re1 = new RegExp('<meta[^>]+(?:property|name)=["\']' + key + '["\'][^>]*content=["\']([^"\']*)["\']', 'i');
    const re2 = new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']' + key + '["\']', 'i');
    const m = html.match(re1) || html.match(re2);
    return m ? decodeEntities_(m[1]).trim() : '';
  };

  // 本文テキスト（ブラウザから送られた文字があればそれを使う。なければHTMLからタグを外す）
  const text = (pageText ? String(pageText) : decodeEntities_(
    html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )).replace(/[\s　]+/g, ' ');

  // 物件名（元の文字）
  let title = meta('og:title') || ((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const rawTitle = decodeEntities_(title);

  // 種別（「価 格」のように間に空白が入っていても判定できるよう、空白を除いて調べる）
  const flat = text.replace(/\s+/g, '');
  let type = '';
  if (/suumo\.jp\/(chintai|jj\/chintai)/i.test(url) || /(賃貸|貸家|貸アパート|貸マンション|貸店舗|貸事務所|貸倉庫|貸工場|貸地)/.test(rawTitle) ||
      (/(賃料|家賃)/.test(flat) && !/価格/.test(flat))) type = '賃貸';
  else if (/suumo\.jp\/(ikkodate|chukoikkodate|ms|tochi|jj\/bukken)/i.test(url) || /価格/.test(flat) ||
      /(売土地|売り地|売地|中古|新築|売マンション|売店舗|売事務所|売倉庫|売工場|売ビル|売家)/.test(rawTitle)) type = '売買';

  title = decodeEntities_(title).split(/\s*[|｜]\s*/)[0].replace(/【[^】]*(SUUMO|スーモ|スマイミー|不動産)[^】]*】/g, '');
  title = title.split('／')[0].replace(/（[^（）]*提供）/g, '').trim();
  // スマイミー：「売土地・売り地の詳細情報 呉市広町田１丁目の売土地・売り地 スマイミー」→「呉市広町田１丁目 売土地」
  title = title.replace(/^\S*の詳細情報\s*/, '').replace(/\s*(スマイミー|SUUMO)\s*$/i, '').trim();
  const loc = title.match(/^(\S*?(?:市|町|丁目|村)\S*?)の(\S+)$/);
  if (loc) title = loc[1] + ' ' + loc[2].split('・')[0];

  // 価格・賃料
  const yen = '([0-9０-９][0-9０-９,，.．]*\\s*(?:億\\s*[0-9０-９,，]*\\s*)?万円)';
  const pick = (labels) => {
    for (const label of labels) {
      const m = text.match(new RegExp(label.split('').join('\\s*') + '[^0-9０-９]{0,15}' + yen));
      if (m) return m[1].replace(/\s+/g, '');
    }
    return '';
  };
  let price = type === '賃貸' ? pick(['賃料', '家賃']) : pick(['販売価格', '価格']);
  if (!price) price = ((text.match(new RegExp(yen)) || [])[1] || '').replace(/\s+/g, '');
  if (price && type === '賃貸' && !/月/.test(price)) price = '月額 ' + price;

  // 所在地
  const addr = text.match(/(?:所在地|住所)\s*[:：]?\s*((?:広島県)?\s*呉市[^\s、。,，()（）［］\[\]<>]{1,30})/) ||
    text.match(/((?:広島県)?呉市[^\s、。,，()（）［］\[\]<>]{1,30})/);
  let address = addr ? addr[1].replace(/\s+/g, '') : '';
  if (address && !/^広島県/.test(address)) address = '広島県' + address;
  address = address.replace(/(地図を見る|周辺環境).*$/, '');

  // 間取り
  const LAYOUT = '([1-9１-９][SLDKＳＬＤＫ]{1,5}(?:[+＋][SＳ](?:（納戸）)?)?|ワンルーム)';
  const layout = ((text.match(new RegExp('間取り\\s*(?:ヒント\\s*)?[:：]?\\s*' + LAYOUT)) ||
    text.match(new RegExp('(?:^|[^A-Z0-9])' + LAYOUT + '(?:[^A-Z]|$)'))) || [])[1] || '';

  // 面積（建物・専有 → 土地 の順で探す）
  const areaOf = (label) => {
    const m = text.match(new RegExp(label + '[^0-9０-９]{0,10}([0-9０-９]+(?:[.．][0-9０-９]+)?)\\s*(?:m\\s*[²2]|㎡|平米)'));
    return m ? m[1] + '㎡' : '';
  };
  let area = areaOf('専有面積') || areaOf('建物面積');
  const land = areaOf('土地面積');
  if (area && land) area = '建物 ' + area + '／土地 ' + land;
  else if (!area && land) area = '土地 ' + land;

  // 写真
  let image = meta('og:image');
  if (!image) image = findPhoto_(html);
  if (image && (!/^https?:/i.test(image) || isCompanyPhoto_(image))) image = '';

  return {
    type: type,
    title: title.slice(0, 80),
    price: price,
    address: address,
    layout: layout,
    area: area,
    image: image,
  };
}

/** スマイミーの会社（掲載店）写真かどうか */
function isCompanyPhoto_(u) {
  return /fudohsan\.jp\/m_img\//i.test(String(u || ''));
}

/** 物件番号入りの写真を優先して選ぶ（スマイミーは /img/物件番号/ が物件写真） */
function pickPhoto_(url, candidates, current) {
  let decoded = url;
  try { decoded = decodeURIComponent(url); } catch (e) { /* そのまま */ }
  const id = (decoded.match(/物件\/(\d+)/) || [])[1];
  const ok = (u) => /^https:\/\//i.test(u) && !isCompanyPhoto_(u);
  if (id) {
    const own = candidates.find((u) => ok(u) && u.indexOf('/' + id + '/') >= 0);
    if (own) return own;
  }
  if (ok(current || '')) return current;
  return candidates.find(ok) || '';
}

/** og:image がないページ用：本文中の物件写真らしき画像を探す（SUUMOは rel / data-src に写真URLがある） */
function findPhoto_(html) {
  const urls = [];
  const re = /(?:src|data-src|data-original|data-lazy|rel)=["'](https?:\/\/[^"']+?\.(?:jpe?g|png|webp)[^"']*|https?:\/\/[^"']*resizeImage[^"']*)["']/gi;
  let m;
  while ((m = re.exec(html)) && urls.length < 50) urls.push(decodeEntities_(m[1]));
  const isPhoto = (u) => !/logo|icon|banner|btn|button|sprite|common|kaisha/i.test(u);
  return urls.find((u) => /bukken/i.test(u) && isPhoto(u)) || urls.find(isPhoto) || '';
}

function decodeEntities_(s) {
  return String(s || '')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/* ───────── 「HPに掲載」ボタン（スマイミー用） ───────── */

/** ボタンの鍵（あなた専用。ほかの人が勝手に物件を追加できないようにする） */
function getButtonKey_() {
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('BUTTON_KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
    props.setProperty('BUTTON_KEY', key);
  }
  return key;
}

/** ブラウザのブックマークに登録するボタンのプログラム */
function bookmarkletCode_(key) {
  const js = "(function(){"
    + "var h=location.hostname;"
    + "if(!/(^|\\.)(fudohsan\\.jp|suumo\\.jp)$/i.test(h)){alert('スマイミー（またはSUUMO）の物件ページを開いてから押してください');return;}"
    + "var best='',bs=0,c=[];"
    + "Array.prototype.forEach.call(document.images,function(i){var s=i.currentSrc||i.src||'';var w=i.naturalWidth||0,a=w*(i.naturalHeight||0);"
    + "if(/^https:/.test(s)&&w>=150&&!/logo|icon|banner|btn|button|sprite|common|qr|map/i.test(s)){c.push([a,s]);if(a>bs){bs=a;best=s;}}});"
    + "c.sort(function(x,y){return y[0]-x[0];});"
    + "var f=document.createElement('form');f.method='POST';f.action=" + JSON.stringify(WEBAPP_URL) + ";f.target='_blank';f.acceptCharset='UTF-8';f.style.display='none';"
    + "function add(n,v){var t=document.createElement('textarea');t.name=n;t.value=v;f.appendChild(t);}"
    + "add('action','add');add('key'," + JSON.stringify(key) + ");add('url',location.href);add('image',best);"
    + "add('images',c.map(function(x){return x[1];}).filter(function(s,n,a){return a.indexOf(s)===n;}).slice(0,40).join('\\n'));"
    + "add('head',document.head?document.head.outerHTML.slice(0,200000):'');"
    + "add('text',(document.body&&document.body.innerText||'').slice(0,300000));"
    + "document.body.appendChild(f);f.submit();setTimeout(function(){f.remove();},1000);"
    + "})();";
  return 'javascript:' + encodeURIComponent(js);
}

/** メニュー：ボタンの作り方を表示 */
function showButtonDialog() {
  const code = bookmarkletCode_(getButtonKey_());
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:sans-serif;font-size:14px;line-height:1.8;color:#1e293b">'
    + '<p><b>① 下の青いボタンを、ブラウザのブックマークバーへドラッグ（引っぱって離す）してください。</b></p>'
    + '<p style="text-align:center;margin:18px 0"><a href="' + esc(code) + '" onclick="alert(\'クリックではなく、ブックマークバーへドラッグしてください\');return false;" '
    + 'style="display:inline-block;padding:10px 22px;background:#0369a1;color:#fff;border-radius:999px;font-weight:bold;text-decoration:none">HPに掲載</a></p>'
    + '<p>ブックマークバーが見えないときは Ctrl＋Shift＋B（Macは Cmd＋Shift＋B）で表示されます。</p>'
    + '<p><b>② 使い方：</b>スマイミーの物件ページを開いた状態で、ブックマークの「HPに掲載」を押す → 新しいタブに「追加しました」と出れば完了です。</p>'
    + '<details style="margin-top:10px"><summary>ドラッグできないとき（手で登録する方法）</summary>'
    + '<p>ブックマークバーで右クリック →「ページを追加」→ 名前に「HPに掲載」、URL欄に下の文字をすべて貼り付けて保存します。</p>'
    + '<textarea readonly style="width:100%;height:90px;font-size:11px" onclick="this.select()">' + esc(code) + '</textarea></details>'
    + '<p style="font-size:12px;color:#64748b;margin-top:10px">※ このボタンには、あなた専用の鍵が入っています。ほかの人に渡さないでください。</p>'
    + '</div>').setWidth(560).setHeight(470);
  SpreadsheetApp.getUi().showModalDialog(html, '「HPに掲載」ボタンの作り方');
}

/** ボタンから送られてきた物件を、シートに追加（または同じURLの行を更新）する */
function doPost(e) {
  const p = (e && e.parameter) || {};
  if (p.action !== 'add') return resultPage_(false, '不正な送信です。');
  const key = PropertiesService.getScriptProperties().getProperty('BUTTON_KEY');
  if (!key || p.key !== key) {
    return resultPage_(false, 'ボタンの鍵が一致しません。スプレッドシートのメニュー「物件一覧 →「HPに掲載」ボタンを作る」から、ボタンを作り直してください。');
  }
  const url = String(p.url || '').trim().split('#')[0];
  const host = (url.match(/^https:\/\/([^\/?#]+)/i) || [])[1] || '';
  if (!BUTTON_HOSTS.test(host)) return resultPage_(false, 'スマイミー（またはSUUMO）の物件ページで押してください。');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = getSheet_();
    const info = parseListing_(String(p.head || ''), url, String(p.text || ''));
    const candidates = String(p.images || '').split('\n').map((s) => s.trim()).filter(Boolean);
    if (p.image) candidates.push(String(p.image));
    info.image = pickPhoto_(url, candidates, info.image);
    const row = findRowForUrl_(sheet, url);
    const isNew = String(sheet.getRange(row, COL.url).getValue()).trim() === '';
    if (isNew) sheet.getRange(row, COL.url).setValue(url);
    // 以前のボタンで入った「会社の写真」「長いページ名」は、新しい内容に入れ替える
    const imgCell = sheet.getRange(row, COL.image);
    if (isCompanyPhoto_(imgCell.getValue())) imgCell.setValue('');
    const titleCell = sheet.getRange(row, COL.title);
    if (/の詳細情報|スマイミー\s*$/.test(String(titleCell.getValue()))) titleCell.setValue('');
    const missing = writeInfo_(sheet, row, info, false, true);
    SpreadsheetApp.flush();
    return resultPage_(true, (isNew ? row + '行目に追加しました。' : row + '行目（同じURLの行）を更新しました。')
      + (missing.length ? '<br>取れなかった項目：' + missing.join('・') + '（スプレッドシートで手入力してください）' : ''), info);
  } catch (err) {
    return resultPage_(false, 'エラー：' + err.message);
  } finally {
    lock.releaseLock();
  }
}

/** 同じURLの行があればその行、なければA列が空いている最初の行 */
function findRowForUrl_(sheet, url) {
  const last = Math.max(sheet.getLastRow(), 2);
  const values = sheet.getRange(2, COL.url, last - 1, 1).getValues();
  const norm = (u) => String(u).trim().split('#')[0].replace(/\/$/, '');
  let empty = 0;
  for (let i = 0; i < values.length; i++) {
    const v = String(values[i][0]).trim();
    if (v && norm(v) === norm(url)) return i + 2;
    if (!v && !empty) empty = i + 2;
  }
  return empty || last + 1;
}

/** ボタンを押したあとに表示する画面 */
function resultPage_(ok, message, info) {
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const rows = info ? [['物件名', info.title], ['価格・賃料', info.price], ['所在地', info.address], ['間取り', info.layout], ['面積', info.area]]
    .map((r) => '<tr><th style="text-align:left;padding:4px 12px 4px 0;color:#64748b;white-space:nowrap">' + r[0] + '</th><td>' + (esc(r[1]) || '<span style="color:#c2410c">（取れませんでした）</span>') + '</td></tr>').join('') : '';
  const img = info && /^https:\/\//i.test(info.image) ? '<img src="' + esc(info.image) + '" style="max-width:100%;max-height:220px;border-radius:12px;margin-top:12px">' : '';
  let sheetUrl = '';
  try { sheetUrl = SpreadsheetApp.getActive().getUrl(); } catch (e) { /* 表示しないだけ */ }
  const html = '<div style="font-family:sans-serif;max-width:560px;margin:32px auto;padding:24px;border-radius:16px;border:1px solid #e2e8f0;line-height:1.8;color:#1e293b">'
    + '<h2 style="margin:0 0 8px;color:' + (ok ? '#0d9488' : '#c2410c') + '">' + (ok ? '✓ HP物件一覧に登録しました' : '登録できませんでした') + '</h2>'
    + '<p>' + message + '</p>'
    + (rows ? '<table style="font-size:14px;margin-top:8px">' + rows + '</table>' : '') + img
    + '<p style="margin-top:16px;font-size:13px;color:#64748b">HPには数分以内に反映されます。表示をやめるときは、スプレッドシートのB列「公開」のチェックを外してください。</p>'
    + (sheetUrl ? '<p><a href="' + esc(sheetUrl) + '" target="_blank">スプレッドシートを開く</a></p>' : '')
    + '<p style="font-size:13px;color:#64748b">このタブは閉じて大丈夫です。</p></div>';
  return HtmlService.createHtmlOutput(html).setTitle(ok ? '登録しました' : '登録できませんでした');
}

/* ───────── HPへの公開（ウェブアプリ） ───────── */

/** HPから呼ばれる：公開チェックが入った物件をJSONで返す */
function doGet() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const items = [];
  if (sheet && sheet.getLastRow() >= 2) {
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
    rows.forEach((r) => {
      const url = String(r[COL.url - 1]).trim();
      if (r[COL.publish - 1] !== true) return;
      const title = String(r[COL.title - 1]).trim();
      if (!url && !title) return;
      items.push({
        url: /^https:\/\//i.test(url) ? url : '',
        type: String(r[COL.type - 1]).trim(),
        title: title,
        price: String(r[COL.price - 1]).trim(),
        address: String(r[COL.address - 1]).trim(),
        layout: String(r[COL.layout - 1]).trim(),
        area: String(r[COL.area - 1]).trim(),
        image: driveToImage_(String(r[COL.image - 1]).trim()),
        comment: String(r[COL.comment - 1]).trim(),
      });
    });
  }
  return ContentService.createTextOutput(JSON.stringify({ items: items, updatedAt: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Googleドライブの共有リンクを、HPで表示できる画像URLに変換 */
function driveToImage_(u) {
  const m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/);
  if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1000';
  return /^https:\/\//i.test(u) ? u : '';
}
