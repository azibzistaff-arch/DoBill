import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart, Package, TrendingUp, AlertTriangle, IndianRupee } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { DataService } from '@/services/dataService';
import { subDays, format, eachDayOfInterval, isSameDay, startOfDay } from 'date-fns';
import { Product, Sale } from '@/types';

const COLORS = ['#10b981', '#3b82f6'];

export default function Dashboard() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [userProfile, setUserProfile] = useState<{ name: string; email: string; avatar?: string }>({
    name: 'Do Bill Cashier',
    email: '',
    avatar: ''
  });
  
  const refreshData = async () => {
    try {
      const [s, p, u] = await Promise.all([
        DataService.getSales(),
        DataService.getProducts(),
        DataService.getUserProfile()
      ]);
      setSales(Array.isArray(s) ? s : []);
      setProducts(Array.isArray(p) ? p : []);
      if (u) setUserProfile(u);
    } catch (e) {
      console.error("Dashboard data load error:", e);
      setSales([]);
      setProducts([]);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    refreshData();
    return DataService.subscribe(refreshData);
  }, []);

  const lowStockCount = useMemo(() => 
    products.filter(p => p.stockQuantity <= p.reorderLevel).length
  , [products]);

  const stats = useMemo(() => {
    try {
      const today = startOfDay(new Date());
      const yesterday = subDays(today, 1);

      const todaySales = sales.filter(s => {
        try {
          const d = new Date(s.createdAt);
          return !isNaN(d.getTime()) && isSameDay(d, today);
        } catch {
          return false;
        }
      });

      const yesterdaySales = sales.filter(s => {
        try {
          const d = new Date(s.createdAt);
          return !isNaN(d.getTime()) && isSameDay(d, yesterday);
        } catch {
          return false;
        }
      });

      const todayRev = todaySales.reduce((acc, s) => acc + (s.grandTotal || 0), 0);
      const yesterdayRev = yesterdaySales.reduce((acc, s) => acc + (s.grandTotal || 0), 0);

      const upiCount = sales.filter(s => s.paymentMode === 'upi').length;
      const cashCount = sales.filter(s => s.paymentMode === 'cash').length;

      return {
        revenue: sales.reduce((acc, s) => acc + (s.grandTotal || 0), 0),
        todayRevenue: todayRev,
        yesterdayRevenue: yesterdayRev,
        todayOrders: todaySales.length,
        orders: sales.length,
        inventory: products.reduce((acc, p) => acc + (p.stockQuantity || 0), 0),
        paymentStats: [
          { name: 'Cash', value: cashCount || 0 },
          { name: 'UPI', value: upiCount || 0 },
        ]
      };
    } catch (e) {
      console.error("Dashboard stats recalculation error:", e);
      return {
        revenue: 0,
        todayRevenue: 0,
        yesterdayRevenue: 0,
        todayOrders: 0,
        orders: 0,
        inventory: 0,
        paymentStats: [
          { name: 'Cash', value: 0 },
          { name: 'UPI', value: 0 },
        ]
      };
    }
  }, [sales, products]);

  const chartData = useMemo(() => {
    try {
      const last7Days = eachDayOfInterval({
        start: subDays(new Date(), 6),
        end: new Date(),
      });

      return last7Days.map(date => {
        const dayStr = format(date, 'yyyy-MM-dd');
        const daySales = sales.filter(s => {
          try {
            const d = new Date(s.createdAt);
            return !isNaN(d.getTime()) && format(d, 'yyyy-MM-dd') === dayStr;
          } catch {
            return false;
          }
        });
        return {
          name: format(date, 'EEE'),
          sales: daySales.reduce((acc, s) => acc + (s.grandTotal || 0), 0)
        };
      });
    } catch (e) {
      console.error("Dashboard chartData error:", e);
      return [];
    }
  }, [sales]);

  const recentSales = useMemo(() => {
    try {
      return [...sales]
        .filter(s => s && s.createdAt)
        .sort((a, b) => {
          const tA = new Date(a.createdAt).getTime();
          const tB = new Date(b.createdAt).getTime();
          return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
        })
        .slice(0, 5);
    } catch {
      return [];
    }
  }, [sales]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 gap-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full border border-slate-200 ring-4 ring-primary/5 overflow-hidden bg-slate-100 flex items-center justify-center shrink-0 shadow-sm">
            {userProfile.avatar ? (
              userProfile.avatar.startsWith('http://') || userProfile.avatar.startsWith('https://') || userProfile.avatar.startsWith('data:image/') ? (
                <img src={userProfile.avatar} alt="Profile" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-2xl">{userProfile.avatar}</span>
              )
            ) : (
              <span className="text-lg font-black text-slate-500">
                {userProfile.name ? userProfile.name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase() : 'OS'}
              </span>
            )}
          </div>
          <div className="space-y-0.5">
            <h2 className="text-lg sm:text-x2 font-black text-slate-800 tracking-tight">Welcome Back, {userProfile.name}!</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Operator: {userProfile.email}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100/65 text-emerald-700 w-full sm:w-auto justify-center">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest leading-none">POS Active & Connected</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        <StatCard 
          title="Revenue (Today)" 
          value={`₹${stats.todayRevenue.toLocaleString()}`} 
          icon={IndianRupee} 
          color="text-emerald-600" 
          trend={stats.todayRevenue >= stats.yesterdayRevenue ? 'up' : 'down'}
          subtitle={`Prev: ₹${stats.yesterdayRevenue.toLocaleString()}`}
        />
        <StatCard title="Bills (Today)" value={stats.todayOrders.toString()} icon={ShoppingCart} color="text-blue-600" />
        <StatCard title="Stock Items" value={stats.inventory.toString()} icon={Package} color="text-purple-600" />
        <StatCard title="Alerts" value={lowStockCount.toString()} icon={AlertTriangle} color={lowStockCount > 0 ? "text-orange-600" : "text-slate-400"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-sm h-[400px]">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-[10px] sm:text-sm font-black uppercase tracking-widest text-slate-400 font-mono">7-Day Sales Performance</CardTitle>
          </CardHeader>
          <CardContent className="p-0 px-2 sm:px-6 pb-6">
            <div className="w-full h-[300px] relative">
              {isMounted && (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}} 
                      dy={10} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}} 
                      width={50}
                      tickFormatter={(value) => `₹${value >= 1000 ? (value/1000).toFixed(1) + 'k' : value}`}
                    />
                    <Tooltip 
                      contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}}
                      formatter={(value: any) => [`₹${value.toLocaleString()}`, 'Revenue']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="sales" 
                      stroke="#2563eb" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#colorSales)"
                      dot={{r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff'}} 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm h-[400px]">
          <CardHeader>
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono">Payment Modes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-0">
             <div className="w-full h-[220px] relative">
               {isMounted && (
                 <ResponsiveContainer width="100%" height={220}>
                   <PieChart>
                      <Pie
                        data={stats.paymentStats}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {stats.paymentStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                   </PieChart>
                 </ResponsiveContainer>
               )}
             </div>
             <div className="flex gap-4 mt-4">
               {stats.paymentStats.map((entry, idx) => (
                 <div key={idx} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: COLORS[idx]}} />
                    <span className="text-[10px] font-black uppercase text-slate-500">{entry.name}: {entry.value}</span>
                 </div>
               ))}
             </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-none shadow-sm h-full">
          <CardHeader>
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             {/* Desktop Table View */}
             <div className="hidden md:block overflow-x-auto">
               <table className="w-full">
                 <thead className="bg-slate-50/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-[9px] font-black uppercase tracking-widest text-slate-400 italic">Bill #</th>
                      <th className="px-6 py-3 text-left text-[9px] font-black uppercase tracking-widest text-slate-400 italic">Customer</th>
                      <th className="px-6 py-3 text-left text-[9px] font-black uppercase tracking-widest text-slate-400 italic">Payment</th>
                      <th className="px-6 py-3 text-right text-[9px] font-black uppercase tracking-widest text-slate-400 italic">Total</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {recentSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-[11px] font-black text-slate-800">{sale.invoiceNumber}</td>
                        <td className="px-6 py-4 text-[10px] font-bold text-slate-500">{sale.customerName || 'Walk-in'}</td>
                        <td className="px-6 py-4">
                           <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${sale.paymentMode === 'upi' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                             {sale.paymentMode}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-right text-[11px] font-black text-slate-900 font-mono">₹{sale.grandTotal.toLocaleString()}</td>
                      </tr>
                    ))}
                    {recentSales.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-[10px] font-bold text-slate-400 italic">No recent transactions.</td>
                      </tr>
                    )}
                 </tbody>
               </table>
             </div>

             {/* Mobile Responsive Cards list */}
             <div className="block md:hidden divide-y divide-slate-100">
               {recentSales.map((sale) => (
                 <div key={sale.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors bg-white">
                   <div className="flex flex-col gap-1 min-w-0">
                     <span className="text-xs font-black text-slate-800">{sale.invoiceNumber}</span>
                     <div className="flex items-center gap-1.5 min-w-0">
                       <span className="text-[10px] font-bold text-slate-500 truncate capitalize">{sale.customerName || 'Walk-in'}</span>
                       <span className="text-slate-300 shrink-0">•</span>
                       <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 ${sale.paymentMode === 'upi' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                         {sale.paymentMode}
                       </span>
                     </div>
                   </div>
                   <div className="text-right shrink-0">
                     <span className="text-xs font-black text-slate-900 font-mono">₹{sale.grandTotal.toLocaleString()}</span>
                   </div>
                 </div>
               ))}
               {recentSales.length === 0 && (
                 <div className="p-8 text-center text-[10px] font-bold text-slate-400 italic">No recent transactions.</div>
               )}
             </div>
          </CardContent>
          <div className="p-4 border-t border-slate-50 bg-slate-50/20 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Designed & Developed by <span className="text-emerald-600 font-black">Do Bill</span>
              </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, trend, subtitle }: any) {
  return (
    <Card className="border-none shadow-sm overflow-hidden group">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="order-2 sm:order-1 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-wider">{title}</p>
              {trend && (
                <div className={`text-[8px] px-1 rounded flex items-center gap-0.5 font-black ${trend === 'up' ? 'text-emerald-500 bg-emerald-50' : 'text-rose-500 bg-rose-50'}`}>
                  {trend === 'up' ? '▲' : '▼'}
                </div>
              )}
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-none mb-1">{value}</h3>
            {subtitle && <p className="text-[9px] font-bold text-slate-400 italic uppercase leading-none">{subtitle}</p>}
          </div>
          <div className={`order-1 sm:order-2 p-2 sm:p-3 rounded-2xl bg-slate-50 ${color} transition-colors group-hover:bg-slate-100`}>
            <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

