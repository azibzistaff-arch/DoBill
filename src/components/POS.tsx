import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Barcode, 
  Trash2, 
  Plus, 
  Minus, 
  X, 
  PauseCircle, 
  PlayCircle, 
  Printer, 
  Wallet,
  AlertCircle,
  ShoppingCart,
  Package,
  Coins,
  QrCode,
  Smartphone,
  CheckCircle2,
  HardDrive,
  Banknote,
  History,
  User,
  Phone,
  MapPin,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Mail,
  Camera
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { CartItem, Product, Sale } from '@/types';
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
import { DataService, ShopDetails } from '@/services/dataService';
import { QRCodeSVG } from 'qrcode.react';
import { ReceiptTemplate } from './ReceiptTemplate';
import { safeLocalStorage } from '@/utils/safeStorage';
import { handlePrint, DirectPrintService } from '@/services/directPrintService';
import { PrinterPickerModal } from './PrinterPickerModal';
import { CameraBarcodeScannerModal } from './CameraBarcodeScannerModal';
import { getTranslation, LanguageType } from '@/utils/lang';

const localStorage = safeLocalStorage;

const getWorkspaceCartKey = (workspace?: string) => {
  const active = workspace || DataService.getActiveWorkspace();
  return `retailpro_cart_${active.trim().toLowerCase()}`;
};

const getWorkspaceHeldBillsKey = (workspace?: string) => {
  const active = workspace || DataService.getActiveWorkspace();
  return `retailpro_held_bills_${active.trim().toLowerCase()}`;
};

const loadWorkspaceCart = (ws?: string): CartItem[] => {
  try {
    const key = getWorkspaceCartKey(ws);
    const saved = localStorage.getItem(key);
    if (!saved || saved === "null") return [];
    const parsed = JSON.parse(saved) || [];
    return parsed.map((item: any) => ({
      ...item,
      discountPercent: item.discountPercent !== undefined ? item.discountPercent : 0
    }));
  } catch {
    return [];
  }
};

const loadWorkspaceHeldBills = (ws?: string): CartItem[][] => {
  try {
    const key = getWorkspaceHeldBillsKey(ws);
    const saved = localStorage.getItem(key);
    if (!saved || saved === "null") return [];
    return JSON.parse(saved) || [];
  } catch {
    return [];
  }
};

export default function POS() {
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

  const [cart, setCart] = useState<CartItem[]>(() => loadWorkspaceCart());
  const [barcode, setBarcode] = useState('');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<Product[]>([]);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [cashReceived, setCashReceived] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi'>('cash');
  const [heldBills, setHeldBills] = useState<CartItem[][]>(() => loadWorkspaceHeldBills());
  const [saleDate, setSaleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [printSale, setPrintSale] = useState<Sale | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPrinterPicker, setShowPrinterPicker] = useState(false);
  const [shopDetails, setShopDetails] = useState<ShopDetails | null>(null);
  const [userProfile, setUserProfile] = useState<{ name: string; email: string; avatar?: string } | null>(null);
  const lastScanned = useRef<{ code: string; time: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter products for dropdown search suggestions
  useEffect(() => {
    const query = barcode.trim().toLowerCase();
    if (!query) {
      setSearchSuggestions([]);
      return;
    }

    const filtered = allProducts.filter(p => 
      p.name.toLowerCase().includes(query) ||
      p.barcode.toLowerCase().includes(query) ||
      (p.brand && p.brand.toLowerCase().includes(query)) ||
      (p.category && p.category.toLowerCase().includes(query))
    );
    setSearchSuggestions(filtered.slice(0, 8));
  }, [barcode, allProducts]);

  // Refs to always access absolute latest state in global keyboard shortcut handlers without stale closures
  const cartRef = useRef<CartItem[]>(cart);
  const heldBillsRef = useRef<CartItem[][]>(heldBills);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    heldBillsRef.current = heldBills;
  }, [heldBills]);

  const [merchantUpiId, setMerchantUpiId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [dialogStep, setDialogStep] = useState<'customer' | 'payment'>('customer');

  // Quick Add State
  const [isQuickAddDialogOpen, setIsQuickAddDialogOpen] = useState(false);
  const [quickAddBarcode, setQuickAddBarcode] = useState('');
  const [quickName, setQuickName] = useState('');
  const [quickBrand, setQuickBrand] = useState('');
  const [quickCategory, setQuickCategory] = useState('');
  const [quickPurchasePrice, setQuickPurchasePrice] = useState('');
  const [quickSellingPrice, setQuickSellingPrice] = useState('');
  const [quickGstPercent, setQuickGstPercent] = useState('18');
  const [quickStockQuantity, setQuickStockQuantity] = useState('100');
  const [quickReorderLevel, setQuickReorderLevel] = useState('5');
  const [quickUnit, setQuickUnit] = useState('pcs');

  // Multi-match Dialog State (identical barcodes for different units of same product type)
  const [isMultiMatchDialogOpen, setIsMultiMatchDialogOpen] = useState(false);
  const [multiMatchCandidates, setMultiMatchCandidates] = useState<Product[]>([]);

  // Camera Barcode Scanner State
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);

  const handleUpdateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id || (item as any).product_id === id) {
        const freshProd = allProducts.find(p => p.id === id || (p as any).product_id === id || (item.barcode && p.barcode === item.barcode)) || item;
        const availableStock = freshProd.stockQuantity !== undefined && freshProd.stockQuantity !== null 
          ? freshProd.stockQuantity 
          : ((freshProd as any).stock_quantity ?? 99999);
        
        const newQty = item.quantity + delta;
        if (newQty <= 0) return null;
        if (newQty > availableStock) {
          toast.error(`Stock limit reached for "${item.name}" (${availableStock} pcs max)`);
          return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(Boolean) as CartItem[]);
  };

  const handleRemoveFromCart = (id: string) => {
    setCart(prev => prev.filter(c => c.id !== id && (c as any).product_id !== id));
  };

  useEffect(() => {
    if (isPaymentDialogOpen) {
      setDialogStep('customer');
      setIsCheckingOut(false);
    }
  }, [isPaymentDialogOpen]);

  useEffect(() => {
    const init = async () => {
      const activeWs = DataService.getActiveWorkspace();

      // Clear legacy static non-workspace-isolated cart keys
      localStorage.removeItem('retailpro_current_cart');
      localStorage.removeItem('retailpro_held_bills');

      const upi = await DataService.getUPIId();
      setMerchantUpiId(upi);
      const shop = await DataService.getShopDetails();
      setShopDetails(shop);
      const profile = await DataService.getUserProfile();
      setUserProfile(profile);

      // Fetch products belonging strictly to this active workspace
      const prods = await DataService.getProducts();
      setAllProducts(prods);

      // Load workspace-specific cart & held bills
      const rawWsCart = loadWorkspaceCart(activeWs);
      const rawWsHeldBills = loadWorkspaceHeldBills(activeWs);

      // Multi-tenant Security & Integrity Guard:
      // Filter out any cart item or held bill item that does NOT exist in current active workspace inventory!
      const validCart = rawWsCart.filter(item => {
        return prods.some(p => 
          p.id === item.id || 
          (p as any).product_id === item.id ||
          (item.barcode && p.barcode && p.barcode.trim().toLowerCase() === item.barcode.trim().toLowerCase()) ||
          p.name.trim().toLowerCase() === item.name.trim().toLowerCase()
        );
      });

      const validHeldBills = rawWsHeldBills.map(bill => 
        bill.filter(item => 
          prods.some(p => 
            p.id === item.id || 
            (p as any).product_id === item.id ||
            (item.barcode && p.barcode && p.barcode.trim().toLowerCase() === item.barcode.trim().toLowerCase()) ||
            p.name.trim().toLowerCase() === item.name.trim().toLowerCase()
          )
        )
      ).filter(bill => bill.length > 0);

      setCart(validCart);
      setHeldBills(validHeldBills);

      // Persist cleaned workspace cart back
      localStorage.setItem(getWorkspaceCartKey(activeWs), JSON.stringify(validCart));
      localStorage.setItem(getWorkspaceHeldBillsKey(activeWs), JSON.stringify(validHeldBills));
    };

    init();

    // Subscribe to real-time data sync events
    const unsubscribe = DataService.subscribe(() => {
      init();
    });
    return () => unsubscribe();
  }, []);

  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Persist cart to workspace-isolated localStorage whenever it changes
  useEffect(() => {
    const activeWs = DataService.getActiveWorkspace();
    localStorage.setItem(getWorkspaceCartKey(activeWs), JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    const activeWs = DataService.getActiveWorkspace();
    localStorage.setItem(getWorkspaceHeldBillsKey(activeWs), JSON.stringify(heldBills));
  }, [heldBills]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // F1 - Focus Search
      if (e.key === 'F1') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // F9 - Hold Bill
      if (e.key === 'F9') {
        e.preventDefault();
        handleHoldBill();
      }
      // F10 - Checkout
      if (e.key === 'F10') {
        e.preventDefault();
        if (cartRef.current.length > 0) {
          let stockErr: string | null = null;
          for (const item of cartRef.current) {
            const freshProd = allProducts.find(p => p.id === item.id || (p as any).product_id === item.id || (item.barcode && p.barcode === item.barcode)) || item;
            const avail = freshProd.stockQuantity !== undefined && freshProd.stockQuantity !== null 
              ? freshProd.stockQuantity 
              : ((freshProd as any).stock_quantity ?? item.stockQuantity ?? 0);
            if (item.quantity > avail) {
              stockErr = `"${item.name}" quantity (${item.quantity}) exceeds available inventory stock (${avail} pcs)`;
              break;
            }
          }
          if (stockErr) {
            toast.error(`Bill creation blocked! ${stockErr}`);
            return;
          }
          setIsPaymentDialogOpen(true);
        }
      }
      // Delete - Clear Cart
      if (e.key === 'Delete' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        if (cartRef.current.length > 0 && window.confirm("Clear current cart?")) {
          setCart([]);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, []);

  const totals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;

    cart.forEach(item => {
      const rate = item.sellingPrice;
      const qty = item.quantity;
      const discPercent = item.discountPercent || 0;
      
      const lineSubtotal = rate * qty;
      const lineDiscount = lineSubtotal * (discPercent / 100);
      const taxable = lineSubtotal - lineDiscount;
      const lineTax = taxable * (item.gstPercent / 100);

      subtotal += taxable;
      taxTotal += lineTax;
      discountTotal += lineDiscount;
    });

    return { 
      subtotal, 
      taxTotal, 
      discountTotal,
      grandTotal: subtotal + taxTotal 
    };
  }, [cart]);

  const changeDue = Math.max(0, (parseFloat(cashReceived) || 0) - totals.grandTotal);

  const getCartStockError = (items: CartItem[]) => {
    if (!items || items.length === 0) return null;

    for (const item of items) {
      const freshProd = allProducts.find(p => p.id === item.id || (p as any).product_id === item.id || (item.barcode && p.barcode === item.barcode)) || item;
      const avail = freshProd.stockQuantity !== undefined && freshProd.stockQuantity !== null 
        ? freshProd.stockQuantity 
        : ((freshProd as any).stock_quantity ?? item.stockQuantity ?? 0);

      if (item.quantity > avail) {
        return `"${item.name}" quantity (${item.quantity}) exceeds available stock (${avail} pcs)`;
      }
    }
    return null;
  };

  const tryOpenPaymentModal = () => {
    if (cart.length === 0) return;
    const stockErr = getCartStockError(cart);
    if (stockErr) {
      toast.error(`Bill creation blocked! ${stockErr}. Please reduce cart quantity before proceeding.`);
      return;
    }
    setIsPaymentDialogOpen(true);
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, [cart, isPaymentDialogOpen]);

  const addToCart = (product: Product) => {
    // 1. Fetch fresh product data from allProducts to ensure latest inventory stock level
    const freshProd = allProducts.find(p => 
      (product.id && (p.id === product.id || (p as any).product_id === product.id)) ||
      (product.barcode && product.barcode.trim() !== '' && p.barcode && p.barcode.trim().toLowerCase() === product.barcode.trim().toLowerCase()) ||
      (product.name && p.name && p.name.trim().toLowerCase() === product.name.trim().toLowerCase())
    ) || product;

    const availableStock = freshProd.stockQuantity !== undefined && freshProd.stockQuantity !== null 
      ? freshProd.stockQuantity 
      : ((freshProd as any).stock_quantity ?? 0);

    // 2. Strict Out of Stock check BEFORE touching cart state or showing success toast
    if (availableStock <= 0) {
      toast.error(`Out of Stock! "${freshProd.name}" has 0 pcs available in inventory.`);
      return;
    }

    // 3. Check if adding 1 more would exceed available inventory stock
    const existingInCart = cart.find(item => 
      (product.id && (item.id === product.id || (item as any).product_id === product.id)) ||
      (product.barcode && product.barcode.trim() !== '' && item.barcode && item.barcode.trim().toLowerCase() === product.barcode.trim().toLowerCase()) ||
      (product.name && item.name && item.name.trim().toLowerCase() === product.name.trim().toLowerCase())
    );

    const currentQtyInCart = existingInCart ? existingInCart.quantity : 0;

    if (currentQtyInCart >= availableStock) {
      toast.error(`Stock limit reached for "${freshProd.name}"! Only ${availableStock} pcs available in inventory.`);
      return;
    }

    // 4. Safely update cart state
    setCart(prev => {
      const foundInPrev = prev.find(item => 
        (product.id && (item.id === product.id || (item as any).product_id === product.id)) ||
        (product.barcode && product.barcode.trim() !== '' && item.barcode && item.barcode.trim().toLowerCase() === product.barcode.trim().toLowerCase()) ||
        (product.name && item.name && item.name.trim().toLowerCase() === product.name.trim().toLowerCase())
      );

      if (foundInPrev) {
        return prev.map(item => 
          (item === foundInPrev)
            ? { ...item, quantity: item.quantity + 1, stockQuantity: availableStock }
            : item
        );
      } else {
        return [...prev, { ...product, id: freshProd.id || product.id, stockQuantity: availableStock, quantity: 1, discountPercent: 0 }];
      }
    });

    toast.success(`${freshProd.name} added`);
  };

  const handleManualScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode) return;

    const query = barcode.trim().toLowerCase();
    // 1. Direct match on exact barcode or name
    const exactMatch = allProducts.find(p => 
      p.barcode.toLowerCase() === query || 
      p.name.toLowerCase() === query
    );
    if (exactMatch) {
      addToCart(exactMatch);
      setBarcode('');
      setSearchSuggestions([]);
      return;
    }

    // 2. Add first search suggestion if available
    const firstSuggestion = searchSuggestions[0];
    if (firstSuggestion) {
      addToCart(firstSuggestion);
      setBarcode('');
      setSearchSuggestions([]);
      return;
    }

    await processBarcode(barcode);
    setBarcode('');
  };

  const [showScanVisual, setShowScanVisual] = useState(false);

  const triggerScanVisual = () => {
    setShowScanVisual(true);
    setTimeout(() => setShowScanVisual(false), 300);
  };

  const processBarcode = async (code: string) => {
    const now = Date.now();
    if (lastScanned.current && lastScanned.current.code === code && (now - lastScanned.current.time) < 1500) {
      // Prevent rapid duplicate scans (1.5s cooldown for same item)
      return;
    }

    const matches = await DataService.getProductsByBarcode(code);
    if (matches && matches.length > 0) {
      lastScanned.current = { code, time: now };
      if (matches.length === 1) {
        addToCart(matches[0]);
        triggerScanVisual();
      } else {
        // Multi units found with identical barcode! Pop select dialog
        setMultiMatchCandidates(matches);
        setIsMultiMatchDialogOpen(true);
      }
      setBarcode(''); // Clear manual typed text
    } else {
      // Show elegant toast and automatically trigger Quick Add Dialog prefilled with scanning barcode!
      toast.error(`Product not found: ${code}`, {
        action: {
          label: 'Quick Add Product',
          onClick: () => {
             setQuickAddBarcode(code);
             setQuickName('');
             setQuickBrand('');
             setQuickCategory('');
             setQuickPurchasePrice('');
             setQuickSellingPrice('');
             setIsQuickAddDialogOpen(true);
          }
        }
      });
      
      setQuickAddBarcode(code);
      setQuickName('');
      setQuickBrand('');
      setQuickCategory('');
      setQuickPurchasePrice('');
      setQuickSellingPrice('');
      setIsQuickAddDialogOpen(true);
      setBarcode(''); // Clear invalid scan/type
    }
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName.trim()) {
      toast.error("Product name is required!");
      return;
    }
    if (!quickSellingPrice || parseFloat(quickSellingPrice) <= 0) {
      toast.error("Selling price is required and must be greater than 0!");
      return;
    }

    const newProduct: Partial<Product> = {
      barcode: quickAddBarcode,
      name: quickName.trim(),
      brand: quickBrand.trim() || 'Generic',
      category: quickCategory.trim() || 'General',
      purchasePrice: parseFloat(quickPurchasePrice) || 0,
      sellingPrice: parseFloat(quickSellingPrice),
      gstPercent: parseFloat(quickGstPercent) || 0,
      stockQuantity: parseInt(quickStockQuantity) || 0,
      reorderLevel: parseInt(quickReorderLevel) || 0,
      unit: quickUnit
    };

    const success = await DataService.saveProduct(newProduct);
    if (success) {
      toast.success(`${quickName} registered successfully!`);
      setIsQuickAddDialogOpen(false);
      
      // Auto-add to cart
      setTimeout(async () => {
        const addedProd = await DataService.getProductByBarcode(quickAddBarcode);
        if (addedProd) {
          addToCart(addedProd);
          triggerScanVisual();
        }
      }, 500);
    } else {
      toast.error("Failed to register product.");
    }
  };

  useBarcodeScanner(processBarcode);

  const updateQuantity = (id: string, delta: number) => {
    const targetItem = cart.find(item => item.id === id || (item as any).product_id === id);
    if (!targetItem) return;

    if (delta > 0) {
      const freshProd = allProducts.find(p => p.id === targetItem.id || (p as any).product_id === targetItem.id || (targetItem.barcode && p.barcode === targetItem.barcode)) || targetItem;
      const availableStock = freshProd.stockQuantity !== undefined && freshProd.stockQuantity !== null 
        ? freshProd.stockQuantity 
        : ((freshProd as any).stock_quantity ?? targetItem.stockQuantity ?? 0);

      if (targetItem.quantity >= availableStock) {
        toast.error(`Stock limit reached for "${freshProd.name}"! Only ${availableStock} pcs available in inventory.`);
        return;
      }
    }

    setCart(prev => prev.map(item => {
      if (item.id === id || (item as any).product_id === id) {
        const freshProd = allProducts.find(p => p.id === item.id || (p as any).product_id === item.id || (item.barcode && p.barcode === item.barcode)) || item;
        const availableStock = freshProd.stockQuantity !== undefined && freshProd.stockQuantity !== null ? freshProd.stockQuantity : ((freshProd as any).stock_quantity ?? item.stockQuantity ?? 0);

        const newQty = item.quantity + delta;
        return { ...item, quantity: Math.max(0, newQty), stockQuantity: availableStock };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const handleHoldBill = () => {
    const currentCart = cartRef.current;
    if (currentCart.length === 0) {
      const currentHeld = heldBillsRef.current;
      if (currentHeld.length > 0) {
        // Resume the most recently held bill
        handleResumeBill(currentHeld.length - 1);
      } else {
        toast.info("No held bills to resume");
      }
      return;
    }
    // Deep copy current items in the cart to avoid any reference sharing or async side-effect overwrites
    const cartCopy = currentCart.map(item => ({ ...item }));
    setHeldBills(prevHeld => [...prevHeld, cartCopy]);
    setCart([]);
    toast.success("Bill placed on hold!");
  };

  const handleResumeBill = (index: number) => {
    const currentHeld = heldBillsRef.current;
    const resumedBill = currentHeld[index];
    if (!resumedBill || resumedBill.length === 0) return;

    setCart(prev => {
      const mergedCart = [...prev];
      resumedBill.forEach(resItem => {
        const existingIdx = mergedCart.findIndex(item => item.id === resItem.id);
        if (existingIdx > -1) {
          // Add quantities together so user modifications are preserved and cumulated
          mergedCart[existingIdx] = {
            ...mergedCart[existingIdx],
            quantity: mergedCart[existingIdx].quantity + resItem.quantity
          };
        } else {
          // Deep-copy resumed item
          mergedCart.push({ ...resItem });
        }
      });
      return mergedCart;
    });

    setHeldBills(prevHeld => prevHeld.filter((_, i) => i !== index));
    toast.success("Bill resumed & merged with active cart successfully!");
  };

  const buildReceiptHTML = (sale: Sale) => {
    const shopName = shopDetails?.name || 'STORE RECEIPT';
    const shopAddress = shopDetails?.address || '';
    const shopPhone = shopDetails?.phone || '';
    const is80 = (shopDetails?.paperSize || '80mm') === '80mm';
    const paperVal = is80 ? '80mm' : '58mm';
    const widthVal = is80 ? '72mm' : '52mm';

    const customerRows = [];
    if (sale.customerName) {
      customerRows.push(`
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5mm;">
          <span style="font-weight: bold; color: #1e293b;">Customer:</span>
          <span style="font-weight: 900; text-transform: uppercase;">${sale.customerName}</span>
        </div>
      `);
    }
    if (sale.customerPhone) {
      customerRows.push(`
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5mm;">
          <span style="font-weight: bold; color: #1e293b;">Phone:</span>
          <span>${sale.customerPhone}</span>
        </div>
      `);
    }
    if (sale.customerAddress) {
      customerRows.push(`
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5mm;">
          <span style="font-weight: bold; color: #1e293b;">Address:</span>
          <span style="text-align: right; max-width: 60%; word-break: break-all;">${sale.customerAddress}</span>
        </div>
      `);
    }

    const itemsRows = (sale.items || []).map(item => `
      <tr style="border-bottom: 1px dashed #e2e8f0;">
        <td style="padding: 1.5mm 0; text-align: left;">
          <div style="font-weight: 900; line-height: 1.1; font-size: 11px;">${item.name}</div>
          <div style="font-size: 9px; color: #475569; margin-top: 0.2mm;">@₹${item.sellingPrice.toFixed(2)}</div>
        </td>
        <td style="text-align: center; padding: 1.5mm 0; font-weight: bold;">${item.quantity}</td>
        <td style="text-align: right; padding: 1.5mm 0; font-weight: bold;">₹${(item.sellingPrice * item.quantity).toFixed(2)}</td>
      </tr>
    `).join('');

    const changeRows = sale.paymentMode === 'cash' ? `
      <div style="display: flex; justify-content: space-between; margin-top: 0.5mm;">
        <span>Cash Paid:</span>
        <span>₹${sale.cashReceived.toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-top: 0.5mm; font-weight: bold;">
        <span>Change Due:</span>
        <span>₹${sale.changeDue.toFixed(2)}</span>
      </div>
    ` : '';

    return `
      <style>
        @media print {
          @page {
            margin: 0 !important;
            size: ${paperVal} auto !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: ${paperVal} !important;
            background: white !important;
          }
          .thermal-receipt {
            width: ${widthVal} !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 1mm 1mm 2mm 1mm !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      </style>
      <div class="thermal-receipt" style="width: ${widthVal}; margin: 0 auto; color: black; background: white; font-family: 'Courier New', Courier, monospace; font-size: 11px; padding: 1mm 1mm 2mm 1mm; page-break-inside: avoid; break-inside: avoid;">
        <div class="receipt-header" style="text-align: center; margin-bottom: 2mm; page-break-inside: avoid; break-inside: avoid;">
          ${shopDetails?.logo ? `
            <div style="text-align: center; margin-bottom: 2mm;">
              <img src="${shopDetails.logo}" style="height: 14mm; width: 14mm; border-radius: 8px; object-fit: cover; border: 1px solid #e2e8f0; display: inline-block;" />
            </div>
          ` : (userProfile?.avatar ? `
            <div style="text-align: center; margin-bottom: 2mm;">
              <img src="${userProfile.avatar}" style="height: 14mm; width: 14mm; border-radius: 50%; object-fit: cover; border: 1px solid #e2e8f0; display: inline-block;" />
            </div>
          ` : '')}
          <h1 class="shop-name" style="font-size: 16px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">${shopName}</h1>
          <p class="shop-detail" style="font-size: 10px; margin: 0; line-height: 1.1;">${shopAddress}</p>
          <p class="shop-detail font-bold" style="font-size: 10px; margin: 0; line-height: 1.1; font-weight: bold;">Tel: ${shopPhone}</p>
        </div>
        
        <div class="receipt-sep" style="border-top: 1px dashed black; margin: 2mm 0; width: 100%;"></div>
        
        <div class="receipt-info-grid" style="font-size: 10px; margin-bottom: 2mm; width: 100%; font-weight: 600; page-break-inside: avoid; break-inside: avoid;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5mm;">
            <span>Bill No:</span>
            <span style="font-weight: bold;">${sale.invoiceNumber}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5mm;">
            <span>Date:</span>
            <span>${new Date(sale.createdAt).toLocaleDateString('en-IN')}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5mm;">
            <span>Time:</span>
            <span>${new Date(sale.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5mm;">
            <span>Cashier:</span>
            <span style="font-weight: bold; text-transform: uppercase;">${userProfile?.name || 'Do Bill Cashier'}</span>
          </div>
          ${customerRows.join('')}
        </div>
        
        <div class="receipt-sep" style="border-top: 1px dashed black; margin: 2mm 0; width: 100%;"></div>
        
        <table class="receipt-table" style="width: 100%; border-collapse: collapse; font-size: 10px; margin: 1mm 0; page-break-inside: avoid; break-inside: avoid;">
          <thead>
            <tr style="border-bottom: 1.5px solid black;">
              <th style="text-align: left; padding: 1.5mm 0; font-weight: 700; text-transform: uppercase;">ITEM</th>
              <th style="text-align: center; padding: 1.5mm 0; font-weight: 700; text-transform: uppercase; width: 20%;">QTY</th>
              <th style="text-align: right; padding: 1.5mm 0; font-weight: 700; text-transform: uppercase; width: 30%;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>
        
        <div class="receipt-sep" style="border-top: 1px dashed black; margin: 2mm 0; width: 100%;"></div>
        
        <div class="totals-area" style="font-size: 11px; padding: 1mm 0; font-weight: 700; page-break-inside: avoid; break-inside: avoid;">
          <div style="display: flex; justify-content: space-between;">
            <span>Subtotal:</span>
            <span>₹${sale.subtotal.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>GST Tax:</span>
            <span>₹${sale.taxTotal.toFixed(2)}</span>
          </div>
          <div class="grand-total-row justify-between flex" style="font-size: 15px; font-weight: 900; border-top: 1.5px solid black; border-bottom: 1.5px solid black; margin-top: 1mm; padding: 1.5mm 0; display: flex; justify-content: space-between;">
            <span>GRAND TOTAL</span>
            <span>₹${sale.grandTotal.toFixed(2)}</span>
          </div>
        </div>
        
        <div class="receipt-sep" style="border-top: 1px dashed black; margin: 2mm 0; width: 100%;"></div>
        
        <div class="payment-info" style="font-size: 10px; margin-top: 1.5mm; font-weight: 600; page-break-inside: avoid; break-inside: avoid;">
          <div style="display: flex; justify-content: space-between; text-transform: uppercase;">
            <span>Mode:</span>
            <span style="font-weight: 900;">${sale.paymentMode}</span>
          </div>
          ${changeRows}
        </div>
        
        <div class="receipt-sep" style="border-top: 1px dashed black; margin: 2mm 0; width: 100%;"></div>
        
        <div class="receipt-footer" style="text-align: center; margin-top: 2mm; font-size: 9px; padding-bottom: 1mm; page-break-inside: avoid; break-inside: avoid;">
          <p style="font-weight: 900; font-size: 11px; margin-bottom: 0.5mm;">THANK YOU FOR SHOPPING!</p>
          <p style="font-size: 8px; margin-top: 1mm; font-weight: bold;">Items once sold cannot be returned.</p>
          <p style="font-size: 8px; margin-top: 2mm; border-top: 1px solid black; padding-top: 1mm; font-weight: bold;">POWERED BY DO BILL</p>
        </div>
      </div>
    `;
  };

  const handleNextStep = () => {
    const hasPhone = customerPhone.trim().length > 0;
    const hasName = customerName.trim().length > 0;

    if (hasPhone && !hasName) {
      toast.error("Please enter the customer's name. A name is mandatory when a phone number is provided.");
      return;
    }
    setDialogStep('payment');
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (isCheckingOut) return;
    
    const stockErr = getCartStockError(cart);
    if (stockErr) {
      toast.error(`Cannot complete sale! ${stockErr}. Please reduce cart quantity before checkout.`);
      return;
    }

    try {
      const freshProducts = await DataService.getProducts();
      for (const item of cart) {
        const p = freshProducts.find(prod => prod.id === item.id || (prod as any).product_id === item.id || (item.barcode && prod.barcode === item.barcode));
        const avail = p ? (p.stockQuantity !== undefined && p.stockQuantity !== null ? p.stockQuantity : ((p as any).stock_quantity ?? 0)) : (item.stockQuantity ?? 0);
        if (item.quantity > avail) {
          toast.error(`Cannot complete sale! "${item.name}" has only ${avail} pcs in stock, but ${item.quantity} requested. Please reduce cart quantity.`);
          return;
        }
      }
    } catch (err) {
      console.warn("Stock pre-check warning:", err);
    }

    setIsCheckingOut(true);
    try {
      const hasPhone = customerPhone.trim().length > 0;

      const saleData = {
        items: cart,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        cashReceived: paymentMode === 'cash' ? (parseFloat(cashReceived) || totals.grandTotal) : totals.grandTotal,
        changeDue: paymentMode === 'cash' ? changeDue : 0,
        paymentMode: paymentMode,
        cashierId: 'admin',
        createdAt: new Date().toISOString(),
        customerName: hasPhone ? (customerName.trim() || undefined) : undefined,
        customerPhone: hasPhone ? (customerPhone.trim() || undefined) : undefined,
        customerAddress: (hasPhone && customerAddress.trim()) ? customerAddress.trim() : undefined
      };

      const savedSale = await DataService.processSale(saleData);
      
      // Clear cart immediately upon successful sale so stock and cart remain synchronized
      const activeWs = DataService.getActiveWorkspace();
      localStorage.removeItem(getWorkspaceCartKey(activeWs));
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');

      // Refresh product list immediately to display updated stock levels
      DataService.getProducts().then(setAllProducts).catch(console.error);

      setPrintSale(savedSale);
      setShowSuccess(true);
      setIsPaymentDialogOpen(false);

      // Automated Print Logic for Thermal Roll Printers (EZO 58D) - Trigger immediately
      setTimeout(async () => {
        try {
          const res = await handlePrint(savedSale);
          if (res.success) {
            toast.success("Print Successful");
          } else {
            toast.error(res.message);
          }
        } catch (e) {
          console.error("Auto print failed:", e);
        }
      }, 100);
    } catch (error) {
       console.error("Sale Error:", error);
      toast.error("Failed to process sale");
      setIsCheckingOut(false);
    }
  };

  const handleTestPrint = async () => {
    const testSale: Sale = {
      id: 'test',
      invoiceNumber: 'TEST-0000',
      items: [
        { id: 't1', name: 'Test Product 1', brand: 'Brand A', category: 'Cat A', sellingPrice: 100, quantity: 2, unit: 'pcs', barcode: '123', purchasePrice: 50, stockQuantity: 10, reorderLevel: 2, gstPercent: 5, updatedAt: new Date().toISOString() },
        { id: 't2', name: 'Test Product 2', brand: 'Brand B', category: 'Cat B', sellingPrice: 50, quantity: 1, unit: 'pcs', barcode: '456', purchasePrice: 20, stockQuantity: 5, reorderLevel: 1, gstPercent: 12, updatedAt: new Date().toISOString() }
      ],
      subtotal: 250,
      taxTotal: 16,
      grandTotal: 266,
      cashReceived: 300,
      changeDue: 34,
      paymentMode: 'cash',
      cashierId: 'Test User',
      createdAt: new Date().toISOString()
    };
    setPrintSale(testSale);
    const toastId = toast.loading("🖨️ Initializing test print...");
    try {
      const res = await handlePrint(testSale);
      toast.dismiss(toastId);
      if (res.success) {
        toast.success("Print Successful");
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message || "Print failed");
    } finally {
      setTimeout(() => setPrintSale(null), 2000);
    }
  };

  return (
    <>
      <AnimatePresence>
        {showScanVisual && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] pointer-events-none flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-[1px]" />
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-emerald-500 text-white p-4 rounded-full shadow-lg shadow-emerald-500/50"
            >
              <Barcode className="h-8 w-8 animate-pulse" />
            </motion.div>
          </motion.div>
        )}

        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-white/90 backdrop-blur-sm no-print p-4"
          >
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 12 }}
              className="flex flex-col items-center gap-6 max-w-sm w-full bg-white p-8 rounded-[2rem] shadow-2xl border border-slate-100"
            >
              <div className="h-20 w-20 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-xl shadow-emerald-500/20">
                <CheckCircle2 className="h-12 w-12" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-black text-slate-900">Payment Success!</h2>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Bill #{printSale?.invoiceNumber}</p>
              </div>

              <div className="w-full grid grid-cols-1 gap-3 pt-4">
                <Button 
                  className="h-12 rounded-xl font-bold uppercase text-xs gap-2 shadow-lg shadow-primary/20"
                  onClick={async () => {
                    if (printSale) {
                      const toastId = toast.loading("🖨️ Printing bill...");
                      const res = await handlePrint(printSale);
                      toast.dismiss(toastId);
                      if (res.success) {
                        toast.success("Print Successful");
                      } else {
                        toast.error(res.message);
                      }
                    }
                  }}
                >
                  <Printer className="h-4 w-4" /> Print Bill
                </Button>
                <div className="h-px bg-slate-100 my-1" />

                <Button 
                  variant="ghost"
                  className="h-10 rounded-xl font-bold uppercase text-xs text-slate-400"
                  onClick={() => {
                    setShowSuccess(false);
                    setCart([]);
                    setPrintSale(null);
                    setCustomerName('');
                    setCustomerPhone('');
                    setCustomerAddress('');
                    setIsCheckingOut(false);
                  }}
                >
                  Close & New Sale
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Printable Receipt (Hidden in UI) */}
      <div className="print-only">
        {printSale && <ReceiptTemplate sale={printSale} shopDetails={shopDetails || undefined} />}
      </div>

      <div className="h-full flex-1 min-h-0 flex flex-col gap-4 sm:gap-5 lg:gap-6 no-print">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600">
                System Printer Ready
              </span>
            </div>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-slate-400">Paper Form Factor:</span>
              <span className="text-[10px] sm:text-xs font-extrabold uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                {shopDetails?.paperSize || '80mm'} Thermal Roll
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 sm:flex-none h-8 text-[10px] font-black uppercase tracking-tight gap-1.5"
              onClick={handleTestPrint}
            >
              RUN TEST PRINT
            </Button>
          </div>
        </div>

        <PrinterPickerModal open={showPrinterPicker} onOpenChange={setShowPrinterPicker} />

        <div className="flex flex-col md:grid md:grid-cols-12 gap-4 lg:gap-6 flex-1 min-h-0">
          {/* Search & Cart Area */}
          <div className="md:col-span-7 lg:col-span-8 flex flex-col gap-4 h-full min-h-[350px] md:min-h-0">
          <form onSubmit={handleManualScan} className="flex gap-2.5 sm:gap-3">
            <div className="relative flex-1">
              <Barcode className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                ref={inputRef}
                placeholder="Scan Barcode or Type Product..."
                value={barcode ?? ''}
                onChange={(e) => setBarcode(e.target.value)}
                className="pl-11 pr-24 h-12 sm:h-14 text-base sm:text-lg font-mono border-2 border-slate-200 focus-visible:ring-primary shadow-sm rounded-xl"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-2">
                <Badge variant="outline" className="bg-slate-50 text-[9px] uppercase tracking-tighter text-slate-400 border-none font-bold">
                  Machine Ready
                </Badge>
              </div>

              {/* Autocomplete Suggestions Dropdown */}
              {searchSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-150 z-50 max-h-60 overflow-y-auto divide-y divide-slate-50 no-print">
                  {searchSuggestions.map((prod) => (
                    <div 
                      key={prod.id}
                      onClick={() => {
                        addToCart(prod);
                        setBarcode('');
                        setSearchSuggestions([]);
                        inputRef.current?.focus();
                      }}
                      className="p-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
                          {(prod.imageUrl || (prod as any).image_url) ? (
                            <img src={prod.imageUrl || (prod as any).image_url} alt={prod.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Package className="h-4 w-4 text-slate-400" />
                          )}
                        </div>
                        <div className="text-left min-w-0">
                          <p className="text-xs font-black text-slate-800 truncate">{prod.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono truncate">{prod.barcode} | {prod.category}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-indigo-600 font-mono">₹{prod.sellingPrice.toFixed(2)}</span>
                        <span className="text-[9px] text-slate-400 block font-bold uppercase">{prod.stockQuantity} in stock</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button
              type="button"
              onClick={() => setIsCameraScannerOpen(true)}
              className="h-12 sm:h-14 px-4 sm:px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl shadow-md shrink-0 flex items-center gap-2.5 border border-indigo-500/20"
            >
              <Camera className="h-5 w-5 text-indigo-200 animate-pulse" />
              <span className="hidden sm:inline">Camera Scanner</span>
              <span className="sm:hidden">Camera</span>
            </Button>
          </form>

        <Card className="flex-1 overflow-hidden border-none shadow-sm shadow-slate-200/50 flex flex-col">
          {getCartStockError(cart) && (
            <div className="bg-rose-50 border-b border-rose-200/80 px-4 py-2.5 text-rose-700 text-xs font-bold flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 animate-pulse" />
                <span className="truncate">Cannot create bill: Item quantity exceeds available inventory stock!</span>
              </div>
              <span className="text-[10px] bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-md font-black shrink-0 uppercase tracking-wider border border-rose-200/60">Out of Stock</span>
            </div>
          )}
          <CardContent className="p-0 flex-1 flex flex-col min-h-0">
            <div className="hidden sm:grid grid-cols-12 bg-slate-50 p-4 font-semibold text-xs uppercase tracking-wider text-slate-500 border-b">
              <div className="col-span-4">Product Details</div>
              <div className="col-span-2 text-center">Rate (₹)</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-1 text-center">Disc (%)</div>
              <div className="col-span-1 text-center">GST</div>
              <div className="col-span-2 text-right">Line Total</div>
            </div>
            
            <ScrollArea className="flex-1">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 lg:h-full opacity-40 grayscale py-10">
                  <div className="bg-slate-100 p-6 rounded-full mb-4">
                    <ShoppingCart className="h-12 w-12 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-medium">Cart is empty</h3>
                  <p className="text-xs">Scan items to start billing</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 px-2 sm:px-4">
                  {cart.map((item) => {
                    const discPercent = item.discountPercent || 0;
                    const lineSubtotal = item.sellingPrice * item.quantity;
                    const lineDiscount = lineSubtotal * (discPercent / 100);
                    const taxableAmount = lineSubtotal - lineDiscount;
                    const taxAmount = taxableAmount * (item.gstPercent / 100);
                    const lineTotal = taxableAmount + taxAmount;

                    return (
                      <div key={item.id} className="flex flex-col sm:grid sm:grid-cols-12 py-3.5 gap-3.5 sm:gap-0 items-start sm:items-center hover:bg-slate-50/50 transition-colors border border-slate-100 sm:border-0 rounded-2xl sm:rounded-none p-3.5 sm:p-0 my-2 sm:my-0 bg-slate-50/30 sm:bg-transparent shadow-sm sm:shadow-none w-full">
                        <div className="w-full sm:col-span-4 flex items-center gap-3">
                          {(item.imageUrl || (item as any).image_url) && (
                            <img src={item.imageUrl || (item as any).image_url} alt={item.name} className="h-10 w-10 sm:h-12 sm:w-12 rounded object-cover shadow-sm flex-shrink-0 animate-fade-in" referrerPolicy="no-referrer" />
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="font-extrabold text-slate-800 text-sm truncate">{item.name}</span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] text-slate-400 truncate">{item.barcode} | {item.unit}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                                item.quantity > (item.stockQuantity ?? 0)
                                  ? 'bg-red-100 text-red-700 font-extrabold border border-red-200 animate-pulse'
                                  : (item.stockQuantity ?? 0) <= (item.reorderLevel ?? 5)
                                  ? 'bg-amber-100 text-amber-700 font-extrabold border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200'
                              }`}>
                                Avail: {item.stockQuantity ?? 0} {item.unit}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Desktop View Elements */}
                        <div className="hidden sm:block sm:col-span-2 text-center text-sm font-semibold">
                          ₹{item.sellingPrice.toFixed(2)}
                        </div>

                        <div className="hidden sm:flex sm:col-span-2 justify-center items-center gap-1.5">
                          <Button 
                            variant="outline" 
                            size="icon-sm" 
                            className="h-7 w-7 rounded-sm border-slate-200"
                            onClick={() => updateQuantity(item.id, -1)}
                          >
                            <Minus className="h-3 w-3 text-slate-600" />
                          </Button>
                          <Input 
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => {
                              const freshProd = allProducts.find(p => p.id === item.id || (p as any).product_id === item.id || (item.barcode && p.barcode === item.barcode)) || item;
                              const availableStock = freshProd.stockQuantity !== undefined && freshProd.stockQuantity !== null ? freshProd.stockQuantity : ((freshProd as any).stock_quantity ?? item.stockQuantity ?? 0);

                              let val = parseInt(e.target.value) || 1;
                              if (val < 1) val = 1;

                              if (val > availableStock) {
                                toast.error(`Stock limit exceeded! Only ${availableStock} pcs available in inventory.`);
                              }

                              setCart(prev => prev.map(c => (c.id === item.id || (c as any).product_id === item.id) ? { ...c, quantity: val, stockQuantity: availableStock } : c));
                            }}
                            className="w-12 text-center h-7 font-bold text-xs border border-slate-200 rounded-sm p-0 shrink-0"
                          />
                          <Button 
                            variant="outline" 
                            size="icon-sm" 
                            className="h-7 w-7 rounded-sm border-slate-200"
                            onClick={() => updateQuantity(item.id, 1)}
                          >
                            <Plus className="h-3 w-3 text-slate-600" />
                          </Button>
                        </div>

                        <div className="hidden sm:flex sm:col-span-1 text-center justify-center items-center">
                          <Input 
                            type="number"
                            min="0"
                            max="100"
                            value={discPercent}
                            onChange={(e) => {
                              const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                              setCart(prev => prev.map(c => c.id === item.id ? { ...c, discountPercent: val } : c));
                            }}
                            className="w-12 text-center h-7 font-bold text-xs border border-slate-200 rounded-sm p-0"
                          />
                        </div>

                        <div className="hidden sm:block sm:col-span-1 text-center font-semibold text-xs text-slate-500">
                          {item.gstPercent}%
                        </div>

                        <div className="hidden sm:flex sm:col-span-2 items-center justify-end gap-2.5 w-full sm:w-auto">
                          <div className="text-right font-black text-sm text-primary">
                            ₹{lineTotal.toFixed(2)}
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md shrink-0"
                            onClick={() => setCart(prev => prev.filter(c => c.id !== item.id))}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {/* Beautifully Balanced Mobile-Only Controls Grid */}
                        <div className="w-full flex sm:hidden items-center justify-between gap-3 border-t border-slate-100 pt-3 mt-1 text-xs">
                          <div className="flex flex-col">
                            <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider">Rate</span>
                            <span className="font-extrabold text-slate-700 text-xs mt-0.5">₹{item.sellingPrice.toFixed(2)}</span>
                          </div>
                          
                          <div className="flex flex-col items-center">
                            <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider mb-1">Quantity</span>
                            <div className="flex items-center gap-1.5 bg-slate-50 p-0.5 rounded border border-slate-150">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0 text-slate-500 hover:text-slate-800"
                                onClick={() => updateQuantity(item.id, -1)}
                              >
                                <Minus className="h-2.5 w-2.5" />
                              </Button>
                              <span className="font-black text-xs px-1 text-slate-800 min-w-4 text-center">{item.quantity}</span>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0 text-slate-500 hover:text-slate-800"
                                onClick={() => updateQuantity(item.id, 1)}
                              >
                                <Plus className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          </div>

                          <div className="flex flex-col items-center">
                            <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider mb-1">Disc%</span>
                            <Input 
                              type="number"
                              min="0"
                              max="100"
                              value={discPercent}
                              onChange={(e) => {
                                const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                                setCart(prev => prev.map(c => c.id === item.id ? { ...c, discountPercent: val } : c));
                              }}
                              className="w-10 text-center h-6 font-bold text-[10px] border border-slate-200 rounded-sm p-0 bg-white"
                            />
                          </div>

                          <div className="flex flex-col items-end">
                            <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider">Line Total</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-black text-indigo-600 text-xs">₹{lineTotal.toFixed(2)}</span>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 text-red-500 hover:bg-rose-50 rounded"
                                onClick={() => setCart(prev => prev.filter(c => c.id !== item.id))}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Order Summary & Payment Section */}
      <div className="md:col-span-5 lg:col-span-4 flex flex-col gap-4 lg:gap-6 h-full md:min-h-0">
        <Card className="flex flex-col md:flex-1 overflow-hidden border-none shadow-sm min-h-[300px]">
          <CardHeader className="py-3 sm:py-4 border-b">
            <CardTitle className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 px-6 py-4">
              {cart.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-slate-400 gap-2 italic">
                  <ShoppingCart className="h-8 w-8 opacity-20" />
                  <span className="text-sm">Cart is empty</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item, idx) => {
                    const discPercent = item.discountPercent || 0;
                    const lineSub = item.sellingPrice * item.quantity;
                    const taxable = lineSub * (1 - discPercent / 100);
                    const lineTotal = taxable * (1 + item.gstPercent / 100);

                    return (
                      <div key={idx} className="flex justify-between gap-3 text-xs sm:text-sm">
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="font-semibold text-slate-700 truncate">{item.name}</span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            ₹{item.sellingPrice.toFixed(2)} x {item.quantity} {item.unit}
                            {discPercent > 0 && <span className="text-red-500 font-bold ml-1">(-{discPercent}%)</span>}
                          </span>
                        </div>
                        <span className="font-bold text-slate-900 leading-6 shrink-0">₹{lineTotal.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
            
            <div className="p-4 sm:p-6 bg-slate-50 border-t space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Gross Subtotal</span>
                  <span>₹{(totals.subtotal + totals.discountTotal).toFixed(2)}</span>
                </div>
                {totals.discountTotal > 0 && (
                  <div className="flex justify-between text-xs text-red-500 font-semibold">
                    <span>Discount Included</span>
                    <span>-₹{totals.discountTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-slate-500">
                  <span>GST (Tax Total)</span>
                  <span>₹{totals.taxTotal.toFixed(2)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-lg font-black text-slate-900">
                  <span>Grand Total</span>
                  <span>₹{totals.grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pb-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 h-10 text-[10px] sm:text-xs font-semibold"
                  onClick={handleHoldBill}
                  disabled={cart.length === 0}
                >
                  <PauseCircle className="h-4 w-4" /> HOLD
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 h-10 text-[10px] sm:text-xs font-semibold text-red-500 hover:text-red-600"
                  onClick={() => {
                    setCart([]);
                    setCustomerName('');
                    setCustomerPhone('');
                    setCustomerAddress('');
                  }}
                  disabled={cart.length === 0}
                >
                  <Trash2 className="h-4 w-4" /> CLEAR
                </Button>
              </div>

              <Dialog open={isPaymentDialogOpen} onOpenChange={(open) => {
                if (open) {
                  const err = getCartStockError(cart);
                  if (err) {
                    toast.error(`Bill creation blocked! ${err}`);
                    return;
                  }
                }
                setIsPaymentDialogOpen(open);
              }}>
                <Button 
                  disabled={cart.length === 0 || !!getCartStockError(cart)}
                  onClick={tryOpenPaymentModal}
                  className={`w-full h-12 sm:h-14 text-base sm:text-lg font-black tracking-wider transition-all rounded-xl ${
                    getCartStockError(cart) 
                      ? 'bg-rose-50 hover:bg-rose-50 text-rose-600 border-2 border-rose-200/80 shadow-none cursor-not-allowed flex items-center justify-center gap-2 opacity-100' 
                      : 'shadow-lg shadow-slate-900/10 hover:shadow-xl hover:shadow-slate-900/15 active:scale-[0.99] bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {getCartStockError(cart) ? (
                    <span className="flex items-center gap-2 font-black tracking-widest uppercase text-sm sm:text-base text-rose-600">
                      <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 animate-bounce" />
                      OUT OF STOCK
                    </span>
                  ) : (
                    "PROCEED TO PAYMENT"
                  )}
                </Button>
                <DialogContent className="sm:max-w-md p-0 overflow-hidden max-h-[90vh] flex flex-col">
                  <DialogHeader className="p-4 sm:p-6 border-b shrink-0">
                    <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                      {dialogStep === 'customer' ? (
                        <>
                          <User className="h-5 w-5 text-primary" />
                          <span>Customer Information</span>
                        </>
                      ) : (
                        <>
                          <Wallet className="h-5 w-5 text-primary" />
                          <span>Select Payment Mode</span>
                        </>
                      )}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 bg-slate-50/50 overflow-y-auto flex-1">
                    <div className="text-center p-4 bg-white rounded-xl shadow-sm border">
                      <p className="text-[10px] sm:text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Payable Amount</p>
                      <h4 className="text-2xl sm:text-3xl font-bold text-slate-900">₹{totals.grandTotal.toFixed(2)}</h4>
                    </div>
                    
                    {dialogStep === 'customer' ? (
                      <div className="space-y-4">
                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 text-xs text-primary font-medium flex items-start gap-2.5 bg-sky-50/40 text-slate-700">
                          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                          <div>
                            <span className="font-extrabold block text-primary">Customer Privacy Protection</span>
                            If a customer does not provide their phone number, or refuses to give it, their details will NOT be added to the database. They will checkout as an anonymous walk-in.
                          </div>
                        </div>

                        <div className="space-y-4 bg-white p-6 rounded-xl border shadow-sm">
                          <div className="space-y-2">
                            <Label htmlFor="cust-phone" className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                              Phone Number <span className="text-slate-400 font-normal lowercase">(optional)</span>
                            </Label>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input 
                                id="cust-phone"
                                type="tel"
                                placeholder="10-digit Phone Number" 
                                className="pl-9 h-11 text-sm bg-slate-50/50"
                                value={customerPhone}
                                onChange={(e) => setCustomerPhone(e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="cust-name" className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                              Name 
                              {customerPhone.trim() ? (
                                <span className="text-red-500 font-extrabold normal-case">(mandatory with phone)</span>
                              ) : (
                                <span className="text-slate-400 font-normal lowercase">(optional)</span>
                              )}
                            </Label>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input 
                                id="cust-name"
                                placeholder="Customer's Full Name" 
                                className="pl-9 h-11 text-sm bg-slate-50/50"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="cust-address" className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                              Address <span className="text-slate-400 font-normal lowercase">(optional)</span>
                            </Label>
                            <div className="relative">
                              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input 
                                id="cust-address"
                                placeholder="Delivery or Billing Address" 
                                className="pl-9 h-11 text-sm bg-slate-50/50"
                                value={customerAddress}
                                onChange={(e) => setCustomerAddress(e.target.value)}
                              />
                            </div>
                          </div>



                          <div className="p-3.5 bg-[#fbfcfd] border border-blue-100/80 rounded-xl text-[11px] text-slate-500 font-medium leading-relaxed space-y-1 mt-1">
                            <span className="font-bold text-blue-700 flex items-center gap-1">💡 Transaction Data Limit Note:</span>
                            <p>Agar aap customer ka <strong>Phone Number</strong> blank chhodenge, toh is sale/transaction ki details database me save nahi hongi, aur ye sales history, reports ya dashboard par show nahi hoga. Lekin billing aur thermal print temporary complete ho jayega.</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                          <Button 
                            onClick={() => setPaymentMode('cash')}
                            variant={paymentMode === 'cash' ? 'default' : 'outline'}
                            className={`h-24 flex flex-col gap-2 rounded-xl transition-all ${paymentMode === 'cash' ? 'ring-4 ring-primary/20' : 'bg-white'}`}
                          >
                            <Banknote className="h-6 w-6" />
                            <span className="font-bold">CASH</span>
                          </Button>
                          <Button 
                            onClick={() => setPaymentMode('upi')}
                            variant={paymentMode === 'upi' ? 'default' : 'outline'}
                            className={`h-24 flex flex-col gap-2 rounded-xl transition-all ${paymentMode === 'upi' ? 'ring-4 ring-primary/20' : 'bg-white'}`}
                          >
                            <Smartphone className="h-6 w-6" />
                            <span className="font-bold">UPI / ONLINE</span>
                          </Button>
                        </div>

                        <div className="animate-in fade-in slide-in-from-bottom-2">
                          {paymentMode === 'cash' ? (
                            <div className="space-y-4 bg-white p-6 rounded-xl border shadow-sm">
                              <div className="space-y-2">
                                <Label htmlFor="cash" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cash Received</Label>
                                <Input 
                                  id="cash"
                                  autoFocus
                                  type="number" 
                                  placeholder="0.00" 
                                  className="h-12 text-xl font-bold"
                                  value={cashReceived ?? ''}
                                  onChange={(e) => setCashReceived(e.target.value)}
                                />
                              </div>
                              <Separator />
                              <div className="flex justify-between items-center text-sm">
                                <span className="font-medium text-slate-500">Balance to Return</span>
                                <span className={`font-bold text-lg ${changeDue < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                  ₹{changeDue.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-4 bg-white p-6 rounded-xl border shadow-sm flex flex-col items-center">
                              {!merchantUpiId ? (
                                <div className="text-center py-4 space-y-3">
                                  <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
                                  <p className="text-sm font-medium text-slate-600">Merchant UPI ID not configured.</p>
                                  <Link to="/upi">
                                    <Button variant="link" className="text-primary p-0 h-auto" onClick={() => setIsPaymentDialogOpen(false)}>
                                      Setup in Settings
                                    </Button>
                                  </Link>
                                </div>
                              ) : (
                                <>
                                  <div className="bg-white p-3 rounded-lg border shadow-inner">
                                    <QRCodeSVG 
                                      value={`upi://pay?pa=${merchantUpiId}&pn=${encodeURIComponent(shopDetails?.name || 'Do Bill')}&am=${totals.grandTotal.toFixed(2)}&cu=INR`}
                                      size={180}
                                      level="H"
                                      includeMargin={true}
                                      imageSettings={{
                                        src: "/favicon.ico",
                                        x: undefined,
                                        y: undefined,
                                        height: 24,
                                        width: 24,
                                        excavate: true,
                                      }}
                                    />
                                  </div>
                                  <div className="text-center">
                                    <p className="text-xs text-slate-400 font-medium mb-1">Scan to pay</p>
                                    <code className="text-xs font-bold bg-slate-100 px-2 py-1 rounded">{merchantUpiId}</code>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="p-6 border-t bg-slate-50/80 flex flex-col gap-3 shrink-0">
                    {dialogStep === 'customer' ? (
                      <Button 
                        size="lg" 
                        className="w-full font-bold shadow-lg"
                        onClick={handleNextStep}
                      >
                        CONTINUE TO PAYMENT
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </Button>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        <Button 
                          size="lg" 
                          className="w-full font-bold shadow-lg"
                          onClick={handleCheckout}
                          disabled={isCheckingOut || !!getCartStockError(cart)}
                        >
                          {isCheckingOut ? (
                            <span className="flex items-center justify-center gap-2">
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              PROCESSING... (PLEASE WAIT)
                            </span>
                          ) : (
                            <>
                              <Printer className="h-5 w-5 mr-2" />
                              COMPLETE & PRINT BILL
                            </>
                          )}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="w-full h-11 font-bold border-slate-200"
                          onClick={() => setDialogStep('customer')}
                        >
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          BACK TO CUSTOMER DETAILS
                        </Button>
                      </div>
                    )}
                    <Button variant="ghost" className="w-full text-slate-500 text-xs font-bold uppercase tracking-widest" onClick={() => setIsPaymentDialogOpen(false)}>
                      CANCEL
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Held Bills Area */}
        {heldBills.length > 0 && (
          <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50 rounded-[2rem]">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <PlayCircle className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-600">Held Bills ({heldBills.length})</h4>
              </div>
              <div className="space-y-3">
                {heldBills.map((bill, i) => (
                  bill && (
                    <div key={i} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800">Bill #{i + 1}</span>
                        <span className="text-[10px] text-slate-400">{bill.length} Items</span>
                      </div>
                      <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10" onClick={() => handleResumeBill(i)}>
                        Resume
                      </Button>
                    </div>
                  )
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-auto space-y-2">
          <div className="flex items-center gap-2 text-slate-400 px-2">
            <AlertCircle className="h-4 w-4" />
            <span className="text-[10px] uppercase font-bold tracking-widest">Keyboard Shortcuts</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[9px] font-bold text-slate-500 px-2 uppercase">
            <div className="flex justify-between border-b pb-1"><span>F1</span> <span>Search</span></div>
            <div className="flex justify-between border-b pb-1"><span>F9</span> <span>Hold Bill</span></div>
            <div className="flex justify-between border-b pb-1"><span>F10</span> <span>Payment</span></div>
            <div className="flex justify-between border-b pb-1"><span>DEL</span> <span>Clear Cart</span></div>
          </div>
        </div>
      </div>
    </div>
    </div>

    {/* Quick Register Product Dialog */}
    <Dialog open={isQuickAddDialogOpen} onOpenChange={setIsQuickAddDialogOpen}>
      <DialogContent className="sm:max-w-md p-6 max-h-[90vh] overflow-y-auto w-[95vw]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Plus className="h-5 w-5 text-emerald-500" />
            <span>Quick Register Product</span>
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleQuickAddSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-500">Barcode</Label>
            <Input value={quickAddBarcode} disabled className="bg-slate-50 font-mono text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-500">Product Name *</Label>
            <Input required value={quickName} onChange={e => setQuickName(e.target.value)} placeholder="e.g. Designer Saree, Kurta" />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-500">Brand</Label>
              <Input value={quickBrand} onChange={e => setQuickBrand(e.target.value)} placeholder="e.g. Manyavar" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-500">Category</Label>
              <Input value={quickCategory} onChange={e => setQuickCategory(e.target.value)} placeholder="e.g. Womens Wear" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-500">Purchase Price</Label>
              <Input type="number" step="0.01" value={quickPurchasePrice} onChange={e => setQuickPurchasePrice(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-500">Rate / Selling Price *</Label>
              <Input required type="number" step="0.01" value={quickSellingPrice} onChange={e => setQuickSellingPrice(e.target.value)} placeholder="0.00" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-500">GST %</Label>
              <Select value={quickGstPercent} onValueChange={setQuickGstPercent}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Tax %" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0%</SelectItem>
                  <SelectItem value="5">5%</SelectItem>
                  <SelectItem value="12">12%</SelectItem>
                  <SelectItem value="18">18%</SelectItem>
                  <SelectItem value="28">28%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-500">Qty</Label>
              <Input type="number" value={quickStockQuantity} onChange={e => setQuickStockQuantity(e.target.value)} placeholder="100" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-500">Unit</Label>
              <Input value={quickUnit} onChange={e => setQuickUnit(e.target.value)} placeholder="pcs" />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t gap-2">
            <Button type="button" variant="outline" onClick={() => setIsQuickAddDialogOpen(false)}>Cancel</Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">Add & Add to Bill</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {/* Multiple Matching Units Selector Dialog */}
    <Dialog open={isMultiMatchDialogOpen} onOpenChange={setIsMultiMatchDialogOpen}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <span>Select Matching Unit / Packaging</span>
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-1">This barcode is shared across multiple products or different sizes/types. Select the correct one scanned:</p>
        </DialogHeader>
        <div className="space-y-2.5 my-4">
          {multiMatchCandidates.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => {
                addToCart(candidate);
                triggerScanVisual();
                setIsMultiMatchDialogOpen(false);
              }}
              className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-primary hover:bg-primary/5 transition-all flex items-start justify-between gap-4"
            >
              <div className="flex flex-col min-w-0">
                <span className="font-extrabold text-slate-800 text-sm truncate">{candidate.name}</span>
                <span className="text-xs text-slate-500 mt-0.5">{candidate.brand} | {candidate.category}</span>
                <span className="text-[10px] font-mono text-primary font-bold mt-1 uppercase tracking-tight bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded w-max">
                  Unit: {candidate.unit}
                </span>
              </div>
              <div className="text-right flex flex-col shrink-0">
                <span className="font-black text-slate-900 text-sm">₹{candidate.sellingPrice.toFixed(2)}</span>
                <span className="text-[10px] text-slate-400 mt-0.5">GST: {candidate.gstPercent}%</span>
              </div>
            </button>
          ))}
        </div>
        <DialogFooter className="border-t pt-3">
          <Button variant="outline" onClick={() => setIsMultiMatchDialogOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Sticky Quick-Pay Footer for Mobile POS */}
    {cart.length > 0 && (
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-slate-200/85 p-4 shadow-[0_-8px_20px_rgba(0,0,0,0.06)] z-40 md:hidden flex items-center justify-between gap-4 animate-fade-in no-print backdrop-blur-md bg-white/95 pb-safe">
        <div className="flex flex-col">
          <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Payable Total</span>
          <span className="font-black text-slate-800 text-lg">₹{totals.grandTotal.toFixed(2)}</span>
          <span className="text-[10px] text-slate-500 font-extrabold">{cart.reduce((sum, item) => sum + item.quantity, 0)} items</span>
        </div>
        <Button 
          disabled={!!getCartStockError(cart)}
          onClick={tryOpenPaymentModal}
          className={`flex-1 max-w-[200px] h-11 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
            getCartStockError(cart)
              ? 'bg-rose-50 text-rose-600 border border-rose-200 cursor-not-allowed opacity-100 shadow-none'
              : 'bg-indigo-600 hover:bg-slate-900 text-white shadow-lg shadow-indigo-600/10'
          }`}
        >
          {getCartStockError(cart) ? "OUT OF STOCK" : "Pay Now"}
        </Button>
      </div>
    )}
    {/* Camera Barcode Scanner Modal for Continuous Multi-Scan */}
    <CameraBarcodeScannerModal
      isOpen={isCameraScannerOpen}
      onClose={() => setIsCameraScannerOpen(false)}
      products={allProducts}
      cart={cart}
      onAddToCart={addToCart}
      onUpdateQuantity={handleUpdateQuantity}
      onRemoveFromCart={handleRemoveFromCart}
      onQuickAddProduct={(code) => {
        setIsCameraScannerOpen(false);
        setQuickAddBarcode(code);
        setQuickName('');
        setQuickBrand('');
        setQuickCategory('');
        setQuickPurchasePrice('');
        setQuickSellingPrice('');
        setIsQuickAddDialogOpen(true);
      }}
    />
    </>
  );
}
