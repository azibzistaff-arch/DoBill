import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileText, 
  Calendar,  
  User, 
  CreditCard, 
  ExternalLink,
  Printer,
  Banknote,
  Smartphone,
  History,
  ChevronRight,
  ChevronLeft,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { DataService } from '@/services/dataService';
import { Sale } from '@/types';
import { format, isWithinInterval, startOfDay, endOfDay, subDays } from 'date-fns';
import { ReceiptTemplate } from './ReceiptTemplate';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ShopDetails } from '@/services/dataService';
import { DirectPrintService, handlePrint } from '@/services/directPrintService';

export default function SalesHistory() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [shopDetails, setShopDetails] = useState<ShopDetails | null>(null);
  
  const refreshSales = async () => {
    try {
      const data = await DataService.getSales();
      setSales(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Sales History load error:", e);
      setSales([]);
    }
  };

  useEffect(() => {
    const loadShop = async () => {
      const shop = await DataService.getShopDetails();
      setShopDetails(shop);
    };
    loadShop();
    refreshSales();
    return DataService.subscribe(refreshSales);
  }, []);
  const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const isFilterToday = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return startDate === today && endDate === today;
  }, [startDate, endDate]);

  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      const saleDate = new Date(sale.createdAt);
      return isWithinInterval(saleDate, {
        start: startOfDay(new Date(startDate)),
        end: endOfDay(new Date(endDate))
      });
    }).slice().reverse();
  }, [sales, startDate, endDate]);

  const groupedSales = useMemo(() => {
    const groups: Record<string, Sale[]> = {};
    filteredSales.forEach(sale => {
      const dateKey = format(new Date(sale.createdAt), 'yyyy-MM-dd');
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(sale);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredSales]);

  const exportToCSV = () => {
    if (filteredSales.length === 0) {
      toast.warning("No sales transactions to download for the selected period.");
      return;
    }
    const headers = ['Invoice Number', 'Date', 'Time', 'Customer Name', 'Phone', 'Sold Product IDs', 'Sold Product Names', 'Items Count', 'Subtotal', 'Tax (GST)', 'Grand Total', 'Payment Method'];
    const rows = filteredSales.map(sale => [
      sale.invoiceNumber,
      format(new Date(sale.createdAt), 'yyyy-MM-dd'),
      format(new Date(sale.createdAt), 'hh:mm a'),
      sale.customerName || 'Walk-in',
      sale.customerPhone || '-',
      (sale.items || []).map(item => item.id).join('; '),
      (sale.items || []).map(item => item.name).join('; '),
      (sale.items || []).length,
      sale.subtotal.toFixed(2),
      sale.taxTotal.toFixed(2),
      sale.grandTotal.toFixed(2),
      (sale.paymentMode || 'cash').toUpperCase()
    ]);

    const content = [
      headers.join(','), 
      ...rows.map(r => r.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Sales_Statement_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV statement downloaded successfully!');
  };

  const exportToExcel = () => {
    if (filteredSales.length === 0) {
      toast.warning("No sales transactions to download for the selected period.");
      return;
    }
    const shopName = shopDetails?.name || 'STORE RECEIPT';
    const shopAddress = shopDetails?.address || '';
    const shopPhone = shopDetails?.phone || '';

    let excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Sales Statement</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; }
          table { border-collapse: collapse; width: 100%; margin-top: 15px; }
          th { background-color: #1e3a8a; color: white; font-weight: bold; border: 1px solid #cbd5e1; padding: 10px; text-transform: uppercase; font-size: 11px; }
          td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 11px; }
          .title { font-size: 18px; font-weight: bold; color: #1e3a8a; }
          .subtitle { font-size: 11px; color: #64748b; margin-top: 5px; font-weight: bold; }
          .number { text-align: right; }
          .total-row { background-color: #f8fafc; font-weight: bold; color: #1e3a8a; }
        </style>
      </head>
      <body>
        <div class="title">${shopName.toUpperCase()}</div>
        <div style="font-size: 12px; color: #475569; font-weight: bold;">${shopAddress} | Tel: ${shopPhone}</div>
        <div class="subtitle">SALES STATEMENT PERIOD: ${startDate} TO ${endDate} | GENERATED ON: ${new Date().toLocaleDateString('en-IN')}</div>
        <table>
          <thead>
            <tr>
              <th>Invoice No</th>
              <th>Date</th>
              <th>Time</th>
              <th>Customer Name</th>
              <th>Phone</th>
              <th>Sold Product IDs</th>
              <th>Sold Product Names</th>
              <th class="number">Items Count</th>
              <th class="number">Subtotal (₹)</th>
              <th class="number">Tax/GST (₹)</th>
              <th class="number">Grand Total (₹)</th>
              <th>Payment Method</th>
            </tr>
          </thead>
          <tbody>
    `;

    let totalGrand = 0;
    let totalSub = 0;
    let totalTax = 0;
    let totalItems = 0;

    filteredSales.forEach(sale => {
      totalGrand += sale.grandTotal;
      totalSub += sale.subtotal;
      totalTax += sale.taxTotal;
      totalItems += (sale.items || []).length;

      const productIdsStr = (sale.items || []).map(item => item.id).join(', ');
      const productNamesStr = (sale.items || []).map(item => item.name).join(', ');

      excelTemplate += `
        <tr>
          <td>${sale.invoiceNumber}</td>
          <td>${format(new Date(sale.createdAt), 'dd-MM-yyyy')}</td>
          <td>${format(new Date(sale.createdAt), 'hh:mm a')}</td>
          <td>${sale.customerName || 'Walk-in'}</td>
          <td>${sale.customerPhone || '-'}</td>
          <td>${productIdsStr}</td>
          <td>${productNamesStr}</td>
          <td class="number">${(sale.items || []).length}</td>
          <td class="number">${sale.subtotal.toFixed(2)}</td>
          <td class="number">${sale.taxTotal.toFixed(2)}</td>
          <td class="number">${sale.grandTotal.toFixed(2)}</td>
          <td>${(sale.paymentMode || 'cash').toUpperCase()}</td>
        </tr>
      `;
    });

    excelTemplate += `
            <tr class="total-row">
              <td colspan="7" style="border-top: 2px solid #1e3a8a;">GRAND STATEMENT TOTAL</td>
              <td class="number" style="border-top: 2px solid #1e3a8a;">${totalItems}</td>
              <td class="number" style="border-top: 2px solid #1e3a8a;">${totalSub.toFixed(2)}</td>
              <td class="number" style="border-top: 2px solid #1e3a8a;">${totalTax.toFixed(2)}</td>
              <td class="number" style="border-top: 2px solid #1e3a8a; font-weight: 950; font-size: 12px;">${totalGrand.toFixed(2)}</td>
              <td style="border-top: 2px solid #1e3a8a;"></td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Sales_Statement_${startDate}_to_${endDate}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Excel statement downloaded successfully!');
  };

  const exportToPDF = async () => {
    if (filteredSales.length === 0) {
      toast.warning("No sales transactions to download for the selected period.");
      return;
    }

    const shopName = shopDetails?.name || 'STORE RECEIPT';
    const shopAddress = shopDetails?.address || '';
    const shopPhone = shopDetails?.phone || '';

    const rowsHTML = filteredSales.map((sale, idx) => {
      const productNames = (sale.items || []).map(item => item.name).join(', ');
      return `
      <tr>
        <td style="border-bottom: 1px solid #e2e8f0; padding: 12px 10px; font-weight: bold; color:#475569;">${idx + 1}</td>
        <td style="border-bottom: 1px solid #e2e8f0; padding: 12px 10px; font-weight: 900; color: #1e3a8a;">
          ${sale.invoiceNumber}
          <div style="font-weight: 600; font-size: 13px; color: #334155; margin-top: 6px; line-height: 1.4;">
            ${productNames}
          </div>
        </td>
        <td style="border-bottom: 1px solid #e2e8f0; padding: 12px 10px;">${format(new Date(sale.createdAt), 'dd MMMM yyyy hh:mm a')}</td>
        <td style="border-bottom: 1px solid #e2e8f0; padding: 12px 10px; font-weight: bold; text-transform: uppercase;">
          ${sale.customerName || '<span style="color:#cbd5e1; font-weight:normal; font-style:italic;">Walk-In Customer</span>'}
          ${sale.customerPhone ? `<br/><span style="font-size:10px; color:#64748b; font-weight:normal;">Phone: ${sale.customerPhone}</span>` : ''}
        </td>
        <td style="border-bottom: 1px solid #e2e8f0; padding: 12px 10px; text-align: center; font-weight: bold;">${(sale.items || []).length}</td>
        <td style="border-bottom: 1px solid #e2e8f0; padding: 12px 10px; text-transform: uppercase; text-align: center;">
          <span style="padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 900; letter-spacing: 0.5px; background: ${sale.paymentMode === 'cash' ? '#fff7ed; border: 1px solid #ffedd5; color:#ea580c;' : '#eff6ff; border: 1px solid #dbeafe; color:#2563eb;'}">
            ${sale.paymentMode || 'CASH'}
          </span>
        </td>
        <td style="border-bottom: 1px solid #e2e8f0; padding: 12px 10px; text-align: right; font-weight: bold; font-family: monospace;">₹${sale.subtotal.toFixed(2)}</td>
        <td style="border-bottom: 1px solid #e2e8f0; padding: 12px 10px; text-align: right; font-weight: bold; font-family: monospace;">₹${sale.taxTotal.toFixed(2)}</td>
        <td style="border-bottom: 1px solid #e2e8f0; padding: 12px 10px; text-align: right; font-weight: 900; font-family: monospace; color: #0f172a; font-size: 13px;">₹${sale.grandTotal.toFixed(2)}</td>
      </tr>
    `}).join('');

    const totalGrand = filteredSales.reduce((acc, s) => acc + s.grandTotal, 0);
    const totalSub = filteredSales.reduce((acc, s) => acc + s.subtotal, 0);
    const totalTax = filteredSales.reduce((acc, s) => acc + s.taxTotal, 0);
    const totalItems = filteredSales.reduce((acc, s) => acc + (s.items?.length || 0), 0);

    const fullHTML = `
      <html>
        <head>
          <title>Sales Statement Ledger - ${startDate} to ${endDate}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 30px; color: #1e293b; background: #fff; line-height: 1.4; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px double #1e3a8a; padding-bottom: 25px; margin-bottom: 30px; }
            .shop-title { font-size: 26px; font-weight: 900; text-transform: uppercase; color: #1e3a8a; margin: 0; letter-spacing: -0.5px; }
            .statement-title { font-size: 20px; font-weight: 900; color: #0f172a; margin: 0; text-align: right; }
            .meta-info { font-size: 11px; text-transform: uppercase; font-weight: 800; color: #64748b; margin-top: 4px; letter-spacing: 0.5px; }
            .summary-grid { display: grid; grid-template-cols: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
            .summary-card { padding: 15px 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; }
            .card-label { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
            .card-value { font-size: 20px; font-weight: 900; color: #1e3a8a; margin-top: 4px; font-family: monospace; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 20px; }
            th { background: #f1f5f9; padding: 12px 10px; text-align: left; font-weight: 800; text-transform: uppercase; font-size: 10px; color: #475569; border-bottom: 2px solid #cbd5e1; }
            .footer { margin-top: 50px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 25px; font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="shop-title">${shopName}</h1>
              <p style="margin:4px 0 0 0; font-size:12px; color:#475569; font-weight: 500;">${shopAddress}</p>
              <p style="margin:2px 0 0 0; font-size:12px; font-weight:bold; color:#1e3a8a;">Tel: ${shopPhone}</p>
            </div>
            <div style="text-align: right;">
              <h2 class="statement-title">POS LEDGER STATEMENT</h2>
              <p class="meta-info">Period: ${startDate} to ${endDate}</p>
              <p style="margin:4px 0 0 0; font-size:11px; color:#94a3b8; font-weight: bold;">Generated: ${new Date().toLocaleDateString('en-IN')} | ${new Date().toLocaleTimeString('en-IN')}</p>
            </div>
          </div>

          <div class="summary-grid">
            <div class="summary-card">
              <div class="card-label">Total Cashouts</div>
              <div class="card-value" style="color:#0f172a;">${filteredSales.length}</div>
            </div>
            <div class="summary-card">
              <div class="card-label">Base Subtotal</div>
              <div class="card-value">₹${totalSub.toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
            </div>
            <div class="summary-card">
              <div class="card-label">GST tax pooled</div>
              <div class="card-value">₹${totalTax.toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
            </div>
            <div class="summary-card" style="background: #f0fdf4; border-color: #bbf7d0;">
              <div class="card-label" style="color:#15803d;">Total Settlement Value</div>
              <div class="card-value" style="color: #166534; font-size: 22px;">₹${totalGrand.toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
            </div>
          </div>

          <h3 style="font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:1px; color:#1e3a8a; border-bottom:1px solid #cbd5e1; padding-bottom:6px; margin-bottom:10px;">Account Ledger Rows (with Payment modes)</h3>
          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">S.No</th>
                <th>Bill Reference</th>
                <th>Transaction Date & Time</th>
                <th>Customer Name & Contact</th>
                <th style="text-align: center; width: 60px;">Items</th>
                <th style="text-align: center; width: 100px;">Payment Mode</th>
                <th style="text-align: right; width: 110px;">Subtotal (₹)</th>
                <th style="text-align: right; width: 90px;">GST Tax (₹)</th>
                <th style="text-align: right; width: 120px;">Bill Value (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHTML}
              <tr style="background:#f1f5f9; font-weight:900; font-size:12px; color: #1e293b;">
                <td colspan="4" style="padding:15px 10px; border-top: 2px solid #94a3b8;">GRAND PERIOD TOTALS</td>
                <td style="padding:15px 10px; text-align: center; border-top: 2px solid #94a3b8;">${totalItems}</td>
                <td style="padding:15px 10px; border-top: 2px solid #94a3b8;"></td>
                <td style="padding:15px 10px; text-align: right; border-top: 2px solid #94a3b8; font-family: monospace;">₹${totalSub.toFixed(2)}</td>
                <td style="padding:15px 10px; text-align: right; border-top: 2px solid #94a3b8; font-family: monospace;">₹${totalTax.toFixed(2)}</td>
                <td style="padding:15px 10px; text-align: right; color:#166534; font-size:14px; font-weight:950; border-top: 2px solid #166534; font-family: monospace;">₹${totalGrand.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div class="footer">
            <p>This document is a formal POS audit output. generated digitally outside the workspace.</p>
            <p>&copy; ${new Date().getFullYear()} ${shopName} Cloath House.</p>
          </div>
        </body>
      </html>
    `;

    const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI?.isElectron;
    const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.() === true;

    if (isElectron) {
      const toastId = toast.loading("🖨️ Electron silent statement printing initialized...");
      try {
        await (window as any).electronAPI.printSilent(fullHTML);
        toast.dismiss(toastId);
        toast.success("Statement Printed Successfully!");
      } catch (err: any) {
        toast.dismiss(toastId);
        console.error("Electron statement print error:", err);
        toast.error("Printing failed. Make sure a default printer is selected in the system.");
      }
    } else if (isCapacitor) {
      const toastId = toast.loading("🖨️ Opening native print manager...");
      try {
        const { universalPrintHTML } = await import('@/services/directPrintService');
        const res = await universalPrintHTML(fullHTML);
        toast.dismiss(toastId);
        if (res.success) {
          toast.success("Statement Printed Successfully!");
        } else {
          toast.error(res.message);
        }
      } catch (err: any) {
        toast.dismiss(toastId);
        console.error("Capacitor statement print error:", err);
        toast.error(`Print failed: ${err.message || err}`);
      }
    } else {
      const printWindow = window.open('', '_blank', 'width=1000,height=800');
      if (!printWindow) {
        toast.error('Print window was blocked by browser. Please allow popup access.');
        return;
      }
      printWindow.document.write(fullHTML);
      printWindow.document.write(`
        <script>
          window.onload = () => {
            setTimeout(() => {
              window.print();
            }, 400);
          };
        </script>
      `);
      printWindow.document.close();
      toast.success('Launch PDF print stylesheet!');
    }
  };

  const exportToTXT = () => {
    if (filteredSales.length === 0) {
      toast.warning("No sales transactions to download for selected period.");
      return;
    }
    const shopName = shopDetails?.name || 'DO BILL';
    let txt = `===========================================================\n`;
    txt += `        ${shopName.toUpperCase()} - SALES AUDIT STATEMENT\n`;
    txt += `===========================================================\n`;
    txt += `Period: ${startDate} to ${endDate}\n`;
    txt += `Generated on: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN')}\n`;
    txt += `Total Transactions: ${filteredSales.length} bills\n`;
    txt += `-----------------------------------------------------------\n\n`;
    
    txt += `INVOICE NO     DATE/TIME            CUSTOMER          QTY   MODE     TOTAL VALUE   SOLD PRODUCT IDs & NAMES\n`;
    txt += `---------------------------------------------------------------------------------------------------------------------------------\n`;

    let totalRevenue = 0;
    filteredSales.forEach(s => {
      totalRevenue += s.grandTotal;
      const inv = s.invoiceNumber.padEnd(14, ' ');
      const dt = format(new Date(s.createdAt), 'dd/MM/yy hh:mm a').padEnd(20, ' ');
      const cust = (s.customerName || 'Walk-in').slice(0, 16).padEnd(17, ' ');
      const qty = (s.items?.length || 0).toString().padStart(3, ' ');
      const mode = (s.paymentMode || 'cash').toUpperCase().padEnd(8, ' ');
      const amount = `₹${s.grandTotal.toFixed(2)}`.padStart(11, ' ');
      const pidsStr = (s.items || []).map(item => item.id).join(', ');
      const pnamesStr = (s.items || []).map(item => item.name).join(', ');
      txt += `${inv} ${dt} ${cust} ${qty}   ${mode} ${amount}   [IDs: ${pidsStr}] [Names: ${pnamesStr}]\n`;
    });

    txt += `---------------------------------------------------------------------------------------------------------------------------------\n`;
    txt += `TOTAL PIECES SOLD:       ${filteredSales.reduce((acc, s) => acc + (s.items?.length || 0), 0)} items\n`;
    txt += `TOTAL PERIOD VALUE:      ₹${totalRevenue.toFixed(2)}\n`;
    txt += `===========================================================\n`;

    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Sales_Statement_${startDate}_to_${endDate}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Ledger text file download started!');
  };

  const handlePrintClick = async () => {
    if (!selectedSale) return;
    const toastId = toast.loading("🖨️ Printing receipt...");
    try {
      const res = await handlePrint(selectedSale);
      toast.dismiss(toastId);
      if (res.success) {
        toast.success("Print Successful");
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message || "Print failed");
    }
  };

  return (
    <div className="space-y-8">
      {/* Search & Filter Header (Always at the top) */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-end gap-4 no-print bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full lg:max-w-xl">
          <div className="space-y-2">
            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Statement From</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="h-11 pl-10 border-slate-200 bg-slate-50/50 focus:bg-white transition-colors rounded-xl font-bold text-slate-700 w-full"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Statement To</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="h-11 pl-10 border-slate-200 bg-slate-50/50 focus:bg-white transition-colors rounded-xl font-bold text-slate-700 w-full"
              />
            </div>
          </div>
        </div>
        <div className="bg-primary/5 px-6 py-3 rounded-2xl border border-primary/10 flex flex-col items-center justify-center min-w-[140px]">
          <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-none mb-1">
            {isFilterToday ? "Today's Sales" : "Period Total"}
          </span>
          <span className="text-xl font-black text-primary leading-none">₹{filteredSales.reduce((acc, s) => acc + s.grandTotal, 0).toFixed(2)}</span>
        </div>
      </div>

      {/* Statement Download Actions */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-5 no-print">
        <div className="space-y-1 text-center lg:text-left">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center justify-center lg:justify-start gap-2">
            <Download className="h-4 w-4 text-primary" />
            Ledger Statement Download Hub
          </h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Export the current sales ledger list ({filteredSales.length} items) with full payments breakdown</p>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-2.5 w-full lg:w-auto">
          <Button 
            onClick={exportToCSV}
            variant="outline"
            className="flex-1 lg:flex-none h-11 border-emerald-200 bg-emerald-50/20 text-emerald-700 hover:bg-emerald-50 font-bold text-xs gap-2 rounded-xl px-5"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            CSV Export
          </Button>

          <Button 
            onClick={exportToExcel}
            variant="outline"
            className="flex-1 lg:flex-none h-11 border-blue-200 bg-blue-50/20 text-blue-700 hover:bg-blue-50 font-bold text-xs gap-2 rounded-xl px-5"
          >
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
            Excel Sheet
          </Button>

          <Button 
            onClick={exportToPDF}
            variant="outline"
            className="flex-1 lg:flex-none h-11 border-indigo-200 bg-indigo-50/20 text-indigo-700 hover:bg-indigo-50 font-bold text-xs gap-2 rounded-xl px-5"
          >
            <Printer className="h-4 w-4 text-indigo-500" />
            PDF / A4 Print
          </Button>

          <Button 
            onClick={exportToTXT}
            variant="outline"
            className="flex-1 lg:flex-none h-11 border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100 font-bold text-xs gap-2 rounded-xl px-5"
          >
            <FileText className="h-4 w-4 text-slate-500" />
            Plain Text Ledger
          </Button>
        </div>
      </div>

      {/* Printable Receipt Area */}
      <div className="print-only">
        {selectedSale && <ReceiptTemplate sale={selectedSale} />}
      </div>

      {/* Grouped History List */}
      <div className="space-y-10 no-print">
        {groupedSales.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
            <CardContent className="py-20 text-center">
              <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-slate-500 font-bold">No transactions found</h3>
              <p className="text-sm text-slate-400">Try adjusting your date filters</p>
            </CardContent>
          </Card>
        ) : (
          groupedSales.map(([date, daySales]) => (
            <div key={date} className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-slate-100"></div>
                <div className="px-4 py-1.5 bg-slate-100/80 rounded-full border border-slate-200 backdrop-blur-sm shadow-sm ring-4 ring-white">
                  <span className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">
                    {format(new Date(date), 'EEEE, dd MMM yyyy')}
                  </span>
                </div>
                <div className="h-px flex-1 bg-slate-100"></div>
              </div>

              <Card className="border-none shadow-sm shadow-slate-200/50 overflow-hidden bg-white/70 backdrop-blur-md relative">
                {/* Desktop view table */}
                <div className="hidden lg:block overflow-x-auto scrollbar-hide">
                  <Table className="min-w-[700px]">
                    <TableHeader className="bg-slate-50/50 border-b border-slate-100 pointer-events-none">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[10px] font-black uppercase tracking-widest pl-6">Ref. Number</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Time</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Total Items</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Method</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right pr-6">Amount (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {daySales.map((sale) => (
                        <TableRow 
                          key={sale.id} 
                          className="hover:bg-slate-50/80 cursor-pointer transition-colors border-b border-slate-50 last:border-b-0" 
                          onClick={() => setSelectedSale(sale)}
                        >
                          <TableCell className="pl-6 font-bold text-primary py-4">
                            <div className="flex items-center gap-3">
                              <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-white shadow-sm ${sale.paymentMode === 'cash' ? 'bg-orange-500 shadow-orange-100' : 'bg-blue-500 shadow-blue-100'}`}>
                                {sale.paymentMode === 'cash' ? <Banknote className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                              </div>
                              <div className="flex flex-col">
                                <span className="tracking-tighter font-extrabold">{sale.invoiceNumber}</span>
                                <span className="text-xs text-slate-600 font-extrabold mt-1 leading-normal" title={(sale.items || []).map(item => item.name).join(', ')}>
                                  {(sale.items || []).map(item => item.name).join(', ')}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                              {format(new Date(sale.createdAt), 'hh:mm a')}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-full">
                              <div className="h-1.5 w-1.5 rounded-full bg-slate-400"></div>
                              <span className="text-xs font-black text-slate-600">{(sale.items || []).length} {(sale.items || []).length === 1 ? 'Item' : 'Items'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant="secondary" 
                              className={`uppercase text-[9px] border-none font-black tracking-widest px-3 ${
                                sale.paymentMode === 'cash' 
                                  ? 'bg-orange-50 text-orange-600' 
                                  : 'bg-blue-50 text-blue-600'
                              }`}
                            >
                              {sale.paymentMode}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-6 font-black text-lg text-slate-900">
                            ₹{sale.grandTotal.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile view card list */}
                <div className="block lg:hidden divide-y divide-slate-100">
                  {daySales.map((sale) => (
                    <div 
                      key={sale.id}
                      onClick={() => setSelectedSale(sale)}
                      className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors cursor-pointer bg-white"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-white shadow-sm shrink-0 mt-0.5 ${sale.paymentMode === 'cash' ? 'bg-orange-500 shadow-orange-100' : 'bg-blue-500 shadow-blue-100'}`}>
                          {sale.paymentMode === 'cash' ? <Banknote className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-black text-slate-800 leading-tight">{sale.invoiceNumber}</span>
                          <span className="text-[11px] font-semibold text-slate-500 truncate mt-0.5" title={(sale.items || []).map(item => item.name).join(', ')}>
                            {(sale.items || []).map(item => item.name).join(', ')}
                          </span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              {format(new Date(sale.createdAt), 'hh:mm a')}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-[10px] font-bold text-slate-500">
                              {(sale.items || []).reduce((acc, i) => acc + i.quantity, 0)} items
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-slate-900 font-mono">₹{sale.grandTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-50/50 px-6 py-3 flex justify-between items-center border-t border-slate-100">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Day Summary</span>
                   <span className="text-sm font-black text-slate-700">Total: ₹{daySales.reduce((acc, s) => acc + s.grandTotal, 0).toFixed(2)}</span>
                </div>
              </Card>
            </div>
          ))
        )}
      </div>

      <Dialog open={!!selectedSale} onOpenChange={() => setSelectedSale(null)}>
        <DialogContent className="w-[95vw] max-w-md p-0 overflow-hidden border-none shadow-2xl max-h-[92vh] flex flex-col no-print">
          <div className="bg-white p-4 sm:p-8 space-y-6 overflow-y-auto flex-1">
            <div className="text-center space-y-1">
              {shopDetails?.logo && (
                <img src={shopDetails.logo} alt="Store Logo" className="h-12 mx-auto mb-1 object-contain max-w-[120px]" />
              )}
              <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">
                {shopDetails?.name || 'STORE RECEIPT'}
              </h2>
              {shopDetails?.address && (
                <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">
                  {shopDetails.address}
                </p>
              )}
              {shopDetails?.phone && (
                <p className="text-xs font-bold text-slate-700">
                  Tel: {shopDetails.phone}
                </p>
              )}
            </div>

            <Separator className="border-dashed border-slate-300" />

            <div className="grid grid-cols-2 text-xs gap-y-2">
              <span className="text-slate-400 font-bold uppercase">Invoice No</span>
              <span className="text-right font-black uppercase text-primary">{selectedSale?.invoiceNumber}</span>
              <span className="text-slate-400 font-bold uppercase">Date & Time</span>
              <span className="text-right font-bold">
                {selectedSale?.createdAt ? format(new Date(selectedSale.createdAt), 'dd/MM/yyyy hh:mm a') : ''}
              </span>
              <span className="text-slate-400 font-bold uppercase">Payment Mode</span>
              <span className="text-right font-bold uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded w-fit ml-auto border border-blue-100">
                {selectedSale?.paymentMode || 'CASH'}
              </span>
              {selectedSale?.cashierId && (
                <>
                  <span className="text-slate-400 font-bold uppercase">Cashier</span>
                  <span className="text-right font-bold uppercase">{selectedSale.cashierId}</span>
                </>
              )}
              {selectedSale?.customerName && (
                <>
                  <span className="text-slate-400 font-bold uppercase">Customer Name</span>
                  <span className="text-right font-bold uppercase text-slate-800">{selectedSale.customerName}</span>
                </>
              )}
              {selectedSale?.customerPhone && (
                <>
                  <span className="text-slate-400 font-bold uppercase">Customer Phone</span>
                  <span className="text-right font-bold text-slate-800">{selectedSale.customerPhone}</span>
                </>
              )}
              {selectedSale?.customerAddress && (
                <>
                  <span className="text-slate-400 font-bold uppercase">Customer Address</span>
                  <span className="text-right font-bold text-slate-800">{selectedSale.customerAddress}</span>
                </>
              )}
            </div>

            <table className="w-full text-xs">
              <thead>
                <tr className="border-y border-dashed border-slate-300 uppercase font-black text-slate-600">
                  <th className="text-left py-2">Item Name</th>
                  <th className="text-center py-2">Qty</th>
                  <th className="text-right py-2">Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-slate-100 font-bold">
                {selectedSale?.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2 flex flex-col">
                      <span className="text-slate-800">{item.name}</span>
                      <span className="text-[10px] text-slate-400">@₹{item.sellingPrice.toFixed(2)}</span>
                    </td>
                    <td className="text-center py-2">{item.quantity}</td>
                    <td className="text-right py-2">₹{(item.sellingPrice * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-2 pt-2 border-t border-dashed border-slate-200">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-400 uppercase">Subtotal</span>
                <span>₹{selectedSale?.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-400 uppercase">GST / Tax</span>
                <span>₹{selectedSale?.taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-black pt-2 border-t border-dashed border-slate-300">
                <span className="uppercase tracking-tighter">Grand Total</span>
                <span className="text-primary">₹{selectedSale?.grandTotal.toFixed(2)}</span>
              </div>
              {selectedSale?.paymentMode === 'cash' && (selectedSale.cashReceived ?? 0) > 0 && (
                <div className="bg-slate-50 p-2.5 rounded-lg space-y-1 text-xs font-semibold text-slate-600 border border-slate-100 mt-2">
                  <div className="flex justify-between">
                    <span>Cash Received:</span>
                    <span>₹{selectedSale.cashReceived.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-black text-slate-900">
                    <span>Change Returned:</span>
                    <span>₹{(selectedSale.changeDue || 0).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="text-center pt-4 space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">--- THANK YOU FOR SHOPPING ---</p>
              <Button 
                onClick={handlePrintClick}
                className="w-full h-12 gap-2 font-bold shadow-lg shadow-primary/20"
              >
                <Printer className="h-4 w-4" /> Print Receipt
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
