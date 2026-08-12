# CypherCorp — Next-Gen AI Data & AutoML Studio

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110.0-009688.svg?style=flat&logo=FastAPI&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.x-61DAFB.svg?style=flat&logo=React&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF.svg?style=flat&logo=Vite&logoColor=white)](https://vitejs.dev)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB.svg?style=flat&logo=Python&logoColor=white)](https://python.org)
[![Scikit-Learn](https://img.shields.io/badge/scikit--learn-1.4%2B-F7931E.svg?style=flat&logo=scikit-learn&logoColor=white)](https://scikit-learn.org)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

CypherCorp is an enterprise-grade AI Data Intelligence & AutoML platform. It unifies **Automated Exploratory Data Analysis (EDA)**, **Natural Language SQL querying**, and **Multi-Model AutoML Benchmarking** into a seamless, tenant-isolated workspace.

---

## Key Capabilities

- **Automated EDA Engine**: Instant statistical profiling, correlation matrices, IQR anomaly detection, and automated data health scoring.
- **Natural Language SQL Analyst**: Converts plain English business questions into secure, read-only SQL queries with zero hallucination explainers.
- **Multi-Model AutoML Studio**: Automated feature preprocessing, candidate benchmark trainer (Random Forest, Gradient Boosting, Linear/Ridge, Decision Trees), model leaderboard, and live real-time inference sandbox.
- **Enterprise Security & Tenant Isolation**: Secure JWT authentication, per-user file segregation (`uploads/{user_id}/`), and query isolation.
- **Modern Minimalist UI**: Built with React and tailored vanilla CSS design system.

---

## Project Structure

```text
cyphercorp/
├── backend/                  # FastAPI Application
│   ├── app/
│   │   ├── auth/             # JWT authentication & user management
│   │   ├── datasets/         # Dataset upload, isolation, and routing
│   │   ├── profiling/        # Automated EDA profiling & visualizations
│   │   ├── sql/              # Natural language SQL engine & validator
│   │   ├── ml/               # AutoML trainer, preprocessor, and predictor
│   │   ├── database.py       # SQLModel database session engine
│   │   └── main.py           # FastAPI application entrypoint
│   ├── requirements.txt      # Python dependencies
│   └── .env.example          # Backend environment template
├── frontend/                 # React + Vite Frontend
│   ├── src/
│   │   ├── components/       # Reusable UI components (Header, Sidebar)
│   │   ├── pages/            # Dashboard, Datasets, Analysis, SqlAnalyst, MlStudio, Login
│   │   ├── services/         # Axios API client & auth interceptors
│   │   └── styles/           # Global design system & responsive CSS
│   ├── package.json          # Node dependencies
│   └── .env.example          # Frontend environment template
├── tests/                    # Automated unit & integration tests (29 tests)
└── README.md
```

---

## Quick Start

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
# On Windows:
.\.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn app.main:app --reload --port 8000
```
Backend API will run at `http://127.0.0.1:8000` (Swagger docs at `http://127.0.0.1:8000/docs`).

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run Vite dev server
npm run dev
```
Frontend UI will run at `http://localhost:5173`.

---

## Running Tests

```bash
cd backend
python -m unittest discover -s ../tests -p "test_*.py"
```

---

## License

This project is open-source and licensed under the [MIT License](LICENSE).
