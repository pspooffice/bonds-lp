import { NextResponse } from "next/server";

export const maxDuration = 30;

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
  breakfastServiceCount?: number;
  dinnerServiceCount?: number;
  breakfastLabel?: string;
  dinnerLabel?: string;
  preDiscountTotal: number;
  total: number;
  message?: string;
};

function required(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

async function saveToSheet(payload: ReservationPayload) {
  if (!process.env.GOOGLE_APPS_SCRIPT_URL) return { sheetSaved: false, emailSent: false };

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
    throw new Error(`Googleスプレッドシート連携からエラーが返りました。（${response.status}）`);
  }

  const result = await response.json().catch(() => ({ ok: true }));
  if (result.ok === false) {
    throw new Error(result.message || "Googleスプレッドシートへの保存に失敗しました。");
  }

  return { sheetSaved: true, emailSent: result.emailSent === true };
}

export async function POST(request: Request) {
  const payload = (await request.json()) as ReservationPayload;

  if (!required(payload.name) || !required(payload.email) || !required(payload.phone) || !required(payload.checkInDate)) {
    return NextResponse.json({ message: "氏名、メールアドレス、電話番号、チェックイン日は必須です。" }, { status: 400 });
  }

  try {
    const { sheetSaved, emailSent } = await saveToSheet(payload);

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
