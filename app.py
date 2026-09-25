import os
import sqlite3
from datetime import date
from pathlib import Path

import numpy as np
from flask import Flask, flash, jsonify, redirect, render_template, request, url_for


BASE_DIR = Path(__file__).resolve().parent
DATABASE = Path(os.environ.get("FASAL_DATABASE", BASE_DIR / "data" / "fasal.db"))

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("FASAL_SECRET_KEY", "fasal-local-development-key")
app.config["DATABASE"] = str(DATABASE)

CROP_PROFILES = {
    "rice": {"name": "Rice", "ideal_temp": 28, "ideal_moisture": 55, "ideal_n": 180, "ideal_p": 35, "base_yield": 4.8},
    "wheat": {"name": "Wheat", "ideal_temp": 20, "ideal_moisture": 38, "ideal_n": 160, "ideal_p": 30, "base_yield": 2.3},
    "maize": {"name": "Maize", "ideal_temp": 26, "ideal_moisture": 45, "ideal_n": 190, "ideal_p": 40, "base_yield": 3.2},
    "cotton": {"name": "Cotton", "ideal_temp": 29, "ideal_moisture": 35, "ideal_n": 150, "ideal_p": 35, "base_yield": 1.9},
    "sugarcane": {"name": "Sugarcane", "ideal_temp": 27, "ideal_moisture": 55, "ideal_n": 200, "ideal_p": 45, "base_yield": 34.0},
}

FIELD_LIMITS = {
    "area": (0.1, 10000),
    "temperature": (0, 60),
    "moisture": (0, 100),
    "ph": (0, 14),
    "organic": (0, 15),
    "nitrogen": (0, 300),
    "phosphorus": (0, 150),
}


def get_db():
    DATABASE.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    with get_db() as connection:
        connection.executescript((BASE_DIR / "schema.sql").read_text(encoding="utf-8"))


def calculate_estimate(values):
    profile = CROP_PROFILES[values["crop"]]
    temp_score = np.clip(100 - abs(values["temperature"] - profile["ideal_temp"]) * 7, 0, 100)
    moisture_score = np.clip(100 - abs(values["moisture"] - profile["ideal_moisture"]) * 2.4, 0, 100)
    ph_score = np.clip(100 - abs(values["ph"] - 6.7) * 30, 0, 100)
    organic_score = np.clip(values["organic"] / 3 * 100, 0, 100)
    nitrogen_score = np.clip(100 - abs(values["nitrogen"] - profile["ideal_n"]) / profile["ideal_n"] * 80, 0, 100)
    phosphorus_score = np.clip(100 - abs(values["phosphorus"] - profile["ideal_p"]) / profile["ideal_p"] * 80, 0, 100)
    score = int(round(np.dot(
        [temp_score, moisture_score, ph_score, organic_score, nitrogen_score, phosphorus_score],
        [0.18, 0.17, 0.18, 0.14, 0.18, 0.15],
    )))
    fertility = int(round(np.clip(score * 0.98 + values["organic"] * 2, 0, 100)))
    yield_per_acre = round(profile["base_yield"] * (0.6 + score / 250), 1)
    return {
        "score": score,
        "fertility": fertility,
        "yield_per_acre": yield_per_acre,
        "total_yield": round(yield_per_acre * values["area"], 1),
        "crop_name": profile["name"],
    }


def parse_form(form):
    values = {"crop": form.get("crop", "").strip().lower()}
    if values["crop"] not in CROP_PROFILES:
        raise ValueError("Choose a supported crop.")
    for field, (minimum, maximum) in FIELD_LIMITS.items():
        raw_value = form.get(field, "").strip()
        try:
            value = float(raw_value)
        except (TypeError, ValueError):
            raise ValueError(f"Enter a number for {field.replace('_', ' ')}.")
        if not minimum <= value <= maximum:
            raise ValueError(f"{field.replace('_', ' ').capitalize()} must be between {minimum:g} and {maximum:g}.")
        values[field] = value
    return values


def recommendation(values):
    profile = CROP_PROFILES[values["crop"]]
    if values["moisture"] < profile["ideal_moisture"] - 10:
        return "Soil moisture is below the preferred level. Plan a light irrigation cycle and add mulch to reduce water loss.", "Priority: Improve soil moisture"
    if values["moisture"] > profile["ideal_moisture"] + 12:
        return "The soil has extra moisture. Improve drainage and avoid irrigation until the top soil becomes less wet.", "Priority: Prevent water logging"
    if values["nitrogen"] < profile["ideal_n"] * 0.8:
        return "Nitrogen is low for this crop. Add a small split dose of nitrogen fertiliser or well-rotted compost after checking the field.", "Priority: Build nitrogen level"
    if values["phosphorus"] < profile["ideal_p"] * 0.8:
        return "Phosphorus is low. Apply a phosphorus-rich fertiliser near the root zone for stronger early growth.", "Priority: Improve phosphorus"
    if values["ph"] < 6:
        return "The soil is acidic. Use agricultural lime in the next soil preparation cycle to bring pH closer to neutral.", "Priority: Correct soil pH"
    if values["ph"] > 7.5:
        return "The soil is alkaline. Mix organic compost and check irrigation water quality to slowly improve pH.", "Priority: Correct soil pH"
    return "Apply a light organic compost dose within the next 7 days to keep your soil active and improve water holding.", "Priority: Keep moisture stable"


def serialize_record(record):
    item = dict(record)
    item["estimate"] = calculate_estimate(item)
    return item


@app.route("/")
def dashboard():
    with get_db() as connection:
        records = [serialize_record(row) for row in connection.execute(
            "SELECT * FROM crop_records ORDER BY created_at DESC, id DESC LIMIT 20"
        ).fetchall()]
    return render_template("index.html", crops=CROP_PROFILES, records=records, today=date.today().strftime("%d %B %Y").upper())


@app.post("/records")
def create_record():
    try:
        values = parse_form(request.form)
    except ValueError as error:
        flash(str(error), "error")
        return redirect(url_for("dashboard") + "#calculator")
    with get_db() as connection:
        connection.execute(
            """INSERT INTO crop_records
            (crop, area, temperature, moisture, ph, organic, nitrogen, phosphorus)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            tuple(values[field] for field in ("crop", "area", "temperature", "moisture", "ph", "organic", "nitrogen", "phosphorus")),
        )
    flash("Field report saved to your history.", "success")
    return redirect(url_for("dashboard") + "#history")


@app.get("/api/records")
def records_api():
    with get_db() as connection:
        records = [serialize_record(row) for row in connection.execute(
            "SELECT * FROM crop_records ORDER BY created_at DESC, id DESC LIMIT 50"
        ).fetchall()]
    return jsonify(records)


@app.post("/api/estimate")
def estimate_api():
    try:
        values = parse_form(request.form if request.form else request.json or {})
    except (TypeError, ValueError) as error:
        return jsonify({"error": str(error)}), 400
    estimate = calculate_estimate(values)
    estimate["recommendation"], estimate["recommendation_tag"] = recommendation(values)
    return jsonify(estimate)


@app.errorhandler(404)
def not_found(_error):
    return render_template("error.html", message="That page could not be found."), 404


@app.errorhandler(500)
def server_error(_error):
    return render_template("error.html", message="Something went wrong while loading Fasal."), 500


init_db()

if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG", "").lower() == "true")
