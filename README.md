# Fasal

Fasal is a responsive crop-yield dashboard. Its public website is a static app hosted by GitHub Pages; visitors can calculate a field estimate, save reports in their browser, review history, and export it as CSV.

## Public website

The GitHub Pages address for this repository is <https://aayushhhhh06.github.io/Cropwise-miniproject/>.

To enable or verify publishing:

1. Open the repository's **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select the `main` branch and the `/(root)` folder, then save.
4. Wait for the Pages deployment to finish in the **Actions** tab and open the website address above.

New changes merged into `main` are published automatically by GitHub Pages. The site is static, so the calculator runs in each visitor's browser. Reports are saved in that browser's local storage; they do not sync between devices or users. A shared online database requires a separately hosted backend and database service.

## Features

- Responsive dashboard for phones, tablets, and desktop browsers.
- Crop-specific estimates for rice, wheat, maize, cotton, and sugarcane.
- Validation for farm area, temperature, moisture, pH, organic matter, nitrogen, and phosphorus.
- Browser-saved crop history with per-record deletion, clear-history control, and CSV export.
- Educational recommendations based on the entered field readings.

## Optional Flask development server

The repository also retains a Flask/SQLite backend for local development. It is separate from the static GitHub Pages deployment. Install its packages and run it with:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install Flask numpy
python app.py
```

Open <http://127.0.0.1:5000>. On Windows PowerShell, activate the environment with `.venv\Scripts\Activate.ps1`. The Flask backend creates `data/fasal.db` automatically. Yield estimates are educational and are not agronomic advice.
