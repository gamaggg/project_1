'use client'

import { useState, type ReactNode } from 'react'
import { tn } from '@/lib/i18n/runtime'
import { SITE_URL } from '@/lib/site'

// The iPhone and Telegram steps as pictures: a cropped phone per step with the thing to tap
// pulsing, like a bank's «how to install the web app» page. Two flows, because
// Safari changed in iOS 26 — the old one has Share in the bottom bar, the new
// one hides it behind «⋯» and adds the «Open as Web App» switch. Everything is
// drawn here (no screenshots), so the texts inside follow the language.
const HOST = SITE_URL.replace(/^https?:\/\//, '')
const BLUE = '#0A84FF'
const INK = '#17181B'

type Version = 'old' | 'new'

// A phone cut off by the picture's edge: its top, its bottom or just the middle.
type Kind = 'top' | 'bottom' | 'mid'
const FRAME_Y: Record<Kind, number> = { top: 14, bottom: -230, mid: -60 }

function Defs() {
  return (
    <defs>
      <clipPath id="install-clip-top">
        <rect x="55" y="16.5" width="130" height="400" rx="21" />
      </clipPath>
      <clipPath id="install-clip-bottom">
        <rect x="55" y="-233" width="130" height="400" rx="21" />
      </clipPath>
      <clipPath id="install-clip-mid">
        <rect x="55" y="-100" width="130" height="500" />
      </clipPath>
      <clipPath id="install-clip-icon" clipPathUnits="objectBoundingBox">
        <rect width="1" height="1" rx="0.23" />
      </clipPath>
      <linearGradient id="install-saf" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#5AC8FA" />
        <stop offset="1" stopColor="#0A84FF" />
      </linearGradient>
      <linearGradient id="install-home-bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#7E9AE6" />
        <stop offset="1" stopColor="#F4907E" />
      </linearGradient>
      <filter id="install-shadow" x="-20%" y="-20%" width="140%" height="160%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodOpacity="0.22" />
      </filter>
    </defs>
  )
}

function Scene({ kind, children, over }: { kind: Kind; children: ReactNode; over?: ReactNode }) {
  return (
    <svg className="install-art" viewBox="0 0 240 190" role="img" aria-hidden>
      <Defs />
      <rect x="52" y={FRAME_Y[kind]} width="136" height="400" rx="24" fill="#fff" style={{ stroke: 'var(--accent)' }} strokeWidth="5" />
      <g clipPath={`url(#install-clip-${kind})`}>{children}</g>
      {over}
    </svg>
  )
}

function Pulse({ x, y, w, h, r }: { x: number; y: number; w: number; h: number; r: number }) {
  return <rect className="install-pulse" x={x} y={y} width={w} height={h} rx={r} fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth="2.5" />
}

function StatusBar({ color = INK }: { color?: string }) {
  return (
    <g fill={color}>
      <text x="66" y="29" fontSize="7" fontWeight="700">
        9:41
      </text>
      <rect x="160" y="23" width="16" height="7" rx="2" opacity="0.9" />
      <circle cx="152" cy="26.5" r="2" />
    </g>
  )
}

function AppIcon({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <image href="/icon-192.png" width={s} height={s} clipPath="url(#install-clip-icon)" />
    </g>
  )
}

// A blurred stand-in for page text / other menu rows.
function Bars({ x, y, widths, gap = 7, color = '#E3E4E8' }: { x: number; y: number; widths: number[]; gap?: number; color?: string }) {
  return (
    <>
      {widths.map((w, i) => (
        <rect key={i} x={x} y={y + i * gap} width={w} height="3.5" rx="1.75" fill={color} />
      ))}
    </>
  )
}

function twoLines(label: string): [string, string] {
  const i = label.indexOf(' ')
  return i < 0 ? [label, ''] : [label.slice(0, i), label.slice(i + 1)]
}

const stroke = { fill: 'none', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

function ShareGlyph({ cx, cy, color = BLUE }: { cx: number; cy: number; color?: string }) {
  return (
    <path
      d={`M${cx - 4} ${cy} H${cx - 6} V${cy + 8} H${cx + 6} V${cy} H${cx + 4} M${cx} ${cy + 3} V${cy - 8} M${cx - 3.5} ${cy - 4.5} L${cx} ${cy - 8} L${cx + 3.5} ${cy - 4.5}`}
      stroke={color}
      {...stroke}
    />
  )
}

// 1 — the Safari icon and the address to open, the same in both flows.
function ArtOpenSafari() {
  return (
    <Scene kind="top">
      <rect x="55" y="16" width="130" height="200" fill="#F2F2F7" />
      <StatusBar />
      <Bars x={70} y={44} widths={[100, 76]} color="#E0E1E6" />
      <g filter="url(#install-shadow)">
        <circle cx="120" cy="92" r="19" fill="url(#install-saf)" />
      </g>
      <circle cx="120" cy="92" r="15.5" fill="none" stroke="#fff" strokeWidth="1.2" />
      <g transform="translate(120 92) rotate(45)">
        <polygon points="0,-11 3,0 -3,0" fill="#FF3B30" />
        <polygon points="0,11 3,0 -3,0" fill="#fff" />
      </g>
      <circle className="install-pulse" cx="120" cy="92" r="21" fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth="2.5" />
      <text x="120" y="126" textAnchor="middle" fontSize="8" fontWeight="600" fill={INK}>
        Safari
      </text>
      <rect x="76" y="142" width="88" height="17" rx="8.5" fill="#fff" filter="url(#install-shadow)" />
      <text x="120" y="153.5" textAnchor="middle" fontSize="8" fill={INK}>
        {HOST}
      </text>
    </Scene>
  )
}

// 2 (early iOS) — Safari's bottom bar, Share in the middle.
function ArtOldShare() {
  const cy = 148
  return (
    <Scene kind="bottom">
      <rect x="55" y="-233" width="130" height="400" fill="#F2F2F7" />
      <AppIcon x={104} y={34} s={32} />
      <Bars x={78} y={78} widths={[84, 60]} />
      <rect x="64" y="112" width="112" height="19" rx="9.5" fill="#fff" filter="url(#install-shadow)" />
      <text x="120" y="124.5" textAnchor="middle" fontSize="8" fill={INK}>
        {HOST}
      </text>
      <rect x="55" y="136" width="130" height="40" fill="#F9F9FB" />
      <path d={`M${78} ${cy - 5} L${73} ${cy} L${78} ${cy + 5}`} stroke={BLUE} {...stroke} />
      <path d={`M${96} ${cy - 5} L${101} ${cy} L${96} ${cy + 5}`} stroke={BLUE} {...stroke} />
      <circle cx="120" cy={cy} r="14" fill="#fff" filter="url(#install-shadow)" />
      <ShareGlyph cx={120} cy={cy} />
      <path d={`M143 ${cy - 5} q4 -1.5 7 1 q3 -2.5 7 -1 v10 q-4 -1.5 -7 1 q-3 -2.5 -7 -1 z M150 ${cy - 4} v10`} stroke={BLUE} {...stroke} />
      <rect x="164" y={cy - 6} width="9" height="9" rx="1.5" stroke={BLUE} {...stroke} />
      <rect x="161" y={cy - 3} width="9" height="9" rx="1.5" stroke={BLUE} {...stroke} fill="#F9F9FB" />
      <rect x="100" y="164" width="40" height="3" rx="1.5" fill={INK} opacity="0.85" />
      <circle className="install-pulse" cx="120" cy={cy} r="16" fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth="2.5" />
    </Scene>
  )
}

// The share sheet's action list with one row lifted out of the blur: «Add to
// Home Screen» in both flows (the label differs, the picture is the same).
function ArtSheetRow({ label }: { label: string }) {
  const fs = label.length > 20 ? 7.4 : 8.5
  return (
    <Scene
      kind="mid"
      over={
        <>
          <rect x="38" y="82" width="164" height="28" rx="14" fill="#fff" filter="url(#install-shadow)" />
          <text x="54" y="99.5" fontSize={fs} fontWeight="500" fill={INK}>
            {label}
          </text>
          <rect x="176" y="90.5" width="11" height="11" rx="2.5" fill="none" stroke={INK} strokeWidth="1.2" />
          <path d="M181.5 93.5 v5 M179 96 h5" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
          <Pulse x={38} y={82} w={164} h={28} r={14} />
        </>
      }
    >
      <rect x="55" y="-100" width="130" height="500" fill="#D5D7DD" />
      <rect x="60" y="8" width="120" height="170" rx="12" fill="#E7E8ED" />
      {[18, 46, 74, 118, 146].map((y) => (
        <g key={y}>
          <Bars x={70} y={y + 6} widths={[y % 3 === 0 ? 62 : 74]} color="#C2C4CB" />
          <rect x="164" y={y + 3} width="10" height="10" rx="2.5" fill="#C2C4CB" />
        </g>
      ))}
    </Scene>
  )
}

// 4 (early iOS) — the «Add» dialog with its confirm button.
function ArtOldAdd() {
  return (
    <Scene kind="top">
      <rect x="55" y="16" width="130" height="200" fill="#F2F2F7" />
      <text x="66" y="45" fontSize="8" fill={BLUE}>
        {tn('install.lblCancel')}
      </text>
      <rect x="141" y="35" width="42" height="16" rx="8" fill={BLUE} fillOpacity="0.12" />
      <text x="162" y="46" textAnchor="middle" fontSize="8" fontWeight="700" fill={BLUE}>
        {tn('install.lblAdd')}
      </text>
      <rect x="62" y="62" width="116" height="58" rx="9" fill="#fff" />
      <AppIcon x={70} y={70} s={30} />
      <text x="110" y="89" fontSize="10" fontWeight="700" fill={INK}>
        RANGE
      </text>
      <rect x="62" y="104" width="116" height="0.7" fill="#E5E5EA" />
      <text x="70" y="114" fontSize="6.5" fill="#8E8E93">
        {HOST}
      </text>
      <Bars x={66} y={134} widths={[100, 80]} gap={7} />
      <Pulse x={141} y={35} w={42} h={16} r={8} />
    </Scene>
  )
}

// 5 — the new icon on the home screen, the same in both flows.
function ArtHomeScreen() {
  const cols = [66, 94, 122, 150]
  return (
    <Scene kind="top">
      <rect x="55" y="16" width="130" height="200" fill="url(#install-home-bg)" />
      <StatusBar color="#fff" />
      {cols.map((x, i) => (
        <g key={`a${i}`}>
          <rect x={x} y={50} width="24" height="24" rx="6" fill="#fff" fillOpacity="0.38" />
          <rect x={x + 5} y={79} width="14" height="3" rx="1.5" fill="#fff" fillOpacity="0.6" />
        </g>
      ))}
      {cols.map((x, i) =>
        i === 0 ? null : (
          <g key={`b${i}`}>
            <rect x={x} y={92} width="24" height="24" rx="6" fill="#fff" fillOpacity="0.38" />
            <rect x={x + 5} y={121} width="14" height="3" rx="1.5" fill="#fff" fillOpacity="0.6" />
          </g>
        )
      )}
      <g filter="url(#install-shadow)">
        <AppIcon x={66} y={92} s={24} />
      </g>
      <text x="78" y="126" textAnchor="middle" fontSize="6.5" fontWeight="600" fill="#fff">
        RANGE
      </text>
      <Pulse x={63} y={89} w={30} h={30} r={8} />
    </Scene>
  )
}

// 2 (iOS 26+) — the «⋯» button in the floating bar and its menu's «Share».
function ArtNewMenu() {
  const cy = 150
  return (
    <Scene
      kind="bottom"
      over={
        <>
          <g filter="url(#install-shadow)">
            <rect x="96" y="56" width="88" height="66" rx="13" fill="#fff" />
          </g>
          <rect x="102" y="62" width="76" height="22" rx="8" fill="var(--accent-soft)" />
          <text x="110" y="76" fontSize="8" fontWeight="600" fill={INK}>
            {tn('install.lblShare')}
          </text>
          <ShareGlyph cx={168} cy={73} color={INK} />
          <Bars x={110} y={95} widths={[56, 44]} gap={9} color="#D5D6DB" />
          <circle className="install-pulse" cx="170" cy={cy} r="13" fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth="2.5" />
        </>
      }
    >
      <rect x="55" y="-233" width="130" height="400" fill="#F2F2F7" />
      <AppIcon x={104} y={28} s={30} />
      <Bars x={78} y={70} widths={[84, 60]} />
      <circle cx="72" cy={cy} r="11" fill="#fff" filter="url(#install-shadow)" />
      <path d={`M75 ${cy - 4.5} L70 ${cy} L75 ${cy + 4.5}`} stroke={INK} {...stroke} />
      <rect x="87" y={cy - 11} width="66" height="22" rx="11" fill="#fff" filter="url(#install-shadow)" />
      <text x="120" y={cy + 2.8} textAnchor="middle" fontSize="7.5" fill={INK}>
        {HOST}
      </text>
      <circle cx="170" cy={cy} r="11" fill="#fff" filter="url(#install-shadow)" />
      {[-4.5, 0, 4.5].map((dx) => (
        <circle key={dx} cx={170 + dx} cy={cy} r="1.2" fill={INK} />
      ))}
    </Scene>
  )
}

// 3 (iOS 26+) — the share sheet: apps on top, actions below, «Show More» to press.
function ArtNewMore() {
  const [l1, l2] = twoLines(tn('install.lblShowMore'))
  return (
    <Scene
      kind="mid"
      over={
        <>
          <g filter="url(#install-shadow)">
            <rect x="124" y="108" width="62" height="58" rx="13" fill="#fff" />
          </g>
          <circle cx="155" cy="125" r="11" fill="#EFEFF4" />
          <path d="M150.5 123 L155 127.5 L159.5 123" stroke={INK} {...stroke} />
          <text x="155" y="148" textAnchor="middle" fontSize="6.6" fill={INK}>
            {l1}
          </text>
          <text x="155" y="157" textAnchor="middle" fontSize="6.6" fill={INK}>
            {l2}
          </text>
          <Pulse x={124} y={108} w={62} h={58} r={13} />
        </>
      }
    >
      <rect x="55" y="-100" width="130" height="500" fill="#D5D7DD" />
      <rect x="60" y="6" width="120" height="176" rx="12" fill="#E7E8ED" />
      <AppIcon x={68} y={14} s={22} />
      <Bars x={96} y={20} widths={[46, 30]} gap={7} color="#C2C4CB" />
      {['#2F7BF0', '#3C9BF2', '#F2C94C', '#FFFFFF'].map((c, i) => (
        <g key={c}>
          <rect x={66 + i * 28} y={52} width="22" height="22" rx="6" fill={c} fillOpacity="0.8" />
          <rect x={69 + i * 28} y={79} width="16" height="3" rx="1.5" fill="#C2C4CB" />
        </g>
      ))}
      <rect x="66" y="94" width="108" height="0.8" fill="#D2D3D8" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle cx={78 + i * 24} cy={118} r="9" fill="#D6D7DC" />
          <rect x={70 + i * 24} y={133} width="16" height="3" rx="1.5" fill="#C2C4CB" />
        </g>
      ))}
    </Scene>
  )
}

// 5 (iOS 26+) — «Open as Web App» switch and the Add button.
function ArtNewAdd() {
  return (
    <Scene
      kind="top"
      over={
        <>
          <rect x="38" y="112" width="164" height="30" rx="15" fill="#fff" filter="url(#install-shadow)" />
          <text x="53" y="130" fontSize="7.4" fontWeight="500" fill={INK}>
            {tn('install.lblWebApp')}
          </text>
          <rect x="168" y="120" width="27" height="14" rx="7" fill="#34C759" />
          <circle cx="188" cy="127" r="5.5" fill="#fff" />
          <Pulse x={38} y={112} w={164} h={30} r={15} />
        </>
      }
    >
      <rect x="55" y="16" width="130" height="200" fill="#F2F2F7" />
      <circle cx="70" cy="44" r="8" fill="#fff" />
      <path d="M67 41 L73 47 M73 41 L67 47" stroke={INK} {...stroke} />
      <rect x="138" y="35" width="44" height="18" rx="9" fill={BLUE} />
      <text x="160" y="47" textAnchor="middle" fontSize="7.8" fontWeight="700" fill="#fff">
        {tn('install.lblAdd')}
      </text>
      <rect x="62" y="62" width="116" height="44" rx="9" fill="#fff" />
      <AppIcon x={70} y={69} s={28} />
      <text x="106" y="82" fontSize="9.5" fontWeight="700" fill={INK}>
        RANGE
      </text>
      <text x="106" y="95" fontSize="6.2" fill="#8E8E93">
        {HOST}
      </text>
      <Bars x={66} y={152} widths={[100, 72]} gap={7} />
      <Pulse x={138} y={35} w={44} h={18} r={9} />
    </Scene>
  )
}

// Telegram's Mini App header: «Close» left, the app's name, «⋯» right.
function TgHeader({ pulse }: { pulse: boolean }) {
  return (
    <>
      <rect x="55" y="16" width="130" height="200" fill="#F2F2F7" />
      <rect x="55" y="16" width="130" height="36" fill="#fff" />
      <text x="63" y="38" fontSize="7.5" fill={BLUE}>
        {tn('common.close')}
      </text>
      <text x="120" y="32" textAnchor="middle" fontSize="8" fontWeight="700" fill={INK}>
        RANGE
      </text>
      <text x="120" y="42" textAnchor="middle" fontSize="5.5" fill="#8E8E93">
        {tn('install.lblMiniApp')}
      </text>
      <circle cx="170" cy="34" r="10" fill="#EDEDF1" />
      {[-4.5, 0, 4.5].map((dx) => (
        <circle key={dx} cx={170 + dx} cy="34" r="1.2" fill={INK} />
      ))}
      {pulse && <circle className="install-pulse" cx="170" cy="34" r="12" fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth="2.5" />}
    </>
  )
}

// 1 (Telegram) — the «⋯» at the top right of the Mini App.
function ArtTgDots() {
  return (
    <Scene kind="top">
      <TgHeader pulse />
      <AppIcon x={104} y={72} s={32} />
      <Bars x={78} y={118} widths={[84, 60]} />
    </Scene>
  )
}

// 2 (Telegram) — its menu, «Add to Home Screen» lifted out of the blur.
function ArtTgAdd() {
  return (
    <Scene
      kind="top"
      over={
        <>
          <rect x="38" y="82" width="164" height="28" rx="14" fill="#fff" filter="url(#install-shadow)" />
          <text x="52" y="99.5" fontSize="7.8" fontWeight="500" fill={INK}>
            {tn('install.lblTgAdd')}
          </text>
          <rect x="178" y="90.5" width="11" height="11" rx="2.5" fill="none" stroke={INK} strokeWidth="1.2" />
          <path d="M183.5 93.5 v5 M181 96 h5" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
          <Pulse x={38} y={82} w={164} h={28} r={14} />
        </>
      }
    >
      <TgHeader pulse={false} />
      <rect x="64" y="56" width="120" height="116" rx="12" fill="#fff" filter="url(#install-shadow)" />
      {[66, 118, 144].map((y) => (
        <g key={y}>
          <Bars x={74} y={y + 6} widths={[66]} color="#D5D6DB" />
          <rect x="164" y={y + 3} width="10" height="10" rx="2.5" fill="#D5D6DB" />
        </g>
      ))}
    </Scene>
  )
}

type Step = { art: ReactNode; text: string; note?: string }

function stepsFor(version: Version): Step[] {
  const home = { art: <ArtHomeScreen />, text: tn('install.doneCap') }
  if (version === 'old') {
    return [
      { art: <ArtOpenSafari />, text: tn('install.iosOpen'), note: tn('install.iosOpenNote') },
      { art: <ArtOldShare />, text: tn('install.iosOldShare') },
      { art: <ArtSheetRow label={tn('install.lblHomeOld')} />, text: tn('install.iosOldHome') },
      { art: <ArtOldAdd />, text: tn('install.iosOldAdd') },
      home,
    ]
  }
  return [
    { art: <ArtOpenSafari />, text: tn('install.iosOpen'), note: tn('install.iosOpenNote') },
    { art: <ArtNewMenu />, text: tn('install.iosNewShare') },
    { art: <ArtNewMore />, text: tn('install.iosNewMore') },
    { art: <ArtSheetRow label={tn('install.lblHomeNew')} />, text: tn('install.iosNewHome') },
    { art: <ArtNewAdd />, text: tn('install.iosNewAdd') },
    home,
  ]
}

function Cards({ steps, cardKey }: { steps: Step[]; cardKey: string }) {
  return (
    <div className="install-cards">
      {steps.map((s, i) => (
        <div className="install-card" key={`${cardKey}-${i}`}>
          <div className="install-shot">{s.art}</div>
          <div className="install-cap">
            <div className="install-cap-title">{i === steps.length - 1 ? tn('install.done') : tn('install.step', { n: i + 1 })}</div>
            <p>{s.text}</p>
            {s.note && <p className="install-cap-note">{s.note}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

export function TelegramInstallGuide() {
  const steps: Step[] = [
    { art: <ArtTgDots />, text: tn('install.tgS1') },
    { art: <ArtTgAdd />, text: tn('install.tgS2'), note: tn('install.tgNote') },
    { art: <ArtHomeScreen />, text: tn('install.doneCap') },
  ]
  return <Cards steps={steps} cardKey="tg" />
}

export function IosInstallGuide() {
  // iOS 26 Safari still calls itself 18.x in its user agent, so the version
  // can't be read; the newer flow is first since most phones are on it by now.
  const [version, setVersion] = useState<Version>('new')
  const steps = stepsFor(version)

  return (
    <div>
      <div className="install-tabs install-tabs-sub" role="tablist">
        {(['old', 'new'] as const).map((v) => (
          <button key={v} role="tab" aria-selected={version === v} className={`install-tab${version === v ? ' on' : ''}`} onClick={() => setVersion(v)}>
            {v === 'old' ? tn('install.tabIosOld') : tn('install.tabIos26')}
          </button>
        ))}
      </div>
      <Cards steps={steps} cardKey={version} />
    </div>
  )
}
