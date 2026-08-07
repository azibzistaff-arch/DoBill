import React, { useState, useEffect, useMemo } from 'react';
import { 
  Mail, 
  Lock, 
  User, 
  Store, 
  MapPin, 
  Phone, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  Smartphone, 
  AlertCircle, 
  Code,
  Laptop,
  Shield,
  Eye,
  EyeOff,
  Database,
  Cloud,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DataService } from '@/services/dataService';
import { safeLocalStorage, safeSessionStorage } from '@/utils/safeStorage';
import { SparklesCelebration } from './SparklesCelebration';

const localStorage = safeLocalStorage;
const sessionStorage = safeSessionStorage;

// Standard high-quality designer avatars to mimic Instagram/Facebook choices
const PRESET_AVATARS = [
  { emoji: '🛍️', label: 'Boutique', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { emoji: '👗', label: 'Womens Wear', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { emoji: '👔', label: 'Mens Wear', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { emoji: '👟', label: 'Footwear', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { emoji: '💍', label: 'Jewelry', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { emoji: '💄', label: 'Cosmetics', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { emoji: '👓', label: 'Optical', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { emoji: '🧣', label: 'Accessories', color: 'bg-orange-100 text-orange-700 border-orange-200' },
];

interface RegistrationWizardProps {
  isOnboarding: boolean; // Initial system setup vs register custom secondary account
  onSuccess: (email: string, storeName: string, isDirectLogin?: boolean) => void;
  onCancel?: () => void;
  initialEmail?: string;
}

export function RegistrationWizard({ isOnboarding, onSuccess, onCancel, initialEmail }: RegistrationWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Form Fields
  const [email, setEmail] = useState(initialEmail && initialEmail.includes('@') ? initialEmail.trim() : '');
  const [username, setUsername] = useState(initialEmail && !initialEmail.includes('@') ? initialEmail.trim() : '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [resetKey, setResetKey] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🛍️');
  const [ownerName, setOwnerName] = useState('');

  // OTP State
  const [otpCode, setOtpCode] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const [sentViaEmailStatus, setSentViaEmailStatus] = useState<boolean | null>(null);
  const [smtpErrorMessage, setSmtpErrorMessage] = useState<string | null>(null);

  // General loading/error states
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [executingSetup, setExecutingSetup] = useState(false);

  // Canva Onboarding Animation States
  const [animationStage, setAnimationStage] = useState(0);

  useEffect(() => {
    let interval: any;
    if (executingSetup) {
      setAnimationStage(1);
      interval = setInterval(() => {
        setAnimationStage(prev => {
          if (prev < 3) return prev + 1;
          return prev;
        });
      }, 500);
    } else if (formSuccess) {
      setAnimationStage(4);
    } else {
      setAnimationStage(0);
    }
    return () => clearInterval(interval);
  }, [executingSetup, formSuccess]);

  // Live uniqueness check state
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  useEffect(() => {
    if (isOnboarding) return;
    if (!username || username.trim().length < 3) {
      setUsernameStatus('idle');
      return;
    }
    
    setUsernameStatus('checking');
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await DataService.checkUsernameExists(username);
        if (res.exists) {
          setUsernameStatus('taken');
        } else {
          setUsernameStatus('available');
        }
      } catch (err) {
        setUsernameStatus('idle');
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [username, isOnboarding]);

  useEffect(() => {
    if (isOnboarding) return;
    if (!email || !email.includes('@')) {
      setEmailStatus('idle');
      return;
    }

    setEmailStatus('checking');
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await DataService.checkEmailExists(email);
        if (res.exists) {
          setEmailStatus('taken');
        } else {
          setEmailStatus('available');
        }
      } catch (err) {
        setEmailStatus('idle');
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [email, isOnboarding]);

  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const validateStep1 = () => {
    setFormError(null);
    if (!email || !email.includes('@')) {
      setFormError("Please enter a valid Gmail address.");
      toast.error("Please enter a valid Gmail address.");
      return false;
    }
    if (!username || username.trim().length < 3) {
      setFormError("Username must be at least 3 characters.");
      toast.error("Username must be at least 3 characters.");
      return false;
    }
    if (!password || password.trim().length < 4) {
      setFormError("PIN / Password must be at least 4 characters.");
      toast.error("PIN / Password must be at least 4 characters.");
      return false;
    }
    return true;
  };

  const handleSendOTP = async () => {
    if (!email || !email.includes('@')) {
      setFormError("Please enter a valid Gmail address.");
      toast.error("Please enter a valid Gmail address.");
      return;
    }

    setIsSendingOtp(true);
    setFormError(null);
    const toastId = toast.loading("Validating credentials...");

    try {
      // If they are registering a brand new user, continue with username/password validation before OTP is sent!
      if (!validateStep1()) {
        setIsSendingOtp(false);
        toast.dismiss(toastId);
        return;
      }

      // Pre-emptive availability checks to prevent OTP waste and downstream registration failures
      if (!isOnboarding) {
        if (username) {
          const usernameCheck = await DataService.checkUsernameExists(username);
          if (usernameCheck.exists) {
            setIsSendingOtp(false);
            toast.dismiss(toastId);
            setFormError("This username is already taken. Please choose another username.");
            toast.error("This username is already taken. Please choose another username.");
            return;
          }
        }

        const emailCheck = await DataService.checkEmailExists(email);
        if (emailCheck.exists) {
          setIsSendingOtp(false);
          toast.dismiss(toastId);
          setFormError("This Gmail address is already registered. Please go back and login or use a different Gmail.");
          toast.error("This Gmail address is already registered. Please go back and login.");
          return;
        }
      }

      toast.dismiss(toastId);
      const connToastId = toast.loading("Connecting to security gateway...");

      const res = await DataService.sendOTP(email, undefined, username);
      setIsSendingOtp(false);
      toast.dismiss(connToastId);

      if (res.success) {
        setSentViaEmailStatus(res.sentViaEmail ?? true);
        setSmtpErrorMessage(res.emailError || null);
        setResendTimer(45);
        if (res.sentViaEmail === false) {
          toast.success("Simulation master OTP generated successfully!");
        } else {
          toast.success("Security OTP dispatched successfully! Please check your email.");
        }
        setStep(2);
      } else {
        setFormError(res.message || "Failed to dispatch verification OTP.");
        toast.error(res.message);
      }
    } catch (e: any) {
      setIsSendingOtp(false);
      setFormError(e.message || "An exception occurred dispatching OTP.");
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.trim().length !== 6) {
      toast.error("Please enter a valid 6-digit OTP code");
      return;
    }

    setIsVerifyingOtp(true);
    setFormError(null);
    const toastId = toast.loading("Verifying security clearance...");

    try {
      const res = await DataService.verifyOTP(email, otpCode.trim());
      setIsVerifyingOtp(false);
      toast.dismiss(toastId);

      if (res.success) {
        setOtpVerified(true);
        toast.success("Identity verified successfully!");
        setStep(3);
      } else {
        setFormError(res.message || "Verification code failed.");
        toast.error(res.message || "Verification code failed.");
      }
    } catch (e: any) {
      setIsVerifyingOtp(false);
      toast.dismiss(toastId);
      setFormError(e.message || "Validation failed.");
    }
  };

  const executeFinalSetup = async () => {
    setExecutingSetup(true);
    setFormError(null);
    setFormSuccess(null);
    const toastId = toast.loading("Provisioning secure database tables and branding...");

    try {
      if (isOnboarding) {
        const resolvedStoreName = storeName.trim().toUpperCase() === 'AS WEB INFO' ? 'AS Web Info POS Workspace' : storeName;
        const res = await DataService.setupSystem({
          ownerEmail: email,
          username: username,
          gmailAppPassword: undefined,
          storeName: resolvedStoreName,
          storeAddress: storeAddress,
          storePhone: storePhone,
          loginPin: password,
          resetKey: resetKey
        });

        if (res.success) {
          const cleanEmailLower = email.trim().toLowerCase();
          const resolvedWorkspace = username.trim().toLowerCase() || cleanEmailLower;
          
          sessionStorage.setItem('retailpro_auth', 'true');
          sessionStorage.setItem('retailpro_auth_email', cleanEmailLower);
          sessionStorage.setItem('retailpro_active_workspace', resolvedWorkspace);
          localStorage.setItem('retailpro_auth', 'true');
          localStorage.setItem('retailpro_auth_email', cleanEmailLower);
          localStorage.setItem('retailpro_active_workspace', resolvedWorkspace);

          const nameToSet = ownerName.trim() || email.split('@')[0];
          await DataService.setShopDetails({
            name: resolvedStoreName,
            address: storeAddress.trim(),
            phone: storePhone.trim(),
            paperSize: '80mm',
            allowBelowStock: true
          });
          await DataService.setUserProfile({
            name: nameToSet,
            email: email,
            avatar: selectedAvatar
          });

          setExecutingSetup(false);
          toast.dismiss(toastId);
          setFormSuccess("Account and database setup completed successfully!");

          setTimeout(() => {
            onSuccess(email, resolvedStoreName, true);
          }, 1500);
        } else {
          setExecutingSetup(false);
          toast.dismiss(toastId);
          setFormError(res.message || "Failed to finalize system configurations.");
          toast.error(res.message);
        }
      } else {
        const resolvedStoreName = storeName.trim().toUpperCase() === 'AS WEB INFO' ? 'AS Web Info POS Workspace' : storeName;
        const res = await DataService.register({
          email: email,
          password: password,
          username: username,
          storeName: resolvedStoreName,
          storeAddress: storeAddress,
          storePhone: storePhone,
          resetKey: resetKey
        });

        if (res.success) {
          const cleanEmailLower = email.trim().toLowerCase();
          const resolvedWorkspace = username.trim().toLowerCase() || cleanEmailLower;
          
          sessionStorage.setItem('retailpro_auth', 'true');
          sessionStorage.setItem('retailpro_auth_email', cleanEmailLower);
          sessionStorage.setItem('retailpro_active_workspace', resolvedWorkspace);
          localStorage.setItem('retailpro_auth', 'true');
          localStorage.setItem('retailpro_auth_email', cleanEmailLower);
          localStorage.setItem('retailpro_active_workspace', resolvedWorkspace);

          // Add this account to saved accounts list automatically so user switcher has it immediately
          try {
            const savedAccountsRaw = localStorage.getItem('retailpro_saved_accounts');
            const savedAccs = savedAccountsRaw ? JSON.parse(savedAccountsRaw) : [];
            const newSavedAcc = {
              username: username.trim() || email.trim(),
              password: password.trim(),
              name: username.trim() || email.split('@')[0],
              email: email.trim(),
              role: 'Admin',
              avatar: selectedAvatar || ''
            };
            const filtered = savedAccs.filter((a: any) => a.username.toLowerCase() !== newSavedAcc.username.toLowerCase());
            localStorage.setItem('retailpro_saved_accounts', JSON.stringify([...filtered, newSavedAcc]));
          } catch (e) {}

          const nameToSet = ownerName.trim() || email.split('@')[0];
          await DataService.setShopDetails({
            name: resolvedStoreName,
            address: storeAddress.trim(),
            phone: storePhone.trim(),
            paperSize: '80mm',
            allowBelowStock: true
          });
          await DataService.setUserProfile({
            name: nameToSet,
            email: email,
            avatar: selectedAvatar
          });

          setExecutingSetup(false);
          toast.dismiss(toastId);
          setFormSuccess("Custom account registered successfully!");

          setTimeout(() => {
            onSuccess(email, resolvedStoreName, true);
          }, 1500);
        } else {
          setExecutingSetup(false);
          toast.dismiss(toastId);
          setFormError(res.message || "Failed to register custom store credentials.");
          toast.error(res.message);
        }
      }
    } catch (e: any) {
      setExecutingSetup(false);
      toast.dismiss(toastId);
      setFormError(e.message || "Unexpected exception during setup execution.");
      toast.error(e.message);
    }
  };

  return (
    <div className="w-full flex flex-col pt-2 pb-14 sm:pb-6 relative" id="registration-wizard-card">
      
      {/* Real Instagram/Facebook style Step Progress Indicator */}
      <div className="mb-8 px-1">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center flex-1 last:flex-initial">
              <div className="flex flex-col items-center relative">
                <div className={`h-7 w-7 sm:h-9 sm:w-9 rounded-full flex items-center justify-center font-bold text-[10px] sm:text-xs border-2 transition-all duration-300 ${
                  step === i 
                    ? 'bg-indigo-600 text-white border-indigo-600 ring-4 ring-indigo-100 shadow-md scale-110' 
                    : step > i || (otpVerified && i === 2)
                    ? 'bg-emerald-500 text-white border-emerald-500' 
                    : 'bg-white text-slate-400 border-slate-200'
                }`}>
                  {step > i || (otpVerified && i === 2) ? "✓" : i}
                </div>
                <span className="hidden sm:block text-[10px] font-black uppercase tracking-wider text-slate-400 mt-2 whitespace-nowrap absolute top-9">
                  {i === 1 ? 'Credentials' : i === 2 ? 'Verify OTP' : i === 3 ? 'Profile' : i === 4 ? 'Store Brand' : 'Conclude'}
                </span>
              </div>
              {i < 5 && (
                <div className={`h-[3px] flex-1 mx-1 sm:mx-3 rounded-full transition-colors duration-300 ${
                  step > i ? 'bg-emerald-500' : 'bg-slate-100'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {formError && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold leading-relaxed animate-fade-in flex items-start gap-2 text-left">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
          <div>
            <p className="font-extrabold uppercase tracking-wide mb-1 text-rose-800">Registration Conflict</p>
            <p>{formError}</p>
          </div>
        </div>
      )}

      {formSuccess && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-xs font-semibold leading-relaxed animate-fade-in flex items-start gap-2 text-left">
          <Check className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
          <div>
            <p className="font-extrabold uppercase tracking-wide mb-1 text-emerald-800">Success completed</p>
            <p>{formSuccess}</p>
          </div>
        </div>
      )}

      {/* Step Cards with clean slide-in feels */}
      <div className="bg-white rounded-2xl p-1">
        
        {/* STEP 1: INITIAL PASSWORDS & CREDENTIALS */}
        {step === 1 && (
          <div className="space-y-5 text-left animate-fade-in">
            {/* REGISTRATION / ONBOARDING SETUP STEP 1 FORM */}
            <div className="space-y-5 animate-fade-in">
              <div className="pb-3 border-b border-slate-100">
                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-1.5">
                  <Sparkles className="h-3 w-3 inline" /> Step 1 of 5
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Admin & Security Credentials</h3>
                <p className="text-xs text-slate-400 mt-1">Setup the account user ID and password. This configures sync parameters globally.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10.5px] font-black uppercase text-slate-400 tracking-wider">Primary Gmail ID</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                    <Input 
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setFormError(null);
                      }}
                      placeholder="e.g. storeowner@gmail.com"
                      className="pl-11 h-12 border-slate-200 rounded-xl font-semibold text-sm focus-visible:ring-indigo-600 focus-visible:border-indigo-600"
                      required
                    />
                  </div>
                  {emailStatus === 'checking' && (
                    <span className="text-[10px] text-indigo-500 font-semibold block mt-1 animate-pulse">
                      ⏳ Checking Gmail availability...
                    </span>
                  )}
                  {emailStatus === 'taken' && (
                    <span className="text-[10px] text-rose-500 font-bold block mt-1">
                      ⚠️ This Gmail is already registered. Please go back and login.
                    </span>
                  )}
                  {emailStatus === 'available' && (
                    <span className="text-[10px] text-emerald-600 font-semibold block mt-1">
                      ✅ Beautiful, this Gmail address is brand new!
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10.5px] font-black uppercase text-slate-400 tracking-wider font-sans">Login Username / Custom ID</Label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                      <Input 
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())}
                        placeholder="e.g. prabhjeet or admin"
                        className="pl-11 h-12 border-slate-200 rounded-xl font-bold text-sm focus-visible:ring-indigo-600"
                        required
                      />
                    </div>
                    {usernameStatus === 'checking' && (
                      <span className="text-[10px] text-indigo-500 font-semibold block mt-1 animate-pulse">
                        ⏳ Checking username availability...
                      </span>
                    )}
                    {usernameStatus === 'taken' && (
                      <span className="text-[10px] text-rose-500 font-bold block mt-1">
                        ❌ This username is already taken. Choose another name.
                      </span>
                    )}
                    {usernameStatus === 'available' && (
                      <span className="text-[10px] text-emerald-600 font-semibold block mt-1">
                        ✅ Perfect! This custom ID is available.
                      </span>
                    )}
                    {usernameStatus === 'idle' && (
                      <span className="text-[10px] text-indigo-600 font-semibold block mt-1">
                        💡 You can log in on any device using this Custom ID or your Gmail!
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10.5px] font-black uppercase text-slate-400 tracking-wider font-sans">Admin Password / PIN</Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                      <Input 
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="e.g. ••••••"
                        className="pl-11 pr-11 h-12 border-slate-200 rounded-xl font-mono text-sm tracking-widest focus-visible:ring-indigo-600"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => !p)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer bg-transparent border-none outline-none"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <p className="text-[10.5px] text-slate-500 leading-normal mt-1 bg-indigo-50/25 border border-indigo-100/40 rounded-xl p-3.5 font-sans">
                    🔒 <strong>Pre-secured Account Validation:</strong> Verification emails and security OTP codes are dispatched securely from our official, pre-configured Gmail provider. Your personal app passwords are never required.
                  </p>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row justify-between gap-2.5 sm:gap-3 font-sans">
                {onCancel && (
                  <Button type="button" variant="ghost" onClick={onCancel} className="w-full sm:w-auto h-12 px-6 font-bold text-slate-500 rounded-xl">
                    Back to Login
                  </Button>
                )}
                <Button 
                  type="button"
                  onClick={handleSendOTP} 
                  className="w-full sm:flex-1 h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold uppercase text-xs tracking-wider rounded-xl gap-2 cursor-pointer shadow-lg active:scale-[0.99] transition-all"
                  disabled={isSendingOtp}
                >
                  {isSendingOtp ? 'Sending code...' : 'Verify Gmail Address'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: VERIFICATION GATEWAY */}
        {step === 2 && (
          <div className="space-y-5 text-left animate-fade-in">
            <div className="pb-3 border-b border-indigo-50">
              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-1.5">
                🛡️ Step 2 of 5
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Security Gateway Challenge</h3>
              <p className="text-xs text-slate-400 mt-1 font-sans">We’re securing your POS backend credentials. Please provide the 6-digit verification pin sent to your email.</p>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-[11.5px] font-medium leading-relaxed text-slate-700 space-y-2 font-sans">
              <div className="flex items-center gap-2 text-indigo-700 font-black uppercase text-[10px] tracking-wider">
                <Shield className="h-4 w-4 inline text-indigo-600 animate-pulse" /> Identity Verification
              </div>
              <p>
                A secure login authorization request containing a unique 6-digit passcode has been prepared for <strong className="font-extrabold text-slate-900">{email}</strong>.
              </p>
              <p className="text-[11px] leading-normal text-slate-500">
                Please check your email inbox (including the spam or junk folder) for "DO BILL Verification Code" to retrieve your OTP and authenticate.
              </p>
            </div>

            {sentViaEmailStatus === false && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-[11.5px] font-medium leading-relaxed text-amber-800 space-y-1.5 font-sans animate-fade-in">
                <div className="flex items-center gap-1.5 text-amber-700 font-black uppercase text-[10px] tracking-wider">
                  <span>💡</span> Sandbox & Offline Bypass Notice
                </div>
                <p>
                  Outgoing email dispatch failed (likely due to sandbox port blocks). For testing:
                </p>
                <p className="font-semibold text-amber-900">
                  Please enter the fallback security code: <strong className="text-amber-950 bg-amber-100/80 border border-amber-200 px-2 py-0.5 rounded font-black tracking-widest text-xs">123456</strong> to verify immediately!
                </p>
              </div>
            )}



            <div className="space-y-3 py-1">
              <div className="space-y-1.5">
                <Label className="text-[10.5px] font-black uppercase text-slate-400 tracking-wider text-center block font-sans">Enter 6-Digit OTP Code</Label>
                <div className="flex justify-center max-w-sm mx-auto">
                  <Input 
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="h-14 font-mono font-black text-2xl text-center border-slate-300 rounded-2xl tracking-widest focus-visible:ring-emerald-500 focus-visible:border-emerald-500 focus:scale-[1.01] transition-transform"
                  />
                </div>
              </div>

              <div className="flex justify-center pt-2">
                <Button 
                  size="sm"
                  variant="ghost" 
                  disabled={resendTimer > 0 || isSendingOtp} 
                  onClick={handleSendOTP}
                  className="font-black text-[11px] text-indigo-600 uppercase tracking-widest hover:bg-slate-50 hover:text-indigo-700 cursor-pointer"
                >
                  {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend Verification Code'}
                </Button>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-2.5 sm:gap-3">
              <Button 
                variant="outline" 
                onClick={() => setStep(1)} 
                className="w-full sm:w-auto h-12 font-bold text-slate-600 border-slate-200 rounded-xl px-5 flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" /> Edit Email
              </Button>
              <Button 
                onClick={handleVerifyOTP} 
                className="w-full sm:flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold uppercase text-xs tracking-wider rounded-xl gap-2 cursor-pointer shadow-lg active:scale-[0.99] transition-all"
                disabled={isVerifyingOtp}
              >
                {isVerifyingOtp ? "Verifying Token..." : "Confirm Code & Continue"}
                <Check className="h-4 w-4 inline" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: AVATAR & OWNER PROFILE */}
        {step === 3 && (
          <div className="space-y-5 text-left animate-fade-in">
            <div className="pb-3 border-b border-slate-100">
              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-1.5">
                ✨ Step 3 of 5
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Personalize Your Profile</h3>
              <p className="text-xs text-slate-400 mt-1">Make your store avatar and personal name prominent. Pick your brand's digital icon.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10.5px] font-black uppercase text-slate-400 tracking-wider">Full Name</Label>
                <Input 
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                  placeholder="Full Name"
                  className="h-12 border-slate-200 rounded-xl font-bold text-sm"
                  required
                />
              </div>

              {/* Avatar Dock Selection */}
              <div className="space-y-3">
                <div className="flex flex-col gap-0.5">
                  <Label className="text-[10.5px] font-black uppercase text-slate-400 tracking-wider">Select Digital Avatar / Brand Icon</Label>
                  <span className="text-[10px] text-slate-400">Keep it in a good format, as it can be any custom emoji, logo initials, or preset avatar.</span>
                </div>
                <div className="grid grid-cols-3 min-[400px]:grid-cols-4 sm:grid-cols-8 gap-2">
                  {PRESET_AVATARS.map((av) => (
                    <button
                      key={av.emoji}
                      type="button"
                      onClick={() => setSelectedAvatar(av.emoji)}
                      className={`h-14 rounded-2xl flex flex-col items-center justify-center p-2 border-2 transition-all cursor-pointer relative ${
                        selectedAvatar === av.emoji 
                          ? `${av.color} border-indigo-600 scale-110 shadow-md ring-2 ring-indigo-200` 
                          : 'border-slate-100 hover:border-slate-300 hover:scale-105 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-2xl">{av.emoji}</span>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-tight truncate w-full mt-1.5">{av.label}</span>
                      {selectedAvatar === av.emoji && (
                        <div className="absolute -top-1.5 -right-1 bg-indigo-600 text-white rounded-full p-0.5 shadow-sm">
                          <Check className="h-3 w-3 stroke-[3px]" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-50 border border-slate-100 p-3 rounded-2xl mt-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Custom Avatar Entry</Label>
                    <p className="text-[10.5px] text-slate-400 font-medium">Type any custom emoji (e.g. 💻, 🔥) or brand short initials (e.g. DB, HQ).</p>
                  </div>
                  <Input 
                    type="text" 
                    maxLength={4} 
                    value={selectedAvatar} 
                    onChange={(e) => setSelectedAvatar(e.target.value)} 
                    placeholder="e.g. 🚀" 
                    className="h-10 text-center font-bold text-lg max-w-[120px] bg-white border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-2.5 sm:gap-3">
              <Button 
                variant="outline" 
                onClick={() => setStep(2)} 
                className="w-full sm:w-auto h-12 font-bold text-slate-600 border-slate-200 rounded-xl px-5"
              >
                Back
              </Button>
              <Button 
                onClick={() => setStep(4)} 
                className="w-full sm:flex-1 h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold uppercase text-xs tracking-wider rounded-xl gap-2 cursor-pointer shadow-lg"
              >
                Next: Store Profile
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: SHOP BRAND DETAILS */}
        {step === 4 && (
          <div className="space-y-5 text-left animate-fade-in">
            <div className="pb-3 border-b border-indigo-50">
              <span className="inline-flex items-center gap-1 bg-violet-50 text-violet-700 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-1.5">
                🏪 Step 4 of 5
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Store Branding & Location</h3>
              <p className="text-xs text-slate-400 mt-1">Specify your showroom and POS receipt information. This prints automatically on sales.</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10.5px] font-black uppercase text-slate-400 tracking-wider">Store Name</Label>
                  <div className="relative">
                    <Store className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                    <Input 
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="Store Name"
                      className="pl-11 h-12 border-slate-200 rounded-xl font-black text-sm uppercase focus-visible:ring-indigo-600"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10.5px] font-black uppercase text-slate-400 tracking-wider">Store Direct Contact Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                    <Input 
                      value={storePhone}
                      onChange={(e) => setStorePhone(e.target.value.replace(/[^0-9+\s-]/g, ''))}
                      placeholder="e.g. +91 9450000000"
                      className="pl-11 h-12 border-slate-200 rounded-xl font-bold text-sm focus-visible:ring-indigo-600"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10.5px] font-black uppercase text-slate-400 tracking-wider">Store Headquarters Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400 font-bold" />
                  <Input 
                    value={storeAddress}
                    onChange={(e) => setStoreAddress(e.target.value)}
                    placeholder="e.g. BADA BAZAR, JHANSI"
                    className="pl-11 h-12 border-slate-200 rounded-xl font-bold text-sm uppercase focus-visible:ring-indigo-600"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-2.5 sm:gap-3">
              <Button 
                variant="outline" 
                onClick={() => setStep(3)} 
                className="w-full sm:w-auto h-12 font-bold text-slate-600 border-slate-200 rounded-xl px-5"
              >
                Back
              </Button>
              <Button 
                onClick={() => setStep(5)} 
                className="w-full sm:flex-1 h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold uppercase text-xs tracking-wider rounded-xl gap-2 cursor-pointer shadow-lg"
              >
                Next: Summary Confirm
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 5: PROVISION SUMMARY & FINAL CONFUSION BANISHING */}
        {step === 5 && (
          <div className="space-y-5 text-left animate-fade-in">
            <div className="pb-3 border-b border-emerald-50">
              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-1.5">
                🎯 Ready to Deploy
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Review Account Deployment</h3>
              <p className="text-xs text-slate-400 mt-1">Almost done! Confirm details below to sync database partitions.</p>
            </div>

            <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-inner bg-slate-50/50">
              <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
                <span className="font-extrabold text-[11px] uppercase tracking-wider font-sans">DO BILL Database Profile</span>
                <span className="text-[18px]">{selectedAvatar}</span>
              </div>
              <div className="p-4 space-y-2.5 text-xs text-slate-600 font-sans">
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="font-bold text-slate-400">Admin Email ID:</span>
                  <span className="font-mono font-bold text-slate-800">{email}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="font-bold text-slate-400">Account Username:</span>
                  <span className="font-bold text-slate-800">{username}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="font-bold text-slate-400">Personal Password/PIN:</span>
                  <span className="font-mono font-black text-indigo-600">••••••</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="font-bold text-slate-400">Store Title:</span>
                  <span className="font-extrabold text-slate-800 uppercase">{storeName}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="font-bold text-slate-400">Phone Contact:</span>
                  <span className="font-semibold text-slate-800">{storePhone}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="font-bold text-slate-400">Headquarters Location:</span>
                  <span className="font-bold text-slate-800 uppercase truncate max-w-[200px]">{storeAddress}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 flex items-start gap-3 border border-slate-800">
              <Laptop className="h-6 w-6 text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5 font-sans">
                <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest">💻 Multi-PC Cross-Device Synced Configuration</h4>
                <p className="text-[11px] text-slate-300 leading-normal">
                  This owner database partition is securely mapped on the server. You can sign into this identical account on another office computer or tablet simultaneously using your email <strong>{email}</strong> or username <strong>{username}</strong> and password PIN!
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5 sm:gap-3">
              <Button 
                variant="outline" 
                onClick={() => setStep(4)} 
                className="w-full sm:w-auto h-12 font-bold text-slate-600 border-slate-200 rounded-xl px-5"
                disabled={executingSetup}
              >
                Back
              </Button>
              <Button 
                onClick={executeFinalSetup} 
                className="w-full sm:flex-1 h-12 bg-indigo-600 hover:bg-slate-950 text-white font-extrabold uppercase text-xs tracking-wider rounded-xl gap-2 cursor-pointer shadow-lg active:scale-[0.99] transition-all"
                disabled={executingSetup}
              >
                {executingSetup ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                    Provisioning Account Setup...
                  </>
                ) : (
                  "Finalize & Initialize Store Setup"
                )}
              </Button>
            </div>
          </div>
        )}

      </div>

      {/* CANVA-STYLE HIGH FIDELITY ACCOUNT CREATION ANIMATION OVERLAY */}
      <AnimatePresence>
        {(executingSetup || formSuccess) && (
          <SparklesCelebration active={true} duration={6000} />
        )}
      </AnimatePresence>

    </div>
  );
}
