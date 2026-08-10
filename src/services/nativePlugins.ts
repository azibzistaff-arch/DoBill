import { Capacitor, registerPlugin } from '@capacitor/core';

export interface ThermalPrinterPlugin {
  begin(): {
    raw(data: number[]): {
      write(): Promise<void>;
    };
  };
  disconnect(): Promise<void>;
  startScan(): Promise<void>;
  stopScan(): Promise<void>;
  connect(options: { address: string }): Promise<{ name?: string }>;
  isConnected(): Promise<boolean>;
  addListener(
    eventName: 'discoverDevices',
    callback: (data: { devices?: Array<{ name?: string; address: string }> }) => void
  ): Promise<{ remove: () => void }>;
  addListener(
    eventName: 'discoveryFinish',
    callback: () => void
  ): Promise<{ remove: () => void }>;
}

export interface CapacitorAppPlugin {
  addListener(
    eventName: 'appStateChange',
    callback: (state: { isActive: boolean }) => void
  ): Promise<{ remove: () => void }>;
}

let cachedThermalPrinter: ThermalPrinterPlugin | null = null;
let cachedCapacitorApp: CapacitorAppPlugin | null = null;

export const isAndroidNative = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      return true;
    }
    const globalCap = (window as any).Capacitor;
    if (globalCap?.getPlatform?.() === 'android' || globalCap?.isNativePlatform?.()) {
      return true;
    }
  } catch (e) {
    // Ignore error in non-Capacitor environment
  }
  return false;
};

export async function getThermalPrinter(): Promise<ThermalPrinterPlugin | null> {
  if (!isAndroidNative()) return null;
  if (cachedThermalPrinter) return cachedThermalPrinter;

  try {
    // 1. Try global Capacitor Plugins registry (populated inside native Android Webview)
    const globalCap = (window as any).Capacitor;
    if (globalCap?.Plugins?.CapacitorThermalPrinter) {
      cachedThermalPrinter = globalCap.Plugins.CapacitorThermalPrinter as ThermalPrinterPlugin;
      return cachedThermalPrinter;
    }

    // 2. Try dynamic import with @vite-ignore to prevent static bundler resolution on web builds
    try {
      const pluginModule = await import(/* @vite-ignore */ 'capacitor-thermal-printer');
      if (pluginModule?.CapacitorThermalPrinter) {
        cachedThermalPrinter = pluginModule.CapacitorThermalPrinter;
        return cachedThermalPrinter;
      }
    } catch (e) {
      // Dynamic import failed, fallback to registerPlugin
    }

    // 3. Fallback: register native plugin bridge via @capacitor/core
    cachedThermalPrinter = registerPlugin<ThermalPrinterPlugin>('CapacitorThermalPrinter');
    return cachedThermalPrinter;
  } catch (e) {
    console.warn('[NativePlugins] Failed to load Thermal Printer plugin:', e);
    return null;
  }
}

export async function getCapacitorApp(): Promise<CapacitorAppPlugin | null> {
  if (!isAndroidNative()) return null;
  if (cachedCapacitorApp) return cachedCapacitorApp;

  try {
    const globalCap = (window as any).Capacitor;
    if (globalCap?.Plugins?.App) {
      cachedCapacitorApp = globalCap.Plugins.App as CapacitorAppPlugin;
      return cachedCapacitorApp;
    }

    try {
      const pluginModule = await import(/* @vite-ignore */ '@capacitor/app');
      if (pluginModule?.App) {
        cachedCapacitorApp = pluginModule.App;
        return cachedCapacitorApp;
      }
    } catch (e) {
      // Dynamic import failed, fallback to registerPlugin
    }

    cachedCapacitorApp = registerPlugin<CapacitorAppPlugin>('App');
    return cachedCapacitorApp;
  } catch (e) {
    console.warn('[NativePlugins] Failed to load Capacitor App plugin:', e);
    return null;
  }
}
