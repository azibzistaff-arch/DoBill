import React from 'react';
import { Sale } from '@/types';
import { ShopDetails } from '@/services/dataService';

interface ReceiptTemplateProps {
  sale: Sale;
  shopDetails?: ShopDetails;
}

export const ReceiptTemplate: React.FC<ReceiptTemplateProps> = ({ sale, shopDetails }) => {
  const shop = shopDetails || {
    name: 'STORE RECEIPT',
    address: '',
    phone: '',
    paperSize: '80mm'
  };

  const is80 = (shop.paperSize || '80mm') === '80mm';
  const widthVal = is80 ? '72mm' : '52mm';
  const paperVal = is80 ? '80mm' : '58mm';

  return (
    <div className="receipt-container thermal-receipt">
      <div className="receipt-header">
        {shop.logo && (
          <img src={shop.logo} alt="Logo" style={{ height: '12mm', margin: '0 auto 2mm auto', display: 'block', objectFit: 'contain' }} />
        )}
        <h1 className="shop-name">{shop.name || 'STORE RECEIPT'}</h1>
        {shop.address && <p className="shop-detail">{shop.address}</p>}
        {shop.phone && <p className="shop-detail font-bold">Tel: {shop.phone}</p>}
      </div>
      
      <div className="receipt-sep"></div>
      
      <div className="receipt-info-grid">
        <div className="info-row">
          <span className="label">Bill No:</span>
          <span className="value">{sale.invoiceNumber}</span>
        </div>
        <div className="info-row">
          <span className="label">Date:</span>
          <span className="value">{new Date(sale.createdAt).toLocaleDateString('en-IN')}</span>
        </div>
        <div className="info-row">
          <span className="label">Time:</span>
          <span className="value">{new Date(sale.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      { (sale.customerName || sale.customerPhone || sale.customerAddress) && (
        <>
          <div className="receipt-sep"></div>
          <div className="receipt-info-grid">
            {sale.customerName && (
              <div className="info-row">
                <span className="label">Customer:</span>
                <span className="value uppercase" style={{ fontWeight: 800 }}>{sale.customerName}</span>
              </div>
            )}
            {sale.customerPhone && (
              <div className="info-row">
                <span className="label">Phone:</span>
                <span className="value">{sale.customerPhone}</span>
              </div>
            )}
            {sale.customerAddress && (
              <div className="info-row">
                <span className="label">Address:</span>
                <span className="value" style={{ wordBreak: 'break-all', textAlign: 'right' }}>{sale.customerAddress}</span>
              </div>
            )}
          </div>
        </>
      )}
      
      <div className="receipt-sep"></div>
      
      <table className="receipt-table">
        <thead>
          <tr>
            <th className="item-col">ITEM</th>
            <th className="qty-col">QTY</th>
            <th className="price-col text-right">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {(sale.items || []).map((item, idx) => (
            <tr key={idx}>
              <td className="item-col">
                <div className="item-name">{item.name}</div>
                <div className="item-rate">@₹{item.sellingPrice.toFixed(2)}</div>
              </td>
              <td className="qty-col">{item.quantity}</td>
              <td className="price-col text-right">{(item.sellingPrice * item.quantity).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <div className="receipt-sep"></div>
      
      <div className="totals-area">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>₹{sale.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>GST (Tax)</span>
          <span>₹{sale.taxTotal.toFixed(2)}</span>
        </div>
        <div className="grand-total-row flex justify-between">
          <span>GRAND TOTAL</span>
          <span>₹{sale.grandTotal.toFixed(2)}</span>
        </div>
      </div>
      
      <div className="receipt-sep"></div>
      
      <div className="payment-info">
        <div className="flex justify-between uppercase">
          <span>Mode:</span>
          <span className="font-bold">{sale.paymentMode}</span>
        </div>
        {sale.paymentMode === 'cash' && (
          <>
            <div className="flex justify-between">
              <span>Paid:</span>
              <span>₹{sale.cashReceived.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Change:</span>
              <span>₹{sale.changeDue.toFixed(2)}</span>
            </div>
          </>
        )}
      </div>
      
      <div className="receipt-sep"></div>
      
      <div className="receipt-footer">
        <p className="thank-you">THANK YOU FOR SHOPPING!</p>
        <p className="terms">Items once sold cannot be returned.</p>
        <p className="powered">POWERED BY DO BILL</p>
      </div>

      <style>{`
        .thermal-receipt {
          width: ${widthVal};
          margin: 0;
          color: black;
          background: white;
          font-family: 'Courier New', Courier, monospace;
          padding: 1mm 1mm 15mm 1mm;
          overflow: hidden;
        }
        .receipt-header { text-align: center; margin-bottom: 2mm; width: 100%; }
        .shop-name { font-size: 16px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
        .shop-detail { font-size: 10px; margin: 0; line-height: 1.1; }
        .receipt-sep { border-top: 1px dashed black; margin: 2mm 0; width: 100%; }
        .receipt-info-grid { font-size: 10px; margin-bottom: 1.5mm; width: 100%; font-weight: 600; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 0.5mm; }
        .receipt-table { width: 100%; border-collapse: collapse; font-size: 10px; margin: 1mm 0; }
        .receipt-table th { text-align: left; border-bottom: 1.5px solid black; padding: 1mm 0; font-weight: 700; text-transform: uppercase; }
        .item-col { width: 50%; padding-right: 1mm; }
        .qty-col { width: 15%; text-align: center; }
        .price-col { width: 35%; }
        .item-row { border-bottom: 1px solid #ddd; }
        .item-name { font-weight: 900; line-height: 1.1; word-wrap: break-word; font-size: 11px; }
        .item-rate { font-size: 9px; color: #000; margin-top: 0.2mm; }
        .totals-area { font-size: 11px; padding: 1mm 0; font-weight: 700; }
        .grand-total-row { font-size: 15px; font-weight: 900; border-top: 1.5px solid black; border-bottom: 1.5px solid black; margin-top: 1mm; padding: 1.5mm 0; }
        .payment-info { font-size: 10px; margin-top: 1.5mm; font-weight: 600; }
        .receipt-footer { text-align: center; margin-top: 4mm; font-size: 9px; padding-bottom: 10mm; }
        .thank-you { font-weight: 900; font-size: 11px; margin-bottom: 0.5mm; }
        .terms { font-size: 8px; margin-top: 1mm; font-weight: bold; }
        .powered { font-size: 8px; opacity: 1; margin-top: 3mm; border-top: 1px solid black; padding-top: 1.5mm; font-weight: bold; }
        @media print {
          body { width: ${paperVal} !important; margin: 0 !important; padding: 0 !important; }
          .thermal-receipt { width: ${paperVal} !important; padding: 1mm !important; }
        }
      `}</style>
    </div>
  );
};
