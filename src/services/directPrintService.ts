import { Sale } from '../types';
import { ShopDetails, DataService } from './dataService';
import { safeLocalStorage, safeSessionStorage } from '@/utils/safeStorage';
import { isAndroidNative, getThermalPrinter, getCapacitorApp } from './nativePlugins';

export { isAndroidNative } from './nativePlugins';

const localStorage = safeLocalStorage;
const sessionStorage = safeSessionStorage;

// Module-level singletons & constants
const GLOBAL_TEXT_ENCODER = new TextEncoder();
const DEFAULT_TCP_PORT = 9100;
const DEFAULT_TCP_TIMEOUT = 4000;
const DEFAULT_SCAN_TIMEOUT = 6000;
const BT_CHUNK_SIZE = 60; // Bytes per Web Bluetooth packet chunk
const BT_CHUNK_DELAY_MS = 20; // Delay between Bluetooth chunks to prevent buffer drop

// Storage safe helper functions
const getStoredBool = (key: string, defaultVal = false): boolean => {
  try { return localStorage.getItem(key) === 'true'; } catch { return defaultVal; }
};
const getStoredString = (key: string, defaultVal = ''): string => {
  try { return localStorage.getItem(key) || defaultVal; } catch { return defaultVal; }
};
const getStoredInt = (key: string, defaultVal: number): number => {
  try {
    const val = localStorage.getItem(key);
    if (!val) return defaultVal;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? defaultVal : parsed;
  } catch { return defaultVal; }
};

// Platform helper checks
export const isElectronApp = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).electronAPI?.isElectron;
};

// Web state handles
let activeUSBDevice: USBDevice | null = null;
let activeSerialPort: any = null;
let activeSerialWriter: any = null;
let activeBluetoothDevice: any = null;
let activeBluetoothCharacteristic: any = null;

// Persistent Android state
let connectedPrinterName = '';
let androidPrinterConnected = false;

/**
 * Find USB endpoint for WebUSB / USB OTG
 */
const findUSBEndpoint = (device: USBDevice) => {
  let interfaceNumber = 0;
  let endpointNumber = 0;
  let found = false;

  if (device.configurations) {
    for (const conf of device.configurations) {
      for (const intf of conf.interfaces) {
        for (const alt of intf.alternates) {
          if (alt.interfaceClass === 7) { // USB Printer Class
            interfaceNumber = intf.interfaceNumber;
            for (const ep of alt.endpoints) {
              if (ep.direction === 'out') {
                endpointNumber = ep.endpointNumber;
                found = true;
                break;
              }
            }
          }
          if (found) break;
        }
        if (found) break;
      }
      if (found) break;
    }

    if (!found) {
      for (const conf of device.configurations) {
        for (const intf of conf.interfaces) {
          for (const alt of intf.alternates) {
            for (const ep of alt.endpoints) {
              if (ep.direction === 'out') {
                interfaceNumber = intf.interfaceNumber;
                endpointNumber = ep.endpointNumber;
                found = true;
                break;
              }
            }
            if (found) break;
          }
          if (found) break;
        }
        if (found) break;
      }
    }
  }

  return { interfaceNumber, endpointNumber, found };
};

/**
 * Clean up active Web connections
 */
const closeWebConnections = async () => {
  try {
    if (activeSerialWriter) {
      try { activeSerialWriter.releaseLock(); } catch (e) {}
      activeSerialWriter = null;
    }
    if (activeSerialPort) {
      try { await activeSerialPort.close(); } catch (e) {}
      activeSerialPort = null;
    }
    if (activeUSBDevice) {
      try {
        const { interfaceNumber, found } = findUSBEndpoint(activeUSBDevice);
        if (found) {
          await activeUSBDevice.releaseInterface(interfaceNumber);
        }
      } catch (e) {
        console.warn('[DirectPrint] WebUSB releaseInterface error:', e);
      }
      try { await activeUSBDevice.close(); } catch (e) {}
      activeUSBDevice = null;
    }
    if (activeBluetoothDevice) {
      if (activeBluetoothDevice.gatt?.connected) {
        try { await activeBluetoothDevice.gatt.disconnect(); } catch (e) {}
      }
      activeBluetoothDevice = null;
      activeBluetoothCharacteristic = null;
    }
  } catch (err) {
    console.warn('[DirectPrint] Error closing Web connections:', err);
  } finally {
    connectedPrinterName = '';
  }
};

/**
 * Send raw binary ESC/POS data over TCP/IP socket connection (Network LAN/WiFi printers)
 * Compatible with Epson, XPrinter, Rongta, Sunmi, HPRT, TVS, etc.
 */
const sendTCPData = async (ip: string, port: number, data: Uint8Array): Promise<void> => {
  const targetPort = port && !isNaN(port) && port > 0 ? port : DEFAULT_TCP_PORT;
  const isSecureOrigin = typeof window !== 'undefined' && window.location.protocol === 'https:';

  // Method 1: HTTP POST directly to raw printer endpoint http://<ip>:<targetPort> (Allowed on HTTP origins)
  if (!isSecureOrigin) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TCP_TIMEOUT);

      await fetch(`http://${ip}:${targetPort}`, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: data,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return;
    } catch (err1) {
      console.warn('[DirectPrint] TCP HTTP POST failed, trying WebSocket:', err1);
    }
  }

  // Method 2: Raw WebSocket stream to ws://<ip>:<targetPort>
  try {
    await new Promise<void>((resolve, reject) => {
      const wsUrl = `ws://${ip}:${targetPort}`;
      let socket: WebSocket | null = null;
      let timer: any = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        if (socket) {
          socket.onopen = null;
          socket.onerror = null;
          socket.onclose = null;
        }
      };

      try {
        socket = new WebSocket(wsUrl);
        socket.binaryType = 'arraybuffer';

        timer = setTimeout(() => {
          if (socket) {
            try { socket.close(); } catch (e) {}
          }
          cleanup();
          reject(new Error('TCP WebSocket connection timeout'));
        }, DEFAULT_TCP_TIMEOUT);

        socket.onopen = () => {
          if (socket) {
            socket.send(data);
            setTimeout(() => {
              try { socket.close(); } catch (e) {}
              cleanup();
              resolve();
            }, 500);
          }
        };

        socket.onerror = (e) => {
          cleanup();
          reject(e || new Error('WebSocket connection error'));
        };
      } catch (wsErr) {
        cleanup();
        reject(wsErr);
      }
    });
    return;
  } catch (err2) {
    console.warn('[DirectPrint] TCP WebSocket stream failed, trying ePOS CGI fallback:', err2);
  }

  // Method 3: Epson ePOS / Rongta XML printer endpoint fallback
  if (!isSecureOrigin) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TCP_TIMEOUT);
      await fetch(`http://${ip}/cgi-bin/epos/service.cgi`, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
        body: data,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return;
    } catch (err3) {
      console.warn('[DirectPrint] TCP ePOS CGI fallback failed:', err3);
    }
  }

  throw new Error(`Failed to print to TCP Printer (${ip}:${targetPort}). ${
    isSecureOrigin ? 'Browsers block unencrypted LAN/HTTP socket calls from HTTPS web apps. Please run on Android APK or Desktop app.' : 'Make sure printer is powered ON and connected to the same WiFi/LAN network.'
  }`);
};

/**
 * Send raw binary ESC/POS data over USB OTG / WebUSB connection
 */
const sendUSBData = async (data: Uint8Array): Promise<void> => {
  // 1. If WebUSB active device is already open and claimed
  if (activeUSBDevice) {
    try {
      const { endpointNumber } = findUSBEndpoint(activeUSBDevice);
      const result = await activeUSBDevice.transferOut(endpointNumber, data);
      if (result.status === 'ok') return;
    } catch (e) {
      console.warn('[DirectPrint] WebUSB active write warning, attempting reconnect:', e);
    }
  }

  // 2. Try auto-opening connected USB device via navigator.usb
  if (typeof navigator !== 'undefined' && 'usb' in navigator) {
    try {
      const devices = await navigator.usb.getDevices();
      if (devices.length > 0) {
        const device = devices[0];
        if (!device.opened) await device.open();
        if (device.configuration === null) await device.selectConfiguration(1);
        const { interfaceNumber, endpointNumber } = findUSBEndpoint(device);
        await device.claimInterface(interfaceNumber);
        activeUSBDevice = device;
        const result = await device.transferOut(endpointNumber, data);
        if (result.status === 'ok') return;
      }
    } catch (usbErr) {
      console.warn('[DirectPrint] WebUSB auto-claim write warning:', usbErr);
    }
  }

  // 3. Fallback to native plugin write
  try {
    const printer = await getThermalPrinter();
    if (!printer) {
      throw new Error('Native thermal printer plugin is unavailable.');
    }
    await printer.begin().raw(Array.from(data)).write();
    return;
  } catch (pluginErr: any) {
    throw new Error(`USB OTG Thermal Print failed: ${pluginErr.message || pluginErr}. Please verify USB OTG cable connection.`);
  }
};

/**
 * Helper to wrap long product names into multiple lines
 */
const wrapText = (text: string, maxWidth: number): string[] => {
  if (!text) return [''];
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + (currentLine ? ' ' : '') + word).length <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      if (word.length > maxWidth) {
        let remainingWord = word;
        while (remainingWord.length > maxWidth) {
          lines.push(remainingWord.substring(0, maxWidth));
          remainingWord = remainingWord.substring(maxWidth);
        }
        currentLine = remainingWord;
      } else {
        currentLine = word;
      }
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [text.substring(0, maxWidth)];
};

export interface SavedPrinterInfo {
  type: 'android_bt' | 'android_usb' | 'android_tcp' | 'usb' | 'serial' | 'bluetooth';
  name: string;
  address?: string; // Bluetooth MAC address
  ip?: string;      // TCP IP address
  port?: number;    // TCP Port
}

export const DirectPrintService = {
  /**
   * Check if any direct printer is configured and connected
   */
  isPrinterConnected(): boolean {
    const isEnabled = getStoredBool('retailpro_direct_print_enabled');
    if (!isEnabled) return false;

    if (isAndroidNative()) {
      const type = getStoredString('retailpro_direct_print_type');
      if (type === 'android_bt' || type === 'bluetooth') {
        return androidPrinterConnected || !!getStoredString('retailpro_direct_print_address');
      }
      if (type === 'android_tcp') {
        return !!getStoredString('retailpro_direct_print_ip');
      }
      if (type === 'android_usb') {
        return true;
      }
      return (
        androidPrinterConnected ||
        !!getStoredString('retailpro_direct_print_address') ||
        !!getStoredString('retailpro_direct_print_ip')
      );
    }

    return !!activeUSBDevice || !!activeSerialPort || !!activeBluetoothDevice;
  },

  /**
   * Get connected printer description
   */
  getConnectedPrinterName(): string {
    const isEnabled = getStoredBool('retailpro_direct_print_enabled');
    if (!isEnabled) return '';

    const savedName = getStoredString('retailpro_direct_print_name');
    if (savedName) return savedName;

    const type = getStoredString('retailpro_direct_print_type', 'Thermal');
    return connectedPrinterName || `${type.toUpperCase()} Printer`;
  },

  /**
   * Get full details of saved printer
   */
  getSavedPrinter(): SavedPrinterInfo | null {
    const isEnabled = getStoredBool('retailpro_direct_print_enabled');
    if (!isEnabled) return null;

    const type = (getStoredString('retailpro_direct_print_type', 'android_bt') as SavedPrinterInfo['type']);
    const name = getStoredString('retailpro_direct_print_name', 'Thermal Printer');
    const address = getStoredString('retailpro_direct_print_address') || undefined;
    const ip = getStoredString('retailpro_direct_print_ip') || undefined;
    const port = getStoredInt('retailpro_direct_print_port', DEFAULT_TCP_PORT);

    return { type, name, address, ip, port };
  },

  /**
   * Disconnect any paired direct printer
   */
  async disconnect(): Promise<void> {
    if (isAndroidNative()) {
      try {
        const printer = await getThermalPrinter();
        if (printer) {
          await printer.disconnect();
        }
      } catch (e) {
        console.warn('[DirectPrint] Android disconnect error:', e);
      }
      androidPrinterConnected = false;
    } else {
      await closeWebConnections();
    }

    localStorage.setItem('retailpro_direct_print_enabled', 'false');
    localStorage.removeItem('retailpro_direct_print_type');
    localStorage.removeItem('retailpro_direct_print_name');
    localStorage.removeItem('retailpro_direct_print_address');
    localStorage.removeItem('retailpro_direct_print_ip');
    localStorage.removeItem('retailpro_direct_print_port');
    localStorage.removeItem('retailpro_direct_print_usb_vendor');
    localStorage.removeItem('retailpro_direct_print_usb_product');
    localStorage.removeItem('retailpro_direct_print_bt_name');
  },

  /**
   * Android Specific: Scan for nearby Bluetooth printers
   * Clean Promise implementation (no async executor anti-pattern)
   */
  async scanAndroidPrinters(): Promise<Array<{ name: string; address: string }>> {
    if (!isAndroidNative()) {
      throw new Error('Native scanner is only available inside the Android APK.');
    }

    return new Promise((resolve, reject) => {
      let devListener: any = null;
      let finishListener: any = null;
      let timeoutId: any = null;
      const discovered: Array<{ name: string; address: string }> = [];

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (devListener?.remove) devListener.remove();
        if (finishListener?.remove) finishListener.remove();
      };

      (async () => {
        try {
          const printer = await getThermalPrinter();
          if (!printer) {
            throw new Error('Thermal printer plugin not loaded.');
          }

          devListener = await printer.addListener('discoverDevices', (data: any) => {
            if (data && data.devices) {
              for (const dev of data.devices) {
                if (dev.address && !discovered.some(d => d.address === dev.address)) {
                  discovered.push({
                    name: dev.name || `Thermal Printer (${dev.address.substring(0, 8)})`,
                    address: dev.address
                  });
                }
              }
            }
          });

          finishListener = await printer.addListener('discoveryFinish', () => {
            console.log('[DirectPrint] Android Bluetooth discovery finished.');
          });

          await printer.startScan();

          timeoutId = setTimeout(() => {
            if (printer) {
              printer.stopScan().catch(() => {});
            }
            cleanup();
            resolve(discovered);
          }, DEFAULT_SCAN_TIMEOUT);

        } catch (err) {
          cleanup();
          reject(err);
        }
      })();
    });
  },

  /**
   * Android Specific: Select and save an Android Printer (Bluetooth, USB OTG, or TCP)
   */
  async selectAndroidPrinter(info: SavedPrinterInfo): Promise<{ success: boolean; name: string; error?: string }> {
    if (!isAndroidNative()) {
      return { success: false, name: '', error: 'Native printer picker is only available inside Android APK.' };
    }

    try {
      if (info.type === 'android_bt' || info.type === 'bluetooth') {
        if (!info.address) throw new Error('Bluetooth printer MAC address is required.');
        
        console.log('[DirectPrint] Connecting to Android Bluetooth printer:', info.address);
        const printer = await getThermalPrinter();
        if (!printer) throw new Error('Thermal printer plugin not available on Android.');
        const res = await printer.connect({ address: info.address });
        androidPrinterConnected = true;

        const displayName = res?.name || info.name || 'Bluetooth Thermal Printer';

        localStorage.setItem('retailpro_direct_print_enabled', 'true');
        localStorage.setItem('retailpro_direct_print_type', 'android_bt');
        localStorage.setItem('retailpro_direct_print_name', displayName);
        localStorage.setItem('retailpro_direct_print_address', info.address);

        return { success: true, name: displayName };
      } else if (info.type === 'android_tcp') {
        if (!info.ip) throw new Error('TCP IP address is required.');

        localStorage.setItem('retailpro_direct_print_enabled', 'true');
        localStorage.setItem('retailpro_direct_print_type', 'android_tcp');
        localStorage.setItem('retailpro_direct_print_name', info.name || `Network Printer (${info.ip})`);
        localStorage.setItem('retailpro_direct_print_ip', info.ip);
        localStorage.setItem('retailpro_direct_print_port', (info.port || DEFAULT_TCP_PORT).toString());

        androidPrinterConnected = true;
        return { success: true, name: info.name || `Network Printer (${info.ip})` };
      } else if (info.type === 'android_usb') {
        localStorage.setItem('retailpro_direct_print_enabled', 'true');
        localStorage.setItem('retailpro_direct_print_type', 'android_usb');
        localStorage.setItem('retailpro_direct_print_name', info.name || 'USB OTG Printer');
        if (info.address) localStorage.setItem('retailpro_direct_print_address', info.address);

        androidPrinterConnected = true;
        return { success: true, name: info.name || 'USB OTG Thermal Printer' };
      }

      throw new Error('Unsupported printer type.');
    } catch (err: any) {
      console.error('[DirectPrint] Android printer setup error:', err);
      return { success: false, name: '', error: err.message || 'Failed to connect to Android printer.' };
    }
  },

  /**
   * Connect to a USB Thermal Printer using WebUSB (Desktop Web mode) or USB OTG (Android APK mode)
   */
  async connectUSB(): Promise<{ success: boolean; name: string; error?: string }> {
    if (isAndroidNative()) {
      return this.selectAndroidPrinter({ type: 'android_usb', name: 'USB OTG Thermal Printer' });
    }

    if (!('usb' in navigator)) {
      return { success: false, name: '', error: 'WebUSB is not supported in this browser. Please use Chrome or Edge.' };
    }

    try {
      await closeWebConnections();
      
      const device = await navigator.usb.requestDevice({ filters: [] });
      await device.open();
      
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }

      const { interfaceNumber, found } = findUSBEndpoint(device);
      if (!found) {
        throw new Error('No OUT bulk endpoint found on this USB device.');
      }

      await device.claimInterface(interfaceNumber);
      
      activeUSBDevice = device;
      connectedPrinterName = device.productName || `USB Printer (${device.vendorId.toString(16)}:${device.productId.toString(16)})`;
      
      localStorage.setItem('retailpro_direct_print_enabled', 'true');
      localStorage.setItem('retailpro_direct_print_type', 'usb');
      localStorage.setItem('retailpro_direct_print_name', connectedPrinterName);
      localStorage.setItem('retailpro_direct_print_usb_vendor', device.vendorId.toString());
      localStorage.setItem('retailpro_direct_print_usb_product', device.productId.toString());

      return { success: true, name: connectedPrinterName };
    } catch (err: any) {
      console.error('[DirectPrint] WebUSB connect error:', err);
      return { success: false, name: '', error: err.message || 'Connection failed.' };
    }
  },

  /**
   * Connect to a Serial Port Printer using Web Serial (Desktop Web mode)
   */
  async connectSerial(): Promise<{ success: boolean; name: string; error?: string }> {
    if (isAndroidNative()) {
      return { success: false, name: '', error: 'Serial ports are not supported on Android. Use Bluetooth, USB OTG, or Network printer.' };
    }

    if (!('serial' in navigator)) {
      return { success: false, name: '', error: 'Web Serial is not supported in this browser.' };
    }

    try {
      await closeWebConnections();

      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      
      activeSerialPort = port;
      activeSerialWriter = port.writable.getWriter();
      connectedPrinterName = 'Serial COM Printer';

      localStorage.setItem('retailpro_direct_print_enabled', 'true');
      localStorage.setItem('retailpro_direct_print_type', 'serial');
      localStorage.setItem('retailpro_direct_print_name', connectedPrinterName);

      return { success: true, name: connectedPrinterName };
    } catch (err: any) {
      console.error('[DirectPrint] Web Serial connect error:', err);
      return { success: false, name: '', error: err.message || 'Connection failed.' };
    }
  },

  /**
   * Connect to a Bluetooth Thermal Printer
   */
  async connectBluetooth(address?: string): Promise<{ success: boolean; name: string; error?: string }> {
    if (isAndroidNative()) {
      if (!address) {
        const devices = await this.scanAndroidPrinters();
        if (devices.length === 0) {
          return { success: false, name: '', error: 'No Bluetooth printers found. Make sure printer is turned ON and paired.' };
        }
        address = devices[0].address;
      }
      return this.selectAndroidPrinter({ type: 'android_bt', name: 'Bluetooth Printer', address });
    }

    if (!('bluetooth' in navigator)) {
      return { success: false, name: '', error: 'Web Bluetooth is not supported on this device/browser.' };
    }

    try {
      await closeWebConnections();
      
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['00001101-0000-1000-8000-00805f9b34fb', '000018f0-0000-1000-8000-00805f9b34fb']
      });

      const server = await device.gatt.connect();
      
      let service;
      try {
        service = await server.getPrimaryService('00001101-0000-1000-8000-00805f9b34fb');
      } catch (e) {
        try {
          service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
        } catch (e2) {
          const services = await server.getPrimaryServices();
          if (services.length > 0) service = services[0];
        }
      }

      if (!service) {
        throw new Error('No compatible service found on this Bluetooth device.');
      }

      const characteristics = await service.getCharacteristics();
      const writeChar = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);

      if (!writeChar) {
        throw new Error('No write characteristic found on this device.');
      }

      activeBluetoothDevice = device;
      activeBluetoothCharacteristic = writeChar;
      connectedPrinterName = device.name || 'Bluetooth Printer';

      localStorage.setItem('retailpro_direct_print_enabled', 'true');
      localStorage.setItem('retailpro_direct_print_type', 'bluetooth');
      localStorage.setItem('retailpro_direct_print_name', connectedPrinterName);

      return { success: true, name: connectedPrinterName };
    } catch (err: any) {
      console.error('[DirectPrint] Web Bluetooth connect error:', err);
      return { success: false, name: '', error: err.message || 'Connection failed.' };
    }
  },

  /**
   * Attempt auto-connection / re-connection to saved printer after app restart
   */
  async autoConnect(): Promise<boolean> {
    const isEnabled = getStoredBool('retailpro_direct_print_enabled');
    if (!isEnabled) return false;

    if (isAndroidNative()) {
      const type = getStoredString('retailpro_direct_print_type');
      const address = getStoredString('retailpro_direct_print_address');
      const ip = getStoredString('retailpro_direct_print_ip');

      try {
        if ((type === 'android_bt' || type === 'bluetooth' || (!type && address)) && address) {
          let connected = false;
          const printer = await getThermalPrinter();
          if (printer) {
            try {
              connected = await printer.isConnected();
            } catch (e) {}

            if (!connected) {
              console.log('[DirectPrint] Auto-reconnecting to Android Bluetooth printer:', address);
              await printer.connect({ address });
              connected = await printer.isConnected();
            }
          }

          androidPrinterConnected = connected;
          return connected;
        } else if (type === 'android_tcp' && ip) {
          androidPrinterConnected = true;
          return true;
        } else if (type === 'android_usb') {
          if (typeof navigator !== 'undefined' && 'usb' in navigator) {
            try {
              const devices = await navigator.usb.getDevices();
              if (devices.length > 0) {
                const device = devices[0];
                if (!device.opened) await device.open();
                if (device.configuration === null) await device.selectConfiguration(1);
                const { interfaceNumber } = findUSBEndpoint(device);
                await device.claimInterface(interfaceNumber);
                activeUSBDevice = device;
              }
            } catch (e) {}
          }
          androidPrinterConnected = true;
          return true;
        }
      } catch (err) {
        console.warn('[DirectPrint] Android auto-connect warning:', err);
      }
      return false;
    }

    // Web Browser Auto Connect
    const type = getStoredString('retailpro_direct_print_type');
    if (!type) return false;

    try {
      if (type === 'usb' && 'usb' in navigator) {
        const vendorStr = getStoredString('retailpro_direct_print_usb_vendor');
        const productStr = getStoredString('retailpro_direct_print_usb_product');
        if (!vendorStr || !productStr) return false;

        const vendorId = parseInt(vendorStr, 10);
        const productId = parseInt(productStr, 10);

        const devices = await navigator.usb.getDevices();
        const matched = devices.find(d => d.vendorId === vendorId && d.productId === productId);

        if (matched) {
          await matched.open();
          if (matched.configuration === null) {
            await matched.selectConfiguration(1);
          }
          const { interfaceNumber } = findUSBEndpoint(matched);
          await matched.claimInterface(interfaceNumber);
          activeUSBDevice = matched;
          connectedPrinterName = matched.productName || `USB Printer (${matched.vendorId.toString(16)}:${matched.productId.toString(16)})`;
          return true;
        }
      }
    } catch (err) {
      console.warn('[DirectPrint] Web auto-connect warning:', err);
    }
    return false;
  },

  /**
   * Send binary raw ESC/POS bytes directly to the connected thermal printer
   * Supports Bluetooth, USB OTG, and TCP/IP (LAN/WiFi) thermal printers
   */
  async writeRaw(data: Uint8Array): Promise<void> {
    const type = getStoredString('retailpro_direct_print_type');
    const address = getStoredString('retailpro_direct_print_address');
    const ip = getStoredString('retailpro_direct_print_ip');
    const port = getStoredInt('retailpro_direct_print_port', DEFAULT_TCP_PORT);

    // 1. Android Native APK Execution
    if (isAndroidNative()) {
      // Network TCP Printer
      if (type === 'android_tcp' || (ip && !address)) {
        if (!ip) throw new Error('TCP IP address is not configured.');
        await sendTCPData(ip, port, data);
        androidPrinterConnected = true;
        return;
      }

      // USB OTG Printer
      if (type === 'android_usb' || type === 'usb') {
        await sendUSBData(data);
        androidPrinterConnected = true;
        return;
      }

      // Bluetooth Printer
      if (!address) {
        throw new Error('Bluetooth printer address not configured.');
      }

      const printer = await getThermalPrinter();
      if (!printer) {
        throw new Error('Thermal printer plugin not available on Android.');
      }

      const byteArray = Array.from(data);
      let connected = false;
      try {
        connected = await printer.isConnected();
      } catch (e) {
        console.warn('[DirectPrint] Error checking Bluetooth status:', e);
      }

      if (!connected) {
        console.log('[DirectPrint] Reconnecting to Bluetooth printer before write:', address);
        try {
          await printer.connect({ address });
          connected = true;
        } catch (connErr) {
          console.warn('[DirectPrint] Connect in writeRaw failed, attempting write anyway:', connErr);
        }
      }

      try {
        await printer.begin().raw(byteArray).write();
        androidPrinterConnected = true;
        return;
      } catch (printErr: any) {
        console.error('[DirectPrint] First write failed, attempting reconnect and retry:', printErr);
        try {
          await printer.connect({ address });
          await printer.begin().raw(byteArray).write();
          androidPrinterConnected = true;
          return;
        } catch (retryErr: any) {
          throw new Error(`Bluetooth write failed: ${retryErr.message || retryErr}`);
        }
      }
    }

    // 2. Desktop Web Browser / Electron Execution
    if (type === 'android_tcp' || type === 'tcp') {
      if (!ip) throw new Error('TCP IP address is not configured.');
      await sendTCPData(ip, port, data);
      return;
    }

    if ((type === 'usb' || type === 'android_usb') && (activeUSBDevice || ('usb' in navigator))) {
      await sendUSBData(data);
      return;
    }

    if (type === 'serial' && activeSerialWriter) {
      await activeSerialWriter.write(data);
      return;
    }

    if (type === 'bluetooth' && activeBluetoothCharacteristic) {
      for (let i = 0; i < data.length; i += BT_CHUNK_SIZE) {
        const chunk = data.slice(i, i + BT_CHUNK_SIZE);
        await activeBluetoothCharacteristic.writeValue(chunk);
        if (BT_CHUNK_DELAY_MS > 0) {
          await new Promise(r => setTimeout(r, BT_CHUNK_DELAY_MS));
        }
      }
      return;
    }

    throw new Error('Thermal printer is not connected. Please connect a printer in Printer Setup.');
  },

  /**
   * Format and print a POS Sale Receipt directly in native ESC/POS
   */
  async printReceiptDirect(sale: Sale, shopDetails: ShopDetails | null | undefined): Promise<void> {
    try {
      const bytes: number[] = [];

      const add = (arr: number[]) => bytes.push(...arr);
      const addText = (text: string) => bytes.push(...GLOBAL_TEXT_ENCODER.encode(text));
      const addNewLine = () => bytes.push(0x0A);

      // 1. Initialize printer & set standard Codepage (PC437 / USA)
      add([0x1B, 0x40]); // ESC @
      add([0x1B, 0x74, 0x00]); // ESC t 0 (Codepage PC437)
      
      // 2. Header
      add([0x1B, 0x61, 0x01]); // ESC a 1 (Center Alignment)
      add([0x1D, 0x21, 0x11]); // GS ! 17 (Double size)
      add([0x1B, 0x45, 0x01]); // ESC E 1 (Bold)
      addText(shopDetails?.name || 'STORE RECEIPT');
      addNewLine();
      
      add([0x1D, 0x21, 0x00]); // Normal size
      add([0x1B, 0x45, 0x00]); // Bold off
      
      if (shopDetails?.address) {
        addText(shopDetails.address);
        addNewLine();
      }
      if (shopDetails?.phone) {
        addText(`Tel: ${shopDetails.phone}`);
        addNewLine();
      }
      addNewLine();

      // 3. Metadata
      add([0x1B, 0x61, 0x00]); // Left align
      addText(`Bill No:   ${sale.invoiceNumber}`); addNewLine();
      
      const dateObj = new Date(sale.createdAt || Date.now());
      addText(`Date:      ${dateObj.toLocaleDateString('en-IN')}`); addNewLine();
      addText(`Time:      ${dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`); addNewLine();
      addText(`Cashier:   ${sale.cashierId || 'Cashier'}`); addNewLine();
      if (sale.customerName) {
        addText(`Customer:  ${sale.customerName}`); addNewLine();
      }
      if (sale.customerPhone) {
        addText(`Phone:     ${sale.customerPhone}`); addNewLine();
      }
      
      // 4. Divider
      const paperSize = shopDetails?.paperSize || '80mm';
      const is80 = paperSize === '80mm';
      const widthChars = is80 ? 48 : 32;
      const lineChar = '-';
      addText(lineChar.repeat(widthChars)); addNewLine();

      // 5. Items Header
      add([0x1B, 0x45, 0x01]);
      if (is80) {
        addText('ITEM'.padEnd(25) + 'QTY'.padStart(8) + 'TOTAL'.padStart(15));
      } else {
        addText('ITEM'.padEnd(15) + 'QTY'.padStart(5) + 'TOTAL'.padStart(12));
      }
      addNewLine();
      add([0x1B, 0x45, 0x00]);
      addText(lineChar.repeat(widthChars)); addNewLine();

      // 6. Items List with Name Line Wrapping
      sale.items.forEach(item => {
        const nameMaxLen = is80 ? 24 : 14;
        const nameLines = wrapText(item.name, nameMaxLen);
        const qty = item.quantity.toString();
        const total = `Rs.${(item.sellingPrice * item.quantity).toFixed(2)}`;
        
        if (is80) {
          addText(nameLines[0].padEnd(25) + qty.padStart(8) + total.padStart(15));
        } else {
          addText(nameLines[0].padEnd(15) + qty.padStart(5) + total.padStart(12));
        }
        addNewLine();

        for (let i = 1; i < nameLines.length; i++) {
          addText(nameLines[i].padEnd(widthChars));
          addNewLine();
        }
      });
      addText(lineChar.repeat(widthChars)); addNewLine();

      // 7. Totals (Use ASCII 'Rs.' for raw ESC/POS compatibility)
      add([0x1B, 0x61, 0x02]); // Right Align
      addText(`Subtotal: Rs. ${(sale.subtotal || 0).toFixed(2)}`); addNewLine();
      if (sale.taxTotal > 0) {
        addText(`GST: Rs. ${sale.taxTotal.toFixed(2)}`); addNewLine();
      }
      
      // Grand Total
      add([0x1D, 0x21, 0x10]); // Double height
      add([0x1B, 0x45, 0x01]); // Bold
      addText(`GRAND TOTAL: Rs. ${sale.grandTotal.toFixed(2)}`); addNewLine();
      add([0x1D, 0x21, 0x00]);
      add([0x1B, 0x45, 0x00]);
      addNewLine();

      // Payment Details
      add([0x1B, 0x61, 0x00]); // Left Align
      addText(`Payment Mode: ${(sale.paymentMode || 'CASH').toUpperCase()}`); addNewLine();
      if (sale.cashReceived !== undefined && sale.cashReceived > 0) {
        addText(`Cash Paid:    Rs. ${sale.cashReceived.toFixed(2)}`); addNewLine();
        addText(`Change Due:   Rs. ${(sale.changeDue || 0).toFixed(2)}`); addNewLine();
      }
      
      add([0x1B, 0x61, 0x01]); // Center Align
      addText(lineChar.repeat(widthChars)); addNewLine();
      
      // Footer
      add([0x1B, 0x45, 0x01]);
      addText('THANK YOU FOR SHOPPING!'); addNewLine();
      add([0x1B, 0x45, 0x00]);
      addText('Items once sold cannot be returned.'); addNewLine();
      addText('POWERED BY DO BILL'); addNewLine();

      // Feed paper & Cut
      add([0x1B, 0x64, 0x05]); // Feed 5 lines
      add([0x1D, 0x56, 0x41, 0x00]); // Full Cut

      await this.writeRaw(new Uint8Array(bytes));
    } catch (err: any) {
      console.error('[DirectPrint] Error printing receipt:', err);
      throw new Error(`Thermal receipt printing failed: ${err.message || err}`);
    }
  },

  /**
   * Format and print a Barcode Label directly in ESC/POS
   */
  async printBarcodeDirect(
    productName: string,
    barcode: string,
    price: number,
    brand: string,
    quantity: number
  ): Promise<void> {
    try {
      const bytes: number[] = [];

      const add = (arr: number[]) => bytes.push(...arr);
      const addText = (text: string) => bytes.push(...GLOBAL_TEXT_ENCODER.encode(text));
      const addNewLine = () => bytes.push(0x0A);

      for (let q = 0; q < quantity; q++) {
        // Initialize
        add([0x1B, 0x40]);
        add([0x1B, 0x74, 0x00]); // Codepage PC437
        add([0x1B, 0x61, 0x01]); // Center alignment

        // Product Name (wrapped if needed)
        add([0x1B, 0x45, 0x01]);
        const nameLines = wrapText(productName, 24);
        addText(nameLines[0]);
        if (nameLines[1]) {
          addNewLine();
          addText(nameLines[1]);
        }
        add([0x1B, 0x45, 0x00]);
        addNewLine();

        // ESC/POS Barcode
        add([0x1D, 0x68, 65]); // Height
        add([0x1D, 0x77, 2]);  // Width
        add([0x1D, 0x66, 2]);  // Text below

        const cleanBarcode = barcode.toUpperCase().replace(/[^A-Z0-9\-\.\ \$\/\+\%]/g, '');
        if (cleanBarcode) {
          add([0x1D, 0x6B, 69, cleanBarcode.length]); // CODE39
          addText(cleanBarcode);
        } else {
          addText(`*${barcode}*`);
          addNewLine();
        }
        addNewLine();

        // Feed & Partial Cut
        add([0x1B, 0x64, 0x03]);
        add([0x1D, 0x56, 0x42, 0x00]);
      }

      await this.writeRaw(new Uint8Array(bytes));
    } catch (err: any) {
      console.error('[DirectPrint] Error printing barcode:', err);
      throw new Error(`Thermal barcode label printing failed: ${err.message || err}`);
    }
  },

  /**
   * Send a test pattern to the connected thermal printer
   */
  async testPrintDirect(): Promise<void> {
    try {
      const bytes: number[] = [];
      const add = (arr: number[]) => bytes.push(...arr);
      const addText = (text: string) => bytes.push(...GLOBAL_TEXT_ENCODER.encode(text));
      const addNewLine = () => bytes.push(0x0A);

      // Initialize
      add([0x1B, 0x40]);
      add([0x1B, 0x74, 0x00]);
      
      // Title
      add([0x1B, 0x61, 0x01]);
      add([0x1D, 0x21, 0x11]);
      add([0x1B, 0x45, 0x01]);
      addText('DO BILL POS');
      addNewLine();
      add([0x1D, 0x21, 0x00]);
      add([0x1B, 0x45, 0x00]);
      
      addText('DIRECT THERMAL PRINTER TEST');
      addNewLine();
      addText('--------------------------------');
      addNewLine();
      
      // Body
      add([0x1B, 0x61, 0x00]);
      addText('Status:       ONLINE & OPERATIONAL'); addNewLine();
      addText(`Platform:     ${isAndroidNative() ? 'ANDROID APK (NATIVE)' : isElectronApp() ? 'ELECTRON DESKTOP' : 'WEB BROWSER'}`); addNewLine();
      addText(`Printer:      ${this.getConnectedPrinterName()}`); addNewLine();
      addText(`Timestamp:    ${new Date().toLocaleString('en-IN')}`); addNewLine();
      addText('--------------------------------'); addNewLine();
      
      // Formatting test
      add([0x1B, 0x45, 0x01]);
      addText('Bold Text Mode Test: OK'); addNewLine();
      add([0x1B, 0x45, 0x00]);
      
      add([0x1D, 0x21, 0x10]);
      addText('Double Height Test'); addNewLine();
      add([0x1D, 0x21, 0x00]);
      
      addText('--------------------------------'); addNewLine();
      
      // Test barcode
      add([0x1B, 0x61, 0x01]);
      addText('TEST BARCODE:'); addNewLine();
      add([0x1D, 0x68, 60]);
      add([0x1D, 0x77, 2]);
      add([0x1D, 0x66, 2]);
      add([0x1D, 0x6B, 69, 10]);
      addText('DOBILL1234');
      addNewLine();
      
      addText('--------------------------------'); addNewLine();
      add([0x1B, 0x45, 0x01]);
      addText('TEST COMPLETED SUCCESSFULLY!');
      addNewLine();
      add([0x1B, 0x45, 0x00]);
      addText('Thank you for using Do Bill.'); addNewLine();

      // Feed & Cut
      add([0x1B, 0x64, 0x05]);
      add([0x1D, 0x56, 0x41, 0x00]);

      await this.writeRaw(new Uint8Array(bytes));
    } catch (err: any) {
      console.error('[DirectPrint] Test print error:', err);
      throw new Error(`Test print failed: ${err.message || err}`);
    }
  }
};

// Persistent printer configurations interface
export interface PrinterConfig {
  billPrinterName: string;
  labelPrinterName: string;
  billPaperWidth: '80mm' | '58mm';
  labelSize: '50x25' | '50x30' | '38x25' | '35x22' | '50x38' | '75x50' | '100x50' | '100x75' | '100x150' | 'custom' | string;
  labelCustomWidthMm: number;
  labelCustomHeightMm: number;
  silentPrint: boolean;
  copies: number;
  autoCutPaper: boolean;
}

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  billPrinterName: '',
  labelPrinterName: '',
  billPaperWidth: '80mm',
  labelSize: '50x25',
  labelCustomWidthMm: 50,
  labelCustomHeightMm: 25,
  silentPrint: false,
  copies: 1,
  autoCutPaper: true,
};

export const getPrinterConfig = (): PrinterConfig => {
  try {
    const raw = localStorage.getItem('dobill_printer_config');
    if (!raw) return { ...DEFAULT_PRINTER_CONFIG };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PRINTER_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_PRINTER_CONFIG };
  }
};

export const savePrinterConfig = (updated: Partial<PrinterConfig>): PrinterConfig => {
  const current = getPrinterConfig();
  const next = { ...current, ...updated };
  try {
    localStorage.setItem('dobill_printer_config', JSON.stringify(next));
  } catch (e) {
    console.error('Failed to save printer config:', e);
  }
  return next;
};

/**
 * Automatically calculates optimum thermal label dimensions (width x height in mm)
 * based on selected thermal printer specifications or defaults to standard 50mm x 25mm auto-fit label.
 * Never defaults to A4/Letter.
 */
export const detectAutoLabelDimensions = (printerName?: string): { widthMm: number; heightMm: number } => {
  if (!printerName) {
    return { widthMm: 50, heightMm: 30 };
  }
  const lower = printerName.toLowerCase();
  
  // 4-inch printers (TVS LP45 DLite 4", Zebra ZD, TSC 244 Pro, 100mm, 4inch)
  if (lower.includes('100mm') || lower.includes('4inch') || lower.includes('4"')) {
    return { widthMm: 100, heightMm: 50 };
  }
  // 3-inch printers (75mm - 80mm)
  if (lower.includes('75mm') || lower.includes('80mm') || lower.includes('3inch') || lower.includes('3"')) {
    return { widthMm: 75, heightMm: 50 };
  }
  // Standard 2-inch / 50x30mm thermal label printers (TVS LP45 DLite, TVS RP 3230, Zebra, TSC, XPrinter, Rongta, HPRT, etc.)
  return { widthMm: 50, heightMm: 30 };
};

/**
 * Parses label dimensions in mm.
 * Auto-detects based on active printer if no explicit size passed.
 */
export const parseLabelDimensions = (labelSize?: string, customW = 50, customH = 30): { widthMm: number; heightMm: number } => {
  if (labelSize && labelSize.includes('x') && labelSize !== 'custom') {
    const parts = labelSize.split('x');
    const w = parseInt(parts[0], 10);
    const h = parseInt(parts[1], 10);
    if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
      return { widthMm: Math.min(w, 118), heightMm: h };
    }
  }
  const config = getPrinterConfig();
  return detectAutoLabelDimensions(config.labelPrinterName || config.billPrinterName);
};

/**
 * Build clean thermal receipt HTML string for Web/Electron
 */
export function buildReceiptHTML(sale: Sale, shopDetails?: ShopDetails | null, userProfile?: any, configOverride?: Partial<PrinterConfig>): string {
  const cfg = { ...getPrinterConfig(), ...configOverride };
  const shopName = shopDetails?.name || 'STORE RECEIPT';
  const shopAddress = shopDetails?.address || '';
  const shopPhone = shopDetails?.phone || '';
  const paperWidth = cfg.billPaperWidth || shopDetails?.paperSize || '80mm';
  const is80 = paperWidth === '80mm';
  const paperVal = is80 ? '80mm' : '58mm';
  const printableWidth = is80 ? '72mm' : '52mm';

  const customerRows = [];
  if (sale.customerName) {
    customerRows.push(`
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5mm;">
        <span style="font-weight: bold;">Customer:</span>
        <span style="font-weight: 900; text-transform: uppercase;">${sale.customerName}</span>
      </div>
    `);
  }
  if (sale.customerPhone) {
    customerRows.push(`
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5mm;">
        <span style="font-weight: bold;">Phone:</span>
        <span>${sale.customerPhone}</span>
      </div>
    `);
  }
  if (sale.customerAddress) {
    customerRows.push(`
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5mm;">
        <span style="font-weight: bold;">Address:</span>
        <span style="text-align: right; word-break: break-all;">${sale.customerAddress}</span>
      </div>
    `);
  }

  const itemsRows = (sale.items || []).map(item => `
    <tr style="border-bottom: 1px dashed #cccccc;">
      <td style="padding: 1.5mm 0; text-align: left;">
        <div style="font-weight: 900; line-height: 1.1; font-size: 11px;">${item.name}</div>
        <div style="font-size: 9px; color: #222222; margin-top: 0.2mm;">@₹${item.sellingPrice.toFixed(2)}</div>
      </td>
      <td style="text-align: center; padding: 1.5mm 0; font-weight: bold;">${item.quantity}</td>
      <td style="text-align: right; padding: 1.5mm 0; font-weight: bold;">₹${(item.sellingPrice * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=${paperVal}, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title></title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    @page {
      size: ${paperVal} auto portrait !important;
      margin: 0mm !important;
    }
    @media print {
      @page {
        size: ${paperVal} auto portrait !important;
        margin: 0mm !important;
      }
      html, body {
        width: ${paperVal} !important;
        margin: 0mm !important;
        padding: 0mm !important;
        background: #ffffff !important;
        -webkit-transform: scale(1) !important;
        transform: scale(1) !important;
      }
      .thermal-receipt {
        width: ${printableWidth} !important;
        max-width: ${printableWidth} !important;
        margin: 0 auto !important;
        padding: 1mm 1mm 2mm 1mm !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
    html, body {
      width: ${paperVal} !important;
      margin: 0 auto !important;
      padding: 0 !important;
      background: #ffffff !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", monospace !important;
    }
    .thermal-receipt {
      width: ${printableWidth} !important;
      max-width: ${printableWidth} !important;
      margin: 0 auto !important;
      padding: 1mm 1mm 2mm 1mm !important;
      color: #000000 !important;
      background: #ffffff !important;
      font-size: 11px !important;
    }
    .receipt-header { text-align: center; margin-bottom: 2mm; width: 100%; }
    .shop-name { font-size: 16px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
    .shop-detail { font-size: 10px; margin: 0; line-height: 1.1; }
    .receipt-sep { border-top: 1px dashed #000000; margin: 2mm 0; width: 100%; }
    .receipt-info-grid { font-size: 10px; margin-bottom: 2mm; width: 100%; font-weight: 600; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 0.5mm; }
    .receipt-table { width: 100%; border-collapse: collapse; font-size: 10px; margin: 1mm 0; }
    .receipt-table th { text-align: left; border-bottom: 1.5px solid #000000; padding: 1.5mm 0; font-weight: 700; text-transform: uppercase; }
    .totals-area { font-size: 11px; padding: 1mm 0; font-weight: 700; }
    .grand-total-row { font-size: 15px; font-weight: 900; border-top: 1.5px solid #000000; border-bottom: 1.5px solid #000000; margin-top: 1mm; padding: 1.5mm 0; display: flex; justify-content: space-between; }
    .payment-info { font-size: 10px; margin-top: 1.5mm; font-weight: 600; }
    .receipt-footer { text-align: center; margin-top: 2mm; font-size: 9px; padding-bottom: 1mm; }
  </style>
</head>
<body>
  <div class="thermal-receipt">
    <div class="receipt-header">
      ${shopDetails?.logo ? `
        <div style="text-align: center; margin-bottom: 2mm;">
          <img src="${shopDetails.logo}" style="height: 14mm; width: 14mm; border-radius: 8px; object-fit: cover; border: 1px solid #e2e8f0; display: inline-block;" />
        </div>
      ` : ''}
      <h1 class="shop-name">${shopName}</h1>
      ${shopAddress ? `<p class="shop-detail">${shopAddress}</p>` : ''}
      ${shopPhone ? `<p class="shop-detail" style="font-weight: bold;">Tel: ${shopPhone}</p>` : ''}
    </div>
    
    <div class="receipt-sep"></div>
    
    <div class="receipt-info-grid">
      <div class="info-row">
        <span>Bill No:</span>
        <span style="font-weight: bold;">${sale.invoiceNumber}</span>
      </div>
      <div class="info-row">
        <span>Date:</span>
        <span>${new Date(sale.createdAt).toLocaleDateString('en-IN')}</span>
      </div>
      <div class="info-row">
        <span>Time:</span>
        <span>${new Date(sale.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div class="info-row">
        <span>Cashier:</span>
        <span style="font-weight: bold; text-transform: uppercase;">${userProfile?.name || 'Do Bill Cashier'}</span>
      </div>
      ${customerRows.join('')}
    </div>
    
    <div class="receipt-sep"></div>
    
    <table class="receipt-table">
      <thead>
        <tr>
          <th style="width: 50%;">ITEM</th>
          <th style="width: 20%; text-align: center;">QTY</th>
          <th style="width: 30%; text-align: right;">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>
    
    <div class="receipt-sep"></div>
    
    <div class="totals-area">
      <div style="display: flex; justify-content: space-between;">
        <span>Subtotal:</span>
        <span>₹${sale.subtotal.toFixed(2)}</span>
      </div>
      ${sale.taxTotal > 0 ? `
        <div style="display: flex; justify-content: space-between;">
          <span>GST (Tax):</span>
          <span>₹${sale.taxTotal.toFixed(2)}</span>
        </div>
      ` : ''}
      <div class="grand-total-row">
        <span>GRAND TOTAL</span>
        <span>₹${sale.grandTotal.toFixed(2)}</span>
      </div>
    </div>
    
    <div class="receipt-sep"></div>
    
    <div class="payment-info">
      <div style="display: flex; justify-content: space-between; text-transform: uppercase;">
        <span>Mode:</span>
        <span style="font-weight: 900;">${sale.paymentMode}</span>
      </div>
      ${sale.paymentMode === 'cash' ? `
        <div style="display: flex; justify-content: space-between; margin-top: 0.5mm;">
          <span>Cash Paid:</span>
          <span>₹${sale.cashReceived.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 0.5mm; font-weight: bold;">
          <span>Change Due:</span>
          <span>₹${sale.changeDue.toFixed(2)}</span>
        </div>
      ` : ''}
    </div>
    
    <div class="receipt-sep"></div>
    
    <div class="receipt-footer">
      <p style="font-weight: 900; font-size: 11px; margin-bottom: 0.5mm;">THANK YOU FOR SHOPPING!</p>
      <p style="font-size: 8px; margin-top: 1mm; font-weight: bold;">Items once sold cannot be returned.</p>
      <p style="font-size: 8px; margin-top: 2mm; border-top: 1px solid #000000; padding-top: 1mm; font-weight: bold;">POWERED BY DO BILL</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Detect thermal printer hardware by name
 */
export const isThermalPrinterName = (printerName: string): boolean => {
  if (!printerName) return true;
  const lower = printerName.toLowerCase();
  const thermalKeywords = [
    'thermal', 'tvs', 'lp45', 'lp 45', 'dlite', 'zebra', 'tsc', 'godex',
    'xprinter', 'hprt', 'rongta', 'citizen', 'honeywell', 'bixolon',
    'sato', 'label', 'pos', 'receipt', 'postek', 'gprinter', 'intermec',
    'snbc', 'sewoo', 'dymo', 'brother'
  ];
  return thermalKeywords.some(kw => lower.includes(kw));
};

/**
 * Build standalone barcode label HTML document for thermal label printing.
 * Dynamically calculates dimensions and strictly uses static CSS @page size declarations
 * so Chrome / Edge print preview locks directly to the label dimensions (e.g., 50mm x 25mm)
 * with zero margin and zero extra white space without ever defaulting to A4.
 */
export function buildBarcodeLabelHTML(labelsInnerHTML: string, targetPrinterNameOrSize?: string, customW?: number, customH?: number): string {
  let w = 50;
  let h = 30;

  if (customW && customH && customW > 0 && customH > 0) {
    w = customW;
    h = customH;
  } else if (targetPrinterNameOrSize && targetPrinterNameOrSize.includes('x') && !targetPrinterNameOrSize.includes(' ')) {
    const parsed = parseLabelDimensions(targetPrinterNameOrSize);
    w = parsed.widthMm;
    h = parsed.heightMm;
  } else {
    const config = getPrinterConfig();
    const printerName = targetPrinterNameOrSize || config.labelPrinterName || config.billPrinterName;
    const detected = detectAutoLabelDimensions(printerName);
    w = detected.widthMm;
    h = detected.heightMm;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=${w}mm, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Barcode Labels (${w}mm x ${h}mm)</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    @page {
      size: ${w}mm ${h}mm !important;
      margin: 0mm !important;
    }
    @media print {
      @page {
        size: ${w}mm ${h}mm !important;
        margin: 0mm !important;
      }
      html, body {
        width: ${w}mm !important;
        height: auto !important;
        min-width: ${w}mm !important;
        max-width: ${w}mm !important;
        min-height: 0 !important;
        max-height: none !important;
        margin: 0mm !important;
        padding: 0mm !important;
        background: #ffffff !important;
        overflow: visible !important;
        -webkit-transform: scale(1) !important;
        transform: scale(1) !important;
      }
      .container {
        width: ${w}mm !important;
        max-width: ${w}mm !important;
        height: auto !important;
        margin: 0 auto !important;
        padding: 0 !important;
        display: block !important;
      }
      .label-card {
        width: ${w}mm !important;
        height: ${h}mm !important;
        min-width: ${w}mm !important;
        max-width: ${w}mm !important;
        min-height: ${h}mm !important;
        max-height: ${h}mm !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
        page-break-after: always !important;
        break-after: page !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .label-card:last-child {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
    }
    html, body {
      width: ${w}mm !important;
      min-width: ${w}mm !important;
      max-width: ${w}mm !important;
      height: auto !important;
      margin: 0 auto !important;
      padding: 0 !important;
      background: #ffffff !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
      text-align: center !important;
      display: block !important;
      overflow: visible !important;
    }
    .container {
      width: ${w}mm !important;
      max-width: ${w}mm !important;
      height: auto !important;
      margin: 0 auto !important;
      padding: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: flex-start !important;
    }
    .label-card {
      width: ${w}mm !important;
      height: ${h}mm !important;
      min-width: ${w}mm !important;
      max-width: ${w}mm !important;
      min-height: ${h}mm !important;
      max-height: ${h}mm !important;
      margin: 0 auto !important;
      padding: 1mm 1.5mm !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 1.2mm !important;
      text-align: center !important;
      box-sizing: border-box !important;
      overflow: visible !important;
      background: #ffffff !important;
      page-break-after: always !important;
      break-after: page !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .label-card:last-child {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    .name {
      font-size: ${Math.max(6.5, Math.min(10.5, Math.round(w * 0.12)))}pt !important;
      font-weight: 900 !important;
      width: 100% !important;
      line-height: 1.15 !important;
      color: #000000 !important;
      margin: 0 !important;
      padding: 0 !important;
      text-align: center !important;
      display: -webkit-box !important;
      -webkit-line-clamp: 2 !important;
      -webkit-box-orient: vertical !important;
      overflow: hidden !important;
    }
    .barcode-container {
      width: 100% !important;
      max-width: 100% !important;
      display: flex !important;
      justify-content: center !important;
      align-items: center !important;
      margin: 0 auto !important;
      padding: 0 !important;
      overflow: visible !important;
    }
    .barcode-container svg {
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
      max-height: ${Math.max(12, Math.round(h * 0.60))}mm !important;
      display: block !important;
      margin: 0 auto !important;
      overflow: visible !important;
    }
  </style>
</head>
<body>
  <div class="container">${labelsInnerHTML}</div>
</body>
</html>`;
}

/**
 * Universal HTML print helper for Web & Electron
 */
export const universalPrintHTML = async (
  htmlContent: string,
  options?: {
    printerName?: string;
    isLabel?: boolean;
    labelWidthMm?: number;
    labelHeightMm?: number;
    paperWidthMm?: number;
  }
): Promise<{ success: boolean; message: string }> => {
  const config = getPrinterConfig();
  const targetPrinterName = options?.printerName || (options?.isLabel ? config.labelPrinterName : config.billPrinterName);

  const autoLabelDims = options?.isLabel ? detectAutoLabelDimensions(targetPrinterName) : { widthMm: 80, heightMm: 297 };
  const effectiveLabelW = options?.labelWidthMm || autoLabelDims.widthMm;
  const effectiveLabelH = options?.labelHeightMm || autoLabelDims.heightMm;

  // 1. Electron Desktop - Native Direct/Silent Print API
  if (isElectronApp() && (window as any).electronAPI) {
    try {
      const electronAPI = (window as any).electronAPI;
      const widthMicrons = options?.isLabel
        ? Math.round(effectiveLabelW * 1000)
        : Math.round(((options?.paperWidthMm || (config.billPaperWidth === '80mm' ? 80 : 58))) * 1000);

      const heightMicrons = options?.isLabel
        ? Math.round(effectiveLabelH * 1000)
        : 297000;

      const printOptions: any = {
        printerName: targetPrinterName || undefined,
        silent: config.silentPrint,
        margins: { marginType: 'none' },
        printBackground: true,
        landscape: false,
        copies: config.copies || 1,
        pageSize: { width: widthMicrons, height: heightMicrons },
        htmlContent: htmlContent
      };

      if (electronAPI.print) {
        await electronAPI.print(printOptions);
        return { success: true, message: "Printed via Electron" };
      } else if (electronAPI.printSilent) {
        await electronAPI.printSilent(htmlContent, printOptions);
        return { success: true, message: "Printed via Electron" };
      }
    } catch (electronErr: any) {
      console.warn('[DirectPrint] Electron native print call error, falling back to window print:', electronErr);
    }
  }

  // 2. Browser Popup Window Print (Primary for Chrome & Desktop browsers to respect @page dimensions)
  try {
    const popW = Math.max(450, Math.round(effectiveLabelW * 4));
    const popH = Math.max(350, Math.round(effectiveLabelH * 4));
    const printWin = window.open('', '_blank', `width=${popW},height=${popH},toolbar=no,scrollbars=yes,status=no,resizable=yes`);
    if (printWin) {
      printWin.document.open();
      printWin.document.write(htmlContent);
      printWin.document.title = "";
      printWin.document.close();

      await new Promise((res) => setTimeout(res, 350));

      printWin.focus();
      printWin.onafterprint = () => {
        try {
          if (!printWin.closed) printWin.close();
        } catch (e) {}
      };
      printWin.print();

      setTimeout(() => {
        try {
          if (!printWin.closed) printWin.close();
        } catch (e) {}
      }, 30000);

      return { success: true, message: "Print Command Sent" };
    }
  } catch (winErr) {
    console.warn('[DirectPrint] Popup print window failed, falling back to iframe:', winErr);
  }

  // 3. Fallback to hidden iframe if popups are blocked by browser popup blocker
  try {
    const iframe = document.createElement('iframe');
    iframe.id = 'dobill-universal-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    iframe.style.zIndex = '-9999';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();

      await new Promise((res) => setTimeout(res, 400));

      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();

      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 3000);

      return { success: true, message: "Print Command Sent" };
    }
  } catch (iframeErr) {
    console.warn('[DirectPrint] Iframe print fallback error:', iframeErr);
  }

  return { success: false, message: "Browser print failed." };
};

export const openInNewPrintWindow = (htmlContent: string) => {
  if (isAndroidNative()) return;
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const blobUrl = URL.createObjectURL(blob);
  const printWindow = window.open(blobUrl, '_blank');
  
  if (!printWindow) {
    window.location.href = blobUrl;
    return;
  }

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };
};

export const downloadPrintableHTML = (htmlContent: string, fileName: string = 'barcode-labels.html') => {
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Universal Main Entry Point for Printing Bills & Receipts
 */
export const handlePrint = async (sale: Sale): Promise<{ success: boolean; message: string }> => {
  let shopDetails: ShopDetails | null = null;
  let userProfile: any = null;
  try {
    shopDetails = await DataService.getShopDetails();
    userProfile = await DataService.getUserProfile();
  } catch (err) {
    console.warn("[DirectPrint] Failed to preload metadata:", err);
  }

  const config = getPrinterConfig();

  // 1. Electron Desktop - Silent Native Thermal Print with target printer name
  if (isElectronApp()) {
    try {
      const htmlContent = buildReceiptHTML(sale, shopDetails, userProfile, config);
      return await universalPrintHTML(htmlContent, {
        printerName: config.billPrinterName,
        isLabel: false,
        paperWidthMm: config.billPaperWidth === '80mm' ? 80 : 58
      });
    } catch (err: any) {
      console.error('[DirectPrint] Electron print error:', err);
      return { success: false, message: "Windows Printer Error" };
    }
  } 

  // 2. Android APK - Direct ESC/POS Thermal Printing
  if (isAndroidNative()) {
    try {
      await DirectPrintService.autoConnect();

      if (DirectPrintService.isPrinterConnected()) {
        await DirectPrintService.printReceiptDirect(sale, shopDetails);
        return { success: true, message: "Receipt Printed Successfully!" };
      } else {
        return { 
          success: false, 
          message: "No Android Thermal Printer configured. Please tap Printer Setup to select a Bluetooth, USB OTG, or Network Printer." 
        };
      }
    } catch (err: any) {
      console.error('[DirectPrint] Android native direct print error:', err);
      return { success: false, message: `Android Print Failed: ${err.message || err}` };
    }
  }

  // 3. Web Thermal Direct Connection (if connected via WebUSB / WebBluetooth)
  if (DirectPrintService.isPrinterConnected()) {
    try {
      await DirectPrintService.printReceiptDirect(sale, shopDetails);
      return { success: true, message: "Receipt Printed Successfully!" };
    } catch (err: any) {
      console.warn('[DirectPrint] Direct Web thermal print failed, trying browser print:', err);
    }
  }

  // Fallback to standard browser print
  const htmlContent = buildReceiptHTML(sale, shopDetails, userProfile, config);
  return await universalPrintHTML(htmlContent, {
    isLabel: false,
    paperWidthMm: config.billPaperWidth === '80mm' ? 80 : 58
  });
};

// Singleton guard to prevent duplicate lifecycle listener registrations during HMR / module reloads
let isLifecycleListenerRegistered = false;

if (typeof window !== 'undefined' && !isLifecycleListenerRegistered) {
  isLifecycleListenerRegistered = true;

  if (isAndroidNative()) {
    getCapacitorApp().then((appPlugin) => {
      if (appPlugin) {
        appPlugin.addListener('appStateChange', (state) => {
          if (state.isActive) {
            console.log('[DirectPrint] Android app resumed to foreground, auto-reconnecting printer...');
            DirectPrintService.autoConnect().catch((err) => {
              console.warn('[DirectPrint] Auto-reconnect on resume failed:', err);
            });
          }
        });
      }
    }).catch((e) => {
      console.warn('[DirectPrint] Capacitor App listener setup error:', e);
    });
  } else {
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        DirectPrintService.autoConnect().catch(() => {});
      }
    });
  }
}
