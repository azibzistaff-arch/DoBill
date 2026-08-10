export interface Product {
  id: string;
  barcode: string;
  name: string;
  brand: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  gstPercent: number;
  stockQuantity: number;
  reorderLevel: number;
  unit: string;
  imageUrl?: string;
  updatedAt: string;
}

export interface CartItem extends Product {
  quantity: number;
  discountPercent?: number;
}

export interface PurchaseItem {
  id: string;
  name: string;
  barcode: string;
  purchasePrice: number;
  sellingPrice: number;
  quantity: number;
  unit: string;
}

export interface Purchase {
  id: string;
  invoiceNumber: string;
  supplierName: string;
  supplierPhone: string;
  items: PurchaseItem[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  createdAt: string;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  items: CartItem[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  cashReceived: number;
  changeDue: number;
  paymentMode: 'cash' | 'upi' | 'card';
  createdAt: string;
  cashierId: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerEmail?: string;
}

export interface ReceiptElementBlock {
  id: string;
  type: 'logo' | 'header_title' | 'header_subtext' | 'shop_info' | 'metadata' | 'items_table' | 'totals' | 'barcode' | 'upi_qr' | 'terms' | 'footer_note' | 'custom_text' | 'divider';
  label: string;
  text?: string;
  align?: 'left' | 'center' | 'right';
  fontSize?: 'xs' | 'sm' | 'base' | 'lg' | 'xl';
  fontWeight?: 'normal' | 'semibold' | 'bold' | 'extrabold';
  visible: boolean;
}

export interface ReceiptTemplate {
  id: string;
  name: string;
  type: 'barcode' | 'simple';
  isDefault?: boolean;
  headerTitle: string;
  headerSubtext?: string;
  addressOverride?: string;
  phoneOverride?: string;
  footerNote?: string;
  termsText?: string;
  customPromoText?: string;
  
  // Page Size: Strictly locked to 'auto'
  pageSize: 'auto';
  
  // Element Toggles
  showLogo: boolean;
  showBarcode: boolean;
  showUpiQr: boolean;
  showCashierName: boolean;
  showCustomerDetails: boolean;
  showTaxBreakdown: boolean;
  showItemDiscounts: boolean;
  showSavingsSummary: boolean;
  showTerms: boolean;
  showFooterNote: boolean;
  showBorderLines: boolean;

  // Canva-style drag-and-drop elements layout
  elementsOrder?: ReceiptElementBlock[];
  
  updatedAt: string;
}
