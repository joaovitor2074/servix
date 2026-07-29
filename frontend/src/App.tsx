import './App.css'
import { useState,useEffect } from 'react'
import { buscarUsuarioAtual } from './features/auth/services/auth.service'
import { FINANCEIRO_PREVIEW_HABILITADO } from './features/finance/config/finance-preview.config'
import { obterToken,removerToken } from './shared/utils/token-storage'
import type { UsuarioAutenticado } from './features/auth/types/auth.types'
import AppRouter from './app/router'



function App() {
  const [usuario,setUsuario] = useState<UsuarioAutenticado | null>(null)
  const [carregando,setCarregando] = useState(true)

  function handleLogout(){
    limparFinanceiroPreview()
    removerToken()
    setUsuario(null)
  }

  useEffect(()=>{
    async function restaurarSessao(){
      if (window.location.pathname.replace(/\/+$/, '') === '/demonstracao') {
        setCarregando(false)
        return
      }

      const token = obterToken()

      if(!token){
        setCarregando(false)
        return
      }

      try {
        const usuarioAtual = await buscarUsuarioAtual()
        setUsuario(usuarioAtual)
      }catch{
        limparFinanceiroPreview()
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

function limparFinanceiroPreview() {
  if (!FINANCEIRO_PREVIEW_HABILITADO) return
  void import('./features/finance/services/finance-preview.service')
    .then(modulo => modulo.resetarFinanceiroPreviewEmMemoria())
}

export default App
