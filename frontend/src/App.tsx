import './App.css'
import { useState } from 'react'
import LoginPage from './features/auth/pages/LoginPage'

function App() {
  const [logado,] = useState<boolean>(false)

  return (
    <>
      {!logado && <LoginPage />}
    </>
  )
}

export default App