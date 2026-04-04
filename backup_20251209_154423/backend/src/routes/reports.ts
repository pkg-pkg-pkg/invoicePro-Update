import { Router } from 'express';
import {
  // Sales Reports
  getSalesRegister,
  getSalesSummary,
  getSalesByCustomer,
  getSalesByProduct,
  // Purchase Reports
  getPurchaseRegister,
  getPurchaseBySupplier,
  // Stock Reports
  getCurrentStock,
  getStockMovement,
  getLowStock,
  // Financial Reports
  getDayBook,
  getProfitAndLoss,
  // Party Reports
  getCustomerOutstanding,
  getSupplierPayable,
  // Payment Reports
  getPaymentReceived,
  getPaymentMade,
} from '../controllers/reports';

const router = Router();

// Sales Reports
router.get('/sales/register', getSalesRegister);
router.get('/sales/summary', getSalesSummary);
router.get('/sales/by-customer', getSalesByCustomer);
router.get('/sales/by-product', getSalesByProduct);

// Purchase Reports
router.get('/purchase/register', getPurchaseRegister);
router.get('/purchase/by-supplier', getPurchaseBySupplier);

// Stock Reports
router.get('/stock/current', getCurrentStock);
router.get('/stock/movement', getStockMovement);
router.get('/stock/low', getLowStock);

// Financial Reports
router.get('/financial/daybook', getDayBook);
router.get('/financial/profit-loss', getProfitAndLoss);

// Party Reports
router.get('/party/customer-outstanding', getCustomerOutstanding);
router.get('/party/supplier-payable', getSupplierPayable);

// Payment Reports
router.get('/payment/received', getPaymentReceived);
router.get('/payment/made', getPaymentMade);

export default router;

