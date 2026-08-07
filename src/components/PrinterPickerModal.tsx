import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  Bluetooth, 
  Usb, 
  Wifi, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Power, 
  X, 
  Play,
  Settings2,
  Tag,
  Receipt,
  Check
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  DirectPrintService, 
  isAndroidNative, 
  isElectronApp, 
  SavedPrinterInfo,
  getPrinterConfig,
  savePrinterConfig,
  PrinterConfig,
  parseLabelDimensions,
  universalPrintHTML,
  buildBarcodeLabelHTML,
  buildReceiptHTML
} from '@/services/directPrintService';
import { DataService } from '@/services/dataService';
import { toast } from 'sonner';

interface PrinterPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PrinterPickerModal: React.FC<PrinterPickerModalProps> = ({ open, onOpenChange }) => {
  const [activeMainTab, setActiveMainTab] = useState<'settings' | 'hardware'>('settings');
  const [activeHardwareTab, setActiveHardwareTab] = useState<'bluetooth' | 'usb' | 'tcp'>('bluetooth');
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<Array<{ name: string; address: string }>>([]);
  const [connectingAddress, setConnectingAddress] = useState<string | null>(null);
  
  // Available Windows / System Printers (in Electron)
  const [systemPrinters, setSystemPrinters] = useState<Array<{ name: string; isDefault: boolean }>>([]);

  // Persistent Printer Config State
  const [printerConfig, setPrinterConfigState] = useState<PrinterConfig>(getPrinterConfig());

  // TCP IP fields
  const [tcpIp, setTcpIp] = useState('192.168.1.100');
  const [tcpPort, setTcpPort] = useState('9100');

  // Active saved printer
  const [savedPrinter, setSavedPrinter] = useState<SavedPrinterInfo | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isTestPrinting, setIsTestPrinting] = useState(false);
  const [isTestLabelPrinting, setIsTestLabelPrinting] = useState(false);

  const refreshPrinterStatus = async () => {
    const saved = DirectPrintService.getSavedPrinter();
    setSavedPrinter(saved);
    setIsConnected(DirectPrintService.isPrinterConnected());
    setPrinterConfigState(getPrinterConfig());

    if (isElectronApp() && (window as any).electronAPI?.getPrinters) {
      try {
        const printers = await (window as any).electronAPI.getPrinters();
        if (Array.isArray(printers)) {
          setSystemPrinters(printers);
        }
      } catch (err) {
        console.warn('Failed to load system printers from Electron:', err);
      }
    }
  };

  useEffect(() => {
    if (open) {
      refreshPrinterStatus();
      if (isAndroidNative()) {
        handleScanBluetooth();
      }
    }
  }, [open]);

  const handleUpdateConfig = (updates: Partial<PrinterConfig>) => {
    const next = savePrinterConfig(updates);
    setPrinterConfigState(next);
    toast.success("Printer settings saved!");

    // If bill paper width changed, sync with shop details as well
    if (updates.billPaperWidth) {
      DataService.getShopDetails().then(shop => {
        DataService.setShopDetails({ ...shop, paperSize: updates.billPaperWidth });
      }).catch(() => {});
    }
  };

  const handleScanBluetooth = async () => {
    setIsScanning(true);
    setDiscoveredDevices([]);
    try {
      if (isAndroidNative()) {
        const devices = await DirectPrintService.scanAndroidPrinters();
        setDiscoveredDevices(devices);
        if (devices.length === 0) {
          toast.info("No Bluetooth thermal printers found. Make sure printer is turned ON.");
        }
      } else {
        toast.info("Click 'Scan / Pair Bluetooth' to open browser picker.");
      }
    } catch (err: any) {
      console.error("Bluetooth scan error:", err);
      toast.error(err.message || "Failed to scan for Bluetooth devices.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleConnectBluetoothDevice = async (address?: string, name?: string) => {
    setConnectingAddress(address || 'browser');
    try {
      const res = await DirectPrintService.connectBluetooth(address);
      if (res.success) {
        toast.success(`Connected to ${res.name}!`);
        await refreshPrinterStatus();
      } else {
        toast.error(res.error || "Failed to connect to printer.");
      }
    } catch (err: any) {
      toast.error(`Connection error: ${err.message || err}`);
    } finally {
      setConnectingAddress(null);
    }
  };

  const handleConnectUSB = async () => {
    try {
      const res = await DirectPrintService.connectUSB();
      if (res.success) {
        toast.success(`Connected to ${res.name}!`);
        await refreshPrinterStatus();
      } else {
        toast.error(res.error || "Failed to connect USB printer.");
      }
    } catch (err: any) {
      toast.error(`USB error: ${err.message || err}`);
    }
  };

  const handleSaveTcp = async () => {
    if (!tcpIp.trim()) {
      toast.error("Please enter a valid IP address.");
      return;
    }
    try {
      const res = await DirectPrintService.selectAndroidPrinter({
        type: 'android_tcp',
        name: `Network Printer (${tcpIp})`,
        ip: tcpIp.trim(),
        port: parseInt(tcpPort) || 9100
      });
      if (res.success) {
        toast.success(`Saved Network Printer ${tcpIp}!`);
        await refreshPrinterStatus();
      } else {
        toast.error(res.error || "Failed to save TCP printer.");
      }
    } catch (err: any) {
      toast.error(`TCP error: ${err.message || err}`);
    }
  };

  const handleDisconnect = async () => {
    await DirectPrintService.disconnect();
    toast.success("Printer disconnected.");
    await refreshPrinterStatus();
  };

  const handleRunTestBillPrint = async () => {
    setIsTestPrinting(true);
    try {
      const dummySale: any = {
        invoiceNumber: "TEST-" + Math.floor(1000 + Math.random() * 9000),
        createdAt: new Date().toISOString(),
        customerName: "Test Customer",
        customerPhone: "9876543210",
        items: [
          { name: "Test Item 1 (3-inch Thermal)", sellingPrice: 150.00, quantity: 2 },
          { name: "Test Item 2", sellingPrice: 200.00, quantity: 1 }
        ],
        subtotal: 500.00,
        taxTotal: 0.00,
        grandTotal: 500.00,
        paymentMode: "cash",
        cashReceived: 500.00,
        changeDue: 0.00
      };
      const shop = await DataService.getShopDetails();
      const user = await DataService.getUserProfile();
      const html = buildReceiptHTML(dummySale, shop, user, printerConfig);
      await universalPrintHTML(html, {
        printerName: printerConfig.billPrinterName,
        isLabel: false,
        paperWidthMm: printerConfig.billPaperWidth === '80mm' ? 80 : 58
      });
      toast.success("Test bill printed!");
    } catch (err: any) {
      toast.error(`Test print failed: ${err.message || err}`);
    } finally {
      setIsTestPrinting(false);
    }
  };

  const handleRunTestLabelPrint = async () => {
    setIsTestLabelPrinting(true);
    try {
      const labelCardHTML = `
        <div class="label-card">
          <div class="brand">DO BILL DEMO SHOP</div>
          <div class="name">Sample Product</div>
          <div class="barcode-container">
            <svg viewBox="0 0 100 30" width="100%" height="100%">
              <rect x="5" y="0" width="3" height="30" fill="#000"/>
              <rect x="11" y="0" width="2" height="30" fill="#000"/>
              <rect x="16" y="0" width="5" height="30" fill="#000"/>
              <rect x="24" y="0" width="2" height="30" fill="#000"/>
              <rect x="29" y="0" width="4" height="30" fill="#000"/>
              <rect x="36" y="0" width="2" height="30" fill="#000"/>
              <rect x="41" y="0" width="6" height="30" fill="#000"/>
              <rect x="50" y="0" width="2" height="30" fill="#000"/>
              <rect x="55" y="0" width="4" height="30" fill="#000"/>
              <rect x="62" y="0" width="3" height="30" fill="#000"/>
              <rect x="68" y="0" width="2" height="30" fill="#000"/>
              <rect x="73" y="0" width="5" height="30" fill="#000"/>
              <rect x="81" y="0" width="2" height="30" fill="#000"/>
              <rect x="86" y="0" width="4" height="30" fill="#000"/>
              <rect x="93" y="0" width="2" height="30" fill="#000"/>
            </svg>
          </div>
          <div class="price">₹499.00</div>
        </div>
      `;
      const html = buildBarcodeLabelHTML(labelCardHTML, printerConfig.labelPrinterName || printerConfig.billPrinterName);
      await universalPrintHTML(html, {
        printerName: printerConfig.labelPrinterName,
        isLabel: true
      });
      toast.success("Test label printed!");
    } catch (err: any) {
      toast.error(`Test label print failed: ${err.message || err}`);
    } finally {
      setIsTestLabelPrinting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-full p-6 bg-white rounded-2xl shadow-2xl border border-slate-200">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Printer className="h-5 w-5 text-indigo-600" />
              Thermal Printer & Label Settings
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Configure bill paper width, thermal label sizes, and printer routing.
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Main Navigation Tabs */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
          <Button
            type="button"
            variant={activeMainTab === 'settings' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveMainTab('settings')}
            className="text-xs font-bold gap-2 h-9"
          >
            <Settings2 className="h-4 w-4" />
            Printer Configuration
          </Button>
          <Button
            type="button"
            variant={activeMainTab === 'hardware' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveMainTab('hardware')}
            className="text-xs font-bold gap-2 h-9"
          >
            <Bluetooth className="h-4 w-4" />
            Hardware & ESC/POS
          </Button>
        </div>

        {/* TAB 1: PRINTER CONFIGURATION */}
        {activeMainTab === 'settings' && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            
            {/* Bill Receipt Printer Settings */}
            <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 space-y-3">
              <div className="flex items-center gap-2 text-indigo-900 font-black text-xs uppercase tracking-wider">
                <Receipt className="h-4 w-4 text-indigo-600" />
                <span>1. Bill Printing Settings</span>
              </div>

              {systemPrinters.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Select Bill Printer (System)</Label>
                  <select
                    value={printerConfig.billPrinterName}
                    onChange={(e) => handleUpdateConfig({ billPrinterName: e.target.value })}
                    className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold"
                  >
                    <option value="">Default Windows Printer</option>
                    {systemPrinters.map(p => (
                      <option key={p.name} value={p.name}>
                        {p.name} {p.isDefault ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Bill Paper Roll Width</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={printerConfig.billPaperWidth === '80mm' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleUpdateConfig({ billPaperWidth: '80mm' })}
                    className="text-xs font-bold h-9"
                  >
                    3 Inch (80mm) - Recommended
                  </Button>
                  <Button
                    type="button"
                    variant={printerConfig.billPaperWidth === '58mm' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleUpdateConfig({ billPaperWidth: '58mm' })}
                    className="text-xs font-bold h-9"
                  >
                    2 Inch (58mm)
                  </Button>
                </div>
              </div>
            </div>

            {/* Barcode Label Printer Settings */}
            <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50 space-y-3">
              <div className="flex items-center gap-2 text-emerald-900 font-black text-xs uppercase tracking-wider">
                <Tag className="h-4 w-4 text-emerald-600" />
                <span>2. Barcode Label Printer Settings</span>
              </div>

              {systemPrinters.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Select Thermal Label Printer (TVS, Zebra, TSC, etc.)</Label>
                  <select
                    value={printerConfig.labelPrinterName}
                    onChange={(e) => handleUpdateConfig({ labelPrinterName: e.target.value })}
                    className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold"
                  >
                    <option value="">Same as Bill Printer / Default</option>
                    {systemPrinters.map(p => (
                      <option key={p.name} value={p.name}>
                        {p.name} {p.isDefault ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Thermal Label Size & Page Dimensions</Label>
                <div className="bg-white border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-xs font-bold text-slate-800 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600 text-sm">⚡</span>
                    <div>
                      <p className="font-extrabold text-emerald-950">Fully Automatic Label Sizing</p>
                      <p className="text-[11px] font-semibold text-slate-500">Auto-detects printer printable width & fits content dynamically.</p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-extrabold uppercase text-[10px]">
                    Auto-Fit
                  </Badge>
                </div>
              </div>

              {/* Thermal Label Printer Setup & Calibration Guide */}
              <div className="mt-3 p-3.5 rounded-xl bg-slate-900 text-slate-100 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    🖨️ Thermal Label Setup & Sensor Calibration
                  </span>
                  <Badge variant="outline" className="text-[9px] border-amber-500/50 text-amber-300 font-bold bg-amber-500/10">
                    Industrial Standard
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                  {/* 1. Software Layout Setup */}
                  <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700 space-y-1">
                    <p className="font-extrabold text-emerald-400 text-[11px] flex items-center gap-1">
                      <span>1. Software Layout Setup</span>
                    </p>
                    <ul className="text-slate-300 space-y-0.5 list-disc list-inside text-[10.5px]">
                      <li><strong>Page Size:</strong> Manual / Custom</li>
                      <li><strong>Width / Height:</strong> 50mm x 25mm</li>
                      <li><strong>Label Type:</strong> Die-Cut / Labels with Gaps</li>
                    </ul>
                  </div>

                  {/* 2. Sensor & Gap Settings */}
                  <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700 space-y-1">
                    <p className="font-extrabold text-cyan-400 text-[11px] flex items-center gap-1">
                      <span>2. Gap & Sensor Tracking</span>
                    </p>
                    <ul className="text-slate-300 space-y-0.5 list-disc list-inside text-[10.5px]">
                      <li><strong>Gap/Pitch Height:</strong> 3.0 mm (0.12")</li>
                      <li><strong>Gap Offset:</strong> 0.0 mm</li>
                      <li><strong>Sensor Type:</strong> Transmissive / Gap</li>
                    </ul>
                  </div>

                  {/* 3. Safety Margins */}
                  <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700 space-y-1">
                    <p className="font-extrabold text-purple-400 text-[11px] flex items-center gap-1">
                      <span>3. Safety Margins (Center Print)</span>
                    </p>
                    <ul className="text-slate-300 space-y-0.5 list-disc list-inside text-[10.5px]">
                      <li><strong>Top / Bottom Margin:</strong> 1.5 mm</li>
                      <li><strong>Left / Right Margin:</strong> 1.5 mm</li>
                      <li>Keep barcode & text inside 1.5mm safety border</li>
                    </ul>
                  </div>

                  {/* 4. Quick Hardware Fix Calibration */}
                  <div className="bg-amber-950/40 p-2.5 rounded-lg border border-amber-800/60 space-y-1">
                    <p className="font-extrabold text-amber-300 text-[11px] flex items-center gap-1">
                      <span>💡 Hardware Gap Calibration</span>
                    </p>
                    <ol className="text-amber-200/90 space-y-0.5 list-decimal list-inside text-[10.5px]">
                      <li>Turn printer <strong>OFF</strong>.</li>
                      <li>Hold <strong>FEED</strong> button & turn <strong>ON</strong>.</li>
                      <li>Release when LED blinks 2-3 times.</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>

            {/* Test Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={handleRunTestBillPrint}
                disabled={isTestPrinting}
                className="h-10 font-bold text-xs gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                <Receipt className="h-3.5 w-3.5" />
                {isTestPrinting ? 'Printing Bill...' : 'Test Bill Print'}
              </Button>

              <Button
                variant="outline"
                onClick={handleRunTestLabelPrint}
                disabled={isTestLabelPrinting}
                className="h-10 font-bold text-xs gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                <Tag className="h-3.5 w-3.5" />
                {isTestLabelPrinting ? 'Printing Label...' : 'Test Label Print'}
              </Button>
            </div>

          </div>
        )}

        {/* TAB 2: HARDWARE & ESC/POS */}
        {activeMainTab === 'hardware' && (
          <div className="space-y-4">
            {/* Current Printer Status Banner */}
            <div className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
              isConnected 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isConnected ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                  <Printer className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">
                      {savedPrinter?.name || DirectPrintService.getConnectedPrinterName() || 'No Direct Hardware Selected'}
                    </span>
                    <Badge variant="outline" className={`text-[9px] uppercase font-black tracking-wider ${
                      isConnected ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'
                    }`}>
                      {isConnected ? 'ONLINE' : 'NOT CONNECTED'}
                    </Badge>
                  </div>
                  <p className="text-xs opacity-75 mt-0.5">
                    {savedPrinter ? `Type: ${savedPrinter.type.toUpperCase()}` : 'Connect ESC/POS hardware below'}
                  </p>
                </div>
              </div>

              {isConnected && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleDisconnect} 
                  className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  title="Disconnect Printer"
                >
                  <Power className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Connection Type Tabs */}
            <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl">
              <Button
                type="button"
                variant={activeHardwareTab === 'bluetooth' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveHardwareTab('bluetooth')}
                className="text-xs font-bold gap-1.5 h-9"
              >
                <Bluetooth className="h-3.5 w-3.5" />
                Bluetooth
              </Button>
              <Button
                type="button"
                variant={activeHardwareTab === 'usb' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveHardwareTab('usb')}
                className="text-xs font-bold gap-1.5 h-9"
              >
                <Usb className="h-3.5 w-3.5" />
                USB OTG
              </Button>
              <Button
                type="button"
                variant={activeHardwareTab === 'tcp' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveHardwareTab('tcp')}
                className="text-xs font-bold gap-1.5 h-9"
              >
                <Wifi className="h-3.5 w-3.5" />
                Network
              </Button>
            </div>

            {/* Hardware Sub-Tab 1: Bluetooth */}
            {activeHardwareTab === 'bluetooth' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nearby Bluetooth Printers</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleScanBluetooth} 
                    disabled={isScanning}
                    className="h-8 text-xs font-bold gap-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${isScanning ? 'animate-spin' : ''}`} />
                    {isScanning ? 'Scanning...' : 'Scan Again'}
                  </Button>
                </div>

                {discoveredDevices.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {discoveredDevices.map((dev) => (
                      <div 
                        key={dev.address}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-bold text-xs text-slate-800">{dev.name}</p>
                          <p className="text-[10px] font-mono text-slate-400">{dev.address}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleConnectBluetoothDevice(dev.address, dev.name)}
                          disabled={connectingAddress === dev.address}
                          className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700"
                        >
                          {connectingAddress === dev.address ? 'Connecting...' : 'Connect'}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <Bluetooth className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 font-medium">
                      {isScanning ? 'Scanning for nearby Bluetooth printers...' : 'No Bluetooth printers found yet.'}
                    </p>
                    <Button 
                      variant="link" 
                      onClick={() => handleConnectBluetoothDevice()} 
                      className="text-xs text-indigo-600 mt-1 font-bold"
                    >
                      Pair / Scan via System Settings
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Hardware Sub-Tab 2: USB OTG */}
            {activeHardwareTab === 'usb' && (
              <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 space-y-3">
                <Usb className="h-10 w-10 text-slate-400 mx-auto" />
                <div>
                  <p className="text-xs font-bold text-slate-800">USB Thermal Printer</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Connect your thermal printer using a USB OTG cable to your Android phone or tablet.
                  </p>
                </div>
                <Button 
                  onClick={handleConnectUSB}
                  className="w-full h-10 font-bold bg-indigo-600 hover:bg-indigo-700 gap-2 text-xs"
                >
                  <Usb className="h-4 w-4" />
                  Connect USB Printer
                </Button>
              </div>
            )}

            {/* Hardware Sub-Tab 3: Network TCP/IP */}
            {activeHardwareTab === 'tcp' && (
              <div className="space-y-4 p-4 border border-slate-200 rounded-xl bg-slate-50">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700">Printer IP Address</Label>
                  <Input 
                    placeholder="e.g. 192.168.1.100" 
                    value={tcpIp}
                    onChange={(e) => setTcpIp(e.target.value)}
                    className="bg-white text-xs font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700">Port (Default 9100)</Label>
                  <Input 
                    placeholder="9100" 
                    value={tcpPort}
                    onChange={(e) => setTcpPort(e.target.value)}
                    className="bg-white text-xs font-mono"
                  />
                </div>
                <Button 
                  onClick={handleSaveTcp}
                  className="w-full h-10 font-bold bg-indigo-600 hover:bg-indigo-700 gap-2 text-xs"
                >
                  <Wifi className="h-4 w-4" />
                  Save Network Printer
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Action Footer */}
        <div className="pt-2 border-t border-slate-100 flex justify-end">
          <Button 
            onClick={() => onOpenChange(false)}
            className="h-10 px-6 font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white rounded-xl"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
