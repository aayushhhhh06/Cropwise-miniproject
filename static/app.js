(() => {
  "use strict";

  const STORAGE_KEY = "fasal.crop-records.v1";
  const cropProfiles = {
    rice: { name: "Rice", idealTemp: 28, idealMoisture: 55, idealN: 180, idealP: 35, baseYield: 4.8 },
    wheat: { name: "Wheat", idealTemp: 20, idealMoisture: 38, idealN: 160, idealP: 30, baseYield: 2.3 },
    maize: { name: "Maize", idealTemp: 26, idealMoisture: 45, idealN: 190, idealP: 40, baseYield: 3.2 },
    cotton: { name: "Cotton", idealTemp: 29, idealMoisture: 35, idealN: 150, idealP: 35, baseYield: 1.9 },
    sugarcane: { name: "Sugarcane", idealTemp: 27, idealMoisture: 55, idealN: 200, idealP: 45, baseYield: 34 },
  };
  const ranges = {
    area: [0.1, 10000],
    temperature: [0, 60],
    moisture: [0, 100],
    ph: [0, 14],
    organic: [0, 15],
    nitrogen: [0, 300],
    phosphorus: [0, 150],
  };
  const fields = Object.keys(ranges);
  const form = document.querySelector("#farmForm");
  const message = document.querySelector("#formMessage");
  const byId = (id) => document.getElementById(id);
  let records = [];
  let storageReady = true;

  function readRecords() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === null) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) throw new Error("Saved history has an invalid format.");
      return parsed;
    } catch (error) {
      storageReady = false;
      showMessage(`Could not load saved history from this browser: ${error.message}`, true);
      return [];
    }
  }

  function showMessage(text, isError = false) {
    message.textContent = text;
    message.className = `flash ${isError ? "error" : "success"}`;
    message.hidden = false;
  }

  function clearMessage() {
    message.textContent = "";
    message.hidden = true;
  }

  function readValues() {
    const values = { crop: byId("crop").value };
    if (!Object.hasOwn(cropProfiles, values.crop)) throw new Error("Choose a supported crop.");
    for (const field of fields) {
      const input = byId(field);
      const value = input.valueAsNumber;
      const [min, max] = ranges[field];
      if (!Number.isFinite(value) || value < min || value > max) {
        input.focus();
        throw new Error(`${input.closest("label").firstChild.textContent.trim()} must be between ${min} and ${max}.`);
      }
      values[field] = value;
    }
    return values;
  }

  function clamp(value, min = 0, max = 100) {
    return Math.min(Math.max(value, min), max);
  }

  function status(value, low, high) {
    if (value < low) return "Low";
    if (value > high) return "High";
    return "Adequate";
  }

  function estimate(values) {
    const crop = cropProfiles[values.crop];
    const scores = [
      clamp(100 - Math.abs(values.temperature - crop.idealTemp) * 7),
      clamp(100 - Math.abs(values.moisture - crop.idealMoisture) * 2.4),
      clamp(100 - Math.abs(values.ph - 6.7) * 30),
      clamp(values.organic / 3 * 100),
      clamp(100 - Math.abs(values.nitrogen - crop.idealN) / crop.idealN * 80),
      clamp(100 - Math.abs(values.phosphorus - crop.idealP) / crop.idealP * 80),
    ];
    const score = Math.round(scores.reduce((total, value, index) => total + value * [0.18, 0.17, 0.18, 0.14, 0.18, 0.15][index], 0));
    const fertility = Math.round(clamp(score * 0.98 + values.organic * 2));
    const yieldPerAcre = Number((crop.baseYield * (0.6 + score / 250)).toFixed(1));
    const nitrogenStatus = status(values.nitrogen, crop.idealN * 0.8, crop.idealN * 1.25);
    const phosphorusStatus = status(values.phosphorus, crop.idealP * 0.8, crop.idealP * 1.25);
    let advice;
    let tag;
    if (values.moisture < crop.idealMoisture - 10) {
      advice = "Soil moisture is below the preferred level. Plan a light irrigation cycle and add mulch to reduce water loss.";
      tag = "Priority: Improve soil moisture";
    } else if (values.moisture > crop.idealMoisture + 12) {
      advice = "The soil has extra moisture. Improve drainage and avoid irrigation until the top soil becomes less wet.";
      tag = "Priority: Prevent water logging";
    } else if (values.nitrogen < crop.idealN * 0.8) {
      advice = "Nitrogen is low for this crop. Consider a small split dose of nitrogen fertiliser or well-rotted compost after checking the field.";
      tag = "Priority: Build nitrogen level";
    } else if (values.phosphorus < crop.idealP * 0.8) {
      advice = "Phosphorus is low. Consider a phosphorus-rich fertiliser near the root zone for stronger early growth.";
      tag = "Priority: Improve phosphorus";
    } else if (values.ph < 6) {
      advice = "The soil is acidic. Ask a local soil specialist about agricultural lime during the next soil preparation cycle.";
      tag = "Priority: Correct soil pH";
    } else if (values.ph > 7.5) {
      advice = "The soil is alkaline. Consider organic compost and check irrigation water quality to improve soil conditions.";
      tag = "Priority: Correct soil pH";
    } else {
      advice = "A light organic compost application may help keep your soil active and improve water holding.";
      tag = "Priority: Keep moisture stable";
    }
    return {
      score,
      fertility,
      yieldPerAcre,
      totalYield: Number((yieldPerAcre * values.area).toFixed(1)),
      cropName: crop.name,
      nitrogenStatus,
      phosphorusStatus,
      advice,
      tag,
    };
  }

  function paintEstimate(values, result) {
    byId("scoreValue").textContent = result.score;
    byId("scoreTitle").textContent = result.score >= 75 ? "Healthy soil" : result.score >= 55 ? "Needs attention" : "Improve soil health";
    byId("scoreDescription").textContent = `Your field conditions are estimated for ${result.cropName.toLowerCase()}.`;
    byId("scoreRing").style.background = `radial-gradient(closest-side, #fff 77%, transparent 78% 100%), conic-gradient(${result.score >= 75 ? "#56a966" : result.score >= 55 ? "#e1a844" : "#d66e5a"} ${result.score}%, #edf2ea 0)`;
    byId("resultFertility").textContent = `${result.fertility >= 75 ? "Good" : result.fertility >= 55 ? "Fair" : "Low"} · ${result.fertility}%`;
    byId("resultNitrogen").textContent = `${result.nitrogenStatus} · ${values.nitrogen} kg/ha`;
    byId("resultPhosphorus").textContent = `${result.phosphorusStatus} · ${values.phosphorus} kg/ha`;
    byId("totalYield").innerHTML = `${result.totalYield.toFixed(1)} <small>tonnes</small>`;
    byId("yieldDetail").textContent = `Based on ${values.area} acres of ${result.cropName.toLowerCase()} · ${result.yieldPerAcre.toFixed(1)} t/ac`;
    byId("recommendationText").textContent = result.advice;
    byId("recommendationTag").textContent = result.tag;
    byId("nText").textContent = `${values.nitrogen} kg/ha`;
    byId("pText").textContent = `${values.phosphorus} kg/ha`;
    byId("nBar").style.width = `${clamp(values.nitrogen / 250 * 100, 4)}%`;
    byId("pBar").style.width = `${clamp(values.phosphorus / 75 * 100, 4)}%`;
    byId("nutrientOverall").textContent = result.nitrogenStatus === "Adequate" && result.phosphorusStatus === "Adequate" ? "Balanced" : "Check levels";
  }

  function addCell(row, text, tag = "span") {
    const cell = document.createElement(tag);
    cell.textContent = text;
    row.append(cell);
    return cell;
  }

  function renderHistory() {
    const list = byId("historyList");
    list.replaceChildren();
    byId("recordCount").innerHTML = `${records.length}<span> records</span>`;
    byId("historyCount").textContent = `${records.length} saved`;
    byId("clearButton").disabled = records.length === 0 || !storageReady;
    if (records.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-history";
      empty.textContent = "No field reports saved in this browser yet. Submit a field report above to start tracking.";
      list.append(empty);
      byId("latestScore").innerHTML = `—<span>/100</span>`;
      byId("latestYield").innerHTML = `—<span> tonnes</span>`;
      byId("latestHealthStatus").textContent = "No reports";
      byId("latestHealthStatus").className = "metric-status neutral";
      return;
    }
    const latest = records[0];
    byId("latestScore").innerHTML = `${latest.estimate.score}<span>/100</span>`;
    byId("latestYield").innerHTML = `${latest.estimate.totalYield.toFixed(1)}<span> tonnes</span>`;
    byId("latestHealthStatus").textContent = latest.estimate.score >= 75 ? "Healthy" : "Needs attention";
    byId("latestHealthStatus").className = `metric-status ${latest.estimate.score >= 75 ? "good" : "neutral"}`;
    const table = document.createElement("div");
    table.className = "history-table";
    const heading = document.createElement("div");
    heading.className = "history-head";
    ["Crop", "Recorded", "Health", "Estimated yield", "Action"].forEach((text) => addCell(heading, text));
    table.append(heading);
    for (const record of records) {
      const row = document.createElement("div");
      row.className = "history-row";
      addCell(row, record.estimate.cropName, "strong");
      addCell(row, new Date(record.createdAt).toLocaleDateString());
      const health = addCell(row, `${record.estimate.score}/100`, "b");
      health.className = `health-pill ${record.estimate.score >= 75 ? "healthy" : "watch"}`;
      const yieldCell = document.createElement("span");
      yieldCell.append(document.createTextNode(`${record.estimate.totalYield.toFixed(1)} tonnes`));
      const perAcre = document.createElement("small");
      perAcre.textContent = `${record.estimate.yieldPerAcre.toFixed(1)} t/ac`;
      yieldCell.append(perAcre);
      row.append(yieldCell);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "small-action danger-action";
      remove.textContent = "Delete";
      remove.setAttribute("aria-label", `Delete ${record.estimate.cropName} report`);
      remove.dataset.removeId = record.id;
      row.append(remove);
      table.append(row);
    }
    list.append(table);
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      storageReady = true;
      return true;
    } catch (error) {
      storageReady = false;
      showMessage(`Could not save this report in your browser: ${error.message}`, true);
      return false;
    }
  }

  function saveRecord(values, result) {
    const record = {
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      values,
      estimate: result,
    };
    records.unshift(record);
    if (persist()) {
      renderHistory();
      showMessage("Your field estimate and report were saved in this browser.");
      location.hash = "history";
    } else {
      records.shift();
      renderHistory();
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearMessage();
    if (!storageReady) {
      showMessage("Browser history is unavailable. Enable site storage or use another browser before saving.", true);
      return;
    }
    if (!form.reportValidity()) return;
    try {
      const values = readValues();
      const result = estimate(values);
      paintEstimate(values, result);
      saveRecord(values, result);
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  byId("historyList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-id]");
    if (!button) return;
    const previous = records;
    records = records.filter((record) => record.id !== button.dataset.removeId);
    if (persist()) {
      renderHistory();
      showMessage("The selected report was removed from this browser.");
    } else {
      records = previous;
      renderHistory();
    }
  });

  byId("clearButton").addEventListener("click", () => {
    if (!records.length || !window.confirm("Delete all field reports saved in this browser?")) return;
    const previous = records;
    records = [];
    if (persist()) {
      renderHistory();
      showMessage("All reports saved in this browser were deleted.");
    } else {
      records = previous;
      renderHistory();
    }
  });

  byId("exportButton").addEventListener("click", () => {
    if (!records.length) {
      showMessage("There are no saved reports to export.", true);
      return;
    }
    const columns = ["date", "crop", ...fields, "health_score", "yield_per_acre_tonnes", "total_yield_tonnes"];
    const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
    const lines = [columns.map(quote).join(",")];
    for (const record of records) {
      lines.push([
        record.createdAt,
        record.estimate.cropName,
        ...fields.map((field) => record.values[field]),
        record.estimate.score,
        record.estimate.yieldPerAcre,
        record.estimate.totalYield,
      ].map(quote).join(","));
    }
    const link = document.createElement("a");
    const downloadUrl = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    link.href = downloadUrl;
    link.download = `fasal-field-history-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  });

  byId("todayLabel").textContent = `${new Date().toLocaleDateString(undefined, { day: "2-digit", month: "long", year: "numeric" }).toUpperCase()} · YOUR FARM`;
  records = readRecords();
  renderHistory();
  try {
    const initialValues = readValues();
    paintEstimate(initialValues, estimate(initialValues));
  } catch (error) {
    showMessage(error.message, true);
  }
})();
