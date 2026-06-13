export type SourceStatusRow = {
  source: string
  lastSeen?: string | null
  expectedCadence?: string | null
  status: 'ok' | 'partial' | 'missing' | 'unknown'
  detail?: string
}

type Props = {
  sources: SourceStatusRow[]
}

export function SourcesTable({ sources }: Props) {
  return (
    <div className="card">
      <h3>Sources</h3>
      <div className="table-wrap">
        <table className="registry-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Last seen</th>
              <th>Expected cadence</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.source}>
                <td>{source.source}</td>
                <td>{source.lastSeen ?? '—'}</td>
                <td>{source.expectedCadence ?? '—'}</td>
                <td><span className={`badge ${badgeClass(source.status)}`}>{source.detail ?? source.status}</span></td>
                <td><a className="text-link" href={`/data?source=${encodeURIComponent(source.source)}#rebuild`}>Rebuild</a></td>
              </tr>
            ))}
            {sources.length === 0 ? (
              <tr>
                <td className="small" colSpan={5}>No source health rows are available.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function badgeClass(status: SourceStatusRow['status']): string {
  if (status === 'ok') return 'completed'
  if (status === 'partial') return 'running'
  if (status === 'missing') return 'failed'
  return 'queued'
}
