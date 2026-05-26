import type { GameState, Vec2, VisualEffect } from '../types'

let effectCounter = 0
function newEffectId() { return `fx_${++effectCounter}` }

function dist2(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x; const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

function nearestAllySquad(state: GameState, pos: Vec2) {
  const alive = state.squads.filter(s => s.team === 'blue' && s.status !== 'dead')
  if (alive.length === 0) return null
  return alive.reduce((best, s) => dist2(s.position, pos) < dist2(best.position, pos) ? s : best)
}

export function activateUAV(state: GameState, pos: Vec2): GameState {
  const UAV_RADIUS = 200
  const UAV_DURATION = 8

  const effect: VisualEffect = {
    id: newEffectId(), type: 'uav_scan',
    position: pos, radius: UAV_RADIUS,
    timer: UAV_DURATION, maxTimer: UAV_DURATION,
  }

  const squads = state.squads.map(s => {
    if (s.team === 'red' && dist2(s.position, pos) < UAV_RADIUS) {
      return { ...s, revealedTimer: UAV_DURATION }
    }
    return s
  })

  return {
    ...state,
    squads,
    uavActive: true,
    uavTimer: UAV_DURATION,
    uavCenter: pos,
    uavRadius: UAV_RADIUS,
    effects: [...state.effects, effect],
  }
}

export function activateArtillery(state: GameState, pos: Vec2): GameState {
  const ARTILLERY_RADIUS = 80
  const ARTILLERY_DAMAGE = 40
  const DELAY = 1.5   // visual explosion appears after 1.5s (handled in effect timer)

  const effect: VisualEffect = {
    id: newEffectId(), type: 'explosion',
    position: pos, radius: ARTILLERY_RADIUS,
    timer: DELAY, maxTimer: DELAY,
  }

  // Apply damage immediately (simulating delayed fire for simplicity)
  const squads = state.squads.map(s => {
    if (s.team === 'red' && s.status !== 'dead' && dist2(s.position, pos) < ARTILLERY_RADIUS) {
      const newHp = Math.max(0, s.hp - ARTILLERY_DAMAGE)
      return { ...s, hp: newHp, status: newHp <= 0 ? 'dead' as const : s.status }
    }
    return s
  })

  return { ...state, squads, effects: [...state.effects, effect] }
}

export function activateAmmo(state: GameState, pos: Vec2): GameState {
  const HEAL_AMOUNT = 50
  const nearest = nearestAllySquad(state, pos)
  if (!nearest) return state

  const effect: VisualEffect = {
    id: newEffectId(), type: 'ammo_drop',
    position: nearest.position, radius: 40,
    timer: 1.5, maxTimer: 1.5,
  }

  const squads = state.squads.map(s => {
    if (s.id === nearest.id) {
      return { ...s, hp: Math.min(s.maxHp, s.hp + HEAL_AMOUNT) }
    }
    return s
  })

  return { ...state, squads, effects: [...state.effects, effect] }
}

// ── Commander Orders ──────────────────────────────────────────────────────
// Click near a CP to direct ALL blue squads to that CP for ORDER_DURATION seconds.

const ORDER_DURATION = 25

function nearestCP(state: GameState, pos: Vec2) {
  return state.controlPoints.reduce((best, cp) => {
    const d  = Math.hypot(cp.position.x - pos.x, cp.position.y - pos.y)
    const db = Math.hypot(best.position.x - pos.x, best.position.y - pos.y)
    return d < db ? cp : best
  })
}

export function activateOrderAttack(state: GameState, pos: Vec2): GameState {
  const cp = nearestCP(state, pos)
  return {
    ...state,
    blueOrders: { type: 'attack', cpId: cp.id, timer: ORDER_DURATION },
  }
}

export function activateOrderDefend(state: GameState, pos: Vec2): GameState {
  const cp = nearestCP(state, pos)
  return {
    ...state,
    blueOrders: { type: 'defend', cpId: cp.id, timer: ORDER_DURATION },
  }
}

export function activateEMP(state: GameState, pos: Vec2): GameState {
  const EMP_RADIUS = 150
  const EMP_DURATION = 6

  const effect: VisualEffect = {
    id: newEffectId(), type: 'emp_pulse',
    position: pos, radius: EMP_RADIUS,
    timer: 1.2, maxTimer: 1.2,
  }

  const squads = state.squads.map(s => {
    if (s.team === 'red' && s.status !== 'dead' && dist2(s.position, pos) < EMP_RADIUS) {
      return { ...s, suppressedTimer: EMP_DURATION, status: 'suppressed' as const }
    }
    return s
  })

  return { ...state, squads, effects: [...state.effects, effect] }
}
