// api/client.ts
// Typed fetch wrappers for every Matter Controller REST endpoint.
// Set API_BASE before calling any function (e.g. in app startup or .env).

import type {
  Device,
  DeviceCapabilities,
  PowerReading,
  EnergyReading,
  EnergyRecord,
  ColorTemperatureStatus,
  FullStatus,
  Group,
} from '../types';

// ── Configuration ─────────────────────────────────────────────────────────────
// The base URL is resolved dynamically so the app works on any network.
// Use setServerHost() from api/config.ts to override the auto-detected IP.
import { getApiBase, setServerHost } from './config';

/**
 * @deprecated Use `setServerHost(host)` from `api/config` instead.
 * Kept for backward compatibility — extracts the host from a full URL.
 */
export function setApiBase(url: string): void {
  try {
    const parsed = new URL(url.replace(/\/$/, ''));
    setServerHost(parsed.hostname);
  } catch {
    // If it's not a valid URL, treat the whole string as a host
    setServerHost(url.replace(/\/$/, ''));
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
import Constants from 'expo-constants';

async function request<T>(
  method:  'GET' | 'POST' | 'PATCH' | 'DELETE',
  path:    string,
  body?:   object,
): Promise<T> {
  const apiKey = Constants.expoConfig?.extra?.apiKey;
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data?.error ?? 'Request failed'), { status: res.status, data });
  return data as T;
}

// ── Device endpoints ──────────────────────────────────────────────────────────

export const api = {

  // GET /devices?withCapabilities=true
  getDevices(withCapabilities = false): Promise<Device[]> {
    const qs = withCapabilities ? '?withCapabilities=true' : '';
    return request('GET', `/devices${qs}`);
  },

  // POST /commission
  commission(
    pairingCode: string,
    name: string,
    type?: string,
    wifi?: { ssid: string; password?: string }
  ): Promise<{ nodeId: string; name: string }> {
    return request('POST', '/commission', { pairingCode, name, type, wifi });
  },

  // DELETE /devices/:id
  removeDevice(nodeId: string): Promise<{ removed: string }> {
    return request('DELETE', `/devices/${nodeId}`);
  },

  // PATCH /devices/:id/name
  renameDevice(nodeId: string, name: string): Promise<{ ok: boolean }> {
    return request('PATCH', `/devices/${nodeId}/name`, { name });
  },

  // ── On/Off ─────────────────────────────────────────────────────────────────

  turnOn(nodeId: string):  Promise<{ ok: boolean }> { return request('POST', `/devices/${nodeId}/on`); },
  turnOff(nodeId: string): Promise<{ ok: boolean }> { return request('POST', `/devices/${nodeId}/off`); },
  toggle(nodeId: string):  Promise<{ ok: boolean }> { return request('POST', `/devices/${nodeId}/toggle`); },

  timedOn(nodeId: string, onTime: number, offWaitTime = 0): Promise<{ ok: boolean }> {
    return request('POST', `/devices/${nodeId}/timed-on`, { onTime, offWaitTime });
  },

  // ── Level ──────────────────────────────────────────────────────────────────

  setLevel(nodeId: string, level: number, transitionTime = 0): Promise<{ ok: boolean; level: number }> {
    return request('POST', `/devices/${nodeId}/level`, { level, transitionTime });
  },

  stepLevel(nodeId: string, direction: 'up' | 'down', stepSize = 25, transitionTime = 5): Promise<{ ok: boolean }> {
    return request('POST', `/devices/${nodeId}/level/step`, { direction, stepSize, transitionTime });
  },

  moveLevel(nodeId: string, direction: 'up' | 'down', rate?: number): Promise<{ ok: boolean }> {
    return request('POST', `/devices/${nodeId}/level/move`, { direction, rate });
  },

  stopLevel(nodeId: string): Promise<{ ok: boolean }> {
    return request('POST', `/devices/${nodeId}/level/stop`);
  },

  // ── Color Temperature ──────────────────────────────────────────────────────

  setColorTemperature(
    nodeId: string,
    value: { mireds: number } | { kelvin: number },
    transitionTime = 10,
  ): Promise<{ ok: boolean; mireds: number; kelvin: number }> {
    return request('POST', `/devices/${nodeId}/color-temperature`, { ...value, transitionTime });
  },

  getColorTemperature(nodeId: string): Promise<ColorTemperatureStatus> {
    return request('GET', `/devices/${nodeId}/color-temperature`);
  },

  // ── Status ─────────────────────────────────────────────────────────────────

  getStatus(nodeId: string): Promise<{ nodeId: string; online: boolean; on: boolean | null; level: number | null }> {
    return request('GET', `/devices/${nodeId}/status`);
  },

  getFullStatus(nodeId: string): Promise<FullStatus> {
    return request('GET', `/devices/${nodeId}/full-status`);
  },

  // ── Energy ─────────────────────────────────────────────────────────────────

  getPower(nodeId: string): Promise<PowerReading> {
    return request('GET', `/devices/${nodeId}/power`);
  },

  getEnergy(nodeId: string): Promise<EnergyReading> {
    return request('GET', `/devices/${nodeId}/energy`);
  },

  getEnergyHistory(nodeId: string, limit = 100, since?: string): Promise<EnergyRecord[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (since) params.set('since', since);
    return request('GET', `/devices/${nodeId}/energy/history?${params}`);
  },

  getEnergyStats(nodeId: string, since?: string): Promise<{
    avgPower: number | null; maxPower: number | null; minPower: number | null; readingCount: number; since: string;
  }> {
    const params = since ? `?since=${since}` : '';
    return request('GET', `/devices/${nodeId}/energy/stats${params}`);
  },

  // ── Capabilities ───────────────────────────────────────────────────────────

  getCapabilities(nodeId: string, refresh = false): Promise<DeviceCapabilities> {
    return request('GET', `/devices/${nodeId}/capabilities${refresh ? '?refresh=true' : ''}`);
  },

  // ── Groups ─────────────────────────────────────────────────────────────────

  createGroup(groupId: number, name: string): Promise<Group> {
    return request('POST', '/groups', { groupId, name });
  },

  getGroups(): Promise<Group[]> {
    return request('GET', '/groups');
  },

  getGroup(groupId: number): Promise<Group> {
    return request('GET', `/groups/${groupId}`);
  },

  deleteGroup(groupId: number): Promise<{ removed: number }> {
    return request('DELETE', `/groups/${groupId}`);
  },

  addGroupMember(groupId: number, nodeId: string): Promise<{ groupId: number; nodeId: string; added: boolean }> {
    return request('POST', `/groups/${groupId}/members/${nodeId}`);
  },

  removeGroupMember(groupId: number, nodeId: string): Promise<{ ok: boolean }> {
    return request('DELETE', `/groups/${groupId}/members/${nodeId}`);
  },

  groupOn(groupId:     number): Promise<{ ok: boolean }> { return request('POST', `/groups/${groupId}/on`); },
  groupOff(groupId:    number): Promise<{ ok: boolean }> { return request('POST', `/groups/${groupId}/off`); },
  groupToggle(groupId: number): Promise<{ ok: boolean }> { return request('POST', `/groups/${groupId}/toggle`); },

  groupLevel(groupId: number, level: number, transitionTime = 0): Promise<{ ok: boolean }> {
    return request('POST', `/groups/${groupId}/level`, { level, transitionTime });
  },

  groupColorTemperature(
    groupId: number,
    value: { mireds: number } | { kelvin: number },
  ): Promise<{ ok: boolean }> {
    return request('POST', `/groups/${groupId}/color-temperature`, value);
  },
};