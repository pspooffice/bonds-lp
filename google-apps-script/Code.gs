const SECRET = PropertiesService.getScriptProperties().getProperty("SECRET") || "";
const NOTIFICATION_EMAIL = PropertiesService.getScriptProperties().getProperty("NOTIFICATION_EMAIL") || "";
const SEND_CUSTOMER_COPY = PropertiesService.getScriptProperties().getProperty("SEND_CUSTOMER_COPY") !== "false";
const RESERVATION_SHEET_NAME = "BONDS仮予約";
const CALENDAR_SHEET_NAME = "予約カレンダー";
const SOURCE_SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty("SOURCE_SPREADSHEET_ID") || "1XFQKr20Ly31H2S2sZDTToi94xMBXRXt47xlizQNBMu0";
const AVAILABILITY_CACHE_SECONDS = 180;
const RESERVATION_STATUSES = ["未対応", "会員へ連絡済み", "予約確定", "キャンセル"];

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};

    if (SECRET && params.secret !== SECRET) {
      return jsonResponse({ ok: false, message: "Invalid secret." });
    }

    if (params.action === "calendar") {
      return jsonResponse(getCalendarAvailability(
        params.month,
        Number(params.nights || 1),
        params.roomType,
        Number(params.roomCount || 1)
      ));
    }

    if (params.action !== "availability") {
      return jsonResponse({ ok: true, message: "BONDS reservation sheet endpoint is running." });
    }

    return jsonResponse(getAvailability(params.checkInDate, Number(params.nights || 1)));
  } catch (error) {
    return jsonResponse({ ok: false, message: error.message || "Failed to read availability." });
  }
}

function getCalendarAvailability(month, nights, roomType, roomCount) {
  if (!/^\d{4}-\d{2}$/.test(month || "")) throw new Error("Invalid month.");
  const roomTypes = ["twin", "double", "japanese", "four-bed", "deluxe-twin", "ocean-suite", "bonds-2"];
  if (roomType && roomTypes.indexOf(roomType) === -1) throw new Error("Invalid room type.");

  nights = Math.max(1, Math.min(14, nights || 1));
  roomCount = Math.max(1, Math.min(6, roomCount || 1));
  const parts = month.split("-").map(Number);
  const firstDay = new Date(parts[0], parts[1] - 1, 1);
  const lastDay = new Date(parts[0], parts[1], 0);
  const monthDates = [];
  const datesToRead = [];

  for (let day = 1; day <= lastDay.getDate() + nights - 1; day += 1) {
    const date = new Date(firstDay.getFullYear(), firstDay.getMonth(), day);
    const dateKey = formatIsoDate(date);
    datesToRead.push(dateKey);
    if (day <= lastDay.getDate()) monthDates.push(dateKey);
  }

  const parsed = readCalendarOccupancy(datesToRead, firstDay.getFullYear());
  const days = {};

  monthDates.forEach(function(startDateKey) {
    const start = parseIsoDate(startDateKey);
    const stayDates = [];
    for (let offset = 0; offset < nights; offset += 1) {
      const date = new Date(start.getTime());
      date.setDate(start.getDate() + offset);
      stayDates.push(formatIsoDate(date));
    }

    const complete = stayDates.every(function(date) { return parsed.knownDates[date]; });
    const includesClosedNight = stayDates.some(function(date) { return parseIsoDate(date).getDay() === 3; });
    const typesToCheck = roomType ? [roomType] : roomTypes;
    let hasKnownRoom = false;
    let totalAvailableRooms = 0;
    typesToCheck.forEach(function(type) {
      const physicalRooms = parsed.occupancy[type] || {};
      if (Object.keys(physicalRooms).length > 0) hasKnownRoom = true;
      totalAvailableRooms += Object.keys(physicalRooms).filter(function(roomId) {
        return stayDates.every(function(date) {
          return Object.prototype.hasOwnProperty.call(physicalRooms[roomId], date) && !physicalRooms[roomId][date];
        });
      }).length;
    });

    days[startDateKey] = includesClosedNight
      ? "full"
      : !complete || !hasKnownRoom
      ? "unknown"
      : totalAvailableRooms < roomCount ? "full" : "available";
  });

  return { ok: true, month: month, nights: nights, roomType: roomType, days: days };
}

function readCalendarOccupancy(requestedDates, requestedYear) {
  const cache = CacheService.getScriptCache();
  const cacheKey = "bonds-calendar-occupancy-v1";
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const source = SpreadsheetApp.openById(SOURCE_SPREADSHEET_ID);
  const sheet = source.getSheetByName(CALENDAR_SHEET_NAME);
  if (!sheet) throw new Error("BONDS側の予約カレンダータブが見つかりません。");

  const range = sheet.getDataRange();
  const values = range.getValues();
  const displayValues = range.getDisplayValues();
  const occupancy = {};
  const knownDates = {};

  for (let row = 0; row < values.length; row += 1) {
    if (String(displayValues[row][1] || "").trim() !== "客室") continue;
    const dateColumns = {};

    for (let column = 2; column < values[row].length; column += 1) {
      const dateKey = calendarDateKey(values[row][column], displayValues[row][column], requestedYear);
      if (dateKey) {
        dateColumns[column] = dateKey;
        knownDates[dateKey] = true;
      }
    }

    if (Object.keys(dateColumns).length === 0) continue;
    for (let roomRow = row + 1; roomRow < values.length; roomRow += 1) {
      const label = String(displayValues[roomRow][1] || "").trim();
      if (!label || label === "客室" || label === "予約者数") break;
      const type = roomTypeFromLabel(label);
      if (!type) continue;
      const roomNumber = String(displayValues[roomRow][0] || label).trim();
      const physicalRoomId = roomNumber + ":" + label;
      occupancy[type] = occupancy[type] || {};
      occupancy[type][physicalRoomId] = occupancy[type][physicalRoomId] || {};

      Object.keys(dateColumns).forEach(function(columnText) {
        const column = Number(columnText);
        occupancy[type][physicalRoomId][dateColumns[column]] = String(displayValues[roomRow][column] || "").trim() !== "";
      });
    }
  }

  const parsed = {
    occupancy: occupancy,
    knownDates: knownDates,
    updatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ssXXX")
  };
  cache.put(cacheKey, JSON.stringify(parsed), AVAILABILITY_CACHE_SECONDS);
  return parsed;
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");

    if (SECRET && payload.secret !== SECRET) {
      return jsonResponse({
        ok: false,
        message: "Invalid secret."
      });
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RESERVATION_SHEET_NAME);
    if (!sheet) throw new Error("BONDS仮予約タブが見つかりません。");
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    let appendedRow = 0;
    try {
      sheet.appendRow([
        Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss"),
        payload.status || "未対応",
        payload.name || "",
        payload.email || "",
        payload.phone || "",
        payload.checkInDate || "",
        payload.nights || "",
        payload.checkoutDate || "",
        payload.guests || "",
        payload.roomCount || "",
        payload.room || "",
        payload.breakfastLabel || (payload.breakfast ? "あり" : "なし"),
        payload.dinnerLabel || (payload.dinner ? "あり" : "なし"),
        payload.roomSubtotal || 0,
        payload.lodgingDiscount || 0,
        payload.discountedRoomSubtotal || 0,
        payload.breakfastSubtotal || 0,
        payload.dinnerSubtotal || 0,
        payload.preDiscountTotal || 0,
        payload.total || 0,
        payload.message || ""
      ]);
      appendedRow = sheet.getLastRow();
      sheet.getRange(appendedRow, 2).setDataValidation(createStatusValidation());
    } finally {
      lock.releaseLock();
    }

    let emailSent = false;
    let emailError = "";
    try {
      emailSent = sendReservationEmails(payload);
    } catch (error) {
      emailError = error.message || "Failed to send email.";
      console.error(emailError);
    }

    return jsonResponse({
      ok: true,
      saved: true,
      emailSent: emailSent,
      emailError: emailError,
      message: emailSent ? "Saved and emailed." : "Saved."
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      message: error.message || "Failed to save."
    });
  }
}

function createStatusValidation() {
  return SpreadsheetApp.newDataValidation()
    .requireValueInList(RESERVATION_STATUSES, true)
    .setAllowInvalid(false)
    .setHelpText("対応状況を選択してください。")
    .build();
}

function setupReservationSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RESERVATION_SHEET_NAME);
  if (!sheet) throw new Error("BONDS仮予約タブが見つかりません。");
  const rows = Math.max(sheet.getMaxRows() - 1, 1);
  sheet.getRange(2, 2, rows, 1).setDataValidation(createStatusValidation());
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);
}

function authorizeMail() {
  return MailApp.getRemainingDailyQuota();
}

function refreshAvailabilityCache() {
  CacheService.getScriptCache().remove("bonds-calendar-occupancy-v1");
  return readCalendarOccupancy([], 2026).updatedAt;
}

function sendReservationEmails(payload) {
  if (!NOTIFICATION_EMAIL) return false;

  const body = reservationMailBody(payload);
  const subject = "【THE BONDS仮予約】" + (payload.name || "お客様") + "様 " + (payload.checkInDate || "");
  MailApp.sendEmail({
    to: NOTIFICATION_EMAIL,
    subject: subject,
    body: body,
    name: "THE BONDS PSPO仮予約"
  });

  if (SEND_CUSTOMER_COPY && payload.email) {
    MailApp.sendEmail({
      to: payload.email,
      subject: "【受付完了】THE BONDS仮予約 " + (payload.checkInDate || ""),
      body: body + "\n\nこのメールは仮予約の受付控えです。予約はまだ確定していません。後ほどBONDS担当者からご連絡します。",
      name: "THE BONDS PSPO仮予約"
    });
  }

  return true;
}

function reservationMailBody(payload) {
  return [
    "THE BONDS PSPO会員向け仮予約依頼",
    "",
    "※この依頼は予約確定ではありません。",
    "",
    "氏名: " + (payload.name || ""),
    "メールアドレス: " + (payload.email || ""),
    "電話番号: " + (payload.phone || ""),
    "チェックイン日: " + (payload.checkInDate || ""),
    "宿泊数: " + (payload.nights || "") + "泊",
    "チェックアウト予定日: " + (payload.checkoutDate || ""),
    "人数: " + (payload.guests || "") + "名",
    "部屋数: " + (payload.roomCount || "") + "部屋",
    "部屋: " + (payload.room || ""),
    "朝食: " + (payload.breakfastLabel || "なし"),
    "夕食: " + (payload.dinnerLabel || "なし"),
    "宿代: " + formatYen(payload.roomSubtotal),
    "PSPO会員割引: 宿代30%オフ（-" + formatYen(payload.lodgingDiscount) + "）",
    "割引後宿代: " + formatYen(payload.discountedRoomSubtotal),
    "PSPO会員特別価格: " + formatYen(payload.total),
    "",
    "備考:",
    payload.message || "なし"
  ].join("\n");
}

function formatYen(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString("ja-JP") + "円";
}

function getAvailability(checkInDate, nights) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkInDate || "")) {
    throw new Error("Invalid check-in date.");
  }

  nights = Math.max(1, Math.min(14, nights || 1));
  const requestedDates = [];
  const start = parseIsoDate(checkInDate);

  for (let offset = 0; offset < nights; offset += 1) {
    const date = new Date(start.getTime());
    date.setDate(start.getDate() + offset);
    requestedDates.push(formatIsoDate(date));
  }

  const parsed = readCalendarOccupancy(requestedDates, start.getFullYear());
  const occupancy = parsed.occupancy;
  const knownDates = parsed.knownDates;

  const roomTypes = ["twin", "double", "japanese", "four-bed", "deluxe-twin", "ocean-suite", "bonds-2"];
  const calendarComplete = requestedDates.every(function(date) { return knownDates[date]; });
  const includesClosedNight = requestedDates.some(function(date) { return parseIsoDate(date).getDay() === 3; });
  const rooms = {};

  roomTypes.forEach(function(roomType) {
    const physicalRooms = occupancy[roomType] || {};
    const availableCount = Object.keys(physicalRooms).filter(function(roomId) {
      return requestedDates.every(function(date) {
        return Object.prototype.hasOwnProperty.call(physicalRooms[roomId], date) && !physicalRooms[roomId][date];
      });
    }).length;

    const totalCount = Object.keys(physicalRooms).length;
    rooms[roomType] = {
      status: includesClosedNight ? "full" : !calendarComplete || totalCount === 0 ? "unknown" : availableCount === 0 ? "full" : "available",
      availableCount: availableCount,
      totalCount: totalCount
    };
  });

  return {
    ok: true,
    checkInDate: checkInDate,
    nights: nights,
    checkedDates: requestedDates,
    missingDates: requestedDates.filter(function(date) { return !knownDates[date]; }),
    rooms: rooms,
    updatedAt: parsed.updatedAt
  };
}

function roomTypeFromLabel(label) {
  if (/デラックスツイン/.test(label)) return "deluxe-twin";
  if (/ツイン/.test(label)) return "twin";
  if (/ダブル/.test(label)) return "double";
  if (/和室/.test(label)) return "japanese";
  if (/4ベッド/.test(label)) return "four-bed";
  if (/スイート/.test(label)) return "ocean-suite";
  if (/一棟貸|BONDS\s*II/i.test(label)) return "bonds-2";
  return "";
}

function calendarDateKey(value, displayValue, fallbackYear) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return formatIsoDate(value);
  }

  // Imported cells may contain a weekday and date on separate lines, such as "日\n9/6".
  const match = String(displayValue || "").match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (!match) return "";
  return [fallbackYear, String(match[1]).padStart(2, "0"), String(match[2]).padStart(2, "0")].join("-");
}

function parseIsoDate(value) {
  const parts = value.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatIsoDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function jsonResponse(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
