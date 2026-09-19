"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Room = {
  id: string;
  name: string;
  size: string;
  capacity: string;
  minGuests: number;
  maxGuests: number;
  basePrice: number;
  image: string;
  description: string;
  perRoom?: boolean;
  priceGroup?: "standard" | "upper" | "suite";
};

type SubmitState = "idle" | "sending" | "sent" | "fallback" | "error";
type AvailabilityStatus = "available" | "limited" | "full" | "unknown";
type AvailabilityRoom = { status: AvailabilityStatus; availableCount: number; totalCount?: number };
type AvailabilityState = {
  state: "loading" | "ready" | "unavailable" | "error";
  rooms: Record<string, AvailabilityRoom>;
  missingDates?: string[];
};
type CalendarState = {
  state: "loading" | "ready" | "error";
  days: Record<string, AvailabilityStatus>;
};

const CONFIG = {
  emailTo: "tamura_n@3puku.co.jp",
  lodgingDiscountPercent: 30,
  breakfastPricePerPerson: 1650,
  dinnerPricePerPerson: 8800,
  mealUnavailableWeekdays: [3],
  rooms: [
    {
      id: "twin",
      name: "ツインルーム",
      size: "11平米",
      capacity: "1から2名",
      minGuests: 1,
      maxGuests: 2,
      basePrice: 5000,
      priceGroup: "standard",
      image: "https://the-bonds.jp/cms/wp-content/themes/the-bonds/assets/img/room-twin01.webp",
      description: "朝日やみかん畑を望める、シンプルで過ごしやすいツインルーム。"
    },
    {
      id: "double",
      name: "ダブルベッドルーム",
      size: "11平米",
      capacity: "1から2名",
      minGuests: 1,
      maxGuests: 2,
      basePrice: 5000,
      priceGroup: "standard",
      image: "https://the-bonds.jp/cms/wp-content/themes/the-bonds/assets/img/room-double01.webp",
      description: "キングサイズの大きなベッドで、カップルや小さなお子様連れにも使いやすいお部屋。"
    },
    {
      id: "japanese",
      name: "和室",
      size: "11平米",
      capacity: "1から2名",
      minGuests: 1,
      maxGuests: 2,
      basePrice: 5000,
      priceGroup: "standard",
      image: "https://the-bonds.jp/cms/wp-content/themes/the-bonds/assets/img/room-japanese01.webp",
      description: "布団をセルフで敷く、気軽に使える和室タイプ。"
    },
    {
      id: "four-bed",
      name: "4ベッドルーム",
      size: "16平米",
      capacity: "2から4名",
      minGuests: 1,
      maxGuests: 4,
      basePrice: 5500,
      priceGroup: "upper",
      image: "https://the-bonds.jp/cms/wp-content/themes/the-bonds/assets/img/room-quad01.webp",
      description: "家族やグループに向いた、4名まで泊まれるベッドルーム。"
    },
    {
      id: "deluxe-twin",
      name: "デラックスツイン",
      size: "20平米",
      capacity: "1から2名",
      minGuests: 1,
      maxGuests: 2,
      basePrice: 8000,
      priceGroup: "upper",
      image: "https://the-bonds.jp/cms/wp-content/themes/the-bonds/assets/img/room-deluxe-twin01.webp",
      description: "ソファーから海を眺められる、ゆとりのあるツインルーム。"
    },
    {
      id: "ocean-suite",
      name: "オーシャンスイート",
      size: "27平米",
      capacity: "1から2名",
      minGuests: 1,
      maxGuests: 2,
      basePrice: 12000,
      priceGroup: "suite",
      image: "https://the-bonds.jp/cms/wp-content/themes/the-bonds/assets/img/room-ocean-suite01.webp",
      description: "姫ヶ浜ビーチを目前に眺める、バス・トイレ付きの最上級オーシャンビュー。"
    },
    {
      id: "bonds-2",
      name: "1棟貸切 THE BONDS II",
      size: "2LDK",
      capacity: "2から8名",
      minGuests: 2,
      maxGuests: 8,
      basePrice: 45000,
      image: "https://the-bonds.jp/cms/wp-content/themes/the-bonds/assets/img/room-bonds-2-01.webp",
      description: "リビング、和室2部屋、キッチンを備えた大人数向けの別邸。料金は1棟単位です。",
      perRoom: true
    }
  ] satisfies Room[]
};

const LODGING_RATES = {
  standard: { regular: { single: 5500, shared: 4840 }, premium: { single: 6050, shared: 5390 } },
  upper: { regular: { single: 8470, shared: 6050 }, premium: { single: 9020, shared: 6600 } },
  suite: { regular: { single: 12100, shared: 12100 }, premium: { single: 12650, shared: 12650 } }
} as const;

const yen = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0
});

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function todayString() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return formatDate(now);
}

function monthString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(value: string, amount: number) {
  const [year, month] = value.split("-").map(Number);
  return monthString(new Date(year, month - 1 + amount, 1));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isUnavailableWeekday(date: Date) {
  return CONFIG.mealUnavailableWeekdays.includes(date.getDay());
}

function nthMonday(year: number, month: number, nth: number) {
  const first = new Date(year, month, 1);
  return 1 + ((8 - first.getDay()) % 7) + (nth - 1) * 7;
}

function japaneseHolidays(year: number) {
  const springEquinox = Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  const autumnEquinox = Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  const holidays = new Set([
    `${year}-01-01`, `${year}-01-${String(nthMonday(year, 0, 2)).padStart(2, "0")}`,
    `${year}-02-11`, `${year}-02-23`, `${year}-03-${String(springEquinox).padStart(2, "0")}`,
    `${year}-04-29`, `${year}-05-03`, `${year}-05-04`, `${year}-05-05`,
    `${year}-07-${String(nthMonday(year, 6, 3)).padStart(2, "0")}`, `${year}-08-11`,
    `${year}-09-${String(nthMonday(year, 8, 3)).padStart(2, "0")}`, `${year}-09-${String(autumnEquinox).padStart(2, "0")}`,
    `${year}-10-${String(nthMonday(year, 9, 2)).padStart(2, "0")}`, `${year}-11-03`, `${year}-11-23`
  ]);

  Array.from(holidays).forEach((holiday) => {
    const date = parseLocalDate(holiday);
    if (date.getDay() !== 0) return;
    do date.setDate(date.getDate() + 1); while (holidays.has(formatDate(date)));
    holidays.add(formatDate(date));
  });

  for (let date = new Date(year, 0, 2); date.getFullYear() === year; date.setDate(date.getDate() + 1)) {
    if (holidays.has(formatDate(addDays(date, -1))) && holidays.has(formatDate(addDays(date, 1)))) {
      holidays.add(formatDate(date));
    }
  }

  return holidays;
}

function isPremiumDate(date: Date) {
  return date.getDay() === 0 || date.getDay() === 6 || japaneseHolidays(date.getFullYear()).has(formatDate(date));
}

function calculateRoomSubtotal(room: Room, guests: number, roomCount: number, nights: number, checkInDate: string) {
  if (room.perRoom || !room.priceGroup) return room.basePrice * roomCount * nights;
  const rates = LODGING_RATES[room.priceGroup];
  let subtotal = 0;

  for (let night = 0; night < nights; night += 1) {
    const stayDate = addDays(parseLocalDate(checkInDate), night);
    const rate = isPremiumDate(stayDate) ? rates.premium : rates.regular;
    let remainingGuests = guests;

    for (let roomIndex = 0; roomIndex < roomCount; roomIndex += 1) {
      const remainingRooms = roomCount - roomIndex - 1;
      const occupancy = Math.min(room.maxGuests, remainingGuests - remainingRooms);
      subtotal += occupancy === 1 ? rate.single : rate.shared * occupancy;
      remainingGuests -= occupancy;
    }
  }

  return subtotal;
}

function startingPrice(room: Room) {
  if (room.perRoom || !room.priceGroup) return room.basePrice;
  return LODGING_RATES[room.priceGroup].regular.shared;
}

function serviceCount(checkInDate: string, nights: number, service: "breakfast" | "dinner") {
  if (!checkInDate) return 0;
  const start = parseLocalDate(checkInDate);
  const firstOffset = service === "breakfast" ? 1 : 0;
  const lastOffset = service === "breakfast" ? nights : nights - 1;
  let available = 0;

  for (let offset = firstOffset; offset <= lastOffset; offset += 1) {
    const serviceDate = addDays(start, offset);
    if (!isUnavailableWeekday(serviceDate)) available += 1;
  }

  return available;
}

function mealLabel(wantsBreakfast: boolean, wantsDinner: boolean, breakfastCount: number, dinnerCount: number) {
  if (wantsBreakfast && wantsDinner) return `朝食${breakfastCount}回・夕食${dinnerCount}回`;
  if (wantsBreakfast) return `朝食${breakfastCount}回`;
  if (wantsDinner) return `夕食${dinnerCount}回`;
  return "食事なし";
}

export default function ReservationPage() {
  const initialDate = useMemo(() => todayString(), []);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [checkInDate, setCheckInDate] = useState(initialDate);
  const [nights, setNights] = useState(1);
  const [guests, setGuests] = useState(1);
  const [roomCount, setRoomCount] = useState(1);
  const [roomId, setRoomId] = useState(CONFIG.rooms[0].id);
  const [breakfast, setBreakfast] = useState(false);
  const [dinner, setDinner] = useState(false);
  const [message, setMessage] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [availability, setAvailability] = useState<AvailabilityState>({ state: "loading", rooms: {} });
  const [calendarMonth, setCalendarMonth] = useState(() => initialDate.slice(0, 7));
  const [calendarAvailability, setCalendarAvailability] = useState<CalendarState>({ state: "loading", days: {} });

  const selectedRoom = CONFIG.rooms.find((room) => room.id === roomId) ?? CONFIG.rooms[0];
  const boundedNights = clamp(nights || 1, 1, 14);
  const maxRooms = selectedRoom.perRoom ? 1 : 6;
  const boundedRoomCount = clamp(roomCount || 1, 1, maxRooms);
  const minGuests = selectedRoom.minGuests * boundedRoomCount;
  const maxGuests = selectedRoom.maxGuests * boundedRoomCount;
  const boundedGuests = clamp(guests || minGuests, minGuests, maxGuests);
  const checkoutDate = checkInDate ? formatDate(addDays(parseLocalDate(checkInDate), boundedNights)) : "";
  const breakfastServiceCount = serviceCount(checkInDate, boundedNights, "breakfast");
  const dinnerServiceCount = serviceCount(checkInDate, boundedNights, "dinner");
  const breakfastUnavailable = breakfastServiceCount === 0;
  const dinnerUnavailable = dinnerServiceCount === 0;
  const wantsBreakfast = breakfast && !breakfastUnavailable;
  const wantsDinner = dinner && !dinnerUnavailable;
  const roomSubtotal = calculateRoomSubtotal(selectedRoom, boundedGuests, boundedRoomCount, boundedNights, checkInDate);
  const lodgingDiscount = Math.round(roomSubtotal * (CONFIG.lodgingDiscountPercent / 100));
  const discountedRoomSubtotal = roomSubtotal - lodgingDiscount;
  const breakfastSubtotal = wantsBreakfast ? CONFIG.breakfastPricePerPerson * boundedGuests * breakfastServiceCount : 0;
  const dinnerSubtotal = wantsDinner ? CONFIG.dinnerPricePerPerson * boundedGuests * dinnerServiceCount : 0;
  const mealSubtotal = breakfastSubtotal + dinnerSubtotal;
  const preDiscountTotal = roomSubtotal + mealSubtotal;
  const total = discountedRoomSubtotal + mealSubtotal;
  const priceSummary = `${selectedRoom.name} / ${boundedNights}泊 / ${boundedRoomCount}部屋 / ${boundedGuests}名 / ${mealLabel(
    wantsBreakfast,
    wantsDinner,
    breakfastServiceCount,
    dinnerServiceCount
  )} / 宿代30%オフ ${yen.format(lodgingDiscount)}引き / 割引前合計 ${yen.format(preDiscountTotal)}`;
  const breakfastLabel = wantsBreakfast ? `あり（${breakfastServiceCount}回 / ${yen.format(breakfastSubtotal)}）` : "なし";
  const dinnerLabel = wantsDinner ? `あり（${dinnerServiceCount}回 / ${yen.format(dinnerSubtotal)}）` : "なし";
  const mealNotice = [
    breakfastUnavailable ? "朝食提供日が水曜日のため、朝食は選択できません。" : "",
    dinnerUnavailable ? "夕食提供日が水曜日のため、夕食は選択できません。" : "",
    wantsBreakfast && breakfastServiceCount < boundedNights ? `朝食は水曜日を除く${breakfastServiceCount}回分で計算します。` : "",
    wantsDinner && dinnerServiceCount < boundedNights ? `夕食は水曜日を除く${dinnerServiceCount}回分で計算します。` : ""
  ]
    .filter(Boolean)
    .join(" ");
  const selectedAvailability = availability.rooms[selectedRoom.id];
  const selectedRoomAvailable =
    availability.state === "ready" &&
    (selectedAvailability?.status === "available" || selectedAvailability?.status === "limited") &&
    selectedAvailability.availableCount >= boundedRoomCount;
  const selectedRoomFull =
    availability.state === "ready" &&
    selectedAvailability &&
    (selectedAvailability.status === "full" ||
      (selectedAvailability.status === "available" && selectedAvailability.availableCount < boundedRoomCount));
  const availabilityMessage =
    availability.state === "loading"
      ? "空室状況を確認しています。"
      : availability.state === "unavailable"
        ? "空室連携が未設定です。BONDS側で空室を確認します。"
        : availability.state === "error"
          ? "空室情報の取得に失敗しました。BONDS側で空室を確認します。"
          : selectedRoomAvailable
            ? ""
            : selectedRoomFull
              ? `選択した日程では${boundedRoomCount}部屋を確保できません。別の日程または部屋をお選びください。`
              : availability.missingDates?.length
                ? `予約カレンダーに対象日（${availability.missingDates.join("、")}）が見つからないため、BONDS側で確認します。`
                : "この日程はオンラインで空室を確認できないため、BONDS側で確認します。";
  const calendarDays = useMemo(() => {
    const [year, month] = calendarMonth.split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    return [
      ...Array.from({ length: firstDay.getDay() }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => formatDate(new Date(year, month - 1, index + 1)))
    ];
  }, [calendarMonth]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setAvailability((current) => ({ ...current, state: "loading" }));

      try {
        const params = new URLSearchParams({ checkInDate, nights: String(boundedNights) });
        const response = await fetch(`/api/availability?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store"
        });
        const result = await response.json();

        if (!response.ok) throw new Error(result.message || "空室状況を取得できませんでした。");
        setAvailability({
          state: result.configured === false ? "unavailable" : "ready",
          rooms: result.rooms || {},
          missingDates: result.missingDates || []
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setAvailability({ state: "error", rooms: {} });
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [checkInDate, boundedNights]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCalendarAvailability((current) => ({ ...current, state: "loading" }));

      try {
        const params = new URLSearchParams({
          month: calendarMonth,
          nights: String(boundedNights)
        });
        const response = await fetch(`/api/availability?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store"
        });
        const result = await response.json();
        if (!response.ok || result.configured === false) throw new Error(result.message || "空室カレンダーを取得できませんでした。");
        setCalendarAvailability({ state: "ready", days: result.days || {} });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCalendarAvailability({ state: "error", days: {} });
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [calendarMonth, boundedNights]);

  function chooseCheckInDate(date: string) {
    setCheckInDate(date);
    setCalendarMonth(date.slice(0, 7));
  }

  function selectRoom(nextRoomId: string, shouldScroll = true) {
    const nextRoom = CONFIG.rooms.find((room) => room.id === nextRoomId) ?? CONFIG.rooms[0];
    const nextRoomCount = nextRoom.perRoom ? 1 : boundedRoomCount;
    setRoomId(nextRoom.id);
    setRoomCount(nextRoomCount);
    setGuests(clamp(boundedGuests, nextRoom.minGuests * nextRoomCount, nextRoom.maxGuests * nextRoomCount));
    if (shouldScroll) document.querySelector("#request")?.scrollIntoView({ behavior: "smooth" });
  }

  function setSafeNights(value: number) {
    setNights(clamp(value || 1, 1, 14));
  }

  function setSafeRoomCount(value: number) {
    const nextRoomCount = clamp(value || 1, 1, maxRooms);
    setRoomCount(nextRoomCount);
    setGuests(clamp(boundedGuests, selectedRoom.minGuests * nextRoomCount, selectedRoom.maxGuests * nextRoomCount));
  }

  function setSafeGuests(value: number) {
    setGuests(clamp(value || minGuests, minGuests, maxGuests));
  }

  function buildMailBody() {
    return [
      "THE BONDS PSPO会員向け仮予約依頼",
      "",
      "※この依頼は予約確定ではありません。",
      "",
      `氏名: ${name}`,
      `メールアドレス: ${email}`,
      `電話番号: ${phone}`,
      `チェックイン日: ${checkInDate}`,
      `宿泊数: ${boundedNights}泊`,
      `チェックアウト予定日: ${checkoutDate}`,
      `人数: ${boundedGuests}名`,
      `部屋数: ${boundedRoomCount}部屋`,
      `部屋: ${selectedRoom.name}`,
      `宿代: ${yen.format(roomSubtotal)}`,
      `PSPO会員割引: 宿代30%オフ（-${yen.format(lodgingDiscount)}）`,
      `割引後宿代: ${yen.format(discountedRoomSubtotal)}`,
      `朝食: ${breakfastLabel}`,
      `夕食: ${dinnerLabel}`,
      `割引前合計: ${yen.format(preDiscountTotal)}`,
      `PSPO会員特別価格: ${yen.format(total)}`,
      "",
      "備考:",
      message || "なし",
      "",
      "BONDS側で空室、食事担当、料金条件をご確認のうえ返信をお願いします。"
    ].join("\n");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitState("sending");
    setSubmitMessage("");

    const payload = {
      name,
      email,
      phone,
      checkInDate,
      nights: boundedNights,
      checkoutDate,
      guests: boundedGuests,
      roomCount: boundedRoomCount,
      room: selectedRoom.name,
      breakfast: wantsBreakfast,
      dinner: wantsDinner,
      roomSubtotal,
      lodgingDiscount,
      discountedRoomSubtotal,
      breakfastSubtotal,
      dinnerSubtotal,
      breakfastServiceCount,
      dinnerServiceCount,
      breakfastLabel,
      dinnerLabel,
      preDiscountTotal,
      total,
      message
    };

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.message || "送信に失敗しました。");
      }

      if (result.emailSent || result.sheetSaved) {
        setSubmitState("sent");
        setSubmitMessage("仮予約依頼を送信しました。BONDS側からの返信をお待ちください。");
        return;
      }

      const subject = `【THE BONDS仮予約】${name}様 ${checkInDate}`;
      const mailto = `mailto:${CONFIG.emailTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
        buildMailBody()
      )}`;
      setSubmitState("fallback");
      setSubmitMessage("メール送信設定が未完了のため、メールソフトを開きます。");
      window.location.href = mailto;
    } catch (error) {
      setSubmitState("error");
      setSubmitMessage(error instanceof Error ? error.message : "送信に失敗しました。");
    }
  }

  return (
    <>
      <header className="site-header" aria-label="ページヘッダー">
        <a className="brand" href="#top" aria-label="THE BONDS">
          <span className="brand-mark">B</span>
          <span>
            <strong>THE BONDS</strong>
            <small>PSPO Member Stay</small>
          </span>
        </a>
        <nav className="nav-links" aria-label="主要ナビゲーション">
          <a href="#appeal">魅力</a>
          <a href="#food">料理</a>
          <a href="#rooms">お部屋</a>
          <a href="#request">仮予約</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-media" role="img" aria-label="THE BONDSの海辺の外観" />
          <div className="hero-copy">
            <p className="eyebrow">PSPO member special stay</p>
            <h1>THE BONDS</h1>
            <p className="lead">
              PSPO会員様だけが、中島の海辺にあるBONDSを特別価格で利用できます。
              予約確定ではなく、BONDS側で食事担当・空室状況を確認してからご案内します。
            </p>
            <div className="hero-actions">
              <a className="button primary" href="#request">
                仮予約へ進む
              </a>
              <a className="button secondary" href="#rooms">
                部屋を見る
              </a>
            </div>
          </div>
        </section>

        <section className="notice-band" aria-label="仮予約の流れ">
          <div>
            <span className="step">1</span>
            <strong>PSPO会員価格を確認</strong>
            <p>人数、部屋数、朝食・夕食の有無で料金を確認します。</p>
          </div>
          <div>
            <span className="step">2</span>
            <strong>仮予約を送信</strong>
            <p>フォーム内容はBONDS側へ送信されます。</p>
          </div>
          <div>
            <span className="step">3</span>
            <strong>やり取り後に確定</strong>
            <p>空室と食事担当の可否を確認後、正式予約になります。</p>
          </div>
        </section>

        <section className="section intro">
          <div>
            <p className="eyebrow">Island stay</p>
            <h2>PSPO会員だけに開く、海辺の島ステイ</h2>
          </div>
          <p>
            THE BONDSは愛媛・中島の姫ヶ浜ビーチそばにあるゲストハウスです。
            全室オーシャンビューの客室と、道後の名店監修の料理を組み合わせて、
            PSPO会員様向けの特別価格で滞在の仮予約を受け付けます。
          </p>
        </section>

        <section className="section appeal-section" id="appeal">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Why BONDS</p>
              <h2>絆を深める島滞在</h2>
            </div>
            <p>
              都会の喧騒や日常のノイズから少し離れて、大切な人との時間を取り戻す。BONDSは、ただ泊まるだけではない島の滞在です。
            </p>
          </div>
          <div className="appeal-grid">
            <article>
              <img src="https://the-bonds.jp/cms/wp-content/themes/the-bonds/assets/img/concept001.webp" alt="THE BONDSのコンセプト" />
              <div>
                <span>01</span>
                <h3>大切な人と向き合う</h3>
                <p>忙しい日常では流れてしまう会話も、島の静けさの中では自然とゆっくり交わせます。</p>
              </div>
            </article>
            <article>
              <img src="https://the-bonds.jp/cms/wp-content/themes/the-bonds/assets/img/concept003.webp" alt="中島の砂浜" />
              <div>
                <span>02</span>
                <h3>海まで0秒のロケーション</h3>
                <p>目の前に広がる海と砂浜。スマホを置いて、空と海と潮風だけを味わう贅沢があります。</p>
              </div>
            </article>
            <article>
              <img src="https://the-bonds.jp/cms/wp-content/themes/the-bonds/assets/img/concept005.webp" alt="島のごちそう" />
              <div>
                <span>03</span>
                <h3>何もしない時間を楽しむ</h3>
                <p>写真を撮ったあとは、予定を詰め込まず景色に身を任せる。気取らない上質さが魅力です。</p>
              </div>
            </article>
            <article>
              <img src="https://the-bonds.jp/cms/wp-content/themes/the-bonds/assets/img/concept004.webp" alt="中島の夕日と海" />
              <div>
                <span>04</span>
                <h3>笑顔をつくる島のごちそう</h3>
                <p>本格的な料理を、ゲストハウスらしいカジュアルな距離感で。滞在の記憶に残る時間になります。</p>
              </div>
            </article>
          </div>
        </section>

        <section className="section food-section" id="food">
          <div className="food-media">
            <img src="https://the-bonds.jp/cms/wp-content/themes/the-bonds/assets/img/top-img-restaurants01.webp" alt="THE BONDSの料理" />
            <img src="https://the-bonds.jp/cms/wp-content/themes/the-bonds/assets/img/top-img-restaurants02.webp" alt="THE BONDSのレストラン料理" />
          </div>
          <div className="food-copy">
            <p className="eyebrow">Restaurant</p>
            <h2>島の滞在を特別にする料理</h2>
            <p>
              BONDSでは、松山道後の人気店監修の料理を楽しめます。
              朝食と夕食をそれぞれ選ぶと、食事料金が自動で加算されます。
            </p>
            <dl className="food-facts">
              <div>
                <dt>朝食</dt>
                <dd>{yen.format(CONFIG.breakfastPricePerPerson)}/名</dd>
              </div>
              <div>
                <dt>夕食</dt>
                <dd>{yen.format(CONFIG.dinnerPricePerPerson)}/名</dd>
              </div>
              <div>
                <dt>水曜日</dt>
                <dd>水曜提供分は受付なし</dd>
              </div>
              <div>
                <dt>予約</dt>
                <dd>食事担当確認後に確定</dd>
              </div>
            </dl>
            <a className="button primary" href="#request">
              食事付きで料金を見る
            </a>
          </div>
        </section>

        <section className="section" id="rooms">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Guest rooms</p>
              <h2>お部屋を選ぶ</h2>
            </div>
            <p>通常宿泊料は利用人数と宿泊日で変わります。土曜・日曜・祝日は土曜料金、宿代はPSPO会員価格として30%オフです。</p>
          </div>
          <div className="room-grid" aria-live="polite">
            {CONFIG.rooms.map((room) => (
              <article className={`room-card ${room.id === selectedRoom.id ? "selected" : ""}`} key={room.id}>
                <img className="room-image" src={room.image} alt={room.name} loading="lazy" />
                <div className="room-body">
                  <div className="room-meta">
                    <span>{room.size}</span>
                    <span>{room.capacity}</span>
                  </div>
                  <h3>{room.name}</h3>
                  <p>{room.description}</p>
                  <div className="room-price">
                    <small>{room.perRoom ? "1棟税込" : "通常料金・1名1泊〜"}</small>
                    <strong>{yen.format(startingPrice(room))}</strong>
                  </div>
                  <button className="button select-room" type="button" onClick={() => selectRoom(room.id)}>
                    この部屋を選ぶ
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="reservation-section" id="request">
          <div className="reservation-copy">
            <p className="eyebrow">Temporary request</p>
            <h2>仮予約フォーム</h2>
            <p>内容確認後、BONDS側からメールまたは電話でご連絡します。</p>
            <div className="price-box desktop-price" aria-live="polite">
              <span>PSPO会員特別価格</span>
              <strong>{yen.format(total)}</strong>
              <small>{priceSummary}</small>
              <button
                className="button price-jump"
                type="button"
                onClick={() => document.querySelector("#reservationForm")?.scrollIntoView({ behavior: "smooth" })}
              >
                この内容で仮予約へ
              </button>
            </div>
          </div>

          <form className="request-form" id="reservationForm" onSubmit={handleSubmit}>
            <div className="form-row">
              <label htmlFor="name">氏名</label>
              <input id="name" name="name" type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
            <div className="form-row compact contact-grid">
              <div>
                <label htmlFor="email">メールアドレス</label>
                <input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
              <div>
                <label htmlFor="phone">電話番号</label>
                <input id="phone" name="phone" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required />
              </div>
            </div>
            <div className="form-row compact stay-grid">
              <div>
                <label htmlFor="date">チェックイン日</label>
                <input id="date" name="date" type="date" min={initialDate} value={checkInDate} onChange={(event) => chooseCheckInDate(event.target.value)} required />
              </div>
              <div>
                <label htmlFor="nights">宿泊数</label>
                <input id="nights" name="nights" type="number" min="1" max="14" value={boundedNights} onChange={(event) => setSafeNights(Number(event.target.value))} required />
              </div>
            </div>
            <p className="checkout-note">チェックアウト予定日: {checkoutDate}</p>
            <section className="availability-calendar" aria-label="空室カレンダー" aria-busy={calendarAvailability.state === "loading"}>
              <div className="calendar-header">
                <button type="button" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, -1))} aria-label="前の月">
                  ‹
                </button>
                <strong>{calendarMonth.replace("-", "年")}月</strong>
                <button type="button" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, 1))} aria-label="次の月">
                  ›
                </button>
              </div>
              <p className="calendar-room-name">{boundedNights}泊で利用できる日</p>
              {calendarAvailability.state === "loading" && (
                <div className="calendar-loading" role="status"><span />空室を読み込み中</div>
              )}
              <div className="calendar-weekdays" aria-hidden="true">
                {['日', '月', '火', '水', '木', '金', '土'].map((day) => <span key={day}>{day}</span>)}
              </div>
              <div className={`calendar-grid ${calendarAvailability.state === "loading" ? "loading" : ""}`}>
                {calendarDays.map((date, index) => {
                  if (!date) return <span className="calendar-empty" key={`empty-${index}`} />;
                  const status = calendarAvailability.days[date] || "unknown";
                  const isPast = date < initialDate;
                  const selectable = !isPast && status !== "full";
                  const mark = status === "available" ? "○" : status === "limited" ? "△" : status === "full" ? "×" : "―";
                  return (
                    <button
                      type="button"
                      className={`${status} ${date === checkInDate ? "selected" : ""}`}
                      key={date}
                      disabled={!selectable}
                      onClick={() => chooseCheckInDate(date)}
                      aria-label={`${date} ${status === "available" ? "空室あり" : status === "limited" ? "空室わずか" : status === "full" ? "満室" : "要確認"}`}
                    >
                      <span>{Number(date.slice(-2))}</span>
                      <strong>{isPast ? "" : mark}</strong>
                    </button>
                  );
                })}
              </div>
              <div className="calendar-legend">
                <span>○ 空室あり</span><span>△ 空室わずか</span><span>× 満室</span><span>― 要確認</span>
              </div>
              {calendarAvailability.state === "error" && <p className="calendar-error">空室カレンダーを取得できませんでした。</p>}
            </section>
            <div className="form-row">
              <span className="field-label">利用する部屋</span>
              <div className="room-choice-list" role="radiogroup" aria-label="利用する部屋">
                {CONFIG.rooms.map((room) => {
                  const roomAvailability = availability.rooms[room.id];
                  const roomFull =
                    availability.state === "ready" &&
                    Boolean(roomAvailability) &&
                    (roomAvailability.status === "full" || roomAvailability.availableCount < boundedRoomCount);
                  const availabilityLabel =
                    availability.state !== "ready" || !roomAvailability || roomAvailability.status === "unknown"
                      ? "要確認"
                      : roomAvailability.status === "limited" ? "空室わずか" : roomAvailability.availableCount > 0 ? "空室あり" : "満室";
                  return (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={room.id === selectedRoom.id}
                      className={room.id === selectedRoom.id ? "selected" : ""}
                      disabled={roomFull}
                      onClick={() => selectRoom(room.id, false)}
                      key={room.id}
                    >
                      <span><strong>{room.name}</strong><small>{room.capacity}</small></span>
                      <em className={roomFull ? "full" : roomAvailability?.status === "limited" ? "limited" : ""}>{availabilityLabel}</em>
                    </button>
                  );
                })}
              </div>
              {availabilityMessage && (
                <p
                  className={`availability-status ${availability.state === "loading" ? "loading" : selectedRoomFull ? "full" : "unknown"}`}
                  role="status"
                >
                  {availabilityMessage}
                </p>
              )}
            </div>
            <div className="form-row compact guest-room-grid">
              <div>
                <label htmlFor="guests">人数</label>
                <input id="guests" name="guests" type="number" min={minGuests} max={maxGuests} value={boundedGuests} onChange={(event) => setSafeGuests(Number(event.target.value))} required />
              </div>
              <div>
                <label htmlFor="roomCount">部屋数</label>
                <input id="roomCount" name="roomCount" type="number" min="1" max={maxRooms} value={boundedRoomCount} onChange={(event) => setSafeRoomCount(Number(event.target.value))} required />
              </div>
            </div>
            <fieldset className="choice-group">
              <legend>食事の有無</legend>
              <label className={breakfastUnavailable ? "disabled" : ""}>
                <input
                  type="checkbox"
                  name="breakfast"
                  checked={wantsBreakfast}
                  disabled={breakfastUnavailable}
                  onChange={(event) => setBreakfast(event.target.checked)}
                />
                <span>朝食あり{breakfastServiceCount > 0 ? `（${breakfastServiceCount}回）` : ""}</span>
              </label>
              <label className={dinnerUnavailable ? "disabled" : ""}>
                <input
                  type="checkbox"
                  name="dinner"
                  checked={wantsDinner}
                  disabled={dinnerUnavailable}
                  onChange={(event) => setDinner(event.target.checked)}
                />
                <span>夕食あり{dinnerServiceCount > 0 ? `（${dinnerServiceCount}回）` : ""}</span>
              </label>
            </fieldset>
            <div className="price-box mobile-price" aria-live="polite">
              <span>PSPO会員特別価格</span>
              <strong>{yen.format(total)}</strong>
              <small>{priceSummary}</small>
            </div>
            <div className="form-row">
              <label htmlFor="message">備考</label>
              <textarea
                id="message"
                name="message"
                rows={4}
                placeholder="到着予定、アレルギー、候補日など"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
            </div>
            <p className={`form-alert ${submitState === "sent" ? "success" : ""}`} role="status">
              {mealNotice || submitMessage}
            </p>
            <button className="button primary submit-button" type="submit" disabled={submitState === "sending" || Boolean(selectedRoomFull)}>
              {submitState === "sending" ? "送信中" : "仮予約を送信"}
            </button>
            <p className="sub-note">この送信は予約確定ではありません。食事担当の有無、空室、料金条件を確認後に確定します。</p>
          </form>
        </section>
      </main>

      <footer className="footer">
        <strong>ALBERGO RESORT THE BONDS</strong>
        <span>〒791-4503 愛媛県松山市長師55</span>
        <span>TEL: 070-2294-6159</span>
      </footer>
      <div className="mobile-price-bar" aria-live="polite">
        <div>
          <span>PSPO会員特別価格</span>
          <strong>{yen.format(total)}</strong>
        </div>
        <button
          type="button"
          onClick={() => document.querySelector("#reservationForm")?.scrollIntoView({ behavior: "smooth" })}
        >
          仮予約へ
        </button>
      </div>
    </>
  );
}
