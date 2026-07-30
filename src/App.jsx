import { BrowserRouter, Routes, Route } from 'react-router-dom'
import RestaurantList from './routes/client/RestaurantList.jsx'
import RestaurantMenu from './routes/client/RestaurantMenu.jsx'
import DashboardHome from './routes/dashboard/DashboardHome.jsx'
import AdminHome from './routes/admin/AdminHome.jsx'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RestaurantList />} />
        <Route path="/r/:restaurantId" element={<RestaurantMenu />} />

        <Route path="/dashboard" element={<DashboardHome />} />

        <Route path="/admin" element={<AdminHome />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
