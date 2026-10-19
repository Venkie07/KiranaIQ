import { createBrowserRouter } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { LoadingState } from '@/components/feedback/States';

const Dashboard = lazy(() => import('@/features/dashboard/DashboardScreen'));
const Products = lazy(() => import('@/features/products/ProductsScreen'));
const ProductForm = lazy(() => import('@/features/products/ProductFormScreen'));
const ProductDetail = lazy(() => import('@/features/products/ProductDetailScreen'));
const RecordSale = lazy(() => import('@/features/sales/RecordSaleScreen'));
const ReceivePurchase = lazy(() => import('@/features/purchases/ReceivePurchaseScreen'));
const Movements = lazy(() => import('@/features/inventory/MovementsScreen'));
const Expiry = lazy(() => import('@/features/expiry/ExpiryScreen'));
const SlowMoving = lazy(() => import('@/features/slowMoving/SlowMovingScreen'));
const Restock = lazy(() => import('@/features/restock/RestockScreen'));
const Settings = lazy(() => import('@/features/settings/SettingsScreen'));
const Install = lazy(() => import('@/features/install/InstallScreen'));

function AppLayoutWrapper() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AppLayout />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: '/onboarding',
    element: <OnboardingScreen />,
  },
  {
    element: <AppLayoutWrapper />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'products', element: <Products /> },
      { path: 'products/new', element: <ProductForm /> },
      { path: 'products/:id', element: <ProductDetail /> },
      { path: 'products/:id/edit', element: <ProductForm /> },
      { path: 'sales/new', element: <RecordSale /> },
      { path: 'purchases/new', element: <ReceivePurchase /> },
      { path: 'movements', element: <Movements /> },
      { path: 'expiry', element: <Expiry /> },
      { path: 'slow-moving', element: <SlowMoving /> },
      { path: 'restock', element: <Restock /> },
      { path: 'settings', element: <Settings /> },
      { path: 'install', element: <Install /> },
    ],
  },
]);