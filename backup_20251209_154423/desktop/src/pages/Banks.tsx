import { Routes, Route } from 'react-router-dom';
import BankList from './Banks/BankList';
import BankForm from './Banks/BankForm';
import BankStatement from './Banks/BankStatement';

export default function Banks() {
  return (
    <Routes>
      <Route index element={<BankList />} />
      <Route path="new" element={<BankForm />} />
      <Route path="edit/:id" element={<BankForm />} />
      <Route path=":id/statement" element={<BankStatement />} />
    </Routes>
  );
}

