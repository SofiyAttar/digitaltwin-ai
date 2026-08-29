/** Assembly line configuration — TypeScript equivalent of data/line_config.json. */

export interface StationConfig {
  id: string;
  name: string;
  base_cycle_time: number;
  variance_std: number;
  /** Manual, uninstrumented "dark" station monitored only by virtual sensing. */
  dark: boolean;
}

export interface LineConfig {
  target_takt_time_seconds: number;
  conveyor_transit_time_seconds: number;
  max_buffer_capacity: number;
  stations: StationConfig[];
}

export const LINE_CONFIG: LineConfig = {
  target_takt_time_seconds: 60.0,
  conveyor_transit_time_seconds: 10.0,
  max_buffer_capacity: 2,
  stations: [
    { id: "S1", name: "Body Framing", base_cycle_time: 47.0, variance_std: 2.2, dark: false },
    { id: "S2", name: "Powertrain Drop", base_cycle_time: 47.5, variance_std: 2.5, dark: false },
    { id: "S3", name: "Interior Wiring Harness", base_cycle_time: 48.5, variance_std: 3.5, dark: true },
    { id: "S4", name: "Chassis Marriage", base_cycle_time: 47.0, variance_std: 2.2, dark: false },
    { id: "S5", name: "Trim & Finish", base_cycle_time: 48.0, variance_std: 3.5, dark: true },
    { id: "S6", name: "Glazing & Seals", base_cycle_time: 47.0, variance_std: 2.2, dark: false },
    { id: "S7", name: "Fluid Fill & Electrical", base_cycle_time: 46.5, variance_std: 2.2, dark: false },
    { id: "S8", name: "End-of-Line Test", base_cycle_time: 48.0, variance_std: 2.8, dark: false },
  ],
};

export const stationName = (id: string | null | undefined) =>
  LINE_CONFIG.stations.find((s) => s.id === id)?.name ?? id ?? "—";

export const cloneLineStations = (): StationConfig[] =>
  LINE_CONFIG.stations.map((s) => ({ ...s }));
