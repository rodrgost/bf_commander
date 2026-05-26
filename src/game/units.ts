import type { Squad, Soldier, SquadRole, ControlPoint, Vec2, Team, GameState } from '../types'
import { BLUE_BASE, RED_BASE } from './mapData'

// ── Constants ──────────────────────────────────────────────────────────────
export const SQUAD_SPEED      = 14    // px/s — single soldier on foot
export const SQUAD_RADIUS     = 2     // px — visual radius of a soldier dot
export const SEPARATION_DIST  = 10    // px — min center-to-center between any two soldiers
export const COMBAT_RANGE     = 65    // px — soldiers attack each other within this range
export const COMBAT_DAMAGE    = 5     // hp/s per attacking soldier (soldier-level; was 18/squad)
export const CP_CAPTURE_RANGE = 55    // px — soldier must be within this to contribute to cap
export const CP_CAPTURE_TIME  = 3.5   // seconds to fully capture
export const VISION_RANGE     = 130   // px — blue squad centroid reveals nearby enemies
export const RETREAT_ENTER_PCT = 0.40 // HP% to enter retreat
export const RETREAT_EXIT_PCT  = 0.65 // HP% to leave retreat (hysteresis)
export const HOLD_RADIUS      = 40    // px — hold squads idle within this around the CP
export const HP_REGEN_RATE    = 5     // HP/s per soldier while safe
export const BASE_REGEN_RANGE = 70    // px radius around base that triggers regen
export const ASSIST_RANGE     = 130   // px — squad moves to help a fighting ally within this

// ── Math helpers ──────────────────────────────────────────────────────────

export function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x; const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

function moveToward(from: Vec2, to: Vec2, speed: number, dt: number): Vec2 {
  const d = dist(from, to)
  if (d < 2) return { ...to }
  const ratio = Math.min(speed * dt / d, 1)
  return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio }
}

// Centroid of any array of items with a .position field
function computeCentroid(items: { position: Vec2 }[]): Vec2 {
  if (items.length === 0) return { x: 0, y: 0 }
  return {
    x: items.reduce((s, it) => s + it.position.x, 0) / items.length,
    y: items.reduce((s, it) => s + it.position.y, 0) / items.length,
  }
}

// ── Global assignment — state machine ─────────────────────────────────────
// Works on squad centroids (position field) — unchanged from before.

export function assignTeamSquads(
  squads: Squad[],
  cps: ControlPoint[],
  team: Team,
  opts: {
    retreatEnterPct?: number
    retreatExitPct?: number
    cpPressure?: Record<string, number>
    orderType?: 'attack' | 'defend' | null
    orderCpId?: string | null
  } = {},
): Squad[] {
  const retreatEnter = opts.retreatEnterPct ?? RETREAT_ENTER_PCT
  const retreatExit  = opts.retreatExitPct  ?? RETREAT_EXIT_PCT
  const cpPressure   = opts.cpPressure ?? {}
  const orderType    = opts.orderType ?? null
  const orderCpId    = opts.orderCpId ?? null

  const mine = squads.filter(s => s.team === team && s.status !== 'dead')
  if (mine.length === 0) return squads

  const enemyTeam: Team = team === 'blue' ? 'red' : 'blue'

  const threatened = cps.filter(cp => cp.owner === team && cp.cappingTeam === enemyTeam)
  const neutral    = cps.filter(cp => cp.owner === 'neutral')
  const enemy      = cps.filter(cp => cp.owner === enemyTeam)
  const ours       = cps.filter(cp => cp.owner === team)

  const assigned = new Map<string, { role: SquadRole; targetCpId: string | null }>()

  // Step 1 — retreat (hysteresis)
  const retreating = new Set<string>()
  for (const s of mine) {
    const hpPct = s.hp / s.maxHp
    if (hpPct < retreatEnter || (s.role === 'retreat' && hpPct < retreatExit)) {
      retreating.add(s.id)
      assigned.set(s.id, { role: 'retreat', targetCpId: null })
    }
  }

  const freeSquads = mine.filter(s => !retreating.has(s.id))
  const usedCpIds  = new Set<string>()

  // Step 1b — commander order overrides normal AI for all free squads
  if (orderType && orderCpId) {
    for (const s of freeSquads) {
      assigned.set(s.id, { role: orderType, targetCpId: orderCpId })
    }
    return squads.map(s => {
      const a = assigned.get(s.id)
      if (!a) return s
      return { ...s, role: a.role, targetCpId: a.targetCpId }
    })
  }

  // Step 2 — defend threatened allied CPs
  for (const cp of threatened) {
    const candidates = freeSquads.filter(s => !assigned.has(s.id))
    if (candidates.length === 0) break
    const defSquad = candidates.reduce((a, b) =>
      dist(a.position, cp.position) < dist(b.position, cp.position) ? a : b)
    assigned.set(defSquad.id, { role: 'defend', targetCpId: cp.id })
    usedCpIds.add(cp.id)
  }

  // Step 3 — attack neutral then enemy (cpPressure deprioritises hot CPs for red)
  const attackTargets = [...neutral, ...enemy].sort((a, b) =>
    (cpPressure[a.id] ?? 0) - (cpPressure[b.id] ?? 0))
  for (const cp of attackTargets) {
    const candidates = freeSquads.filter(s => !assigned.has(s.id))
    if (candidates.length === 0) break
    const attacker = candidates.reduce((a, b) =>
      dist(a.position, cp.position) < dist(b.position, cp.position) ? a : b)
    assigned.set(attacker.id, { role: 'attack', targetCpId: cp.id })
    usedCpIds.add(cp.id)
  }

  // Step 4 — hold or spread extra squads across attack targets
  const unguardedOwn = ours.filter(cp => !usedCpIds.has(cp.id))
  let holdIdx = 0; let extraIdx = 0
  for (const s of freeSquads) {
    if (assigned.has(s.id)) continue
    if (unguardedOwn.length > 0) {
      assigned.set(s.id, { role: 'hold', targetCpId: unguardedOwn[holdIdx++ % unguardedOwn.length].id })
    } else if (attackTargets.length > 0) {
      assigned.set(s.id, { role: 'attack', targetCpId: attackTargets[extraIdx++ % attackTargets.length].id })
    } else {
      assigned.set(s.id, { role: 'hold', targetCpId: null })
    }
  }

  return squads.map(s => {
    const a = assigned.get(s.id)
    if (!a) return s
    return { ...s, role: a.role, targetCpId: a.targetCpId }
  })
}

// ── Adaptive Red AI ───────────────────────────────────────────────────────

export function computeRedAggression(state: GameState): number {
  const redPct  = state.redTickets  / state.ticketsMax
  const bluePct = state.blueTickets / state.ticketsMax
  const raw = 0.5 + (1 - redPct) * 0.4 - (bluePct - redPct) * 0.2
  return Math.max(0, Math.min(1, raw))
}

export function assignRedSquads(squads: Squad[], cps: ControlPoint[], state: GameState): Squad[] {
  const aggression = computeRedAggression(state)
  const enterPct = Math.max(0.10, RETREAT_ENTER_PCT - (aggression - 0.5) * 0.40)
  const exitPct  = Math.max(0.20, RETREAT_EXIT_PCT  - (aggression - 0.5) * 0.50)
  return assignTeamSquads(squads, cps, 'red', {
    retreatEnterPct: enterPct,
    retreatExitPct:  exitPct,
    cpPressure: state.redAI.cpPressure,
  })
}

// ── Per-squad movement — soldiers move individually toward squad target ─────
//
// All soldiers in a squad move toward the same logical target (CP or base).
// They spread naturally due to separateSoldiers() applied afterward.

export function updateSquad(
  squad: Squad,
  allSquads: Squad[],
  cps: ControlPoint[],
  dt: number,
): Squad {
  if (squad.status === 'dead') return squad

  const suppressedTimer = Math.max(0, squad.suppressedTimer - dt)
  if (suppressedTimer > 0) {
    return { ...squad, status: 'suppressed', suppressedTimer }
  }

  const aliveSoldiers = squad.soldiers.filter(s => s.hp > 0)
  if (aliveSoldiers.length === 0) return { ...squad, status: 'dead' }

  // All alive enemy soldiers (for fight detection)
  const enemySoldiers: (Soldier & { team: Team })[] = allSquads
    .filter(s => s.team !== squad.team && s.status !== 'dead')
    .flatMap(s => s.soldiers.filter(sol => sol.hp > 0).map(sol => ({ ...sol, team: s.team as Team })))

  // Helper: move all alive soldiers toward a destination
  const moveSoldiersTo = (dest: Vec2, speed: number): Soldier[] =>
    squad.soldiers.map(sol =>
      sol.hp <= 0 ? sol : { ...sol, position: moveToward(sol.position, dest, speed, dt) })

  // Recompute centroid after moving soldiers
  const recentered = (soldiers: Soldier[]) => ({
    soldiers,
    position: computeCentroid(soldiers.filter(s => s.hp > 0)),
  })

  // ── 1. RETREAT ─────────────────────────────────────────────────────────
  if (squad.role === 'retreat') {
    const ownedCPs = cps.filter(cp => cp.owner === squad.team)
    const base = squad.team === 'blue' ? BLUE_BASE : RED_BASE
    const target: Vec2 = ownedCPs.length > 0
      ? ownedCPs.reduce((a, b) => dist(squad.position, a.position) < dist(squad.position, b.position) ? a : b).position
      : base
    return { ...squad, status: 'moving', suppressedTimer: 0, ...recentered(moveSoldiersTo(target, SQUAD_SPEED * 1.2)) }
  }

  // ── 2. Enemies in range → fight ────────────────────────────────────────
  const isFighting = aliveSoldiers.some(sol =>
    enemySoldiers.some(e => dist(sol.position, e.position) < COMBAT_RANGE))

  if (isFighting) {
    // Winning: advance toward weakest enemy squad in range
    const enemySquadsInRange = allSquads.filter(es =>
      es.team !== squad.team && es.status !== 'dead' &&
      es.soldiers.some(esol => esol.hp > 0 &&
        aliveSoldiers.some(ms => dist(ms.position, esol.position) < COMBAT_RANGE)))

    if (enemySquadsInRange.length > 0) {
      const weakest = enemySquadsInRange.reduce((a, b) => a.hp < b.hp ? a : b)
      if (squad.hp > weakest.hp) {
        return { ...squad, status: 'fighting', suppressedTimer: 0, ...recentered(moveSoldiersTo(weakest.position, SQUAD_SPEED * 0.6)) }
      }
    }
    return { ...squad, status: 'fighting', suppressedTimer: 0 }
  }

  // ── 2b. Nearby ally fighting → assist ──────────────────────────────────
  // Assistance range depends on role:
  //   defend  → never leaves post (CP security takes absolute priority)
  //   attack  → only diverts if fight is nearly in their path (≤ 1.4× COMBAT_RANGE ≈ 91 px)
  //   hold    → can range up to ASSIST_RANGE (no critical objective, free to help)
  //   retreat → never assists (handled above)
  if (squad.role !== 'retreat' && squad.role !== 'defend') {
    const assistRadius = squad.role === 'hold' ? ASSIST_RANGE : COMBAT_RANGE * 1.4
    const fightingAlly = allSquads.find(
      s => s.team === squad.team && s.status === 'fighting' &&
           dist(squad.position, s.position) < assistRadius)
    if (fightingAlly) {
      return { ...squad, status: 'moving', suppressedTimer: 0, ...recentered(moveSoldiersTo(fightingAlly.position, SQUAD_SPEED)) }
    }
  }

  // ── 3. HOLD ────────────────────────────────────────────────────────────
  if (squad.role === 'hold') {
    const base = squad.team === 'blue' ? BLUE_BASE : RED_BASE
    const cp   = squad.targetCpId ? cps.find(c => c.id === squad.targetCpId) : null
    const dest = cp ? cp.position : base
    if (dist(squad.position, dest) < HOLD_RADIUS) {
      return { ...squad, status: 'idle', suppressedTimer: 0 }
    }
    return { ...squad, status: 'moving', suppressedTimer: 0, ...recentered(moveSoldiersTo(dest, SQUAD_SPEED)) }
  }

  // ── 4. ATTACK / DEFEND ─────────────────────────────────────────────────
  if (squad.targetCpId) {
    const cp = cps.find(c => c.id === squad.targetCpId)
    if (cp) {
      return { ...squad, status: 'moving', suppressedTimer: 0, ...recentered(moveSoldiersTo(cp.position, SQUAD_SPEED)) }
    }
  }

  return { ...squad, status: 'idle', suppressedTimer: 0 }
}

// ── HP regeneration (per soldier) ─────────────────────────────────────────

export function regenHP(squads: Squad[], cps: ControlPoint[], dt: number): Squad[] {
  const base = { blue: BLUE_BASE, red: RED_BASE }

  return squads.map(sq => {
    if (sq.status === 'dead' || sq.status === 'fighting' || sq.status === 'suppressed') return sq

    const enemyNearby = squads.some(
      e => e.team !== sq.team && e.status !== 'dead' &&
           dist(sq.position, e.position) < COMBAT_RANGE)
    if (enemyNearby) return sq

    const atBase  = dist(sq.position, base[sq.team]) < BASE_REGEN_RANGE
    const enemyTeam: Team = sq.team === 'blue' ? 'red' : 'blue'
    const atSafeCP = cps.some(
      cp => cp.owner === sq.team &&
            cp.cappingTeam !== enemyTeam &&
            dist(sq.position, cp.position) < CP_CAPTURE_RANGE)

    if (!atBase && !atSafeCP) return sq

    const soldiers = sq.soldiers.map(sol =>
      sol.hp <= 0 ? sol : { ...sol, hp: Math.min(sol.maxHp, sol.hp + HP_REGEN_RATE * dt) })
    const hp = soldiers.reduce((s, sol) => s + sol.hp, 0)
    return { ...sq, soldiers, hp }
  })
}

// ── Soldier reinforcement ─────────────────────────────────────────────────
// When a squad has dead soldiers AND every alive soldier is at full HP,
// one dead slot is revived at 1 HP near the centroid.
// Starting at 1 HP means the condition won't be met again until this new
// soldier also regens to maxHp — natural pacing (~5 s per reinforcement).
// Reinforcement never happens while fighting or suppressed.

export function reinforceSoldiers(squads: Squad[]): Squad[] {
  return squads.map(sq => {
    if (sq.status === 'dead' || sq.status === 'fighting' || sq.status === 'suppressed') return sq

    const alive = sq.soldiers.filter(s => s.hp > 0)
    const dead  = sq.soldiers.filter(s => s.hp <= 0)

    if (dead.length === 0) return sq                       // already full strength
    if (alive.length === 0) return sq                      // whole squad dead — tickRespawns handles this
    if (!alive.every(s => s.hp >= s.maxHp)) return sq     // not everyone is healed yet

    // Revive exactly one dead soldier at 1 HP, placed near the centroid
    const angle = Math.random() * Math.PI * 2
    const r     = SEPARATION_DIST * 1.5
    let revived = false

    const soldiers = sq.soldiers.map(sol => {
      if (sol.hp > 0 || revived) return sol
      revived = true
      return {
        ...sol,
        hp: 1,
        position: {
          x: sq.position.x + Math.cos(angle) * r,
          y: sq.position.y + Math.sin(angle) * r,
        },
      }
    })

    const hp = soldiers.reduce((s, sol) => s + sol.hp, 0)
    return { ...sq, soldiers, hp }
  })
}

// ── Soldier separation (collision avoidance across ALL squads) ────────────

export function separateSoldiers(squads: Squad[]): Squad[] {
  // Build flat list of mutable soldier positions
  type Ref = { si: number; li: number; x: number; y: number }
  const refs: Ref[] = []
  squads.forEach((sq, si) => {
    if (sq.status === 'dead') return
    sq.soldiers.forEach((sol, li) => {
      if (sol.hp > 0) refs.push({ si, li, x: sol.position.x, y: sol.position.y })
    })
  })

  for (let i = 0; i < refs.length; i++) {
    for (let j = i + 1; j < refs.length; j++) {
      const dx = refs[i].x - refs[j].x
      const dy = refs[i].y - refs[j].y
      const d  = Math.sqrt(dx * dx + dy * dy)
      if (d < SEPARATION_DIST && d > 0.01) {
        const overlap = SEPARATION_DIST - d
        const nx = dx / d; const ny = dy / d
        const half = overlap * 0.5
        refs[i].x += nx * half; refs[i].y += ny * half
        refs[j].x -= nx * half; refs[j].y -= ny * half
      } else if (d <= 0.01) {
        const angle = Math.random() * Math.PI * 2
        const half  = SEPARATION_DIST * 0.5
        refs[i].x += Math.cos(angle) * half; refs[i].y += Math.sin(angle) * half
        refs[j].x -= Math.cos(angle) * half; refs[j].y -= Math.sin(angle) * half
      }
    }
  }

  // Write updated positions back and recompute squad centroids
  const result = squads.map(sq => ({ ...sq, soldiers: [...sq.soldiers] }))
  refs.forEach(r => {
    result[r.si].soldiers[r.li] = {
      ...result[r.si].soldiers[r.li],
      position: { x: r.x, y: r.y },
    }
  })
  return result.map(sq => {
    const alive = sq.soldiers.filter(s => s.hp > 0)
    return alive.length > 0 ? { ...sq, position: computeCentroid(alive) } : sq
  })
}

// ── Combat damage (soldier → soldier) ─────────────────────────────────────
// Each alive soldier deals COMBAT_DAMAGE hp/s to every enemy soldier
// within COMBAT_RANGE. Suppressed squads neither attack nor receive damage.

export function applyCombat(squads: Squad[], dt: number): Squad[] {
  // Flat list of combatant soldiers
  type SolRef = { si: number; li: number; position: Vec2; team: Team }
  const combatants: SolRef[] = []
  squads.forEach((sq, si) => {
    if (sq.status === 'suppressed' || sq.status === 'dead') return
    sq.soldiers.forEach((sol, li) => {
      if (sol.hp > 0) combatants.push({ si, li, position: sol.position, team: sq.team })
    })
  })

  const dmg: Record<string, number> = {}
  combatants.forEach(c => { dmg[`${c.si}_${c.li}`] = 0 })

  combatants.forEach(a => {
    combatants.forEach(b => {
      if (a.team === b.team) return
      if (dist(a.position, b.position) < COMBAT_RANGE) {
        dmg[`${b.si}_${b.li}`] += COMBAT_DAMAGE * dt
      }
    })
  })

  return squads.map((sq, si) => {
    const soldiers = sq.soldiers.map((sol, li) => {
      const d = dmg[`${si}_${li}`] ?? 0
      return d > 0 ? { ...sol, hp: Math.max(0, sol.hp - d) } : sol
    })
    const alive    = soldiers.filter(s => s.hp > 0)
    const hp       = alive.reduce((s, sol) => s + sol.hp, 0)
    const position = alive.length > 0 ? computeCentroid(alive) : sq.position
    const status   = alive.length === 0 ? 'dead' as const : sq.status
    return { ...sq, soldiers, hp, position, status }
  })
}
