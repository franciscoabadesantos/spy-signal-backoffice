import type { Metadata } from 'next'
import Link from 'next/link'
import { ClerkProvider, SignInButton, UserButton } from '@clerk/nextjs'
import { auth } from '@clerk/nextjs/server'
import './globals.css'

export const metadata: Metadata = {
  title: 'Spy Signal Backoffice',
  description: 'Admin-only operations console',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <header className="header">
            <div className="container header-inner">
              <div className="brand-wrap">
                <div className="brand">Spy Signal Backoffice</div>
                <nav className="header-nav" aria-label="Backoffice navigation">
                  <div className="nav-group">
                    <span className="nav-group-label">Command</span>
                    <Link href="/">Control Room</Link>
                    <Link href="/operations">Operations</Link>
                  </div>
                  <div className="nav-group">
                    <span className="nav-group-label">Labs</span>
                    <Link href="/data-ops">Data Ops</Link>
                    <Link href="/research">Research Lab</Link>
                    <Link href="/analyst">Analyst</Link>
                    <Link href="/signals">Signals</Link>
                    <Link href="/frontoffice">Frontoffice</Link>
                  </div>
                  <div className="nav-group">
                    <span className="nav-group-label">System</span>
                    <Link href="/registry">Registry / Evidence</Link>
                    <Link href="/contracts">Contracts</Link>
                    <Link href="/diagnostics">Diagnostics</Link>
                  </div>
                </nav>
              </div>
              <div>
                {userId ? <UserButton /> : <SignInButton />}
              </div>
            </div>
          </header>
          <main className="container main">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  )
}
