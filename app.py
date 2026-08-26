"""
app.py
Master Streamlit Application for DigitalTwin.ai.
Orchestrates the 5-layer backend simulation engines, manages interactive scenario 
state, and routes across the 3 stakeholder views (Supervisor, Plant Manager, Leadership).
"""

import streamlit as st
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.append(str(Path(__file__).resolve().parent))

from core.factory_sim import AssemblyLineSimulation
from core.virtual_sensor import VirtualSensingEngine
from core.quality_tracker import QualityLineageTracker
from core.lookahead_twin import LookaheadShadowTwin
from core.root_cause import RootCauseIsolator
from core.prescriptive import PrescriptiveDecisionEngine

from ui.supervisor_view import render_supervisor_view
from ui.plant_manager_view import render_plant_manager_view
from ui.leadership_view import render_leadership_view

# Page Configuration
st.set_page_config(
    page_title="DigitalTwin.ai | Predictive Assembly Line Twin",
    page_icon="🏭",
    layout="wide",
    initial_sidebar_state="expanded"
)

# -----------------------------------------------------------------------------
# 1. State Management & Scenario Initialization
# -----------------------------------------------------------------------------
def initialize_engine_state():
    """Initializes or resets the digital twin simulation and analytical engines."""
    sim = AssemblyLineSimulation(random_seed=42)
    lookahead = LookaheadShadowTwin(lookahead_horizon_seconds=2700.0)
    quality_tracker = QualityLineageTracker(cumulative_threshold=4.5)
    vs_engine = VirtualSensingEngine()
    root_cause_isolator = RootCauseIsolator(takt_baseline=60.0)
    prescriptive_engine = PrescriptiveDecisionEngine(evaluation_horizon_seconds=2700.0)

    return {
        "sim": sim,
        "lookahead": lookahead,
        "quality_tracker": quality_tracker,
        "vs_engine": vs_engine,
        "root_cause_isolator": root_cause_isolator,
        "prescriptive_engine": prescriptive_engine,
        "active_scenario": "Nominal Baseline",
        "lookahead_data": {},
        "prescription": {},
        "quality_summary": {},
        "snapshot": {},
        "vs_records": []
    }

if "twin_state" not in st.session_state:
    st.session_state.twin_state = initialize_engine_state()

# -----------------------------------------------------------------------------
# 2. Scenario Runner Routines
# -----------------------------------------------------------------------------
def run_scenario(scenario_name: str):
    """Executes a specific factory test scenario across all 5 backend engines."""
    st.session_state.twin_state = initialize_engine_state()
    state = st.session_state.twin_state
    state["active_scenario"] = scenario_name

    sim = state["sim"]
    lookahead = state["lookahead"]
    quality_tracker = state["quality_tracker"]
    vs_engine = state["vs_engine"]
    rc_isolator = state["root_cause_isolator"]
    prescriptive = state["prescriptive_engine"]

    if scenario_name == "Scenario 1: S3 Dark Station Stall":
        # Inject unmeasured manual delay at S3
        sim.inject_bottleneck(station_id="S3", multiplier=1.7, num_vehicles=6)
        events = sim.run_simulation(until_time=1800.0, total_vehicles=25)
        
        # Run Lookahead 45 mins ahead
        state["lookahead_data"] = lookahead.run_lookahead_projection(
            current_time=1800.0,
            injected_bottlenecks={"S3": {"multiplier": 1.7, "num_vehicles": 6}}
        )
        # Isolate Root Cause & Prescribe Fix
        diagnosis = rc_isolator.isolate_root_cause(state["lookahead_data"]["shadow_event_log"])
        state["prescription"] = prescriptive.evaluate_interventions(root_station_id="S3")

    elif scenario_name == "Scenario 2: Cumulative Defect Drift":
        # Inject subtle tolerance drift at S1 and S2
        sim.inject_quality_drift(station_id="S1", drift_bias=1.2, num_vehicles=10)
        sim.inject_quality_drift(station_id="S2", drift_bias=1.3, num_vehicles=10)
        events = sim.run_simulation(until_time=1800.0, total_vehicles=25)

        for ev in events:
            if ev["event_type"] == "STATION_EXIT":
                quality_tracker.record_station_tolerance(
                    vin=ev["vin"],
                    station_id=ev["station_id"],
                    tolerance_deviation=ev.get("tolerance_drift", 0.3),
                    current_timestamp=ev["timestamp"]
                )
        state["lookahead_data"] = lookahead.run_lookahead_projection(current_time=1800.0)

    elif scenario_name == "Scenario 3: Shift Noise Resiliency":
        # Inject natural human variance without actual stall
        sim.inject_bottleneck(station_id="S3", multiplier=1.1, num_vehicles=4)
        sim.inject_bottleneck(station_id="S5", multiplier=1.1, num_vehicles=4)
        events = sim.run_simulation(until_time=1800.0, total_vehicles=25)
        state["lookahead_data"] = lookahead.run_lookahead_projection(current_time=1800.0)

    else:  # Nominal Baseline
        events = sim.run_simulation(until_time=1800.0, total_vehicles=25)
        state["lookahead_data"] = lookahead.run_lookahead_projection(current_time=1800.0)

    # Capture state outputs
    state["snapshot"] = sim.get_snapshot()
    state["quality_summary"] = quality_tracker.get_summary_metrics()
    state["vs_records"] = vs_engine.analyze_event_log(events)

# Initialize on first load
if not st.session_state.twin_state["snapshot"]:
    run_scenario("Nominal Baseline")

# -----------------------------------------------------------------------------
# 3. Sidebar Controls & Persona Navigation
# -----------------------------------------------------------------------------
with st.sidebar:
    st.image("https://img.icons8.com/color/96/car-assembly-line.png", width=64)
    st.title("DigitalTwin.ai")
    st.caption("Predictive Cyber-Physical Digital Twin")

    st.markdown("---")
    st.subheader("👤 Stakeholder Persona")
    selected_role = st.radio(
        "Select Active Role:",
        ["🛠️ Floor Supervisor", "📊 Plant Manager", "💼 Executive Leadership"],
        index=0
    )

    st.markdown("---")
    st.subheader("🧪 Interactive Stress-Test Scenarios")
    
    if st.button("🟢 Nominal Shift Baseline", use_container_width=True):
        run_scenario("Nominal Baseline")
        st.rerun()

    if st.button("🚨 Scenario 1: Dark Station S3 Stall", use_container_width=True):
        run_scenario("Scenario 1: S3 Dark Station Stall")
        st.rerun()

    if st.button("🛡️ Scenario 2: Cumulative Defect Drift", use_container_width=True):
        run_scenario("Scenario 2: Cumulative Defect Drift")
        st.rerun()

    if st.button("🔄 Scenario 3: Shift Changeover Noise", use_container_width=True):
        run_scenario("Scenario 3: Shift Noise Resiliency")
        st.rerun()

    st.markdown("---")
    current_sc = st.session_state.twin_state["active_scenario"]
    st.info(f"**Active State:** {current_sc}")

# -----------------------------------------------------------------------------
# 4. View Routing
# -----------------------------------------------------------------------------
state = st.session_state.twin_state

if selected_role == "🛠️ Floor Supervisor":
    render_supervisor_view(
        snapshot=state["snapshot"],
        lookahead_data=state["lookahead_data"],
        prescription=state["prescription"],
        vs_records=state["vs_records"],
        quality_summary=state["quality_summary"]
    )
elif selected_role == "📊 Plant Manager":
    render_plant_manager_view(
        quality_summary=state["quality_summary"]
    )
elif selected_role == "💼 Executive Leadership":
    render_leadership_view()