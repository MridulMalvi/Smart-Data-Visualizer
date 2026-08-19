# Smart Data Visualizer

An elegant, interactive, and fully local AI-powered data visualization dashboard. Upload any CSV or XLSX file, ask questions in plain English, configure charts, and get automatic AI-generated insights—all running entirely on your machine .

---

## 🌟 Key Features

*   **File Upload & Parsing**: Supports CSV and XLSX files up to 50MB. Auto-detects data types (numeric, date, text, boolean) and handles missing values.
*   **Bento Grid Dashboard**: An aesthetic, responsive, claymorphic layout featuring a dataset preview table, summary stats, filter builders, charts, and AI sections.
*   **Zero-Cost Natural Language Queries (NLQ)**: Ask questions like `"show sales by category as bar chart"` or `"trend of price over date"`. Employs deterministic regex parser + `rapidfuzz` fuzzy column-matching (runs instantly on CPU, no LLM required).
*   **Local AI Insights (NLG)**: Automatically generates summaries and data observations using Google's `flan-t5-small` model running locally on your CPU. Fallbacks gracefully to template-based insights if offline.
*   **6 Interactive Chart Types**: Bar, Line, Scatter, Histogram, Pie, and Box Plots powered by Recharts with custom tooltips.
*   **ML & Math Add-ons**: Toggleable linear regression trendlines and outlier detection (IQR and Z-Score methods) visualized directly on the canvas.
*   **CSV & PNG Exports**: Save your filtered data as a CSV or export the rendered chart as a PNG image with a single click.

---

## 🛠️ Technology Stack

| Layer | Technologies | Role |
| :--- | :--- | :--- |
| **Frontend** | React (Vite), Zustand, Recharts, Tailwind CSS v4, Lucide React | Claymorphic UI, global state management, interactive SVG charting |
| **Backend** | FastAPI, Pandas, NumPy, Scikit-learn, RapidFuzz | In-memory thread-safe store, data parsing, linear regression, fuzzy parsing |
| **Local AI** | Hugging Face Transformers, PyTorch | Offline CPU text generation (`google/flan-t5-small`) |

---

## 🚀 Setup & Installation

Ensure you have **Node.js (v18+)** and **Python (v3.10+)** installed.

### 1. Backend Setup

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Create and activate a Python virtual environment:
    ```bash
    python -m venv .venv
    # On Windows (PowerShell):
    .venv\Scripts\activate
    # On macOS/Linux:
    source .venv/bin/activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
    *Note: If you are running Python 3.14+, use `pip install torch transformers sentencepiece accelerate` to install compatible wheels.*
4.  Start the FastAPI server:
    ```bash
    uvicorn app.main:app --reload --port 8000
    ```
    *The backend will start at `http://localhost:8000`. On the very first run, it will download the 300MB `flan-t5-small` weights automatically to your local Hugging Face cache folder.*

---

### 2. Frontend Setup

1.  Navigate to the frontend directory:
    ```bash
    cd ../frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the Vite dev server:
    ```bash
    npm run dev
    ```
    *The web application will open at `http://localhost:5173`. Vite is pre-configured to proxy `/api/*` requests to the FastAPI backend.*

---

## 🧪 Running Tests

To run the integration and unit tests for the backend (covering uploads, filters, chart mathematical computations, and NLQ resolutions):

```bash
cd backend
.venv\Scripts\activate
pytest tests/ -v
```

---

## 🎨 Design System & Accessibility

*   **Claymorphism**: Cards feature soft, inflated 3D-like borders using dual-tone offset shadows, custom rounded shapes (`rounded-3xl`), and responsive hover/active micro-animations.
*   **Bento Grid**: Asymmetric, responsive alignment designed to maximize screen real estate.
*   **Dual Theme**: Full light/dark mode support mapped via custom CSS variable tokens, respecting system default preferences.
*   **A11y**: Screen reader semantic markup (`main`, `header`, `footer`), explicit `aria-labels` on form elements/buttons, and visible keyboard focus indicators.
