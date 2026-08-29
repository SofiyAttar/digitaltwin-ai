"""
api.py
FastAPI wrapper around the DigitalTwin.ai backend engines.
Mirrors the scenario logic in app.py, but returns JSON instead of
rendering Streamlit widgets — so a separate frontend (e.g. the React
dashboard) can call it directly.

Run with:
    uvicorn api:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Any, Dict

from core.factory_sim import AssemblyLineSimulation
from core.virtual_sensor import VirtualSensingEngine
from core.quality_tracker import QualityLineageTracker
from core.lookahead_twin import LookaheadShadowTwin
from core.root_cause import RootCauseIsolator
from core.prescriptive import PrescriptiveDecisionEngine

app = FastAPI(title="DigitalTwin.ai API")

# Allow the React dev server (Vite default: 5173, or Lovable's usual 8080) to call this API.
# Add your deployed frontend URL here too once you host it.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to specific origins before final submission if you want
    allow_methods=["*"],
    allow_headers=["*"],
)

SCENARIOS = {
    "nominal": "Nominal Baseline",
    "scenario-1": "Scenario 1: S3 Dark Station Stall",
    "scenario-2": "Scenario 2: Cumulative Defect Drift",
    "scenario-3": "Scenario 3: Shift Noise Resiliency",
}


def initialize_engine_state() -> Dict[str, Any]:
    """Fresh engine instances for a scenario run."""
    return {
        "sim": AssemblyLineSimulation(random_seed=42),
        "lookahead": LookaheadShadowTwin(lookahead_horizon_seconds=2700.0),
        "quality_tracker": QualityLineageTracker(cumulative_threshold=4.5),
        "vs_engine": VirtualSensingEngine(),
        "root_cause_isolator": RootCauseIsolator(takt_baseline=60.0),
        "prescriptive_engine": PrescriptiveDecisionEngine(evaluation_horizon_seconds=2700.0),
    }


def run_scenario(scenario_name: str) -> Dict[str, Any]:
    """Runs one scenario end-to-end across all engines and returns JSON-ready state."""
    engines = initialize_engine_state()
    sim = engines["sim"]
    lookahead = engines["lookahead"]
    quality_tracker = engines["quality_tracker"]
    vs_engine = engines["vs_engine"]
    rc_isolator = engines["root_cause_isolator"]
    prescriptive = engines["prescriptive_engine"]

    prescription: Dict[str, Any] = {}

    if scenario_name == "Scenario 1: S3 Dark Station Stall":
        sim.inject_bottleneck(station_id="S3", multiplier=1.7, num_vehicles=6)
        events = sim.run_simulation(until_time=1800.0, total_vehicles=25)
        lookahead_data = lookahead.run_lookahead_projection(
            current_time=1800.0,
            injected_bottlenecks={"S3": {"multiplier": 1.7, "num_vehicles": 6}},
        )
        rc_isolator.isolate_root_cause(lookahead_data["shadow_event_log"])
        prescription = prescriptive.evaluate_interventions(root_station_id="S3")

    elif scenario_name == "Scenario 2: Cumulative Defect Drift":
        sim.inject_quality_drift(station_id="S1", drift_bias=1.2, num_vehicles=10)
        sim.inject_quality_drift(station_id="S2", drift_bias=1.3, num_vehicles=10)
        events = sim.run_simulation(until_time=1800.0, total_vehicles=25)
        for ev in events:
            if ev["event_type"] == "STATION_EXIT":
                quality_tracker.record_station_tolerance(
                    vin=ev["vin"],
                    station_id=ev["station_id"],
                    tolerance_deviation=ev.get("tolerance_drift", 0.3),
                    current_timestamp=ev["timestamp"],
                )
        lookahead_data = lookahead.run_lookahead_projection(current_time=1800.0)

    elif scenario_name == "Scenario 3: Shift Noise Resiliency":
        sim.inject_bottleneck(station_id="S3", multiplier=1.1, num_vehicles=4)
        sim.inject_bottleneck(station_id="S5", multiplier=1.1, num_vehicles=4)
        events = sim.run_simulation(until_time=1800.0, total_vehicles=25)
        lookahead_data = lookahead.run_lookahead_projection(current_time=1800.0)

    else:  # Nominal Baseline
        events = sim.run_simulation(until_time=1800.0, total_vehicles=25)
        lookahead_data = lookahead.run_lookahead_projection(current_time=1800.0)

    return {
        "active_scenario": scenario_name,
        "snapshot": sim.get_snapshot(),
        "lookahead_data": lookahead_data,
        "prescription": prescription,
        "quality_summary": quality_tracker.get_summary_metrics(),
        "vs_records": vs_engine.analyze_event_log(events),
    }


@app.get("/api/scenarios")
def list_scenarios():
    """Lists the scenario keys the frontend can request."""
    return {"scenarios": list(SCENARIOS.keys())}


@app.post("/api/scenario/{scenario_key}")
def run_scenario_endpoint(scenario_key: str):
    """Runs a scenario by key (nominal, scenario-1, scenario-2, scenario-3) and returns full state."""
    if scenario_key not in SCENARIOS:
        raise HTTPException(status_code=404, detail=f"Unknown scenario '{scenario_key}'")
    return run_scenario(SCENARIOS[scenario_key])


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
