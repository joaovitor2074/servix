import type { ReactNode } from "react";
import './AuthLayout.css'
import servixSymbol from '../../assets/brand/servix-symbol.svg'

interface AuthLayoutProps {
    children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
    return (
        <div className="auth-layout">
            <div
                className="auth-layout__decoration"
                aria-hidden="true"
            >
                <img
                    className="auth-layout__symbol"
                    src={servixSymbol}
                    alt=""
                />
            </div>
            <main className="auth-layout__content">
                {children}
            </main>

            <footer className="auth-layout__footer">
                © {new Date().getFullYear()} Servix. Todos os direitos reservados.
            </footer>
        </div>
    )
}