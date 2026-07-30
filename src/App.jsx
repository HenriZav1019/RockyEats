import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

import RestaurantList from './routes/client/RestaurantList.jsx'
import RestaurantMenu from './routes/client/RestaurantMenu.jsx'

import Login from './routes/auth/Login.jsx'

import DashboardLayout from './routes/dashboard/DashboardLayout.jsx'
import OrdersPage from './routes/dashboard/OrdersPage.jsx'
import MenuPage from './routes/dashboard/MenuPage.jsx'

import AdminLayout from './routes/admin/AdminLayout.jsx'
import RestaurantsPage from './routes/admin/RestaurantsPage.jsx'
import RestaurantFormPage from './routes/admin/RestaurantFormPage.jsx'
import UsersPage from './routes/admin/UsersPage.jsx'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RestaurantList />} />
          <Route path="/r/:restaurantId" element={<RestaurantMenu />} />

          <Route path="/login" element={<Login />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute role="restaurant_owner">
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<OrdersPage />} />
            <Route path="menu" element={<MenuPage />} />
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
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
