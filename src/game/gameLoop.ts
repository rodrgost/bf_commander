import type { GameState, ControlPoint, Squad, Team, GamePhase } from '../types'
import { updateSquad, applyCombat, assignTeamSquads, assignRedSquads, separateSoldiers, regenHP, reinforceSoldiers, CP_CAPTURE_RANGE, CP_CAPTURE_TIME } from './units'
import {
  BLUE_BASE, RED_BASE,
  BLEED_RATE_PER_CP,
  TICKET_DEATH_COST,
  RESPAWN_TICKET_COST,
  SQUAD_RESPAWN_TIME,
} from './mapData'

const CP_REGEN_RATE = 8   // commander points per second

// ── Capture point logic ────────────────────────────────────────────────────

function updateCaptures(squads: Squad[], cps: ControlPoint[], dt: number): ControlPoint[] {
  return cps.map(cp => {
    const blueNear = squads.some(
      s => s.team === 'blue' && s.status !== 'dead' && s.status !== 'suppressed' &&
           Math.hypot(s.position.x - cp.position.x, s.position.y - cp.position.y) < CP_CAPTURE_RANGE,
    )
    const redNear = squads.some(
      s => s.team === 'red' && s.status !== 'dead' && s.status !== 'suppressed' &&
           Math.hypot(s.position.x - cp.position.x, s.position.y - cp.position.y) < CP_CAPTURE_RANGE,
    )

    if (blueNear && redNear) return { ...cp, cappingTeam: null }

    const cappingTeam = blueNear ? 'blue' : redNear ? 'red' : null

    if (!cappingTeam) {
      const decay = dt / CP_CAPTURE_TIME * 0.3
      return { ...cp, captureProgress: Math.max(0, cp.captureProgress - decay), cappingTeam: null }
    }

    if (cappingTeam === cp.owner) return { ...cp, cappingTeam: null }

    const newProgress = Math.min(1, cp.captureProgress + dt / CP_CAPTURE_TIME)
    if (newProgress >= 1) {
      return { ...cp, owner: cappingTeam, captureProgress: 0, cappingTeam: null }
    }
    return { ...cp, captureProgress: newProgress, cappingTeam }
  })
}

// ── Ticket bleeding ────────────────────────────────────────────────────────
// Only the team with FEWER CPs bleeds. Neutral CPs don't count.
// Rate = BLEED_RATE_PER_CP × CP_advantage_of_enemy × dt

function computeBleeding(cps: ControlPoint[], dt: number): { blueDrain: number; redDrain: number } {
  const blueCPs = cps.filter(cp => cp.owner === 'blue').length
  const redCPs  = cps.filter(cp => cp.owner === 'red').length

  const blueAdvantage = blueCPs - redCPs
  const blueDrain = blueAdvantage < 0 ? Math.abs(blueAdvantage) * BLEED_RATE_PER_CP * dt : 0
  const redDrain  = blueAdvantage > 0 ? blueAdvantage            * BLEED_RATE_PER_CP * dt : 0

  return { blueDrain, redDrain }
}

// ── Respawn (with ticket cost) ────────────────────────────────────────────
// Returns updated squads and the respawn ticket cost per team this tick.

function tickRespawns(
  squads: Squad[],
  dt: number,
): { squads: Squad[]; blueRespawnCost: number; redRespawnCost: number } {
  let blueRespawnCost = 0
  let redRespawnCost  = 0

  const next = squads.map(s => {
    if (s.status !== 'dead') return s

    // Safety net: dead squad with no timer set — restart it.
    // Guards against any edge case where processDeaths missed a death.
    if (s.respawnTimer <= 0) {
      return { ...s, respawnTimer: SQUAD_RESPAWN_TIME }
    }

    const respawnTimer = Math.max(0, s.respawnTimer - dt)
    if (respawnTimer === 0 && s.respawnTimer > 0) {
      // Deduct reinforcement cost on arrival
      if (s.team === 'blue') blueRespawnCost += RESPAWN_TICKET_COST
      else                    redRespawnCost  += RESPAWN_TICKET_COST

      const base = s.team === 'blue' ? BLUE_BASE : RED_BASE
      const bx   = base.x + (Math.random() - 0.5) * 30
      const by   = base.y + (Math.random() - 0.5) * 16
      // Reset every soldier to full HP at a small 2×2 cluster around spawn point
      const offsets = [{ dx: -5, dy: -5 }, { dx: 5, dy: -5 }, { dx: -5, dy: 5 }, { dx: 5, dy: 5 }]
      const soldiers = s.soldiers.map((sol, i) => ({
        ...sol,
        hp: sol.maxHp,
        position: { x: bx + (offsets[i]?.dx ?? 0), y: by + (offsets[i]?.dy ?? 0) },
      }))
      const hp = soldiers.reduce((sum, sol) => sum + sol.maxHp, 0)
      return {
        ...s,
        status: 'idle' as const,
        role:   'attack' as const,
        soldiers,
        hp,
        position:        { x: bx, y: by },
        targetCpId:      null,
        suppressedTimer: 0,
        revealedTimer:   s.team === 'red' ? 5 : 0,
        respawnTimer:    0,
      }
    }
    return { ...s, respawnTimer }
  })

  return { squads: next, blueRespawnCost, redRespawnCost }
}

// ── Death cost ────────────────────────────────────────────────────────────
// Detects squads that just died this tick, starts their respawn timer,
// and returns how many tickets each team lost from deaths.

function processDeaths(
  squads: Squad[],
  prevSquads: Squad[],
): { squads: Squad[]; blueLost: number; redLost: number } {
  let blueLost = 0
  let redLost  = 0

  const next = squads.map((s, i) => {
    const prev = prevSquads[i]
    if (s.status === 'dead' && prev.status !== 'dead') {
      if (s.team === 'blue') blueLost += TICKET_DEATH_COST
      else                    redLost  += TICKET_DEATH_COST
      return { ...s, respawnTimer: SQUAD_RESPAWN_TIME }
    }
    return s
  })

  return { squads: next, blueLost, redLost }
}

// ── Victory condition ─────────────────────────────────────────────────────
// Draw is checked FIRST to avoid sequential bias.
// Tickets can only end the game after minGameTime.

function checkVictory(
  state: GameState,
  blueTickets: number,
  redTickets: number,
): GamePhase {
  if (state.elapsed < state.minGameTime) return 'playing'

  const blueDead = blueTickets <= 0
  const redDead  = redTickets  <= 0

  if (blueDead && redDead) return 'draw'     // simultaneous — no sequential bias
  if (blueDead)            return 'defeat'
  if (redDead)             return 'victory'
  return 'playing'
}

// ── Main tick ─────────────────────────────────────────────────────────────
//
// Ticket costs applied this tick (all combined at step 8):
//   blueTickets -= blueDrain (bleeding) + blueLost (deaths) + blueRespawnCost (respawns)
//   redTickets  -= redDrain  (bleeding) + redLost  (deaths) + redRespawnCost  (respawns)

export function tick(state: GameState, dt: number): GameState {
  if (state.phase !== 'playing') return state

  // 1. Respawn dead squads (costs RESPAWN_TICKET_COST when squad arrives)
  const { squads: respawnedSquads, blueRespawnCost, redRespawnCost } = tickRespawns(state.squads, dt)
  let squads = respawnedSquads

  // 2. Assign roles (no ticket cost)
  // Tick blue order timer first so expired orders don't affect this frame
  const blueOrderTimer = Math.max(0, state.blueOrders.timer - dt)
  const blueOrderActive = blueOrderTimer > 0
  const blueOrders = blueOrderActive
    ? { ...state.blueOrders, timer: blueOrderTimer }
    : { type: null as null, cpId: null, timer: 0 }

  squads = assignTeamSquads(squads, state.controlPoints, 'blue', {
    orderType:  blueOrderActive ? state.blueOrders.type  : null,
    orderCpId:  blueOrderActive ? state.blueOrders.cpId  : null,
  })
  squads = assignRedSquads(squads, state.controlPoints, state)

  // 3. Move & AI
  const prevSquads = squads
  squads = squads.map(squad => updateSquad(squad, squads, state.controlPoints, dt))

  // 3b. Separate overlapping soldiers (collision resolution across all squads)
  squads = separateSoldiers(squads)

  // 3c. HP regeneration (base or safe CP, no enemy nearby)
  squads = regenHP(squads, state.controlPoints, dt)

  // 3d. Reinforce: when all alive soldiers are at full HP, revive one dead slot at 1 HP
  squads = reinforceSoldiers(squads)

  // 4. Combat damage
  squads = applyCombat(squads, dt)

  // 5. Detect deaths → start respawn timers, collect death costs
  const { squads: squadsAfterDeath, blueLost, redLost } = processDeaths(squads, prevSquads)
  squads = squadsAfterDeath

  // 6. Update capture points
  const controlPoints = updateCaptures(squads, state.controlPoints, dt)

  // 7. Bleeding (based on updated CP ownership)
  const { blueDrain, redDrain } = computeBleeding(controlPoints, dt)

  // 8. Apply all ticket costs together
  const blueTickets = Math.max(0, state.blueTickets - blueDrain - blueLost - blueRespawnCost)
  const redTickets  = Math.max(0, state.redTickets  - redDrain  - redLost  - redRespawnCost)

  // 9. Commander points regen
  const commanderPoints = Math.min(
    state.commanderPointsMax,
    state.commanderPoints + CP_REGEN_RATE * dt,
  )

  // 10. Abilities cooldowns
  const abilities = state.abilities.map(a => ({
    ...a,
    cooldownRemaining: Math.max(0, a.cooldownRemaining - dt),
  }))

  // 11. Visual effects
  const effects = state.effects
    .map(e => ({ ...e, timer: e.timer - dt }))
    .filter(e => e.timer > 0)

  // 12. UAV timer
  const uavTimer  = Math.max(0, state.uavTimer - dt)
  const uavActive = uavTimer > 0

  // 13. Reveal timers on enemy squads
  const squadsWithReveal = squads.map(s => ({
    ...s,
    revealedTimer: Math.max(0, s.revealedTimer - dt),
  }))

  // 14. Update red AI CP pressure map
  //   a) Decay existing heat (~10s half-life, 0.07/s linear decay)
  const PRESSURE_DECAY = 0.07
  const updatedPressure: Record<string, number> = {}
  for (const [cpId, heat] of Object.entries(state.redAI.cpPressure)) {
    const next = heat - PRESSURE_DECAY * dt
    if (next > 0.01) updatedPressure[cpId] = next
  }
  //   b) Artillery explosions near a CP add heat (+1.5 per hit, cap 3)
  for (const fx of state.effects) {
    if (fx.type !== 'explosion') continue
    for (const cp of controlPoints) {
      const d = Math.hypot(fx.position.x - cp.position.x, fx.position.y - cp.position.y)
      if (d < 120) {
        updatedPressure[cp.id] = Math.min(3, (updatedPressure[cp.id] ?? 0) + 1.5)
      }
    }
  }
  //   c) 2+ blue squads near a CP gradually add heat (+0.3/s, cap 3)
  for (const cp of controlPoints) {
    const blueNear = squadsWithReveal.filter(
      s => s.team === 'blue' && s.status !== 'dead' &&
           Math.hypot(s.position.x - cp.position.x, s.position.y - cp.position.y) < 80,
    ).length
    if (blueNear >= 2) {
      updatedPressure[cp.id] = Math.min(3, (updatedPressure[cp.id] ?? 0) + 0.3 * dt)
    }
  }
  const redAI = { cpPressure: updatedPressure }

  // 15. Victory / defeat / draw check
  const elapsed = state.elapsed + dt
  const phase   = checkVictory({ ...state, elapsed }, blueTickets, redTickets)

  return {
    ...state,
    squads: squadsWithReveal,
    controlPoints,
    commanderPoints,
    abilities,
    effects,
    uavActive,
    uavTimer,
    uavCenter: uavActive ? state.uavCenter : null,
    blueTickets,
    redTickets,
    phase,
    elapsed,
    redAI,
    blueOrders,
  }
}
