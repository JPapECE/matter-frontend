# Matter Mobile Frontend

This repository houses the **Matter Mobile Application**, an Expo and React Native-based mobile interface designed to provide users with real-time control, status monitoring, and energy telemetry for Matter smart devices from anywhere in the world.

---

## 1. Architectural Role

The mobile app operates as the client tier in the three-tier system:

```
[ Mobile App (Expo client) ]
     |
     +--- [REST HTTPS] -------> Cloud Server API (Railway) -> Device Commands
     |
     +--- [WebSockets WSS] <--- Cloud Event Broadcaster  <- Real-Time Telemetry & Status
```

### Key Capabilities:
* **Dynamic Capability Rendering**: Discovers device capabilities (e.g., dimming level, color temperature, electrical measurement) from the database and dynamically shows or hides slider/color wheel controls.
* **Bi-directional State Sync**: Maintains a background WebSocket connection to the cloud server to receive instant state updates (e.g., if a plug is toggled physically).
* **Multi-device Group Control**: Proxy endpoints group commands locally or globally and multicast toggle actions to groups.
* **BLE Commissioning Client**: Interfaces with the phone's native camera (for QR codes) and passes Wi-Fi credentials to trigger remote commissioning.

---

## 2. Directory Structure

```
matter-frontend/
├── App.tsx                # App entrypoint (Navigation Container & Routes)
├── app.json               # Expo configuration, bundle IDs, and extra environment vars
├── eas.json               # EAS Build configurations (Android APK targets)
├── package.json           # Scripts and dependency manifests
├── tsconfig.json          # TypeScript configurations
├── api/
│   ├── config.ts          # Server URL and ApiKey extraction from Expo Config
│   └── client.ts          # Axios-like REST client & WSS WebSocket wrapper
├── screens/
│   ├── DashboardScreen.tsx  # Landing page (Quick toggles, Gateway online indicator)
│   ├── DeviceDetailScreen.tsx # Multi-feature sliders, timed actions, rename/delete
│   ├── EnergyMonitoringScreen.tsx # Real-time line graphs & historical energy charts
│   ├── GroupsScreen.tsx     # Matter groups CRUD & multicast controls
│   └── CommissionScreen.tsx # QR scanner & Wi-Fi commissioning parameters form
└── components/
    └── UI elements (Buttons, Sliders, Cards)
```

---

## 3. Core Screens & Views

1. **Dashboard (`DashboardScreen.tsx`)**:
   * Shows a central **Gateway Connection Status** banner (`online`/`offline`).
   * Renders quick cards for all registered devices with simple on/off status toggles.
   * Lists group shortcuts for single-tap toggles.

2. **Device Details (`DeviceDetailScreen.tsx`)**:
   * **Level Control Slider**: Shows only if the device has a dimmable cluster (e.g., Wiz Bulb). Sets level values between 1 and 254.
   * **Color Temperature Wheel**: Slider adjusting light warmth (Kelvin) mapped automatically from mireds capabilities.
   * **Timed Action Panel**: Sends a `timed_on` command setting active and standby durations.
   * **Administration**: Allows renaming or decommissioning (deleting) the device.

3. **Energy Dashboard (`EnergyMonitoringScreen.tsx`)**:
   * Renders a real-time line chart mapping active power usage in watts (W).
   * Renders bar charts showing cumulative periodic energy imports (Wh).
   * Integrates live WebSocket telemetry snapshots for smooth graph updates.

4. **Commissioning Panel (`CommissionScreen.tsx`)**:
   * Embeds a barcode/QR camera scanner to decode Matter QR payloads (`MT:...`).
   * Prompts for Wi-Fi SSID and Password if BLE commissioning is selected.
   * Renders a live loading log reflecting the pairing process (mDNS discovery, PASE setup, Wi-Fi configuration, CASE negotiation).

5. **Groups (`GroupsScreen.tsx`)**:
   * Create groups with customized IDs.
   * Manage group members by adding or removing individual devices.
   * Execute group-wide actions (ON/OFF/Color Temperature).

---

## 4. API & WebSocket Connection (`api/`)

### Config (`api/config.ts`)
The API base URLs and keys are loaded dynamically from `app.json`'s `extra` object. In local development, it automatically falls back to mapping the host developer machine's IP (e.g., `http://192.168.1.X:3000`).

### Client (`api/client.ts`)
* **REST requests**: Includes standard methods (e.g. `client.turnOn()`, `client.setLevel()`, `client.createGroup()`) attaching the Bearer Token header automatically:
  ```typescript
  headers: { Authorization: `Bearer ${apiKey}` }
  ```
* **WebSocket client**: Implements an auto-reconnecting WebSocket client targeting the cloud `/ws` route. Screens register listener functions to handle message events:
  ```typescript
  client.subscribe((msg) => {
    if (msg.event === "state_change" && msg.nodeId === deviceId) {
      // Update local state variables
    }
  });
  ```

---

## 5. Development & Compilation

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the Expo Go development server:
   ```bash
   npm run start
   ```
   * Open the app by scanning the QR code in the terminal using the **Expo Go** application on iOS or Android.

### Production Android Build (EAS)

The project is pre-configured with `eas.json` to compile a standalone production Android Application Package (APK) rather than using Expo Go:

1. Log in to your Expo account:
   ```bash
   npx eas-cli login
   ```
2. Build the production APK:
   ```bash
   npx eas-cli build --profile production --platform android
   ```
   * Follow the prompt links to download the finished `.apk` file onto your Android device.
