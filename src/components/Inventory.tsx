import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  AlertTriangle, 
  MoreHorizontal,
  ChevronRight,
  Filter,
  Barcode as BarcodeIcon,
  Image as ImageIcon,
  Upload,
  Printer,
  Loader2,
  Smartphone,
  ExternalLink,
  Download,
  Bluetooth,
  Usb
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { compressImageFile } from '@/utils/imageCompressor';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DataService } from '@/services/dataService';
import { Product } from '@/types';
import { PrinterPickerModal } from './PrinterPickerModal';
import { buildBarcodeLabelHTML, universalPrintHTML, getPrinterConfig, detectAutoLabelDimensions } from '@/services/directPrintService';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { toast } from 'sonner';
// @ts-ignore - Import directly to bypass package entry resolution failure on some systems/Vite versions
import Barcode from 'react-barcode/lib/react-barcode.js';
import { getCurrentUserRole, defineAbilityFor } from '@/services/abilityService';

const getBarcodeBarWidth = (code?: string | null) => {
  if (!code) return 1.8;
  const len = code.length;
  if (len > 18) return 1.0;
  if (len > 14) return 1.15;
  if (len > 10) return 1.35;
  return 1.8; // Bold, sharp lines for <=8-digit barcodes
};

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [userRole, setUserRole] = useState<'Admin' | 'Manager' | 'Cashier'>('Cashier');
  const [shopName, setShopName] = useState<string>('DO BILL');
  const ability = useMemo(() => defineAbilityFor(userRole), [userRole]);
  
  const refreshProducts = async () => {
    try {
      const data = await DataService.getProducts();
      setProducts(Array.isArray(data) ? data : []);
      const shop = await DataService.getShopDetails();
      if (shop?.name) setShopName(shop.name);
    } catch (e) {
      console.error("Inventory load error:", e);
      setProducts([]);
    }
  };

  useEffect(() => {
    refreshProducts();
    getCurrentUserRole().then(setUserRole);
    return DataService.subscribe(refreshProducts);
  }, []);

  const [search, setSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBarcodeViewOpen, setIsBarcodeViewOpen] = useState(false);
  const [selectedBarcode, setSelectedBarcode] = useState<string | null>(null);
  const [printQuantity, setPrintQuantity] = useState(1);
  const [printMode, setPrintMode] = useState<'sheet' | 'roll'>('roll');
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [printOnSave, setPrintOnSave] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Global Barcode Scanner in Inventory
  useBarcodeScanner((code) => {
    if (isDialogOpen) {
      // If adding/editing, set barcode field
      setEditingProduct(prev => ({ ...prev, barcode: code }));
      toast.success("Barcode scanned for new product");
    } else {
      // Otherwise use it for searching
      setSearch(code);
      toast.info(`Searching for product: ${code}`);
    }
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // Compress any product image (even huge 100MB-5GB+ photos) to ultra-small WebP/JPEG bytes (target <= 20 KB)
      const compressedDataUrl = await compressImageFile(file, { maxWidth: 500, maxHeight: 500, maxSizeBytes: 20 * 1024 });
      setEditingProduct(prev => ({ ...prev, imageUrl: compressedDataUrl, image_url: compressedDataUrl }));
      toast.success("Product image compressed & ready!");
    } catch (err) {
      console.error("Product image compression error:", err);
      toast.error("Failed to process product image");
    } finally {
      setIsUploading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      p.barcode.toLowerCase().includes(search.toLowerCase()) ||
      p.brand.toLowerCase().includes(search.toLowerCase())
    );
  }, [products, search]);

  const handleSave = async () => {
    if (!editingProduct) return;

    const prodName = editingProduct.name || (editingProduct as any).product_name || '';
    const sellingPrice = editingProduct.sellingPrice !== undefined && editingProduct.sellingPrice !== null
      ? editingProduct.sellingPrice
      : ((editingProduct as any).selling_price !== undefined && (editingProduct as any).selling_price !== null ? (editingProduct as any).selling_price : undefined);

    if (!prodName.trim() || sellingPrice === undefined || sellingPrice === null || isNaN(Number(sellingPrice))) {
      toast.error("Please fill required fields (Name and Price)");
      return;
    }

    const finalProdId = editingProduct.id || (editingProduct as any).product_id;
    const cleanedProduct = {
      ...editingProduct,
      id: finalProdId,
      product_id: finalProdId,
      name: prodName.trim(),
      product_name: prodName.trim(),
      barcode: editingProduct.barcode ? editingProduct.barcode.trim() : undefined,
      brand: editingProduct.brand ? editingProduct.brand.trim() : '',
      category: editingProduct.category ? editingProduct.category.trim() : '',
      sellingPrice: Number(sellingPrice),
      selling_price: Number(sellingPrice),
      purchasePrice: Number(editingProduct.purchasePrice ?? (editingProduct as any).purchase_price ?? 0),
      purchase_price: Number(editingProduct.purchasePrice ?? (editingProduct as any).purchase_price ?? 0),
      stockQuantity: Number(editingProduct.stockQuantity ?? (editingProduct as any).stock_quantity ?? 0),
      stock_quantity: Number(editingProduct.stockQuantity ?? (editingProduct as any).stock_quantity ?? 0),
      reorderLevel: Number(editingProduct.reorderLevel ?? (editingProduct as any).reorder_level ?? 0),
      reorder_level: Number(editingProduct.reorderLevel ?? (editingProduct as any).reorder_level ?? 0),
      gstPercent: Number(editingProduct.gstPercent ?? (editingProduct as any).gst_percent ?? 5),
      gst_percent: Number(editingProduct.gstPercent ?? (editingProduct as any).gst_percent ?? 5),
      unit: editingProduct.unit || 'pcs',
      imageUrl: editingProduct.imageUrl || (editingProduct as any).image_url || undefined,
      image_url: editingProduct.imageUrl || (editingProduct as any).image_url || undefined,
    };

    const toastId = toast.loading("Saving product...");
    try {
      await DataService.saveProduct(cleanedProduct);
      toast.dismiss(toastId);
      setIsDialogOpen(false);
      setEditingProduct(null);
      setPrintOnSave(false);
      toast.success("Product saved successfully");
      await refreshProducts();
    } catch (e: any) {
      toast.dismiss(toastId);
      console.error("Failed to save product:", e);
      toast.error(e.message || "Failed to save product. Please try again.");
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    const toastId = toast.loading("Removing product...");
    try {
      await DataService.deleteProduct(deleteConfirmId);
      toast.dismiss(toastId);
      toast.success("Product deleted successfully!");
    } catch (e: any) {
      toast.dismiss(toastId);
      toast.error(e.message || "Failed to delete product");
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const generateBarcodeFullHTML = () => {
    const previewArea = document.getElementById('printable-label-area');

    const totalLabels = Math.max(1, printQuantity || 1);
    const product = products.find(p => p.barcode === selectedBarcode);
    const name = product?.name || 'Product';
    const price = product?.sellingPrice ?? 0;
    const brand = shopName || product?.brand || 'DO BILL';

    let svgHTML = '';
    const rawSvgElement = previewArea ? previewArea.querySelector('svg') : null;
    if (rawSvgElement) {
      const clonedSvg = rawSvgElement.cloneNode(true) as SVGElement;
      const origW = parseFloat(clonedSvg.getAttribute('width') || '0') || rawSvgElement.getBoundingClientRect().width || 180;
      const origH = parseFloat(clonedSvg.getAttribute('height') || '0') || rawSvgElement.getBoundingClientRect().height || 42;
      
      clonedSvg.setAttribute('viewBox', `0 0 ${origW} ${origH}`);
      clonedSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      clonedSvg.removeAttribute('width');
      clonedSvg.removeAttribute('height');
      clonedSvg.setAttribute('style', 'width: 100% !important; max-width: 100% !important; height: auto !important; max-height: 100% !important; display: block !important; margin: 0 auto !important; overflow: visible !important;');
      svgHTML = clonedSvg.outerHTML;
    }

    if (!svgHTML && selectedBarcode) {
      svgHTML = `<div style="text-align: center; font-family: monospace; font-weight: 900; font-size: 11pt; color: #000; letter-spacing: 2px;">*${selectedBarcode}*</div>`;
    }

    const cards = Array(totalLabels).fill(0).map(() => `
      <div class="label-card">
        <div class="name">${name}</div>
        <div class="barcode-container">${svgHTML}</div>
      </div>
    `).join('');

    const cfg = getPrinterConfig();
    return buildBarcodeLabelHTML(cards, cfg.labelPrinterName || cfg.billPrinterName);
  };

  const handlePrint = async () => {
    const fullHTML = generateBarcodeFullHTML();
    if (!fullHTML) return;

    const cfg = getPrinterConfig();
    const toastId = toast.loading("🖨️ Printing barcode labels...");

    try {
      const { DirectPrintService } = await import('@/services/directPrintService');
      
      if (DirectPrintService.isPrinterConnected() && selectedBarcode) {
        const product = products.find(p => p.barcode === selectedBarcode);
        if (product) {
          try {
            await DirectPrintService.printBarcodeDirect(
              product.name,
              selectedBarcode,
              product.sellingPrice,
              shopName,
              printQuantity
            );
            toast.dismiss(toastId);
            toast.success("Barcodes Sent to Thermal Printer!");
            return;
          } catch (directErr) {
            console.warn("Direct thermal barcode print failed, falling back to universal print:", directErr);
          }
        }
      }

      const res = await universalPrintHTML(fullHTML, {
        printerName: cfg.labelPrinterName,
        isLabel: true
      });

      toast.dismiss(toastId);
      if (res.success) {
        toast.success("Barcodes Printed Successfully!");
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      console.error("Print failed:", err);
      toast.error(`Printing failed: ${err.message || err}`);
    }
  };

  const handleOpenNewWindow = async () => {
    const fullHTML = generateBarcodeFullHTML();
    if (!fullHTML) return;
    const { openInNewPrintWindow } = await import('@/services/directPrintService');
    openInNewPrintWindow(fullHTML);
    toast.success("Opened Barcode Page in New Tab/Window");
  };

  const handleDownloadHTML = async () => {
    const fullHTML = generateBarcodeFullHTML();
    if (!fullHTML) return;
    const { downloadPrintableHTML } = await import('@/services/directPrintService');
    downloadPrintableHTML(fullHTML, `${selectedBarcode || 'barcode'}-labels.html`);
    toast.success("Downloaded Barcode HTML! Open in RawBT or Print App to print.");
  };

  const handleConnectBluetoothThermal = async () => {
    try {
      const { DirectPrintService } = await import('@/services/directPrintService');
      const res = await DirectPrintService.connectBluetooth();
      if (res.success) {
        toast.success(`Connected to ${res.name}!`);
      } else {
        toast.error(res.error || "Bluetooth connection failed");
      }
    } catch (err: any) {
      toast.error(`Bluetooth error: ${err.message || err}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div className="flex items-center gap-2 w-full sm:flex-1 sm:max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search items..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 border-slate-200 w-full"
            />
          </div>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          {ability.can('manage', 'Products') && (
            <DialogTrigger render={
              <Button 
                onClick={() => setEditingProduct({ 
                  name: '',
                  barcode: String(Math.floor(10000000 + Math.random() * 90000000)),
                  brand: '',
                  category: '',
                  purchasePrice: undefined,
                  sellingPrice: undefined,
                  unit: 'pcs', 
                  gstPercent: undefined, 
                  stockQuantity: undefined, 
                  reorderLevel: undefined 
                })} 
                className="w-full sm:w-auto gap-2"
              >
                <Plus className="h-4 w-4" /> Add Product
              </Button>
            } />
          )}
          <DialogContent className="w-[95vw] max-w-5xl md:max-w-6xl xl:max-w-7xl max-h-[95vh] overflow-y-auto p-6 sm:p-10">
            <DialogHeader className="pb-4 border-b">
              <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Plus className="h-6 w-6 text-primary" />
                {editingProduct?.id ? 'Edit Product Details' : 'Add New Product to Inventory'}
              </DialogTitle>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Provide correct information to update the store stock database</p>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 py-6">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Product Name <span className="text-red-500">*</span></Label>
                  <Input 
                    placeholder="Enter product name..."
                    className="h-12 text-base font-semibold border-slate-200"
                    value={editingProduct?.name ?? ''} 
                    onChange={e => setEditingProduct({...editingProduct!, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                      Barcode (Machine Scan)
                      <Badge variant="outline" className="text-[8px] h-4 bg-emerald-50 text-emerald-600 border-emerald-100 uppercase tracking-widest">Max 8 Chars</Badge>
                    </Label>
                    <button
                      type="button"
                      onClick={() => setEditingProduct({
                        ...editingProduct!,
                        barcode: String(Math.floor(10000000 + Math.random() * 90000000))
                      })}
                      className="text-[10px] font-black text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 cursor-pointer transition-all"
                    >
                      ⚡ Auto 8-Digit
                    </button>
                  </div>
                  <Input 
                    placeholder="Scan or enter barcode (e.g. 89012345)..."
                    maxLength={8}
                    className="h-12 text-base font-mono font-bold border-slate-200"
                    value={editingProduct?.barcode ?? ''} 
                    onChange={e => setEditingProduct({...editingProduct!, barcode: e.target.value.substring(0, 8)})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Brand</Label>
                    <Input 
                      placeholder="e.g. Levi's"
                      className="h-12 text-sm font-semibold border-slate-200"
                      value={editingProduct?.brand ?? ''} 
                      onChange={e => setEditingProduct({...editingProduct!, brand: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Category</Label>
                    <Input 
                      placeholder="e.g. Shirts"
                      className="h-12 text-sm font-semibold border-slate-200"
                      value={editingProduct?.category ?? ''} 
                      onChange={e => setEditingProduct({...editingProduct!, category: e.target.value})} 
                    />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Product Photo</Label>
                  <div className="flex flex-col gap-3">
                    {(editingProduct?.imageUrl || (editingProduct as any)?.image_url) && (
                      <div className="relative w-full aspect-video rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                        <img src={editingProduct?.imageUrl || (editingProduct as any)?.image_url} alt="Preview" className="w-full h-full object-contain" />
                        <Button 
                          type="button"
                          size="icon" 
                          variant="destructive" 
                          className="absolute top-2 right-2 h-7 w-7 rounded-full shadow-lg"
                          onClick={() => setEditingProduct(prev => (prev ? {...prev, imageUrl: undefined, image_url: undefined} : null))}
                        >
                          <Plus className="h-4 w-4 rotate-45" />
                        </Button>
                      </div>
                    )}
                    
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                    />
                    
                    <Button 
                      variant="outline" 
                      className="w-full h-28 border-dashed border-2 flex flex-col gap-2 hover:bg-slate-50 transition-colors rounded-xl border-slate-300"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                      ) : (
                        <Upload className="h-6 w-6 text-slate-400" />
                      )}
                      <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                        {isUploading ? "Uploading Item Photo..." : "Upload Product Image"}
                      </div>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Purchase Price (₹)</Label>
                    <Input 
                      type="number" 
                      className="h-12 text-base font-bold border-slate-200"
                      value={editingProduct?.purchasePrice ?? ''} 
                      onChange={e => setEditingProduct({...editingProduct!, purchasePrice: e.target.value === '' ? undefined : Number(e.target.value)})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Selling Price (₹) <span className="text-red-500">*</span></Label>
                    <Input 
                      type="number" 
                      className="h-12 text-base font-black border-slate-200 text-primary"
                      value={editingProduct?.sellingPrice ?? ''} 
                      onChange={e => setEditingProduct({...editingProduct!, sellingPrice: e.target.value === '' ? undefined : Number(e.target.value)})} 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Stock Quantity</Label>
                    <Input 
                      type="number" 
                      className="h-12 text-base font-bold border-slate-200"
                      value={editingProduct?.stockQuantity ?? ''} 
                      onChange={e => setEditingProduct({...editingProduct!, stockQuantity: e.target.value === '' ? undefined : Number(e.target.value)})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Reorder Level</Label>
                    <Input 
                      type="number" 
                      className="h-12 text-base font-bold border-slate-200"
                      value={editingProduct?.reorderLevel ?? ''} 
                      onChange={e => setEditingProduct({...editingProduct!, reorderLevel: e.target.value === '' ? undefined : Number(e.target.value)})} 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">GST (%)</Label>
                    <Input 
                      type="number" 
                      className="h-12 text-base font-bold border-slate-200"
                      value={editingProduct?.gstPercent ?? ''} 
                      onChange={e => setEditingProduct({...editingProduct!, gstPercent: e.target.value === '' ? undefined : Number(e.target.value)})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Unit</Label>
                    <Select value={editingProduct?.unit ?? ''} onValueChange={v => setEditingProduct({...editingProduct!, unit: v})}>
                      <SelectTrigger className="h-12 border-slate-200 font-semibold text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pcs">Pieces (Pcs)</SelectItem>
                        <SelectItem value="kg">Kilogram (Kg)</SelectItem>
                        <SelectItem value="ltr">Liter (Ltr)</SelectItem>
                        <SelectItem value="box">Box</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="border-t pt-5 mt-4 gap-2">
              <Button variant="outline" size="lg" className="h-12 font-bold px-6 border-slate-200" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} size="lg" className="h-12 font-black uppercase tracking-wider px-8 gap-2 shadow-lg">
                Save Product
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Desktop & Tablet Table Layout (Hidden on Mobile/Tablets) */}
      <Card className="hidden lg:block border-none shadow-sm shadow-slate-200/50 no-print overflow-hidden relative">
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-hide">
            <Table className="no-print min-w-[850px]">
          <TableHeader className="bg-slate-100/50">
            <TableRow>
              <TableHead className="w-[100px] text-[10px] font-black uppercase tracking-widest pl-6">Picture</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest pl-4">Item Name & ID</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Category</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Price</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Available Stock</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-right pr-6">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.map((p) => (
              <TableRow key={p.id} className="group">
                <TableCell>
                  <div className="h-10 w-10 bg-slate-100 rounded border border-slate-200 overflow-hidden flex items-center justify-center">
                    {(p.imageUrl || (p as any).image_url) ? (
                      <img src={p.imageUrl || (p as any).image_url} alt={p.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-slate-300" />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-semibold text-slate-800">{p.name}</div>
                  <div className="text-xs text-slate-400 mb-1.5">{p.brand}</div>
                  {p.barcode && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/50">
                        {p.barcode}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="xs" 
                        className="h-5 px-1.5 text-[8px] bg-slate-100 hover:bg-slate-200 uppercase font-black tracking-tighter"
                        onClick={() => { setSelectedBarcode(p.barcode); setIsBarcodeViewOpen(true); }}
                      >
                        <BarcodeIcon className="h-3 w-3 mr-1" /> Label
                      </Button>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-normal border-slate-200">{p.category}</Badge>
                </TableCell>
                <TableCell className="text-right font-bold text-slate-700">₹{p.sellingPrice.toFixed(2)}</TableCell>
                <TableCell className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className={`text-base font-bold ${p.stockQuantity <= p.reorderLevel ? 'text-orange-500' : 'text-slate-700'}`}>
                      {p.stockQuantity} {p.unit}
                    </span>
                    {p.stockQuantity <= p.reorderLevel && (
                      <Badge variant="destructive" className="py-0 px-1 text-[8px] h-4 uppercase animate-pulse">Low Stock</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {ability.can('manage', 'Products') ? (
                    <div className="flex justify-end gap-1.5">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 px-2.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200 rounded-lg shadow-xs cursor-pointer"
                        onClick={() => { setEditingProduct({ ...p }); setIsDialogOpen(true); }}
                      >
                        <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 px-2 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border-red-200 rounded-lg shadow-xs cursor-pointer"
                        onClick={() => handleDelete(p.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-end pr-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded border border-slate-200/50">Locked</span>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      </CardContent>
    </Card>

    {/* Mobile & Tablet Card Grid Layout (Shown on Mobile/Tablets, Hidden on Desktop) */}
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 lg:hidden no-print">
      {filteredProducts.map((p) => (
        <Card key={p.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white p-4 flex flex-col justify-between">
          <div className="flex gap-4">
            <div className="h-16 w-16 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
              {(p.imageUrl || (p as any).image_url) ? (
                <img src={p.imageUrl || (p as any).image_url} alt={p.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <ImageIcon className="h-8 w-8 text-slate-300" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-1.5">
                <h3 className="font-extrabold text-slate-800 text-sm leading-tight truncate">{p.name}</h3>
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-bold border-slate-200 uppercase tracking-wide bg-slate-50 shrink-0">
                  {p.category}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">{p.brand || 'No Brand'}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="font-mono text-[10px] font-bold text-slate-500">{p.barcode}</span>
                <Button 
                  variant="ghost" 
                  size="xs" 
                  className="h-5 px-1.5 text-[8.5px] bg-slate-100 hover:bg-slate-200 uppercase font-black tracking-tighter rounded"
                  onClick={() => { setSelectedBarcode(p.barcode); setIsBarcodeViewOpen(true); }}
                >
                  <BarcodeIcon className="h-3 w-3 mr-1" /> Label
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-3.5 mt-3.5">
            <div className="flex flex-col">
              <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider">Price</span>
              <span className="font-black text-slate-800 text-sm mt-0.5">₹{p.sellingPrice.toFixed(2)}</span>
            </div>
            
            <div className="flex flex-col items-center">
              <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider">Stock</span>
              <span className={`text-xs font-black mt-0.5 ${p.stockQuantity <= p.reorderLevel ? 'text-orange-500 font-black' : 'text-slate-700'}`}>
                {p.stockQuantity} {p.unit}
              </span>
              {p.stockQuantity <= p.reorderLevel && (
                <Badge variant="destructive" className="py-0 px-1 text-[7px] h-3.5 uppercase mt-0.5 tracking-wide animate-pulse">Low</Badge>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {ability.can('manage', 'Products') ? (
                <>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8 text-blue-600 hover:bg-blue-50 border-slate-150 rounded-xl"
                    onClick={() => { setEditingProduct({ ...p }); setIsDialogOpen(true); }}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8 text-red-600 hover:bg-red-50 border-slate-150 rounded-xl"
                    onClick={() => handleDelete(p.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded border border-slate-200/50">Locked</span>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>

      {/* Barcode Label Dialog */}
      <Dialog open={isBarcodeViewOpen} onOpenChange={setIsBarcodeViewOpen}>
        <DialogContent className="sm:max-w-2xl lg:max-w-3xl p-0 overflow-hidden max-h-[90vh] flex flex-col rounded-3xl border-0 shadow-2xl">
          <DialogHeader className="p-6 pb-4 border-b shrink-0 bg-white">
            <DialogTitle className="text-xl font-bold flex items-center gap-2.5 text-slate-800">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <BarcodeIcon className="h-5 w-5" />
              </div>
              Barcode Label Generator
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1 bg-slate-50/50">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Left Column: Label Preview */}
              <div className="md:col-span-5 flex flex-col items-center justify-center p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm relative group">
                <div className="absolute top-3 right-3">
                  <Badge variant="outline" className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-slate-200">
                    Live Preview
                  </Badge>
                </div>
                
                {selectedBarcode && (() => {
                  const cfg = getPrinterConfig();
                  const dims = detectAutoLabelDimensions(cfg.labelPrinterName || cfg.billPrinterName);
                  return (
                    <div 
                      id="printable-label-area" 
                      style={{
                        aspectRatio: `${dims.widthMm} / ${dims.heightMm}`,
                      }}
                      className="bg-white p-2 rounded-xl shadow-md border border-slate-300 overflow-visible max-w-[260px] w-full flex flex-col items-center justify-center gap-1.5 text-center mt-2 transition-all duration-300 min-h-[120px]"
                    >
                      <div className="name line-clamp-2 w-full text-center font-black text-[10px] sm:text-xs text-slate-900 px-1 leading-tight">
                        {products.find(p => p.barcode === selectedBarcode)?.name || 'Product'}
                      </div>
                      <div className="barcode-container flex justify-center items-center w-full py-0.5 overflow-visible">
                        <Barcode 
                          value={selectedBarcode} 
                          width={getBarcodeBarWidth(selectedBarcode)}
                          height={36} 
                          fontSize={10}
                          background="transparent"
                          margin={3}
                        />
                      </div>
                    </div>
                  );
                })()}
                <p className="mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-[0.15em] text-center">
                  Thermal Sticker • {shopName}
                </p>
              </div>

              {/* Right Column: Settings & Printing Controls */}
              <div className="md:col-span-7 space-y-4">
                <div className="space-y-3">
                  {/* Quick Presets */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Select</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[1, 5, 10, 50, 100, 200, 500, 1000].map(qty => (
                        <button
                          key={qty}
                          type="button"
                          onClick={() => setPrintQuantity(qty)}
                          className={`px-3 py-1.5 text-xs font-black rounded-xl border transition-all ${
                            printQuantity === qty 
                              ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20' 
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {qty}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                    <div className="flex items-center gap-3">
                      <Input 
                        type="number" 
                        min={1} 
                        max={10000} 
                        value={printQuantity || ''} 
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '') {
                            setPrintQuantity(0);
                          } else {
                            const num = parseInt(val, 10);
                            if (!isNaN(num)) {
                              setPrintQuantity(Math.max(1, num));
                            }
                          }
                        }}
                        onBlur={() => {
                          if (!printQuantity || printQuantity < 1) {
                            setPrintQuantity(1);
                          }
                        }}
                        placeholder="Qty..."
                        className="h-11 w-28 text-center font-black text-base bg-slate-50 border-slate-200 rounded-xl focus:bg-white"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-800 font-bold leading-tight">
                          Custom Print Quantity
                        </p>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          Printing <strong>{printQuantity}</strong> {printQuantity === 1 ? 'label' : 'labels'} with auto-fit thermal engine.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>


              </div>
            </div>
          </div>

          <DialogFooter className="p-5 sm:p-6 bg-white border-t border-slate-100 sm:justify-between no-print shrink-0">
            <Button variant="ghost" onClick={() => setIsBarcodeViewOpen(false)} className="font-bold text-slate-500 h-11 rounded-xl">Cancel</Button>
            <div className="flex items-center gap-2">
              <Button onClick={handlePrint} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 h-11 px-8 font-black uppercase tracking-tight rounded-xl">
                <Printer className="h-4 w-4" /> 
                Print {printQuantity} {printQuantity === 1 ? 'Label' : 'Labels'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deletion Confirmation Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-[420px] p-6 rounded-3xl" id="delete-confirmation-dialog">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-red-500 shrink-0" />
              Delete Product
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm font-medium text-slate-500 leading-relaxed font-sans">
              Are you sure you want to permanently delete this product? This action is irreversible and will remove the item from all active POS inventory lookups.
            </p>
          </div>
          <DialogFooter className="flex gap-3 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              className="flex-1 font-bold h-11 border-slate-200"
            >
              CANCEL
            </Button>
            <Button
              variant="default"
              onClick={handleConfirmDelete}
              className="flex-1 font-bold h-11 bg-red-600 hover:bg-red-700 text-white font-sans"
            >
              CONFIRM DELETE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Universal Printer Picker Modal */}
      <PrinterPickerModal open={isPrinterModalOpen} onOpenChange={setIsPrinterModalOpen} />
    </div>
  );
}
