# marinahu-dousan

有限会社 仁方大森マリーナー の公式サイト（https://marinahu-dousan.marina-oomori1.workers.dev/）

## ページ構成
| ファイル | 内容 |
|---|---|
| `index.html` | トップ（空き家管理LP：お悩み→3つの選択肢→料金→流れ→空き家再生・賃貸→FAQ→事業内容→会社概要→お問い合わせ） |
| `kaitori.html` | 空き家買取ページ |
| `assets/site.js` | 共通の動き（スマホメニュー、相談種別の自動選択、フォーム送信） |
| `images/` | 画像（幅1400px程度・数百KB以下に縮小して置く） |
| `robots.txt` / `sitemap.xml` | 検索エンジン向け。ページを増やしたら `sitemap.xml` にも追加 |
| `hp.html` | 旧バージョン（未使用） |

## よくある更新
- **空き家管理の料金を変える**：`index.html` の「PLANS」セクションと「オプション」表、
  さらに `<head>` 内の構造化データ（`makesOffer` の price）と、`description` の「月額3,300円から」を合わせて直す。
- **お問い合わせの送信先**：`assets/site.js` の `formsubmit.co/ajax/...` の部分。
