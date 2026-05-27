import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameConfig, GameState, AbilityId, Vec2 } from '../types'
import { createInitialState } from '../game/mapData'
import { tick } from '../game/gameLoop'
import { activateUAV, activateArtillery, activateAmmo, activateEMP, activateOrderAttack, activateOrderDefend } from '../game/abilities'

export function useGameLoop(config: GameConfig) {
  const [renderState, setRenderState] = useState<GameState>(() => createInitialState(config))
  const stateRef   = useRef<GameState>(renderState)
  const lastTimeRef = useRef<number | null>(null)
  const rafRef     = useRef<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Keep ref in sync with state for the rAF / interval closures
  stateRef.current = renderState

  // ── Core tick: advance game state by dt seconds ──────────────────────────
  const runTick = useCallback((now: number) => {
    if (lastTimeRef.current === null) {
      lastTimeRef.current = now
      return   // first call after (re)start — skip this frame to avoid dt=0 edge cases
    }
    const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05) // cap at 50ms
    lastTimeRef.current = now

    const newState = tick(stateRef.current, dt)
    stateRef.current = newState
    setRenderState(newState)
  }, [])

  // ── rAF loop: runs at ~60fps while the tab is visible ────────────────────
  const loop = useCallback((timestamp: number) => {
    runTick(timestamp)
    rafRef.current = requestAnimationFrame(loop)
  }, [runTick])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [loop])

  // ── Background tick: setInterval keeps the game alive when rAF is paused ─
  // Browsers throttle setInterval to ~1s in background tabs but don't stop it,
  // so the game continues (slowly) while the user is in another tab.
  // On return to foreground, rAF takes over and lastTimeRef is reset so there
  // is no large dt jump.
  useEffect(() => {
    const BACKGROUND_INTERVAL_MS = 200  // 5 ticks/s — enough to keep game alive

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // Start background interval when leaving
        if (!intervalRef.current) {
          intervalRef.current = setInterval(() => {
            runTick(performance.now())
          }, BACKGROUND_INTERVAL_MS)
        }
      } else {
        // Stop background interval and reset timestamp so rAF resumes cleanly
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        lastTimeRef.current = null  // first rAF frame will re-seed the clock
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [runTick])

  const selectAbility = useCallback((id: AbilityId) => {
    setRenderState(s => {
      // Toggle off if already selected
      if (s.pendingAbility === id) return { ...s, pendingAbility: null }
      return { ...s, pendingAbility: id }
    })
  }, [])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  // Q/W/E/R/A/S → select abilities  |  Escape → cancel pending
  useEffect(() => {
    const KEYBINDS: Record<string, AbilityId> = {
      q: 'uav', w: 'artillery', e: 'ammo', r: 'emp',
      a: 'order_attack', s: 'order_defend',
    }
    const handleKey = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return
      if (ev.key === 'Escape') {
        setRenderState(s => ({ ...s, pendingAbility: null }))
        return
      }
      const id = KEYBINDS[ev.key.toLowerCase()]
      if (!id) return
      setRenderState(s => {
        if (s.phase !== 'playing') return s
        if (s.pendingAbility === id) return { ...s, pendingAbility: null }
        return { ...s, pendingAbility: id }
      })
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const fireAbility = useCallback((pos: Vec2) => {
    setRenderState(s => {
      if (!s.pendingAbility) return s
      const ability = s.abilities.find(a => a.id === s.pendingAbility)!
      if (!ability || s.commanderPoints < ability.cost || ability.cooldownRemaining > 0) {
        return { ...s, pendingAbility: null }
      }

      let newState: GameState
      switch (s.pendingAbility) {
        case 'uav':          newState = activateUAV(s, pos);          break
        case 'artillery':    newState = activateArtillery(s, pos);    break
        case 'ammo':         newState = activateAmmo(s, pos);         break
        case 'emp':          newState = activateEMP(s, pos);          break
        case 'order_attack': newState = activateOrderAttack(s, pos);  break
        case 'order_defend': newState = activateOrderDefend(s, pos);  break
        default:             return s
      }

      const abilities = newState.abilities.map(a =>
        a.id === s.pendingAbility ? { ...a, cooldownRemaining: a.cooldownMax } : a
      )
      return {
        ...newState,
        commanderPoints: newState.commanderPoints - ability.cost,
        abilities,
        pendingAbility: null,
      }
    })
  }, [])

  // Direct-fire: select + fire in one step (used by contextual panel buttons)
  const fireAbilityAt = useCallback((id: AbilityId, pos: Vec2) => {
    setRenderState(s => {
      const ability = s.abilities.find(a => a.id === id)
      if (!ability || s.commanderPoints < ability.cost || ability.cooldownRemaining > 0) return s
      let newState: GameState
      switch (id) {
        case 'uav':          newState = activateUAV(s, pos);          break
        case 'artillery':    newState = activateArtillery(s, pos);    break
        case 'ammo':         newState = activateAmmo(s, pos);         break
        case 'emp':          newState = activateEMP(s, pos);          break
        case 'order_attack': newState = activateOrderAttack(s, pos);  break
        case 'order_defend': newState = activateOrderDefend(s, pos);  break
        default:             return s
      }
      const abilities = newState.abilities.map(a =>
        a.id === id ? { ...a, cooldownRemaining: a.cooldownMax } : a,
      )
      return { ...newState, commanderPoints: newState.commanderPoints - ability.cost, abilities, pendingAbility: null }
    })
  }, [])

  const restart = useCallback((newConfig?: GameConfig) => {
    const fresh = createInitialState(newConfig ?? config)
    stateRef.current = fresh
    lastTimeRef.current = null
    setRenderState(fresh)
  }, [config])

  return { state: renderState, selectAbility, fireAbility, fireAbilityAt, restart }
}
