import type { AbilityState, AbilityId, GameState } from '../types'
import styles from './AbilityBar.module.css'

interface Props {
  abilities: AbilityState[]
  commanderPoints: number
  pendingAbility: AbilityId | null
  onSelect: (id: AbilityId) => void
  phase: GameState['phase']
}

const ABILITY_ICONS: Record<AbilityId, string> = {
  uav:          '📡',
  artillery:    '💥',
  ammo:         '📦',
  emp:          '⚡',
  order_attack: '⚔',
  order_defend: '🛡',
}

export default function AbilityBar({ abilities, commanderPoints, pendingAbility, onSelect, phase }: Props) {
  return (
    <div className={styles.bar}>
      {abilities.map(ab => {
        const onCooldown = ab.cooldownRemaining > 0
        const noPoints = commanderPoints < ab.cost
        const disabled = onCooldown || noPoints || phase !== 'playing'
        const selected = pendingAbility === ab.id
        const cdPct = ab.cooldownRemaining / ab.cooldownMax

        return (
          <button
            key={ab.id}
            className={`${styles.btn} ${selected ? styles.selected : ''} ${disabled ? styles.disabled : ''}`}
            onClick={() => !disabled && onSelect(ab.id)}
            title={ab.description}
          >
            {/* Cooldown overlay */}
            {onCooldown && (
              <div className={styles.cdOverlay} style={{ height: `${cdPct * 100}%` }} />
            )}

            <span className={styles.icon}>{ABILITY_ICONS[ab.id]}</span>
            <span className={styles.label}>{ab.label}</span>
            <span className={styles.cost}>{ab.cost} pts</span>
            {onCooldown && (
              <span className={styles.cdTimer}>{Math.ceil(ab.cooldownRemaining)}s</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
