const CONFIG = {
  emailTo: "tamura_n@3puku.co.jp",
  lodgingDiscountPercent: 30,
  breakfastName: "朝食",
  breakfastPricePerPerson: 1650,
  dinnerName: "夕食コース",
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
      image: "https://the-bonds.jp/cms/wp-content/themes/the-bonds/assets/img/room-japanese01.webp",
      description: "布団をセルフで敷く、気軽に使える和室タイプ。"
    },
    {
      id: "four-bed",
      name: "4ベッドルーム",
      size: "16平米",
      capacity: "2から4名",
      minGuests: 2,
      maxGuests: 4,
      basePrice: 5500,
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
      description: "リビング、和室2部屋、キッチンを備えた大人数向けの別邸。料金は1棟単位の仮設定です。",
      perRoom: true
    }
  ],
  mockAvailability: {
    "2026-09-16": { status: "closed", text: "食事なしのみ確認可" },
    "2026-09-17": { status: "open", text: "仮受付可" },
    "2026-09-18": { status: "limited", text: "残り少なめ" },
    "2026-09-19": { status: "limited", text: "週末確認推奨" },
    "2026-09-20": { status: "closed", text: "満室見込み" },
    "2026-09-22": { status: "open", text: "仮受付可" },
    "2026-09-23": { status: "closed", text: "食事なしのみ確認可" }
  }
};

const roomGrid = document.querySelector("#roomGrid");
const roomSelect = document.querySelector("#room");
const requestForm = document.querySelector("#requestForm");
const totalPrice = document.querySelector("#totalPrice");
const priceDetail = document.querySelector("#priceDetail");
const dateInput = document.querySelector("#date");
const nightsInput = document.querySelector("#nights");
const guestsInput = document.querySelector("#guests");
const roomCountInput = document.querySelector("#roomCount");
const checkoutPreview = document.querySelector("#checkoutPreview");
const formAlert = document.querySelector("#formAlert");
const availabilityList = document.querySelector("#availabilityList");
const resetDate = document.querySelector("#resetDate");
const jumpToForm = document.querySelector("#jumpToForm");

const yen = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0
});

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short"
  }).format(date);
}

function parseLocalDate(dateString) {
  return new Date(`${dateString}T00:00:00`);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function todayString() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return formatDate(now);
}

function getSelectedRoom() {
  return CONFIG.rooms.find((room) => room.id === roomSelect.value) || CONFIG.rooms[0];
}

function isMealUnavailable(dateString) {
  if (!dateString) return false;
  const date = parseLocalDate(dateString);
  return CONFIG.mealUnavailableWeekdays.includes(date.getDay());
}

function isMealUnavailableForStay(dateString) {
  if (!dateString) return false;
  const start = parseLocalDate(dateString);
  const nights = getNights();

  for (let offset = 0; offset <= nights; offset += 1) {
    const serviceDate = addDays(start, offset);
    if (CONFIG.mealUnavailableWeekdays.includes(serviceDate.getDay())) {
      return true;
    }
  }

  return false;
}

function getNights() {
  const rawNights = Number(nightsInput.value || 1);
  return Math.min(Math.max(rawNights, 1), 14);
}

function checkoutDateString() {
  if (!dateInput.value) return "";
  return formatDate(addDays(parseLocalDate(dateInput.value), getNights()));
}

function selectedMeals() {
  return {
    breakfast: requestForm.querySelector('input[name="breakfast"]').checked,
    dinner: requestForm.querySelector('input[name="dinner"]').checked
  };
}

function mealLabel({ wantsBreakfast, wantsDinner }) {
  if (wantsBreakfast && wantsDinner) return "朝食あり・夕食あり";
  if (wantsBreakfast) return "朝食あり";
  if (wantsDinner) return "夕食あり";
  return "食事なし";
}

function getRoomCount() {
  const room = getSelectedRoom();
  const maxRooms = room.perRoom ? 1 : 6;
  const rawRoomCount = Number(roomCountInput.value || 1);
  return Math.min(Math.max(rawRoomCount, 1), maxRooms);
}

function calculateTotal() {
  const room = getSelectedRoom();
  const nights = getNights();
  const roomCount = getRoomCount();
  const minGuests = room.minGuests * roomCount;
  const maxGuests = room.maxGuests * roomCount;
  const rawGuests = Number(guestsInput.value || minGuests);
  const guests = Math.min(Math.max(rawGuests, minGuests), maxGuests);
  const meals = selectedMeals();
  const mealsUnavailable = isMealUnavailableForStay(dateInput.value);
  const wantsBreakfast = meals.breakfast && !mealsUnavailable;
  const wantsDinner = meals.dinner && !mealsUnavailable;
  const roomSubtotal = (room.perRoom ? room.basePrice * roomCount : room.basePrice * guests) * nights;
  const lodgingDiscount = Math.round(roomSubtotal * (CONFIG.lodgingDiscountPercent / 100));
  const discountedRoomSubtotal = roomSubtotal - lodgingDiscount;
  const breakfastSubtotal = wantsBreakfast ? CONFIG.breakfastPricePerPerson * guests * nights : 0;
  const dinnerSubtotal = wantsDinner ? CONFIG.dinnerPricePerPerson * guests * nights : 0;
  const mealSubtotal = breakfastSubtotal + dinnerSubtotal;
  const subtotal = roomSubtotal + mealSubtotal;
  const discounted = discountedRoomSubtotal + mealSubtotal;
  return {
    room,
    guests,
    nights,
    roomCount,
    wantsBreakfast,
    wantsDinner,
    roomSubtotal,
    lodgingDiscount,
    discountedRoomSubtotal,
    breakfastSubtotal,
    dinnerSubtotal,
    subtotal,
    discounted
  };
}

function updateGuestBounds() {
  const room = getSelectedRoom();
  nightsInput.value = String(getNights());
  const maxRooms = room.perRoom ? 1 : 6;
  const roomCount = getRoomCount();
  roomCountInput.max = String(maxRooms);
  roomCountInput.value = String(roomCount);

  const minGuests = room.minGuests * roomCount;
  const maxGuests = room.maxGuests * roomCount;
  guestsInput.min = String(minGuests);
  guestsInput.max = String(maxGuests);

  const guests = Number(guestsInput.value || minGuests);
  if (guests < minGuests) guestsInput.value = String(minGuests);
  if (guests > maxGuests) guestsInput.value = String(maxGuests);
}

function updateMealState() {
  const mealInputs = requestForm.querySelectorAll('input[name="breakfast"], input[name="dinner"]');
  const unavailable = isMealUnavailableForStay(dateInput.value);

  mealInputs.forEach((input) => {
    input.disabled = unavailable;
    input.closest("label").classList.toggle("disabled", unavailable);
    if (unavailable) input.checked = false;
  });

  formAlert.textContent = unavailable
    ? "宿泊期間に水曜日が含まれるため、食事なしのみ選択できます。"
    : "";
}

function updatePrice() {
  updateGuestBounds();
  updateMealState();
  const { room, guests, nights, roomCount, wantsBreakfast, wantsDinner, subtotal, lodgingDiscount, discounted } = calculateTotal();
  totalPrice.textContent = yen.format(discounted);
  checkoutPreview.textContent = checkoutDateString()
    ? `チェックアウト予定日: ${checkoutDateString()}`
    : "チェックアウト予定日を自動表示します";
  priceDetail.textContent = `${room.name} / ${nights}泊 / ${roomCount}部屋 / ${guests}名 / ${mealLabel({ wantsBreakfast, wantsDinner })} / 宿代30%オフ ${yen.format(lodgingDiscount)}引き / 割引前合計 ${yen.format(subtotal)}`;
  document.querySelectorAll(".room-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.roomId === room.id);
  });
}

function renderRooms() {
  roomGrid.innerHTML = CONFIG.rooms.map((room) => {
    const priceLabel = room.perRoom ? "1棟税込" : "1名税込";
    return `
      <article class="room-card" data-room-id="${room.id}">
        <img class="room-image" src="${room.image}" alt="${room.name}" loading="lazy">
        <div class="room-body">
          <div class="room-meta">
            <span>${room.size}</span>
            <span>${room.capacity}</span>
          </div>
          <h3>${room.name}</h3>
          <p>${room.description}</p>
          <div class="room-price">
            <small>${priceLabel}</small>
            <strong>${yen.format(room.basePrice)}</strong>
          </div>
          <button class="button select-room" type="button" data-select-room="${room.id}">この部屋を選ぶ</button>
        </div>
      </article>
    `;
  }).join("");

  roomSelect.innerHTML = CONFIG.rooms.map((room) => (
    `<option value="${room.id}">${room.name}</option>`
  )).join("");

  roomGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-select-room]");
    if (!button) return;
    roomSelect.value = button.dataset.selectRoom;
    updatePrice();
    document.querySelector("#request").scrollIntoView({ behavior: "smooth" });
  });
}

function renderAvailability() {
  const start = new Date(`${dateInput.min}T00:00:00`);
  const rows = [];

  for (let index = 0; index < 14; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = formatDate(date);
    const mealClosed = CONFIG.mealUnavailableWeekdays.includes(date.getDay());
    const mock = CONFIG.mockAvailability[key] || { status: "open", text: "仮受付可" };
    const status = mealClosed
      ? { status: "closed", text: "水曜のため食事なし" }
      : mock;

    rows.push(`
      <div class="date-row">
        <strong>${formatDisplayDate(date)}</strong>
        <span class="status ${status.status}">${status.text}</span>
        <button type="button" data-date="${key}">選択</button>
      </div>
    `);
  }

  availabilityList.innerHTML = rows.join("");
}

function buildMailBody() {
  const form = new FormData(requestForm);
  const {
    room,
    guests,
    nights,
    roomCount,
    wantsBreakfast,
    wantsDinner,
    roomSubtotal,
    lodgingDiscount,
    discountedRoomSubtotal,
    breakfastSubtotal,
    dinnerSubtotal,
    subtotal,
    discounted
  } = calculateTotal();
  const availability = CONFIG.mockAvailability[form.get("date")]?.text || "仮受付可";

  return [
    "THE BONDS 会員向け仮予約依頼",
    "",
    "※この依頼は予約確定ではありません。",
    "",
    `氏名: ${form.get("name")}`,
    `メールアドレス: ${form.get("email")}`,
    `チェックイン日: ${form.get("date")}`,
    `宿泊数: ${nights}泊`,
    `チェックアウト予定日: ${checkoutDateString()}`,
    `人数: ${guests}名`,
    `部屋数: ${roomCount}部屋`,
    `部屋: ${room.name}`,
    `宿代: ${yen.format(roomSubtotal)}`,
    `PSPO会員割引: 宿代30%オフ（-${yen.format(lodgingDiscount)}）`,
    `割引後宿代: ${yen.format(discountedRoomSubtotal)}`,
    `朝食: ${wantsBreakfast ? `あり（${yen.format(breakfastSubtotal)}）` : "なし"}`,
    `夕食: ${wantsDinner ? `あり（${yen.format(dinnerSubtotal)}）` : "なし"}`,
    `表示空き状況: ${availability}`,
    `会員割引特別価格: ${yen.format(discounted)}`,
    `割引前合計: ${yen.format(subtotal)}`,
    "",
    "備考:",
    form.get("message") || "なし",
    "",
    "BONDS側で空室、食事担当、料金条件をご確認のうえ返信をお願いします。"
  ].join("\n");
}

function handleSubmit(event) {
  event.preventDefault();
  updateMealState();

  if (!requestForm.reportValidity()) return;

  const form = new FormData(requestForm);
  const subject = `【THE BONDS仮予約】${form.get("name")}様 ${form.get("date")}`;
  const body = buildMailBody();
  const mailto = `mailto:${CONFIG.emailTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  localStorage.setItem("bonds-last-request", body);
  window.location.href = mailto;
}

function init() {
  const min = todayString();
  dateInput.min = min;
  dateInput.value = min;
  renderRooms();
  renderAvailability();
  updatePrice();

  requestForm.addEventListener("input", updatePrice);
  requestForm.addEventListener("change", updatePrice);
  requestForm.addEventListener("submit", handleSubmit);

  jumpToForm.addEventListener("click", () => {
    requestForm.scrollIntoView({ behavior: "smooth", block: "start" });
    roomSelect.focus({ preventScroll: true });
  });

  availabilityList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-date]");
    if (!button) return;
    dateInput.value = button.dataset.date;
    updatePrice();
    document.querySelector("#request").scrollIntoView({ behavior: "smooth" });
  });

  resetDate.addEventListener("click", () => {
    dateInput.value = dateInput.min;
    renderAvailability();
    updatePrice();
  });
}

init();
