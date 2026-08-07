import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart, 
  Pie,
  LineChart,
  Line
} from 'recharts';
import { DataService } from '@/services/dataService';
import { format, startOfDay, subDays, eachDayOfInterval, isWithinInterval, endOfDay, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  ShoppingBag, 
  IndianRupee, 
  PieChart as PieChartIcon, 
  Calendar, 
  Lock, 
  Package, 
  ClipboardList, 
  ArrowDownCircle, 
  DollarSign,
  Printer,
  ChevronRight,
  User,
  ShoppingBag as BagIcon,
  BookOpen
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Product, Sale, Purchase } from '@/types';
import { getCurrentUserRole, defineAbilityFor } from '@/services/abilityService';
import { getTranslation, LanguageType } from '@/utils/lang';
import { toast } from 'sonner';

export default function Reports() {
  const [lang, setLang] = useState<LanguageType>(() => {
    return (localStorage.getItem('retailpro_lang') as LanguageType) || 'en';
  });

  useEffect(() => {
    const handleUpdate = () => {
      const stored = (localStorage.getItem('retailpro_lang') as LanguageType) || 'en';
      setLang(stored);
    };
    return DataService.subscribe(handleUpdate);
  }, []);

  const t = useMemo(() => getTranslation(lang), [lang]);

  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [userRole, setUserRole] = useState<'Admin' | 'Manager' | 'Cashier'>('Cashier');
  const ability = useMemo(() => defineAbilityFor(userRole), [userRole]);
  
  // Tab control states
  const [activeTab, setActiveTab] = useState<'overview' | 'product' | 'low-stock'>('overview');
  const [salesAggMode, setSalesAggMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const refreshData = async () => {
    try {
      const [s, p, pt] = await Promise.all([
        DataService.getSales(),
        DataService.getProducts(),
        DataService.getPurchases()
      ]);
      setSales(Array.isArray(s) ? s : []);
      setProducts(Array.isArray(p) ? p : []);
      setPurchases(Array.isArray(pt) ? pt : []);
    } catch (e) {
      console.error("Reports load error:", e);
      setSales([]);
      setProducts([]);
      setPurchases([]);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    refreshData();
    getCurrentUserRole().then(setUserRole);
    return DataService.subscribe(refreshData);
  }, []);

  // Standard date filtering
  const [startDate, setStartDate] = useState<string>(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const filteredSales = useMemo(() => {
    try {
      if (!startDate || !endDate) return sales;
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return sales;
      }
      return sales.filter(sale => {
        try {
          const saleDate = new Date(sale.createdAt);
          if (isNaN(saleDate.getTime())) return false;
          return isWithinInterval(saleDate, {
            start: startOfDay(start),
            end: endOfDay(end)
          });
        } catch {
          return false;
        }
      });
    } catch {
      return sales;
    }
  }, [sales, startDate, endDate]);

  const filteredPurchases = useMemo(() => {
    try {
      if (!startDate || !endDate) return purchases;
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return purchases;
      }
      return purchases.filter(p => {
        try {
          const pDate = new Date(p.createdAt);
          if (isNaN(pDate.getTime())) return false;
          return pDate >= startOfDay(start) && pDate <= endOfDay(end);
        } catch {
          return false;
        }
      });
    } catch {
      return purchases;
    }
  }, [purchases, startDate, endDate]);

  const stats = useMemo(() => {
    const totalRevenue = filteredSales.reduce((acc, s) => acc + s.grandTotal, 0);
    const totalProfit = filteredSales.reduce((acc, s) => {
      const saleProfit = (s.items || []).reduce((itemAcc, item) => {
        const product = products.find(p => p.id === item.id);
        const margin = item.sellingPrice - (product?.purchasePrice || 0);
        return itemAcc + (margin * item.quantity);
      }, 0);
      return acc + saleProfit;
    }, 0);

    return { totalRevenue, totalProfit, totalOrders: filteredSales.length };
  }, [filteredSales, products]);

  // Daily, Weekly, and Monthly Sales aggregators
  const periodicTrendData = useMemo(() => {
    try {
      const sDate = startOfDay(new Date(startDate));
      const eDate = endOfDay(new Date(endDate));
      if (isNaN(sDate.getTime()) || isNaN(eDate.getTime()) || sDate > eDate) {
        return [];
      }

      if (salesAggMode === 'weekly') {
        const weeks = eachWeekOfInterval({ start: sDate, end: eDate });
        return weeks.map(week => {
          const weekStr = `Wk ${format(week, 'ww, MMM yyyy')}`;
          const weekSales = filteredSales.filter(s => {
            const d = new Date(s.createdAt);
            return d >= week && d < subDays(week, -7);
          });
          const itemsCount = weekSales.reduce((sum, s) => sum + (s.items || []).reduce((iSum, item) => iSum + item.quantity, 0), 0);
          return {
            name: weekStr,
            amount: weekSales.reduce((acc, s) => acc + s.grandTotal, 0),
            itemsSold: itemsCount
          };
        });
      }

      if (salesAggMode === 'monthly') {
        const months = eachMonthOfInterval({ start: sDate, end: eDate });
        return months.map(month => {
          const monthStr = format(month, 'MMM yyyy');
          const monthSales = filteredSales.filter(s => {
            const d = new Date(s.createdAt);
            return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
          });
          const itemsCount = monthSales.reduce((sum, s) => sum + (s.items || []).reduce((iSum, item) => iSum + item.quantity, 0), 0);
          return {
            name: monthStr,
            amount: monthSales.reduce((acc, s) => acc + s.grandTotal, 0),
            itemsSold: itemsCount
          };
        });
      }

      // Default Daily Trend
      const intervalDays = eachDayOfInterval({ start: sDate, end: eDate });
      return intervalDays.map(date => {
        const dayStr = format(date, 'yyyy-MM-dd');
        const daySales = filteredSales.filter(s => format(new Date(s.createdAt), 'yyyy-MM-dd') === dayStr);
        const itemsCount = daySales.reduce((sum, s) => sum + (s.items || []).reduce((iSum, item) => iSum + item.quantity, 0), 0);
        return {
          name: format(date, 'MMM dd'),
          amount: daySales.reduce((acc, s) => acc + s.grandTotal, 0),
          itemsSold: itemsCount
        };
      });
    } catch (err) {
      console.error("periodicTrendData error:", err);
      return [];
    }
  }, [filteredSales, startDate, endDate, salesAggMode]);

  // Product-wise Sales and Profit estimates
  const productWiseSales = useMemo(() => {
    const record: Record<string, { id: string; name: string; barcode: string; qtySold: number; revenue: number; cogs: number; profit: number; category: string }> = {};
    
    // Seed records with master products to show zero-sales garment items too
    products.forEach(p => {
      record[p.id] = {
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        qtySold: 0,
        revenue: 0,
        cogs: 0,
        profit: 0,
        category: p.category || 'Other'
      };
    });

    filteredSales.forEach(s => {
      (s.items || []).forEach(item => {
        if (!record[item.id]) {
          record[item.id] = {
            id: item.id,
            name: item.name,
            barcode: item.barcode || 'N/A',
            qtySold: 0,
            revenue: 0,
            cogs: 0,
            profit: 0,
            category: item.category || 'Other'
          };
        }
        const masterProd = products.find(p => p.id === item.id);
        const buyPrice = masterProd?.purchasePrice || item.purchasePrice || 0;
        
        record[item.id].qtySold += item.quantity;
        record[item.id].revenue += (item.sellingPrice * item.quantity);
        record[item.id].cogs += (buyPrice * item.quantity);
        record[item.id].profit += ((item.sellingPrice - buyPrice) * item.quantity);
      });
    });

    return Object.values(record).sort((a, b) => b.qtySold - a.qtySold);
  }, [filteredSales, products]);

  // Low stock garments list (Stock <= reorder level)
  const lowStockProducts = useMemo(() => {
    return products.filter(p => p.stockQuantity <= p.reorderLevel);
  }, [products]);

  // Category share calculation
  const categoryDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    filteredSales.forEach(s => {
      (s.items || []).forEach(item => {
        const product = products.find(p => p.id === item.id);
        const cat = item.category || product?.category || 'Standard';
        dist[cat] = (dist[cat] || 0) + (item.sellingPrice * item.quantity);
      });
    });
    return Object.entries(dist).map(([name, value]) => ({ name, value }));
  }, [filteredSales, products]);

  // Paymentmode Share
  const paymentStats = useMemo(() => {
    const upiTotal = filteredSales.filter(s => s.paymentMode === 'upi').reduce((acc, s) => acc + s.grandTotal, 0);
    const cashTotal = filteredSales.filter(s => s.paymentMode === 'cash').reduce((acc, s) => acc + s.grandTotal, 0);
    return [
      { name: 'Cash', value: cashTotal },
      { name: 'UPI', value: upiTotal }
    ];
  }, [filteredSales]);

  const handlePrintReport = async () => {
    const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI?.isElectron;
    const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.() === true;

    if (isElectron || isCapacitor) {
      const element = document.getElementById('printable-report-area');
      if (element) {
        // Clone the element so we don't mutate the live page
        const clone = element.cloneNode(true) as HTMLElement;
        // Remove all no-print elements from the clone
        clone.querySelectorAll('.no-print').forEach(el => el.remove());
        
        // Grab the HTML
        const reportHTML = clone.innerHTML;
        
        // Wrap in a beautiful standard A4 print layout
        const fullHTML = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>Reports Statement</title>
              <script src="https://cdn.tailwindcss.com"></script>
              <style>
                @media print, screen {
                  @page {
                    size: A4 portrait;
                    margin: 15mm !important;
                  }
                  body {
                    background: white !important;
                    color: black !important;
                    font-family: system-ui, -apple-system, sans-serif !important;
                    padding: 20px;
                  }
                }
              </style>
            </head>
            <body>
              <div class="space-y-6">
                <div class="border-b pb-4 mb-6">
                  <h1 class="text-3xl font-black text-slate-800 tracking-tight">DoBill Store Reports & Statements</h1>
                  <p class="text-slate-500 font-medium text-sm mt-1">Generated on: ${new Date().toLocaleString()}</p>
                  <p class="text-slate-500 font-medium text-xs">Date Range: ${startDate} to ${endDate}</p>
                </div>
                ${reportHTML}
              </div>
            </body>
          </html>
        `;
        
        if (isElectron) {
          const toastId = toast.loading("🖨️ Printing report silently...");
          try {
            await (window as any).electronAPI.printSilent(fullHTML);
            toast.dismiss(toastId);
            toast.success("Report Printed Successfully!");
          } catch (err: any) {
            toast.dismiss(toastId);
            console.error("Electron print error:", err);
            toast.error("Failed to print silently. Ensure default printer is connected.");
          }
        } else if (isCapacitor) {
          const toastId = toast.loading("🖨️ Opening native print manager...");
          try {
            const { universalPrintHTML } = await import('@/services/directPrintService');
            const res = await universalPrintHTML(fullHTML);
            toast.dismiss(toastId);
            if (res.success) {
              toast.success("Report Printed Successfully!");
            } else {
              toast.error(res.message);
            }
          } catch (err: any) {
            toast.dismiss(toastId);
            console.error("Capacitor print error:", err);
            toast.error(`Print failed: ${err.message || err}`);
          }
        }
      }
    } else {
      window.print();
    }
  };

  if (!ability.can('read', 'Reports')) {
    return (
      <div className="flex flex-col items-center justify-center p-8 sm:p-20 text-center min-h-[60vh] max-w-xl mx-auto space-y-6">
        <div className="h-20 w-20 bg-amber-50 text-amber-600 rounded-[2rem] flex items-center justify-center shadow-xl shadow-amber-250/10 border border-amber-100">
          <Lock className="h-10 w-10 shrink-0" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-black tracking-tight text-slate-800">Access Restricted</h3>
          <p className="text-slate-500 font-medium text-sm leading-relaxed">
            Report generation, transaction audit logs and financial statements are available strictly for Store Owners and Managers.
          </p>
        </div>
        <div className="px-4 py-2 bg-slate-100 text-slate-500 rounded-full text-xs font-bold font-mono">
          Current Role: {userRole}
        </div>
      </div>
    );
  }

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444'];
  const PAYMENT_COLORS = ['#fbbf24', '#10b981'];

  return (
    <div id="printable-report-area" className="space-y-6 pb-20">
      
      {/* Date Filter & Control strip */}
      <Card className="border-none shadow-sm shadow-slate-200/50 bg-white p-6 rounded-3xl no-print">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              {t.reportsTitle}
            </h1>
            <p className="text-slate-400 font-medium text-xs mt-1">
              Generate audit logs, compute exact receipt margins, and inspect seasonal garment category charts
            </p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button 
              onClick={handlePrintReport}
              variant="outline"
              className="rounded-xl font-bold text-xs uppercase tracking-wider h-11 px-6 border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print Statement
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="space-y-2">
            <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">{t.startDate}</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-9 h-11 border-slate-200 shadow-none focus-visible:ring-primary rounded-xl"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">{t.endDate}</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-9 h-11 border-slate-200 shadow-none focus-visible:ring-primary rounded-xl"
              />
            </div>
          </div>
          <div className="flex items-end">
            <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl w-full flex justify-between items-center h-11">
              <span className="text-xs font-black text-slate-500 uppercase tracking-wider">{t.totalSales}:</span>
              <Badge className="bg-primary hover:bg-primary text-secondary text-sm font-mono font-black py-0.5 px-3 rounded-lg">
                {filteredSales.length} bills
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Main KPI Stat boxes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        <ReportStatCard title={t.revenue} value={`₹${stats.totalRevenue.toLocaleString()}`} icon={IndianRupee} color="text-indigo-600" />
        <ReportStatCard title={t.grossProfit} value={`₹${stats.totalProfit.toLocaleString()}`} icon={TrendingUp} color="text-emerald-600" subtitle="Based on actual cost" />
        <ReportStatCard title={t.totalBills} value={stats.totalOrders.toString()} icon={ShoppingBag} color="text-fuchsia-600" />
        <ReportStatCard title={t.avgOrder} value={`₹${stats.totalOrders > 0 ? Math.round(stats.totalRevenue / stats.totalOrders).toLocaleString() : 0}`} icon={TrendingUp} color="text-amber-600" />
      </div>

      {/* Structured Subsystem report category tabs */}
      <div className="flex overflow-x-auto gap-1 border-b border-slate-200 pb-0.5 no-print">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 whitespace-nowrap transition-all rounded-t-xl ${
            activeTab === 'overview' 
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 font-black' 
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          Sales Graphs
        </button>
        <button
          onClick={() => setActiveTab('product')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 whitespace-nowrap transition-all rounded-t-xl ${
            activeTab === 'product' 
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 font-black' 
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          Product Sales
        </button>
        <button
          onClick={() => setActiveTab('low-stock')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 whitespace-nowrap transition-all rounded-t-xl ${
            activeTab === 'low-stock' 
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 font-black' 
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          {t.lowStockReport}
          {lowStockProducts.length > 0 && (
            <Badge variant="destructive" className="ml-1.5 px-1.5 py-0 text-[10px] bg-red-600">{lowStockProducts.length}</Badge>
          )}
        </button>
      </div>

      {/* TAB SUB-VIEWS SECTION */}

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Sales Period Trend Chart */}
            <Card className="lg:col-span-2 border-none shadow-sm shadow-slate-200/50 bg-white">
              <CardHeader className="flex flex-row justify-between items-center border-b border-slate-50 pb-4">
                <CardTitle className="text-xs font-black tracking-widest text-slate-400 font-mono uppercase">
                  {salesAggMode === 'daily' ? 'Daily Sales View' : salesAggMode === 'weekly' ? 'Weekly Sales View' : 'Monthly Sales View'}
                </CardTitle>
                <div className="flex gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-100 no-print">
                  <button 
                    onClick={() => setSalesAggMode('daily')}
                    className={`px-2.5 py-1 text-[10px] font-black rounded-lg border-none cursor-pointer ${salesAggMode === 'daily' ? 'bg-primary text-secondary' : 'text-slate-500 bg-transparent'}`}
                  >
                    Daily
                  </button>
                  <button 
                    onClick={() => setSalesAggMode('weekly')}
                    className={`px-2.5 py-1 text-[10px] font-black rounded-lg border-none cursor-pointer ${salesAggMode === 'weekly' ? 'bg-primary text-secondary' : 'text-slate-500 bg-transparent'}`}
                  >
                    Weekly
                  </button>
                  <button 
                    onClick={() => setSalesAggMode('monthly')}
                    className={`px-2.5 py-1 text-[10px] font-black rounded-lg border-none cursor-pointer ${salesAggMode === 'monthly' ? 'bg-primary text-secondary' : 'text-slate-500 bg-transparent'}`}
                  >
                    Monthly
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="w-full h-[320px] relative">
                  {isMounted && periodicTrendData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 font-semibold italic text-xs">No records available</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={325}>
                      <BarChart data={periodicTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} 
                          dy={10} 
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} 
                          width={50}
                          tickFormatter={(val) => `₹${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
                        />
                        <Tooltip 
                          cursor={{fill: '#f8fafc/50'}}
                          contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}}
                          formatter={(value: any) => [`₹${value.toLocaleString()}`, 'Revenue']}
                        />
                        <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={28}>
                          {periodicTrendData.map((e, idx) => (
                            <Cell key={`cell-${idx}`} fill={idx % 2 === 0 ? '#6366f1' : '#4f46e5'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Payment share chart */}
            <Card className="border-none shadow-sm shadow-slate-200/50 bg-white">
              <CardHeader className="border-b border-slate-50 pb-4">
                <CardTitle className="text-xs font-black tracking-widest text-slate-400 font-mono uppercase">
                  {t.paymentShare}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                {isMounted && paymentStats.reduce((acc, cr) => acc + cr.value, 0) === 0 ? (
                  <div className="text-slate-400 font-semibold italic text-xs py-20">No payments registered</div>
                ) : (
                  <div className="w-full flex flex-col items-center">
                    <div className="w-full h-[200px] relative flex justify-center">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={paymentStats}
                            innerRadius={55}
                            outerRadius={75}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {paymentStats.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PAYMENT_COLORS[index]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(val: any) => `₹${val.toLocaleString()}`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col gap-2.5 mt-6 w-full px-2 text-left">
                      {paymentStats.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs border-b border-slate-50 pb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: PAYMENT_COLORS[idx]}} />
                            <span className="font-extrabold text-slate-600">{item.name}</span>
                          </div>
                          <span className="font-bold text-slate-800 font-mono">₹{item.value.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

          {/* Saree Categories share metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-none shadow-sm shadow-slate-200/50 bg-white">
              <CardHeader className="border-b border-slate-50 pb-4">
                <CardTitle className="text-xs font-black tracking-widest text-slate-400 font-mono uppercase">{t.categoryShare}</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {categoryDistribution.length === 0 ? (
                  <div className="text-center text-slate-400 italic text-xs py-10">No categories distributed.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="h-[220px] relative flex justify-center">
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={categoryDistribution}
                            innerRadius={60}
                            outerRadius={85}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {categoryDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: any) => `₹${value.toLocaleString()}`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                      {categoryDistribution.map((entry, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor: COLORS[idx % COLORS.length]}} />
                            <span className="text-[11px] font-black uppercase text-slate-700 truncate max-w-[120px]">{entry.name}</span>
                          </div>
                          <span className="text-xs font-black font-mono text-slate-700">₹{entry.value.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Summary overview block */}
            <Card className="border-none shadow-sm shadow-slate-200/50 bg-slate-900 text-white p-6 rounded-3xl flex flex-col justify-between">
              <div className="space-y-4">
                <div className="text-[10px] font-bold tracking-widest text-primary font-mono uppercase">FINANCIAL AUDIT STATEMENT</div>
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Retail Gross:</span>
                    <span className="font-mono text-white">₹{stats.totalRevenue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Weaver Wholesales (Cost):</span>
                    <span className="font-mono text-white">₹{(stats.totalRevenue - stats.totalProfit).toLocaleString()}</span>
                  </div>
                  <div className="border-t border-white/5 pt-3 flex justify-between items-end">
                    <span className="text-xs font-black text-emerald-400">EST GROSS PROFIT:</span>
                    <span className="text-2xl font-black font-mono text-emerald-400">₹{stats.totalProfit.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="p-3.5 bg-white/5 rounded-xl text-[10px] text-slate-400 leading-relaxed mt-6">
                Profit margin matches (Retail price - Buy cost) * Qty. Tax elements calculated at tax point.
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* activeTab === 'product': Product wise performance */}
      {activeTab === 'product' && (
        <Card className="border-none shadow-sm shadow-slate-100">
          <CardHeader className="border-b border-slate-50 flex flex-row justify-between items-center pb-4">
            <CardTitle className="text-xs font-black tracking-widest text-slate-400 font-mono uppercase">
              Garment Wise Sales Performance
            </CardTitle>
            <Badge variant="outline" className="font-mono">{productWiseSales.length} items cataloged</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Garment Product</th>
                    <th className="px-6 py-3 text-center text-[9px] font-black uppercase tracking-widest text-slate-400">Barcode</th>
                    <th className="px-6 py-3 text-center text-[9px] font-black uppercase tracking-widest text-slate-400">Qty Sold</th>
                    <th className="px-6 py-3 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Revenue</th>
                    <th className="px-6 py-3 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Cost</th>
                    <th className="px-6 py-3 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Estimated Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {productWiseSales.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/40">
                      <td className="px-6 py-4">
                        <div className="text-[11px] font-black text-slate-700 leading-none">{p.name}</div>
                        <span className="text-[9px] text-indigo-500 font-black uppercase mt-1.5 block">{p.category}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <code className="text-[10px] font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600">{p.barcode}</code>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant={p.qtySold > 0 ? "secondary" : "outline"} className={`text-xs font-mono font-bold ${p.qtySold > 0 ? 'bg-primary/5 text-primary' : ''}`}>
                          {p.qtySold}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right text-[11px] font-bold text-slate-800 font-mono">₹{p.revenue.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-[10px] text-slate-400 font-mono">₹{p.cogs.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-mono">
                        <span className={`text-[11px] font-black ${p.profit > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                          ₹{p.profit.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* activeTab === 'low-stock': Low stock alerts */}
      {activeTab === 'low-stock' && (
        <Card className="border-none shadow-sm shadow-slate-100">
          <CardHeader className="border-b border-slate-50 flex flex-row justify-between items-center pb-4">
            <CardTitle className="text-xs font-black tracking-widest text-slate-400 font-mono uppercase">
              {t.lowStockReport}
            </CardTitle>
            {lowStockProducts.length > 0 ? (
              <Badge variant="destructive" className="bg-red-600 font-bold">{lowStockProducts.length} Alert items</Badge>
            ) : (
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold">Stock optimal</Badge>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Garment Name</th>
                    <th className="px-6 py-3 text-center text-[9px] font-black uppercase tracking-widest text-slate-400">Barcode</th>
                    <th className="px-6 py-3 text-center text-[9px] font-black uppercase tracking-widest text-slate-400">Category</th>
                    <th className="px-6 py-3 text-center text-[9px] font-black uppercase tracking-widest text-slate-400">Current Stock</th>
                    <th className="px-6 py-3 text-center text-[9px] font-black uppercase tracking-widest text-slate-400">Alert Level</th>
                    <th className="px-6 py-3 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Buy Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {lowStockProducts.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/40 bg-red-50/15">
                      <td className="px-6 py-4">
                        <div className="text-[11px] font-black text-rose-700 leading-none">{p.name}</div>
                        <span className="text-[9px] text-slate-400 mt-1 block">Brand/Weaver: {p.brand || 'Local weaver'}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <code className="text-[10px] font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600">{p.barcode}</code>
                      </td>
                      <td className="px-6 py-4 text-center text-xs font-semibold text-slate-500 uppercase">{p.category}</td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant="destructive" className="font-mono font-black text-xs px-2.5 bg-red-600">
                          {p.stockQuantity} {p.unit || 'pcs'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-xs font-mono font-semibold text-slate-500">{p.reorderLevel} {p.unit || 'pcs'}</span>
                      </td>
                      <td className="px-6 py-4 text-right text-[11px] font-black text-slate-800 font-mono">₹{p.purchasePrice}</td>
                    </tr>
                  ))}
                  {lowStockProducts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic font-semibold text-xs">
                        🎉 All garments have robust stock levels! No reorder triggers hit.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}





    </div>
  );
}

function ReportStatCard({ title, value, icon: Icon, color, subtitle }: any) {
  return (
    <Card className="border-none shadow-sm overflow-hidden group">
      <CardContent className="p-4 sm:p-6 bg-white hover:bg-slate-50/30 transition-colors">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1">
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400 leading-none">{title}</p>
            <h3 className={`text-xl sm:text-2xl font-black ${color} break-words font-mono pt-1`}>{value}</h3>
            {subtitle && <p className="text-[9px] font-bold text-slate-400 uppercase italic leading-none pt-1">{subtitle}</p>}
          </div>
          <div className="p-2 sm:p-3 rounded-2xl bg-slate-50 transition-colors group-hover:bg-slate-100 shrink-0">
            <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
