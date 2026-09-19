// api/config.ts
//
// Centralized server connection config.
// Automatically resolves the backend IP so the app works on any network
// without hardcoding 192.168.x.x addresses.
//
// Resolution order:
//   1. Local gateway override (LAN direct mode)  — set by useConnectionMode hook
//   2. Manual cloud host override via setServerHost()
//   3. Expo debugger host (dev only)              — extracted from Constants
//   4. Fallback: localhost
//
// The cloud backend runs on port 3000; the gateway local server on port 4000.

import Constants from 'expo-constants';

// ── Cloud host resolution ─────────────────────────────────────────────────────

const SERVER_PORT = 3000;

let manualHost: string | null = null;

function getExpoHost(): string | null {
  try {
    const debuggerHost =
      (Constants.expoConfig as any)?.hostUri ??
      (Constants as any).manifest?.debuggerHost ??
      (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ??
      null;

    if (debuggerHost) {
      const host = debuggerHost.split(':')[0];
      if (host && host !== 'undefined') return host;
    }
  } catch {
    // Not running in Expo Go / dev client
  }
  return null;
}

export function getServerHost(): string {
  if (manualHost) return manualHost;
  return getExpoHost() ?? 'localhost';
}

export function setServerHost(host: string | null): void {
  manualHost = host;
}

// ── Local gateway URL (LAN direct mode) ──────────────────────────────────────
// When the app detects it is on the same LAN as the gateway, useConnectionMode
// sets this to the gateway's local HTTP base (e.g. "http://192.168.1.50:4000").
// Null = use the cloud URL.

let localGatewayUrl: string | null = null;

/** Switch the API to talk directly to the gateway over LAN. Pass null to revert to cloud. */
export function setLocalGatewayUrl(url: string | null): void {
  localGatewayUrl = url;
}

export function getLocalGatewayUrl(): string | null {
  return localGatewayUrl;
}

// ── URL accessors (used by api/client.ts) ────────────────────────────────────

/** Full HTTP base URL for the REST API. Prefers local gateway when in LAN mode. */
export function getApiBase(): string {
  // LAN direct mode
  if (localGatewayUrl) return `${localGatewayUrl}/api`;

  // Cloud mode — respect serverUrl override from app.json extra
  const extraUrl = Constants.expoConfig?.extra?.serverUrl;
  if (extraUrl) return `${extraUrl}/api`;

  return `http://${getServerHost()}:${SERVER_PORT}/api`;
}

/** Full HTTP base URL for the cloud — always points at the cloud (used by discovery). */
export function getCloudBaseUrl(): string {
  const extraUrl = Constants.expoConfig?.extra?.serverUrl;
  if (extraUrl) return extraUrl;
  return `http://${getServerHost()}:${SERVER_PORT}`;
}

/** Full WebSocket URL. Prefers local gateway when in LAN mode. */
export function getWsUrl(): string {
  const apiKey = Constants.expoConfig?.extra?.apiKey;
  const tokenParam = apiKey ? `?token=${apiKey}` : '';

  // LAN direct mode — use local gateway WS (same token works)
  if (localGatewayUrl) {
    const wsBase = localGatewayUrl.replace(/^http/, 'ws');
    return `${wsBase}/ws${tokenParam}`;
  }

  // Cloud mode
  const extraUrl = Constants.expoConfig?.extra?.serverUrl;
  if (extraUrl) {
    const wsBase = extraUrl.replace(/^http/, 'ws');
    return `${wsBase}/ws${tokenParam}`;
  }

  return `ws://${getServerHost()}:${SERVER_PORT}/ws${tokenParam}`;
}
