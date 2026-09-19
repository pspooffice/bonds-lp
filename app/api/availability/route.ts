import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const checkInDate = request.nextUrl.searchParams.get("checkInDate") || "";
  const month = request.nextUrl.searchParams.get("month") || "";
  const roomType = request.nextUrl.searchParams.get("roomType") || "";
  const roomCount = Number(request.nextUrl.searchParams.get("roomCount") || 1);
  const nights = Number(request.nextUrl.searchParams.get("nights") || 1);

  const calendarRequest = /^\d{4}-\d{2}$/.test(month);
  if (
    (!calendarRequest && !/^\d{4}-\d{2}-\d{2}$/.test(checkInDate)) ||
    !Number.isInteger(nights) || nights < 1 || nights > 14 ||
    !Number.isInteger(roomCount) || roomCount < 1 || roomCount > 6
  ) {
    return NextResponse.json({ message: "日付または宿泊数が正しくありません。" }, { status: 400 });
  }

  const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  if (!scriptUrl) {
    return NextResponse.json({ ok: false, configured: false, rooms: {} });
  }

  try {
    const url = new URL(scriptUrl);
    url.searchParams.set("action", calendarRequest ? "calendar" : "availability");
    if (calendarRequest) {
      url.searchParams.set("month", month);
      if (roomType) url.searchParams.set("roomType", roomType);
      url.searchParams.set("roomCount", String(roomCount));
    } else {
      url.searchParams.set("checkInDate", checkInDate);
    }
    url.searchParams.set("nights", String(nights));
    url.searchParams.set("secret", process.env.GOOGLE_APPS_SCRIPT_SECRET || "");

    const response = await fetch(url, { cache: "no-store" });
    const result = await response.json();

    if (!response.ok || result.ok === false) {
      throw new Error(result.message || "空室状況を取得できませんでした。");
    }

    return NextResponse.json({ ...result, configured: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "空室状況を取得できませんでした。" },
      { status: 502 }
    );
  }
}
