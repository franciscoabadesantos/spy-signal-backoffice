'use client'

import { useState } from 'react'

export type DayStatus = 'ok' | 'partial' | 'missing' | 'weekend'

export type CalendarDay = {
  date: string
  status: DayStatus
  coverage?: number
  affectedSources?: string[]
  affectedTickers?: string[]
}

type Props = {
  days: CalendarDay[]
  month: string
  unavailableNote?: string
}

const STATUS_STYLES: Record<DayStatus, string> = {
  ok: 'calendar-day ok',
  partial: 'calendar-day partial',
  missing: 'calendar-day missing',
  weekend: 'calendar-day weekend',
}

export function DataCalendar({ days, month, unavailableNote }: Props) {
  const [selected, setSelected] = useState<CalendarDay | null>(null)
  const firstDate = days[0]?.date
  const leadingBlanks = firstDate ? (new Date(`${firstDate}T00:00:00`).getDay() + 6) % 7 : 0

  return (
    <div style={{ minHeight: 280 }}>
      <div className="calendar-header">
        <span className="calendar-title">{month}</span>
        <div className="calendar-legend">
          <Legend swatch="ok" label="Full" />
          <Legend swatch="partial" label="Partial" />
          <Legend swatch="missing" label="Missing" />
        </div>
      </div>
      <div className="calendar-weekdays">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>
      <div className="calendar-grid" style={{ gridAutoRows: 'minmax(40px, 1fr)' }}>
        {Array.from({ length: leadingBlanks }).map((_, index) => (
          <div aria-hidden="true" key={`blank-${index}`} style={{ minHeight: 40 }} />
        ))}
        {days.map((day, index) => (
          <button
            className={STATUS_STYLES[day.status]}
            disabled={day.status === 'weekend'}
            key={`${day.date}-${index}`}
            onClick={() => setSelected(day)}
            style={{ minHeight: 40 }}
            type="button"
          >
            {new Date(`${day.date}T00:00:00`).getDate()}
          </button>
        ))}
      </div>
      {unavailableNote ? <p className="small" style={{ marginTop: 10 }}>{unavailableNote}</p> : null}
      <div className="calendar-detail">
        {selected ? (
          <div>
            <strong>{formatShortDate(selected.date)}</strong>
            {' - '}
            {selected.status === 'ok' ? 'Full coverage' : null}
            {selected.status === 'partial' ? (
              <>Partial — {selected.affectedSources?.join(', ') || 'unknown source'}</>
            ) : null}
            {selected.status === 'missing' ? (
              <>
                Missing — {selected.affectedSources?.join(', ') || 'unknown source'}
                {selected.affectedTickers?.length ? ` Tickers: ${selected.affectedTickers.join(', ')}.` : null}
                {' · '}
                <a className="text-link" href={`/data?source=${encodeURIComponent(selected.affectedSources?.[0] ?? '')}#rebuild`}>
                  Rebuild →
                </a>
              </>
            ) : null}
          </div>
        ) : (
          'Select a day to see details.'
        )}
      </div>
    </div>
  )
}

function Legend({ swatch, label }: { swatch: DayStatus; label: string }) {
  return (
    <span>
      <span className={`calendar-swatch ${swatch}`} />
      {label}
    </span>
  )
}

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
