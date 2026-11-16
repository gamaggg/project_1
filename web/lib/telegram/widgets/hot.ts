// «Горячие сектора недели» as a chat widget: the app's hot-sector tour
// (HotSectorsTour) on a piece of the map — the two neighbouring sectors in
// their holders' colours with the holders' avatars and the hot id labels
// (orange, the flame, the white ring — LeafletMap idLabelHtml), the glowing
// orange edge round the sector of the step, and the tour's own card under it:
// «Горячие сектора · 1 из 3», «B1432 — горячий сектор недели», the text with
// ×2, the end of the week and who holds it now; tap «Дальше» for the second
// sector and for «Удержи до конца воскресенья».
//
// Not like the app, because a widget can't: no map tiles under the sectors (a
// shore in two colours), avatars as initials, the sectors drawn side by side
// rather than at their real positions, the system font.

import { translate, type Lang, type TKey } from '@/lib/i18n/core'
import { HOT_FLAME_PATH } from '@/lib/map/hotFlame'
import { pack, jsonForScript, safeColor, clipBytes } from './core'
import { MIN_JS } from './min.generated'

export type HotSector = { id: string; holder: 'mine' | 'other' | 'free'; name: string | null; color: string | null }

const CSS = `
body{margin:0}
.ht{padding:10px;font:15px/1.35 system-ui,sans-serif;color:#17181B;background:linear-gradient(172deg,#CFE2EC,#D9E8EF 44%,#E7EBE1 44.6%,#EEF0E8)}
.mp{position:relative;height:170px}
.mp svg.h{position:absolute;left:50%;top:50%;width:240px;height:170px;margin:-85px 0 0 -120px;overflow:visible}
.eg{fill:none;stroke:#FF7A2F;stroke-width:3;stroke-linejoin:round;filter:drop-shadow(0 0 7px rgba(255,122,47,.9));animation:eg 1.3s ease-in-out .5s 2}
.pin{position:absolute;display:flex;flex-direction:column;align-items:center;gap:3px;transform:translate(-50%,-50%)}
.av{width:30px;height:30px;border-radius:50%;border:2.5px solid;background:linear-gradient(160deg,#FF7A38,#FC5200 70%);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;box-shadow:0 3px 8px rgba(23,24,27,.25)}
.lb{display:flex;align-items:center;gap:2px;padding:2px 6px 2px 4px;border-radius:7px;background:#FC5200;color:#fff;font-size:9.5px;font-weight:800;box-shadow:0 0 0 1.5px #fff,0 2px 8px rgba(252,82,0,.5)}
.tp{margin-top:6px;background:#fff;border-radius:18px;padding:16px 16px 12px;box-shadow:0 18px 40px rgba(0,0,0,.2)}
.kk{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#FC5200}
.tt{font-size:16.5px;font-weight:800;margin-top:4px;line-height:1.25}
.tx{font-size:13.5px;line-height:1.45;color:#6B6D76;margin-top:5px}
.ac{display:flex;justify-content:flex-end;margin-top:10px}
.nx{padding:9px 16px;border-radius:12px;background:#FC5200;color:#fff;font-size:14px;font-weight:800}
.in{animation:in .28s cubic-bezier(.23,1,.32,1) both}
@keyframes eg{50%{opacity:.35}}
@keyframes in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
`

// Two flat-top hexagons of radius 40, the second one up-right of the first (a real neighbour's place).
const JS = `
var W=window.TelegramWidget,S=__S__,D={},st=0;
try{D=JSON.parse(W&&W.chatData||'{}')||{}}catch(e){}
function e(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function f(s,o){return s.replace(/\\{(\\w+)\\}/g,function(x,k){return k in o?o[k]:x})}
var A=D.a||{},B=D.b,P=[[95,98],[155,63]];
function hp(c){var x=c[0],y=c[1];return (x+40)+','+y+' '+(x+20)+','+(y+34.6)+' '+(x-20)+','+(y+34.6)+' '+(x-40)+','+y+' '+(x-20)+','+(y-34.6)+' '+(x+20)+','+(y-34.6)}
function who(s){return s.h==='m'?S.hm:s.h==='o'?f(S.ho,{name:e(s.n||S.oa)}):S.hf}
function draw(){
var ss=B?[A,B]:[A],n=B?3:2,h='',pins='',i;
for(i=0;i<ss.length;i++){var s=ss[i],c=s.h==='f'?'#9AA0A6':(s.c||'#3E7BFA');
h+='<polygon points="'+hp(P[i])+'" fill="'+c+'" fill-opacity=".32" stroke="'+c+'" stroke-opacity=".9" stroke-width="1.5"/>';
pins+='<div class="pin" style="left:calc(50% + '+(P[i][0]-120)+'px);top:calc(50% + '+(P[i][1]-85)+'px)">'+(s.h==='f'?'':'<div class="av" style="border-color:'+c+'">'+e((s.h==='m'?S.me:s.n||S.oa).slice(0,2).toUpperCase())+'</div>')+'<div class="lb">'+S.fl+e(s.i)+'</div></div>'}
var on=st===2||!B?[0,1]:[st],eg='';for(i=0;i<on.length;i++)if(ss[on[i]])eg+='<polygon class="eg" points="'+hp(P[on[i]])+'"/>';
var t=st===0?[f(S.t1,{id:e(A.i)}),f(S.x1,{until:e(D.u),mult:2,extra:S.xn,holder:who(A)})]:st===1&&B?[f(S.t2,{id:e(B.i)}),f(S.x2,{a:e(A.i),until:e(D.u),mult:2,holder:who(B)})]:[S.t3,S.x3];
document.getElementById('r').innerHTML='<div class="ht"><div class="mp"><svg class="h" viewBox="0 0 240 170">'+h+eg+'</svg>'+pins+'</div>'
+'<div class="tp in"><div class="kk">'+f(S.kk,{index:st+1,total:n})+'</div><div class="tt">'+t[0]+'</div><div class="tx">'+t[1]+'</div>'+(st<n-1?'<div class="ac"><div class="nx">'+S.nx+'</div></div>':'')+'</div></div>';
var x=document.querySelector('.nx');if(x)x.addEventListener('click',function(){st++;draw()})}
draw();
`

const KEYS = {
  hm: 'hotTour.holderMine',
  ho: 'hotTour.holderOther',
  oa: 'hotTour.otherAngler',
  hf: 'hotTour.holderFree',
  t1: 'hotTour.title1',
  x1: 'hotTour.text1',
  xn: 'hotTour.extraNot',
  t2: 'hotTour.title2',
  x2: 'hotTour.text2',
  t3: 'hotTour.title3',
  x3: 'hotTour.text3',
  kk: 'hotTour.kicker',
  nx: 'common.next',
  me: 'sector.you',
} as const satisfies Record<string, TKey>

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function hotWidgetHtml(lang: Lang): string {
  const strings: Record<string, unknown> = Object.fromEntries(Object.entries(KEYS).map(([k, key]) => [k, esc(translate(lang, key))]))
  strings.fl = `<svg width="8" height="9" viewBox="3.9 4.85 16.2 18.3"><path fill="#fff" d="${HOT_FLAME_PATH}"/></svg>`
  return pack(CSS, '<div id="r"></div>', (MIN_JS.hot || JS).replace('__S__', jsonForScript(strings)))
}

const one = (s: HotSector) => ({ i: s.id, h: s.holder === 'mine' ? 'm' : s.holder === 'other' ? 'o' : 'f', n: clipBytes(s.name ?? '', 48), c: safeColor(s.color, '#3E7BFA') })

// until: «вс 23:59» (formatWeekdayTime in the sectors' city).
export function hotChatData(sectors: HotSector[], until: string): string {
  const [a, b] = sectors
  return JSON.stringify({ a: one(a), ...(b ? { b: one(b) } : {}), u: until })
}

export const HOT_SOURCE_JS = JS
