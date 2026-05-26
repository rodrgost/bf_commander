import type { Squad, SquadRole } from '../types'
import styles from './SquadPanel.module.css'

interface Props {
  squads: Squad[]
}

const STATUS_ICONS: Record<string, string> = {
  idle:       '●',
  moving:     '▶',
  fighting:   '⚔',
  suppressed: '⚡',
  dead:       '↺',
}

const ROLE_LABELS: Record<SquadRole, { icon: string; label: string; color: string }> = {
  attack:  { icon: '⚔', label: 'ATK', color: '#f97316' },
  defend:  { icon: '🛡', label: 'DEF', color: '#3b82f6' },
  hold:    { icon: '📌', label: 'HLD', color: '#22c55e' },
  retreat: { icon: '↩', label: 'RET', color: '#ef4444' },
}

export default function SquadPanel({ squads }: Props) {
  const blueSquads = squads.filter(s => s.team === 'blue')
  const redSquads  = squads.filter(s => s.team === 'red')

  const redAlive     = redSquads.filter(s => s.status !== 'dead').length
  const redRespawning = redSquads.filter(s => s.status === 'dead')
  const nextRespawn  = redRespawning.length > 0
    ? Math.min(...redRespawning.map(s => s.respawnTimer))
    : 0

  return (
    <div className={styles.panel}>
      {/* ── ALLIED SQUADS ── */}
      <div className={styles.title}>ESQUADRÕES ALIADOS</div>
      {blueSquads.map((s, i) => {
        const isDead = s.status === 'dead'
        const hpPct  = s.hp / s.maxHp
        const role   = ROLE_LABELS[s.role]

        return (
          <div key={s.id} className={`${styles.squadRow} ${isDead ? styles.dead : ''}`}>
            <span className={styles.squadName}>Squad {i + 1}</span>

            {/* Role badge */}
            <span
              className={styles.roleBadge}
              style={{ color: role.color, borderColor: role.color }}
              title={s.role}
            >
              {role.icon} {role.label}
            </span>

            {/* Status icon */}
            <span className={`${styles.statusIcon} ${styles[s.status]}`}>
              {STATUS_ICONS[s.status]}
            </span>

            {/* HP bar or respawn bar */}
            {isDead ? (
              <div className={styles.respawnWrap}>
                <div
                  className={styles.respawnBar}
                  style={{ width: `${(1 - s.respawnTimer / 12) * 100}%` }}
                />
              </div>
            ) : (
              <div className={styles.hpBarWrap}>
                <div
                  className={styles.hpBar}
                  style={{
                    width: `${hpPct * 100}%`,
                    background: hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#f59e0b' : '#ef4444',
                  }}
                />
              </div>
            )}

            <span className={styles.hpText}>
              {isDead ? `${Math.ceil(s.respawnTimer)}s` : Math.ceil(s.hp)}
            </span>
          </div>
        )
      })}

      {/* ── ENEMY INTEL ── */}
      <div className={styles.title} style={{ color: '#f87171', marginTop: 6 }}>
        INTEL INIMIGA
      </div>

      <div className={styles.enemyIntel}>
        <div className={styles.enemyRow}>
          <span className={styles.enemyLabel}>Ativos</span>
          <span className={styles.enemyValue} style={{ color: redAlive > 0 ? '#f87171' : '#475569' }}>
            {redAlive} / {redSquads.length}
          </span>
        </div>

        {redRespawning.length > 0 && (
          <div className={styles.enemyRow}>
            <span className={styles.enemyLabel}>Reforços</span>
            <span className={styles.enemyValue} style={{ color: '#f97316' }}>
              {redRespawning.length} em {Math.ceil(nextRespawn)}s
            </span>
          </div>
        )}

        {/* Respawn bars for each dead red squad */}
        {redRespawning.map((s, i) => (
          <div key={s.id} className={styles.enemyRespawnRow}>
            <span className={styles.enemySmall}>{s.id.toUpperCase()}</span>
            <div className={styles.respawnWrap}>
              <div
                className={styles.respawnBar}
                style={{
                  width: `${(1 - s.respawnTimer / 12) * 100}%`,
                  background: '#ef4444',
                }}
              />
            </div>
            <span className={styles.hpText}>{Math.ceil(s.respawnTimer)}s</span>
          </div>
        ))}

        {redRespawning.length === 0 && redAlive === 0 && (
          <div className={styles.enemySmall} style={{ color: '#334155' }}>
            sem dados
          </div>
        )}
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        {Object.entries(ROLE_LABELS).map(([key, r]) => (
          <span key={key} className={styles.legendItem} style={{ color: r.color }}>
            {r.icon} {r.label}
          </span>
        ))}
      </div>
    </div>
  )
}
