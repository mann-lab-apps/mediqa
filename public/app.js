const TRACKED_UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term"
];

const mediqaConfig = window.MEDIQA_CONFIG || {};

function collectUtm() {
  const params = new URLSearchParams(window.location.search);
  const stored = JSON.parse(window.localStorage.getItem("mediqaUtm") || "{}");
  const current = {};

  TRACKED_UTM_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value) current[key] = value;
  });

  const merged = Object.keys(current).length ? current : stored;
  if (Object.keys(merged).length) {
    window.localStorage.setItem("mediqaUtm", JSON.stringify(merged));
  }
  return merged;
}

const utm = collectUtm();
let formStarted = {
  clinician: false,
  company: false
};

const FORM_HASH_TO_TYPE = {
  "#clinician-form": "clinician",
  "#company-form": "company"
};

const FORM_TYPE_TO_HASH = {
  clinician: "#clinician-form",
  company: "#company-form"
};

function pageMeta() {
  return {
    path: window.location.pathname,
    query: window.location.search,
    referrer: document.referrer || "",
    title: document.title
  };
}

function track(name, meta = {}) {
  const payload = {
    name,
    meta,
    utm,
    page: pageMeta()
  };

  if (window.dataLayer && Array.isArray(window.dataLayer)) {
    window.dataLayer.push({ event: name, ...meta, utm });
  }

  return postMediqaPayload("event", payload).catch(() => undefined);
}

function postMediqaPayload(requestKind, payload) {
  if (mediqaConfig.appsScriptUrl) {
    return fetch(mediqaConfig.appsScriptUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "content-type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        requestKind,
        ...payload
      })
    });
  }

  const localPath = requestKind === "event" ? "/api/events" : "/api/submissions";
  return fetch(localPath, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true
  });
}

function formToObject(form) {
  const data = {};
  const formData = new FormData(form);

  for (const [key, value] of formData.entries()) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      data[key] = Array.isArray(data[key]) ? [...data[key], value] : [data[key], value];
    } else {
      data[key] = value;
    }
  }

  return data;
}

function setStatus(form, message, state) {
  const status = form.querySelector(".form-status");
  status.textContent = message;
  status.dataset.state = state;
}

function validateRequiredCheckboxGroup(form, name, message) {
  const checked = form.querySelectorAll(`input[name="${name}"]:checked`);
  if (checked.length) return true;
  setStatus(form, message, "error");
  form.querySelector(`input[name="${name}"]`)?.focus();
  return false;
}

function activateFormTab(type, options = {}) {
  const { updateHash = false } = options;
  document.querySelectorAll("[data-form-tab]").forEach((tab) => {
    const isActive = tab.dataset.formTab === type;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  document.querySelectorAll("[data-form-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.formPanel !== type;
  });

  if (updateHash && FORM_TYPE_TO_HASH[type]) {
    history.replaceState(null, "", FORM_TYPE_TO_HASH[type]);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  track("landing_view");

  document.querySelectorAll("[data-track]").forEach((element) => {
    element.addEventListener("click", () => {
      const targetType = FORM_HASH_TO_TYPE[element.getAttribute("href") || ""];
      if (targetType) {
        activateFormTab(targetType);
      }

      track(element.dataset.track, {
        target: element.getAttribute("href") || "",
        label: element.textContent.trim()
      });
    });
  });

  document.querySelectorAll("[data-form-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      activateFormTab(tab.dataset.formTab, { updateHash: true });
    });
  });

  activateFormTab(FORM_HASH_TO_TYPE[window.location.hash] || "clinician");

  window.addEventListener("hashchange", () => {
    const targetType = FORM_HASH_TO_TYPE[window.location.hash];
    if (targetType) {
      activateFormTab(targetType);
    }
  });

  document.querySelectorAll("form[data-form-type]").forEach((form) => {
    const type = form.dataset.formType;
    const startEvent = `${type}_form_start`;
    const submitEvent = `${type}_form_submit`;

    form.addEventListener("input", () => {
      if (!formStarted[type]) {
        formStarted[type] = true;
        track(startEvent);
      }
    }, { once: false });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (type === "clinician" && !validateRequiredCheckboxGroup(form, "testMode", "온라인/오프라인 참여 가능 여부를 하나 이상 선택해 주세요.")) {
        return;
      }

      setStatus(form, "제출 중입니다...", "pending");

      try {
        const response = await postMediqaPayload("submission", {
          type,
          data: formToObject(form),
          utm,
          page: pageMeta()
        });

        if (!mediqaConfig.appsScriptUrl && !response.ok) {
          throw new Error("submission failed");
        }

        await track(submitEvent);
        form.reset();
        formStarted[type] = false;
        setStatus(form, "제출되었습니다. 조건에 맞는 다음 단계가 생기면 연락드리겠습니다.", "success");
      } catch (error) {
        setStatus(form, "제출에 실패했습니다. 잠시 후 다시 시도해 주세요.", "error");
      }
    });
  });
});
