# DigitalTwin.ai: Predictive Cyber-Physical Digital Twin for Vehicle Assembly Lines

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![SimPy](https://img.shields.io/badge/Simulation-SimPy-orange.svg)](https://simpy.readthedocs.io/)
[![Streamlit](https://img.shields.io/badge/Dashboard-Streamlit-red.svg)](https://streamlit.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

> **Accenture Innovation Challenge 2026 — Problem Track 4 (DigitalTwin.ai)**  
> An autonomous, predictive digital twin that forecasts vehicle assembly bottlenecks 30–45 minutes in advance, infers manual "dark station" delays using Virtual Sensing, and evaluates operational interventions in parallel simulation sandboxes.

---

## 📌 Executive Summary

Traditional manufacturing dashboards act as retrospective historians—they display red lights only after a station has stalled, leaving plant teams to react after upstream blocking and downstream starvation have already disrupted the shift. Furthermore, up to 40% of vehicle assembly tasks (like interior wiring and trim) lack IoT hardware sensors.

**DigitalTwin.ai** shifts factory operations from reactive firefighting to proactive prevention through five core engineering mechanisms:
1. **Lookahead Shadow Simulation:** Continuously runs fast-forward discrete-event simulations 30–45 minutes ahead of real time to detect queue overflows and starvation before physical occurrence.
2. **Virtual Sensing (Soft Sensors):** Ingests transit-time differences ($\Delta T$) between automated checkpoints and applies rolling statistical thresholds ($\mu + 2\sigma$) to monitor unsensored manual stations with zero hardware cost.
3. **Temporal Root-Cause Backtracking:** Pinpoints the chronologically earliest station that drifted, filtering out dozens of downstream symptom alarms.
4. **3-Branch Prescriptive Sandbox:** Deterministically evaluates three operational adjustments (Dynamic Pacing, Buffer Divert, MTTA Relief Assist) in parallel simulation branches and ranks the action yielding the lowest total downtime.
5. **Quality Lineage Tracking:** Maintains a Digital Birth Certificate per chassis ID, tracking cumulative tolerance stack-up to intercept defect cascades before End-of-Line testing.

---

## 🏗️ System Architecture
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
---

## 🚀 Getting Started & Execution

### Prerequisites
* Python 3.10 or higher
* Git

### Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/SofiyAttar/digitaltwin-ai.git
   cd digitaltwin-ai