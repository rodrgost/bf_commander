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

interface TicketBarProps {
  tickets: number
  max: number
  team: 'blue' | 'red'
  label: string
  locked: boolean   // true while min game time has not been reached
}

function TicketBar({ tickets, max, team, label, locked }: TicketBarProps) {
  const pct   = Math.max(0, tickets / max) * 100
  const color = team === 'blue' ? '#3b82f6' : '#ef4444'

  // When locked: desaturate. When live: warn as tickets get low.
  const fillColor = locked
    ? '#4b5563'
    : pct < 10 ? '#ef4444' : pct < 25 ? '#f59e0b' : color

  const labelColor = locked ? '#475569' : fillColor

  return (
    <div className={styles.ticketGroup}>
      <span className={styles.ticketLabel} style={{ color: labelColor }}>
        {locked ? '🔒 ' : ''}{label}
      </span>
      <div className={`${styles.ticketBarWrap} ${locked ? styles.ticketBarLocked : ''}`}>
        <div
          className={styles.ticketBar}
          style={{
            width: `${pct}%`,
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

// ── Main HUD ──────────────────────────────────────────────────────────────

export default function HUD({ state, onRestart }: Props) {
  const blueCPs = state.controlPoints.filter(cp => cp.owner === 'blue').length
  const redCPs  = state.controlPoints.filter(cp => cp.owner === 'red').length
  const cpPct   = (state.commanderPoints / state.commanderPointsMax) * 100

  const locked   = state.elapsed < state.minGameTime
  const timeLeft = Math.max(0, state.minGameTime - state.elapsed)

  return (
    <div className={styles.hud}>
      {/* Timer */}
      <div className={styles.section}>
        <span className={styles.timerIcon}>⏱</span>
        <span className={styles.timer}>{formatTime(state.elapsed)}</span>
      </div>

      {/* Blue tickets */}
      <TicketBar
        tickets={state.blueTickets}
        max={state.ticketsMax}
        team="blue"
        label="ALIADOS"
        locked={locked}
      />

      {/* CP score */}
      <div className={styles.cpScore}>
        <span className={styles.blueScore}>{blueCPs}</span>
        <span className={styles.cpDots}>
          {state.controlPoints.map(cp => (
            <span key={cp.id} className={`${styles.cpDot} ${styles[cp.owner]}`} title={cp.label} />
          ))}
        </span>
        <span className={styles.redScore}>{redCPs}</span>
      </div>

      {/* Red tickets */}
      <TicketBar
        tickets={state.redTickets}
        max={state.ticketsMax}
        team="red"
        label="INIMIGOS"
        locked={locked}
      />

      {/* Remaining lock time — compact, só enquanto travado */}
      {locked && (
        <div className={styles.lockTimer} title="Tickets só encerraram a partida após o tempo mínimo">
          unlock {formatTime(timeLeft)}
        </div>
      )}

      {/* Commander Points bar */}
      <div className={styles.cpSection}>
        <span className={styles.cpLabel}>CMD</span>
        <div className={styles.cpBarWrap}>
          <div className={styles.cpBar} style={{ width: `${cpPct}%` }} />
        </div>
        <span className={styles.cpValue}>{Math.floor(state.commanderPoints)}</span>
      </div>

      {/* UAV status */}
      {state.uavActive && (
        <div className={styles.uavBadge}>📡 UAV {Math.ceil(state.uavTimer)}s</div>
      )}

      {/* Pending ability hint */}
      {state.pendingAbility && (
        <div className={styles.hint}>Clique no mapa para ativar</div>
      )}

      {/* Restart (shown after game over) */}
      {state.phase !== 'playing' && (
        <button className={styles.restartBtn} onClick={onRestart}>↺ RESTART</button>
      )}
    </div>
  )
}
