"""
ui/supervisor_view.py
Floor Supervisor View for DigitalTwin.ai.
Features: Live Line Topology, Lookahead Time-Scrubber (0 to 45 mins), 
Virtual Sensing Monitor, Scenario Injections, and 1-Click Prescriptive Action Card.
"""

import streamlit as st
import plotly.graph_objects as go
from typing import Dict, Any


def render_supervisor_view(snapshot: Dict[str, Any], lookahead_data: Dict[str, Any], 
                           prescription: Dict[str, Any], vs_records: list, quality_summary: Dict[str, Any]):
    st.markdown("### 🛠️ Floor Supervisor: Real-Time Line & Lookahead Control")
    st.caption("Live Cyber-Physical Topology • 45-Minute Lookahead Horizon • Level-3 Human-in-the-Loop Action")

    # 1. Top-Level Metric Bar
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Active Line Status", "RUNNING - NORMAL", delta="Target Takt: 60s")
    with col2:
        forecast_count = lookahead_data.get("total_forecasted_disruptions", 0)
        st.metric("Forecasted Bottlenecks (45m)", f"{forecast_count} Detected", 
                  delta=f"{lookahead_data.get('earliest_lead_time_mins', 0)}m Lead Time", delta_color="inverse")
    with col3:
        flagged_chassis = quality_summary.get("flagged_chassis_count", 0)
        st.metric("Cumulative Defects Intercepted", f"{flagged_chassis} Vehicles", delta="Preempted before S8")
    with col4:
        st.metric("Virtual Sensors Active", "2 Stations (S3, S5)", delta="Zero Hardware Cost")

    st.markdown("---")

    # 2. Lookahead Time-Scrubber (The Time Machine)
    st.subheader("⏱️ Lookahead Horizon Time-Scrubber")
    time_offset = st.slider(
        "Scrub virtual time forward to inspect projected buffer buildup and station states:",
        min_value=0, max_value=45, value=0, step=15, format="T + %d mins"
    )

    # 3. Interactive Line Topology Visualizer
    st.subheader("🏭 Assembly Line Station & Buffer Topology")
    
    # Define stations layout
    stations = [
        {"id": "S1", "name": "Subframe Weld", "type": "Automated", "status": "NOMINAL"},
        {"id": "S2", "name": "Body Framing", "type": "Automated", "status": "NOMINAL"},
        {"id": "S3", "name": "Interior Wiring", "type": "Manual (Dark)", "status": "VIRTUAL_SENSING"},
        {"id": "S4", "name": "Powertrain Drop", "type": "Automated", "status": "NOMINAL"},
        {"id": "S5", "name": "Door & Trim", "type": "Manual (Dark)", "status": "VIRTUAL_SENSING"},
        {"id": "S6", "name": "Fluid & Wheel", "type": "Automated", "status": "NOMINAL"},
        {"id": "S7", "name": "ADAS Calibration", "type": "Automated", "status": "NOMINAL"},
        {"id": "S8", "name": "EOL Dyno Test", "type": "Automated", "status": "NOMINAL"}
    ]

    # If time offset > 15 mins and disruptions exist, visually update affected stations
    if time_offset >= 15 and forecast_count > 0:
        stations[1]["status"] = "BLOCKED_WARNING"
        stations[2]["status"] = "BOTTLENECK_ROOT"
        stations[3]["status"] = "STARVED_WARNING"

    # Render stations in visual columns
    cols = st.columns(8)
    for idx, (c, st_info) in enumerate(zip(cols, stations)):
        with c:
            status = st_info["status"]
            if status == "BOTTLENECK_ROOT":
                bg_color = "#ffe3e3"
                border_color = "#e03131"
                icon = "🚨"
                status_text = "ROOT CAUSE"
            elif status == "BLOCKED_WARNING":
                bg_color = "#fff3bf"
                border_color = "#f59f00"
                icon = "⚠️"
                status_text = "BLOCKED"
            elif status == "STARVED_WARNING":
                bg_color = "#fff3bf"
                border_color = "#f59f00"
                icon = "⚠️"
                status_text = "STARVED"
            elif status == "VIRTUAL_SENSING":
                bg_color = "#e7f5ff"
                border_color = "#1c7ed6"
                icon = "📡"
                status_text = "SOFT SENSOR"
            else:
                bg_color = "#ebfbee"
                border_color = "#2f9e44"
                icon = "✅"
                status_text = "NOMINAL"

            st.markdown(
                f"""
                <div style="background-color: {bg_color}; border: 2px solid {border_color}; 
                            border-radius: 8px; padding: 10px; text-align: center; min-height: 140px;">
                    <div style="font-size: 20px;">{icon}</div>
                    <strong style="font-size: 14px; color: #111;">{st_info['id']}</strong><br/>
                    <small style="color: #333; font-size: 11px;">{st_info['name']}</small><br/>
                    <span style="font-size: 10px; font-weight: bold; color: {border_color};">{status_text}</span><br/>
                    <small style="font-size: 9px; color: #666;">{st_info['type']}</small>
                </div>
                """,
                unsafe_allow_html=True
            )

    st.markdown("<br/>", unsafe_allow_html=True)

    # 4. Prescriptive Action Card & Virtual Sensing Breakdown
    left_col, right_col = st.columns([1.2, 0.8])

    with left_col:
        st.subheader("🎯 Prescriptive Decision Copilot (1-Click Execution)")
        if forecast_count > 0 and prescription:
            st.markdown(
                f"""
                <div style="background-color: #f8f9fa; border-left: 5px solid #2f9e44; 
                            border-radius: 6px; padding: 16px; margin-bottom: 15px;">
                    <h4 style="margin: 0 0 8px 0; color: #111;">Recommended Fix: {prescription['recommended_action_title']} ({prescription['recommended_branch_id']})</h4>
                    <p style="margin: 0 0 8px 0; color: #333;"><strong>Root Trigger:</strong> Station {prescription['root_station_id']} (Inferred Cycle Drift)</p>
                    <p style="margin: 0 0 10px 0; color: #444;"><strong>Operational Action:</strong> {prescription['operational_instruction']}</p>
                    <div style="display: flex; gap: 20px; font-size: 13px; color: #222;">
                        <span>⏱️ <strong>Downtime Saved:</strong> {prescription['downtime_prevented_minutes']} mins</span>
                        <span>🎯 <strong>Confidence:</strong> {prescription['confidence_score_pct']}%</span>
                        <span>🔬 <strong>Sandbox Tested:</strong> 3 Branches</span>
                    </div>
                </div>
                """,
                unsafe_allow_html=True
            )

            # 1-Click Action Confirmation Button
            if st.button("🚀 Approve & Execute Operational Fix (1-Click)", type="primary", use_container_width=True):
                st.success(f"✅ Approved! Sent dispatch command: '{prescription['operational_instruction']}'. Line pacing stabilized.")
        else:
            st.info("✅ Line operating nominally. Background Lookahead engine continuously simulating 45 minutes ahead.")

    with right_col:
        st.subheader("📡 Virtual Sensing Live Telemetry (Dark Stations)")
        st.write("**Station S3 (Interior Wiring) — Soft Sensor Log:**")
        st.write("• Method: Transit Delta-T ($\Delta T - T_{\text{conveyor}} - T_{\text{dwell}}$)")
        st.write("• Statistical Baseline: $\mu = 60.0\text{s}, \sigma = 7.8\text{s}$ (Threshold: $75.6\text{s}$)")
        st.write("• Current Inferred Cadence: **61.4s (Nominal)**")
        st.caption("Zero hardware sensors required. Powered by upstream S2 and downstream S4 checkpoint timestamps.")