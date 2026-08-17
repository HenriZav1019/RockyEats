import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { CartProvider } from './context/CartContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

import ClientLayout from './routes/client/ClientLayout.jsx'
import RestaurantList from './routes/client/RestaurantList.jsx'
import RestaurantMenu from './routes/client/RestaurantMenu.jsx'
import CartPage from './routes/client/CartPage.jsx'
import CheckoutPage from './routes/client/CheckoutPage.jsx'
import OrderConfirmationPage from './routes/client/OrderConfirmationPage.jsx'

import Login from './routes/auth/Login.jsx'

const DashboardLayout = lazy(() => import('./routes/dashboard/DashboardLayout.jsx'))
const DashboardIndex = lazy(() => import('./routes/dashboard/DashboardIndex.jsx'))
const QueuePage = lazy(() => import('./routes/dashboard/QueuePage.jsx'))
const StationQueuePage = lazy(() => import('./routes/dashboard/StationQueuePage.jsx'))
const MenuPage = lazy(() => import('./routes/dashboard/MenuPage.jsx'))
const SalesPage = lazy(() => import('./routes/dashboard/SalesPage.jsx'))
const SettingsPage = lazy(() => import('./routes/dashboard/SettingsPage.jsx'))

const AdminLayout = lazy(() => import('./routes/admin/AdminLayout.jsx'))
const RestaurantsPage = lazy(() => import('./routes/admin/RestaurantsPage.jsx'))
const RestaurantFormPage = lazy(() => import('./routes/admin/RestaurantFormPage.jsx'))
const UsersPage = lazy(() => import('./routes/admin/UsersPage.jsx'))

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-50">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-ocean-500 border-t-transparent" />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route element={<ClientLayout />}>
              <Route path="/" element={<RestaurantList />} />
              <Route path="/r/:restaurantId" element={<RestaurantMenu />} />
              <Route path="/r/:restaurantId/cart" element={<CartPage />} />
              <Route path="/r/:restaurantId/checkout" element={<CheckoutPage />} />
              <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
            </Route>

            <Route path="/login" element={<Login />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute role={['restaurant_owner', 'bar_staff', 'kitchen_staff']}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardIndex />} />
              <Route path="queue" element={<QueuePage />} />
              <Route path="queue/bar" element={<StationQueuePage station="bar" />} />
              <Route path="queue/kitchen" element={<StationQueuePage station="kitchen" />} />
              <Route path="menu" element={<MenuPage />} />
              <Route path="sales" element={<SalesPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            <Route
              path="/admin"
              element={
                <ProtectedRoute role="admin">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<RestaurantsPage />} />
              <Route path="restaurants/new" element={<RestaurantFormPage />} />
              <Route path="restaurants/:id" element={<RestaurantFormPage />} />
              <Route path="users" element={<UsersPage />} />
            </Route>
          </Routes>
          </Suspense>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
