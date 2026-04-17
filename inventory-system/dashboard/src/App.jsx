import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Placeholder from './pages/Placeholder.jsx';
import { Spinner } from './components/ui/Spinner.jsx';
import RestockQueue from './pages/RestockQueue.jsx';
import RestockBatchDetail from './pages/RestockBatchDetail.jsx';
import PurchaseOrders from './pages/PurchaseOrders.jsx';
import PurchaseOrderDetail from './pages/PurchaseOrderDetail.jsx';
import Materials from './pages/Materials.jsx';
import MaterialDetail from './pages/MaterialDetail.jsx';
import Tools from './pages/Tools.jsx';
import ToolDetail from './pages/ToolDetail.jsx';
import Trucks from './pages/Trucks.jsx';
import TruckDetail from './pages/TruckDetail.jsx';
import Warehouses from './pages/Warehouses.jsx';
import WarehouseDetail from './pages/WarehouseDetail.jsx';
import Equipment from './pages/Equipment.jsx';
import EquipmentDetail from './pages/EquipmentDetail.jsx';
import ITAssets from './pages/ITAssets.jsx';
import ITAssetDetail from './pages/ITAssetDetail.jsx';
import Reports from './pages/Reports.jsx';
import Users from './pages/Users.jsx';
import Settings from './pages/Settings.jsx';
import ScannerLayout from './pages/scanner/ScannerLayout.jsx';
import ScannerHome from './pages/scanner/ScannerHome.jsx';
import ConsumeMaterial from './pages/scanner/ConsumeMaterial.jsx';
import ToolAction from './pages/scanner/ToolAction.jsx';
import TruckLookup from './pages/scanner/TruckLookup.jsx';
import ReplenishBin from './pages/scanner/ReplenishBin.jsx';
import ReceivePO from './pages/scanner/ReceivePO.jsx';
import TransferStock from './pages/scanner/TransferStock.jsx';

// ── Protected route wrapper ───────────────────────────────────────────────────
function RequireAuth({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <Spinner size="lg" className="text-indigo-400" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// ── Route definitions ─────────────────────────────────────────────────────────
export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* Mobile scanner — separate layout, still requires auth */}
      <Route
        path="/scanner"
        element={
          <RequireAuth>
            <ScannerLayout />
          </RequireAuth>
        }
      >
        <Route index            element={<ScannerHome />} />
        <Route path="consume"   element={<ConsumeMaterial />} />
        <Route path="tool"      element={<ToolAction />} />
        <Route path="lookup"    element={<TruckLookup />} />
        <Route path="replenish" element={<ReplenishBin />} />
        <Route path="receive"   element={<ReceivePO />} />
        <Route path="transfer"  element={<TransferStock />} />
      </Route>

      {/* Protected — all wrapped in Layout */}
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        {/* Dashboard home */}
        <Route index element={<Dashboard />} />

        {/* Inventory */}
        <Route path="materials"     element={<Materials />} />
        <Route path="materials/:id" element={<MaterialDetail />} />
        <Route path="tools"     element={<Tools />} />
        <Route path="tools/:id" element={<ToolDetail />} />
        <Route path="equipment"      element={<Equipment />} />
        <Route path="equipment/:id"  element={<EquipmentDetail />} />
        <Route path="it-assets"     element={<ITAssets />} />
        <Route path="it-assets/:id" element={<ITAssetDetail />} />

        {/* Fleet */}
        <Route path="warehouses"      element={<Warehouses />} />
        <Route path="warehouses/:id"  element={<WarehouseDetail />} />
        <Route path="trucks"          element={<Trucks />} />
        <Route path="trucks/:id"      element={<TruckDetail />} />

        {/* Operations */}
        <Route path="restock-queue"     element={<RestockQueue />} />
        <Route path="restock-queue/:id" element={<RestockBatchDetail />} />
        <Route path="purchase-orders"     element={<PurchaseOrders />} />
        <Route path="purchase-orders/:id" element={<PurchaseOrderDetail />} />

        {/* Analytics */}
        <Route path="reports" element={<Reports />} />

        {/* Admin */}
        <Route path="users"    element={<Users />} />
        <Route path="settings" element={<Settings />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
