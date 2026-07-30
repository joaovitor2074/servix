import './App.css'
import { useState,useEffect } from 'react'
import { buscarUsuarioAtual } from './features/auth/services/auth.service'
import { FINANCEIRO_PREVIEW_HABILITADO } from './features/finance/config/finance-preview.config'
import {
  obterToken,
  obterUsuarioEmCache,
  removerToken,
  salvarUsuarioEmCache,
} from './shared/utils/token-storage'
import type { UsuarioAutenticado } from './features/auth/types/auth.types'
import AppRouter from './app/router'



function App() {
  const [usuario,setUsuario] = useState<UsuarioAutenticado | null>(() => obterUsuarioEmCache())
  const [carregando,setCarregando] = useState(() => Boolean(obterToken()) && !obterUsuarioEmCache())

  function handleLogin(usuarioAutenticado: UsuarioAutenticado) {
    salvarUsuarioEmCache(usuarioAutenticado)
    setUsuario(usuarioAutenticado)
  }

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
        removerToken()
        setUsuario(null)
        setCarregando(false)
        return
      }

      try {
        const usuarioAtual = await buscarUsuarioAtual()
        setUsuario(usuarioAtual)
        salvarUsuarioEmCache(usuarioAtual)
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
    <AppRouter usuario={usuario} onLogin={handleLogin} onLogout={handleLogout}/>
  )

}

function limparFinanceiroPreview() {
  if (!FINANCEIRO_PREVIEW_HABILITADO) return
  void import('./features/finance/services/finance-preview.service')
    .then(modulo => modulo.resetarFinanceiroPreviewEmMemoria())
}

export default App
