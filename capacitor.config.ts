import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "com.smcindikator.app",
  appName: "SMC Indikator",
  webDir: "dist",
  server: {
    androidScheme: "https",
    // Izinkan akses HTTP (non-TLS) ke backend saat uji coba lokal/server.
    cleartext: true,
  },
}

export default config
