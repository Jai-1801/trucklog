import type { ReactNode } from 'react'
import { formatClock, formatDecimalHours } from '../../lib/format'
import type { DailyLog, DutyStatus, Remark, RemarkKind } from '../../lib/types'

// Drawn to match the FMCSA paper "Driver's Daily Log" (docs/reference: blank-paper-log.png).
// Printed form = ink; everything filled in from the plan = the accent colour, like pen on paper.

export type SheetMeta = {
  carrier: string
  mainOffice: string
  homeTerminal: string
  vehicle: string
  shippingDoc: string
  shipper: string
}

const W = 1000
const H = 760
const GRID_L = 130
const GRID_R = 880
const HOUR_W = (GRID_R - GRID_L) / 24
const BAND_TOP = 196
const BAND_H = 24
const ROWS_TOP = BAND_TOP + BAND_H
const ROW_H = 30
const ROWS_BOTTOM = ROWS_TOP + 4 * ROW_H
const TOTAL_X = 935
const REMARKS_BOTTOM = 548

const INK = '#1c1917'
const RULE = '#44403c'
const FAINT = '#a8a29e'
const PEN = '#c2410c'
const CAPTION = '#57534e'

const ROWS: { status: DutyStatus; label: [string, string?] }[] = [
  { status: 'OFF', label: ['1. Off Duty'] },
  { status: 'SB', label: ['2. Sleeper', 'Berth'] },
  { status: 'D', label: ['3. Driving'] },
  { status: 'ON', label: ['4. On Duty', '(not driving)'] },
]
const ROW_INDEX: Record<DutyStatus, number> = { OFF: 0, SB: 1, D: 2, ON: 3 }

const REMARK_SHORT: Record<RemarkKind, string> = {
  drive: 'Driving',
  pickup: 'Pickup',
  dropoff: 'Dropoff',
  fuel: 'Fuel',
  break: '30-min break',
  rest: '10-hr rest (SB)',
  restart: '34-hr restart',
  off: 'Off duty',
}

const x = (minute: number) => GRID_L + (minute / 60) * HOUR_W
const rowMid = (status: DutyStatus) => ROWS_TOP + ROW_INDEX[status] * ROW_H + ROW_H / 2

function Text({
  children,
  size = 10,
  weight = 400,
  fill = INK,
  anchor = 'start',
  numeric = false,
  ...pos
}: {
  x: number
  y: number
  children: ReactNode
  size?: number
  weight?: number
  fill?: string
  anchor?: 'start' | 'middle' | 'end'
  numeric?: boolean
}) {
  return (
    <text
      {...pos}
      fontSize={size}
      fontWeight={weight}
      fill={fill}
      textAnchor={anchor}
      fontFamily="var(--font-sans)"
      style={numeric ? { fontVariantNumeric: 'tabular-nums' } : undefined}
    >
      {children}
    </text>
  )
}

/** A form field: pen-blue value sitting on a rule, printed caption underneath. */
function Field({ x0, x1, y, value, caption }: { x0: number; x1: number; y: number; value: string; caption: string }) {
  return (
    <g>
      <Text x={(x0 + x1) / 2} y={y - 5} size={13} fill={PEN} anchor="middle" weight={500}>
        {value}
      </Text>
      <line x1={x0} x2={x1} y1={y} y2={y} stroke={RULE} strokeWidth={0.8} />
      <Text x={(x0 + x1) / 2} y={y + 12} size={8.5} anchor="middle" fill={CAPTION}>
        {caption}
      </Text>
    </g>
  )
}

function dutyPath(log: DailyLog): string {
  let d = ''
  log.segments.forEach((seg, i) => {
    const y = rowMid(seg.status)
    d += i === 0 ? `M${x(seg.start_min)},${y}` : `V${y}`
    d += `H${x(seg.end_min)}`
  })
  return d
}

function monthDayYear(isoDate: string): [string, string, string] {
  const [y, m, d] = isoDate.split('-')
  return [m, d, y]
}

export function LogSheet({ log, meta, dayCount }: { log: DailyLog; meta: SheetMeta; dayCount: number }) {
  const [month, day, year] = monthDayYear(log.date)
  const total = Object.values(log.totals).reduce((a, b) => a + b, 0)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Driver's daily log for ${log.date}, day ${log.day_number} of ${dayCount}: driving ${log.totals.D} hours, ${log.total_miles_driving} miles`}
      className="h-auto w-full select-none"
    >
      <rect width={W} height={H} fill="#fff" />

      {/* ─── Header ─────────────────────────────────────────── */}
      <Text x={20} y={34} size={24} weight={700}>
        Drivers Daily Log
      </Text>
      <Text x={52} y={50} size={9}>
        (24 hours)
      </Text>
      <Field x0={300} x1={370} y={36} value={month} caption="(month)" />
      <Text x={378} y={34} size={16} fill={RULE}>
        /
      </Text>
      <Field x0={392} x1={452} y={36} value={day} caption="(day)" />
      <Text x={460} y={34} size={16} fill={RULE}>
        /
      </Text>
      <Field x0={474} x1={554} y={36} value={year} caption="(year)" />
      <Text x={640} y={24} size={9}>
        Original – File at home terminal.
      </Text>
      <Text x={640} y={37} size={9}>
        Duplicate – Driver retains in his/her possession for 8 days.
      </Text>
      <Text x={880} y={56} size={9} anchor="end" fill={FAINT}>
        Day {log.day_number} of {dayCount}
      </Text>

      <Text x={40} y={80} size={12} weight={600}>
        From:
      </Text>
      <Text x={86} y={78} size={13} fill={PEN} weight={500}>
        {log.from}
      </Text>
      <line x1={80} x2={470} y1={82} y2={82} stroke={RULE} strokeWidth={0.8} />
      <Text x={500} y={80} size={12} weight={600}>
        To:
      </Text>
      <Text x={530} y={78} size={13} fill={PEN} weight={500}>
        {log.to}
      </Text>
      <line x1={524} x2={960} y1={82} y2={82} stroke={RULE} strokeWidth={0.8} />

      {[
        { x0: 40, label: 'Total Miles Driving Today' },
        { x0: 196, label: 'Total Mileage Today' },
      ].map(({ x0, label }) => (
        <g key={label}>
          <rect x={x0} y={98} width={146} height={34} fill="none" stroke={RULE} strokeWidth={0.9} />
          <Text x={x0 + 73} y={121} size={15} fill={PEN} anchor="middle" numeric weight={500}>
            {Math.round(log.total_miles_driving).toLocaleString()}
          </Text>
          <Text x={x0 + 73} y={145} size={8.5} anchor="middle" fill={CAPTION}>
            {label}
          </Text>
        </g>
      ))}
      <Field x0={40} x1={342} y={176} value={meta.vehicle} caption="Truck/Tractor and Trailer Numbers or License Plate(s)/State (show each unit)" />
      <Field x0={470} x1={960} y={116} value={meta.carrier} caption="Name of Carrier or Carriers" />
      <Field x0={470} x1={960} y={146} value={meta.mainOffice} caption="Main Office Address" />
      <Field x0={470} x1={960} y={176} value={meta.homeTerminal} caption="Home Terminal Address" />

      {/* ─── Grid ───────────────────────────────────────────── */}
      <rect x={GRID_L - 70} y={BAND_TOP} width={GRID_R - GRID_L + 96} height={BAND_H} fill={INK} />
      <Text x={GRID_L - 64} y={BAND_TOP + 10} size={7.5} fill="#fff" weight={600}>
        Mid-
      </Text>
      <Text x={GRID_L - 64} y={BAND_TOP + 19} size={7.5} fill="#fff" weight={600}>
        night
      </Text>
      {Array.from({ length: 23 }, (_, i) => {
        const h = i + 1
        return (
          <Text key={h} x={x(h * 60)} y={BAND_TOP + 16} size={h === 12 ? 7.5 : 9} fill="#fff" anchor="middle" weight={600}>
            {h === 12 ? 'Noon' : String(h % 12)}
          </Text>
        )
      })}
      <Text x={GRID_R + 4} y={BAND_TOP + 10} size={7.5} fill="#fff" weight={600}>
        Mid-
      </Text>
      <Text x={GRID_R + 4} y={BAND_TOP + 19} size={7.5} fill="#fff" weight={600}>
        night
      </Text>
      <Text x={TOTAL_X} y={BAND_TOP - 12} size={8.5} anchor="middle" weight={600}>
        Total
      </Text>
      <Text x={TOTAL_X} y={BAND_TOP - 2} size={8.5} anchor="middle" weight={600}>
        Hours
      </Text>

      {ROWS.map(({ status, label }, i) => {
        const top = ROWS_TOP + i * ROW_H
        return (
          <g key={status}>
            <Text x={GRID_L - 124} y={top + (label[1] ? 13 : 19)} size={10} weight={600}>
              {label[0]}
            </Text>
            {label[1] && (
              <Text x={GRID_L - 110} y={top + 25} size={9} weight={600}>
                {label[1]}
              </Text>
            )}
            <rect x={GRID_L} y={top} width={GRID_R - GRID_L} height={ROW_H} fill="#fff" stroke={RULE} strokeWidth={0.9} />
            {Array.from({ length: 24 * 4 }, (_, q) => {
              if (q === 0) return null
              const qx = GRID_L + (q * HOUR_W) / 4
              const len = q % 4 === 0 ? ROW_H : q % 2 === 0 ? ROW_H * 0.55 : ROW_H * 0.3
              return <line key={q} x1={qx} x2={qx} y1={top} y2={top + len} stroke={q % 4 === 0 ? RULE : FAINT} strokeWidth={q % 4 === 0 ? 0.8 : 0.6} />
            })}
            <line x1={GRID_R + 14} x2={GRID_R + 96} y1={top + ROW_H - 3} y2={top + ROW_H - 3} stroke={RULE} strokeWidth={0.8} />
            <Text x={TOTAL_X} y={top + ROW_H - 8} size={13} fill={PEN} anchor="middle" numeric weight={500}>
              {formatDecimalHours(log.totals[status])}
            </Text>
          </g>
        )
      })}
      <Text x={TOTAL_X - 38} y={ROWS_BOTTOM + 18} size={12} fill={RULE}>
        =
      </Text>
      <Text x={TOTAL_X} y={ROWS_BOTTOM + 18} size={13} fill={PEN} anchor="middle" numeric weight={600}>
        {formatDecimalHours(total)}
      </Text>

      {/* Hover targets: native tooltips name each duty period. */}
      {log.segments.map((seg) => (
        <rect
          key={`${seg.status}-${seg.start_min}`}
          x={x(seg.start_min)}
          y={ROWS_TOP + ROW_INDEX[seg.status] * ROW_H}
          width={x(seg.end_min) - x(seg.start_min)}
          height={ROW_H}
          fill="transparent"
        >
          <title>
            {`${ROWS[ROW_INDEX[seg.status]].label.join(' ').replace(/^\d\. /, '')}: ${formatClock(seg.start_min)} – ${formatClock(seg.end_min)} (${formatDecimalHours((seg.end_min - seg.start_min) / 60)} h)`}
          </title>
        </rect>
      ))}

      <path d={dutyPath(log)} fill="none" stroke={PEN} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" />

      {/* ─── Remarks ────────────────────────────────────────── */}
      <Text x={20} y={ROWS_BOTTOM + 26} size={13} weight={700}>
        Remarks
      </Text>
      <line x1={GRID_L - 70} x2={GRID_L - 70} y1={ROWS_BOTTOM + 36} y2={REMARKS_BOTTOM} stroke={INK} strokeWidth={2.5} />
      {log.remarks.map((remark) => (
        <RemarkMark key={`${remark.time_min}-${remark.kind}`} remark={remark} />
      ))}

      <Text x={20} y={REMARKS_BOTTOM + 14} size={11} weight={700}>
        Shipping Documents:
      </Text>
      <Text x={20} y={REMARKS_BOTTOM + 34} size={9.5}>
        DVL or Manifest No.
      </Text>
      <Text x={138} y={REMARKS_BOTTOM + 34} size={11} fill={PEN} weight={500}>
        {meta.shippingDoc}
      </Text>
      <line x1={132} x2={380} y1={REMARKS_BOTTOM + 37} y2={REMARKS_BOTTOM + 37} stroke={RULE} strokeWidth={0.8} />
      <Text x={20} y={REMARKS_BOTTOM + 54} size={9.5}>
        Shipper &amp; Commodity
      </Text>
      <Text x={138} y={REMARKS_BOTTOM + 54} size={11} fill={PEN} weight={500}>
        {meta.shipper}
      </Text>
      <line x1={132} x2={380} y1={REMARKS_BOTTOM + 57} y2={REMARKS_BOTTOM + 57} stroke={RULE} strokeWidth={0.8} />
      <Text x={600} y={REMARKS_BOTTOM + 74} size={9.5} anchor="middle">
        Enter name of place you reported and where released from work and when and where each change of duty status occurred.
      </Text>
      <Text x={600} y={REMARKS_BOTTOM + 87} size={9.5} anchor="middle">
        Use time standard of home terminal.
      </Text>

      <Recap log={log} />
    </svg>
  )
}

function RemarkMark({ remark }: { remark: Remark }) {
  const x0 = x(remark.time_min)
  const stop = remark.kind !== 'drive' && remark.kind !== 'off' && remark.duration_min > 0
  const x1 = stop ? x(Math.min(1440, remark.time_min + remark.duration_min)) : x0
  const bracketY = ROWS_BOTTOM + 12
  const labelY = ROWS_BOTTOM + 28
  const text = `${remark.location} · ${REMARK_SHORT[remark.kind]}`
  const nearLeftEdge = remark.time_min < 4 * 60
  return (
    <g>
      <line x1={x0} x2={x0} y1={ROWS_BOTTOM} y2={bracketY} stroke={PEN} strokeWidth={1} />
      {stop && (
        <path d={`M${x0},${bracketY} H${x1} V${ROWS_BOTTOM + 4}`} fill="none" stroke={PEN} strokeWidth={1.3} />
      )}
      <line x1={x0} x2={x0 - 4} y1={bracketY} y2={labelY - 4} stroke={PEN} strokeWidth={0.8} />
      {/* Paper-log style: the place name slants down-left from its tick; near midnight
          it slants down-right instead so it stays clear of the "Remarks" heading. */}
      <text
        x={x0}
        y={labelY}
        transform={`rotate(${nearLeftEdge ? 48 : -48} ${x0} ${labelY})`}
        fontSize={9.5}
        fill={PEN}
        fontFamily="var(--font-sans)"
        fontWeight={500}
        textAnchor={nearLeftEdge ? 'start' : 'end'}
      >
        <title>{`${formatClock(remark.time_min)} – ${remark.note} at ${remark.location}`}</title>
        {text}
      </text>
    </g>
  )
}

function Recap({ log }: { log: DailyLog }) {
  const top = 648
  const r = log.recap
  const col = (cx: number, value: string, lines: string[], muted = false) => (
    <g>
      <Text x={cx} y={top + 26} size={14} fill={muted ? FAINT : PEN} anchor="middle" numeric weight={600}>
        {value}
      </Text>
      <line x1={cx - 42} x2={cx + 42} y1={top + 30} y2={top + 30} stroke={RULE} strokeWidth={0.8} />
      {lines.map((line, i) => (
        <Text key={line} x={cx} y={top + 44 + i * 11} size={8.5} anchor="middle" fill={muted ? FAINT : CAPTION}>
          {line}
        </Text>
      ))}
    </g>
  )
  return (
    <g>
      <line x1={10} x2={W - 10} y1={top} y2={top} stroke={INK} strokeWidth={1.2} />
      <Text x={20} y={top + 18} size={10} weight={700}>
        Recap:
      </Text>
      <Text x={20} y={top + 30} size={9}>
        Complete at
      </Text>
      <Text x={20} y={top + 41} size={9}>
        end of day
      </Text>
      <Text x={112} y={top + 18} size={10} weight={700}>
        70 Hour/
      </Text>
      <Text x={112} y={top + 30} size={10} weight={700}>
        8 Day Drivers
      </Text>
      {col(250, formatDecimalHours(r.on_duty_today), ['On duty hours', 'today, total', 'lines 3 & 4'])}
      {col(360, formatDecimalHours(r.a_cycle_total), ['A. Total hours on', 'duty last 7 days', 'including today'])}
      {col(470, formatDecimalHours(r.b_available_tomorrow), ['B. Total hours', 'available tomorrow', '70 hr. minus A*'])}
      {col(580, r.c_last_5_days === null ? '—' : formatDecimalHours(r.c_last_5_days), ['C. Total hours on', 'duty last 5 days', 'including today'])}
      <Text x={680} y={top + 18} size={10} weight={700} fill={FAINT}>
        60 Hour/7 Day Drivers
      </Text>
      <Text x={680} y={top + 32} size={8.5} fill={FAINT}>
        Not used: this carrier runs the 70-hour / 8-day cycle.
      </Text>
      <Text x={680} y={top + 56} size={8.5}>
        *If you took 34 consecutive hours off duty
      </Text>
      <Text x={680} y={top + 67} size={8.5}>
        you have 60/70 hours available.
      </Text>
      <Text x={680} y={top + 90} size={7.5} fill={FAINT}>
        A assumes prior cycle hours don’t roll off during the trip. C needs per-day history.
      </Text>
    </g>
  )
}
