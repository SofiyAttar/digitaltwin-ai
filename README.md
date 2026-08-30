# DigitalTwin.ai: Predictive Cyber-Physical Digital Twin for Vehicle Assembly Lines

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![SimPy](https://img.shields.io/badge/Simulation-SimPy-orange.svg)](https://simpy.readthedocs.io/)
[![React](https://img.shields.io/badge/Dashboard-React%20%2F%20TanStack-blue.svg)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-teal.svg)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Accenture Innovation Challenge](https://img.shields.io/badge/Accenture_Challenge-2026_Round_2-purple.svg)](#)

> **Accenture Innovation Challenge 2026 — Problem Track 4 (DigitalTwin.ai)**  
> An autonomous, predictive digital twin that forecasts vehicle assembly bottlenecks 30–45 minutes in advance, infers uninstrumented manual "dark station" delays using Virtual Sensing, and evaluates operational interventions in parallel simulation sandboxes.

---

## 📌 Executive Summary

Modern vehicle assembly lines operate as tightly synchronized discrete-event chains. A micro-delay at a single station triggers a non-linear domino effect: upstream stations are blocked from releasing completed work, while downstream stations starve waiting for parts. Simultaneously, subtle assembly variations—such as minor fastener under-torque or part tolerance drift—pass visually unnoticed and cascade downstream, requiring expensive teardowns across dozens of sequenced chassis at final inspection.

Existing SCADA dashboards act as **retrospective historians**—they report where the line has already halted, leaving supervisors zero lead time to prevent buffer starvation before throughput is lost. Furthermore, up to 40% of the line (manual interior wiring and trim) lacks IoT sensors, creating critical operational blind spots.

**DigitalTwin.ai** shifts plant operations from reactive firefighting to proactive prevention through five core engineering pillars:
1. **Lookahead Shadow Simulation:** Fast-forwards discrete-event line dynamics 30–45 minutes ahead of real time to forecast queue overflows and starvation before disruptions physically freeze the floor.
2. **Virtual Sensing (Soft Sensors):** Ingests transit-time differences ($\Delta T$) between automated checkpoints and applies rolling statistical thresholds ($\mu + 2\sigma$) to monitor unsensored manual stations with zero hardware retrofit cost.
3. **Temporal Root-Cause Backtracking:** Isolates the chronologically earliest station that drifted, suppressing downstream cascade symptom alarms.
4. **3-Branch Prescriptive Sandbox:** Deterministically evaluates three operational adjustments (Dynamic Pacing, Buffer Divert, MTTA Relief Assist) in parallel simulation branches and ranks the action yielding the lowest total downtime.
5. **Quality Lineage Tracking:** Maintains a Digital Birth Certificate per chassis ID, tracking cumulative tolerance stack-up to intercept defect cascades before End-of-Line testing.

---

## 🏗️ System Architecture

```
                               ┌─────────────────────────────────────────────────────────────┐
                               │                 LAYER 1: DATA INGESTION                     │
                               │  - Automated Stations: Direct cycle timestamps & telemetry  │
                               │  - Dark Stations: VIRTUAL SENSING (Delta-T - Conveyor)      │
                               │  - Quality Lineage: Cumulative tolerance drift per VIN      │
                               └──────────────────────────────┬──────────────────────────────┘
                                                              │ Live Event Stream (T0)
                                                              ▼
                               ┌─────────────────────────────────────────────────────────────┐
                               │                LAYER 2: LOOKAHEAD ENGINE                    │
                               │  - Fast-forwards discrete-event simulation to T + 45 mins   │
                               │  - Forecasts buffer overflows, starvation, & line blocking  │
                               └──────────────────────────────┬──────────────────────────────┘
                                                              │ Bottleneck Forecasted
                                                              ▼
                               ┌─────────────────────────────────────────────────────────────┐
                               │                LAYER 3: ROOT-CAUSE ISOLATION                │
                               │  - Chronological first-deviation search across station DAG  │
                               │  - Isolates root node; suppresses ripple symptom alarms     │
                               └──────────────────────────────┬──────────────────────────────┘
                                                              │ Root Node Identified
                                                              ▼
                               ┌─────────────────────────────────────────────────────────────┐
                               │             LAYER 4: 3-BRANCH SANDBOX ENGINE                │
                               │  Simulates 3 candidate fixes in parallel:                   │
                               │    • Branch A: Dynamic Upstream Pacing (+10% Takt)          │
                               │    • Branch B: Dynamic Buffer Divert (Auxiliary Queue)      │
                               │    • Branch C: Historical MTTA Operator Relief Assist       │
                               │  --> Ranks fix with minimum total projected stoppage time   │
                               └──────────────────────────────┬──────────────────────────────┘
                                                              │ Validated Fix Selected
                                                              ▼
                               ┌─────────────────────────────────────────────────────────────┐
                               │             LAYER 5: MULTI-PERSONA DASHBOARD                │
                               │  • Floor Supervisor: Real-time topology & 1-Click Action    │
                               │  • Plant Manager: OEE Breakdown & Root-Cause Pareto         │
                               │  • Executive Leadership: Financial ROI & Scaling Roadmap    │
                               └─────────────────────────────────────────────────────────────┘
```

---

## 📐 Mathematical Formulation

### 1. Virtual Sensing (Transit Delta Decomposition)
For uninstrumented manual stations (e.g., Station S3 Interior Wiring and Station S5 Trim Fit), the engine estimates true operator cycle time without hardware sensors:

$$\Delta T_{\text{raw}} = t_{\text{enter}}(S_{N+1}) - t_{\text{exit}}(S_{N-1})$$

$$W_{\text{inferred}}(S_N) = \Delta T_{\text{raw}} - \left(N_{\text{legs}} \times T_{\text{conveyor}}\right) - T_{\text{buffer\_dwell}}$$

**Statistical Anomaly Filter:**
The system maintains a rolling window of the last $W=30$ chassis at Station $N$, calculating rolling mean ($\mu_{30}$) and standard deviation ($\sigma_{30}$):

$$\text{Anomaly Trigger} \iff W_{\text{inferred}}(S_N) > \mu_{30} + 2\sigma_{30} \quad \text{for } \ge 2 \text{ consecutive chassis}$$

### 2. Cumulative Quality Tolerance Stack-Up
Each chassis accumulates a cumulative normalized deviation score across sequential operations:

$$Z_{\text{chassis}} = \sum_{i=1}^{M} \left| \frac{\text{Tolerance}_i - \mu_i}{\sigma_i} \right|$$

* If $Z_{\text{chassis}} \ge 4.5$, the vehicle is flagged for **Preemptive Offline Inspection** at Buffer 5, preventing a multi-vehicle teardown cascade at final End-of-Line testing ($S_8$).

### 3. Prescriptive Decision Ranking Metric
Candidate operational interventions are evaluated in parallel simulation branches over a 45-minute lookahead horizon ($T_{\text{horizon}} = 2700\text{s}$):

$$\text{Disruption Cost} = \sum_{\text{stations}} \left(\text{Duration}_{\text{blocked}} + \text{Duration}_{\text{starved}}\right)$$

$$\text{Optimal Fix} = \arg\min_{\text{Branch } \in \{A, B, C\}} \left(\text{Disruption Cost}\right)$$

---

## 🚀 Getting Started & Execution

The project has two parts that run independently: a **FastAPI backend** (wraps the
Python simulation engines in `core/` as a JSON API) and a **React dashboard**
(`frontend/`). Note that the dashboard currently ships with its own self-contained
TypeScript port of the simulation (`frontend/src/lib/twin/`) and does not call the
backend yet — so you only need to run the backend if you're working on the API
itself or wiring the two together.

### Prerequisites
* Python 3.10 or higher
* Node.js 18+ (or Bun) and npm
* Git

### Backend (FastAPI)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/SofiyAttar/digitaltwin-ai.git
   cd digitaltwin-ai
   ```

2. **Create and activate a virtual environment:**
   ```bash
   # Windows
   python -m venv venv
   .\venv\Scripts\activate

   # Linux / macOS
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Launch the API server:**
   ```bash
   python -m uvicorn api:app --reload --port 8000
   ```

   The API will be available at `http://127.0.0.1:8000`, with interactive docs at
   `http://127.0.0.1:8000/docs`.

### Frontend (React dashboard)

1. **Install dependencies** (from the `frontend/` folder, in a separate terminal):
   ```bash
   cd frontend
   npm install
   ```

2. **Launch the dev server:**
   ```bash
   npm run dev
   ```

   The dashboard will be available at `http://localhost:5173`. It has three views:
   `/supervisor`, `/plant-manager`, and `/leadership`.

---

## 🧪 Interactive Demonstration & Stress-Test Scenarios

Use the interactive scenario buttons in the application sidebar to test the digital twin's core mechanisms:

### Scenario 1: Dark Station S3 Micro-Stall (Flow Bottleneck)
* **Trigger:** Station S3 (Manual Interior Wiring) experiences an unmeasured operator delay (cycle time drifts to 88–95s).
* **System Action:** Virtual Sensing detects the anomaly via transit delta $\Delta T$ $\rightarrow$ Lookahead engine projects Buffer 3 overflow and Station 2 blocking in 22 minutes $\rightarrow$ Root-Cause engine isolates S3 and suppresses cascade alarms $\rightarrow$ Prescriptive Engine evaluates Branch A, B, and C in parallel $\rightarrow$ Surfaces 1-Click Action Card saving **16.0 minutes of line downtime**.

### Scenario 2: Cumulative Tolerance Drift (Defect Cascade Preemption)
* **Trigger:** Stations S1 and S2 introduce subtle $+1.3\sigma$ tolerance variations (individual machine alarms do not fire).
* **System Action:** Quality Lineage engine calculates $Z_{\text{chassis}} > 4.5$ $\rightarrow$ Flags VIN `#1008` for early inspection at Buffer 5 before End-of-Line testing ($S_8$), preventing a 25-vehicle teardown cascade.

### Scenario 3: Shift Changeover Noise (False Alarm Resiliency)
* **Trigger:** Natural operator cycle variance during shift transition ($\pm 8\text{s}$ variance).
* **System Action:** Rolling $\mu + 2\sigma$ baseline accommodates natural human cadence $\rightarrow$ Zero false-positive panic alarms triggered, maintaining floor-level trust.

---

## 👥 Multi-Persona User Experience

* **🛠️ Floor Supervisor View** (`/supervisor`): Real-time animated line topology, lookahead time-scrubber slider (0 to 45 mins), active virtual sensor feeds, and 1-click execution cards.
* **📊 Plant Manager View** (`/plant-manager`): OEE metric tracking (Availability, Performance, Quality), station bottleneck Pareto charts, and First Pass Yield (FPY) trends.
* **💼 Executive Leadership View** (`/leadership`): Annual downtime financial savings calculator, payback period metrics, and a 3-phase multi-plant deployment roadmap.

These three views are implemented as routes in the React dashboard (`frontend/src/routes/`).

---

## 📦 Project Structure

```
digitaltwin-ai/
├── core/                           # Python simulation engines (FastAPI backend)
│   ├── factory_sim.py              # SimPy discrete-event physical line simulation
│   ├── virtual_sensor.py           # Transit delta-T soft sensing for dark stations
│   ├── quality_tracker.py          # Digital birth certificate & cumulative tolerance tracker
│   ├── lookahead_twin.py           # Fast-forward 45-minute shadow simulation engine
│   ├── root_cause.py               # Chronological temporal backtracking isolator
│   └── prescriptive.py             # 3-Branch parallel sandbox fix evaluator
├── data/
│   └── line_config.json            # Station parameters, takt times, buffer capacities
├── frontend/                       # React 19 + TanStack + Vite Dashboard
│   ├── public/                     # Static assets (favicons, robots.txt)
│   ├── src/
│   │   ├── components/             # Custom dashboard panels & topology visualizers
│   │   │   └── ui/                 # Radix UI / shadcn primitives (buttons, sliders, cards)
│   │   ├── hooks/                  # Custom React lifecycle & state hooks
│   │   ├── lib/
│   │   │   ├── twin/               # TypeScript port of simulation & virtual sensing logic
│   │   │   └── utils.ts            # Styling utilities (clsx, tailwind-merge)
│   │   ├── routes/                 # File-based routes (/supervisor, /plant-manager, /leadership)
│   │   └── styles.css              # Tailwind v4 dark-mode industrial control-room theme
│   ├── components.json             # shadcn UI configuration
│   ├── eslint.config.js            # Code quality & linter configuration
│   ├── package.json                # Frontend dependencies & dev scripts
│   ├── tsconfig.json               # TypeScript compiler options & path aliases
│   └── vite.config.ts              # Vite bundler & plugin configuration
├── api.py                          # FastAPI REST API wrapper (Uvicorn server)
├── requirements.txt                # Python backend dependencies
└── README.md                       # System architecture & documentation
```

> **Note:** `frontend/src/lib/twin/` currently duplicates the simulation logic in
> `core/` in TypeScript, so the dashboard runs independently of the FastAPI
> backend. Wiring the frontend to call `api.py` instead is a natural next step
> if you want a single source of truth for the simulation.

---

## ⚖️ License
This project is licensed under the MIT License — see the LICENSE file for details.