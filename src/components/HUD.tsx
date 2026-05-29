import type { GameState } from '../types'
import styles from './HUD.module.css'

interface Props {
  state: GameState
  onRestart: () => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ── Ticket bar ─────────────────────────────────────────────────────────────
// BF4 palette: US = #00C8FF, CN = #FF6633

interface TicketBarProps {
  tickets: number
  max:     number
  team:    'blue' | 'red'
  label:   string
  locked:  boolean
}

function TicketBar({ tickets, max, team, label, locked }: TicketBarProps) {
  const pct = Math.max(0, tickets / max) * 100

  const baseColor = team === 'blue' ? '#00C8FF' : '#FF6633'
  const fillColor = locked
    ? '#2a3a4a'
    : pct < 10  ? '#FF6633'
    : pct < 25  ? '#FFCC00'
    : baseColor
  const labelColor = locked ? '#2e4557' : fillColor

  return (
    <div className={styles.ticketGroup}>
      <span className={styles.ticketLabel} style={{ color: labelColor }}>
        {locked ? '🔒' : team === 'blue' ? 'US' : 'CN'}
      </span>
      <div className={`${styles.ticketBarWrap} ${locked ? styles.ticketBarLocked : ''}`}>
        <div
          className={styles.ticketBar}
          style={{
            width:      `${pct}%`,
            background: fillColor,
            marginLeft: team === 'red' ? 'auto' : undefined,
          }}
        />
      </div>
      <span className={styles.ticketValue} style={{ color: labelColor }}>
        {Math.ceil(tickets)}
      </span>
    </div>
  )
}

// ── CP letter badge ────────────────────────────────────────────────────────

function CPBadge({ label, owner, capturing }: {
  label: string; owner: string; capturing?: string | null
}) {
  const isBlue    = owner === 'blue'
  const isRed     = owner === 'red'
  const isCapture = !!capturing

  const bg    = isBlue ? '#003a5e' : isRed ? '#4a1400' : '#1e1e2e'
  const color = isBlue ? '#00C8FF' : isRed ? '#FF6633' : '#555880'
  const border = isCapture
    ? `1px solid ${capturing === 'blue' ? '#00C8FF88' : '#FF663388'}`
    : `1px solid ${color}44`

  return (
    <span className={styles.cpBadge} style={{ background: bg, color, border }}>
      {label[0]}
    </span>
  )
}

// ── Main HUD ──────────────────────────────────────────────────────────────

export default function HUD({ state, onRestart }: Props) {
  const blueCPs = state.controlPoints.filter(cp => cp.owner === 'blue').length
  const redCPs  = state.controlPoints.filter(cp => cp.owner === 'red').length
  const cpPct   = (state.commanderPoints / state.commanderPointsMax) * 100

  const locked   = state.elapsed < state.minGameTime
  const timeLeft = Math.max(0, state.minGameTime - state.elapsed)

  // ── Timer display ─────────────────────────────────────────────────────
  // If a time limit is set: show countdown; otherwise show elapsed time.
  const hasLimit  = state.maxGameTime > 0
  const remaining = hasLimit ? Math.max(0, state.maxGameTime - state.elapsed) : 0
  const urgent    = hasLimit && remaining <= 60 && state.phase === 'playing'
  const timerText = hasLimit ? formatTime(remaining) : formatTime(state.elapsed)
  const timerColor = urgent
    ? (Math.floor(state.elapsed * 2) % 2 === 0 ? '#FF3333' : '#FF6633')  // blink between two reds
    : '#FFCC00'

  return (
    <div className={styles.hud}>

      {/* ── Timer ── */}
      <div className={styles.section}>
        {hasLimit && <span style={{ fontSize: 8, color: '#2e4557', marginRight: 3, fontFamily: 'Courier New, monospace' }}>⏱</span>}
        <span className={styles.timer} style={{ color: timerColor }}>{timerText}</span>
      </div>

      {/* ── US Tickets ── */}
      <TicketBar
        tickets={state.blueTickets} max={state.ticketsMax}
        team="blue" label="US" locked={locked}
      />

      {/* ── CP status bar ── */}
      <div className={styles.cpScore}>
        <span className={styles.blueScore}>{blueCPs}</span>
        <div className={styles.cpBadges}>
          {state.controlPoints.map(cp => (
            <CPBadge
              key={cp.id}
              label={cp.label}
              owner={cp.owner}
              capturing={cp.cappingTeam}
            />
          ))}
        </div>
        <span className={styles.redScore}>{redCPs}</span>
      </div>

      {/* ── CN Tickets ── */}
      <TicketBar
        tickets={state.redTickets} max={state.ticketsMax}
        team="red" label="CN" locked={locked}
      />

      {locked && (
        <div className={styles.lockTimer} title="Tickets só encerram após o tempo mínimo">
          unlock {formatTime(timeLeft)}
        </div>
      )}

      {/* ── Commander Points ── */}
      <div className={styles.cpSection}>
        <span className={styles.cpLabel}>CMD</span>
        <div className={styles.cpBarWrap}>
          <div className={styles.cpBar} style={{ width: `${cpPct}%` }} />
        </div>
        <span className={styles.cpValue}>{Math.floor(state.commanderPoints)}</span>
      </div>

      {/* ── UAV active ── */}
      {state.uavActive && (
        <div className={styles.uavBadge}>📡 UAV {Math.ceil(state.uavTimer)}s</div>
      )}

      {/* ── Pending ability hint ── */}
      {state.pendingAbility && (
        <div className={styles.hint}>Clique no mapa · ESC cancela</div>
      )}

      {/* ── Restart button ── */}
      {state.phase !== 'playing' && (
        <button className={styles.restartBtn} onClick={onRestart}>↺ RESTART</button>
      )}
    </div>
  )
}
