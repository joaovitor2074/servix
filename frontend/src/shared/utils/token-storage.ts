const TOKEN_KEY = 'servix:token'
export function salvarToken (token:string){
    localStorage.setItem(TOKEN_KEY,token)
}

export function obterToken(){
    return localStorage.getItem(TOKEN_KEY)
}

export function removerToken(){
    localStorage.removeItem(TOKEN_KEY)
}
