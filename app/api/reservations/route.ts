import { NextResponse } from "next/server";

type ReservationPayload = {
  name: string;
  email: string;
  phone: string;
  checkInDate: string;
  nights: number;
  checkoutDate: string;
  guests: number;
  roomCount: number;
  room: string;
  breakfast: boolean;
  dinner: boolean;
  roomSubtotal: number;
  lodgingDiscount: number;
  discountedRoomSubtotal: number;
  breakfastSubtotal: number;
  dinnerSubtotal: number;
  preDiscountTotal: number;
  total: number;
  message?: string;
};

const yen = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0
});

function required(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function mailBody(payload: ReservationPayload) {
  return [
    "THE BONDS PSPO会員向け仮予約依頼",
    "",
    "※この依頼は予約確定ではありません。",
    "",
    `氏名: ${payload.name}`,
    `メールアドレス: ${payload.email}`,
    `電話番号: ${payload.phone}`,
    `チェックイン日: ${payload.checkInDate}`,
    `宿泊数: ${payload.nights}泊`,
    `チェックアウト予定日: ${payload.checkoutDate}`,
    `人数: ${payload.guests}名`,
    `部屋数: ${payload.roomCount}部屋`,
    `部屋: ${payload.room}`,
    `宿代: ${yen.format(payload.roomSubtotal)}`,
    `PSPO会員割引: 宿代30%オフ（-${yen.format(payload.lodgingDiscount)}）`,
    `割引後宿代: ${yen.format(payload.discountedRoomSubtotal)}`,
    `朝食: ${payload.breakfast ? `あり（${yen.format(payload.breakfastSubtotal)}）` : "なし"}`,
    `夕食: ${payload.dinner ? `あり（${yen.format(payload.dinnerSubtotal)}）` : "なし"}`,
    `割引前合計: ${yen.format(payload.preDiscountTotal)}`,
    `PSPO会員特別価格: ${yen.format(payload.total)}`,
    "",
    "備考:",
    payload.message || "なし",
    "",
    "BONDS側で空室、食事担当、料金条件をご確認のうえ返信をお願いします。"
  ].join("\n");
}

async function saveToSheet(payload: ReservationPayload) {
  if (!process.env.GOOGLE_APPS_SCRIPT_URL) return false;

  const response = await fetch(process.env.GOOGLE_APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      submittedAt: new Date().toISOString(),
      status: "未対応",
      secret: process.env.GOOGLE_APPS_SCRIPT_SECRET || "",
      ...payload
    })
  });

  if (!response.ok) {
    throw new Error("Googleスプレッドシートへの保存に失敗しました。");
  }

  const result = await response.json().catch(() => ({ ok: true }));
  if (result.ok === false) {
    throw new Error(result.message || "Googleスプレッドシートへの保存に失敗しました。");
  }

  return true;
}

async function sendReservationMail(payload: ReservationPayload) {
  if (!process.env.RESEND_API_KEY) return false;

  const to = process.env.BONDS_NOTIFICATION_EMAIL || "tamura_n@3puku.co.jp";
  const from = process.env.FROM_EMAIL || "THE BONDS <onboarding@resend.dev>";
  const body = mailBody(payload);
  const subject = `【THE BONDS仮予約】${payload.name}様 ${payload.checkInDate}`;

  const messages = [
    {
      from,
      to,
      reply_to: payload.email,
      subject,
      text: body
    }
  ];

  if (process.env.SEND_CUSTOMER_COPY !== "false") {
    messages.push({
      from,
      to: payload.email,
      reply_to: to,
      subject: `【控え】THE BONDS仮予約依頼 ${payload.checkInDate}`,
      text: body
    });
  }

  for (const message of messages) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error("メール送信に失敗しました。");
    }
  }

  return true;
}

export async function POST(request: Request) {
  const payload = (await request.json()) as ReservationPayload;

  if (!required(payload.name) || !required(payload.email) || !required(payload.phone) || !required(payload.checkInDate)) {
    return NextResponse.json({ message: "氏名、メールアドレス、電話番号、チェックイン日は必須です。" }, { status: 400 });
  }

  try {
    const [sheetSaved, emailSent] = await Promise.all([saveToSheet(payload), sendReservationMail(payload)]);

    return NextResponse.json({
      ok: true,
      sheetSaved,
      emailSent,
      message:
        sheetSaved || emailSent
          ? "仮予約依頼を受け付けました。"
          : "送信設定が未完了です。メールソフト送信に切り替えます。"
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "仮予約依頼の送信に失敗しました。" },
      { status: 500 }
    );
  }
}
