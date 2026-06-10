import Link from 'next/link'
import { BackofficeHealthPanel } from '@/app/components/backoffice-health-panel'
import { requireAdminUser } from '@/lib/admin-auth'
import { loadBackofficeHealth } from '@/lib/backoffice-health'

export default async function HomePage() {
  const admin = await requireAdminUser()
  const health = await loadBackofficeHealth(admin.email)

  return (
    <div className="page-stack">
      <div className="hero-panel">
        <div>
          <p className="eyebrow">Internal Research / Data Pipeline Control Room</p>
          <h1>Run research with confidence, and see pipeline failures before they waste a day.</h1>
          <p className="hero-copy">
            Start with data quality, launch a research run in operator language, inspect evidence and lineage, then use diagnostics when a protected backend route or registry service breaks.
          </p>
        </div>
        <div className="hero-actions">
          <Link className="hero-link" href="/research">Open Research Lab</Link>
          <Link className="hero-link secondary-link" href="/data-ops">Check Data Quality</Link>
        </div>
      </div>

      <BackofficeHealthPanel snapshot={health} />

      <div className="feature-grid">
        <SectionLink
          href="/research"
          title="Research Lab"
          body="Create a run from a theory-first builder, browse the run library, inspect stage progress, compare runs, and follow candidates or bundles into evidence."
        />
        <SectionLink
          href="/data-ops"
          title="Data Quality"
          body="Check domain coverage, find missing business days, review failed repair jobs, and see which backend contracts are still missing for duplicates, freshness, and source comparison."
        />
        <SectionLink
          href="/registry"
          title="Registry / Evidence"
          body="Review candidates, bundles, readiness reports, promotion history, and active pointers with explanations instead of raw API jargon."
        />
        <SectionLink
          href="/diagnostics"
          title="Diagnostics"
          body="Verify backend connectivity, registry connectivity, protected route reachability, and analyst smoke-test flows without making the smoke tests the default landing page."
        />
      </div>
    </div>
  )
}

function SectionLink({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="section-link-card">
      <div className="section-link-eyebrow">{title}</div>
      <div className="section-link-copy">{body}</div>
    </Link>
  )
}
