import { Navigate, useParams } from 'react-router-dom';

export function RedirectInventoryItemEdit() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/items?edit=${encodeURIComponent(id ?? '')}`} replace />;
}
