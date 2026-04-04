import { Routes, Route } from 'react-router-dom';
import PaymentList from './Payments/PaymentList';
import PaymentForm from './Payments/PaymentForm';
import PaymentReports from './Payments/PaymentReports';

export default function Payments() {
  console.log('🔍 Payments component loaded, path:', window.location.pathname);
  return (
    <Routes>
      <Route index element={<PaymentList />} />
      <Route path="new" element={<PaymentForm />} />
      <Route path="edit/:id" element={<PaymentForm />} />
      <Route path="reports" element={<PaymentReports />} />
    </Routes>
  );
}

