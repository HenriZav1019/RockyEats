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

import DashboardLayout from './routes/dashboard/DashboardLayout.jsx'
import DashboardIndex from './routes/dashboard/DashboardIndex.jsx'
import QueuePage from './routes/dashboard/QueuePage.jsx'
import StationQueuePage from './routes/dashboard/StationQueuePage.jsx'
import MenuPage from './routes/dashboard/MenuPage.jsx'
import SalesPage from './routes/dashboard/SalesPage.jsx'
import SettingsPage from './routes/dashboard/SettingsPage.jsx'

import AdminLayout from './routes/admin/AdminLayout.jsx'
import RestaurantsPage from './routes/admin/RestaurantsPage.jsx'
import RestaurantFormPage from './routes/admin/RestaurantFormPage.jsx'
import UsersPage from './routes/admin/UsersPage.jsx'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
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
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
