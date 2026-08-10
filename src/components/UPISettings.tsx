import React, { useState, useEffect } from 'react';
import { DataService } from '@/services/dataService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QrCode, ShieldCheck, Lock, Save, Printer, HardDrive, TrendingUp, Minus, Plus } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { getCurrentUserRole, defineAbilityFor } from '@/services/abilityService';

export default function UPISettings() {
  const [upiId, setUpiId] = useState('');
  const [isPrinterEnabled, setIsPrinterEnabled] = useState(true);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [tempUpiId, setTempUpiId] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [dbStats, setDbStats] = useState<{ oldest: string; count: number } | null>(null);
  const [userRole, setUserRole] = useState<'Admin' | 'Manager' | 'Cashier'>('Cashier');
  const ability = React.useMemo(() => defineAbilityFor(userRole), [userRole]);

  const loadStats = async () => {
    try {
      const sales = await DataService.getSales();
      if (Array.isArray(sales) && sales.length > 0) {
        const sorted = [...sales].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setDbStats({ oldest: sorted[0].createdAt, count: sales.length });
      } else {
        setDbStats({ oldest: 'No records yet', count: 0 });
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const load = async () => {
      const upi = await DataService.getUPIId();
      setUpiId(upi);
      const printer = await DataService.isPrinterEnabled();
      setIsPrinterEnabled(printer);

      const role = await getCurrentUserRole();
      setUserRole(role);
      await loadStats();
    };
    load();
  }, []);

  const handleSaveAttempt = (e: React.FormEvent) => {
    e.preventDefault();
    setTempUpiId(upiId);
    setIsPromptOpen(true);
  };

  const handleConfirmSave = async (e: React.FormEvent) => {
    e.preventDefault();
    let isValid = false;
    try {
      const loginRes = await DataService.login(adminUsername, adminPassword);
      if (loginRes.success && (loginRes.role === 'Admin' || loginRes.role === 'Owner')) {
        isValid = true;
      }
    } catch (err) {
      // Fallback
    }

    if (isValid) {
       try {
        await DataService.setUPIId(upiId);
        await DataService.setPrinterEnabled(isPrinterEnabled);

        // Update local storage synchronously for directPrintService
        localStorage.setItem('retailpro_direct_print_enabled', isPrinterEnabled ? 'true' : 'false');

        toast.success('Configuration updated successfully');
        setIsPromptOpen(false);
        setAdminUsername('');
        setAdminPassword('');
      } catch (err) {
        toast.error('Failed to save settings');
      }
    } else {
      toast.error('Invalid Admin Credentials');
    }
  };

  if (!ability.can('manage', 'UPISettings')) {
    return (
      <div className="flex flex-col items-center justify-center p-8 sm:p-20 text-center min-h-[60vh] max-w-xl mx-auto space-y-6">
        <div className="h-20 w-20 bg-amber-50 text-amber-600 rounded-[2rem] flex items-center justify-center shadow-xl shadow-amber-250/10 border border-amber-100">
          <Lock className="h-10 w-10 shrink-0" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-black tracking-tight text-slate-800">Access Restricted</h3>
          <p className="text-slate-500 font-medium text-sm leading-relaxed">
            UPI Merchant Configuration, printing hardware controls and database health metrics are restricted to <b>Administrators</b> only.
          </p>
        </div>
        <div className="px-4 py-2 bg-slate-100 text-slate-500 rounded-full text-xs font-bold uppercase tracking-wider">
          Current Role: {userRole}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <Card className="border-none shadow-xl">
        <CardHeader className="bg-primary/5 pb-8">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <QrCode className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Terminal Configuration</CardTitle>
              <CardDescription>Configure UPI payments and printing hardware</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-8">
          {!isPromptOpen ? (
            <form onSubmit={handleSaveAttempt} className="space-y-8">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="upiId" className="text-sm font-semibold text-slate-600">Merchant UPI ID</Label>
                  <div className="relative">
                    <Input
                      id="upiId"
                      value={upiId ?? ''}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="e.g. yourname@okaxis"
                      className="h-12 pl-4 text-lg font-medium border-slate-200 focus:ring-primary/20"
                      required
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 italic px-1">This ID will be used for QR code generation.</p>
                </div>

                <div className="pt-6 border-t border-slate-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <Printer className="h-5 w-5 text-primary" />
                        Thermal Printer System
                      </Label>
                      <p className="text-xs text-slate-500">Enable and configure receipt and barcode physical printing</p>
                    </div>
                    <Switch
                      checked={isPrinterEnabled}
                      onCheckedChange={(checked) => setIsPrinterEnabled(checked)}
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full h-12 text-base font-bold gap-2">
                <Save className="h-5 w-5" />
                Save Terminal Settings
              </Button>

              <div className="pt-4 border-t border-slate-100 flex flex-col gap-4">
                {dbStats && (
                  <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Database Health</span>
                      <ShieldCheck className="h-3 w-3 text-blue-400" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Oldest Record</p>
                        <p className="text-xs font-black text-slate-700 leading-tight">
                          {dbStats.oldest !== 'No records yet' ? new Date(dbStats.oldest).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : dbStats.oldest}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Status</p>
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">
                          Optimized
                        </p>
                      </div>
                    </div>
                    <p className="text-[9px] text-slate-400 leading-relaxed italic border-t border-blue-100 pt-2">
                      Automatic Retention: 2 saal se puraani transaction history dynamically ek-ek karke automatic delete hoti hai (Rolling Day-by-Day). Products bilkul delete nahi honge.
                    </p>
                  </div>
                )}
              </div>
            </form>
          ) : (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-3 text-amber-700 mb-4">
                  <Lock className="h-5 w-5" />
                  <span className="font-bold underline">Admin Authentication Required</span>
                </div>
                
                <form onSubmit={handleConfirmSave} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-500">Admin Username</Label>
                    <Input 
                      value={adminUsername ?? ''}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder="Enter admin username"
                      className="bg-white"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-500">Admin Password</Label>
                    <Input 
                      type="password"
                      value={adminPassword ?? ''}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-white"
                      required
                    />
                  </div>
                  
                  <div className="flex gap-3 pt-2">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => setIsPromptOpen(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1 font-bold">
                      Confirm Changes
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
