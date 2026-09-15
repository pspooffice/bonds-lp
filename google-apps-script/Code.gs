const SECRET = PropertiesService.getScriptProperties().getProperty("SECRET") || "";

function doGet() {
  return jsonResponse({
    ok: true,
    message: "BONDS reservation sheet endpoint is running."
  });
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

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

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
        payload.breakfast ? "あり" : "なし",
        payload.dinner ? "あり" : "なし",
        payload.roomSubtotal || 0,
        payload.lodgingDiscount || 0,
        payload.discountedRoomSubtotal || 0,
        payload.breakfastSubtotal || 0,
        payload.dinnerSubtotal || 0,
        payload.preDiscountTotal || 0,
        payload.total || 0,
        payload.message || ""
      ]);
    } finally {
      lock.releaseLock();
    }

    return jsonResponse({
      ok: true,
      message: "Saved."
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      message: error.message || "Failed to save."
    });
  }
}

function jsonResponse(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
