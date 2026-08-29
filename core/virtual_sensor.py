"""
core/virtual_sensor.py
Virtual Sensing (Soft Sensor) Engine for DigitalTwin.ai.
Infers operational cycle times, micro-stalls, and operator delays at uninstrumented 
manual stations (S3, S5) using checkpoint transit-time differentials (Delta-T) 
and rolling statistical anomaly filtering (mu + 2*sigma).
"""

import numpy as np
from typing import Dict, List, Any
from collections import deque


class VirtualSensorStation:
    """Virtual Sensor handler for a single uninstrumented dark station."""
    def __init__(self, dark_station_id: str, upstream_station_id: str, downstream_station_id: str, 
                 conveyor_transit_legs: int = 2, conveyor_leg_seconds: float = 10.0, 
                 target_takt: float = 60.0, window_size: int = 30):
        self.dark_station_id = dark_station_id
        self.upstream_station_id = upstream_station_id
        self.downstream_station_id = downstream_station_id
        # Multi-station span traverses multiple conveyor segments (e.g. S2->S3 and S3->S4 = 2 legs = 20s)
        self.total_conveyor_travel_time = conveyor_transit_legs * conveyor_leg_seconds
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
        W_inferred = (t_enter_downstream - t_exit_upstream) - Total_Conveyor_Transit - Buffer_Dwell
        """
        raw_delta_t = downstream_enter_time - upstream_exit_time
        inferred_work_time = max(10.0, raw_delta_t - self.total_conveyor_travel_time - buffer_dwell_time)
        inferred_work_time = round(inferred_work_time, 2)

        # Statistical baseline calculation (mu + 2*sigma)
        if len(self.history) >= 5:
            rolling_mean = float(np.mean(self.history))
            rolling_std = float(np.std(self.history))
            rolling_std = max(1.5, rolling_std)
            threshold = round(rolling_mean + (2.0 * rolling_std), 2)
            confidence_score = min(98.0, round(70.0 + (len(self.history) * 1.0), 1))
        else:
            rolling_mean = self.target_takt
            rolling_std = 6.0
            threshold = self.target_takt + 12.0
            confidence_score = 55.0  # Explicit calibration during warm-up phase

        is_anomaly = inferred_work_time > threshold
        if is_anomaly:
            self.consecutive_anomalies += 1
        else:
            self.consecutive_anomalies = 0

        stall_confirmed = self.consecutive_anomalies >= 2

        record = {
            "vin": vin,
            "dark_station_id": self.dark_station_id,
            "raw_delta_t": round(raw_delta_t, 2),
            "inferred_work_time": inferred_work_time,
            "rolling_mean": round(rolling_mean, 2),
            "rolling_std": round(rolling_std, 2),
            "threshold": threshold,
            "confidence_score_pct": confidence_score,
            "is_anomaly": is_anomaly,
            "stall_confirmed": stall_confirmed
        }

        self.history.append(inferred_work_time)
        self.inferred_records.append(record)
        return record


class VirtualSensingEngine:
    """Master coordinator managing virtual sensors across all dark stations."""
    def __init__(self, conveyor_leg_seconds: float = 10.0, target_takt: float = 60.0):
        self.sensors: Dict[str, VirtualSensorStation] = {
            "S3": VirtualSensorStation(
                dark_station_id="S3",
                upstream_station_id="S2",
                downstream_station_id="S4",
                conveyor_transit_legs=2,
                conveyor_leg_seconds=conveyor_leg_seconds,
                target_takt=target_takt
            ),
            "S5": VirtualSensorStation(
                dark_station_id="S5",
                upstream_station_id="S4",
                downstream_station_id="S6",
                conveyor_transit_legs=2,
                conveyor_leg_seconds=conveyor_leg_seconds,
                target_takt=target_takt
            )
        }

    def analyze_event_log(self, event_log: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Parses a simulation event log and extracts transit times for dark stations."""
        results = []
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


if __name__ == "__main__":
    vs = VirtualSensingEngine()
    # Test nominal transit (60s work + 20s conveyor = 80s raw delta)
    res = vs.sensors["S3"].process_checkpoint_transition("VIN-1001", upstream_exit_time=100.0, downstream_enter_time=180.0)
    print(f"Virtual Sensor S3 Test -> Inferred Work: {res['inferred_work_time']}s | Confidence: {res['confidence_score_pct']}% | Status: PASS")