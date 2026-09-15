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
SEND_CUSTOMER_COPY=true
```

`RESEND_API_KEY` が未設定の場合は、メールソフトを開くフォールバックに切り替わります。
`GOOGLE_APPS_SCRIPT_URL` が未設定の場合は、スプレッドシート保存をスキップします。

## 現在保留

予約スケジュール・空室状況連携は未実装です。
