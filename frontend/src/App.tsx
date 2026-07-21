import './App.css'
import { useState,useEffect } from 'react'
import { buscarUsuarioAtual } from './features/auth/services/auth.service'
import { obterToken,removerToken } from './shared/utils/token-storage'
import type { UsuarioAutenticado } from './features/auth/types/auth.types'
import AppRouter from './app/router'



function App() {
  const [usuario,setUsuario] = useState<UsuarioAutenticado | null>(null)
  const [carregando,setCarregando] = useState(true)

  function handleLogout(){
    removerToken()
    setUsuario(null)
  }

  useEffect(()=>{
    async function restaurarSessao(){
      const token = obterToken()

      if(!token){
        setCarregando(false)
        return
      }

      try {
        const usuarioAtual = await buscarUsuarioAtual()
        setUsuario(usuarioAtual)
      }catch{
        removerToken()
      }finally{
        setCarregando(false)
      }
    }

    restaurarSessao()
  },[])

  if(carregando){
    return <p>Carregando...</p>
  }

  return (
    <AppRouter usuario={usuario} onLogin={setUsuario} onLogout={handleLogout}/>
  )

}

export default App
