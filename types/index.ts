// types/index.ts

export type DeviceType =
  | 'OnOffPlugInUnit'
  | 'DimmablePlugInUnit'
  | 'ColorTemperatureLight'
  | 'Pump'
  | 'Unknown';

export interface DeviceCapabilities {
  nodeId: string;
  deviceType: DeviceType;
  deviceTypeId: number;
  serverClusters: number[];
  clientClusters: number[];
  clusters: number[];
  hasOnOff: boolean;
  hasLevelControl: boolean;
  hasElectricalPower: boolean;
  hasElectricalEnergy: boolean;
  hasPumpControl: boolean;
  hasOnOffLightingFeature: boolean | null;
  hasColorTemperature: boolean;
  colorTempMinKelvin: number | null;
  colorTempMaxKelvin: number | null;
}

export interface Device {
  nodeId: string;
  name: string;
  type: DeviceType;
  addedAt: string;
  online: boolean;
  on: boolean | null;
  level: number | null;
  capabilities: DeviceCapabilities | null;
}

export interface PowerReading {
  nodeId: string;
  activePower: number | null;
  voltage: number | null;
  current: number | null;
  timestamp: string;
}

export interface EnergyReading {
  nodeId: string;
  cumulativeEnergy: number | null;
  periodicEnergy: number | null;
  cumulativeEnergyExported: number | null;
  periodicEnergyExported: number | null;
  timestamp: string;
}

export interface EnergyRecord {
  id: number;
  nodeId: string;
  activePower: number | null;
  voltage: number | null;
  current: number | null;
  cumulativeEnergy: number | null;
  periodicEnergy: number | null;
  cumulativeEnergyExported: number | null;
  periodicEnergyExported: number | null;
  recordedAt: string;
}

export interface ColorTemperatureStatus {
  nodeId: string;
  mireds: number | null;
  kelvin: number | null;
  minMireds: number | null;
  maxMireds: number | null;
  minKelvin: number | null;
  maxKelvin: number | null;
}

export interface FullStatus {
  status: { nodeId: string; online: boolean; on: boolean | null; level: number | null };
  power: PowerReading;
  energy: EnergyReading;
}

export interface Group {
  groupId: number;
  name: string;
  createdAt?: string;
  members: string[];
}

// WebSocket event shapes
export type WsStateChangeAttribute =
  | 'onOff'
  | 'currentLevel'
  | 'colorTemperature'
  | 'timedOnActive'
  | 'online';

export interface WsStateChangeEvent {
  event: 'state_change';
  nodeId: string;
  attribute: WsStateChangeAttribute;
  value: boolean | number | { mireds: number; kelvin: number } | { onTimeSecs: number; offWaitTimeSecs: number };
}

export interface WsEnergySnapshotEvent {
  event: 'energy_snapshot';
  nodeId: string;
  power: PowerReading;
  energy: EnergyReading;
}

export type WsEvent = WsStateChangeEvent | WsEnergySnapshotEvent;
