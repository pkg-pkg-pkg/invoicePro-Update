import { Routes, Route } from 'react-router-dom';
import PaymentList from './Payments/PaymentList';
import PaymentForm from './Payments/PaymentForm';

export default function Payments() {
  return (
    <Routes>
      <Route index element={<PaymentList />} />
      <Route path="new" element={<PaymentForm />} />
      <Route path="edit/:id" element={<PaymentForm />} />
    </Routes>
  );
}

