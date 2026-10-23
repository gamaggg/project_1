'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { BackButton } from '@/components/app-shell/BackButton'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { LanguageMenu } from '@/components/app-shell/LanguageMenu'
import { loadCoast } from '@/components/app-shell/onboarding/WelcomeMap'
import { createJourneyScene, type Bands, type JourneyScene, type Stage } from '@/lib/welcome/journeyScene'
import type { TickerLine } from '@/lib/welcome/coastScene'
import { tn } from '@/lib/i18n/runtime'
import type { TelegramSignInResult } from '@/lib/telegram/signIn'

// The welcome screen and the two intro screens after it as one picture: a single
// night map (lib/welcome/journeyScene.ts) whose camera flies from stop to stop —
// a second or so, eased — while the text and the buttons of the stop left slide
// away and those of the stop reached come in one after another. On each of the
// last two the map can be played with at once:
//   territory-intro  tap sectors: a free one is claimed, a held one is taken
//   catch-intro      a photo of a catch flies into a sector (tap any sector to do
//                    it yourself, once the little show has played)
// `stage` is the current stop (the flow owns it); `onStage` asks for another.

const STAGES: Stage[] = ['welcome', 'territory-intro', 'catch-intro']
const HOLDER = { holder: 'Maksym', color: '#A77BFF' }
const FISH = ['#FFB067', '#7AC8FF', '#9BE08F', '#C9A7FF']
type Act = 'idle' | 'free' | 'steal'
const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
// A caption starts as what the demo shows first (a free sector), not as the
// headline — except where the demo doesn't play.
const startAct = (): Act => (reduced() ? 'idle' : 'free')
const delay = (i: number): CSSProperties => ({ ['--d' as string]: `${0.5 + i * 0.09}s` })

export function IntroJourney({
  stage,
  onStage,
  onSignIn,
  onTelegramSignIn,
  onFinish,
  continueMode,
  onContinue,
  invited,
}: {
  stage: Stage
  onStage: (next: Stage) => void
  onSignIn?: () => void
  // Inside Telegram with nobody signed in: «Войти через Telegram» for someone whose Telegram
  // already has an account but the silent sign-in at launch did not get through.
  onTelegramSignIn?: () => Promise<TelegramSignInResult>
  // «Продолжить» on the last stop.
  onFinish: () => void
  // Inside Telegram with an account already made: the welcome offers «Продолжить»
  // instead of «Захватить…» / «У меня уже есть аккаунт»; `onContinue` replaces
  // going to the next stop (to skip the intro for someone who has seen it).
  continueMode?: boolean
  onContinue?: () => void
  invited?: boolean
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<JourneyScene | null>(null)
  const [scene, setScene] = useState<JourneyScene | null>(null)
  const [tgState, setTgState] = useState<'idle' | 'pending' | 'no_account' | 'failed'>('idle')
  const viewRef = useRef({ w: 0, h: 0 })
  const bandsRef = useRef<Bands>({ welcome: { top: 150, bottom: 450 }, 'territory-intro': { top: 90, bottom: 450 }, 'catch-intro': { top: 90, bottom: 450 } })
  const wHead = useRef<HTMLDivElement>(null)
  const wFoot = useRef<HTMLDivElement>(null)
  const tChip = useRef<HTMLDivElement>(null)
  const tCopy = useRef<HTMLDivElement>(null)
  const cChip = useRef<HTMLDivElement>(null)
  const cCopy = useRef<HTMLDivElement>(null)
  const stageRef = useRef(stage)
  const flight = useRef(0)
  const firstStage = useRef(true)

  const [ready, setReady] = useState(false)
  const [line, setLine] = useState<TickerLine | null>(null)
  const [mine, setMine] = useState(0)
  const [tAct, setTAct] = useState<Act>(startAct)
  const [cAct, setCAct] = useState<Act>(startAct)
  const [catchReady, setCatchReady] = useState(false)
  const [finger, setFinger] = useState({ x: 0, y: 0, show: false, tap: false })
  const [flashKey, setFlashKey] = useState(0)
  const [photo, setPhoto] = useState<{ k: number; x: number; y: number; dx: number; dy: number; fish: string } | null>(null)
  const tDemoDone = useRef(false)
  const cShowDone = useRef(false)
  const cBusy = useRef(false)
  const tCapTimer = useRef(0)
  const cCapTimer = useRef(0)
  const snaps = useRef(0)
  useEffect(() => {
    stageRef.current = stage
  }, [stage])
  useEffect(
    () => () => {
      clearTimeout(tCapTimer.current)
      clearTimeout(cCapTimer.current)
    },
    []
  )

  // The panels start hidden and show on the next frame, so the first text
  // comes in too.
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // ---- the canvas and the bands of map the panels leave free
  const measure = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    const r = root.getBoundingClientRect()
    const top = (el: HTMLElement | null, fallback: number) => (el ? el.getBoundingClientRect().bottom - r.top : fallback)
    const bottom = (el: HTMLElement | null, fallback: number) => (el ? el.getBoundingClientRect().top - r.top : fallback)
    bandsRef.current = {
      welcome: { top: top(wHead.current, 150), bottom: bottom(wFoot.current, r.height * 0.7) },
      'territory-intro': { top: top(tChip.current, 90), bottom: bottom(tCopy.current, r.height * 0.7) },
      'catch-intro': { top: top(cChip.current, 90), bottom: bottom(cCopy.current, r.height * 0.7) },
    }
  }, [])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const root = rootRef.current
    if (!canvas || !root) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let cancelled = false
    const t0 = performance.now()
    const loop = (now: number) => {
      const sc = sceneRef.current
      if (sc) sc.draw(ctx, Math.max(0, now - t0) / 1000, viewRef.current, bandsRef.current)
      raf = requestAnimationFrame(loop)
    }
    const start = () => {
      cancelAnimationFrame(raf)
      if (sceneRef.current && !document.hidden) raf = requestAnimationFrame(loop)
    }
    const fit = () => {
      const r = root.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      viewRef.current = { w: r.width, h: r.height }
      canvas.width = Math.round(r.width * dpr)
      canvas.height = Math.round(r.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      measure()
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(root)
    for (const el of [wHead, wFoot, tChip, tCopy, cChip, cCopy]) if (el.current) ro.observe(el.current)
    const onVisibility = () => (document.hidden ? cancelAnimationFrame(raf) : start())
    document.addEventListener('visibilitychange', onVisibility)
    // text re-wraps once the fonts are in
    void document.fonts?.ready.then(() => !cancelled && fit())

    loadCoast()
      .then((data) => {
        if (cancelled) return
        const label = getComputedStyle(canvas).getPropertyValue('--font-manrope').trim() || 'Manrope, sans-serif'
        const sc = createJourneyScene(data, label, (l) => setLine(l))
        sceneRef.current = sc
        setScene(sc)
        start()
      })
      .catch(() => {})
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [measure])

  // ---- the camera follows the stop
  useEffect(() => {
    if (!scene) return
    measure()
    flight.current = scene.setStage(stage, bandsRef.current, firstStage.current || reduced())
    firstStage.current = false
  }, [scene, stage, measure])

  // ---- territory-intro: the finger shows it once, then it is the person's
  const tClaim = useCallback(
    (id: string, hold = false) => {
      if (!scene) return
      const role = scene.roleOf(id)
      if (role !== 'mine') {
        setTAct(role === 'other' ? 'steal' : 'free')
        clearTimeout(tCapTimer.current)
        // stays until the next one; back to the headline only a few seconds after the last
        if (!hold) tCapTimer.current = window.setTimeout(() => setTAct('idle'), 4800)
      }
      scene.claim(id)
      setMine(scene.mineCount())
    },
    [scene]
  )
  useEffect(() => {
    if (!scene || stage !== 'territory-intro' || tDemoDone.current || reduced()) return
    let alive = true
    const timers: number[] = []
    const after = (ms: number, fn: () => void) => {
      timers.push(
        window.setTimeout(() => {
          if (alive) fn()
        }, ms)
      )
    }
    let step = 0
    const run = () => {
      if (step >= 2) {
        setFinger((f) => ({ ...f, show: false }))
        tDemoDone.current = true
        return
      }
      const role = step === 0 ? 'free' : 'other'
      const pool = scene.candidates(role, viewRef.current)
      const id = pool.length ? pool[Math.floor(Math.random() * pool.length)] : scene.ensure(role)
      const at = id ? scene.screenOf(id) : null
      if (!id || !at) {
        tDemoDone.current = true
        return
      }
      setFinger({ x: at[0], y: at[1], show: true, tap: false })
      const hold = step === 0
      after(950, () => {
        setFinger((f) => ({ ...f, tap: true }))
        after(170, () => tClaim(id, hold))
      })
      after(950 + 170 + 3500, () => {
        step += 1
        setFinger((f) => ({ ...f, tap: false }))
        run()
      })
    }
    // once the camera has landed and the text has come in
    after(Math.max(0, flight.current) * 1000 + 900, run)
    return () => {
      alive = false
      timers.forEach(clearTimeout)
      setFinger((f) => ({ ...f, show: false }))
    }
  }, [scene, stage, tClaim])

  // ---- catch-intro: a photo flies into a sector (the show, then any tap)
  const snap = useCallback(
    (id: string) => {
      if (!scene || cBusy.current) return
      cBusy.current = true
      const role = scene.roleOf(id)
      setCAct(role === 'other' ? 'steal' : 'free')
      clearTimeout(cCapTimer.current)
      const k = (snaps.current += 1)
      window.setTimeout(() => setFlashKey((x) => x + 1), 0)
      window.setTimeout(() => {
        const view = viewRef.current
        const to = scene.screenOf(id)
        if (to) {
          const sx = view.w / 2
          const sy = bandsRef.current['catch-intro'].bottom - 8
          setPhoto({ k, x: sx, y: sy, dx: to[0] - sx, dy: to[1] - sy, fish: FISH[k % FISH.length] })
        }
      }, 180)
      window.setTimeout(() => {
        scene.claim(id)
        setMine(scene.mineCount())
      }, 1150)
      window.setTimeout(() => {
        cBusy.current = false
        cCapTimer.current = window.setTimeout(() => setCAct('idle'), 4800)
      }, 2600)
    },
    [scene]
  )
  useEffect(() => {
    if (!scene || stage !== 'catch-intro' || cShowDone.current || reduced()) return
    let alive = true
    const timers: number[] = []
    const after = (ms: number, fn: () => void) => {
      timers.push(
        window.setTimeout(() => {
          if (alive) fn()
        }, ms)
      )
    }
    const id = scene.centreId('catch-intro')
    const start = Math.max(0, flight.current) * 1000 + 900
    scene.set(id, 'free')
    after(start, () => snap(id))
    // the same sector, now held by a player — and taken from them
    after(start + 3900, () => {
      scene.set(id, HOLDER)
      cBusy.current = false
      snap(id)
    })
    after(start + 3900 + 3300, () => {
      cShowDone.current = true
      setCatchReady(true)
    })
    return () => {
      alive = false
      timers.forEach(clearTimeout)
    }
  }, [scene, stage, snap])

  // ---- taps on the map
  const onPick = useCallback(
    (id: string) => {
      if (stageRef.current === 'territory-intro') {
        tDemoDone.current = true
        setFinger((f) => ({ ...f, show: false }))
        tClaim(id)
      } else if (stageRef.current === 'catch-intro' && cShowDone.current) snap(id)
    },
    [tClaim, snap]
  )

  const ci = STAGES.indexOf(stage)
  const stateOf = (i: number) => (!ready ? 'future' : i === ci ? 'active' : i < ci ? 'past' : 'future')
  const go = (next: Stage) => () => onStage(next)

  const tCap =
    tAct === 'free'
      ? { title: tn('onb.capFreeTitle'), sub: tn('onb.capFreeSub') }
      : tAct === 'steal'
        ? { title: tn('onb.capStealTitle'), sub: tn('onb.capStealSub') }
        : { title: tn('onb.startsHere'), sub: tn('onb.startsSub') }
  const cCap =
    cAct === 'free'
      ? { title: tn('onb.capFreeTitle'), sub: tn('onb.catchFreeSub') }
      : cAct === 'steal'
        ? { title: tn('onb.capStealTitle'), sub: tn('onb.catchStealSub') }
        : { title: tn('onb.caughtClaimed'), sub: tn('onb.catchSub') }

  return (
    <div className="journey" ref={rootRef}>
      <canvas
        ref={canvasRef}
        className="journey-canvas"
        aria-hidden="true"
        onPointerDown={(e) => {
          const sc = sceneRef.current
          if (!sc) return
          const r = e.currentTarget.getBoundingClientRect()
          const id = sc.pick(e.clientX - r.left, e.clientY - r.top)
          if (id) onPick(id)
        }}
      />

      {/* 1 · welcome */}
      <div className="jp-panel jp-panel--welcome" data-state={stateOf(0)}>
        <LanguageMenu />
        <div className="welcome-head" ref={wHead}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
          <img src="/brand/logo_2.svg" alt="RANGE" className="welcome-logo jp-in" style={delay(0)} />
          <h1 className="welcome-title">
            <span className="jp-in" style={delay(1)}>{tn('onb.welcomeCatch')}</span>
            <span className="welcome-title-accent jp-in" style={delay(2)}>{tn('onb.welcomeClaim')}</span>
            <span className="jp-in" style={delay(3)}>{tn('onb.welcomeOwn')}</span>
          </h1>
          <p className="welcome-sub jp-in" style={delay(4)}>
            {tn('onb.everyCatch')}
          </p>
        </div>
        <div className="welcome-foot" ref={wFoot}>
          {invited && (
            <div className="welcome-invite jp-in" style={delay(4)}>
              <CoinIcon size={16} />
              {tn('onb.invited')}
            </div>
          )}
          <div className="welcome-ticker jp-in" style={delay(5)} aria-live="polite">
            <i className="welcome-ticker-dot" aria-hidden />
            {line && (
              <span key={`${line.name}${line.id}${line.day}`} className="welcome-ticker-text">
                <b>{line.name}</b> {line.verb} <b>{line.id}</b> {line.day}
              </span>
            )}
          </div>
          {continueMode ? (
            <button className="btn-primary jp-in" style={delay(6)} onClick={onContinue ?? go('territory-intro')}>
              {tn('onb.continue')}
            </button>
          ) : (
            <>
              <button className="btn-primary jp-in" style={delay(6)} onClick={go('territory-intro')}>
                {tn('onb.captureFirst')}
              </button>
              {onTelegramSignIn && (
                <>
                  <button
                    className="welcome-link jp-in"
                    style={delay(7)}
                    disabled={tgState === 'pending'}
                    onClick={async () => {
                      setTgState('pending')
                      const result = await onTelegramSignIn()
                      setTgState(result === 'ok' ? 'idle' : result)
                    }}
                  >
                    {tgState === 'pending' ? tn('onb.tgSignInWait') : tn('onb.tgSignIn')}
                  </button>
                  {(tgState === 'no_account' || tgState === 'failed') && (
                    <div className="welcome-link-note" role="status">
                      {tn(tgState === 'no_account' ? 'onb.tgNoAccount' : 'onb.tgFailed')}
                    </div>
                  )}
                </>
              )}
              <button className="welcome-link jp-in" style={delay(7)} onClick={onSignIn}>
                {tn('onb.haveAcc')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2 · territory */}
      <div className="jp-panel jp-panel--intro" data-state={stateOf(1)}>
        {stage === 'territory-intro' && <BackButton onClick={go('welcome')} variant="intro" stroke="#fff" />}
        <div className="inn-top inn-top--stack" ref={tChip}>
          <div className="inn-chip jp-in" style={delay(0)}>
            <span className="inn-chip-hex" aria-hidden />
            {tn('onb.hundreds')}
          </div>
          <div className="inn-legend jp-in" style={delay(1)}>
            <span>
              <i className="inn-sw inn-sw--free" />
              {tn('onb.legendFree')}
            </span>
            <span>
              <i className="inn-sw inn-sw--other" />
              {tn('onb.legendTaken')}
            </span>
            <span>
              <i className="inn-sw inn-sw--mine" />
              {tn('onb.legendMine')} · {mine}
            </span>
          </div>
        </div>
        <div className="intro-illustration" />
        {/* the demo's pointer: a soft glow of light that glides over the map */}
        <span className={`id-cursor${finger.show ? ' show' : ''}${finger.tap ? ' tap' : ''}`} style={{ transform: `translate(${finger.x}px, ${finger.y}px)` }} aria-hidden>
          <i />
        </span>
        <div className="intro-copy" ref={tCopy}>
          <div className="jp-in" style={delay(2)}>
            <div key={tAct} className="inn-cap" aria-live="polite">
              <div className="intro-title">{tCap.title}</div>
              <div className="intro-sub">{tCap.sub}</div>
            </div>
          </div>
          <button className="intro-cta jp-in" style={delay(3)} onClick={go('catch-intro')}>
            {tn('onb.continue')}
          </button>
        </div>
      </div>

      {/* 3 · catch */}
      <div className="jp-panel jp-panel--intro" data-state={stateOf(2)}>
        {stage === 'catch-intro' && <BackButton onClick={go('territory-intro')} variant="intro" stroke="#fff" />}
        {/* no chip here: the map's own label over the sector says «Сектор твой» /
            «Отбил у …» — this is just the room the top of the map keeps */}
        <div className="inn-top inn-top--empty" ref={cChip} />
        <div className="intro-illustration" />
        {photo && (
          <div
            key={photo.k}
            className="ic-photo"
            style={{ left: photo.x - 34, top: photo.y - 34, ['--dx' as string]: `${photo.dx}px`, ['--dy' as string]: `${photo.dy}px` }}
          >
            <div className="ic-photo-inner" style={{ background: `linear-gradient(160deg, ${photo.fish}, #FC5200 90%)` }}>
              <svg width="38" height="24" viewBox="0 0 48 30" fill="#fff">
                <path d="M2 15c6-11 26-14 34-6 2 2 4 2 6-1-1 6-1 9 0 14-2-3-4-3-6-1-8 8-28 5-34-6z" />
                <circle cx="13" cy="13" r="2" fill="#C7430B" />
              </svg>
            </div>
          </div>
        )}
        <div className="intro-copy" ref={cCopy}>
          <div className="inn-hint jp-in" style={delay(0)} aria-hidden={!catchReady}>
            {catchReady ? tn('onb.tapSnap') : ' '}
          </div>
          <div className="jp-in" style={delay(1)}>
            <div key={cAct} className="inn-cap" aria-live="polite">
              <div className="intro-title">{cCap.title}</div>
              <div className="intro-sub">{cCap.sub}</div>
            </div>
          </div>
          <button className="intro-cta jp-in" style={delay(3)} onClick={onFinish}>
            {tn('onb.continue')}
          </button>
        </div>
      </div>
      {flashKey > 0 && <div key={flashKey} className="ic-flash" aria-hidden />}
    </div>
  )
}
