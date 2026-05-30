import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import prisma from './db';
import { generateInvoiceNumber } from './payment';
import { AppError } from '../utils/errors';

async function getSetting(key: string): Promise<string | null> {
  const s = await prisma.siteSetting.findUnique({ where: { key } });
  return s?.value ?? null;
}

export async function generateInvoice(orderId: string): Promise<string> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, product: true, address: true }
  });

  if (!order) {
    throw new AppError('Order not found for invoice generation', 404, 'NOT_FOUND');
  }

  // Check if an invoice already exists for this order
  const existingInvoice = await prisma.invoice.findUnique({
    where: { orderId }
  });
  if (existingInvoice) {
    return existingInvoice.pdfPath;
  }

  const invoiceNo = await generateInvoiceNumber();
  
  // Ensure storage folder exists
  const pdfPath = `/data/invoices/${orderId}.pdf`;
  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });

  // Fetch store details from settings
  const storeName = await getSetting('store_name') ?? 'Rajshree Jewels';
  const storeTagline = await getSetting('store_tagline') ?? '1-Gram Gold & Antique Jewellery';
  const storeEmail = await getSetting('store_email') ?? 'info@rajshreejewels.com';
  const storePhone = await getSetting('store_phone') ?? '+91 98765 43210';
  const storeWebsite = 'www.rajshreejewels.com';

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const writeStream = fs.createWriteStream(pdfPath);
  doc.pipe(writeStream);

  // Helper colors
  const primaryColor = '#1A1A1A';
  const accentColor = '#C9A84C';
  const greyColor = '#7A6F5E';
  const lightBgColor = '#FDFAF5';
  const borderColor = '#E2D9C8';

  // 1. Header Section
  doc.fillColor(primaryColor);
  doc.font('Helvetica-Bold').fontSize(24).text(storeName.toUpperCase(), 50, 50);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(accentColor).text(storeTagline.toUpperCase(), 50, 78, { characterSpacing: 2 });
  
  // "TAX INVOICE" tag on top-right
  doc.fillColor(primaryColor);
  doc.font('Helvetica-Bold').fontSize(16).text('TAX INVOICE', 400, 50, { align: 'right', width: 145 });
  doc.font('Helvetica').fontSize(9).fillColor(greyColor);
  doc.text(`Invoice No: ${invoiceNo}`, 400, 70, { align: 'right', width: 145 });
  doc.text(`Date: ${new Date(order.paidAt || order.createdAt).toLocaleDateString('en-IN')}`, 400, 82, { align: 'right', width: 145 });
  
  // Store contact info below line
  doc.moveTo(50, 105).lineTo(545, 105).strokeColor(borderColor).stroke();

  doc.font('Helvetica').fontSize(8).fillColor(greyColor);
  doc.text(`Email: ${storeEmail}  |  Phone: ${storePhone}  |  Website: ${storeWebsite}`, 50, 115, { align: 'left' });

  // 2. Bill To & Payment Info Section
  doc.moveTo(50, 135).lineTo(545, 135).strokeColor(borderColor).stroke();
  
  // Left Column: Customer details
  doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryColor).text('BILL TO:', 50, 150);
  doc.font('Helvetica-Bold').fontSize(9).text(order.user.name, 50, 165);
  doc.font('Helvetica').fontSize(9).fillColor(greyColor);
  
  const addr = order.address;
  const fullAddress = `${addr.line1}${addr.line2 ? ', ' + addr.line2 : ''}, ${addr.city}, ${addr.state} - ${addr.pincode}`;
  doc.text(fullAddress, 50, 177, { width: 220, lineGap: 3 });
  doc.text(`Phone: ${addr.phone}`, 50, 215);
  doc.text(`Email: ${order.user.email}`, 50, 227);

  // Right Column: Payment info details
  doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryColor).text('PAYMENT DETAILS:', 320, 150);
  doc.font('Helvetica').fontSize(9).fillColor(greyColor);
  doc.text(`Order No: ${order.orderNumber}`, 320, 165);
  doc.text(`Payment Method: ${order.paymentMethod || 'Razorpay'}`, 320, 177);
  doc.text(`Transaction ID: ${order.razorpayPaymentId || 'N/A (COD)'}`, 320, 189);
  doc.text(`Date & Time: ${order.paidAt ? new Date(order.paidAt).toLocaleString('en-IN') : 'N/A'}`, 320, 201);

  // 3. Item Table
  const tableTop = 260;
  
  // Table Header Background
  doc.rect(50, tableTop, 495, 20).fill(lightBgColor);
  doc.strokeColor(borderColor).rect(50, tableTop, 495, 20).stroke();

  doc.font('Helvetica-Bold').fontSize(8).fillColor(primaryColor);
  doc.text('DESCRIPTION', 60, tableTop + 6, { width: 230 });
  doc.text('HSN CODE', 290, tableTop + 6, { width: 60, align: 'center' });
  doc.text('QTY', 360, tableTop + 6, { width: 40, align: 'center' });
  doc.text('UNIT PRICE', 410, tableTop + 6, { width: 60, align: 'right' });
  doc.text('TOTAL', 480, tableTop + 6, { width: 55, align: 'right' });

  // Table Row (Single unique physical item)
  const rowTop = tableTop + 20;
  doc.strokeColor(borderColor).rect(50, rowTop, 495, 35).stroke();

  doc.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor);
  doc.text(order.product.displayName, 60, rowTop + 8, { width: 220 });
  doc.font('Helvetica').fontSize(8).fillColor(greyColor).text(order.product.shortDesc, 60, rowTop + 20, { width: 220 });
  
  doc.font('Helvetica').fontSize(9).fillColor(primaryColor);
  doc.text('7113', 290, rowTop + 13, { width: 60, align: 'center' });
  doc.text('1', 360, rowTop + 13, { width: 40, align: 'center' });
  doc.text(`Rs. ${order.priceINR.toLocaleString('en-IN')}`, 410, rowTop + 13, { width: 60, align: 'right' });
  doc.text(`Rs. ${order.priceINR.toLocaleString('en-IN')}`, 480, rowTop + 13, { width: 55, align: 'right' });

  // Table Shipping Row
  const shippingRowTop = rowTop + 35;
  doc.strokeColor(borderColor).rect(50, shippingRowTop, 495, 25).stroke();

  doc.font('Helvetica').fontSize(9).fillColor(primaryColor);
  doc.text('Shipping & Delivery Charges', 60, shippingRowTop + 8);
  doc.text('-', 290, shippingRowTop + 8, { width: 60, align: 'center' });
  doc.text('-', 360, shippingRowTop + 8, { width: 40, align: 'center' });
  doc.text(`Rs. ${order.shippingINR.toLocaleString('en-IN')}`, 410, shippingRowTop + 8, { width: 60, align: 'right' });
  doc.text(`Rs. ${order.shippingINR.toLocaleString('en-IN')}`, 480, shippingRowTop + 8, { width: 55, align: 'right' });

  // Summary Totals Box
  const totalsTop = shippingRowTop + 25;
  doc.rect(320, totalsTop, 225, 60).fill(lightBgColor);
  doc.strokeColor(borderColor).rect(320, totalsTop, 225, 60).stroke();

  // Subtotal
  doc.font('Helvetica').fontSize(8).fillColor(greyColor).text('Subtotal:', 330, totalsTop + 10, { width: 100 });
  doc.font('Helvetica').fontSize(8).fillColor(primaryColor).text(`Rs. ${order.priceINR.toLocaleString('en-IN')}`, 440, totalsTop + 10, { width: 95, align: 'right' });

  // Shipping
  doc.font('Helvetica').fontSize(8).fillColor(greyColor).text('Shipping:', 330, totalsTop + 22, { width: 100 });
  doc.font('Helvetica').fontSize(8).fillColor(primaryColor).text(`Rs. ${order.shippingINR.toLocaleString('en-IN')}`, 440, totalsTop + 22, { width: 95, align: 'right' });

  // Grand Total Line
  doc.moveTo(330, totalsTop + 35).lineTo(535, totalsTop + 35).strokeColor(borderColor).stroke();

  // Total
  doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryColor).text('GRAND TOTAL:', 330, totalsTop + 42, { width: 100 });
  doc.font('Helvetica-Bold').fontSize(10).fillColor(accentColor).text(`Rs. ${order.totalINR.toLocaleString('en-IN')}`, 440, totalsTop + 42, { width: 95, align: 'right' });

  // 4. Footer Section
  const footerTop = 450;
  doc.moveTo(50, footerTop).lineTo(545, footerTop).strokeColor(borderColor).stroke();

  doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryColor).text('THANK YOU FOR YOUR PURCHASE!', 50, footerTop + 20, { align: 'center' });
  doc.font('Helvetica').fontSize(8).fillColor(greyColor);
  doc.text('Each Rajshree Jewels physical creation is handcrafted and completely one-of-a-kind. Handled with supreme care.', 50, footerTop + 35, { align: 'center' });
  
  doc.font('Helvetica-Bold').fontSize(8).fillColor(accentColor);
  doc.text('Return Policy: Handcrafted jewellery is non-returnable. Please contact support for any assistance.', 50, footerTop + 48, { align: 'center' });

  doc.end();

  // Wait for stream to finish writing before returning path
  await new Promise<void>((resolve, reject) => {
    writeStream.on('finish', () => resolve());
    writeStream.on('error', (err) => reject(err));
  });

  // Create Invoice record in database
  await prisma.invoice.create({
    data: {
      orderId,
      invoiceNo,
      pdfPath
    }
  });

  return pdfPath;
}
