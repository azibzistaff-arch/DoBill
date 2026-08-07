import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  Camera, 
  X, 
  Zap, 
  ZapOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Package, 
  Plus, 
  Minus, 
  Trash2,
  Volume2,
  VolumeX,
  Sparkles,
  ShoppingBag,
  Check,
  User,
  Focus
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Product, CartItem } from '@/types';
import { toast } from 'sonner';

interface CameraBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  cart: CartItem[];
  onAddToCart: (product: Product) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveFromCart: (id: string) => void;
  onQuickAddProduct?: (barcode: string) => void;
}

export const CameraBarcodeScannerModal: React.FC<CameraBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  products,
  cart,
  onAddToCart,
  onUpdateQuantity,
  onRemoveFromCart,
  onQuickAddProduct
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [focusRingPos, setFocusRingPos] = useState<{ x: number; y: number } | null>(null);
  const [isRefocusing, setIsRefocusing] = useState(false);
  const [lastScannedResult, setLastScannedResult] = useState<{
    code: string;
    productName: string;
    price: number;
    time: string;
    success: boolean;
    message: string;
  } | null>(null);

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const lastScanTimeRef = useRef<{ [code: string]: number }>({});
  const retryCountRef = useRef<number>(0);
  const scannerContainerId = 'camera-barcode-reader-view';

  // Crisp audio feedback on successful scan
  const playBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch {
      // Audio context error ignore
    }
  }, [soundEnabled]);

  // Audio error sound
  const playErrorBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch {
      // Audio error ignore
    }
  }, [soundEnabled]);

  // Process scanned barcode
  const handleBarcodeScanned = useCallback((rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    // Cooldown check: prevent scanning the same barcode within 1.4 seconds
    const now = Date.now();
    const lastTime = lastScanTimeRef.current[code] || 0;
    if (now - lastTime < 1400) {
      return;
    }
    lastScanTimeRef.current[code] = now;

    // Find product in list (match barcode or clean barcode)
    const cleanQuery = code.toLowerCase();
    const product = products.find(p => 
      (p.barcode && p.barcode.trim().toLowerCase() === cleanQuery) ||
      (p.name && p.name.trim().toLowerCase() === cleanQuery)
    );

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (product) {
      const avail = product.stockQuantity !== undefined && product.stockQuantity !== null ? product.stockQuantity : ((product as any).stock_quantity ?? 0);
      if (avail <= 0) {
        playErrorBeep();
        setLastScannedResult({
          code,
          productName: product.name,
          price: product.sellingPrice,
          time: timeStr,
          success: false,
          message: `Out of Stock! (0 pcs in stock)`
        });
        toast.error(`"${product.name}" is out of stock!`);
        return;
      }

      playBeep();
      onAddToCart(product);
      setLastScannedResult({
        code,
        productName: product.name,
        price: product.sellingPrice,
        time: timeStr,
        success: true,
        message: `Added to cart (₹${product.sellingPrice})`
      });
    } else {
      playErrorBeep();
      setLastScannedResult({
        code,
        productName: 'Unknown Product',
        price: 0,
        time: timeStr,
        success: false,
        message: `Barcode "${code}" not found in inventory`
      });
      toast.error(`Barcode "${code}" not found!`, {
        action: onQuickAddProduct ? {
          label: 'Add Product',
          onClick: () => onQuickAddProduct(code)
        } : undefined
      });
    }
  }, [products, onAddToCart, playBeep, playErrorBeep, onQuickAddProduct]);

  // Stop current scanner instance
  const stopScanner = useCallback(async () => {
    if (html5QrcodeRef.current) {
      try {
        if (html5QrcodeRef.current.isScanning) {
          await html5QrcodeRef.current.stop();
        }
        await html5QrcodeRef.current.clear();
      } catch (err) {
        console.warn('Error stopping camera scanner:', err);
      } finally {
        html5QrcodeRef.current = null;
        setIsScanning(false);
        setTorchOn(false);
      }
    }
  }, []);

  // Platform detection helper
  const getPlatformDetails = useCallback(() => {
    const ua = (navigator.userAgent || '').toLowerCase();
    const isCapacitor = !!(window as any).Capacitor || !!(window as any).android || window.location.protocol === 'capacitor:' || window.location.protocol === 'file:';
    const isElectron = ua.includes('electron') || !!(window as any).electron;
    const isSecureContext = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    let platform: 'Standard Web Browser' | 'Capacitor Android APK' | 'Electron App' = 'Standard Web Browser';
    if (isCapacitor) platform = 'Capacitor Android APK';
    else if (isElectron) platform = 'Electron App';

    return { platform, isCapacitor, isElectron, isSecureContext, ua };
  }, []);

  const [cameraDiagnostic, setCameraDiagnostic] = useState<{
    platform: string;
    isSecureContext: boolean;
    exceptionName: string;
    exceptionMessage: string;
    exceptionStack?: string;
    attemptedConfigs: string[];
    enumeratedCount: number;
  } | null>(null);

  // Helper to dynamically obtain Capacitor Camera plugin instance if available
  const getCapacitorCamera = useCallback(async () => {
    try {
      const capWin = (window as any).Capacitor;
      if (capWin && capWin.Plugins && capWin.Plugins.Camera) {
        return capWin.Plugins.Camera;
      }
      const pkg = '@capacitor/camera';
      const mod = await import(/* @vite-ignore */ pkg);
      return mod.Camera || mod.default?.Camera || null;
    } catch {
      const capWin = (window as any).Capacitor;
      if (capWin && capWin.Plugins && capWin.Plugins.Camera) {
        return capWin.Plugins.Camera;
      }
      return null;
    }
  }, []);

  const startScannerRef = useRef<((cameraId?: string) => Promise<void>) | null>(null);

  // Manual trigger to request camera permission via Capacitor / browser API
  const requestNativePermissionAndOpenSettings = useCallback(async () => {
    const platformInfo = getPlatformDetails();
    console.log('[BarcodeScanner] Manual request permission triggered...');
    try {
      if (platformInfo.isCapacitor) {
        const CapCam = await getCapacitorCamera();
        if (CapCam && CapCam.requestPermissions) {
          const res = await CapCam.requestPermissions({ permissions: ['camera'] });
          console.log('[BarcodeScanner] Manual Capacitor request permissions result:', res);
          if (res.camera === 'granted') {
            toast.success('Camera permission granted!');
            if (startScannerRef.current) startScannerRef.current(selectedCameraId);
            return;
          }
        }
      }

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(t => t.stop());
        toast.success('Camera permission granted!');
        if (startScannerRef.current) startScannerRef.current(selectedCameraId);
        return;
      }
    } catch (err: any) {
      console.error('[BarcodeScanner] Manual permission request exception:', err);
      toast.error('Camera permission is blocked in your browser or device settings. Please allow camera access in browser site settings.');
    }
  }, [getPlatformDetails, getCapacitorCamera, selectedCameraId]);

  // Request camera permission and initialize scanner directly with auto-retry & detailed diagnostics (strictly BACK camera)
  const startScanner = useCallback(async (cameraId?: string) => {
    setCameraError(null);
    setCameraDiagnostic(null);
    await stopScanner();

    const platformInfo = getPlatformDetails();
    console.log('[BarcodeScanner] Starting back camera scanner. Platform:', platformInfo.platform);

    // Step 0: Android APK / Capacitor Native Camera Permission Check
    try {
      if (platformInfo.isCapacitor) {
        console.log('[BarcodeScanner] Checking native Capacitor camera permissions...');
        const CapCam = await getCapacitorCamera();
        if (CapCam && CapCam.checkPermissions) {
          const checkStatus = await CapCam.checkPermissions();
          console.log('[BarcodeScanner] Native Capacitor camera permission status:', checkStatus);
          
          if (checkStatus.camera !== 'granted' && CapCam.requestPermissions) {
            console.log('[BarcodeScanner] Requesting native Capacitor camera permission...');
            const reqStatus = await CapCam.requestPermissions({ permissions: ['camera'] });
            console.log('[BarcodeScanner] Native Capacitor request permission result:', reqStatus);
            
            if (reqStatus.camera !== 'granted') {
              const permErrorMsg = 'Android native camera permission denied by system prompt.';
              console.error('[BarcodeScanner]', permErrorMsg);
              setCameraError('NotAllowedError: Android permission denied');
              setCameraDiagnostic({
                platform: platformInfo.platform,
                isSecureContext: platformInfo.isSecureContext,
                exceptionName: 'NotAllowedError',
                exceptionMessage: permErrorMsg,
                attemptedConfigs: ['Capacitor Native Camera Request'],
                enumeratedCount: 0
              });
              return;
            }
          }
        }
      }
    } catch (capErr: any) {
      console.warn('[BarcodeScanner] Capacitor Camera permission check note:', capErr);
    }

    // Check mediaDevices API support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errorMsg = 'navigator.mediaDevices.getUserMedia API is undefined. Camera requires HTTPS or secure context.';
      console.error('[BarcodeScanner] Unsupported environment:', errorMsg);
      setCameraError('MediaDevices API Unavailable');
      setCameraDiagnostic({
        platform: platformInfo.platform,
        isSecureContext: platformInfo.isSecureContext,
        exceptionName: 'TypeError / SecurityError',
        exceptionMessage: errorMsg,
        attemptedConfigs: ['navigator.mediaDevices API check'],
        enumeratedCount: 0
      });
      return;
    }

    // Step 1: Enumerate all available camera devices before starting
    let enumeratedList: Array<{ id: string; label: string }> = [];
    try {
      const rawDevices = await navigator.mediaDevices.enumerateDevices();
      console.log('[BarcodeScanner] Native enumerateDevices raw list:', rawDevices);
      const videoInputs = rawDevices.filter(d => d.kind === 'videoinput');
      enumeratedList = videoInputs.map((d, index) => ({
        id: d.deviceId,
        label: d.label || `Camera ${index + 1} (${d.deviceId ? d.deviceId.slice(0, 8) : 'default'})`
      }));
    } catch (nativeEnumErr: any) {
      console.warn('[BarcodeScanner] Native enumerateDevices exception:', nativeEnumErr);
    }

    if (enumeratedList.length === 0) {
      try {
        const html5Cameras = await Html5Qrcode.getCameras();
        if (html5Cameras && html5Cameras.length > 0) {
          html5Cameras.forEach((d, i) => {
            if (!enumeratedList.some(existing => existing.id === d.id)) {
              enumeratedList.push({ id: d.id, label: d.label || `Camera ${i + 1}` });
            }
          });
        }
      } catch (html5EnumErr: any) {
        console.warn('[BarcodeScanner] Html5Qrcode.getCameras() exception:', html5EnumErr);
      }
    }

    setCameras(enumeratedList);
    console.log('[BarcodeScanner] Final enumerated cameras:', enumeratedList);

    // Strictly find the back / rear camera
    let targetCameraId = cameraId;
    if (!targetCameraId && enumeratedList.length > 0) {
      const backCam = enumeratedList.find(d => 
        d.label.toLowerCase().includes('back') || 
        d.label.toLowerCase().includes('rear') ||
        d.label.toLowerCase().includes('environment') ||
        d.label.toLowerCase().includes('0') ||
        d.label.toLowerCase().includes('main')
      );
      targetCameraId = backCam ? backCam.id : enumeratedList[0].id;
    }
    if (targetCameraId) {
      setSelectedCameraId(targetCameraId);
    }

    // Step 2: Wait for DOM container element
    let containerEl = document.getElementById(scannerContainerId);
    if (!containerEl) {
      await new Promise(resolve => setTimeout(resolve, 150));
      containerEl = document.getElementById(scannerContainerId);
    }
    if (!containerEl) {
      const errorMsg = `DOM element #${scannerContainerId} was not found in page.`;
      console.error('[BarcodeScanner]', errorMsg);
      setCameraError('Scanner DOM View Missing');
      setCameraDiagnostic({
        platform: platformInfo.platform,
        isSecureContext: platformInfo.isSecureContext,
        exceptionName: 'ReferenceError',
        exceptionMessage: errorMsg,
        attemptedConfigs: ['DOM Element Lookup'],
        enumeratedCount: enumeratedList.length
      });
      return;
    }

    // Step 4: Build standard, ultra-reliable configurations list
    const configsToTry: Array<any> = [];
    const attemptedConfigNames: string[] = [];

    // 1. Target Camera Device ID if selected (String format is cleanest for html5-qrcode)
    if (targetCameraId && targetCameraId.trim() !== '') {
      configsToTry.push(targetCameraId);
      attemptedConfigNames.push(`Camera ID [${targetCameraId}]`);
    }

    // 2. Standard Rear Camera Facing Mode
    configsToTry.push({ facingMode: 'environment' });
    attemptedConfigNames.push('facingMode: environment');

    // 3. Ideal Environment Facing Mode
    configsToTry.push({ facingMode: { ideal: 'environment' } });
    attemptedConfigNames.push('facingMode: ideal environment');

    // 4. Other back cameras from enumerated list
    enumeratedList.forEach((cam) => {
      const isFront = cam.label.toLowerCase().includes('front') || cam.label.toLowerCase().includes('user') || cam.label.toLowerCase().includes('selfie');
      if (!isFront && cam.id && cam.id !== targetCameraId) {
        configsToTry.push(cam.id);
        attemptedConfigNames.push(`Back Camera ID [${cam.label}]: ${cam.id}`);
      }
    });

    // 5. Generic Fallback
    configsToTry.push({ video: true });
    attemptedConfigNames.push('Generic fallback (video: true)');

    // Step 5: Initialize Html5Qrcode instance with ultra-fast instant scan settings
    try {
      const html5Qrcode = new Html5Qrcode(scannerContainerId, {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.CODABAR
        ]
      });
      html5QrcodeRef.current = html5Qrcode;

      const scannerConfig = {
        fps: 30, // 30 FPS high frame rate for instant recognition
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          // Full frame scanning area so barcodes anywhere in camera field scan instantly
          return {
            width: Math.max(100, Math.floor(viewfinderWidth * 0.98)),
            height: Math.max(100, Math.floor(viewfinderHeight * 0.95))
          };
        },
        aspectRatio: 1.333333,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true // Uses fast native OS/browser BarcodeDetector API if available
        }
      };

      const scanSuccessCallback = (decodedText: string) => {
        handleBarcodeScanned(decodedText);
      };

      const scanErrorCallback = () => {};

      let started = false;
      let lastAttemptException: any = null;

      for (let i = 0; i < configsToTry.length; i++) {
        const cameraConfig = configsToTry[i];
        const configName = attemptedConfigNames[i];
        console.log(`[BarcodeScanner] [Attempt ${i + 1}/${configsToTry.length}] Starting camera with: ${configName}`);

        try {
          await html5Qrcode.start(
            cameraConfig,
            scannerConfig,
            scanSuccessCallback,
            scanErrorCallback
          );
          started = true;
          console.log(`[BarcodeScanner] SUCCESS! Camera started smoothly with ${configName}`);

          // Apply HD resolution and continuous hardware auto-focus on active video track
          try {
            const track = (html5Qrcode as any).getRunningTrack ? (html5Qrcode as any).getRunningTrack() : null;
            if (track && typeof track.applyConstraints === 'function') {
              const caps: any = track.getCapabilities ? track.getCapabilities() : {};
              const adv: any[] = [];
              if (caps.focusMode && Array.isArray(caps.focusMode)) {
                if (caps.focusMode.includes('continuous')) adv.push({ focusMode: 'continuous' });
                else if (caps.focusMode.includes('macro')) adv.push({ focusMode: 'macro' });
              }
              const extraConstraints: any = {
                width: { ideal: 1920 },
                height: { ideal: 1080 }
              };
              if (adv.length > 0) extraConstraints.advanced = adv;

              track.applyConstraints(extraConstraints)
                .then(() => console.log('[BarcodeScanner] Applied continuous hardware auto-focus constraint'))
                .catch(e => console.warn('[BarcodeScanner] Continuous focus constraint note:', e));
            }
          } catch (trackErr) {
            console.warn('[BarcodeScanner] Focus capability check:', trackErr);
          }

          break;
        } catch (err: any) {
          console.warn(`[BarcodeScanner] html5Qrcode.start() attempt ${i + 1} note:`, err?.message || err);
          lastAttemptException = err;
          // If permission was denied by user, break loop early to show permission request UI
          if (err?.name === 'NotAllowedError' || (err?.message && err.message.toLowerCase().includes('permission denied'))) {
            break;
          }
        }
      }

      if (!started) {
        throw lastAttemptException || new Error('All camera configurations and enumerated cameras failed to start.');
      }

      setIsScanning(true);
      retryCountRef.current = 0;

      // Ensure video element plays inline
      setTimeout(() => {
        const videoEl = document.querySelector(`#${scannerContainerId} video`) as HTMLVideoElement | null;
        if (videoEl) {
          videoEl.setAttribute('playsinline', 'true');
          videoEl.setAttribute('webkit-playsinline', 'true');
          videoEl.setAttribute('muted', 'true');
          videoEl.play().catch(() => {});
        }
      }, 50);

      // Check torch capability
      try {
        const capabilities = html5Qrcode.getRunningTrackCapabilities();
        setHasTorch((capabilities as any).torch !== undefined);
      } catch {
        setHasTorch(false);
      }

    } catch (err: any) {
      console.error('[BarcodeScanner] CRITICAL ERROR LOGGING FULL EXCEPTION:');
      console.error('[BarcodeScanner] Platform:', platformInfo.platform);
      console.error('[BarcodeScanner] Secure Context:', platformInfo.isSecureContext);
      console.error('[BarcodeScanner] Full Error Object:', err);
      console.error('[BarcodeScanner] Error Name:', err?.name);
      console.error('[BarcodeScanner] Error Message:', err?.message);
      console.error('[BarcodeScanner] Error Stack:', err?.stack);

      setIsScanning(false);
      const excName = err?.name || (err instanceof DOMException ? 'DOMException' : 'CameraError');
      const excMsg = err?.message || String(err || 'Unknown exception during camera initialization.');

      setCameraError(`${excName}: ${excMsg}`);
      setCameraDiagnostic({
        platform: platformInfo.platform,
        isSecureContext: platformInfo.isSecureContext,
        exceptionName: excName,
        exceptionMessage: excMsg,
        exceptionStack: err?.stack,
        attemptedConfigs: attemptedConfigNames,
        enumeratedCount: enumeratedList.length
      });
    }
  }, [stopScanner, handleBarcodeScanned, getPlatformDetails]);

  startScannerRef.current = startScanner;

  // Direct auto-start camera when modal opens
  useEffect(() => {
    let isMounted = true;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    if (isOpen) {
      retryCountRef.current = 0;
      timerId = setTimeout(() => {
        if (isMounted) {
          startScanner(selectedCameraId);
        }
      }, 100);
    } else {
      stopScanner();
    }

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
      stopScanner();
    };
  }, [isOpen, startScanner, stopScanner]);

  // Switch torch
  const toggleTorch = async () => {
    if (!html5QrcodeRef.current || !hasTorch) return;
    try {
      const nextState = !torchOn;
      await html5QrcodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState }] as any
      });
      setTorchOn(nextState);
    } catch (err) {
      console.warn('Torch toggle failed:', err);
      toast.error('Torch not supported on this device camera');
    }
  };

  // Manual trigger hardware refocus on video track
  const triggerRefocus = (e?: React.MouseEvent) => {
    if (e) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setFocusRingPos({ x, y });
      setTimeout(() => setFocusRingPos(null), 900);
    } else {
      setIsRefocusing(true);
      setTimeout(() => setIsRefocusing(false), 800);
    }

    try {
      let track: MediaStreamTrack | null = null;
      if (html5QrcodeRef.current && typeof (html5QrcodeRef.current as any).getRunningTrack === 'function') {
        track = (html5QrcodeRef.current as any).getRunningTrack();
      }
      if (!track) {
        const videoEl = document.querySelector(`#${scannerContainerId} video`) as HTMLVideoElement | null;
        if (videoEl && videoEl.srcObject) {
          const stream = videoEl.srcObject as MediaStream;
          const tracks = stream.getVideoTracks();
          if (tracks.length > 0) track = tracks[0];
        }
      }

      if (track && typeof track.applyConstraints === 'function') {
        const caps: any = track.getCapabilities ? track.getCapabilities() : {};
        const advanced: any[] = [];
        if (caps.focusMode && Array.isArray(caps.focusMode)) {
          if (caps.focusMode.includes('continuous')) advanced.push({ focusMode: 'continuous' });
          else if (caps.focusMode.includes('macro')) advanced.push({ focusMode: 'macro' });
        }
        if (advanced.length > 0) {
          track.applyConstraints({ advanced } as any)
            .then(() => toast.success('Auto-focus refocused!', { duration: 1200 }))
            .catch(() => {});
        } else {
          track.applyConstraints({
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          } as any).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[BarcodeScanner] Refocus note:', err);
    }
  };

  // Switch camera
  const handleSwitchCamera = (camId: string) => {
    setSelectedCameraId(camId);
    startScanner(camId);
  };

  const cartTotalAmount = cart.reduce((acc, item) => acc + (item.sellingPrice * item.quantity), 0);
  const cartTotalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        showCloseButton={false} 
        className="w-[95vw] sm:w-[90vw] md:max-w-5xl lg:max-w-6xl max-h-[92vh] sm:max-h-[90vh] p-0 overflow-hidden bg-white text-slate-900 border-slate-200 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col"
      >
        {/* Header Bar */}
        <DialogHeader className="p-3 px-4 sm:p-4 sm:px-6 bg-slate-50 border-b border-slate-200 flex flex-row items-center justify-between space-y-0 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
              <Camera className="h-4 w-4 sm:h-5 sm:w-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2 truncate">
                <span>Live Barcode Scanner</span>
                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] sm:text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Continuous Mode
                </span>
              </DialogTitle>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">
                Point camera at barcodes to instantly add items into cart
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Sound Toggle */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg sm:rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 text-xs font-semibold shadow-xs"
              title={soundEnabled ? "Mute Beep Sound" : "Enable Beep Sound"}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600" />
                  <span className="hidden sm:inline">Sound On</span>
                </>
              ) : (
                <>
                  <VolumeX className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400" />
                  <span className="hidden sm:inline text-slate-400">Muted</span>
                </>
              )}
            </Button>

            {/* Auto Focus Button */}
            {isScanning && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => triggerRefocus()}
                className={`h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg sm:rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs ${
                  isRefocusing
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-400'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                }`}
                title="Trigger Hardware Auto Focus"
              >
                <Focus className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isRefocusing ? 'animate-spin text-emerald-600' : 'text-indigo-600'}`} />
                <span className="hidden sm:inline">Auto Focus</span>
              </Button>
            )}

            {/* Torch Toggle */}
            {hasTorch && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleTorch}
                className={`h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg sm:rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs ${
                  torchOn 
                    ? 'bg-amber-50 text-amber-800 border-amber-300' 
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                }`}
                title="Toggle Torch / Flashlight"
              >
                {torchOn ? <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-amber-500 text-amber-500" /> : <ZapOff className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400" />}
                <span className="hidden sm:inline">{torchOn ? 'Torch On' : 'Torch Off'}</span>
              </Button>
            )}

            {/* Camera Switcher */}
            {cameras.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  const currentIndex = cameras.findIndex(c => c.id === selectedCameraId);
                  const nextIndex = (currentIndex + 1) % cameras.length;
                  handleSwitchCamera(cameras[nextIndex].id);
                }}
                className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-100 shadow-xs"
                title="Switch Camera"
              >
                <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            )}

            {/* Clean Close Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>
        </DialogHeader>

        {/* Modal Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-y-auto md:overflow-hidden min-h-0">
          
          {/* Left Column: Camera Viewport & Controls */}
          <div className="md:col-span-7 p-3 sm:p-4 md:p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-200 bg-white gap-3 sm:gap-4">
            
            {/* Viewport Box */}
            <div 
              onClick={(e) => triggerRefocus(e)}
              className="relative w-full aspect-video sm:aspect-[4/3] max-h-[220px] sm:max-h-none bg-slate-950 rounded-xl sm:rounded-2xl overflow-hidden border-2 border-slate-200 shadow-inner flex items-center justify-center shrink-0 cursor-pointer group"
              title="Tap anywhere to auto-focus camera"
            >
              {/* HTML5 QR Code Mount Element */}
              <div id={scannerContainerId} className="w-full h-full object-cover" />

              {/* Tap Focus Ring Indicator */}
              {focusRingPos && (
                <div 
                  className="pointer-events-none absolute z-30 w-12 h-12 -ml-6 -mt-6 border-2 border-emerald-400 rounded-full animate-ping shadow-[0_0_16px_#34d399]"
                  style={{ left: `${focusRingPos.x}px`, top: `${focusRingPos.y}px` }}
                />
              )}

              {/* Hide default html5-qrcode shaded regions & red/white borders */}
              <style>{`
                #${scannerContainerId} #qr-shaded-region {
                  display: none !important;
                }
                #${scannerContainerId} video {
                  width: 100% !important;
                  height: 100% !important;
                  object-fit: cover !important;
                  border-radius: 0.75rem;
                }
              `}</style>

              {/* Camera Loading Indicator */}
              {!isScanning && !cameraError && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xs z-10 gap-2.5 text-slate-200">
                  <div className="h-10 w-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin flex items-center justify-center">
                    <Camera className="h-5 w-5 text-indigo-400" />
                  </div>
                  <span className="text-xs font-bold tracking-wide animate-pulse text-indigo-200">Starting camera...</span>
                </div>
              )}

              {/* Modern Center Scanner Laser & Reticle Overlay */}
              {isScanning && (
                <div 
                  onClick={() => {
                    // Tap on viewfinder to refocus
                    triggerRefocus();
                  }}
                  className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center z-10 p-4 cursor-pointer"
                  title="Tap camera view to refocus"
                >
                  <div className="w-[88%] h-[78%] relative border border-emerald-500/25 rounded-2xl flex items-center justify-center bg-emerald-950/5 backdrop-blur-[1px]">
                    {/* Corner Reticle Brackets */}
                    <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-emerald-400 rounded-tl-xl" />
                    <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-emerald-400 rounded-tr-xl" />
                    <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-emerald-400 rounded-bl-xl" />
                    <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-emerald-400 rounded-br-xl" />
                    
                    {/* Central Laser Scan Beam */}
                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_16px_#34d399] animate-pulse" />
                  </div>

                  {/* Clean Status Badge */}
                  <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-200 bg-slate-950/90 px-3.5 py-1 rounded-full border border-emerald-500/30 mt-3 shadow-2xl flex items-center gap-2 backdrop-blur-md">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Point camera at barcode or QR code • Tap to refocus
                  </span>
                </div>
              )}

              {/* Detailed Exception & Diagnostic overlay when camera fails or is blocked */}
              {cameraError && (
                <div className="absolute inset-0 z-20 p-3 sm:p-4 flex flex-col items-center justify-center text-center bg-slate-950/90 backdrop-blur-md overflow-y-auto">
                  <div className="max-w-md w-full bg-slate-900 border border-slate-700/80 rounded-2xl p-4 shadow-2xl flex flex-col items-center gap-2.5 text-left">
                    <div className="flex items-center gap-2 w-full pb-2 border-b border-slate-800">
                      <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 animate-pulse" />
                      <span className="text-xs font-black text-rose-300 uppercase tracking-wider">Camera Diagnostics & Error</span>
                    </div>

                    {/* Platform & Environment Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 w-full text-[10px] font-mono">
                      <span className="bg-indigo-950 text-indigo-300 border border-indigo-700/60 px-2 py-0.5 rounded-md font-bold">
                        Platform: {cameraDiagnostic?.platform || 'Detecting...'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md font-bold border ${
                        cameraDiagnostic?.isSecureContext
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border-amber-800'
                      }`}>
                        {cameraDiagnostic?.isSecureContext ? 'Secure (HTTPS)' : 'Insecure (HTTP)'}
                      </span>
                      <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-md font-bold">
                        Cameras Found: {cameras.length}
                      </span>
                    </div>

                    {/* Exact Root Cause Exception */}
                    <div className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] leading-relaxed">
                      <p className="text-rose-400 font-bold mb-1">
                        Exception: <span className="text-slate-200">{cameraDiagnostic?.exceptionName || 'Error'}</span>
                      </p>
                      <p className="text-slate-300 break-words font-sans text-xs">
                        {cameraDiagnostic?.exceptionMessage || cameraError}
                      </p>
                    </div>

                    {/* Camera Selector Dropdown if cameras are available */}
                    {cameras.length > 0 && (
                      <div className="w-full">
                        <label className="text-[10px] font-bold text-slate-400 block mb-1">Select Camera Hardware:</label>
                        <select
                          value={selectedCameraId}
                          onChange={(e) => {
                            setSelectedCameraId(e.target.value);
                            startScanner(e.target.value);
                          }}
                          className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl p-2 font-medium focus:outline-none focus:border-indigo-500"
                        >
                          {cameras.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <p className="text-[10px] text-slate-400 leading-normal font-sans">
                      💡 Full error stack trace has been logged to <code className="text-indigo-300 font-mono">console.error</code>.
                    </p>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-center gap-2 w-full mt-1">
                      <Button
                        type="button"
                        size="sm"
                        onClick={requestNativePermissionAndOpenSettings}
                        className="w-full sm:flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl h-9 shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        Request Android Camera Permission
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => startScanner(selectedCameraId)}
                        className="w-full sm:flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl h-9 shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Retry Camera
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Last Scanned Status Box (Shown only on scan result) */}
            {lastScannedResult && (
              <div className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all flex items-center justify-between gap-2.5 ${
                lastScannedResult.success 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-xs' 
                  : 'bg-rose-50 border-rose-200 text-rose-900 shadow-xs'
              }`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  {lastScannedResult.success ? (
                    <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                    </div>
                  ) : (
                    <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl bg-rose-100 border border-rose-300 flex items-center justify-center shrink-0">
                      <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-rose-600" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-black truncate text-slate-900">{lastScannedResult.productName}</p>
                    <p className="text-[10px] sm:text-[11px] font-mono text-slate-600 font-medium truncate">{lastScannedResult.message}</p>
                  </div>
                </div>
                <span className="text-[9px] sm:text-[10px] font-mono text-slate-500 shrink-0 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-2xs">
                  {lastScannedResult.time}
                </span>
              </div>
            )}
          </div>

          {/* Right Column: Live Cart & Instant Action */}
          <div className="md:col-span-5 p-3 sm:p-4 md:p-6 bg-slate-50/70 flex flex-col justify-between border-t md:border-t-0 border-slate-200 gap-3 sm:gap-4">
            <div className="flex flex-col min-h-0 flex-1">
              <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-200 mb-2.5 sm:mb-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-indigo-600" />
                  <h3 className="text-xs sm:text-sm font-black text-slate-900">Current Cart</h3>
                </div>
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] sm:text-xs font-mono font-bold px-2 sm:px-2.5 py-0.5">
                  {cartTotalItems} items
                </Badge>
              </div>

              {/* Cart Items List */}
              <div className="space-y-2 overflow-y-auto pr-1 flex-1 max-h-[160px] sm:max-h-[240px] md:max-h-[320px]">
                {cart.length === 0 ? (
                  <div className="py-8 sm:py-14 text-center text-slate-400">
                    <Package className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-1.5 sm:mb-2 opacity-30 text-indigo-600" />
                    <p className="text-xs font-bold text-slate-600">Cart is empty</p>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Scanned barcodes will be automatically added here</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.id} className="p-2.5 sm:p-3 bg-white border border-slate-200 rounded-lg sm:rounded-xl shadow-2xs flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                        <p className="text-[10px] sm:text-[11px] font-mono text-indigo-600 font-bold mt-0.5">
                          ₹{item.sellingPrice.toFixed(2)} × {item.quantity} = ₹{(item.sellingPrice * item.quantity).toFixed(2)}
                        </p>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 bg-slate-100 p-0.5 sm:p-1 rounded-lg border border-slate-200">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => onUpdateQuantity(item.id, -1)}
                          className="h-5 w-5 sm:h-6 sm:w-6 rounded-md text-slate-600 hover:text-slate-900 hover:bg-white"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-xs font-mono font-bold text-slate-900 px-1 min-w-[18px] sm:min-w-[20px] text-center">
                          {item.quantity}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => onUpdateQuantity(item.id, 1)}
                          className="h-5 w-5 sm:h-6 sm:w-6 rounded-md text-slate-600 hover:text-slate-900 hover:bg-white"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => onRemoveFromCart(item.id)}
                          className="h-5 w-5 sm:h-6 sm:w-6 rounded-md text-rose-500 hover:text-rose-700 hover:bg-rose-50 ml-0.5"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bottom Total & Done Button */}
            <div className="pt-3 sm:pt-4 border-t border-slate-200 space-y-2.5 sm:space-y-3 shrink-0">
              <div className="flex items-center justify-between text-slate-900">
                <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Grand Total</span>
                <span className="text-lg sm:text-xl font-black text-emerald-600 font-mono">
                  ₹{cartTotalAmount.toFixed(2)}
                </span>
              </div>

              <Button
                type="button"
                onClick={onClose}
                className="w-full h-10 sm:h-12 text-xs font-black uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-white rounded-lg sm:rounded-xl shadow-md flex items-center justify-center gap-2"
              >
                <Check className="h-4 w-4 stroke-[3]" />
                Done Scanning ({cartTotalItems} items)
              </Button>
            </div>

          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
};
