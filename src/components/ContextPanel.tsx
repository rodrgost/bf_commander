import React from 'react'
import type { CSSProperties } from 'react'
import type { GameState, SelectionTarget, AbilityId, Vec2, Squad, ControlPoint } from '../types'
import { SQUAD_RESPAWN_TIME } from '../game/mapData'

interface Props {
  selection:           SelectionTarget | null
  state:               GameState
  fireAbilityAt:       (id: AbilityId, pos: Vec2) => void
  setSquadOrders:      (ids: string[], opts: {
    holdUntilHealed?: boolean
    berserker?:       boolean
    manualTargetCpId?: string | null
  }) => void
  pendingSquadTarget:    boolean
  setPendingSquadTarget: (v: boolean) => void
}

// ── BF4 colour tokens ─────────────────────────────────────────────────────

const BF4 = {
  blue:        '#00C8FF',
  blueDim:     '#0065CC',
  blueBg:      '#03101a',
  red:         '#FF6633',
  redDim:      '#CC3300',
  redBg:       '#1a0800',
  neutral:     '#555880',
  neutralBg:   '#0d0d14',
  cooldown:    '#FFCC00',
  suppress:    '#a855f7',
  berserker:   '#FF3366',
  text:        '#7a9ab5',
  textDim:     '#2e4a5e',
  border:      '#0e2035',
  panelBg:     '#060e18',
  headerBg:    '#070f1c',
  rowBorder:   '#081420',
}

const mono = "'Courier New', Courier, monospace"

const panel: CSSProperties = {
  width: 220,
  minWidth: 220,
  background: BF4.panelBg,
  borderLeft: `1px solid ${BF4.border}`,
  color: BF4.text,
  fontFamily: mono,
  fontSize: 11,
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
  overflowX: 'hidden',
}

const sectionTitle: CSSProperties = {
  fontSize: 8,
  fontWeight: 900,
  letterSpacing: '2.5px',
  color: BF4.textDim,
  padding: '7px 12px 4px',
  borderBottom: `1px solid ${BF4.border}`,
  textTransform: 'uppercase',
}

const header: CSSProperties = {
  padding: '10px 12px 8px',
  borderBottom: `1px solid ${BF4.border}`,
  background: BF4.headerBg,
}

const headerTitle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: '1px',
  color: '#c0d8f0',
  marginBottom: 2,
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '3px 12px',
}

const hpBarTrack: CSSProperties = {
  flex: 1,
  height: 3,
  background: BF4.border,
  borderRadius: 2,
  overflow: 'hidden',
}

// ── Ability button ────────────────────────────────────────────────────────

function AbilBtn({
  id, icon, label, pos, state, fireAbilityAt,
}: {
  id: AbilityId; icon: string; label: string
  pos: Vec2; state: GameState; fireAbilityAt: (id: AbilityId, pos: Vec2) => void
}) {
  const ab      = state.abilities.find(a => a.id === id)!
  const onCd    = ab.cooldownRemaining > 0
  const noPoints = state.commanderPoints < ab.cost
  const canUse  = !onCd && !noPoints && state.phase === 'playing'

  const reason = onCd
    ? `CD ${Math.ceil(ab.cooldownRemaining)}s`
    : noPoints ? 'sem pts' : `${ab.cost}pt`

  return (
    <button
      onClick={() => canUse && fireAbilityAt(id, pos)}
      disabled={!canUse}
      title={ab.description}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '5px 10px',
        margin: '2px 8px',
        background: canUse ? BF4.blueBg : '#040a10',
        border: `1px solid ${canUse ? BF4.blueDim + '88' : BF4.border}`,
        borderRadius: 2,
        color: canUse ? BF4.text : BF4.textDim,
        fontSize: 10,
        fontFamily: mono,
        cursor: canUse ? 'pointer' : 'not-allowed',
        width: 'calc(100% - 16px)',
        textAlign: 'left',
        transition: 'background 0.1s',
      }}
    >
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{
        fontSize: 8,
        color: onCd ? BF4.cooldown : noPoints ? BF4.red : BF4.textDim,
        fontWeight: 700,
      }}>
        {reason}
      </span>
    </button>
  )
}

// ── Toggle order button ───────────────────────────────────────────────────

function OrderToggle({
  active, activeColor, icon, label, hint, onClick,
}: {
  active: boolean; activeColor: string
  icon: string; label: string; hint?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={hint}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '5px 10px',
        margin: '2px 8px',
        background: active ? activeColor + '18' : '#040a10',
        border: `1px solid ${active ? activeColor : BF4.border}`,
        borderRadius: 2,
        color: active ? activeColor : BF4.textDim,
        fontSize: 10,
        fontFamily: mono,
        cursor: 'pointer',
        width: 'calc(100% - 16px)',
        textAlign: 'left',
        transition: 'all 0.1s',
        boxShadow: active ? `0 0 6px ${activeColor}22` : 'none',
      }}
    >
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {active && (
        <span style={{ fontSize: 8, fontWeight: 700, color: activeColor }}>ON</span>
      )}
    </button>
  )
}

// ── Role & status labels ──────────────────────────────────────────────────

const ROLE_LABEL: Record<string, { icon: string; color: string; text: string }> = {
  attack:  { icon: '⚔', color: BF4.red,      text: 'ATAQUE'  },
  defend:  { icon: '🛡', color: BF4.blue,     text: 'DEFESA'  },
  hold:    { icon: '📌', color: '#00BF44',    text: 'POSIÇÃO' },
  retreat: { icon: '↩', color: BF4.redDim,   text: 'RECUO'   },
}

const STATUS_LABEL: Record<string, { icon: string; color: string }> = {
  idle:       { icon: '●',  color: BF4.textDim  },
  moving:     { icon: '▶',  color: BF4.blue     },
  fighting:   { icon: '⚔', color: BF4.red      },
  suppressed: { icon: '⚡', color: BF4.suppress },
  dead:       { icon: '↺',  color: '#2a3a4a'    },
}

// ── Squad HP bar ──────────────────────────────────────────────────────────

function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct  = Math.max(0, hp / maxHp)
  const fill = pct > 0.5 ? '#00BF44' : pct > 0.25 ? BF4.cooldown : BF4.red
  return (
    <div style={hpBarTrack}>
      <div style={{ width: `${pct * 100}%`, height: '100%', background: fill, borderRadius: 2 }} />
    </div>
  )
}

// ── Squad mini row (default panel) ────────────────────────────────────────

function SquadRow({ squad, idx }: { squad: Squad; idx: number }) {
  const isDead     = squad.status === 'dead'
  const role       = ROLE_LABEL[squad.role]
  const status     = STATUS_LABEL[squad.status]
  const aliveSol   = squad.soldiers.filter(s => s.hp > 0).length
  const respawnPct = isDead ? 1 - squad.respawnTimer / SQUAD_RESPAWN_TIME : 0

  return (
    <div style={{
      ...rowStyle,
      opacity: isDead ? 0.45 : 1,
      paddingTop: 4, paddingBottom: 4,
      borderBottom: `1px solid ${BF4.rowBorder}`,
    }}>
      <span style={{ color: BF4.blue, fontWeight: 700, minWidth: 20 }}>B{idx + 1}</span>

      <span style={{ color: role.color, fontSize: 9, minWidth: 18 }} title={squad.role}>
        {role.icon}
      </span>

      <span style={{ color: status.color, fontSize: 9, minWidth: 10 }}>
        {status.icon}
      </span>

      {isDead ? (
        <>
          <div style={{ ...hpBarTrack, background: '#120800' }}>
            <div style={{ width: `${respawnPct * 100}%`, height: '100%', background: BF4.redDim, borderRadius: 2 }} />
          </div>
          <span style={{ color: BF4.redDim, minWidth: 28, textAlign: 'right', fontSize: 10 }}>
            {Math.ceil(squad.respawnTimer)}s
          </span>
        </>
      ) : (
        <>
          <HpBar hp={squad.hp} maxHp={squad.maxHp} />
          <span style={{ color: '#475569', minWidth: 28, textAlign: 'right', fontSize: 10 }}>
            {aliveSol}/4
          </span>
        </>
      )}
    </div>
  )
}

// ── Squad orders section (shared by single + multi-squad panels) ──────────

function SquadOrderSection({
  squads, state, controlPoints, setSquadOrders,
  pendingSquadTarget, setPendingSquadTarget,
}: {
  squads: Squad[]
  state: GameState
  controlPoints: ControlPoint[]
  setSquadOrders: Props['setSquadOrders']
  pendingSquadTarget: boolean
  setPendingSquadTarget: Props['setPendingSquadTarget']
}) {
  const ids = squads.map(s => s.id)

  // Aggregate flags across selected squads
  const allHoldUntilHealed = squads.every(s => s.holdUntilHealed)
  const anyHoldUntilHealed = squads.some(s => s.holdUntilHealed)
  const allBerserker       = squads.every(s => s.berserker)
  const anyBerserker       = squads.some(s => s.berserker)

  // Manual targets
  const manualTargets = squads
    .map(s => s.manualTargetCpId)
    .filter(Boolean)
  const uniqueTargets = [...new Set(manualTargets)]

  return (
    <>
      <div style={sectionTitle}>Ordens</div>
      <div style={{ paddingTop: 4, paddingBottom: 4 }}>

        {/* ── Recuperar antes de ativar ── */}
        <OrderToggle
          active={anyHoldUntilHealed}
          activeColor={BF4.blue}
          icon="⚕"
          label="Recuperar primeiro"
          hint="Recua e aguarda 100% de HP antes de voltar ao combate"
          onClick={() => setSquadOrders(ids, { holdUntilHealed: !allHoldUntilHealed })}
        />

        {/* ── Atacar até morrer ── */}
        <OrderToggle
          active={anyBerserker}
          activeColor={BF4.berserker}
          icon="☠"
          label="Atacar até morrer"
          hint="Ignora dano — nunca recua, avança até cair"
          onClick={() => setSquadOrders(ids, { berserker: !allBerserker })}
        />

        {/* ── Designar alvo ── */}
        <button
          onClick={() => setPendingSquadTarget(!pendingSquadTarget)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '5px 10px',
            margin: '2px 8px',
            background: pendingSquadTarget ? BF4.cooldown + '22' : '#040a10',
            border: `1px solid ${pendingSquadTarget ? BF4.cooldown : BF4.border}`,
            borderRadius: 2,
            color: pendingSquadTarget ? BF4.cooldown : BF4.textDim,
            fontSize: 10,
            fontFamily: mono,
            cursor: 'pointer',
            width: 'calc(100% - 16px)',
            textAlign: 'left',
            transition: 'all 0.1s',
            boxShadow: pendingSquadTarget ? `0 0 6px ${BF4.cooldown}33` : 'none',
          }}
        >
          <span style={{ fontSize: 13 }}>🎯</span>
          <span style={{ flex: 1 }}>
            {pendingSquadTarget ? 'Clique num CP...' : 'Designar alvo'}
          </span>
          {pendingSquadTarget && (
            <span style={{ fontSize: 8, fontWeight: 700, color: BF4.cooldown }}>ESC</span>
          )}
        </button>

        {/* ── Show / clear manual targets ── */}
        {uniqueTargets.length > 0 && (
          <div style={{
            margin: '4px 8px 2px',
            padding: '4px 8px',
            background: BF4.cooldown + '10',
            border: `1px solid ${BF4.cooldown}33`,
            borderRadius: 2,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 9, color: BF4.cooldown }}>
                {uniqueTargets.map(cpId => {
                  const cp = controlPoints.find(c => c.id === cpId)
                  return cp ? cp.label[0] : cpId
                }).join(', ')}
              </span>
              <button
                onClick={() => setSquadOrders(ids, { manualTargetCpId: null })}
                style={{
                  background: 'none', border: 'none',
                  color: BF4.textDim, cursor: 'pointer',
                  fontSize: 10, padding: '0 2px', fontFamily: mono,
                }}
              >
                ✕ limpar
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Sub-panels ────────────────────────────────────────────────────────────

function DefaultPanel({ state }: { state: GameState }) {
  const blue = state.squads.filter(s => s.team === 'blue')
  const red  = state.squads.filter(s => s.team === 'red')
  const redAlive = red.filter(s => s.status !== 'dead').length
  const redDead  = red.filter(s => s.status === 'dead')
  const nextRespawn = redDead.length > 0
    ? Math.min(...redDead.map(s => s.respawnTimer))
    : 0

  return (
    <>
      <div style={sectionTitle}>Esquadrões Aliados</div>
      {blue.map((sq, i) => <SquadRow key={sq.id} squad={sq} idx={i} />)}

      <div style={{ ...sectionTitle, color: BF4.redDim, marginTop: 4 }}>Intel Inimiga</div>
      <div style={{ ...rowStyle, justifyContent: 'space-between', padding: '5px 12px' }}>
        <span style={{ color: BF4.textDim }}>Ativos</span>
        <span style={{ color: redAlive > 0 ? BF4.red : '#2a3a4a', fontWeight: 700 }}>
          {redAlive} / {red.length}
        </span>
      </div>
      {redDead.length > 0 && (
        <div style={{ ...rowStyle, justifyContent: 'space-between', padding: '2px 12px 5px' }}>
          <span style={{ color: '#2d4f6a' }}>Reforços</span>
          <span style={{ color: BF4.cooldown, fontSize: 10 }}>
            {redDead.length} em {Math.ceil(nextRespawn)}s
          </span>
        </div>
      )}

      {/* Legend */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '4px 10px',
        padding: '8px 12px',
        borderTop: '1px solid #0e2035',
        marginTop: 'auto',
      }}>
        {Object.entries(ROLE_LABEL).map(([k, r]) => (
          <span key={k} style={{ color: r.color, fontSize: 9 }}>{r.icon} {r.text}</span>
        ))}
        <span style={{ color: BF4.textDim, fontSize: 9, width: '100%', marginTop: 4 }}>
          Ctrl+Click → multi-seleção
        </span>
      </div>
    </>
  )
}

function SquadContextPanel({
  squads, state, fireAbilityAt, setSquadOrders,
  pendingSquadTarget, setPendingSquadTarget,
}: {
  squads: Squad[]
  state: GameState
  fireAbilityAt: (id: AbilityId, pos: Vec2) => void
  setSquadOrders: Props['setSquadOrders']
  pendingSquadTarget: boolean
  setPendingSquadTarget: Props['setPendingSquadTarget']
}) {
  const isMulti = squads.length > 1
  const first   = squads[0]!

  // Combined HP
  const totalHp    = squads.reduce((s, sq) => s + sq.hp, 0)
  const totalMaxHp = squads.reduce((s, sq) => s + sq.maxHp, 0)

  // For single-squad, show role + status
  const role   = !isMulti ? ROLE_LABEL[first.role]   : null
  const status = !isMulti ? STATUS_LABEL[first.status] : null
  const aliveSol = !isMulti ? first.soldiers.filter(s => s.hp > 0).length : null

  // Centroid of all selected squads (for ability targeting)
  const centroid: Vec2 = {
    x: squads.reduce((s, sq) => s + sq.position.x, 0) / squads.length,
    y: squads.reduce((s, sq) => s + sq.position.y, 0) / squads.length,
  }

  return (
    <>
      <div style={header}>
        {isMulti ? (
          <>
            <div style={{ ...headerTitle, color: '#60a5fa' }}>
              ◈ {squads.length} SQUADS
            </div>
            <div style={{ color: BF4.textDim, fontSize: 9, marginTop: 4 }}>
              {squads.map(s => s.id.toUpperCase()).join(' · ')}
            </div>
          </>
        ) : (
          <>
            <div style={{ ...headerTitle, color: first.berserker ? BF4.berserker : '#60a5fa' }}>
              ◈ SQUAD {first.id.toUpperCase()}
              {first.berserker && ' ☠'}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <span style={{ color: role!.color, fontSize: 10 }}>{role!.icon} {role!.text}</span>
              <span style={{ color: status!.color, fontSize: 10 }}>{status!.icon} {first.status.toUpperCase()}</span>
            </div>
          </>
        )}
      </div>

      <div style={sectionTitle}>Status</div>

      {!isMulti && (
        <div style={{ ...rowStyle, justifyContent: 'space-between', padding: '5px 12px' }}>
          <span>Soldados</span>
          <span style={{
            color: aliveSol! > 2 ? '#00BF44' : aliveSol! > 1 ? BF4.cooldown : BF4.red,
            fontWeight: 700,
          }}>
            {aliveSol} / 4
          </span>
        </div>
      )}

      <div style={{ padding: '3px 12px 8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 10, color: '#2d4f6a' }}>HP {isMulti ? '(total)' : ''}</span>
          <span style={{ fontSize: 10, color: '#475569' }}>
            {Math.ceil(totalHp)} / {totalMaxHp}
          </span>
        </div>
        <HpBar hp={totalHp} maxHp={totalMaxHp} />
      </div>

      {/* Multi-squad: show individual HP bars */}
      {isMulti && squads.map(sq => {
        const aliveSolInSq = sq.soldiers.filter(s => s.hp > 0).length
        return (
          <div key={sq.id} style={{ ...rowStyle, padding: '2px 12px', borderBottom: `1px solid ${BF4.rowBorder}` }}>
            <span style={{ color: sq.berserker ? BF4.berserker : BF4.blue, fontWeight: 700, minWidth: 24 }}>
              {sq.id.toUpperCase()}
            </span>
            <HpBar hp={sq.hp} maxHp={sq.maxHp} />
            <span style={{ color: '#475569', fontSize: 10, minWidth: 20, textAlign: 'right' }}>
              {aliveSolInSq}/4
            </span>
          </div>
        )
      })}

      {!isMulti && first.suppressedTimer > 0 && (
        <div style={{ ...rowStyle, color: BF4.suppress, fontSize: 10, padding: '2px 12px 6px' }}>
          ⚡ Suprimido {Math.ceil(first.suppressedTimer)}s
        </div>
      )}

      {/* ── Commander orders ── */}
      <SquadOrderSection
        squads={squads}
        state={state}
        controlPoints={state.controlPoints}
        setSquadOrders={setSquadOrders}
        pendingSquadTarget={pendingSquadTarget}
        setPendingSquadTarget={setPendingSquadTarget}
      />

      {/* ── Commander abilities ── */}
      <div style={sectionTitle}>Habilidades</div>
      <div style={{ paddingTop: 4, paddingBottom: 8 }}>
        <AbilBtn id="ammo" icon="📦" label="Suprimento" pos={centroid} state={state} fireAbilityAt={fireAbilityAt} />
      </div>
    </>
  )
}

function CPContextPanel({ cp, state, fireAbilityAt }: {
  cp: ControlPoint; state: GameState; fireAbilityAt: (id: AbilityId, pos: Vec2) => void
}) {
  const ownerLabel = cp.owner === 'neutral' ? 'NEUTRO' : cp.owner === 'blue' ? 'ALIADO' : 'INIMIGO'
  const ownerColor = cp.owner === 'neutral' ? BF4.neutral : cp.owner === 'blue' ? BF4.blue : BF4.red

  return (
    <>
      <div style={header}>
        <div style={{ ...headerTitle, color: ownerColor }}>◈ {cp.label.toUpperCase()}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <span style={{ color: ownerColor, fontSize: 10, fontWeight: 700 }}>{ownerLabel}</span>
          {cp.cappingTeam && (
            <span style={{
              color: cp.cappingTeam === 'blue' ? '#60a5fa' : '#f87171',
              fontSize: 10,
            }}>
              ▶ {Math.round(cp.captureProgress * 100)}%
            </span>
          )}
        </div>
      </div>

      {cp.cappingTeam && (
        <div style={{ padding: '6px 12px 2px' }}>
          <div style={{ ...hpBarTrack, height: 4 }}>
            <div style={{
              width: `${cp.captureProgress * 100}%`,
              height: '100%',
              background: cp.cappingTeam === 'blue' ? '#3b82f6' : '#ef4444',
              borderRadius: 2,
            }} />
          </div>
        </div>
      )}

      <div style={sectionTitle}>Ações</div>
      <div style={{ paddingTop: 4, paddingBottom: 8, display: 'flex', flexDirection: 'column', gap: 0 }}>
        <AbilBtn id="artillery"    icon="💥" label="Artilharia"     pos={cp.position} state={state} fireAbilityAt={fireAbilityAt} />
        <AbilBtn id="uav"          icon="📡" label="UAV Scan"       pos={cp.position} state={state} fireAbilityAt={fireAbilityAt} />
        <AbilBtn id="emp"          icon="⚡" label="Pulso EMP"      pos={cp.position} state={state} fireAbilityAt={fireAbilityAt} />
        <div style={{ margin: '4px 8px 2px', borderTop: '1px solid #0e2035' }} />
        <AbilBtn id="order_attack" icon="⚔" label="Ordem: Atacar"   pos={cp.position} state={state} fireAbilityAt={fireAbilityAt} />
        <AbilBtn id="order_defend" icon="🛡" label="Ordem: Defender" pos={cp.position} state={state} fireAbilityAt={fireAbilityAt} />
      </div>
    </>
  )
}

function BaseContextPanel({ team, state }: {
  team: 'blue' | 'red'; state: GameState
}) {
  const isBlue = team === 'blue'
  const color  = isBlue ? BF4.blue : BF4.red
  const label  = isBlue ? 'BASE ALIADA' : 'BASE INIMIGA'
  const squads = state.squads.filter(s => s.team === team)
  const alive  = squads.filter(s => s.status !== 'dead')
  const dead   = squads.filter(s => s.status === 'dead')

  return (
    <>
      <div style={header}>
        <div style={{ ...headerTitle, color }}>{label}</div>
        <div style={{ color: '#2d4f6a', fontSize: 10, marginTop: 3 }}>
          {alive.length} ativo{alive.length !== 1 ? 's' : ''} · {dead.length} respawnando
        </div>
      </div>

      {alive.length > 0 && (
        <>
          <div style={sectionTitle}>Ativos</div>
          {alive.map(s => {
            const role = ROLE_LABEL[s.role]
            const aliveSol = s.soldiers.filter(sol => sol.hp > 0).length
            return (
              <div key={s.id} style={{ ...rowStyle, padding: '4px 12px', borderBottom: '1px solid #081420' }}>
                <span style={{ color, fontWeight: 700, minWidth: 24 }}>{s.id.toUpperCase()}</span>
                <span style={{ color: role.color, fontSize: 9 }}>{role.icon}</span>
                <HpBar hp={s.hp} maxHp={s.maxHp} />
                <span style={{ color: '#475569', fontSize: 10, minWidth: 20, textAlign: 'right' }}>
                  {aliveSol}/4
                </span>
              </div>
            )
          })}
        </>
      )}

      {dead.length > 0 && (
        <>
          <div style={sectionTitle}>Respawnando</div>
          {dead.map(s => (
            <div key={s.id} style={{ ...rowStyle, padding: '4px 12px', borderBottom: '1px solid #081420' }}>
              <span style={{ color: '#374151', minWidth: 24 }}>{s.id.toUpperCase()}</span>
              <span style={{ color: '#374151', fontSize: 9 }}>↺</span>
              <div style={{ ...hpBarTrack, background: '#1a0a0a' }}>
                <div style={{
                  width: `${(1 - s.respawnTimer / SQUAD_RESPAWN_TIME) * 100}%`,
                  height: '100%',
                  background: isBlue ? BF4.blueDim : BF4.redDim,
                  borderRadius: 2,
                }} />
              </div>
              <span style={{ color: '#475569', fontSize: 10, minWidth: 28, textAlign: 'right' }}>
                {Math.ceil(s.respawnTimer)}s
              </span>
            </div>
          ))}
        </>
      )}
    </>
  )
}

// ── Main export ───────────────────────────────────────────────────────────

export default function ContextPanel({
  selection, state, fireAbilityAt, setSquadOrders,
  pendingSquadTarget, setPendingSquadTarget,
}: Props) {
  let content: React.ReactNode

  if (!selection) {
    content = <DefaultPanel state={state} />
  } else if (selection.type === 'squad') {
    const squads = selection.ids
      .map(id => state.squads.find(s => s.id === id && s.status !== 'dead'))
      .filter(Boolean) as Squad[]
    content = squads.length > 0
      ? <SquadContextPanel
          squads={squads}
          state={state}
          fireAbilityAt={fireAbilityAt}
          setSquadOrders={setSquadOrders}
          pendingSquadTarget={pendingSquadTarget}
          setPendingSquadTarget={setPendingSquadTarget}
        />
      : <DefaultPanel state={state} />
  } else if (selection.type === 'cp') {
    const cp = state.controlPoints.find(c => c.id === selection.id)
    content = cp
      ? <CPContextPanel cp={cp} state={state} fireAbilityAt={fireAbilityAt} />
      : <DefaultPanel state={state} />
  } else {
    content = <BaseContextPanel team={selection.team} state={state} />
  }

  return (
    <div style={panel}>
      {content}
    </div>
  )
}
