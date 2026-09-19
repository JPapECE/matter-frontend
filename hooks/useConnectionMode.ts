/**
 * hooks/useConnectionMode.ts
 *
 * Discovers whether the app can reach the gateway directly on the local LAN
 * and switches the API config accordingly.  Runs once at startup and then
 * re-evaluates every 30 seconds in the background.
 *
 * Connection modes:
 *   'detecting'  — initial probe in progress (briefly shown on first open)
 *   'local'      — gateway reachable directly on LAN (bypasses cloud)
 *   'cloud'      — cloud reachable but gateway not on same LAN
 *   'offline'    — neither cloud nor local gateway reachable
 *
 * Discovery strategy:
 *   1. Try GET <cloudUrl>/health (3 s timeout)
 *      → If responds and includes gatewayLocalUrl, try pinging that URL
 *        → If local ping succeeds → switch to local mode, cache URL
 *        → Else → cloud mode
 *   2. If cloud unreachable:
 *      → Try last-cached local URL from AsyncStorage
 *        → If responds → local mode
 *        → Else → offline
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCloudBaseUrl, setLocalGatewayUrl } from '../api/config';

export type ConnectionMode = 'detecting' | 'local' | 'cloud' | 'offline';

const CACHE_KEY = 'matter:gatewayLocalUrl';
const RECHECK_INTERVAL_MS = 30_000;
const CLOUD_TIMEOUT_MS    = 3_000;
const LOCAL_TIMEOUT_MS    = 2_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function isReachable(url: string, timeoutMs: number): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(url, timeoutMs);
    return res.ok;
  } catch {
    return false;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useConnectionMode(): ConnectionMode {
  const [mode, setMode] = useState<ConnectionMode>('detecting');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const detect = useCallback(async () => {
    const cloudBase = getCloudBaseUrl();

    try {
      // 1. Try the cloud health endpoint
      const cloudRes = await fetchWithTimeout(`${cloudBase}/health`, CLOUD_TIMEOUT_MS);

      if (cloudRes.ok) {
        const body = await cloudRes.json().catch(() => ({}));
        const gatewayLocalUrl: string | null = body?.gatewayLocalUrl ?? null;

        if (gatewayLocalUrl) {
          // 2. Ping the local gateway
          const localOk = await isReachable(`${gatewayLocalUrl}/health`, LOCAL_TIMEOUT_MS);

          if (localOk) {
            // Switch to LAN direct mode
            setLocalGatewayUrl(gatewayLocalUrl);
            await AsyncStorage.setItem(CACHE_KEY, gatewayLocalUrl);
            setMode('local');
            return;
          }
        }

        // Cloud reachable but no local gateway on this network
        setLocalGatewayUrl(null);
        setMode('cloud');
        return;
      }
    } catch {
      // Cloud not reachable — fall through to cached local URL
    }

    // 3. Cloud down — try cached local URL
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const localOk = await isReachable(`${cached}/health`, LOCAL_TIMEOUT_MS);
        if (localOk) {
          setLocalGatewayUrl(cached);
          setMode('local');
          return;
        }
      }
    } catch {
      // AsyncStorage failure — treat as offline
    }

    // 4. Truly offline
    setLocalGatewayUrl(null);
    setMode('offline');
  }, []);

  useEffect(() => {
    // Run immediately on mount
    detect();

    // Re-check periodically
    intervalRef.current = setInterval(detect, RECHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [detect]);

  return mode;
}
