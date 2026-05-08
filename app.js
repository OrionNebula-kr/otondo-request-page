const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz5seD6eNbx_WEJkKajolTMfA6NzUFNUp8UX0UTwO3uuy8rAwQ_U_9WwzM6O9jN5lNh/exec";

const TARGET_SHEET_NAME = "TEST";

const form = document.getElementById("requestForm");
const submitBtn = document.getElementById("submitBtn");
const resetBtn = document.getElementById("resetBtn");
const statusMessage = document.getElementById("statusMessage");

function getFormValue(name) {
  const element = form.elements[name];

  if (!element) {
    return "";
  }

  return String(element.value || "").trim();
}

function setStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = "status-message";

  if (type) {
    statusMessage.classList.add(type);
  }
}

function createRequestId() {
  return "REQ_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
}

function collectPayload() {
  return {
    request_id: createRequestId(),

    sheetName: TARGET_SHEET_NAME,

    requester: getFormValue("requester"),
    requester_email: "",

    category: getFormValue("category"),
    content: getFormValue("content"),

    PRDT_NM: getFormValue("PRDT_NM"),
    PRDT_CD: getFormValue("PRDT_CD"),

    worker: getFormValue("worker"),
    worker_email: "",

    due_date: getFormValue("due_date"),

    extra_content: getFormValue("extra_content"),
    note: getFormValue("note"),

    W_MIN: getFormValue("W_MIN"),
    W_MAX: getFormValue("W_MAX"),
    W: getFormValue("W"),

    D_MIN: getFormValue("D_MIN"),
    D_MAX: getFormValue("D_MAX"),
    D: getFormValue("D"),

    H_MIN: getFormValue("H_MIN"),
    H_MAX: getFormValue("H_MAX"),
    H: getFormValue("H"),

    PRICE_COST: getFormValue("PRICE_COST"),
    PRICE_SUPPLY: getFormValue("PRICE_SUPPLY"),
    PRICE_RETAIL: getFormValue("PRICE_RETAIL"),

    ORDER_AVAILABLE: getFormValue("ORDER_AVAILABLE"),
    ORDER_TYPE: getFormValue("ORDER_TYPE"),

    INSTALL_COST: getFormValue("INSTALL_COST"),
    INSTALL_SUPPLY: getFormValue("INSTALL_SUPPLY"),
    INSTALL_RETAIL: getFormValue("INSTALL_RETAIL"),

    PRICE_LOGIC: getFormValue("PRICE_LOGIC"),
    MATERIAL_UNIT_PRICE: getFormValue("MATERIAL_UNIT_PRICE"),
    INSTALL_UNIT_PRICE: getFormValue("INSTALL_UNIT_PRICE"),
    SUPPLY_MARGIN: getFormValue("SUPPLY_MARGIN"),
    DISTRIBUTION_MARGIN: getFormValue("DISTRIBUTION_MARGIN")
  };
}

function validatePayload(payload) {
  if (!payload.requester) {
    return "요청자를 입력해야 합니다.";
  }

  if (!payload.content) {
    return "요청 내용을 입력해야 합니다.";
  }

  if (!payload.PRDT_CD) {
    return "PRDT_CD를 입력해야 합니다.";
  }

  if (payload.due_date) {
    const year = Number(payload.due_date.slice(0, 4));

    if (isNaN(year) || year < 2020 || year > 2099) {
      return "마감일 연도가 이상합니다. 달력에서 정상 날짜를 선택해 주세요.";
    }
  }

  return "";
}

function validateScriptUrl() {
  if (!SCRIPT_URL) {
    throw new Error("Apps Script URL이 비어 있습니다.");
  }

  if (!SCRIPT_URL.includes("script.google.com/macros/s/")) {
    throw new Error("Apps Script URL이 잘못되었습니다. /macros/s/.../exec 형식의 웹 앱 URL을 넣어야 합니다.");
  }

  if (!SCRIPT_URL.endsWith("/exec")) {
    throw new Error("Apps Script URL 끝이 /exec가 아닙니다. 배포된 웹 앱 URL을 다시 복사해야 합니다.");
  }
}

async function sendToGoogleSheet(payload) {
  validateScriptUrl();

  await fetch(SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });
}

function checkSaveStatus(requestId, timeoutMs) {
  return new Promise(function(resolve) {
    const startTime = Date.now();

    function tryCheck() {
      const callbackName = "jsonpCallback_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      const script = document.createElement("script");

      window[callbackName] = function(response) {
        delete window[callbackName];
        script.remove();

        if (response.result === "success" || response.result === "error") {
          resolve(response);
          return;
        }

        if (Date.now() - startTime >= timeoutMs) {
          resolve({
            result: "timeout",
            message: "저장 결과 확인 시간이 초과되었습니다. 구글 시트에 행이 생겼는지 확인해 주세요."
          });
          return;
        }

        setTimeout(tryCheck, 800);
      };

      script.onerror = function() {
        delete window[callbackName];
        script.remove();

        resolve({
          result: "error",
          message: "저장 결과 확인 요청에 실패했습니다. Apps Script 배포 권한 또는 URL을 확인해 주세요."
        });
      };

      const url =
        SCRIPT_URL +
        "?action=status" +
        "&request_id=" + encodeURIComponent(requestId) +
        "&callback=" + encodeURIComponent(callbackName) +
        "&_=" + Date.now();

      script.src = url;
      document.body.appendChild(script);
    }

    tryCheck();
  });
}

form.addEventListener("submit", async function(event) {
  event.preventDefault();

  const payload = collectPayload();
  const errorMessage = validatePayload(payload);

  if (errorMessage) {
    setStatus(errorMessage, "error");
    return;
  }

  submitBtn.disabled = true;
  setStatus("구글 시트로 전송 중...", "");

  try {
    await sendToGoogleSheet(payload);

    setStatus("전송 완료. 구글 시트 저장 결과 확인 중...", "");

    const result = await checkSaveStatus(payload.request_id, 10000);

    if (result.result === "success") {
      setStatus(
        "저장 성공: " + result.sheetName + " 시트 " + result.row + "행에 등록되었습니다.",
        "success"
      );

      form.reset();

      form.elements["category"].value = "라이브러리";
      form.elements["worker"].value = "김동훈";
    } else {
      setStatus("저장 실패: " + result.message, "error");
    }

  } catch (error) {
    console.error(error);
    setStatus("저장 실패: " + error.message, "error");
  } finally {
    submitBtn.disabled = false;
  }
});

resetBtn.addEventListener("click", function() {
  form.reset();

  form.elements["category"].value = "라이브러리";
  form.elements["worker"].value = "김동훈";

  setStatus("", "");
});