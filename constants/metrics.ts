// constants/metrics.ts
//
// Extensible telemetry metrics registry.
// To add support for any new cluster attributes or telemetry readings,
// simply add a config block below. The UI will automatically adapt!

import { Colors } from '../theme';

export interface MetricDefinition {
  key: string;            // The attribute key in payload (e.g. 'activePower')
  label: string;          // Human-readable title for card
  unit: string;           // Measurement unit
  icon: string;           // Vector icon identifier
  color: string;          // Accent color
  chartLabel: string;     // SVG chart card title
  strokeColor: string;    // SVG line color
  gradientId: string;     // Unique SVG gradient id
  gradientColors: string[]; // Start and stop gradient colors
  scale?: number;         // Optional scaling factor (e.g. 0.001 for Wh -> kWh)
}

export const METRICS_REGISTRY: Record<string, MetricDefinition> = {
  activePower: {
    key: 'activePower',
    label: 'Active Power',
    unit: 'W',
    icon: 'flash',
    color: Colors.tertiary,
    chartLabel: 'Power Consumption',
    strokeColor: '#ffb95f',
    gradientId: 'grad-amber',
    gradientColors: ['#ffb95f', 'rgba(255, 185, 95, 0)'],
  },
  cumulativeEnergy: {
    key: 'cumulativeEnergy',
    label: 'Total Energy',
    unit: 'kWh',
    icon: 'leaf',
    color: Colors.secondary,
    chartLabel: 'Energy Log',
    strokeColor: '#4ae176',
    gradientId: 'grad-green',
    gradientColors: ['#4ae176', 'rgba(74, 225, 118, 0)'],
    scale: 0.001, // Wh to kWh
  },
  voltage: {
    key: 'voltage',
    label: 'Voltage',
    unit: 'V',
    icon: 'power-plug-outline',
    color: Colors.coolSpectrum,
    chartLabel: 'Grid Stability',
    strokeColor: '#60a5fa',
    gradientId: 'grad-blue',
    gradientColors: ['#60a5fa', 'rgba(96, 165, 250, 0)'],
  },
  current: {
    key: 'current',
    label: 'Current',
    unit: 'A',
    icon: 'sine-wave',
    color: Colors.primary,
    chartLabel: 'Load Monitoring',
    strokeColor: '#adc6ff',
    gradientId: 'grad-lightblue',
    gradientColors: ['#adc6ff', 'rgba(173, 198, 255, 0)'],
  },
  frequency: {
    key: 'frequency',
    label: 'Frequency',
    unit: 'Hz',
    icon: 'pulse',
    color: '#a855f7',
    chartLabel: 'Line Frequency',
    strokeColor: '#a855f7',
    gradientId: 'grad-purple',
    gradientColors: ['#a855f7', 'rgba(168, 85, 247, 0)'],
  },
  powerFactor: {
    key: 'powerFactor',
    label: 'Power Factor',
    unit: '',
    icon: 'percent',
    color: '#f43f5e',
    chartLabel: 'Power Quality',
    strokeColor: '#f43f5e',
    gradientId: 'grad-rose',
    gradientColors: ['#f43f5e', 'rgba(244, 63, 94, 0)'],
  },
};
