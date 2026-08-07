/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
// @ts-ignore
import logoSvg from '@/assets/logo.svg';
import { DataService } from '@/services/dataService';
import { getCurrentUserRole, defineAbilityFor } from '@/services/abilityService';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  History, 
  BarChart3, 
  Settings, 
  LogOut,
  Bell,
  QrCode,
  Menu,
  X,
  Lock,
  Key,
  ArrowLeft,
  ArrowRight,
  Shield,
  Users,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  Laptop,
  Sparkles,
  AlertCircle,
  WifiOff,
  RefreshCw,
  Printer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Toaster } from '@/components/ui/sonner';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import POS from '@/components/POS';
import Inventory from '@/components/Inventory';
import Dashboard from '@/components/Dashboard';
import Reports from '@/components/Reports';
import SalesHistory from '@/components/SalesHistory';
import UPISettings from '@/components/UPISettings';
import ShopSettings from '@/components/ShopSettings';
import { DownloadHub } from '@/components/DownloadHub';
import { DirectPrintService } from '@/services/directPrintService';

import { RegistrationWizard } from '@/components/RegistrationWizard';
import { SparklesCelebration } from '@/components/SparklesCelebration';
import { getTranslation, LanguageType } from '@/utils/lang';
import { Building } from 'lucide-react';
import { safeLocalStorage, safeSessionStorage } from '@/utils/safeStorage';

const localStorage = safeLocalStorage;
const sessionStorage = safeSessionStorage;

const SidebarItem = ({ icon: Icon, label, path, active, onClick }: { icon: any, label: string, path: string, active: boolean, onClick?: () => void }) => (
  <Link to={path} onClick={onClick} className="block w-full">
    <Button
      variant={active ? "secondary" : "ghost"}
      className={`w-full justify-start gap-3 px-4 py-6 text-base font-medium transition-all ${
        active ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'hover:bg-accent'
      }`}
    >
      <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
      <span className="truncate">{label}</span>
    </Button>
  </Link>
);

const Logo = ({ className, customLogo }: { className?: string; customLogo?: string }) => (
  <div className={`relative flex items-center justify-center ${className} ${customLogo ? 'overflow-hidden' : 'p-1'}`}>
    {customLogo ? (
      <img src={customLogo} alt="Logo" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
    ) : (
      <img src={logoSvg} alt="Logo" className="h-full w-full object-contain" referrerPolicy="no-referrer" />
    )}
  </div>
);

const AppContent = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const isAuth = localStorage.getItem('retailpro_auth') === 'true' || sessionStorage.getItem('retailpro_auth') === 'true';
    const rawEmail = (localStorage.getItem('retailpro_auth_email') || sessionStorage.getItem('retailpro_auth_email') || '').trim().toLowerCase();
    
    // Strictly require a valid user email. Block dummy accounts ('casher', 'default')
    if (!rawEmail || rawEmail === 'default' || rawEmail === 'casher' || rawEmail === 'cashier') {
      try {
        sessionStorage.removeItem('retailpro_auth');
        sessionStorage.removeItem('retailpro_auth_email');
        localStorage.removeItem('retailpro_auth');
        localStorage.removeItem('retailpro_auth_email');
      } catch (e) {}
      return false;
    }
    
    return Boolean(isAuth && rawEmail);
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [forgotPasswordResendTimer, setForgotPasswordResendTimer] = useState(0);
  const [showDashboardCelebration, setShowDashboardCelebration] = useState(false);
  
  const location = useLocation();
  const [dataTrigger, setDataTrigger] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstallable, setIsAppInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsAppInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsAppInstallable(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setIsAppInstallable(false);
          toast.success("🎉 Installation accepted! DO BILL is starting native setup on your device.");
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.error("Installation prompt error:", err);
      }
    } else {
      toast.success("✨ Do Bill is ready to install! Simply click the install button in your browser's address bar (near the star icon) to install it natively!");
    }
  };
  
  const [lang, setLang] = useState<LanguageType>(() => {
    return (localStorage.getItem('retailpro_lang') as LanguageType) || 'en';
  });

  const handleLanguageChange = (newLang: LanguageType) => {
    localStorage.setItem('retailpro_lang', newLang);
    setLang(newLang);
    DataService.notifyListeners();
  };

  const t = useMemo(() => getTranslation(lang), [lang]);
  
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    DirectPrintService.autoConnect();
  }, []);

  // Periodically check session expiration and verify user existence
  useEffect(() => {
    const checkSessionExpiry = async () => {
      const auth = localStorage.getItem('retailpro_auth') === 'true';
      const authEmail = (localStorage.getItem('retailpro_auth_email') || sessionStorage.getItem('retailpro_auth_email') || '').trim().toLowerCase();
      const lastLoginTimeStr = localStorage.getItem('retailpro_last_login_time');
      
      if (!authEmail || authEmail === 'default' || authEmail === 'casher' || authEmail === 'cashier') {
        if (isAuthenticated) handleFullLogout();
        return;
      }

      if (auth && lastLoginTimeStr) {
        const lastLoginTime = parseInt(lastLoginTimeStr, 10);
        const difference = Date.now() - lastLoginTime;
        const hours24 = 24 * 60 * 60 * 1000;
        
        if (difference >= hours24) {
          toast.error("Your session has automatically expired (24 hours since last login). Please log in again.", { duration: 10000 });
          handleFullLogout();
          return;
        }
      }

      // Verify user account exists on backend
      try {
        const verifyRes = await DataService.verifySession(authEmail);
        if (!verifyRes.valid && isAuthenticated) {
          console.warn("[Auth Guard] Invalid session or non-existent account detected.");
          toast.error("Account session invalid. Please log in or register your store.");
          handleFullLogout();
        }
      } catch (e) {}
    };

    if (isAuthenticated) {
      checkSessionExpiry();
    }
    const interval = setInterval(checkSessionExpiry, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Forgot Password Resend Cooldown Countdown
  useEffect(() => {
    let interval: any;
    if (forgotPasswordResendTimer > 0) {
      interval = setInterval(() => {
        setForgotPasswordResendTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [forgotPasswordResendTimer]);

  const [isInstalled, setIsInstalled] = useState<boolean | null>(null);
  const [isServerUnreachable, setIsServerUnreachable] = useState(false);
  const [isSystemSetupCompleted, setIsSystemSetupCompleted] = useState<boolean>(true);
  
  // Onboarding parameters
  const [onboardingEmail, setOnboardingEmail] = useState('');
  const [onboardingAppPassword, setOnboardingAppPassword] = useState('');
  const [onboardingStoreName, setOnboardingStoreName] = useState('Store Name');
  const [onboardingStoreAddress, setOnboardingStoreAddress] = useState('Store Address');
  const [onboardingStorePhone, setOnboardingStorePhone] = useState('');
  const [onboardingPin, setOnboardingPin] = useState('12345');
  const [onboardingResetKey, setOnboardingResetKey] = useState('');
  const [setupRunning, setSetupRunning] = useState(false);

  const checkSetupStatus = useCallback(async () => {
    try {
      const ok = await DataService.isSystemSetup();
      setIsSystemSetupCompleted(ok);
      setIsInstalled(true); // Always force isInstalled = true to go straight to Login/Create Account
      setIsServerUnreachable(false);
      if (!ok) {
        // If system check reports not set up, do not aggressively purge the active session to prevent unwanted logouts.
        // Instead, just log it. Explicit reset actions or logging out should handle purging.
        console.warn("[App] System reports as not installed, but keeping current session active to prevent transient logout.");
      } else {
        // Pre-load shop details for displaying store name and custom logo on the login screen
        try {
          const s = await DataService.getShopDetails();
          if (s) {
            setShopDetails(s);
          }
        } catch (err) {}
      }
    } catch (e) {
      console.warn("[App] Could not check system setup status, falling back to local sandbox:", e);
      setIsSystemSetupCompleted(true);
      setIsInstalled(true);
      setIsServerUnreachable(false);
    }
  }, []);

  // State Self-Healing Engine (Auto-Restores database state from local browser backup if server restarted/reset)
  useEffect(() => {
    let active = true;
    const healDatabase = async () => {
      try {
        const count = await DataService.getUsersCount();
        if (!active) return;
        if (count === 0) {
          // Server database has been reset! Check if we have a browser backup
          const backupStr = localStorage.getItem('dobill_local_backup_v1');
          if (backupStr) {
            try {
              const backup = JSON.parse(backupStr);
              if (backup && backup.app_users && backup.app_users.length > 0) {
                const tid = toast.loading("🔄 Database self-healing active! Restoring your local workspace securely...", { duration: 5000 });
                const res = await DataService.restoreDatabase(backup);
                toast.dismiss(tid);
                if (res.success) {
                  toast.success("✅ Workspace restored successfully! All accounts and data preserved.");
                  checkSetupStatus();
                  if (isAuthenticated) {
                    refreshProfileAndStock();
                  }
                }
              }
            } catch (jsonErr) {}
          }
        } else {
          // Server has accounts. Let's do a background backup to make sure our local backup is fresh!
          const backup = await DataService.backupDatabase();
          if (backup && backup.app_users && backup.app_users.length > 0) {
            localStorage.setItem('dobill_local_backup_v1', JSON.stringify(backup));
          }
        }
      } catch (err) {
        console.error("[Self-Healing] Error checking users count or restoring:", err);
      }
    };
    
    const timer = setTimeout(healDatabase, 100);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isAuthenticated, checkSetupStatus]);

  useEffect(() => {
    checkSetupStatus();
  }, [checkSetupStatus]);

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardingFormError(null);
    setOnboardingFormSuccess(null);
    if (!onboardingEmail || !onboardingEmail.includes('@')) {
      setOnboardingFormError("Please enter a valid Gmail address.");
      toast.error("Please enter a valid Gmail address.");
      return;
    }
    
    setSetupRunning(true);
    const toastId = toast.loading("Setting up database & verifying SMTP connection...", { duration: 0 });
    
    try {
      const res = await DataService.setupSystem({
        ownerEmail: onboardingEmail,
        gmailAppPassword: onboardingAppPassword || undefined,
        storeName: onboardingStoreName,
        storeAddress: onboardingStoreAddress,
        storePhone: onboardingStorePhone,
        loginPin: onboardingPin,
        resetKey: onboardingResetKey
      });
      
      setSetupRunning(false);
      toast.dismiss(toastId);
      
      if (res.success) {
        setOnboardingFormSuccess("System successfully initialized! Redirecting to dashboard...");
        if (res.warning) {
          toast.success(res.message, { duration: 12000 });
        } else {
          toast.success("Account dynamic system setup successfully! Welcome to DO BILL!");
        }
        sessionStorage.setItem('retailpro_auth', 'true');
        sessionStorage.setItem('retailpro_auth_email', onboardingEmail.trim().toLowerCase());
        sessionStorage.setItem('retailpro_active_workspace', onboardingEmail.trim().toLowerCase());
        localStorage.setItem('retailpro_auth', 'true');
        localStorage.setItem('retailpro_auth_email', onboardingEmail.trim().toLowerCase());
        localStorage.setItem('retailpro_active_workspace', onboardingEmail.trim().toLowerCase());
        localStorage.setItem('retailpro_last_login_time', Date.now().toString());
        setIsInstalled(true);
        setIsAuthenticated(true);
        refreshProfileAndStock();
      } else {
        setOnboardingFormError(res.message || "Failed to complete onboarding.");
        toast.error(res.message || "Failed to complete onboarding.");
      }
    } catch (err: any) {
      setSetupRunning(false);
      toast.dismiss(toastId);
      const errMsg = err.message || "An unexpected error occurred during setup.";
      setOnboardingFormError(errMsg);
      toast.error(errMsg);
    }
  };

  const [lowStockCount, setLowStockCount] = useState(0);
  const [userRole, setUserRole] = useState<'Admin' | 'Manager' | 'Cashier'>('Cashier');
  const [shopDetails, setShopDetails] = useState<{ name: string; logo?: string }>({
    name: '',
    logo: ''
  });
  const [userProfile, setUserProfile] = useState<{ name: string; email: string; avatar?: string }>({
    name: '',
    email: '',
    avatar: ''
  });

  const [activeWorkspace, setActiveWorkspaceState] = useState(DataService.getActiveWorkspace());
  const [approvedWorkspaces, setApprovedWorkspaces] = useState<any[]>([]);

  const ability = useMemo(() => defineAbilityFor(userRole), [userRole]);
  
  const triggerDynamicBackup = useCallback(async () => {
    try {
      const backup = await DataService.backupDatabase();
      if (backup && backup.app_users && backup.app_users.length > 0) {
        localStorage.setItem('dobill_local_backup_v1', JSON.stringify(backup));
        console.log("[Backup Engine] Successfully backed up database locally in browser.");
      }
    } catch (err) {
      console.error("[Backup Engine] Failed to perform dynamic backup:", err);
    }
  }, []);

  const refreshProfileAndStock = useCallback(async () => {
    try {
      const p = await DataService.getUserProfile();
      setUserProfile(p);

      const s = await DataService.getShopDetails();
      setShopDetails(s);
      
      const role = await getCurrentUserRole();
      setUserRole(role);
      
      const products = await DataService.getProducts();
      if (Array.isArray(products)) {
        const count = products.filter(p => p.stockQuantity <= p.reorderLevel).length;
        setLowStockCount(count);
      }

      // Load approved workspace list (other connections)
      const accessObj = await DataService.getAccessRequests();
      if (accessObj && Array.isArray(accessObj.approved)) {
        setApprovedWorkspaces(accessObj.approved);
      }

      // Automatically preserve database backup in the local browser cache
      triggerDynamicBackup();
    } catch (e) { console.error(e); }
  }, [triggerDynamicBackup]);

  const handleSwitchWorkspace = (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    DataService.setActiveWorkspace(cleanEmail);
    setActiveWorkspaceState(cleanEmail);
    toast.success(`Active store workspace switched to: ${cleanEmail}`);
    // Triggers refreshProfileAndStock via subscription
  };

  useEffect(() => {
    refreshProfileAndStock();
    return DataService.subscribe(refreshProfileAndStock);
  }, [refreshProfileAndStock]); 

  // Real-time server-sent events (SSE) listener for dynamic multi-device sync
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;
    let isDestroyed = false;

    const connectRealtimeSSE = () => {
      if (isDestroyed) return;
      if (DataService.isLocalMode()) {
        console.log("[RealtimeSync] Offline local fallback is active. Skipping real-time server stream connection.");
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connectRealtimeSSE, 10000);
        return;
      }
      try {
        console.log("[RealtimeSync] Connecting to server sync stream...");
        eventSource = DataService.getRealtimeEventSource();

        eventSource.onmessage = (event) => {
          if (isDestroyed) return;
          try {
            const data = JSON.parse(event.data);
            console.log("[RealtimeSync] Received event:", data);

            if (data.type === 'init') {
              return;
            }

            const currentActiveWorkspace = DataService.getActiveWorkspace();
            // Match the workspace to make sure we don't sync unrelated workspaces
            if (!data.workspaceOwner || data.workspaceOwner.trim().toLowerCase() === currentActiveWorkspace.trim().toLowerCase()) {
              console.log("[RealtimeSync] Matches active workspace! Performing dynamic data refresh...");
              
              // 1. Notify all listeners/subscribers of DataService to pull new products, sales, etc.
              DataService.notifyListeners();
              
              // 2. Trigger active React components state refresh (stocks, profiles, etc.)
              refreshProfileAndStock();
            }
          } catch (err) {
            console.error("[RealtimeSync] Failed to parse message:", err);
          }
        };

        eventSource.onerror = (err) => {
          if (isDestroyed) return;
          console.warn("[RealtimeSync] Error on stream connection. Scheduling reconnection in 4s...", err);
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(connectRealtimeSSE, 4000);
        };
      } catch (err) {
        if (isDestroyed) return;
        console.error("[RealtimeSync] Connection initialization failed. Retrying in 4s...", err);
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connectRealtimeSSE, 4000);
      }
    };

    connectRealtimeSSE();

    return () => {
      isDestroyed = true;
      if (eventSource) {
        eventSource.close();
      }
      clearTimeout(reconnectTimeout);
    };
  }, [activeWorkspace, refreshProfileAndStock]);

  // Invite Link Verification / Auto-login
  const [showAcceptInviteScreen, setShowAcceptInviteScreen] = useState(false);
  const [inviteEmailInput, setInviteEmailInput] = useState('');
  const [inviteOwnerEmail, setInviteOwnerEmail] = useState('');
  const [inviteIdParam, setInviteIdParam] = useState('');
  const [acceptingLoading, setAcceptingLoading] = useState(false);

  useEffect(() => {
    const checkInviteLink = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const inviteEmail = searchParams.get('invite_email');
      const inviteId = searchParams.get('invite_id') || '';
      if (inviteEmail) {
        const cleanEmail = inviteEmail.trim().toLowerCase();
        const shared = await DataService.getSharedEmails();
        const hasAccess = shared.some((email) => email.toLowerCase() === cleanEmail);
        
        if (hasAccess) {
          setIsAuthenticated(true);
          sessionStorage.setItem('retailpro_auth', 'true');
          sessionStorage.setItem('retailpro_auth_email', cleanEmail);
          localStorage.setItem('retailpro_auth', 'true');
          localStorage.setItem('retailpro_auth_email', cleanEmail);
          localStorage.setItem('retailpro_last_login_time', Date.now().toString());
          toast.success(`Access verified! Welcome back ${inviteEmail}! Connected with Full Access.`);
          try {
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
          } catch (histErr) {
            console.warn('[App] history.replaceState bypassed:', histErr);
          }
        } else {
          // Explicit acceptance step is required! Prefill state and toggle screen
          setInviteEmailInput(cleanEmail);
          setInviteIdParam(inviteId);
          setShowAcceptInviteScreen(true);
        }
      }
    };
    checkInviteLink();
  }, []);

  const handleAcceptInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = inviteEmailInput.trim().toLowerCase();
    const cleanOwnerEmail = inviteOwnerEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || cleanEmail.length < 5) {
      toast.error('Please enter a valid Gmail address');
      return;
    }
    setAcceptingLoading(true);
    // Properly align: 1. Invited Colleague Email, 2. Owner Email, 3. Invite UID (optional)
    const res = await DataService.acceptInvitation(cleanEmail, cleanOwnerEmail || undefined, inviteIdParam || undefined);
    setAcceptingLoading(false);
    if (res.success) {
      setIsAuthenticated(true);
      sessionStorage.setItem('retailpro_auth', 'true');
      sessionStorage.setItem('retailpro_auth_email', cleanEmail);
      localStorage.setItem('retailpro_auth', 'true');
      localStorage.setItem('retailpro_auth_email', cleanEmail);
      localStorage.setItem('retailpro_last_login_time', Date.now().toString());
      toast.success(res.message || `Invitation accepted! Welcome back ${cleanEmail} with Full Access.`);
      
      try {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      } catch (histErr) {
        console.warn('[App] history.replaceState bypassed:', histErr);
      }
      setShowAcceptInviteScreen(false);
      setInviteOwnerEmail('');
    } else {
      toast.error(res.message || 'Failed to accept invitation. Make sure the administrator invited your email first.');
    }
  };

  interface SavedAccount {
    username: string;
    password: string;
    name: string;
    email: string;
    role?: string;
    avatar?: string;
  }

  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(() => {
    try {
      const raw = localStorage.getItem('retailpro_saved_accounts');
      if (raw) {
        const parsed: SavedAccount[] = JSON.parse(raw);
        const filtered = parsed.filter(a => {
          const u = (a.username || a.email || '').toLowerCase().trim();
          return u !== 'casher' && u !== 'cashier' && u !== 'default';
        });
        return filtered;
      }
    } catch (e) {}
    return [];
  });
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);

  // Sync current account to saved accounts list on login & profile loads
  useEffect(() => {
    // Completely disabled to remove all saved credentials/accounts by default and keep zero local accounts
  }, [isAuthenticated, userProfile.email, userProfile.name, userRole, userProfile.avatar]);

  const handleDirectLoginFromSwitcher = async (savedUser: string, savedPass: string) => {
    const toastId = toast.loading(`Switching session to "${savedUser}"...`);
    try {
      const loginRes = await DataService.login(savedUser.trim(), savedPass);
      toast.dismiss(toastId);

      if (loginRes.success) {
        setIsAuthenticated(true);
        sessionStorage.setItem('retailpro_auth', 'true');
        sessionStorage.setItem('retailpro_auth_email', loginRes.email!);
        sessionStorage.setItem('retailpro_active_workspace', loginRes.workspaceOwner!);
        localStorage.setItem('retailpro_auth', 'true');
        localStorage.setItem('retailpro_auth_email', loginRes.email!);
        localStorage.setItem('retailpro_active_workspace', loginRes.workspaceOwner!);
        localStorage.setItem('retailpro_last_login_time', Date.now().toString());
        
        setPassword(savedPass);

        toast.success(`Switched account to "${loginRes.email!}"!`);
        setShowAccountSwitcher(false);
        refreshProfileAndStock();
      } else {
        toast.error(loginRes.message || "Failed to switch account.");
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(`Error switching account: ${err.message}`);
    }
  };

  const handleFullLogout = () => {
    try {
      const savedAccs = localStorage.getItem('retailpro_saved_accounts');
      sessionStorage.clear();
      localStorage.clear();
      if (savedAccs) {
        localStorage.setItem('retailpro_saved_accounts', savedAccs);
      }
    } catch (e) {}
    DataService.setActiveWorkspace('');
    setIsAuthenticated(false);
    setUsername('');
    setPassword('');
    window.location.href = window.location.origin + window.location.pathname;
  };

  const handleAddAccountAction = () => {
    try {
      const savedAccs = localStorage.getItem('retailpro_saved_accounts');
      sessionStorage.clear();
      localStorage.clear();
      if (savedAccs) {
        localStorage.setItem('retailpro_saved_accounts', savedAccs);
      }
    } catch (e) {}
    DataService.setActiveWorkspace('');
    setIsAuthenticated(false);
    setUsername('');
    setPassword('');
    setShowAccountSwitcher(false);
    toast.success("Ready to link a new store or account. Register or Log in below!");
  };

  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Unified Username & Password state
  const [loginFormError, setLoginFormError] = useState<string | null>(null);
  const [loginFormSuccess, setLoginFormSuccess] = useState<string | null>(null);

  // Password / PIN recovery states (Gmail OTP driven)
  const [showForgotPin, setShowForgotPin] = useState(false);
  const [forgotPasswordUsernameOrEmail, setForgotPasswordUsernameOrEmail] = useState('');
  const [forgotPasswordOtp, setForgotPasswordOtp] = useState('');
  const [forgotPasswordOtpSent, setForgotPasswordOtpSent] = useState(false);
  const [forgotPasswordOtpVerified, setForgotPasswordOtpVerified] = useState(false);
  const [forgotPasswordNewPIN, setForgotPasswordNewPIN] = useState('');
  const [forgotPasswordNewUsername, setForgotPasswordNewUsername] = useState('');
  const [forgotPasswordTargetEmail, setForgotPasswordTargetEmail] = useState('');
  const [forgotPasswordError, setForgotPasswordError] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);



  const [signUpFormError, setSignUpFormError] = useState<string | null>(null);
  const [signUpFormSuccess, setSignUpFormSuccess] = useState<string | null>(null);
  const [onboardingFormError, setOnboardingFormError] = useState<string | null>(null);
  const [onboardingFormSuccess, setOnboardingFormSuccess] = useState<string | null>(null);

  // Multi-device signup / registration states
  const [showSignUp, setShowSignUp] = useState(false);
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpUsername, setSignUpUsername] = useState('Display Name');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpStoreName, setSignUpStoreName] = useState('Store Name');
  const [signUpStoreAddress, setSignUpStoreAddress] = useState('Store Address');
  const [signUpStorePhone, setSignUpStorePhone] = useState('');
  const [signUpResetKey, setSignUpResetKey] = useState('');
  const [signUpRunning, setSignUpRunning] = useState(false);

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpFormError(null);
    setSignUpFormSuccess(null);
    
    if (!signUpEmail || !signUpEmail.includes('@') || signUpEmail.trim().length < 5) {
      setSignUpFormError("Please enter a valid Gmail address.");
      toast.error("Please enter a valid Gmail address.");
      return;
    }
    if (!signUpUsername || signUpUsername.trim().length < 3) {
      setSignUpFormError("Username must be at least 3 characters.");
      toast.error("Username must be at least 3 characters.");
      return;
    }
    if (!signUpPassword || signUpPassword.trim().length < 4) {
      setSignUpFormError("Password/PIN must be at least 4 characters.");
      toast.error("Password/PIN must be at least 4 characters.");
      return;
    }

    setSignUpRunning(true);
    const toastId = toast.loading("Creating secure store account & database partition...");
    
    try {
      const res = await DataService.register({
        email: signUpEmail,
        username: signUpUsername,
        password: signUpPassword,
        storeName: signUpStoreName,
        storeAddress: signUpStoreAddress,
        storePhone: signUpStorePhone,
        resetKey: signUpResetKey
      });

      setSignUpRunning(false);
      toast.dismiss(toastId);

      if (res.success) {
        setSignUpFormSuccess(res.message || "Account registered successfully! Ready to log in.");
        toast.success(res.message || "Account registered successfully!");
        setUsername(signUpUsername);
        setPassword(signUpPassword);

        // Instantly save this brand new account to the device's list of saved accounts
        const newSavedAcc: SavedAccount = {
          username: signUpUsername,
          password: signUpPassword,
          name: signUpUsername,
          email: signUpEmail,
          role: 'Admin',
          avatar: ''
        };
        setSavedAccounts(prev => {
          const filtered = prev.filter(a => a.username.toLowerCase() !== signUpUsername.toLowerCase());
          const updated = [...filtered, newSavedAcc];
          localStorage.setItem('retailpro_saved_accounts', JSON.stringify(updated));
          return updated;
        });

        // Toggle back to login/main interface and initiate automatic session login
        setTimeout(async () => {
          setShowSignUp(false);
          setSignUpFormSuccess(null);
          
          const autoLoginToastId = toast.loading(`Logging in to your new store "${signUpUsername}" automatically...`);
          try {
            const loginRes = await DataService.login(signUpUsername, signUpPassword);
            toast.dismiss(autoLoginToastId);
            if (loginRes.success) {
              setIsAuthenticated(true);
              sessionStorage.setItem('retailpro_auth', 'true');
              sessionStorage.setItem('retailpro_auth_email', loginRes.email!);
              sessionStorage.setItem('retailpro_active_workspace', loginRes.workspaceOwner!);
              localStorage.setItem('retailpro_auth', 'true');
              localStorage.setItem('retailpro_auth_email', loginRes.email!);
              localStorage.setItem('retailpro_active_workspace', loginRes.workspaceOwner!);
              localStorage.setItem('retailpro_last_login_time', Date.now().toString());
              
              toast.success(`Welcome to your new store! Automatically logged in as ${signUpUsername}`);
              refreshProfileAndStock();
            }
          } catch (loginErr) {
            toast.dismiss(autoLoginToastId);
            console.error("Auto login after signup failed:", loginErr);
          }
        }, 1200);
      } else {
        setSignUpFormError(res.message || "Registration failed.");
        toast.error(res.message || "Registration failed.");
      }
    } catch (err: any) {
      setSignUpRunning(false);
      toast.dismiss(toastId);
      const errMsg = err.message || "An unexpected error occurred during registration.";
      setSignUpFormError(errMsg);
      toast.error(errMsg);
    }
  };

  const renderAvatar = (avatar: string | undefined, name: string) => {
    if (!avatar) {
      return (
        <span className="text-xs font-black text-slate-500">
          {name ? name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase() : 'OS'}
        </span>
      );
    }
    const isImage = avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('data:image/');
    if (isImage) {
      return <img src={avatar} alt="Profile" className="h-full w-full object-cover" referrerPolicy="no-referrer" />;
    } else {
      return <span className="text-lg font-bold">{avatar}</span>;
    }
  };

  const handleDirectLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameError('');
    setPasswordError('');
    setLoginFormError(null);
    setLoginFormSuccess(null);

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setUsernameError('Please enter your username or registered email');
      setLoginFormError('Please enter your username or registered email');
      toast.error('Username or Email is required');
      return;
    }

    if (!password) {
      setPasswordError('Please enter your Password / PIN');
      setLoginFormError('Please enter your Password / PIN');
      toast.error('Password / PIN is required');
      return;
    }

    const toastId = toast.loading("Verifying credentials...");
    try {
      // Login via database credentials
      const loginRes = await DataService.login(trimmedUsername, password);
      toast.dismiss(toastId);

      if (loginRes.success) {
        setLoginFormSuccess(loginRes.message || "Login successful! Welcome back.");
        setIsAuthenticated(true);
        sessionStorage.setItem('retailpro_auth', 'true');
        sessionStorage.setItem('retailpro_auth_email', loginRes.email!);
        sessionStorage.setItem('retailpro_active_workspace', loginRes.workspaceOwner!);
        localStorage.setItem('retailpro_auth', 'true');
        localStorage.setItem('retailpro_auth_email', loginRes.email!);
        localStorage.setItem('retailpro_active_workspace', loginRes.workspaceOwner!);
        localStorage.setItem('retailpro_last_login_time', Date.now().toString());
        
        toast.success(`Authenticated successfully as ${loginRes.email!}`);
        refreshProfileAndStock();

        // Save to saved accounts list on successful login
        const newSavedAcc: SavedAccount = {
          username: trimmedUsername,
          password: password,
          name: loginRes.email ? loginRes.email.split('@')[0] : trimmedUsername,
          email: loginRes.email || '',
          role: loginRes.role || 'Admin',
          avatar: ''
        };
        setSavedAccounts(prev => {
          const filtered = prev.filter(a => a.username.toLowerCase() !== trimmedUsername.toLowerCase());
          const updated = [...filtered, newSavedAcc];
          localStorage.setItem('retailpro_saved_accounts', JSON.stringify(updated));
          return updated;
        });
      } else {
        const errMsg = loginRes.message || 'Authentication failed. Incorrect password/PIN.';
        setLoginFormError(errMsg);
        setPasswordError(errMsg);
        toast.error(errMsg);
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      const errMsg = err.message || 'Server connection issue during login.';
      setLoginFormError(errMsg);
      toast.error(errMsg);
    }
  };

  // FORGOT PASSWORD FLOW HANDLERS
  const handleForgotPasswordSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setForgotPasswordError('');
    const userInput = forgotPasswordUsernameOrEmail.trim();
    if (!userInput) {
      setForgotPasswordError("Please enter your Username or registered Email ID.");
      return;
    }

    setForgotPasswordLoading(true);
    const toastId = toast.loading("Locating linked account setup & sending OTP...");
    try {
      const sendRes = await DataService.forgotPasswordSend(userInput);
      toast.dismiss(toastId);
      if (sendRes && sendRes.success) {
        const targetEmail = sendRes.targetEmail || userInput;
        setForgotPasswordTargetEmail(targetEmail);
        setForgotPasswordNewUsername(sendRes.username || userInput);

        setForgotPasswordOtpSent(true);
        setForgotPasswordResendTimer(45);
        toast.success(sendRes.message || "Reset OTP code dispatched!");
      } else {
        const errMsg = sendRes?.message || "Failed to dispatch reset verification code.";
        setForgotPasswordError(errMsg);
        toast.error(errMsg);
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      const errMsg = err.message || "Failed to dispatch reset verification code.";
      setForgotPasswordError(errMsg);
      toast.error(errMsg);
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleForgotPasswordVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordError('');
    if (!forgotPasswordOtp.trim()) {
      setForgotPasswordError("Please enter the 6-digit verification code.");
      return;
    }
    setForgotPasswordLoading(true);
    const toastId = toast.loading("Verifying security reset code...");
    try {
      const emailToVerify = forgotPasswordTargetEmail || forgotPasswordUsernameOrEmail.trim();
      const verifyRes = await DataService.verifyOTP(emailToVerify, forgotPasswordOtp.trim());
      toast.dismiss(toastId);
      if (verifyRes && verifyRes.success) {
        setForgotPasswordOtpVerified(true);
        setForgotPasswordError('');
        toast.success(verifyRes.message || "Security reset code verified! You can now edit your account username and password.");
      } else {
        const errMsg = verifyRes?.message || "Incorrect verification OTP.";
        setForgotPasswordError(errMsg);
        toast.error(errMsg);
      }
    } catch (e: any) {
      toast.dismiss(toastId);
      const errMsg = e.message || "Verification failed.";
      setForgotPasswordError(errMsg);
      toast.error(errMsg);
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleForgotPasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordError('');
    
    if (!forgotPasswordNewUsername.trim()) {
      setForgotPasswordError("Please enter your Username / ID.");
      return;
    }
    if (!forgotPasswordNewPIN.trim()) {
      setForgotPasswordError("Please enter your new PIN / Password.");
      return;
    }

    setForgotPasswordLoading(true);
    const toastId = toast.loading("Updating your account login credentials...");
    try {
      const resetRes = await DataService.forgotPasswordReset(
        forgotPasswordUsernameOrEmail.trim(),
        forgotPasswordOtp.trim(),
        forgotPasswordNewUsername.trim(),
        forgotPasswordNewPIN.trim()
      );
      toast.dismiss(toastId);
      if (resetRes.success) {
        toast.success("Your credentials have been updated! Please login now.");
        
        // Auto-fill username in login input, reset form, and go back
        setUsername(resetRes.updatedUsername || forgotPasswordNewUsername.trim());
        setPassword('');
        setShowForgotPin(false);
        
        // Reset states
        setForgotPasswordUsernameOrEmail('');
        setForgotPasswordOtp('');
        setForgotPasswordOtpSent(false);
        setForgotPasswordOtpVerified(false);
        setForgotPasswordNewPIN('');
        setForgotPasswordNewUsername('');
      }
    } catch (e: any) {
      toast.dismiss(toastId);
      setForgotPasswordError(e.message || "Failed to update credentials.");
      toast.error("Reset failed");
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  if (isInstalled === null) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 gap-4">
        <span className="h-10 w-10 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin"></span>
        <p className="text-slate-500 font-bold text-xs uppercase tracking-widest animate-pulse">Initializing terminal...</p>
      </div>
    );
  }

  const renderDownloadModal = () => {
    if (!showDownloadModal) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[999] flex items-center justify-center p-3 sm:p-6 animate-fade-in font-sans overflow-y-auto">
        <div className="bg-white w-full max-w-6xl rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden transform transition-all animate-scale-up my-auto max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="relative bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 p-6 sm:p-8 text-white shrink-0">
            <button 
              type="button"
              onClick={() => setShowDownloadModal(false)}
              className="absolute top-4 right-4 bg-white/15 hover:bg-white/25 text-white p-2.5 rounded-full transition-all cursor-pointer border-none"
              style={{ border: 'none', background: 'transparent' }}
            >
              <X className="h-5 w-5" />
            </button>
            <div className="inline-flex items-center gap-1.5 text-indigo-300 bg-indigo-500/15 border border-indigo-400/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-3">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
              DO BILL App Center (ऐप सेंटर)
            </div>
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Download DO BILL App</h3>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-xl">
              अपने मोबाइल या कंप्यूटर पर DO BILL को ऐप की तरह चलाएं। Smart architecture auto-detection enabled.
            </p>
          </div>

          {/* Modal Scrollable Body */}
          <div className="p-6 sm:p-8 overflow-y-auto space-y-6 custom-scrollbar">
            {/* DOWNLOAD HUB WITH AUTO DETECT & MANUAL DOWNLOAD OPTIONS */}
            <DownloadHub onClose={() => setShowDownloadModal(false)} />
          </div>
        </div>
      </div>
    );
  };



  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 relative overflow-y-auto overflow-x-hidden py-12 px-4 no-print sm:px-6 lg:px-8 font-sans">
        {/* Floating Top-Right Download Button */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-8 z-20">
          <Button 
            type="button"
            variant="outline"
            onClick={() => setShowDownloadModal(true)}
            className="bg-white hover:bg-slate-50 text-indigo-600 border-indigo-150 hover:border-indigo-300 shadow-sm font-bold text-xs flex items-center gap-2 rounded-full px-4 h-9 cursor-pointer transition-all hover:scale-105 active:scale-95"
          >
            <Sparkles className="h-3.5 w-3.5 animate-pulse text-indigo-500" />
            <span className="hidden xs:inline">Download App (APK & EXE)</span>
            <span className="inline xs:hidden">Download App</span>
          </Button>
        </div>

        {/* Beautiful background decorations wrapped in a clipped layout container to protect viewport boundary */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute bg-primary/5 opacity-40 blur-3xl rounded-full h-[40rem] w-[40rem] -top-40 -left-40"></div>
          <div className="absolute bg-primary/5 opacity-40 blur-3xl rounded-full h-[40rem] w-[40rem] -bottom-40 -right-40"></div>
        </div>
        
        {showSignUp ? (
          <Card className="w-full max-w-4xl shadow-2xl border-none z-10 p-4 sm:p-6 md:p-10 rounded-2xl sm:rounded-[2rem] transition-all duration-300 bg-white overflow-hidden">
            <CardHeader className="text-center pb-4">
              <Logo className="h-14 w-14 bg-white rounded-2xl shadow-xl mx-auto mb-3 border border-slate-100" />
              <CardTitle className="text-2xl sm:text-3.5xl font-black text-slate-900 tracking-tight">Register New Store</CardTitle>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1.5">
                Create database partition & use on any device
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <RegistrationWizard
                isOnboarding={!isSystemSetupCompleted}
                initialEmail={username}
                onSuccess={(email, storeName, isDirectLogin) => {
                  setShowSignUp(false);
                  setUsername(email);
                  setLoginFormError(null);
                  if (isDirectLogin) {
                    setIsAuthenticated(true);
                    refreshProfileAndStock();
                    toast.success(`Success! Logged in directly to your workspace.`);
                    setShowDashboardCelebration(true);
                  } else {
                    toast.success(`Success! Registered account ${email} under ${storeName}. Enter credentials to log in.`);
                  }
                }}
                onCancel={() => setShowSignUp(false)}
              />
            </CardContent>
          </Card>
        ) : (
          <Card className="w-full max-w-lg shadow-2xl border-none z-10 p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl transition-all duration-300 bg-white overflow-hidden">
            <CardHeader className="text-center pb-6">
              <Logo className="h-16 w-16 bg-white rounded-2xl shadow-xl mx-auto mb-4 border border-slate-100" customLogo={shopDetails.logo} />
              
              {showForgotPin ? (
                <>
                  <CardTitle className="text-2xl font-black flex items-center justify-center gap-2">
                    <Shield className="h-6 w-6 text-amber-500" /> Reset Password / PIN
                  </CardTitle>
                  <p className="text-slate-500 font-medium text-xs mt-2 leading-relaxed">
                    {!forgotPasswordOtpSent 
                      ? "Verify your identity with your username or Gmail ID to receive a verification OTP." 
                      : "Enter the OTP received on your email along with your new password / PIN."}
                  </p>
                </>
              ) : showAcceptInviteScreen ? (
                <>
                  <CardTitle className="text-2xl font-black flex items-center justify-center gap-2">
                    <Shield className="h-6 w-6 text-indigo-600" /> Accept Workspace Invite
                  </CardTitle>
                  <p className="text-slate-500 font-semibold text-xs mt-2 leading-relaxed text-center">
                    Activate your Google Ads-style direct sharing invitation to obtain Full 'Admin' command level.
                  </p>
                </>
              ) : (
                <>
                  <CardTitle className="text-2xl font-black animate-fade-in">Login to {shopDetails.name || 'DO BILL'}</CardTitle>
                  <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-2 flex items-center justify-center gap-1.5 font-mono">
                    <span>Enter credentials or use invite link</span>
                  </p>
                </>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Active Accounts Stack (Each in a box stacked vertically) */}
              {!showForgotPin && !showAcceptInviteScreen && savedAccounts.length > 0 && (
                <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100" id="saved-sessions-deck">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Saved Store Accounts</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-primary/10 text-primary text-[8px] font-black uppercase px-2 py-0.5 rounded-full">
                        {savedAccounts.length} Saved
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSavedAccounts([]);
                          localStorage.removeItem('retailpro_saved_accounts');
                          toast.success("Cleared all saved account shortcuts.");
                        }}
                        className="text-[9px] font-bold text-red-500 hover:text-red-700 hover:underline cursor-pointer bg-transparent border-none"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {savedAccounts.map((account, index) => (
                      <div 
                        key={index}
                        className="group flex items-center justify-between p-3 rounded-2xl border border-slate-200/65 bg-white hover:border-primary/20 hover:bg-[#FAF9F6] transition-all duration-200 shadow-sm"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setUsername(account.username);
                            setPassword('');
                            toast.info(`Selected account "${account.username}". Please enter password to log in.`);
                            const passInput = document.querySelector('input[type="password"]');
                            if (passInput instanceof HTMLInputElement) passInput.focus();
                          }}
                          className="flex-1 flex items-center gap-3 text-left bg-transparent border-none p-0 cursor-pointer"
                          title={`Select account "${account.username}"`}
                        >
                          <div className="h-9 w-9 bg-primary/5 text-primary border border-primary/10 rounded-full flex items-center justify-center font-black text-xs shrink-0 select-none">
                            {account.avatar ? (
                              <img src={account.avatar} alt="Avatar" className="h-full w-full object-cover rounded-full" />
                            ) : (
                              account.name.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-black text-slate-800 truncate select-none leading-tight">{account.name}</h4>
                            <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wide truncate mt-0.5">{account.username}</p>
                            {account.role && (
                              <span className="inline-block mt-0.5 bg-indigo-50 text-indigo-700 text-[8px] font-black uppercase px-1.5 py-0.5 rounded border border-indigo-100 font-sans">
                                {account.role}
                              </span>
                            )}
                          </div>
                        </button>

                        <div className="flex items-center gap-1.5 shrink-0 pl-2">
                          <button
                            type="button"
                            onClick={() => {
                              setUsername(account.username);
                              setPassword('');
                              toast.info(`Selected account "${account.username}". Enter password to log in.`);
                              const passInput = document.querySelector('input[type="password"]');
                              if (passInput instanceof HTMLInputElement) passInput.focus();
                            }}
                            className="bg-primary hover:bg-primary/95 text-[9px] text-white font-extrabold uppercase px-2.5 py-1.5 rounded-xl cursor-pointer shadow-sm transition-all active:scale-95"
                          >
                            Select
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = savedAccounts.filter((_, i) => i !== index);
                              setSavedAccounts(updated);
                              localStorage.setItem('retailpro_saved_accounts', JSON.stringify(updated));
                              toast.success(`Removed account "${account.username}" from saved list.`);
                            }}
                            className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-xl transition-all cursor-pointer border-none bg-transparent"
                            title="Remove saved account"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        setUsername('');
                        setPassword('');
                        toast.info("Cleared form fields! Type credentials below or click 'CREATE STORE ACCOUNT' to complete.");
                        const userField = document.querySelector('input[placeholder*="username or Gmail ID"]');
                        if (userField instanceof HTMLInputElement) {
                          userField.focus();
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 p-3 bg-transparent border-2 border-dashed border-slate-200 hover:border-primary/40 hover:bg-primary/5 rounded-2xl text-[11px] font-black uppercase tracking-wider text-slate-600 hover:text-primary transition-all duration-200 cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Another Account</span>
                    </button>
                  </div>
                </div>
              )}

              {showForgotPin ? (
                // OTP Driven Password Reset Form
                !forgotPasswordOtpSent ? (
                  <form onSubmit={handleForgotPasswordSendOtp} className="space-y-4 text-left">
                    {forgotPasswordError && (
                      <div className="p-3 bg-red-50 border border-red-250 rounded-xl text-xs text-red-600 font-medium">
                        ⚠️ {forgotPasswordError}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-slate-400">Username or Gmail ID</Label>
                      <Input 
                        type="text"
                        value={forgotPasswordUsernameOrEmail}
                        onChange={(e) => setForgotPasswordUsernameOrEmail(e.target.value)}
                        placeholder="Enter registered username or Gmail address"
                        className="h-12 text-sm font-semibold"
                        required
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="flex-1 h-12 text-sm font-bold gap-1.5"
                        onClick={() => {
                          setShowForgotPin(false);
                          setForgotPasswordUsernameOrEmail('');
                          setForgotPasswordError('');
                        }}
                      >
                        <ArrowLeft className="h-4 w-4" /> Go Back
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={forgotPasswordLoading}
                        className="flex-1 h-12 text-sm font-bold bg-primary hover:bg-primary/95 text-white"
                      >
                        {forgotPasswordLoading ? "Sending OTP..." : "Send Reset OTP"}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleForgotPasswordResetSubmit} className="space-y-4 text-left">
                    {forgotPasswordError && (
                      <div className="p-3 bg-red-50 border border-red-250 rounded-xl text-xs text-red-600 font-medium">
                        ⚠️ {forgotPasswordError}
                      </div>
                    )}
                    
                    <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-slate-700 text-xs text-left font-sans space-y-1">
                      <div>🔒 Reset authentication OTP sent securely to the registered email: <strong>{forgotPasswordTargetEmail}</strong></div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-slate-400">6-Digit Verification OTP</Label>
                      <div className="flex gap-2">
                        <Input 
                          type="text" 
                          maxLength={6}
                          value={forgotPasswordOtp}
                          onChange={(e) => setForgotPasswordOtp(e.target.value.replace(/\D/g, ''))}
                          placeholder="000000"
                          className="h-12 text-base font-semibold text-center tracking-widest font-mono flex-1"
                          required
                          disabled={forgotPasswordOtpVerified}
                        />
                        {!forgotPasswordOtpVerified && (
                          <Button 
                            type="button" 
                            onClick={handleForgotPasswordVerifyOtp}
                            disabled={forgotPasswordLoading || !forgotPasswordOtp}
                            className="h-12 px-4 text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                          >
                            Verify OTP
                          </Button>
                        )}
                      </div>
                      {forgotPasswordOtpVerified ? (
                        <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-600 flex items-center gap-1.5 mt-1.5 animate-fade-in">
                          <span>✅ Verification Successful! Reset Option Enabled.</span>
                        </p>
                      ) : (
                        <div className="flex justify-center pt-1">
                          <Button 
                            type="button"
                            size="sm"
                            variant="ghost" 
                            disabled={forgotPasswordResendTimer > 0 || forgotPasswordLoading} 
                            onClick={() => handleForgotPasswordSendOtp()}
                            className="font-black text-[11px] text-indigo-600 uppercase tracking-widest hover:bg-slate-50 hover:text-indigo-700 cursor-pointer"
                          >
                            {forgotPasswordResendTimer > 0 ? `Resend OTP in ${forgotPasswordResendTimer}s` : 'Resend Verification Code'}
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className={`text-xs font-bold uppercase ${forgotPasswordOtpVerified ? 'text-slate-400' : 'text-slate-300'}`}>
                        Username / Login ID {!forgotPasswordOtpVerified && " (Disabled until OTP verified)"}
                      </Label>
                      <Input 
                        type="text" 
                        value={forgotPasswordNewUsername} 
                        onChange={(e) => setForgotPasswordNewUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())} 
                        placeholder={forgotPasswordOtpVerified ? "e.g. admin" : "Verify Code First"} 
                        className={`h-12 text-base font-semibold ${!forgotPasswordOtpVerified ? 'bg-slate-150 border-slate-200 cursor-not-allowed opacity-60' : ''}`}
                        required
                        disabled={!forgotPasswordOtpVerified}
                      />
                      {forgotPasswordOtpVerified && (
                        <p className="text-[10px] text-indigo-600 font-bold leading-normal mt-0.5 animate-fade-in">
                          💡 Suggested login username found. You can keep it or edit it to set a new custom ID!
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className={`text-xs font-bold uppercase ${forgotPasswordOtpVerified ? 'text-slate-400' : 'text-slate-300'}`}>
                        New Password / PIN {!forgotPasswordOtpVerified && " (Disabled until OTP verified)"}
                      </Label>
                      <Input 
                        type="password" 
                        value={forgotPasswordNewPIN} 
                        onChange={(e) => setForgotPasswordNewPIN(e.target.value)} 
                        placeholder={forgotPasswordOtpVerified ? "••••••" : "Verify Code First"} 
                        className={`h-12 text-base font-mono ${!forgotPasswordOtpVerified ? 'bg-slate-150 border-slate-200 cursor-not-allowed opacity-60' : ''}`}
                        required
                        disabled={!forgotPasswordOtpVerified}
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="flex-1 h-12 text-sm font-bold gap-1.5"
                        onClick={() => {
                          setForgotPasswordOtpSent(false);
                          setForgotPasswordOtpVerified(false);
                          setForgotPasswordOtp('');
                          setForgotPasswordNewPIN('');
                          setForgotPasswordNewUsername('');
                          setForgotPasswordError('');
                        }}
                      >
                        <ArrowLeft className="h-4 w-4" /> Reset Form / Back
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={forgotPasswordLoading || !forgotPasswordOtpVerified}
                        className={`flex-1 h-12 text-sm font-bold text-white ${
                          forgotPasswordOtpVerified 
                            ? 'bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/10 cursor-pointer' 
                            : 'bg-slate-300 cursor-not-allowed border-none'
                        }`}
                      >
                        {forgotPasswordLoading ? "Saving..." : "Save & Update Credentials"}
                      </Button>
                    </div>
                  </form>
                )
              ) : showAcceptInviteScreen ? (
                // Invitation Acceptance Form
                <form onSubmit={handleAcceptInviteSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-400">Your Gmail Address (Colleague)</Label>
                    <Input 
                      type="email"
                      value={inviteEmailInput} 
                      onChange={(e) => setInviteEmailInput(e.target.value)} 
                      placeholder="e.g. colleague@gmail.com" 
                      className="h-11 text-sm font-semibold"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-400">Store Owner's Gmail ID (Who invited you)</Label>
                    <Input 
                      type="email"
                      value={inviteOwnerEmail} 
                      onChange={(e) => setInviteOwnerEmail(e.target.value)} 
                      placeholder="e.g. owner@gmail.com" 
                      className="h-11 text-sm font-semibold"
                      required
                    />
                  </div>
                  <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-[11px] text-slate-600 font-medium space-y-1.5 leading-relaxed text-left animate-pulse">
                    <div className="flex items-center gap-1.5 text-indigo-700 font-bold uppercase text-[9px] tracking-wide">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                      Terminal Workspace Pairing
                    </div>
                    <p>By entering both emails, you immediately join and authenticate to access their store catalog and terminal operations with Full Access without relying on link clicks.</p>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="flex-1 h-12 text-sm font-bold gap-1.5"
                      onClick={() => {
                        setShowAcceptInviteScreen(false);
                        setInviteEmailInput('');
                        setInviteOwnerEmail('');
                        setInviteIdParam('');
                      }}
                    >
                      <ArrowLeft className="h-4 w-4" /> Go Back
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={acceptingLoading}
                      className="flex-1 h-12 text-sm font-bold bg-indigo-600 hover:bg-slate-900 text-white gap-2 uppercase tracking-wide cursor-pointer"
                    >
                      {acceptingLoading ? "Pairing..." : "Connect Terminal"}
                    </Button>
                  </div>
                </form>
              ) : (
                // Normal Username/Password Single-Step Form
                <form onSubmit={handleDirectLoginSubmit} className="space-y-4 text-left font-sans">
                  {loginFormError && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium space-y-2 animate-fade-in" id="login-error-alert">
                      <div className="font-extrabold flex items-center gap-1.5 text-red-800 uppercase text-xs tracking-wider">
                        ⚠️ Access Problem
                      </div>
                      <p className="text-xs leading-normal">{loginFormError}</p>
                      
                      {(loginFormError.includes("not registered") || loginFormError.includes("No registered") || loginFormError.includes("Register first") || loginFormError.includes("not exist") || loginFormError.includes("create")) && (
                        <div className="pt-1">
                          <Button 
                            type="button" 
                            onClick={() => {
                              setShowSignUp(true);
                              setLoginFormError(null);
                            }}
                            className="w-full h-10 bg-indigo-600 hover:bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider rounded-lg shadow-sm cursor-pointer transition-all"
                          >
                            Create New Store Account
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {loginFormSuccess && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-600 font-semibold space-y-1 animate-fade-in" id="login-success-alert">
                      <div className="font-bold flex items-center gap-1.5 text-emerald-800 uppercase text-xs">
                        ✅ LOGIN SUCCESSFUL
                      </div>
                      <p>{loginFormSuccess}</p>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label className={`text-xs font-bold uppercase transition-colors ${usernameError ? 'text-red-500' : 'text-slate-400'}`}>Username or Gmail ID</Label>
                    </div>
                    <Input 
                      value={username} 
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setUsernameError('');
                      }} 
                      placeholder="Enter your username or Gmail ID" 
                      className={`h-12 text-base font-medium transition-all ${usernameError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      required
                    />
                    {usernameError && (
                      <p className="text-xs font-semibold text-red-500 mt-1 animate-fade-in" id="username-error-msg">
                        {usernameError}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label className={`text-xs font-bold uppercase transition-colors ${passwordError ? 'text-red-500' : 'text-slate-400'}`}>Password / PIN</Label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPin(true);
                          setForgotPasswordError('');
                        }}
                        className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <Input 
                        type={showPassword ? "text" : "password"} 
                        value={password} 
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setPasswordError('');
                        }} 
                        placeholder="••••••" 
                        className={`h-12 text-base font-mono pr-12 transition-all ${passwordError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => !p)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer bg-transparent border-none outline-none"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                      </button>
                    </div>
                    {passwordError && (
                      <p className="text-xs font-semibold text-red-500 mt-1 animate-fade-in" id="password-error-msg">
                        {passwordError}
                      </p>
                    )}
                  </div>

                  <Button 
                    type="submit"
                    className="w-full h-12 text-sm font-extrabold uppercase tracking-wide bg-primary hover:bg-primary/95 mt-4 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                  >
                    Access Terminal
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>
              )}

              <div className="pt-4 border-t border-slate-100 space-y-4 text-left font-sans">
                {!showForgotPin && !showAcceptInviteScreen && (
                  <div className="w-full text-center pb-2">
                    <div className="flex flex-col items-center gap-2" id="create-account-box">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Don't have a store account?</span>
                      <Button 
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowSignUp(true);
                          setLoginFormError(null);
                        }} 
                        className="w-full h-12 flex items-center justify-center text-xs font-black text-primary border-2 border-dashed border-primary/20 hover:border-primary/55 bg-primary/5 hover:bg-primary/10 rounded-xl transition-all cursor-pointer shadow-sm uppercase tracking-wider"
                        id="switch-to-signup-btn"
                      >
                        Create Store Account
                      </Button>
                    </div>
                  </div>
                )}



                <div className="flex justify-center pt-1">
                  <div className="inline-flex items-center gap-1 text-[10px] font-black text-primary uppercase tracking-widest bg-primary/5 px-2.5 py-1 rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Authorized Terminal Session
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        {renderDownloadModal()}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 relative overflow-hidden">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Desktop & Tablet Drawer */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 sm:w-72 bg-white flex flex-col shadow-xl transition-transform duration-300 lg:relative lg:translate-x-0 lg:shadow-sm h-screen shrink-0 overflow-hidden
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        no-print
      `}>
        {/* Pinned Header (Logo & Brand) */}
        <div className="p-6 sm:p-8 pb-4 border-b border-slate-50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Logo className="h-10 w-10 bg-white rounded-xl shadow-sm border border-slate-100 shrink-0" customLogo={shopDetails.logo} />
              <div className="min-w-0">
                <h1 className="text-sm font-black tracking-tight text-slate-800 leading-none uppercase truncate">{shopDetails.name || 'DO BILL'}</h1>
                <span className="text-primary text-[9px] font-black tracking-widest uppercase mt-0.5 block leading-none">POS Workspace</span>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden h-8 w-8" 
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Scrollable Body (Workspace Switcher, Navigation list, Alerts & User profile) */}
        <div 
          className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col justify-between select-none touch-pan-y" 
          style={{ overscrollBehaviorX: 'contain' }}
        >
          {/* Top Section: Switcher & Navigation */}
          <div className="p-6 sm:p-8 pt-4 pb-4 space-y-6">
            {/* Premium Store Switcher Panel */}
            <div className="p-3.5 bg-slate-50/70 rounded-2xl border border-slate-100 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Active Workspace</span>
                {activeWorkspace !== (userProfile.email || '') && (
                  <Badge className="bg-[#FFF8EB] hover:bg-[#FFF8EB] text-[#B7791F] text-[8px] font-black uppercase border border-[#FEEBC8] h-4 px-1.5 rounded">
                    Colleague View
                  </Badge>
                )}
              </div>
              
              <div className="text-left py-0.5">
                <h4 className="text-xs font-black text-slate-700 truncate capitalize">
                  {shopDetails.name || 'DO BILL'}
                </h4>
                <p className="text-[9px] font-bold text-slate-400 truncate mt-0.5">{activeWorkspace}</p>
              </div>

              {approvedWorkspaces.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-1 border-t border-slate-200/50 pt-2.5">
                  <span className="text-[7.5px] font-black uppercase text-slate-400 tracking-widest block mb-0.5">Switch Store Terminal</span>
                  
                  {/* Personal Primary Store Option */}
                  <button
                    type="button"
                    onClick={() => handleSwitchWorkspace(userProfile.email || '')}
                    className={`flex items-center justify-between text-left text-[11px] font-extrabold px-3 py-2 rounded-xl border transition-all cursor-pointer ${
                      activeWorkspace === (userProfile.email || '').trim().toLowerCase()
                        ? 'border-indigo-500 bg-indigo-55/40 text-indigo-700 font-extrabold ring-2 ring-indigo-500/10'
                        : 'border-slate-150 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">My Primary Store</span>
                    {activeWorkspace === (userProfile.email || '').trim().toLowerCase() && (
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                    )}
                  </button>

                  {/* Shared Connected Stores Option */}
                  {approvedWorkspaces.map((ws: any) => (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => handleSwitchWorkspace(ws.owner_email)}
                      className={`flex items-center justify-between text-left text-[11px] font-extrabold px-3 py-2 rounded-xl border transition-all cursor-pointer ${
                        activeWorkspace === ws.owner_email.trim().toLowerCase()
                          ? 'border-indigo-500 bg-indigo-55/40 text-indigo-700 font-extrabold ring-2 ring-indigo-500/10'
                          : 'border-slate-150 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate" title={ws.owner_email}>{ws.owner_email.split('@')[0].toUpperCase()}</span>
                      {activeWorkspace === ws.owner_email.trim().toLowerCase() && (
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <nav className="space-y-1">
              <SidebarItem icon={LayoutDashboard} label={t.dashboard} path="/" active={location.pathname === '/'} />
              <SidebarItem icon={ShoppingCart} label={t.pos} path="/pos" active={location.pathname === '/pos'} />
              <SidebarItem icon={Package} label={t.inventory} path="/inventory" active={location.pathname === '/inventory'} />
              <SidebarItem icon={History} label={t.salesHistory} path="/history" active={location.pathname === '/history'} />

              {ability.can('read', 'Reports') && (
                <SidebarItem icon={BarChart3} label={t.reports} path="/reports" active={location.pathname === '/reports'} />
              )}
              {ability.can('manage', 'UPISettings') && (
                <SidebarItem icon={QrCode} label={t.upiSettings} path="/upi" active={location.pathname === '/upi'} />
              )}
              <SidebarItem icon={Settings} label={t.shopSettings} path="/settings" active={location.pathname === '/settings'} />
            </nav>
          </div>

          {/* Bottom Section: Alerts, Profile & Actions (Pushed to bottom but scrolls naturally if needed) */}
          <div className="mt-auto p-6 border-t border-slate-100 bg-slate-50/30 space-y-4 shrink-0">
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Alerts</span>
                {lowStockCount > 0 && <Badge variant="destructive" className="animate-pulse text-[10px] h-4 px-1">{lowStockCount}</Badge>}
              </div>
              <p className="text-xs sm:text-[13px] text-slate-600 font-medium">
                {lowStockCount > 0 ? `${lowStockCount} items low` : 'Stock optimal'}
              </p>
            </div>
            
            <div 
              className="bg-[#FAFCFF] p-3.5 rounded-2xl border border-slate-100 flex items-center gap-3 select-none group"
            >
              <div className="h-10 w-10 rounded-full bg-white border border-slate-200 ring-4 ring-primary/5 overflow-hidden flex items-center justify-center shrink-0">
                {userProfile.avatar ? (
                  userProfile.avatar.startsWith('http://') || userProfile.avatar.startsWith('https://') || userProfile.avatar.startsWith('data:image/') ? (
                    <img src={userProfile.avatar} alt="Profile" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-lg">{userProfile.avatar}</span>
                  )
                ) : (
                  <span className="text-xs font-black text-slate-500">
                    {userProfile.name ? userProfile.name.trim().split(/\s+/).map(n => n[0]).filter(Boolean).join('').substring(0,2).toUpperCase() : 'OS'}
                  </span>
                )}
              </div>
              <div className="min-w-0 leading-tight">
                <h5 className="text-[11px] font-black text-slate-800 truncate group-hover:text-primary transition-colors">{userProfile.name}</h5>
                <p className="text-[9px] font-bold text-slate-400 truncate uppercase mt-0.5 tracking-widest">{userProfile.email}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    Full Access
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[8px] font-black uppercase text-emerald-600 tracking-wider">Sync Active</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-1 flex flex-col gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                className="w-full justify-start gap-3 text-slate-500 hover:text-red-600 hover:bg-red-50 h-10 px-3"
                onClick={handleFullLogout}
              >
                <LogOut className="h-4 w-4" />
                <span className="font-semibold text-sm">Logout</span>
              </Button>
              
              <div className="px-3 py-2 text-center border-t border-slate-100 mt-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-tight">
                  Designed & Developed by
                </p>
                <p className="text-[10.5px] font-black text-emerald-600 uppercase tracking-wide">
                  DO BILL
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#F8FAFC]">
        <header className="h-16 border-b bg-white flex items-center justify-between px-4 sm:px-8 sticky top-0 z-30 no-print shadow-sm">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden h-9 w-9" 
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>
            <h2 className="text-sm sm:text-lg font-semibold text-slate-700 truncate max-w-[140px] sm:max-w-none uppercase tracking-wide">
              {location.pathname === '/' && t.dashboard}
              {location.pathname === '/pos' && t.pos}
              {location.pathname === '/inventory' && t.inventory}
              {location.pathname === '/history' && t.salesHistory}
              {location.pathname === '/purchases' && t.purchaseEntry}
              {location.pathname === '/reports' && t.reports}
              {location.pathname === '/upi' && t.upiSettings}
              {location.pathname === '/settings' && t.shopSettings}
            </h2>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Desktop and Mobile Get App Buttons */}
            <Button 
              type="button"
              variant="outline" 
              onClick={() => setShowDownloadModal(true)}
              className="hidden sm:flex items-center gap-1.5 font-bold text-xs text-indigo-600 bg-indigo-50/40 border-indigo-100 hover:bg-indigo-50 hover:border-indigo-200 rounded-xl h-9 px-3 cursor-pointer transition-all shadow-sm shrink-0"
              title="Download Desktop App & Mobile APK"
            >
              <Laptop className="h-3.5 w-3.5" />
              <span>Get App</span>
            </Button>
            <Button 
              type="button"
              variant="outline" 
              size="icon"
              onClick={() => setShowDownloadModal(true)}
              className="flex sm:hidden h-9 w-9 text-indigo-600 bg-indigo-50/40 border-indigo-100 hover:bg-indigo-50 rounded-xl cursor-pointer shrink-0"
              title="Download App"
            >
              <Laptop className="h-4 w-4" />
            </Button>

            <Button variant="ghost" size="icon" className="relative h-9 w-9 sm:h-10 sm:w-10">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full border-2 border-white"></span>
            </Button>
            <div 
              className="flex items-center gap-2 select-none group"
            >
              <div className="hidden md:flex flex-col text-right leading-none">
                <span className="text-xs font-black text-slate-700 group-hover:text-primary transition-colors">{userProfile.name}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{userProfile.email}</span>
              </div>
              <div className="h-8 w-8 sm:h-9 sm:w-9 bg-slate-100 rounded-full border border-slate-250 ring-2 ring-primary/10 overflow-hidden flex items-center justify-center text-xs font-bold text-slate-500 group-hover:ring-primary/25 transition-all">
                {userProfile.avatar ? (
                  userProfile.avatar.startsWith('http://') || userProfile.avatar.startsWith('https://') || userProfile.avatar.startsWith('data:image/') ? (
                    <img src={userProfile.avatar} alt="Profile" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-sm">{userProfile.avatar}</span>
                  )
                ) : (
                  userProfile.name ? userProfile.name.trim().split(/\s+/).map(n => n[0]).filter(Boolean).join('').substring(0,2).toUpperCase() : 'OS'
                )}
              </div>
            </div>
          </div>
        </header>

        <div className={`flex-1 ${
          location.pathname === '/pos' 
            ? 'overflow-y-auto overflow-x-hidden lg:overflow-hidden p-3 sm:p-5 lg:p-6 pb-24 lg:pb-6 flex flex-col lg:h-[calc(100vh-64px)]' 
            : 'overflow-y-auto overflow-x-hidden p-4 sm:p-8 pb-24 lg:pb-8'
        }`}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pos" element={<POS />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/history" element={<SalesHistory />} />

            <Route path="/reports" element={<Reports />} />
            <Route path="/upi" element={<UPISettings />} />
            <Route path="/settings" element={<ShopSettings />} />
          </Routes>
        </div>
      </main>

      {/* Bottom Navigation Bar for Mobile Devices */}
      <div className="lg:hidden no-print fixed bottom-0 left-0 right-0 md:left-1/2 md:-translate-x-1/2 md:max-w-lg md:bottom-4 md:rounded-2xl md:border md:border-slate-200/85 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200/85 flex items-center justify-around px-2 z-50 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <Link to="/" className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${location.pathname === '/' ? 'text-indigo-600 font-extrabold' : 'text-slate-400 hover:text-slate-600'}`}>
          <LayoutDashboard className="h-5 w-5" />
          <span className="text-[9px] font-black uppercase tracking-wider">Dash</span>
        </Link>
        <Link to="/pos" className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${location.pathname === '/pos' ? 'text-indigo-600 font-extrabold' : 'text-slate-400 hover:text-slate-600'}`}>
          <ShoppingCart className="h-5 w-5" />
          <span className="text-[9px] font-black uppercase tracking-wider">POS</span>
        </Link>
        <Link to="/inventory" className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${location.pathname === '/inventory' ? 'text-indigo-600 font-extrabold' : 'text-slate-400 hover:text-slate-600'}`}>
          <Package className="h-5 w-5" />
          <span className="text-[9px] font-black uppercase tracking-wider">Stock</span>
        </Link>
        <Link to="/history" className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${location.pathname === '/history' ? 'text-indigo-600 font-extrabold' : 'text-slate-400 hover:text-slate-600'}`}>
          <History className="h-5 w-5" />
          <span className="text-[9px] font-black uppercase tracking-wider">Bills</span>
        </Link>
        <Link to="/settings" className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${location.pathname === '/settings' ? 'text-indigo-600 font-extrabold' : 'text-slate-400 hover:text-slate-600'}`}>
          <Settings className="h-5 w-5" />
          <span className="text-[9px] font-black uppercase tracking-wider">Setup</span>
        </Link>
      </div>

      <div className="no-print">
        <Toaster position="top-right" richColors />
      </div>
      {renderDownloadModal()}
      {showDashboardCelebration && (
        <SparklesCelebration 
          active={showDashboardCelebration} 
          duration={8000} 
          onComplete={() => setShowDashboardCelebration(false)} 
        />
      )}
    </div>
  );
};

export default function App() {
  // Use HashRouter for native webview / local file loading protocols / Electron to prevent blank screens
  const isHashRouterRequired = typeof window !== 'undefined' && (
    window.location.protocol === 'file:' ||
    window.location.protocol.includes('capacitor') ||
    window.location.protocol.includes('app') ||
    (window as any).Capacitor?.isNativePlatform?.() === true ||
    !!(window as any).cordova ||
    !!(window as any).electron ||
    (typeof process !== 'undefined' && !!(process as any)?.versions?.electron) ||
    window.location.hash.includes('#/')
  );

  if (isHashRouterRequired) {
    return (
      <HashRouter>
        <AppContent />
      </HashRouter>
    );
  }

  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

