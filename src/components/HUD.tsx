import type { GameState } from '../types'
import styles from './HUD.module.css'

interface Props {
  state: GameState
  onRestart: () => void
}

// ── Ticket bar ─────────────────────────────────────────────────────────────

function TicketBar({ tickets, max, team }: { tickets: number; max: number; team: 'blue' | 'red' }) {
  const pct = Math.max(0, tickets / max) * 100
  const base = team === 'blue' ? '#00C8FF' : '#FF6633'
  const fill = pct < 10 ? '#FF6633' : pct < 25 ? '#FFCC00' : base

  return (
    <div className={styles.ticketGroup}>
      <span className={styles.ticketLabel} style={{ color: fill }}>
        {team === 'blue' ? 'US' : 'CN'}
      </span>
      <div className={styles.ticketBarWrap}>
        <div className={styles.ticketBar}
          style={{ width: `${pct}%`, background: fill, marginLeft: team === 'red' ? 'auto' : undefined }}
        />
      </div>
      <span className={styles.ticketValue} style={{ color: fill }}>{Math.ceil(tickets)}</span>
    </div>
  )
}

// ── Main HUD ──────────────────────────────────────────────────────────────

export default function HUD({ state, onRestart }: Props) {
  const cpPct = (state.commanderPoints / state.commanderPointsMax) * 100

  return (
    <div className={styles.hud}>

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
