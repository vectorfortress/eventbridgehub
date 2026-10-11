import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'EventBridge Hub — Connect every celebration',
  description: 'A shared event workspace for customers, planners, and rental companies.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>
    <header className="topbar"><div className="topnav container">
      <Link className="brand" href="/"><span className="brand-mark">✦</span><span>eventbridge<span className="brand-light">hub</span></span></Link>
      <nav><Link href="/vendors">Find vendors</Link><Link href="/dashboard">Dashboard</Link><Link className="nav-cta" href="/login">Sign in / Join</Link></nav>
    </div></header>
    <main>{children}</main>
    <footer className="footer"><div className="container foot-content">
      <span>© 2026 EventBridge Hub. Pilot build.</span>
      <span>Quotes are not reservations. No payments are processed in this release.</span>
    </div></footer>
  </body></html>
}
