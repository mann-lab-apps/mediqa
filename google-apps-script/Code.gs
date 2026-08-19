const MEDIQA_SHEETS = {
  clinician: "Clinician Registrations",
  company: "Company Pilots",
  event: "Events",
  error: "Errors"
};

const MEDIQA_PROPERTIES = {
  notificationEmail: "MEDIQA_NOTIFICATION_EMAIL"
};

const MEDIQA_HEADERS = {
  clinician: [
    "receivedAt",
    "id",
    "role",
    "clinicalExperience",
    "currentStatus",
    "department",
    "deviceExperience",
    "testMode",
    "availability",
    "expectedFee",
    "contact",
    "verificationIntent",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "page_path",
    "page_query",
    "page_referrer",
    "page_title",
    "raw_json"
  ],
  company: [
    "receivedAt",
    "id",
    "companyName",
    "contactName",
    "contact",
    "productType",
    "stage",
    "targetRole",
    "targetExperience",
    "participantCount",
    "testMode",
    "sessionLength",
    "preferredSchedule",
    "priorTesting",
    "description",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "page_path",
    "page_query",
    "page_referrer",
    "page_title",
    "raw_json"
  ],
  event: [
    "receivedAt",
    "id",
    "name",
    "meta_json",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "page_path",
    "page_query",
    "page_referrer",
    "page_title",
    "raw_json"
  ],
  error: [
    "receivedAt",
    "id",
    "message",
    "raw_body",
    "raw_json"
  ]
};

function setupMediqaSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(MEDIQA_SHEETS).forEach((key) => {
    const sheet = getOrCreateSheet_(spreadsheet, MEDIQA_SHEETS[key]);
    ensureHeader_(sheet, MEDIQA_HEADERS[key]);
  });
}

function setMediqaNotificationEmail() {
  const email = "YOUR_EMAIL@example.com";
  PropertiesService.getScriptProperties().setProperty(MEDIQA_PROPERTIES.notificationEmail, email);
}

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    const requestKind = payload.requestKind || payload.kind || inferRequestKind_(payload);

    if (requestKind === "event") {
      appendEvent_(payload);
      return jsonResponse_({ ok: true });
    }

    if (requestKind === "submission") {
      if (payload.type !== "clinician" && payload.type !== "company") {
        throw new Error("Invalid submission type");
      }
      appendSubmission_(payload.type, payload);
      return jsonResponse_({ ok: true });
    }

    throw new Error("Unknown request kind");
  } catch (error) {
    appendError_(error, e);
    return jsonResponse_({ ok: false, error: error.message });
  }
}

function doGet() {
  return jsonResponse_({
    ok: true,
    service: "MediQA Sheets endpoint",
    message: "Use POST to submit MediQA events and form responses."
  });
}

function appendSubmission_(type, payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  let record;
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet_(spreadsheet, MEDIQA_SHEETS[type]);
    const headers = ensureHeader_(sheet, MEDIQA_HEADERS[type]);
    record = flattenSubmission_(payload);
    appendRecord_(sheet, headers, record);
  } finally {
    lock.releaseLock();
  }
  sendSubmissionNotification_(type, record);
}

function appendEvent_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet_(spreadsheet, MEDIQA_SHEETS.event);
    const headers = ensureHeader_(sheet, MEDIQA_HEADERS.event);
    const record = flattenEvent_(payload);
    appendRecord_(sheet, headers, record);
  } finally {
    lock.releaseLock();
  }
}

function appendError_(error, e) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet_(spreadsheet, MEDIQA_SHEETS.error);
  const headers = ensureHeader_(sheet, MEDIQA_HEADERS.error);
  const rawBody = e && e.postData ? e.postData.contents : "";
  appendRecord_(sheet, headers, {
    receivedAt: new Date().toISOString(),
    id: Utilities.getUuid(),
    message: error.message,
    raw_body: rawBody,
    raw_json: JSON.stringify({ stack: error.stack || "" })
  });
}

function flattenSubmission_(payload) {
  const data = payload.data || {};
  const base = flattenBase_(payload);
  return {
    ...base,
    ...data,
    testMode: Array.isArray(data.testMode) ? data.testMode.join(", ") : data.testMode,
    raw_json: JSON.stringify(payload)
  };
}

function flattenEvent_(payload) {
  return {
    ...flattenBase_(payload),
    name: payload.name || "",
    meta_json: JSON.stringify(payload.meta || {}),
    raw_json: JSON.stringify(payload)
  };
}

function flattenBase_(payload) {
  const utm = payload.utm || {};
  const page = payload.page || {};
  return {
    receivedAt: new Date().toISOString(),
    id: Utilities.getUuid(),
    utm_source: utm.utm_source || "",
    utm_medium: utm.utm_medium || "",
    utm_campaign: utm.utm_campaign || "",
    utm_content: utm.utm_content || "",
    utm_term: utm.utm_term || "",
    page_path: page.path || "",
    page_query: page.query || "",
    page_referrer: page.referrer || "",
    page_title: page.title || ""
  };
}

function sendSubmissionNotification_(type, record) {
  const email = getNotificationEmail_();
  if (!email) return;

  const label = type === "company" ? "무료 파일럿 신청" : "의료전문가 등록";
  const subject = `[MediQA] ${label}이 접수되었습니다`;
  const body = type === "company"
    ? buildCompanyNotificationBody_(record)
    : buildClinicianNotificationBody_(record);

  try {
    MailApp.sendEmail({
      to: email,
      subject,
      body
    });
  } catch (error) {
    console.error(`Failed to send MediQA notification: ${error.message}`);
  }
}

function buildClinicianNotificationBody_(record) {
  return [
    "MediQA 의료전문가 등록이 접수되었습니다.",
    "",
    `접수 시각: ${record.receivedAt}`,
    `직군: ${record.role || ""}`,
    `임상경력: ${record.clinicalExperience || ""}`,
    `현직 여부: ${record.currentStatus || ""}`,
    `근무부서/진료영역: ${record.department || ""}`,
    `참여 방식: ${record.testMode || ""}`,
    `참여 가능 일정: ${record.availability || ""}`,
    `희망 사례비: ${record.expectedFee || ""}`,
    `연락처: ${record.contact || ""}`,
    `UTM source: ${record.utm_source || ""}`,
    "",
    "자세한 내용은 Google Sheet의 Clinician Registrations 탭에서 확인하세요."
  ].join("\n");
}

function buildCompanyNotificationBody_(record) {
  return [
    "MediQA 무료 파일럿 신청이 접수되었습니다.",
    "",
    `접수 시각: ${record.receivedAt}`,
    `회사명: ${record.companyName || ""}`,
    `담당자: ${record.contactName || ""}`,
    `연락처/이메일: ${record.contact || ""}`,
    `제품 유형: ${record.productType || ""}`,
    `개발 단계: ${record.stage || ""}`,
    `원하는 의료전문가: ${record.targetRole || ""}`,
    `필요 경력/근무영역: ${record.targetExperience || ""}`,
    `인원: ${record.participantCount || ""}`,
    `테스트 방식: ${record.testMode || ""}`,
    `예상 테스트 시간: ${record.sessionLength || ""}`,
    `희망 일정: ${record.preferredSchedule || ""}`,
    `UTM source: ${record.utm_source || ""}`,
    "",
    "자세한 내용은 Google Sheet의 Company Pilots 탭에서 확인하세요."
  ].join("\n");
}

function getNotificationEmail_() {
  return PropertiesService
    .getScriptProperties()
    .getProperty(MEDIQA_PROPERTIES.notificationEmail);
}

function appendRecord_(sheet, headers, record) {
  const row = headers.map((header) => {
    const value = record[header];
    if (Array.isArray(value)) return value.join(", ");
    return value == null ? "" : value;
  });
  sheet.appendRow(row);
}

function getOrCreateSheet_(spreadsheet, name) {
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function ensureHeader_(sheet, expectedHeaders) {
  const currentLastColumn = Math.max(sheet.getLastColumn(), expectedHeaders.length);
  const currentHeaders = sheet.getRange(1, 1, 1, currentLastColumn).getValues()[0];
  const hasAnyHeader = currentHeaders.some((value) => String(value || "").trim());

  if (!hasAnyHeader) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    formatHeader_(sheet, expectedHeaders.length);
    return expectedHeaders;
  }

  const existing = currentHeaders.filter((value) => String(value || "").trim());
  const missing = expectedHeaders.filter((header) => existing.indexOf(header) === -1);
  if (missing.length) {
    sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
  }
  formatHeader_(sheet, existing.length + missing.length);
  return existing.concat(missing);
}

function formatHeader_(sheet, columnCount) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, columnCount)
    .setFontWeight("bold")
    .setBackground("#006c67")
    .setFontColor("#ffffff");
  sheet.autoResizeColumns(1, Math.min(columnCount, 12));
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  const body = e.postData.contents;
  try {
    return JSON.parse(body);
  } catch (error) {
    const params = {};
    body.split("&").forEach((part) => {
      const pieces = part.split("=");
      if (!pieces[0]) return;
      params[decodeURIComponent(pieces[0])] = decodeURIComponent(pieces.slice(1).join("=") || "");
    });
    return params;
  }
}

function inferRequestKind_(payload) {
  if (payload.name && !payload.data) return "event";
  if (payload.type && payload.data) return "submission";
  return "";
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
