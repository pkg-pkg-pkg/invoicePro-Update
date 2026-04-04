// D:\PVEB\desktop\src\App.tsx
// AuthContext-based routing (no Redux auth here)

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import ProductForm from "./pages/Products/ProductForm";
import Customers from "./pages/Customers";
import CustomerForm from "./pages/Customers/CustomerForm";
import CustomerLedger from "./pages/Customers/CustomerLedger";
import Suppliers from "./pages/Suppliers";
import SupplierForm from "./pages/Suppliers/SupplierForm";
import Invoices from "./pages/Invoices";
import Payments from "./pages/Payments";
import Banks from "./pages/Banks";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import GSTR1Report from "./pages/GST/GSTR1Report";
import GSTR3BReport from "./pages/GST/GSTR3BReport";
import HSNSummary from "./pages/GST/HSNSummary";

import { useAuth } from "./pages/contexts/auth";

const theme = createTheme({
  palette: {
    primary: {
      main: "#1976d2",
    },
    secondary: {
      main: "#dc004e",
    },
  },
});

function App() {
  console.log("📱 App (AuthContext version) rendering...");

  const { isAuthenticated, loading, user } = useAuth();

  console.log("🔐 AuthContext:", {
    isAuthenticated,
    loading,
    hasUser: !!user,
  });

  // AuthProvider jab localStorage se state load kar raha ho, tab simple loader
  if (loading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          <div>Loading...</div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          {/* LOGIN */}
          <Route
            path="/login"
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
            }
          />

          {/* PROTECTED ROUTES – sirf jab logged in ho */}
          {isAuthenticated && (
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="products" element={<Products />} />
              <Route path="products/new" element={<ProductForm />} />
              <Route path="products/edit/:id" element={<ProductForm />} />
              <Route path="customers" element={<Customers />} />
              <Route path="customers/new" element={<CustomerForm />} />
              <Route path="customers/edit/:id" element={<CustomerForm />} />
              <Route path="customers/ledger/:id" element={<CustomerLedger />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="suppliers/new" element={<SupplierForm />} />
              <Route path="suppliers/edit/:id" element={<SupplierForm />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="payments" element={<Payments />} />
              <Route path="banks/*" element={<Banks />} />
              <Route path="reports" element={<Reports />} />
              <Route path="gst/gstr1" element={<GSTR1Report />} />
              <Route path="gst/gstr3b" element={<GSTR3BReport />} />
              <Route path="gst/hsn-summary" element={<HSNSummary />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          )}

          {/* FALLBACK */}
          <Route
            path="*"
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
