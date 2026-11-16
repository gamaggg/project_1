// The clan battle as a chat widget: the app's race card (ClanRacePreview) with
// its river (RaceRiver) and the Pacu Jalur boats (RaceBoat) — the hull as long
// as the roster, the rowers with their headbands in the clan's second colour,
// the paddles, the leader at the bow swinging both arms, the reflection, the
// wake and the bow wave, the same 1.3 s stroke and the river flowing under it.
// The boats are drawn here in JS from the clan colours, at the app's scale
// rule (the longest crew takes at most half of the track). When the widget
// appears it asks the bot for the race as it is now, so an old message still
// shows today's positions.
//
// Not like the app, because the whole widget must fit in 4 KB compressed: the
// crest is a dot in the clan's two colours, no reflection under the hull, no
// wake or bow wave, no trail behind the boat, no «Старт / Финиш» over the river,
// the boats stand at their places at once instead of rowing in from the start,
// a finished clan only gets the gold place (no sparks or raised arms), the
// countdown in short units («6 д 14 ч»), the boat looks from the clan shop are
// not drawn (not in the live game yet), the system font.

import { translate, type Lang, type TKey } from '@/lib/i18n/core'
import { pack, jsonForScript, safeColor, clipBytes } from './core'
import { MIN_JS } from './min.generated'

export type RaceLane = {
  id: number
  name: string
  primary: string
  secondary: string
  meters: number
  finish: number
  rank: number
  finished: boolean
}

export type RaceWidgetData = {
  weekEnd: string
  myClanId: number | null
  clans: RaceLane[]
}

const CSS = `
body{margin:0}
.rc{position:relative;padding:16px 14px 14px;font:15px/1.35 system-ui,sans-serif;color:#fff;overflow:hidden;
 background:radial-gradient(120% 70% at 100% 0%,rgba(92,200,230,.28),rgba(92,200,230,0) 60%),linear-gradient(170deg,#12506A,#0A2C3C 70%)}
.hd{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:0 2px}
.k{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8FE1F5}
.ti{font-weight:800;font-size:17px;margin-top:3px}
.cd{display:flex;align-items:center;gap:5px;flex:0 0 auto;background:rgba(255,255,255,.12);border-radius:20px;padding:5px 10px 5px 8px;font-size:11px;font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}
.rv{position:relative;margin-top:14px;border-radius:16px;overflow:hidden;padding:22px 0 4px;background:linear-gradient(180deg,#1B7090,#145A75 55%,#10485F)}
.fi{position:absolute;top:0;bottom:0;right:0;width:12px;z-index:1;opacity:.9;background:conic-gradient(#fff 0 25%,#1B1D22 0 50%,#fff 0 75%,#1B1D22 0) 0 0/12px 12px}
.ln{position:relative;height:var(--lane);z-index:1}
.ln+.ln{background-image:radial-gradient(circle,rgba(255,255,255,.4) 1.3px,rgba(255,255,255,0) 1.6px);background-size:14px 3px;background-repeat:repeat-x}
.ln.me{background-color:rgba(255,255,255,.08)}
.rk{position:absolute;left:8px;top:50%;margin-top:-12px;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;background:rgba(0,0,0,.28);z-index:2}
.me .rk{background:#fff;color:#10485F}
.dn .rk{background:#E0A63A;color:#fff}
.yu{position:absolute;left:6px;bottom:3px;width:24px;text-align:center;font-size:8.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8FE1F5;z-index:3}
.tr{position:absolute;top:0;bottom:0;left:30px;right:calc(12px + var(--boat))}
.ps{position:absolute;left:0;top:0;right:0;bottom:0;transform:translateX(calc(var(--p) * 100%))}
.bb{position:absolute;left:0;bottom:2px;animation:bb 2.8s cubic-bezier(.77,0,.175,1) var(--b) infinite;transform-origin:50% 90%}
.bb svg{display:block;overflow:visible}
.bb *{stroke-linecap:round;stroke-linejoin:round}.sk{fill:#E8B98A}.hr{fill:#2A211C}.n{fill:none}.wo{stroke:#D9BE88;stroke-width:1.5}.lg{stroke:#E0731B;stroke-width:3}
.rm{fill:none;stroke:#C99557;stroke-width:2.6}.kn{fill:#EBBC4B;stroke:#9B6C1B;stroke-width:.7}.wa{fill:none;stroke:#fff;stroke-width:1}
.tg{position:absolute;left:0;bottom:100%;margin-bottom:1px;display:flex;align-items:center;gap:4px;white-space:nowrap;font-size:10px;font-weight:800;line-height:1}
.tg i{width:9px;height:9px;border-radius:50%;border:2px solid}
.pd,.le,.up,.sw{animation:pd 1.3s cubic-bezier(.77,0,.175,1) infinite alternate}.le{animation-name:le}.up{animation-name:up}.sw{animation-name:sw}
.bl{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;padding:0 2px;font-size:13px;color:rgba(255,255,255,.72);font-variant-numeric:tabular-nums}
.bl b{color:#fff;font-size:15px}
@keyframes bb{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-1.5px) rotate(1deg)}}
@keyframes pd{from{transform:skewX(-13deg)}to{transform:skewX(13deg)}}
@keyframes le{from{transform:skewX(2.5deg)}to{transform:skewX(-2.5deg)}}
@keyframes up{from{transform:translateY(0)}to{transform:translateY(-1.8px)}}
@keyframes sw{from{transform:rotate(65deg)}to{transform:rotate(-100deg)}}
`

// RaceBoat's geometry (boat units): BOAT_PITCH 13 per seat, BOAT_ENDS 52,
// BOAT_HEIGHT 54, keel 44, waterline 41, gunwale 30. The paddles, the bodies
// and the arms turn around their own pivots: each sits in a group moved to the
// pivot, so the animation needs no transform-origin.
const JS = `
var W=window.TelegramWidget,S=__S__,D={};
try{D=JSON.parse(W&&W.chatData||'{}')||{}}catch(e){}
function e(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function f(s,o){return s.replace(/\\{(\\w+)\\}/g,function(x,k){return k in o?o[k]:x})}
function sh(h,a){var n=parseInt(h.slice(1),16),t=a<0?0:255,q=Math.abs(a),c=function(v){return Math.round(v+(t-v)*q)};return '#'+((1<<24)|(c(n>>16&255)<<16)|(c(n>>8&255)<<8)|c(n&255)).toString(16).slice(1)}
function pl(n,fs){var a=n%10,b=n%100;return S.lang==='ru'?(a===1&&b!==11?fs[0]:a>=2&&a<=4&&(b<12||b>14)?fs[1]:fs[2]):S.lang==='en'&&n===1?fs[0]:fs[2]}
function num(n){return String(n).replace(/\\B(?=(\\d{3})+(?!\\d))/g,S.lang==='en'?',':'\\u00a0')}
function mt(m){return num(m)+'\\u00a0'+S.m}
function crew(fin){return Math.max(3,Math.min(60,Math.round(fin/200)))}
function g(fr,o){return fr.replace(/@Z/g,S.hd).replace(/@(\\w)/g,function(x,k){return o[k]})}
function tr(x,y,c){return '<g transform="translate('+x+' '+y+')">'+c+'</g>'}
function boat(id,p,s,cw){
var L=cw*13+52,hl=sh(p,.3),hd=sh(p,-.5),A=(cw%5)*.2,o={D:sh(p,-.4),S:s,H:hd,I:id,A:A,B:A+1.3},bo='',pa='',i,x,
pv=function(c,b){return tr(0,30,'<g class="'+c+'" style="animation-delay:-'+A+'s">'+tr(0,-30,b)+'</g>')};
for(i=0;i<cw;i++){x=24.5+i*13;o.J=i%2?p:sh(p,.35);bo+=tr(x,0,g(S.rw,o));pa+=tr(x,0,g(S.pa,o))}
var hp='M0 18Q5 31 18 30H'+(L-20)+'Q'+(L-6)+' 30 '+L+' 13Q'+(L+1)+' 34 '+(L-12)+' 44H14Q3 43 0 18Z',rim='M1 19Q5 31 18 30H'+(L-20)+'Q'+(L-6)+' 30 '+L+' 13',k=Math.max(1,Math.floor((L-26)/8)),wv='M10 41q4-2.2 8 0',be=L-30;
for(i=1;i<k;i++)wv+='t8 0';
return g(S.df,{I:id,L:hl,P:p,H:hd})
+pv('le',bo)+tr(L-17,0,g(S.ld,o))+'<path d="'+hp+'" fill="url(#'+id+'h)"/>'
+'<path d="M16 33.2H'+be+'" stroke="'+s+'" stroke-width="1.4" opacity=".9"/><path d="M16 40H'+be+'" stroke="'+s+'" stroke-width="1.1" opacity=".75"/>'
+'<path d="'+rim+'" class="rm"/><circle cy="18" r="2.7" class="kn"/><circle cx="'+L+'" cy="13" r="3.1" class="kn"/>'
+pv('pd',pa)+'<path d="'+wv+'L'+(L-12)+' 44H14Z" fill="#12607F" opacity=".5"/><path d="'+wv+'" class="wa" opacity=".55"/>'}
function cd(){var t=Math.floor(((+D.e||0)-Date.now())/6e4);if(t<0)return S.ended;var dd=Math.floor(t/1440),h=Math.floor(t%1440/60),o=function(k,n){return f(S[k],{count:n})};
return dd?o('dy',dd)+' '+o('hr',h):h?o('hr',h)+' '+o('mn',t%60):o('mn',t%60)}
function draw(){
var cs=(D.c||[]).slice(0,5),me=null,i;for(i=0;i<cs.length;i++)if(cs[i].i===D.me)me=cs[i];
document.getElementById('r').innerHTML='<div class="rc"><div class="hd"><div><div class="k"></div><div class="ti"></div></div><div class="cd"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg><span></span></div></div><div class="rv"></div><div class="bl"><span></span></div></div>';
var q=function(s){return document.querySelector(s)};
q('.k').textContent=S.wk;q('.cd span').textContent=cd();
q('.ti').textContent=me?me.x?f(S.fp,{place:f(S.pc,{rank:me.r})}):f(S.po,{rank:me.r,total:D.n||cs.length}):'';
q('.bl span').innerHTML=me?'<b>'+mt(me.m)+'</b> '+e(f(S.of,{total:mt(me.f)})):'';
var w=q('.rv').clientWidth||300,tk=Math.max(120,w-42),mx=3;for(i=0;i<cs.length;i++)mx=Math.max(mx,crew(cs[i].f));
var u=Math.max(.2,Math.min(62/80,.5*tk/(mx*13+52))),lh=Math.round(54*u)+18,h='';
for(i=0;i<cs.length;i++){var c=cs[i],cw=crew(c.f),L=cw*13+52,p=c.x?1:Math.max(0,Math.min(1,c.m/Math.max(1,c.f))),mine=me&&c.i===me.i;
h+='<div class="ln'+(mine?' me':'')+(c.x?' dn':'')+'" style="--lane:'+lh+'px;--boat:'+(L*u)+'px;--p:'+p+';--b:'+(i*-.7)+'s"><span class="rk">'+c.r+'</span><span class="tr"><span class="ps"><span class="bb"><span class="tg"><i style="background:'+c.p+';border-color:'+c.s+'"></i>'+e(f(pl(cw,S.pl),{count:cw}))+'</span><svg width="'+(L*u)+'" height="'+(54*u)+'" viewBox="0 0 '+L+' 54">'+boat('b'+i,c.p,c.s,cw)+'</svg></span></span></span>'+(mine?'<span class="yu">'+e(S.you)+'</span>':'')+'</div>'}
q('.rv').innerHTML=h+'<div class="fi"></div>'}
draw();
if(W&&W.request&&D.me)W.request('r:'+D.me).then(function(r){var o=null;try{o=JSON.parse(r&&r.result||'null')}catch(x){}if(o&&o.c){o.me=D.me;D=o;draw()}},function(){});
`

const KEYS = {
  wk: 'race.weekKicker',
  you: 'race.you',
  pc: 'race.place',
  po: 'race.placeOf',
  fp: 'race.finishPlace',
  of: 'race.of',
  ended: 'fmt.ended',
  m: 'fmt.m',
} as const satisfies Record<string, TKey>


// RaceBoat's pieces, worked out once here (the formulas are RaceBoat's: gunwale
// T = 30, waterline 41, head radius 4.2) and handed to the widget as markup with
// «@X» slots: J jersey, D jersey shadow, S second colour, H hull dark, I gradient
// id, A / B the stroke phase. A rower and its paddle are drawn at seat x = 0.
const n2 = (v: number) => String(Math.round(v * 100) / 100)
function headFrag(cx: number, cy: number, r: number): string {
  const p = (x: number, y: number) => `${n2(x)} ${n2(y)}`
  return (
    `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" class="sk"/>` +
    `<path d="M${p(cx - r, cy + r * 0.15)}A${n2(r)} ${n2(r)} 0 0 1 ${p(cx + r, cy - r * 0.05)}Q${p(cx + r * 0.2, cy - r * 0.55)} ${p(cx - r * 0.35, cy - r * 0.25)}Q${p(cx - r * 0.85, cy + r * 0.05)} ${p(cx - r, cy + r * 0.85)}Z" class="hr"/>` +
    `<path d="M${p(cx - r * 0.98, cy - r * 0.28)}Q${p(cx, cy - r * 0.62)} ${p(cx + r * 0.98, cy - r * 0.32)}" class="n" stroke="@S" stroke-width="${n2(r * 0.42)}"/>`
  )
}
const armFrag = (x: number, col: string, phase: 'A' | 'B', far: boolean) =>
  `<g transform="translate(${x} 18)"><g class="sw${far ? ' b' : ''}" style="animation-delay:-@${phase}s"><path d="M0 0V9.5" stroke="${col}" stroke-width="2.4"/><circle cy="10.2" r="1.8" fill="${col}"/></g></g>`
const BOAT_FRAGS = {
  hd: headFrag(0, 0, 4.2),
  rw: '<path d="M-.8 33L1.4 21" stroke="@D" stroke-width="6"/><path d="M-.2 33L2.2 21" stroke="@J" stroke-width="4.08"/>' + '<g transform="translate(2.6 17.22)">@Z</g>',
  pa: '<path d="M8 17L-3.2 39.5" class="wo"/><path d="M-1.6 35.9L-4.4 42.1Q-4.8 43.5-3.4 43.1L-.8 36.9Z" fill="@S" stroke="@H" stroke-width=".5"/>',
  ld:
    '<g class="up" style="animation-delay:-@As">' +
    armFrag(-1.5, '#C99A6B', 'B', true) +
    '<path d="M-1.6 29L-3.8 32.5M1.6 29L3.8 32.5" class="lg"/><path d="M-3.4 29L-2.6 17H2.6L3.4 29Z" fill="url(#@Ir)"/><path d="M-3 23.5H3" stroke="@H" stroke-width="1.2"/>' +
    armFrag(1.5, '#E8B98A', 'A', false) +
    '<g transform="translate(0 12.5) scale(.881)">@Z</g>' +
    '</g>',
  df: '<defs><linearGradient id="@Ih" x2="0" y2="1"><stop stop-color="@L"/><stop offset=".4" stop-color="@P"/><stop offset="1" stop-color="@H"/></linearGradient><linearGradient id="@Ir" x2="0" y2="1"><stop stop-color="#FFB547"/><stop offset="1" stop-color="#E0731B"/></linearGradient></defs>',
}

export function raceWidgetHtml(lang: Lang): string {
  const strings: Record<string, unknown> = { ...BOAT_FRAGS, ...Object.fromEntries(Object.entries(KEYS).map(([k, key]) => [k, translate(lang, key)])) }
  strings.lang = lang
  strings.dy = translate(lang, 'fmt.dayShort', { count: 0 }).replace('0', '{count}')
  strings.hr = translate(lang, 'fmt.hourShort', { count: 0 }).replace('0', '{count}')
  strings.mn = translate(lang, 'fmt.minShort', { count: 0 }).replace('0', '{count}')
  // «{count} игрок / игрока / игроков» with the number left in.
  strings.pl = [1, 2, 5].map((n) => translate(lang, 'race.warPlayers', { count: n }).replace(String(n), '{count}'))
  return pack(CSS, '<div id="r"></div>', (MIN_JS.race || JS).replace('__S__', jsonForScript(strings)))
}

// Up to five lanes, always with the player's clan (as ClanRacePreview).
export function raceLanes(clans: RaceLane[], myClanId: number | null): RaceLane[] {
  const all = [...clans].sort((x, y) => x.rank - y.rank)
  let lanes = all.slice(0, 5)
  const mine = all.find((c) => c.id === myClanId)
  if (mine && !lanes.some((c) => c.id === mine.id)) lanes = [...all.slice(0, 4), mine]
  return lanes
}

// The race as the widget reads it, from chatData or from the bot's answer (≤ 1024 bytes).
export function raceChatData(d: RaceWidgetData): string {
  const lanes = raceLanes(d.clans, d.myClanId)
  const pack1 = (nameBytes: number) =>
    JSON.stringify({
      e: Date.parse(d.weekEnd) || 0,
      me: d.myClanId,
      n: d.clans.length,
      c: lanes.map((c) => ({
        i: c.id,
        n: clipBytes(c.name, nameBytes),
        p: safeColor(c.primary, '#FC5200'),
        s: safeColor(c.secondary, '#FFE7C2'),
        m: Math.round(c.meters),
        f: Math.round(c.finish),
        r: c.rank,
        x: c.finished ? 1 : 0,
      })),
    })
  let out = pack1(48)
  if (new TextEncoder().encode(out).length > 1000) out = pack1(20)
  return out
}

// get_clan_race's clans → lanes.
export function lanesFromRace(clans: unknown): RaceLane[] {
  return ((clans as Record<string, unknown>[]) ?? []).map((c) => {
    const crest = (c.crest ?? {}) as Record<string, unknown>
    return {
      id: Number(c.id),
      name: String(c.name ?? ''),
      primary: safeColor(crest.primary, '#FC5200'),
      secondary: safeColor(crest.secondary, '#FFE7C2'),
      meters: Number(c.meters ?? 0),
      finish: Number(c.finish ?? 600),
      rank: Number(c.rank ?? 0),
      finished: !!c.finished_at,
    }
  })
}

// The template's source, for scripts/build-widgets.mjs (it writes min.generated.ts).
export const RACE_SOURCE_JS = JS
