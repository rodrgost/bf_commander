export type Difficulty = 'easy' | 'normal' | 'hard'

export interface GameConfig {
  blueSquads:     number        // 2–6
  redSquads:      number        // 2–6
  cpCount:        1 | 3 | 5    // number of control points on the map
  initialTickets: number        // 100 | 150 | 200 | 250 | 300
  difficulty:     Difficulty    // affects bleed rate and min game time
}

export type Team = 'blue' | 'red'
export type SquadStatus = 'idle' | 'moving' | 'fighting' | 'suppressed' | 'dead'
export type SquadRole = 'attack' | 'defend' | 'hold' | 'retreat'
export type CPOwner = 'neutral' | 'blue' | 'red'
export type AbilityId = 'uav' | 'artillery' | 'ammo' | 'emp' | 'order_attack' | 'order_defend'
export type GamePhase = 'playing' | 'victory' | 'defeat' | 'draw'

export interface Vec2 {
  x: number
  y: number
}

// One physical unit on the map — 4 per squad
export interface Soldier {
  id: string       // e.g. 'b1_0' … 'b1_3'
  position: Vec2
  hp: number
  maxHp: number    // SOLDIER_MAX_HP (25)
}

export interface Squad {
  id: string
  team: Team
  soldiers: Soldier[]  // 4 individual soldiers with own positions / HP
  position: Vec2       // centroid of alive soldiers — derived each tick
  hp: number           // Σ alive soldier HP — derived each tick
  maxHp: number        // 4 × SOLDIER_MAX_HP (constant)
  status: SquadStatus
  role: SquadRole           // current AI priority role
  targetCpId: string | null
  suppressedTimer: number   // seconds remaining for EMP suppress
  revealedTimer: number     // seconds remaining for UAV reveal (enemies)
  respawnTimer: number      // > 0 while waiting to respawn at base (squad is 'dead')
}

export interface ControlPoint {
  id: string
  label: string
  position: Vec2
  owner: CPOwner
  captureProgress: number   // 0–1 toward the team currently capping
  cappingTeam: Team | null
}

export interface VisualEffect {
  id: string
  type: 'explosion' | 'uav_scan' | 'ammo_drop' | 'emp_pulse'
  position: Vec2
  radius: number
  timer: number   // seconds remaining
  maxTimer: number
}

export interface AbilityState {
  id: AbilityId
  label: string
  cost: number
  cooldownMax: number
  cooldownRemaining: number
  description: string
}

export type SelectionTarget =
  | { type: 'squad'; id: string }
  | { type: 'cp';    id: string }
  | { type: 'base';  team: Team }

export interface GameState {
  phase: GamePhase
  squads: Squad[]
  controlPoints: ControlPoint[]
  commanderPoints: number
  commanderPointsMax: number
  abilities: AbilityState[]
  effects: VisualEffect[]
  uavActive: boolean
  uavTimer: number
  uavCenter: Vec2 | null
  uavRadius: number
  pendingAbility: AbilityId | null   // ability selected waiting for map click
  elapsed: number                    // total seconds elapsed
  blueTickets: number
  redTickets: number
  ticketsMax: number
  minGameTime: number                // seconds before tickets can end the game
  bleedRatePerCp: number             // tickets/s drained per CP advantage
  redAI: {
    cpPressure: Record<string, number>  // CP id → heat from player attacks (decays over time)
  }
  blueOrders: {
    type: 'attack' | 'defend' | null  // active commander order for blue squads
    cpId: string | null               // target CP for the order
    timer: number                     // seconds remaining
  }
}
