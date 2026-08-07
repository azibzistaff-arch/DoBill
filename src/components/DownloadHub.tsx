import React, { useState, useEffect } from 'react';
import { 
  Laptop, 
  Smartphone, 
  Sparkles, 
  Download, 
  ShieldCheck, 
  CheckCircle2, 
  HardDrive
} from 'lucide-react';
import { toast } from 'sonner';

export interface DeviceDetection {
  os: 'windows' | 'android' | 'mac' | 'linux' | 'ios' | 'other';
  isWindows: boolean;
  isAndroid: boolean;
}

export interface DownloadOption {
  id: string;
  title: string;
  description: string;
  fileType: string;
  extension: '.exe' | '.apk';
  icon: React.ElementType;
  url: string;
  fallbackUrl: string;
  filename: string;
  badge?: string;
}

export const detectUserDevice = (): DeviceDetection => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const platform = typeof navigator !== 'undefined' ? navigator.platform : '';
  
  let os: DeviceDetection['os'] = 'other';
  if (/android/i.test(ua)) {
    os = 'android';
  } else if (/win/i.test(platform) || /windows/i.test(ua)) {
    os = 'windows';
  } else if (/mac/i.test(platform) || /macintosh/i.test(ua)) {
    os = 'mac';
  } else if (/linux/i.test(platform) || /linux/i.test(ua)) {
    os = 'linux';
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = 'ios';
  }

  return {
    os,
    isWindows: os === 'windows',
    isAndroid: os === 'android'
  };
};

export const DownloadHub: React.FC<{
  onClose?: () => void;
  className?: string;
}> = ({ className = '' }) => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceDetection | null>(null);

  useEffect(() => {
    setDeviceInfo(detectUserDevice());
  }, []);

  const downloadOptions: DownloadOption[] = [
    {
      id: 'win-installer-exe',
      title: 'Download for Windows',
      description: 'Official Windows Installer (DoBillPOS Setup 1.0.0.exe)',
      fileType: 'Windows Installer (.exe)',
      extension: '.exe',
      icon: Laptop,
      url: '/dist_desktop/DoBillPOS Setup 1.0.0.exe',
      fallbackUrl: '/api/download/windows',
      filename: 'DoBillPOS Setup 1.0.0.exe',
      badge: 'Main Windows Installer'
    },
    {
      id: 'android-apk',
      title: 'Download for Android',
      description: 'Official Android Release APK (app-release.apk)',
      fileType: 'Android Release APK (.apk)',
      extension: '.apk',
      icon: Smartphone,
      url: '/android/app/build/outputs/apk/release/app-release.apk',
      fallbackUrl: '/api/download/android',
      filename: 'app-release.apk',
      badge: 'Official Release APK'
    }
  ];

  const handleDownloadClick = (option: DownloadOption) => {
    toast.success(`📥 Started downloading ${option.filename}`);
  };

  return (
    <div className={`w-full font-sans ${className}`}>
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 mb-8 border border-slate-800 shadow-xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
                DoBillPOS Download Hub
              </span>
              {deviceInfo && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  {deviceInfo.isWindows ? 'Detected: Windows' : deviceInfo.isAndroid ? 'Detected: Android Device' : `Detected: ${deviceInfo.os.toUpperCase()}`}
                </span>
              )}
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Get DoBillPOS Application
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              Official application builds for Windows Desktop and Android Mobile devices.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 shrink-0">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status</div>
              <div className="text-xs font-black text-white">Official Builds</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Download Options Grid - Simple 2 Buttons */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-base font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-indigo-600" />
            Download Options
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {downloadOptions.map((opt) => {
            const Icon = opt.icon;
            const isDetected = (opt.id === 'win-installer-exe' && deviceInfo?.isWindows) || (opt.id === 'android-apk' && deviceInfo?.isAndroid);

            return (
              <div
                key={opt.id}
                className={`relative bg-white rounded-3xl p-6 sm:p-8 border transition-all duration-300 flex flex-col justify-between group hover:shadow-2xl hover:-translate-y-1 ${
                  isDetected 
                    ? 'border-indigo-500 shadow-lg ring-2 ring-indigo-500/20 bg-gradient-to-b from-indigo-50/40 via-white to-white' 
                    : 'border-slate-200 shadow-md hover:border-indigo-300'
                }`}
              >
                {opt.badge && (
                  <div className="absolute top-4 right-4">
                    <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
                      {opt.badge}
                    </span>
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-14 w-14 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Icon className="h-7 w-7" />
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                        {opt.fileType}
                      </span>
                      <h4 className="text-xl font-black text-slate-900 tracking-tight mt-0.5 group-hover:text-indigo-600 transition-colors">
                        {opt.title}
                      </h4>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6">
                    {opt.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
                  <a
                    href={opt.url}
                    download={opt.filename}
                    onClick={() => handleDownloadClick(opt)}
                    className="w-full h-13 rounded-2xl font-black text-sm tracking-wide flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 active:scale-[0.98] transition-all cursor-pointer no-underline"
                  >
                    <Download className="h-5 w-5" />
                    {opt.title} ({opt.extension})
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
