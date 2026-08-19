(() => {
  "use strict";

  // Local testing ke liye port 8080 use kiya hai
  const API_BASE = "https://mentelhealthscore-production-bf50.up.railway.app";

  // Elements mapping
  const form = document.getElementById("predict-form");
  const submitBtn = document.getElementById("submit-btn");
  const resetBtn = document.getElementById("reset-btn");
  const errorRetryBtn = document.getElementById("error-retry-btn");

  const stateIdle = document.getElementById("state-idle");
  const stateLoading = document.getElementById("state-loading");
  const stateResult = document.getElementById("state-result");
  const stateError = document.getElementById("state-error");

  const scoreNumberEl = document.getElementById("score-number");
  const scoreBandEl = document.getElementById("score-band");
  const scoreContextEl = document.getElementById("score-context");
  const gaugeFill = document.getElementById("gauge-fill");
  const errorLabelEl = document.getElementById("error-label");
  const errorCopyEl = document.getElementById("error-copy");

  const GAUGE_ARC_LENGTH = 314;

  // 1. Gauge ke ticks marks generate karne ke liye loop
  function drawTicks() {
    document.querySelectorAll(".gauge-ticks").forEach((g) => {
      g.innerHTML = "";
      const cx = 120, cy = 140, rOuter = 100, rInner = 90;
      for (let i = 0; i <= 10; i += 2) {
        const angle = Math.PI - (i / 10) * Math.PI;
        const x1 = cx + rOuter * Math.cos(angle);
        const y1 = cy - rOuter * Math.sin(angle);
        const x2 = cx + rInner * Math.cos(angle);
        const y2 = cy - rInner * Math.sin(angle);
        const line = document.createElementNS("http://w3.org", "line");
        line.setAttribute("x1", x1.toFixed(1));
        line.setAttribute("y1", y1.toFixed(1));
        line.setAttribute("x2", x2.toFixed(1));
        line.setAttribute("y2", y2.toFixed(1));
        g.appendChild(line);
      }
    });
  }
  drawTicks();

  // 2. Stress Level segment buttons event listeners
  const segGroup = document.getElementById("stress_level_group");
  const stressHiddenInput = document.getElementById("stress_level");
  segGroup.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      segGroup.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      stressHiddenInput.value = btn.dataset.value;
      clearFieldError(stressHiddenInput);
    });
  });

  // 3. Error Helpers
  function fieldWrapper(input) {
    return input ? input.closest(".field") : null;
  }

  function setFieldError(input, message) {
    const wrap = fieldWrapper(input);
    if (!wrap) return;
    wrap.classList.add("field-error");
    const msgEl = wrap.querySelector(".error-msg");
    if (msgEl) msgEl.textContent = message;
  }

  function clearFieldError(input) {
    const wrap = fieldWrapper(input);
    if (!wrap) return;
    wrap.classList.remove("field-error");
    const msgEl = wrap.querySelector(".error-msg");
    if (msgEl) msgEl.textContent = "";
  }

  function clearAllErrors() {
    form.querySelectorAll(".field").forEach((f) => f.classList.remove("field-error"));
    form.querySelectorAll(".error-msg").forEach((m) => (m.textContent = ""));
  }

  // 4. Form Frontend Validation Logic
  function validate(payload) {
    let hasErrors = false;
    const numericChecks = [
      ["age", 10, 100],
      ["avg_daily_usage_hours", 0, 24],
      ["daily_unlocks", 0, Infinity],
      ["study_hours", 0, 24],
      ["physical_activity_hours", 0, 24],
      ["sleep_hours_per_night", 0, 24],
    ];

    numericChecks.forEach(([key, min, max]) => {
      const input = document.getElementById(key);
      const val = payload[key];
      if (val === "" || val === null || Number.isNaN(val)) {
        setFieldError(input, "This field is required.");
        hasErrors = true;
      } else if (val < min || val > max) {
        setFieldError(input, `Must be between ${min} and ${max === Infinity ? "0+" : max}.`);
        hasErrors = true;
      } else {
        clearFieldError(input);
      }
    });

    ["gender", "country", "academic_level", "most_used_platform", "purpose_of_use"].forEach((key) => {
      const input = document.getElementById(key);
      if (!payload[key] || String(payload[key]).trim() === "") {
        setFieldError(input, "This field is required.");
        hasErrors = true;
      } else {
        clearFieldError(input);
      }
    });

    if (!payload.stress_level) {
      setFieldError(stressHiddenInput, "Pick a stress level.");
      hasErrors = true;
    } else {
      clearFieldError(stressHiddenInput);
    }

    return hasErrors;
  }

  // 5. Payload Object Collection
  function collectPayload() {
    const fd = new FormData(form);
    return {
      age: fd.get("age") === "" ? NaN : parseInt(fd.get("age"), 10),
      gender: fd.get("gender") || "",
      country: (fd.get("country") || "").trim(),
      academic_level: fd.get("academic_level") || "",
      most_used_platform: fd.get("most_used_platform") || "",
      purpose_of_use: fd.get("purpose_of_use") || "",
      avg_daily_usage_hours: fd.get("avg_daily_usage_hours") === "" ? NaN : parseFloat(fd.get("avg_daily_usage_hours")),
      daily_unlocks: fd.get("daily_unlocks") === "" ? NaN : parseInt(fd.get("daily_unlocks"), 10),
      study_hours: fd.get("study_hours") === "" ? NaN : parseFloat(fd.get("study_hours")),
      physical_activity_hours: fd.get("physical_activity_hours") === "" ? NaN : parseFloat(fd.get("physical_activity_hours")),
      sleep_hours_per_night: fd.get("sleep_hours_per_night") === "" ? NaN : parseFloat(fd.get("sleep_hours_per_night")),
      stress_level: fd.get("stress_level") || "",
    };
  }

  // 6. UI View Manager
  function showState(name) {
    [stateIdle, stateLoading, stateResult, stateError].forEach((el) => {
      if (el) el.hidden = true;
    });
    const activeEl = { idle: stateIdle, loading: stateLoading, result: stateResult, error: stateError }[name];
    if (activeEl) activeEl.hidden = false;
  }

  // 7. Dynamic Score Handler
  function bandFor(score) {
    if (score < 4) {
      return { label: "Signal: strained", context: "Your responses suggest elevated strain right now. Small shifts in sleep or screen time can go a long way." };
    }
    if (score < 7) {
      return { label: "Signal: balanced", context: "Your rhythm looks fairly steady, with some room to recover and reset." };
    }
    return { label: "Signal: strong", context: "Your habits point to a well-supported, resilient baseline. Keep it up." };
  }

  function renderResult(score) {
    const clamped = Math.max(0, Math.min(10, score));
    const { label, context } = bandFor(clamped);

    if (scoreNumberEl) scoreNumberEl.textContent = score.toFixed(2);
    if (scoreBandEl) scoreBandEl.textContent = label;
    if (scoreContextEl) scoreContextEl.textContent = context;

    if (gaugeFill) {
      gaugeFill.style.transition = "none";
      gaugeFill.style.strokeDashoffset = String(GAUGE_ARC_LENGTH);
      requestAnimationFrame(() => {
        gaugeFill.style.transition = "stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)";
        const offset = GAUGE_ARC_LENGTH * (1 - clamped / 10);
        gaugeFill.style.strokeDashoffset = String(offset);
      });
    }

    showState("result");
  }

  // 8. API Connection (Submit handler)
  async function handleFormSubmit(e) {
    if (e) e.preventDefault();
    clearAllErrors();
    
    const payload = collectPayload();
    const hasValidationError = validate(payload);
    
    if (hasValidationError) return;

    showState("loading");
    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Internal Server Error");
      
      const data = await res.json();
      renderResult(data.predicted_mental_health_score);
    } catch (err) {
      if (errorLabelEl) errorLabelEl.textContent = "Submission Failed";
      if (errorCopyEl) errorCopyEl.textContent = "Could not connect to the local server. Make sure FastAPI app is running.";
      showState("error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  // Event Attachments
  if (form) form.addEventListener("submit", handleFormSubmit);
  if (errorRetryBtn) errorRetryBtn.addEventListener("click", () => showState("idle"));
  
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      form.reset();
      clearAllErrors();
      segGroup.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
      if (stressHiddenInput) stressHiddenInput.value = "";
      showState("idle");
    });
  }
})();
