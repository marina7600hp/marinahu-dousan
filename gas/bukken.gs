/**
 * 物件一覧（HP連携）― 有限会社 仁方大森マリーナー
 *
 * 使い方
 *   1. シート「物件一覧」のA列に、SUUMO・スマイミーの物件ページのURLを貼る
 *   2. 数秒で、物件名・価格・所在地・間取り・面積・写真が自動で入る
 *      （取れなかった項目は手で入力してください。手で入れた内容は上書きされません）
 *   3. B列「公開」にチェックが入っている物件だけが、HPの物件一覧に表示されます
 *
 * 初回だけ：メニュー「物件一覧」→「初期設定（最初に1回）」を実行し、
 *          その後「デプロイ」→「新しいデプロイ」→ ウェブアプリ として公開してください。
 *          詳しくは BUKKEN_SETUP.md を参照。
 */

const SHEET_NAME = '物件一覧';
const HEADERS = ['掲載URL', '公開', '種別', '物件名', '価格・賃料', '所在地', '間取り', '面積', '写真URL', 'ひとこと', '取得日時', '取得結果'];
const COL = { url: 1, publish: 2, type: 3, title: 4, price: 5, address: 6, layout: 7, area: 8, image: 9, comment: 10, fetchedAt: 11, status: 12 };

/* ───────── メニュー ───────── */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('物件一覧')
    .addItem('URLから情報を取得（空欄だけ埋める）', 'fetchAll')
    .addItem('選択した行を取り直す（上書き）', 'refetchSelected')
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
  try {
    const html = fetchHtml_(url);
    const info = parseListing_(html, url);
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

    const publishCell = sheet.getRange(row, COL.publish);
    if (publishCell.getValue() === '') publishCell.setValue(true);

    const missing = [['物件名', info.title], ['価格', info.price], ['所在地', info.address], ['写真', info.image]]
      .filter((x) => !x[1]).map((x) => x[0]);
    sheet.getRange(row, COL.fetchedAt).setValue(new Date());
    statusCell.setValue(missing.length ? 'OK（取れなかった項目：' + missing.join('・') + ' → 手入力してください）' : 'OK');
  } catch (err) {
    statusCell.setValue('エラー：' + err.message + '（手入力でも掲載できます）');
  }
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
function parseListing_(html, url) {
  const meta = (key) => {
    const re1 = new RegExp('<meta[^>]+(?:property|name)=["\']' + key + '["\'][^>]*content=["\']([^"\']*)["\']', 'i');
    const re2 = new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']' + key + '["\']', 'i');
    const m = html.match(re1) || html.match(re2);
    return m ? decodeEntities_(m[1]).trim() : '';
  };

  // 本文テキスト（script/styleを除いてタグを外す）
  const text = decodeEntities_(
    html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/[\s　]+/g, ' ');

  // 種別
  let type = '';
  if (/suumo\.jp\/(chintai|jj\/chintai)/i.test(url) || /賃料/.test(text) && !/価格/.test(text)) type = '賃貸';
  else if (/suumo\.jp\/(ikkodate|chukoikkodate|ms|tochi|jj\/bukken)/i.test(url) || /価格/.test(text)) type = '売買';

  // 物件名
  let title = meta('og:title') || ((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  title = decodeEntities_(title).split(/\s*[|｜]\s*/)[0].replace(/【[^】]*(SUUMO|スーモ|スマイミー)[^】]*】/g, '').trim();

  // 価格・賃料
  const yen = '([0-9０-９][0-9０-９,，.．]*\\s*(?:億\\s*[0-9０-９,，]*\\s*)?万円)';
  const pick = (labels) => {
    for (const label of labels) {
      const m = text.match(new RegExp(label + '[^0-9０-９]{0,15}' + yen));
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
  const layout = ((text.match(/間取り\s*[:：]?\s*([1-9１-９][SLDKＳＬＤＫ+＋]{1,6}|ワンルーム)/) ||
    text.match(/(?:^|[^A-Z0-9])([1-9][SLDK]{1,5}|ワンルーム)(?:[^A-Z]|$)/)) || [])[1] || '';

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
  if (image && !/^https?:/i.test(image)) {
    try { image = new URL(image, url).href; } catch (e) { image = ''; }
  }

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

function decodeEntities_(s) {
  return String(s || '')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
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
