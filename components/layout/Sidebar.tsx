'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type SidebarDot = 'green' | 'amber' | 'red' | 'gray'

export type SidebarHealth = {
  data: SidebarDot
  research: SidebarDot
  signals: SidebarDot
  registry: SidebarDot
  operations: SidebarDot
  system: SidebarDot
}

type NavItem = {
  label: string
  href: string
  dot?: SidebarDot
  badge?: string | number
}

type NavSection = {
  label: string
  items: NavItem[]
}

type Props = {
  health: SidebarHealth
  candidateCount?: number
  failedJobCount?: number
}

function Dot({ color }: { color: SidebarDot }) {
  return (
    <span className={`sidebar-dot ${color}`} />
  )
}

export function Sidebar({ health, candidateCount, failedJobCount }: Props) {
  const pathname = usePathname()
  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href)

  const sections: NavSection[] = [
    {
      label: '',
      items: [
        { label: 'Overview', href: '/', dot: health.system },
      ],
    },
    {
      label: 'Data',
      items: [
        { label: 'Data', href: '/data', dot: health.data },
      ],
    },
    {
      label: 'Pipeline',
      items: [
        { label: 'Signals', href: '/signals', dot: health.signals, badge: candidateCount },
        { label: 'Research', href: '/research', dot: health.research },
        { label: 'Registry', href: '/registry', dot: health.registry },
      ],
    },
    {
      label: 'Product',
      items: [
        { label: 'Frontoffice', href: '/frontoffice', dot: 'green' },
        { label: 'Analyst', href: '/analyst', dot: 'gray' },
      ],
    },
    {
      label: 'System',
      items: [
        {
          label: 'Operations',
          href: '/operations',
          dot: health.operations,
          badge: failedJobCount ? `${failedJobCount} fail` : undefined,
        },
        { label: 'System', href: '/diagnostics', dot: health.system },
        { label: 'Contracts', href: '/contracts', dot: 'gray' },
      ],
    },
  ]

  return (
    <aside className="sidebar-shell">
      <div className="sidebar-brand">
        <div className="sidebar-title">spy-signal</div>
        <div className="sidebar-env">PROD</div>
      </div>
      <nav className="sidebar-nav" aria-label="Backoffice navigation">
        {sections.map((section, index) => (
          <div className="sidebar-section" key={section.label || `section-${index}`}>
            {section.label ? <div className="sidebar-section-label">{section.label}</div> : null}
            {section.items.map((item) => (
              <Link
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={isActive(item.href) ? 'sidebar-link active' : 'sidebar-link'}
                href={item.href}
                key={item.href}
              >
                {item.dot ? <Dot color={item.dot} /> : null}
                <span className="sidebar-link-label">{item.label}</span>
                {item.badge !== undefined ? <span className="sidebar-badge">{item.badge}</span> : null}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">admin</div>
    </aside>
  )
}
