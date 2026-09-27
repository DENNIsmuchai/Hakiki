import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { RequireAuth } from "./lib/authContext";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import SellerDashboard from "./pages/SellerDashboard";
import NewTransaction from "./pages/NewTransaction";
import TransactionDetail from "./pages/TransactionDetail";
import BuyerPay from "./pages/BuyerPay";
import BuyerVerify from "./pages/BuyerVerify";
import BuyerPayment from "./pages/BuyerPayment";
import BuyerReceipt from "./pages/BuyerReceipt";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route
          path="/seller"
          element={
            <RequireAuth>
              <Navbar />
              <SellerDashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/seller/new"
          element={
            <RequireAuth>
              <Navbar />
              <NewTransaction />
            </RequireAuth>
          }
        />
        <Route
          path="/seller/transaction/:id"
          element={
            <RequireAuth>
              <Navbar />
              <TransactionDetail />
            </RequireAuth>
          }
        />
        <Route path="/pay/:linkId" element={<BuyerPay />} />
        <Route path="/pay/:linkId/verify" element={<BuyerVerify />} />
        <Route path="/pay/:linkId/pay" element={<BuyerPayment />} />
        <Route path="/pay/:linkId/receipt" element={<BuyerReceipt />} />
        <Route
          path="*"
          element={
            <div className="max-w-6xl mx-auto px-5 py-10">
              <h1 className="font-display text-5xl tracking-wide">Not found</h1>
              <p className="font-body text-ink/70 mt-2">
                That page doesn't exist.
              </p>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
