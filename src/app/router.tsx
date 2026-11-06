import { createHashRouter, Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { LoadingState } from '@/components/feedback/States';

const Dashboard = lazy(() => import('@/features/dashboard/DashboardScreen'));
const ProductsList = lazy(() => import('@/features/products/ProductsScreen'));
const ProductForm = lazy(() => import('@/features/products/ProductFormScreen'));
const ProductDetail = lazy(() => import('@/features/products/pages/ProductDetailsPage'));
const RecordSale = lazy(() => import('@/features/sales/RecordSaleScreen'));
const ReceivePurchase = lazy(() => import('@/features/purchases/ReceivePurchaseScreen'));
const Movements = lazy(() => import('@/features/inventory/MovementsScreen'));
const Expiry = lazy(() => import('@/features/expiry/ExpiryScreen'));
const SlowMoving = lazy(() => import('@/features/slowMoving/SlowMovingScreen'));
const Restock = lazy(() => import('@/features/restock/RestockScreen'));
const Settings = lazy(() => import('@/features/settings/SettingsScreen'));
const Install = lazy(() => import('@/features/install/InstallScreen'));
const SalesHistory = lazy(() => import('@/features/sales/SalesHistoryScreen'));

function AppLayoutWrapper() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AppLayout />
    </Suspense>
  );
}

function RouteErrorScreen() {
  const error = useRouteError();
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'The requested screen could not be loaded.';

  return (
    <div className="state-box" role="alert">
      <h1>Unable to open this page</h1>
      <p className="text-sm muted">{detail}</p>
      <Link to="/" className="btn btn--primary">
        Go to Home
      </Link>
    </div>
  );
}

export const router = createHashRouter([
  {
    path: '/onboarding',
    element: <OnboardingScreen />,
  },
  {
    element: <AppLayoutWrapper />,
    errorElement: <RouteErrorScreen />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'products', element: <ProductsList /> },
      { path: 'products/new', element: <ProductForm /> }, // Must come before :productId
      { path: 'products/:productId/edit', element: <ProductForm /> }, // Specific edit route
      { path: 'products/:productId', element: <ProductDetail /> }, // Dynamic ID route last
      { path: 'sales/new', element: <RecordSale /> },
      { path: 'sales', element: <SalesHistory /> },
      { path: 'purchases/new', element: <ReceivePurchase /> },
      { path: 'movements', element: <Movements /> },
      { path: 'expiry', element: <Expiry /> },
      { path: 'slow-moving', element: <SlowMoving /> },
      { path: 'restock', element: <Restock /> },
      { path: 'settings', element: <Settings /> },
      { path: 'install', element: <Install /> },
      { path: '*', element: <RouteErrorScreen /> },
    ],
  },
]);