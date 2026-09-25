# Fasal

Fasal is a small crop-yield management dashboard for recording field history and turning soil and weather readings into an educational yield estimate. It uses Flask, SQLite, and NumPy; the responsive dashboard is served from Flask templates and static CSS.

## Run locally

1. Create and activate a virtual environment:

   ```bash
   python -m venv .venv
   # Windows PowerShell
   .\.venv\Scripts\Activate.ps1
   # macOS/Linux
   source .venv/bin/activate
   ```

2. Install dependencies and start the server:

   ```bash
   pip install -r requirements.txt
   python app.py
   ```

   Open <http://127.0.0.1:5000>.

The SQLite database is created automatically at `data/fasal.db` on first start. Set `FASAL_DATABASE` to use another SQLite path and `FASAL_SECRET_KEY` to provide a production secret. Estimates are educational, not agronomic advice.

## Features

- Record crop, field area, temperature, moisture, pH, organic matter, nitrogen, and phosphorus.
- Validate input ranges before saving a record.
- Calculate a weighted farm-health score and estimated yield using NumPy.
- Review the latest 20 saved reports and their calculated yield.
- Use `GET /api/records` for saved reports and `POST /api/estimate` for a JSON/form estimate without persisting it.
