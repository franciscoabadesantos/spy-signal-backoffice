const PREFECT_UI_URL = 'https://prefect.longbrunch.com'
const PREFECT_DEPLOYMENTS_URL = `${PREFECT_UI_URL}/deployments`
const PREFECT_WORK_POOLS_URL = `${PREFECT_UI_URL}/work-pools`

const WORK_POOLS = [
  'finance-ops-self-host',
  'finance-feature-store',
]

const DEPLOYMENT_GROUPS = [
  {
    label: 'Data ops',
    deployments: [
      ['Market daily', 'dataops_market_daily/market-daily'],
      ['Fundamentals daily', 'dataops_fundamentals_daily/fundamentals-daily'],
      ['Earnings daily', 'dataops_earnings_daily/earnings-daily'],
      ['Data ops daily', 'dataops_daily/dataops-daily'],
      ['Ticker onboarding', 'dataops_ticker_onboarding/ticker-onboarding'],
      ['Ticker onboarding bulk', 'dataops_ticker_onboarding_bulk/ticker-onboarding-bulk'],
      ['Ticker backfill', 'dataops_ticker_backfill/ticker-backfill'],
      ['Ticker remove', 'dataops_ticker_remove/ticker-remove'],
    ],
  },
  {
    label: 'Feature store',
    deployments: [
      ['Feature build daily', 'feature-build-daily/feature-build-daily'],
      ['Scorecard daily', 'scorecard-daily/scorecard-daily'],
      ['Technical feature backfill', 'technical-feature-backfill/technical-feature-backfill'],
    ],
  },
] satisfies Array<{ label: string; deployments: Array<[string, string]> }>

export default function OperationsWorkspace({ adminEmail }: { adminEmail: string }) {
  return (
    <div className="page-stack">
      <div className="hero-panel">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Prefect shortcuts and lightweight operational visibility.</h1>
          <p className="hero-copy">
            Read-only Backoffice surface for primary work pools and deployments. Use Prefect UI for detailed run inspection and operational actions.
          </p>
        </div>
        <div className="hero-actions">
          <div className="small">Admin: {adminEmail}</div>
          <a className="hero-link" href={PREFECT_UI_URL} rel="noreferrer" target="_blank">
            Open Prefect UI
          </a>
        </div>
      </div>

      <div className="card">
        <div className="split-row">
          <div>
            <h2>Work Pools</h2>
            <p className="small">Stable pool names only. Status requires a future read-only backend overview endpoint.</p>
          </div>
          <a className="secondary-button operations-inline-action" href={PREFECT_WORK_POOLS_URL} rel="noreferrer" target="_blank">
            Open work pools
          </a>
        </div>
        <div className="operations-pool-grid">
          {WORK_POOLS.map((pool) => (
            <a className="control-kpi-card" href={PREFECT_WORK_POOLS_URL} key={pool} rel="noreferrer" target="_blank">
              <label>{pool}</label>
              <span className="badge muted">Shortcut</span>
              <div className="small">Backend status not wired yet.</div>
            </a>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="split-row">
          <div>
            <h2>Deployments</h2>
            <p className="small">Links go to Prefect UI lists, not deployment IDs.</p>
          </div>
          <a className="secondary-button operations-inline-action" href={PREFECT_DEPLOYMENTS_URL} rel="noreferrer" target="_blank">
            Open deployments
          </a>
        </div>

        {DEPLOYMENT_GROUPS.map((group) => (
          <div className="operations-section" key={group.label}>
            <h3>{group.label}</h3>
            <div className="table-wrap">
              <table className="registry-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Prefect deployment</th>
                    <th>Link</th>
                  </tr>
                </thead>
                <tbody>
                  {group.deployments.map(([label, prefectName]) => (
                    <tr key={prefectName}>
                      <td>{label}</td>
                      <td><code>{prefectName}</code></td>
                      <td>
                        <a className="text-link" href={PREFECT_DEPLOYMENTS_URL} rel="noreferrer" target="_blank">
                          Open in Prefect
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Runs Overview</h2>
        <div className="evidence-gap">
          <strong>Backend overview endpoint not available yet</strong>
          <span>Next scheduled runs and latest runs will appear here once Backoffice has a read-only backend contract.</span>
        </div>
      </div>
    </div>
  )
}
