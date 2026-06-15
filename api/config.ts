// api/config.ts
//
// Centralized server connection config.
// Automatically resolves the backend IP so the app works on any network
// without hardcoding 192.168.x.x addresses.
//
// Resolution order:
//   1. Manual override via setServerHost()  — for Settings screen / persistence
//   2. Expo debugger host (dev only)        — extracted from Constants.expoConfig
//   3. Fallback: localhost                  — last resort
//
// The backend runs on port 3000 by default (matches src/config.ts API_PORT).

import Constants from 'expo-constants';

// ── Backend port (must match the API_PORT in src/config.ts) ──────────────────
const SERVER_PORT = 3000;

// ── Host resolution ──────────────────────────────────────────────────────────

let manualHost: string | null = null;

/**
 * Attempt to extract the development machine's LAN IP from Expo.
 *
 * When running via `expo start`, the manifest includes a `debuggerHost`
 * field like "192.168.2.8:8081". We strip the Expo port and keep just
 * the IP — the Matter backend runs on SERVER_PORT instead.
 */
function getExpoHost(): string | null {
  try {
    // Expo SDK 54+ puts this under expoConfig.hostUri or the legacy debuggerHost
    const debuggerHost =
      (Constants.expoConfig as any)?.hostUri ??
      (Constants as any).manifest?.debuggerHost ??
      (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ??
      null;

    if (debuggerHost) {
      // "192.168.2.8:8081" → "192.168.2.8"
      const host = debuggerHost.split(':')[0];
      if (host && host !== 'undefined') return host;
    }
  } catch {
    // Ignore — not running in Expo Go or dev client
  }
  return null;
}

/**
 * Returns the host (IP or hostname) to use for connecting to the backend.
 * Call this every time you need the host — it respects runtime overrides.
 */
export function getServerHost(): string {
  if (manualHost) return manualHost;
  return getExpoHost() ?? 'localhost';
}

/**
 * Override the auto-detected host. Call from a Settings screen
 * or at app startup if you persist the user's choice.
 * Pass `null` to reset back to auto-detection.
 */
export function setServerHost(host: string | null): void {
  manualHost = host;
}

/** Full HTTP base URL for the REST API, e.g. "http://192.168.2.8:3000/api" */
export function getApiBase(): string {
  const extraUrl = Constants.expoConfig?.extra?.serverUrl;
  if (extraUrl) {
    return `${extraUrl}/api`;
  }
  return `http://${getServerHost()}:${SERVER_PORT}/api`;
}

/** Full WebSocket URL, e.g. "ws://192.168.2.8:3000" */
export function getWsUrl(): string {
  const extraUrl = Constants.expoConfig?.extra?.serverUrl;
  const apiKey = Constants.expoConfig?.extra?.apiKey;
  const tokenParam = apiKey ? `?token=${apiKey}` : '';

  if (extraUrl) {
    // Convert "https://" to "wss://" and "http://" to "ws://"
    const wsBase = extraUrl.replace(/^http/, 'ws');
    return `${wsBase}/ws${tokenParam}`;
  }
  return `ws://${getServerHost()}:${SERVER_PORT}/ws${tokenParam}`;
}
