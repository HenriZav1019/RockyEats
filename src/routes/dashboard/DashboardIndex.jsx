import OrdersPage from './OrdersPage.jsx'

// DashboardLayout already redirects bar_staff/kitchen_staff away before this
// route ever renders, so this index route is only ever reached by owners/admins.
function DashboardIndex() {
  return <OrdersPage />
}

export default DashboardIndex
