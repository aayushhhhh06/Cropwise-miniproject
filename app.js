const cropData = {
  rice: { name: "rice", idealTemp: 28, idealMoisture: 55, idealN: 180, idealP: 35, baseYield: 4.8 },
  wheat: { name: "wheat", idealTemp: 20, idealMoisture: 38, idealN: 160, idealP: 30, baseYield: 2.3 },
  maize: { name: "maize", idealTemp: 26, idealMoisture: 45, idealN: 190, idealP: 40, baseYield: 3.2 },
  cotton: { name: "cotton", idealTemp: 29, idealMoisture: 35, idealN: 150, idealP: 35, baseYield: 1.9 },
  sugarcane: { name: "sugarcane", idealTemp: 27, idealMoisture: 55, idealN: 200, idealP: 45, baseYield: 34 }
};

const initial = { crop: "rice", area: 2.5, temperature: 28, moisture: 42, ph: 6.7, organic: 2.8, nitrogen: 185, phosphorus: 42 };
const form = document.querySelector("#farmForm");
const get = (id) => document.querySelector(`#${id}`);
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function status(value, low, high, labels = ["Low", "Adequate", "High"]) {
  if (value < low) return labels[0];
  if (value > high) return labels[2];
  return labels[1];
}

function computeScore(values, target) {
  const temp = clamp(100 - Math.abs(values.temperature - target.idealTemp) * 7, 0, 100);
  const moisture = clamp(100 - Math.abs(values.moisture - target.idealMoisture) * 2.4, 0, 100);
  const ph = clamp(100 - Math.abs(values.ph - 6.7) * 30, 0, 100);
  const organic = clamp(values.organic / 3 * 100, 0, 100);
  const nitrogen = clamp(100 - Math.abs(values.nitrogen - target.idealN) / target.idealN * 80, 0, 100);
  const phosphorus = clamp(100 - Math.abs(values.phosphorus - target.idealP) / target.idealP * 80, 0, 100);
  return Math.round(temp * .18 + moisture * .17 + ph * .18 + organic * .14 + nitrogen * .18 + phosphorus * .15);
}

function recommendation(values, target) {
  if (values.moisture < target.idealMoisture - 10) return ["Soil moisture is below the preferred level. Plan a light irrigation cycle and add mulch to reduce water loss.", "Priority: Improve soil moisture"];
  if (values.moisture > target.idealMoisture + 12) return ["The soil has extra moisture. Improve drainage and avoid irrigation until the top soil becomes less wet.", "Priority: Prevent water logging"];
  if (values.nitrogen < target.idealN * .8) return ["Nitrogen is low for this crop. Add a small split dose of nitrogen fertiliser or well-rotted compost after checking the field.", "Priority: Build nitrogen level"];
  if (values.phosphorus < target.idealP * .8) return ["Phosphorus is low. Apply a phosphorus-rich fertiliser near the root zone for stronger early growth.", "Priority: Improve phosphorus"];
  if (values.ph < 6.0) return ["The soil is acidic. Use agricultural lime in the next soil preparation cycle to bring pH closer to neutral.", "Priority: Correct soil pH"];
  if (values.ph > 7.5) return ["The soil is alkaline. Mix organic compost and check irrigation water quality to slowly improve pH.", "Priority: Correct soil pH"];
  return ["Apply a light organic compost dose within the next 7 days to keep your soil active and improve water holding.", "Priority: Keep moisture stable"];
}

function updateDashboard(values) {
  const target = cropData[values.crop];
  const score = computeScore(values, target);
  const yieldPerAcre = +(target.baseYield * (.6 + score / 250)).toFixed(1);
  const totalYield = (yieldPerAcre * values.area).toFixed(1);
  const fertility = Math.round(clamp(score * .98 + values.organic * 2, 0, 100));
  const soilTitle = score >= 75 ? "Healthy soil" : score >= 55 ? "Needs attention" : "Improve soil health";
  const soilDescription = score >= 75 ? `Your field conditions are well-balanced for ${target.name}.` : `A few changes can improve conditions for ${target.name}.`;
  const [advice, tag] = recommendation(values, target);
  const nitrogenState = status(values.nitrogen, target.idealN * .8, target.idealN * 1.25);
  const phosphorusState = status(values.phosphorus, target.idealP * .8, target.idealP * 1.25);

  get("tempMetric").innerHTML = `${values.temperature}<span>°C</span>`;
  get("moistureMetric").innerHTML = `${values.moisture}<span>%</span>`;
  get("fertilityMetric").innerHTML = `${fertility}<span>/100</span>`;
  get("yieldMetric").innerHTML = `${yieldPerAcre}<span> t/ac</span>`;
  get("fertilityStatus").textContent = fertility >= 75 ? "Healthy" : fertility >= 55 ? "Fair" : "Low";
  get("fertilityStatus").className = `metric-status ${fertility >= 65 ? "good" : "neutral"}`;
  get("scoreValue").textContent = score;
  get("scoreTitle").textContent = soilTitle;
  get("scoreDescription").textContent = soilDescription;
  document.querySelector(".score-ring").style.background = `radial-gradient(closest-side, #fff 77%, transparent 78% 100%), conic-gradient(${score >= 75 ? "#56a966" : score >= 55 ? "#e1a844" : "#d66e5a"} ${score}%, #edf2ea 0)`;
  get("resultFertility").textContent = `${fertility >= 75 ? "Good" : fertility >= 55 ? "Fair" : "Low"} · ${fertility}%`;
  get("resultNitrogen").textContent = `${nitrogenState} · ${values.nitrogen} kg/ha`;
  get("resultPhosphorus").textContent = `${phosphorusState} · ${values.phosphorus} kg/ha`;
  get("totalYield").innerHTML = `${totalYield} <small>tonnes</small>`;
  get("yieldDetail").textContent = `Based on ${values.area} acres of ${target.name}`;
  get("recommendationText").textContent = advice;
  get("recommendationTag").textContent = tag;
  get("nText").textContent = `${values.nitrogen} kg/ha`;
  get("pText").textContent = `${values.phosphorus} kg/ha`;
  get("nBar").style.width = `${clamp(values.nitrogen / 250 * 100, 4, 100)}%`;
  get("pBar").style.width = `${clamp(values.phosphorus / 75 * 100, 4, 100)}%`;
  get("nutrientOverall").textContent = nitrogenState === "Adequate" && phosphorusState === "Adequate" ? "Balanced" : "Check levels";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  Object.keys(values).forEach((key) => { if (key !== "crop") values[key] = Number(values[key]); });
  const invalid = Object.entries(values).find(([key, value]) => key !== "crop" && (!Number.isFinite(value) || value <= 0));
  if (invalid || values.ph > 14 || values.moisture > 100) {
    get("formError").textContent = "Please enter valid positive values (pH ≤ 14 and moisture ≤ 100%).";
    return;
  }
  get("formError").textContent = "";
  updateDashboard(values);
  get("soil-report").scrollIntoView({ behavior: "smooth", block: "nearest" });
});

get("resetButton").addEventListener("click", () => {
  Object.entries(initial).forEach(([key, value]) => { get(key).value = value; });
  get("formError").textContent = "";
  updateDashboard(initial);
});

updateDashboard(initial);
