"""
ui/plant_manager_view.py
Plant Manager View for DigitalTwin.ai.
Features: OEE Breakdown, Bottleneck Pareto Chart, Scrap Reduction, 
and Defect Cascade Interception Trends.
"""

import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
import pandas as pd


def render_plant_manager_view(quality_summary: dict):
    st.markdown("### 📊 Plant Manager: Operational Efficiency & Continuous Improvement")
    st.caption("Weekly Production Trends • OEE Analytics • Defect Cascade Prevention • Root-Cause Pareto")

    # 1. High-Level OEE KPI Cards
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Overall Equipment Effectiveness (OEE)", "87.4%", delta="+3.8% vs Baseline (83.6%)")
    with col2:
        st.metric("Line Availability", "92.1%", delta="+4.2% (Downtime Reduced)")
    with col3:
        st.metric("Performance Rate", "96.2%", delta="Takt Maintained")
    with col4:
        fpy = quality_summary.get("estimated_first_pass_yield_pct", 98.2)
        st.metric("First Pass Yield (FPY)", f"{fpy}%", delta="+2.5% Scrap Teardown Reduced")

    st.markdown("---")

    col_left, col_right = st.columns(2)

    # 2. Station Bottleneck Pareto Chart
    with col_left:
        st.subheader("📉 Station Loss Minutes Pareto Chart (Weekly)")
        pareto_data = pd.DataFrame({
            "Station": ["S3 (Wiring - Manual)", "S5 (Trim - Manual)", "S4 (Powertrain)", "S1 (Welding)", "S2 (Framing)", "S6 (Fluid)", "S7 (ADAS)", "S8 (EOL)"],
            "Lost_Minutes": [142, 98, 45, 28, 22, 14, 11, 6]
        })
        fig_pareto = px.bar(
            pareto_data, x="Station", y="Lost_Minutes",
            title="Cumulative Lost Minutes by Originating Station",
            labels={"Lost_Minutes": "Lost Production Minutes", "Station": "Assembly Station"},
            color="Lost_Minutes", color_continuous_scale="Reds"
        )
        st.plotly_chart(fig_pareto, use_container_width=True)

    # 3. Quality Tolerance Drift & Teardown Prevention
    with col_right:
        st.subheader("🛡️ Cumulative Defect Interceptions (Pre-EOL)")
        drift_data = pd.DataFrame({
            "Shift": ["Mon Morning", "Mon Night", "Tue Morning", "Tue Night", "Wed Morning", "Wed Night", "Thu Morning"],
            "Defects_Intercepted_Pre_EOL": [4, 6, 3, 7, 5, 8, 4],
            "Teardowns_Prevented": [12, 18, 9, 21, 15, 24, 12]
        })
        fig_drift = px.line(
            drift_data, x="Shift", y=["Defects_Intercepted_Pre_EOL", "Teardowns_Prevented"],
            markers=True, title="Early Quality Flags vs Multi-Vehicle Teardowns Prevented",
            labels={"value": "Vehicle Count", "variable": "Metric"}
        )
        st.plotly_chart(fig_drift, use_container_width=True)

    # 4. Weekly Insight Summary Table
    st.subheader("📋 Continuous Improvement Diagnostics")
    st.table(pd.DataFrame([
        {"Area": "S3 Interior Wiring", "Primary Root Cause": "Manual clip stiffness on Variant SUV", "Mitigation": "Pacing adjustment + Roving Assist", "Impact": "42 mins saved/week"},
        {"Area": "S5 Door & Dashboard", "Primary Root Cause": "Operator handover variance at shift change", "Mitigation": "Dynamic Takt Threshold Calibration", "Impact": "28 mins saved/week"},
        {"Area": "S1/S2 Body Tolerance", "Primary Root Cause": "Cumulative weld fixture thermal drift", "Mitigation": "Early inspection routing at Buffer 5", "Impact": "14 teardowns avoided"}
    ]))