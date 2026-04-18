import type { Metadata } from 'next'
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
              <div className="brand">Spy Signal Backoffice</div>
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
