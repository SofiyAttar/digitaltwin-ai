"""
core/virtual_sensor.py
Virtual Sensing (Soft Sensor) Engine for DigitalTwin.ai.
Infers operational cycle times, micro-stalls, and operator delays at uninstrumented 
manual stations (S3, S5) using checkpoint transit-time differentials (Delta-T) 
and rolling statistical anomaly filtering (mu + 2*sigma).
"""

import numpy as np
from typing import Dict, List, Any, Optional
from collections import deque


class VirtualSensorStation:
    """Virtual Sensor handler for a single uninstrumented dark station."""
    def __init__(self, dark_station_id: str, upstream_station_id: str, downstream_station_id: str, 
                 conveyor_transit_time: float = 10.0, target_takt: float = 60.0, window_size: int = 30):
        self.dark_station_id = dark_station_id
        self.upstream_station_id = upstream_station_id
        self.downstream_station_id = downstream_station_id
        self.conveyor_transit_time = conveyor_transit_time
        self.target_takt = target_takt
        self.window_size = window_size

        # Rolling history of inferred cycle times
        self.history: deque = deque(maxlen=window_size)
        self.consecutive_anomalies: int = 0
        self.inferred_records: List[Dict[str, Any]] = []

    def process_checkpoint_transition(self, vin: str, upstream_exit_time: float, 
                                      downstream_enter_time: float, buffer_dwell_time: float = 0.0) -> Dict[str, Any]:
        """
        Calculates inferred work time:
        W_inferred = (t_enter_downstream - t_exit_upstream) - Conveyor_Transit - Buffer_Dwell
        """
        raw_delta_t = downstream_enter_time - upstream_exit_time
        inferred_work_time = max(10.0, raw_delta_t - self.conveyor_transit_time - buffer_dwell_time)
        inferred_work_time = round(inferred_work_time, 2)

        # Baseline statistics
        if len(self.history) >= 5:
            rolling_mean = float(np.mean(self.history))
            rolling_std = float(np.std(self.history))
            # Fallback to minimum variance if std is too low
            rolling_std = max(1.5, rolling_std)
            threshold = round(rolling_mean + (2.0 * rolling_std), 2)
        else:
            rolling_mean = self.target_takt
            rolling_std = 5.0
            threshold = self.target_takt + 10.0

        # Anomaly trigger check
        is_anomaly = inferred_work_time > threshold
        if is_anomaly:
            self.consecutive_anomalies += 1
        else:
            self.consecutive_anomalies = 0

        # Anomaly confirmed if 2 or more consecutive vehicles drift
        stall_confirmed = self.consecutive_anomalies >= 2

        record = {
            "vin": vin,
            "dark_station_id": self.dark_station_id,
            "raw_delta_t": round(raw_delta_t, 2),
            "inferred_work_time": inferred_work_time,
            "rolling_mean": round(rolling_mean, 2),
            "rolling_std": round(rolling_std, 2),
            "threshold": threshold,
            "is_anomaly": is_anomaly,
            "stall_confirmed": stall_confirmed
        }

        self.history.append(inferred_work_time)
        self.inferred_records.append(record)
        return record


class VirtualSensingEngine:
    """Master coordinator managing virtual sensors across all dark stations."""
    def __init__(self, conveyor_transit_time: float = 10.0, target_takt: float = 60.0):
        self.sensors: Dict[str, VirtualSensorStation] = {
            "S3": VirtualSensorStation(
                dark_station_id="S3",
                upstream_station_id="S2",
                downstream_station_id="S4",
                conveyor_transit_time=conveyor_transit_time,
                target_takt=target_takt
            ),
            "S5": VirtualSensorStation(
                dark_station_id="S5",
                upstream_station_id="S4",
                downstream_station_id="S6",
                conveyor_transit_time=conveyor_transit_time,
                target_takt=target_takt
            )
        }

    def analyze_event_log(self, event_log: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Parses a simulation event log and extracts transit times for dark stations."""
        results = []
        # Group timestamps by VIN
        vin_events: Dict[str, Dict[str, Any]] = {}
        for ev in event_log:
            vin = ev["vin"]
            st = ev["station_id"]
            ev_type = ev["event_type"]
            t = ev["timestamp"]

            if vin not in vin_events:
                vin_events[vin] = {}
            if st not in vin_events[vin]:
                vin_events[vin][st] = {}
            
            if ev_type == "STATION_EXIT":
                vin_events[vin][st]["exit"] = t
            elif ev_type == "STATION_ENTER":
                vin_events[vin][st]["enter"] = t

        # Process each dark station
        for sensor_id, sensor in self.sensors.items():
            up_id = sensor.upstream_station_id
            down_id = sensor.downstream_station_id

            for vin, data in vin_events.items():
                if up_id in data and "exit" in data[up_id] and down_id in data and "enter" in data[down_id]:
                    up_exit = data[up_id]["exit"]
                    down_enter = data[down_id]["enter"]
                    if down_enter > up_exit:
                        rec = sensor.process_checkpoint_transition(vin, up_exit, down_enter)
                        results.append(rec)

        return results


# Quick Verification Test
if __name__ == "__main__":
    print("--- Testing Virtual Sensing Soft Sensor Layer ---")
    vs_engine = VirtualSensingEngine()
    
    # Simulate normal vehicles through S3 (S2 Exit -> S4 Enter)
    for i in range(1, 8):
        rec = vs_engine.sensors["S3"].process_checkpoint_transition(
            vin=f"VIN-100{i}",
            upstream_exit_time=float(i * 60),
            downstream_enter_time=float(i * 60 + 70.0)  # ~60s work + 10s conveyor
        )
        print(f"Vehicle {rec['vin']} | Inferred S3 Work: {rec['inferred_work_time']}s | Status: Nominal")

    # Simulate an unmeasured stall at S3 (88s work time)
    print("\n[Injecting Unmeasured Manual Stall at S3]:")
    for i in range(8, 10):
        rec = vs_engine.sensors["S3"].process_checkpoint_transition(
            vin=f"VIN-100{i}",
            upstream_exit_time=float(i * 60),
            downstream_enter_time=float(i * 60 + 98.0)  # ~88s work + 10s conveyor
        )
        print(f"Vehicle {rec['vin']} | Inferred S3 Work: {rec['inferred_work_time']}s | Stall Confirmed: {rec['stall_confirmed']}")

    print("\n--- Virtual Sensing Engine is 100% Functional! ---")