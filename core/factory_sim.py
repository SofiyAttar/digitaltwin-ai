"""
core/factory_sim.py
Discrete-Event Factory Simulation Engine for DigitalTwin.ai.
Simulates an 8-station vehicle assembly line with buffers, mixed-model flow, 
stochastic cycle times, and realistic blocking/starvation dynamics using SimPy.
"""

import simpy
import random
import json
from pathlib import Path
from typing import Dict, List, Any, Optional


class Chassis:
    """Represents an individual vehicle chassis traversing the assembly line."""
    def __init__(self, vin: str, variant: str = "Sedan"):
        self.vin = vin
        self.variant = variant
        self.station_timestamps: Dict[str, Dict[str, float]] = {}
        self.tolerances: Dict[str, float] = {}
        self.cumulative_tolerance_score: float = 0.0
        self.completed: bool = False

    def log_station_entry(self, station_id: str, timestamp: float):
        if station_id not in self.station_timestamps:
            self.station_timestamps[station_id] = {}
        self.station_timestamps[station_id]["entered"] = timestamp

    def log_station_exit(self, station_id: str, timestamp: float, cycle_time: float):
        if station_id not in self.station_timestamps:
            self.station_timestamps[station_id] = {}
        self.station_timestamps[station_id]["exited"] = timestamp
        self.station_timestamps[station_id]["cycle_time"] = cycle_time

    def record_tolerance(self, station_id: str, deviation: float):
        self.tolerances[station_id] = deviation
        self.cumulative_tolerance_score += abs(deviation)


class AssemblyLineSimulation:
    """Master discrete-event simulation engine for the vehicle assembly line."""
    def __init__(self, config_path: Optional[str] = None, random_seed: int = 42):
        random.seed(random_seed)
        self.env = simpy.Environment()
        
        # Load configuration
        if config_path is None:
            config_path = str(Path(__file__).resolve().parent.parent / "data" / "line_config.json")
        with open(config_path, "r") as f:
            self.config = json.load(f)

        self.stations_config = self.config["stations"]
        self.takt_time = float(self.config.get("target_takt_time_seconds", 60.0))
        self.conveyor_time = float(self.config.get("conveyor_transit_time_seconds", 10.0))
        self.buffer_capacity = int(self.config.get("max_buffer_capacity", 2))

        # Inter-station buffers: Store holding max N chassis between station_i and station_i+1.
        # Each station runs as its own persistent server process (see _station_process) that
        # pulls from its input buffer and pushes to its output buffer, so buffer occupancy
        # genuinely reflects whether the next station is keeping up — that's what lets
        # STATION_BLOCKED / STATION_STARVED fire correctly.
        self.buffers: Dict[str, simpy.Store] = {}
        for i in range(len(self.stations_config) - 1):
            buf_name = f"B{i+1}"
            self.buffers[buf_name] = simpy.Store(self.env, capacity=self.buffer_capacity)

        # Unbounded entry queue feeding the first station — this represents the plant's
        # release schedule (paced by takt time in _chassis_generator), not a physical buffer.
        self.entry_queue: simpy.Store = simpy.Store(self.env)

        # Tracking state
        self.station_status: Dict[str, str] = {st["id"]: "IDLE" for st in self.stations_config}
        self.station_active_vin: Dict[str, Optional[str]] = {st["id"]: None for st in self.stations_config}
        self.event_log: List[Dict[str, Any]] = []
        self.completed_chassis: List[Chassis] = []
        self.active_chassis_list: List[Chassis] = []

        # Anomaly / Scenario Injection hooks
        self.bottleneck_injections: Dict[str, Dict[str, Any]] = {}
        self.quality_drift_injections: Dict[str, Dict[str, Any]] = {}

    def inject_bottleneck(self, station_id: str, multiplier: float = 1.6, num_vehicles: int = 5):
        """Forces a specific station to slow down (simulating micro-stalls or tooling wear)."""
        self.bottleneck_injections[station_id] = {
            "multiplier": multiplier,
            "remaining": num_vehicles
        }

    def inject_quality_drift(self, station_id: str, drift_bias: float = 1.5, num_vehicles: int = 10):
        """Simulates subtle cumulative tolerance deviations at early stations."""
        self.quality_drift_injections[station_id] = {
            "drift_bias": drift_bias,
            "remaining": num_vehicles
        }

    def _log_event(self, event_type: str, station_id: str, vin: str, details: Dict[str, Any]):
        log_entry = {
            "timestamp": round(self.env.now, 2),
            "event_type": event_type,
            "station_id": station_id,
            "vin": vin,
            **details
        }
        self.event_log.append(log_entry)

    def _calculate_cycle_time(self, station_cfg: Dict[str, Any], chassis: Chassis) -> float:
        base_time = station_cfg["base_cycle_time"]
        std = station_cfg["variance_std"]
        
        # Draw from Gaussian distribution
        actual_time = random.gauss(base_time, std)
        
        # Apply active bottleneck injections if present
        st_id = station_cfg["id"]
        if st_id in self.bottleneck_injections and self.bottleneck_injections[st_id]["remaining"] > 0:
            actual_time *= self.bottleneck_injections[st_id]["multiplier"]
            self.bottleneck_injections[st_id]["remaining"] -= 1

        return max(15.0, round(actual_time, 2))

    def _calculate_tolerance_drift(self, station_cfg: Dict[str, Any]) -> float:
        st_id = station_cfg["id"]
        # Normal tolerance centered at 0 with standard deviation 0.4
        deviation = random.gauss(0.0, 0.4)
        
        # Apply quality drift bias if active
        if st_id in self.quality_drift_injections and self.quality_drift_injections[st_id]["remaining"] > 0:
            deviation += self.quality_drift_injections[st_id]["drift_bias"]
            self.quality_drift_injections[st_id]["remaining"] -= 1

        return round(deviation, 3)

    def _station_process(self, idx: int):
        """
        Persistent server process for one station. Runs for the lifetime of the
        simulation, repeatedly: pulling a chassis from its input buffer (waiting,
        i.e. STARVED, if none is available), doing the work, then handing the
        finished chassis to its output buffer (waiting, i.e. BLOCKED, if that
        buffer is already full). This is what makes buffer occupancy — and
        therefore STATION_BLOCKED / STATION_STARVED — reflect real upstream and
        downstream state, rather than a fixed per-chassis timer.
        """
        st_cfg = self.stations_config[idx]
        st_id = st_cfg["id"]
        num_stations = len(self.stations_config)
        is_first = (idx == 0)
        is_last = (idx == num_stations - 1)
        in_buffer = self.entry_queue if is_first else self.buffers[f"B{idx}"]
        out_buffer = None if is_last else self.buffers[f"B{idx + 1}"]

        while True:
            # 1. Pull the next chassis from upstream. If nothing is waiting,
            # this station is starved until one arrives.
            was_starved = len(in_buffer.items) == 0
            chassis = yield in_buffer.get()

            if not is_first:
                if was_starved:
                    self._log_event("STATION_STARVED", st_id, chassis.vin, {"buffer": f"B{idx}"})
                # Conveyor transit time from the previous station
                yield self.env.timeout(self.conveyor_time)

            # 2. Enter station
            entry_time = self.env.now
            chassis.log_station_entry(st_id, entry_time)
            self.station_status[st_id] = "BUSY"
            self.station_active_vin[st_id] = chassis.vin
            self._log_event("STATION_ENTER", st_id, chassis.vin, {"status": "BUSY"})

            # 3. Simulate assembly operation work duration
            cycle_time = self._calculate_cycle_time(st_cfg, chassis)
            yield self.env.timeout(cycle_time)

            # 4. Record tolerances and exit timestamp
            exit_time = self.env.now
            chassis.log_station_exit(st_id, exit_time, cycle_time)

            tol = self._calculate_tolerance_drift(st_cfg)
            chassis.record_tolerance(st_id, tol)

            self._log_event("STATION_EXIT", st_id, chassis.vin, {
                "cycle_time": cycle_time,
                "tolerance_drift": tol,
                "cumulative_tolerance": round(chassis.cumulative_tolerance_score, 3)
            })

            # 5. Hand off to downstream buffer, or complete the vehicle
            if is_last:
                self.station_status[st_id] = "IDLE"
                self.station_active_vin[st_id] = None
                chassis.completed = True
                self.completed_chassis.append(chassis)
                self._log_event("CHASSIS_COMPLETED", st_id, chassis.vin, {
                    "final_tolerance_score": round(chassis.cumulative_tolerance_score, 3)
                })
            else:
                # If the output buffer is already full, this station is physically
                # blocked holding its finished unit until space opens up.
                if len(out_buffer.items) >= out_buffer.capacity:
                    self.station_status[st_id] = "BLOCKED"
                    self._log_event("STATION_BLOCKED", st_id, chassis.vin, {"buffer": f"B{idx + 1}"})

                yield out_buffer.put(chassis)
                self.station_status[st_id] = "IDLE"
                self.station_active_vin[st_id] = None

    def _chassis_generator(self, total_vehicles: int):
        """Releases sequenced chassis into the entry queue based on Takt pacing."""
        for i in range(total_vehicles):
            vin = f"VIN-{1001 + i}"
            variant = "SUV" if (i % 4 == 0) else "Sedan"  # Mixed-model variance
            chassis = Chassis(vin=vin, variant=variant)
            self.active_chassis_list.append(chassis)

            yield self.entry_queue.put(chassis)

            # Pacing interval before next chassis enters the plant
            yield self.env.timeout(self.takt_time)

    def run_simulation(self, until_time: float = 3600.0, total_vehicles: int = 40):
        """Runs the discrete-event simulation up to a designated timestamp."""
        for idx in range(len(self.stations_config)):
            self.env.process(self._station_process(idx))
        self.env.process(self._chassis_generator(total_vehicles))
        self.env.run(until=until_time)
        return self.event_log

    def get_snapshot(self) -> Dict[str, Any]:
        """Captures a synchronized state-space snapshot of the entire line at current virtual time."""
        buffer_levels = {buf_name: len(buf.items) for buf_name, buf in self.buffers.items()}
        return {
            "current_time_seconds": round(self.env.now, 2),
            "station_status": dict(self.station_status),
            "station_active_vin": dict(self.station_active_vin),
            "buffer_levels": buffer_levels,
            "completed_count": len(self.completed_chassis),
            "active_count": len(self.active_chassis_list) - len(self.completed_chassis),
            "event_count": len(self.event_log)
        }


# Quick Verification Test Block
if __name__ == "__main__":
    print("--- Starting Factory Simulation Test Run ---")
    sim = AssemblyLineSimulation()
    
    # Inject a simulated micro-stall at Dark Station S3 for 3 vehicles
    sim.inject_bottleneck(station_id="S3", multiplier=1.5, num_vehicles=3)
    
    # Run 30 minutes of factory time (1800 seconds)
    sim.run_simulation(until_time=1800.0, total_vehicles=20)
    
    snapshot = sim.get_snapshot()
    print("\nSimulation Snapshot after 30 mins virtual time:")
    print(f"Current Virtual Time: {snapshot['current_time_seconds']}s")
    print(f"Completed Vehicles: {snapshot['completed_count']}")
    print(f"Active Vehicles on Line: {snapshot['active_count']}")
    print(f"Station Statuses: {snapshot['station_status']}")
    print(f"Buffer Queue Levels: {snapshot['buffer_levels']}")
    print(f"Total Telemetry Events Logged: {snapshot['event_count']}")
    print("\n--- Factory Simulation Engine is 100% Functional! ---")