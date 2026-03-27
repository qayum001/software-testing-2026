import { useState } from 'react'
import { getBackendOrigin } from './api/client'
import { DishesPage } from './pages/DishesPage'
import { ProductsPage } from './pages/ProductsPage'
import './App.css'

type ScreenKey = 'products' | 'dishes'

function App() {
  const [screen, setScreen] = useState<ScreenKey>('products')
  const backendBaseUrl = getBackendOrigin()

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="hero-copy">
          <h1>Книга рецептов</h1>
        </div>
      </header>

      <nav className="tabs" aria-label="Разделы приложения">
        <button
          type="button"
          className={screen === 'products' ? 'tab is-active' : 'tab'}
          onClick={() => setScreen('products')}
        >
          Продукты
        </button>
        <button
          type="button"
          className={screen === 'dishes' ? 'tab is-active' : 'tab'}
          onClick={() => setScreen('dishes')}
        >
          Блюда
        </button>
      </nav>

      <main className="app-main">
        {screen === 'products' ? (
          <ProductsPage backendBaseUrl={backendBaseUrl} />
        ) : (
          <DishesPage backendBaseUrl={backendBaseUrl} />
        )}
      </main>
    </div>
  )
}

export default App
