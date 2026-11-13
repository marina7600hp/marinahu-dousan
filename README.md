# marinahu-dousan

有限会社 仁方大森マリーナー の公式サイト（https://marinahu-dousan.marina-oomori1.workers.dev/）

## ページ構成
| ファイル | 内容 |
|---|---|
| `index.html` | トップページ（会社紹介・事業内容・空き家サービスへの入口・物件一覧・会社概要・お問い合わせ） |
| `baibai.html` | 不動産売買・仲介のランディングページ（売りたい方・買いたい方） |
| `akiya-kanri.html` | 空き家管理のランディングページ（料金プラン・作業内容・流れ・FAQ） |
| `akiya-saisei.html` | 空き家再生・賃貸活用のランディングページ（リフォームして貸す） |
| `kaitori.html` | 空き家買取のランディングページ |
| `bukken.html` | 物件一覧（Googleスプレッドシートから自動表示） |
| `kaisha.html` | 会社概要のランディングページ（想い・強み・事業内容・会社概要・アクセス・お問い合わせ） |
| `privacy.html` | 個人情報の取扱い（プライバシーポリシー） |
| `assets/site.js` | 各ランディングページ共通の動き（スマホメニュー、相談種別の自動選択、フォーム送信） |
| `assets/bukken.js` | 物件一覧の表示。先頭の `BUKKEN_API_URL` にスプレッドシート連携のURLを設定 |
| `gas/bukken.gs` | 物件一覧のスプレッドシート用スクリプト（URLを貼ると物件情報を自動取得） |
| `BUKKEN_SETUP.md` | 物件一覧の設定手順 |
| `images/` | 画像（幅1400px程度・数百KB以下に縮小して置く） |
| `robots.txt` / `sitemap.xml` | 検索エンジン向け。ページを増やしたら `sitemap.xml` にも追加 |
| `hp.html` | 旧バージョン（未使用） |

## よくある更新
- **物件を載せる**：スプレッドシート「物件一覧」のA列にSUUMO・スマイミーの物件URLを貼る（`BUKKEN_SETUP.md`）
- **空き家管理の料金を変える**（表示は呉中央エリアの最低料金）：`akiya-kanri.html` の「PLANS」セクションとオプション表、`<head>` 内の構造化データ（offers の price）と description を合わせて直す
- **お問い合わせの送信先**：トップページは `index.html` 末尾のスクリプト、ランディングページは `assets/site.js` の `formsubmit.co/ajax/...`
