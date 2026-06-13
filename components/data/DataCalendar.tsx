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
  title: string
  unavailableNote?: string
}

const STATUS_STYLES: Record<DayStatus, string> = {
  ok: 'calendar-day ok',
  partial: 'calendar-day partial',
  missing: 'calendar-day missing',
  weekend: 'calendar-day weekend',
}

type MonthGroup = {
  key: string
  label: string
  days: CalendarDay[]
  leadingBlanks: number
}

export function DataCalendar({ days, title, unavailableNote }: Props) {
  const [selected, setSelected] = useState<CalendarDay | null>(null)
  const monthGroups = groupDaysByMonth(days)

  return (
    <div className="calendar-panel">
      <div className="calendar-header">
        <span className="calendar-title">{title}</span>
        <div className="calendar-legend">
          <Legend swatch="ok" label="Full" />
          <Legend swatch="partial" label="Partial" />
          <Legend swatch="missing" label="Missing" />
          <Legend swatch="weekend" label="Weekend" />
        </div>
      </div>
      <div className="calendar-months">
        {monthGroups.map((month) => (
          <section className="calendar-month" key={month.key}>
            <h4>{month.label}</h4>
            <div className="calendar-weekdays">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>
            <div className="calendar-grid">
              {Array.from({ length: month.leadingBlanks }).map((_, index) => (
                <div aria-hidden="true" className="calendar-blank" key={`blank-${month.key}-${index}`} />
              ))}
              {month.days.map((day, index) => (
                <button
                  className={STATUS_STYLES[day.status]}
                  disabled={day.status === 'weekend'}
                  key={`${day.date}-${index}`}
                  onClick={() => setSelected(day)}
                  type="button"
                >
                  {new Date(`${day.date}T00:00:00`).getDate()}
                </button>
              ))}
            </div>
          </section>
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
              <>Partial - {selected.affectedSources?.join(', ') || 'unknown source'}</>
            ) : null}
            {selected.status === 'missing' ? (
              <>
                Missing - {selected.affectedSources?.join(', ') || 'unknown source'}
                {selected.affectedTickers?.length ? ` Tickers: ${selected.affectedTickers.join(', ')}.` : null}
                {' · '}
                <a className="text-link" href={`/data?source=${encodeURIComponent(selected.affectedSources?.[0] ?? '')}#rebuild`}>
                  Rebuild
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

function groupDaysByMonth(days: CalendarDay[]): MonthGroup[] {
  const groups = new Map<string, CalendarDay[]>()
  for (const day of days) {
    const key = day.date.slice(0, 7)
    groups.set(key, [...(groups.get(key) ?? []), day])
  }

  return [...groups.entries()].map(([key, monthDays]) => {
    const firstDate = monthDays[0]?.date
    return {
      key,
      label: firstDate ? new Date(`${firstDate}T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : key,
      days: monthDays,
      leadingBlanks: firstDate ? (new Date(`${firstDate}T00:00:00`).getDay() + 6) % 7 : 0,
    }
  })
}
