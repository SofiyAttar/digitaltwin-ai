"""
ui/leadership_view.py
Executive Leadership View for DigitalTwin.ai.
Features: Interactive Financial ROI Calculator, Multi-Plant Rollout Roadmap, 
and Risk Mitigation Strategy.
"""

import streamlit as st
import plotly.express as px
import pandas as pd


def render_leadership_view():
    st.markdown("### 💼 Executive Leadership: Business Case & Multi-Plant Scaling")
    st.caption("Financial ROI Model • Downtime Cost Savings • Multi-Site Rollout Roadmap")

    # 1. Interactive ROI Calculator
    st.subheader("💰 Annual Downtime Cost Savings Calculator")
    
    col_input1, col_input2, col_input3 = st.columns(3)
    with col_input1:
        downtime_cost_per_hour = st.number_input("Average Line Cost per Hour ($)", min_value=5000, max_value=50000, value=15000, step=2500)
    with col_input2:
        hours_prevented_per_month = st.slider("Downtime Hours Prevented per Line / Month", min_value=5, max_value=40, value=18, step=1)
    with col_input3:
        num_assembly_lines = st.slider("Total Deployed Assembly Lines (Sites)", min_value=1, max_value=10, value=3, step=1)

    # ROI Math
    annual_hours_saved = hours_prevented_per_month * 12 * num_assembly_lines
    annual_cost_savings = annual_hours_saved * downtime_cost_per_hour
    implementation_cost = 180000 + (num_assembly_lines * 40000)  # Software + Configuration
    payback_months = round((implementation_cost / (annual_cost_savings / 12.0)), 1)

    st.markdown(
        f"""
        <div style="background-color: #f1f8e9; border: 2px solid #558b2f; border-radius: 8px; padding: 18px; margin: 15px 0;">
            <h3 style="color: #2e7d32; margin: 0 0 10px 0;">Projected Net Annual Savings: ${annual_cost_savings:,.0f} / Year</h3>
            <p style="margin: 0 0 5px 0; color: #111;">• <strong>Total Annual Downtime Hours Prevented:</strong> {annual_hours_saved:,} hours</p>
            <p style="margin: 0 0 5px 0; color: #111;">• <strong>Estimated Implementation Cost:</strong> ${implementation_cost:,.0f}</p>
            <p style="margin: 0; color: #111;">• <strong>Projected Payback Period:</strong> <strong style="color: #2e7d32;">{payback_months} Months</strong></p>
        </div>
        """,
        unsafe_allow_html=True
    )

    st.markdown("---")

    # 2. Multi-Plant Phased Rollout Roadmap
    st.subheader("🗺️ Multi-Plant Phased Deployment Roadmap")
    roadmap_df = pd.DataFrame([
        {"Phase": "Phase 1: Pilot Line (Assembly Plant 1)", "Start": "Month 1", "End": "Month 3", "Scope": "8-Station Trim & Chassis Line (Shadow Mode)", "Completion": 100},
        {"Phase": "Phase 2: Full Plant Rollout (Plant 1 & 2)", "Start": "Month 4", "End": "Month 7", "Scope": "Body, Paint & General Assembly (3 Lines)", "Completion": 40},
        {"Phase": "Phase 3: Multi-Site Global Scaling (Plants 1-5)", "Start": "Month 8", "End": "Month 12", "Scope": "5 Manufacturing Sites + Enterprise Fleet Analytics", "Completion": 0}
    ])
    st.table(roadmap_df[["Phase", "Scope", "Start", "End"]])

    # 3. Enterprise Integration & Risk Mitigations
    st.subheader("🛡️ Enterprise Integration & Risk Mitigations")
    st.write("**1. Non-Disruptive OT/PLC Integration:** DigitalTwin.ai operates strictly as a read-only shadow engine. It requires zero modifications to live PLC ladder logic or physical hardware controllers.")
    st.write("**2. False Alarm Protection:** The Virtual Sensing layer uses calibrated $\mu + 2\sigma$ statistical baselines over rolling 30-chassis windows, preventing alarm fatigue during routine shift changeovers.")
    st.write("**3. Level-3 Human-in-the-Loop Governance:** Prescriptive recommendations always require supervisor sign-off before execution, maintaining complete operational accountability.")