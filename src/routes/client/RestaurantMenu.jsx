import { useParams } from 'react-router-dom'

function RestaurantMenu() {
  const { restaurantId } = useParams()

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">Menu</h1>
      <p className="mt-2 text-gray-600">Menu for restaurant {restaurantId} will render here.</p>
    </div>
  )
}

export default RestaurantMenu
