# THE BONDS PSPO会員向けLP

Next.js版の仮予約LPです。

## 起動

```bash
npm install
npm run dev
```

ローカルURL:

```text
http://localhost:3000
```

## 送信まわり

環境変数を設定すると、フォーム送信時にBONDS側メール送信とGoogleスプレッドシート保存を使えます。

```text
BONDS_NOTIFICATION_EMAIL=tamura_n@3puku.co.jp
FROM_EMAIL=THE BONDS <onboarding@resend.dev>
RESEND_API_KEY=
GOOGLE_APPS_SCRIPT_URL=
GOOGLE_APPS_SCRIPT_SECRET=
SEND_CUSTOMER_COPY=true
```

`RESEND_API_KEY` が未設定の場合は、メールソフトを開くフォールバックに切り替わります。
`GOOGLE_APPS_SCRIPT_URL` が未設定の場合は、スプレッドシート保存をスキップします。

## Googleスプレッドシート保存

1. スプレッドシートで `拡張機能` → `Apps Script` を開く
2. `google-apps-script/Code.gs` の内容をApps Scriptへ貼り付ける
3. Apps Scriptの `プロジェクトの設定` → `スクリプト プロパティ` に `SECRET` を追加する
4. `.env.local` の `GOOGLE_APPS_SCRIPT_SECRET` に同じ値を入れる
5. `デプロイ` → `新しいデプロイ` → `ウェブアプリ` として公開する
6. 発行されたウェブアプリURLを `.env.local` の `GOOGLE_APPS_SCRIPT_URL` に入れる

スプレッドシートの1行目は次の順番です。

```text
送信日時, 対応ステータス, 氏名, メールアドレス, 電話番号, チェックイン日, 宿泊数, チェックアウト予定日, 人数, 部屋数, 部屋, 朝食, 夕食, 宿代, 宿代割引額, 割引後宿代, 朝食代, 夕食代, 割引前合計, PSPO会員特別価格, 備考
```

## 現在保留

予約スケジュール・空室状況連携は未実装です。
