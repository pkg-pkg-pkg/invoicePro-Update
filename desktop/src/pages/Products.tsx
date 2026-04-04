import { Routes, Route } from 'react-router-dom';
import ProductList from './Products/ProductList';
import ProductForm from './Products/ProductForm'; 

export default function Products() {
  return (
    <Routes>
      <Route index element={<ProductList />} />
      <Route path="new" element={<ProductForm />} />
      <Route path="edit/:id" element={<ProductForm />} />
    </Routes>
  );
}
