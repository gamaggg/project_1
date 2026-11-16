// A run of catches as a chat widget, the way «Активность» shows it
// (ActivityScreen CatchSeries): the angler's avatar, «Ольга поймала 3 рыбы»
// (or «… и захватил сектор»), «Сектор B1432 · Море», the species line
// («ставрида ×2 · скорпена»), when («Сегодня · 08:30–10:06»), the list of the
// catches — the fish tile in the species' category colours, the name with size
// and weight, the time — and the stack of tiles on the right. Used for:
//   follow_catch — a friend's run (the widget asks the bot for the run as it is
//     now, so one message shows the catches that came after it too);
//   «Ещё на рыбалке?» (lib/telegram/fishing.ts) — the player's own day.
//
// Not like the app, because a widget can't: the fish tiles show the fish mark
// instead of the photo, the avatar is a letter, the system font.

import { translate, type Lang, type TKey } from '@/lib/i18n/core'
import { CATEGORY_GRADIENT } from '@/lib/data/species'
import { pack, jsonForScript, clipBytes } from './core'
import { MIN_JS } from './min.generated'

export type SeriesCatch = { species: string; meta: string; time: string; category: keyof typeof CATEGORY_GRADIENT }
export type CatchSeriesData = {
  who: string
  sectorId: string | null
  // «Море», «Река»… (KIND_LABEL).
  kind: string | null
  claimed: boolean
  // «Сегодня · 08:30–10:06».
  when: string
  // Newest first.
  items: SeriesCatch[]
  // follow_catch: the catch the message is about, for the live request.
  catchId?: number
}

const CSS = `
body{margin:0}
.ac{display:flex;gap:13px;padding:14px 12px;font:15px/1.35 system-ui,sans-serif;color:#17181B;background:#fff}
.av{width:44px;height:44px;border-radius:50%;background:#3E7BFA;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;flex:none;box-shadow:0 4px 10px rgba(23,24,27,.18)}
.bd{flex:1;min-width:0}
.t1{font-size:14.5px;font-weight:700;line-height:1.35}
.t1 u{text-underline-offset:2px}
.t2{font-size:12.5px;color:#6B6D76;margin-top:2px}
.sp{font-size:12.5px;font-weight:600;color:#6B6D76;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wn{font-size:11.5px;color:#A8A9AE;margin-top:6px}
.ls{display:flex;flex-direction:column;gap:2px;margin-top:10px;padding-left:10px;border-left:2px solid #E7E5E0}
.it{display:flex;align-items:center;gap:10px;padding:5px 0}
.it.n{animation:in .4s cubic-bezier(.23,1,.32,1) both}
.ft{position:relative;flex:none;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:10px;box-shadow:0 6px 14px rgba(9,25,32,.22)}
.ft:after{content:'';position:absolute;left:0;top:0;right:0;bottom:0;background:radial-gradient(120% 100% at 20% 15%,rgba(255,255,255,.18),rgba(255,255,255,0) 55%)}
.tx{flex:1;min-width:0;font-size:13px;color:#6B6D76;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tx b{color:#17181B}
.tm{flex:none;font-size:11.5px;font-weight:600;color:#A8A9AE;font-variant-numeric:tabular-nums}
.th{position:relative;flex:none;width:64px;height:48px}
.th .ft{position:absolute;top:0;width:44px;height:44px;border-radius:13px}
@keyframes in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
`

const JS = `
var W=window.TelegramWidget,S=__S__,D={},seen=0;
try{D=JSON.parse(W&&W.chatData||'{}')||{}}catch(e){}
function e(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function f(s,o){return s.replace(/\\{(\\w+)\\}/g,function(x,k){return k in o?o[k]:x})}
function pl(n){var a=n%10,b=n%100,fs=S.fi;return n+' '+(S.lang==='ru'?(a===1&&b!==11?fs[0]:a>=2&&a<=4&&(b<12||b>14)?fs[1]:fs[2]):S.lang==='en'&&n===1?fs[0]:fs[2])}
function ft(c,z){return '<span class="ft" style="width:'+z+'px;height:'+z+'px;background:'+(S.g[c]||S.g.marine)+'"><svg width="'+Math.round(z*.4)+'" height="'+Math.round(z*.4)+'" viewBox="0 0 64 64" fill="none" stroke="#fff" stroke-width="2"><path d="M6 32c8-14 20-20 34-14-2 6-2 14 0 20-14 6-26 0-34-14z" fill="rgba(255,255,255,.1)"/><path d="M40 25c4-3 9-4 13-2-3 3-3 8 0 11-4 2-9 1-13-2" fill="rgba(255,255,255,.1)"/><circle cx="16" cy="29" r="1.7" fill="#fff" stroke="none"/></svg></span>'}
function draw(){
var it=D.i||[],n=it.length,cn={},sp=[],i,ls='',th='';
for(i=0;i<n;i++){var k=String(it[i][0]||S.fl).toLowerCase();cn[k]=(cn[k]||0)+1}
for(var k in cn)sp.push([k,cn[k]]);sp.sort(function(a,b){return b[1]-a[1]});
for(i=0;i<n;i++)ls+='<div class="it'+(seen&&i<n-seen?' n':'')+'">'+ft(it[i][3],36)+'<span class="tx"><b>'+e(it[i][0]||S.fl)+'</b>'+(it[i][1]?' \\u00b7 '+e(it[i][1]):'')+'</span><span class="tm">'+e(it[i][2])+'</span></div>';
for(i=Math.min(n,3)-1;i>=0;i--)th+=ft(it[i][3],44).replace('class="ft" style="','class="ft" style="left:'+i*10+'px;z-index:'+(3-i)+';');
document.getElementById('r').innerHTML='<div class="ac"><div class="av">'+e((D.w||S.an).slice(0,1))+'</div><div class="bd"><div class="t1"><u>'+e(D.w||S.an)+'</u> '+e(f(D.c?S.cc:S.ca,{fish:pl(n)}))+'</div>'
+(D.s?'<div class="t2"><u>'+e(f(S.tn,{id:D.s}))+'</u>'+(D.k?' \\u00b7 '+e(D.k):'')+'</div>':'')
+'<div class="sp">'+e(sp.map(function(x){return x[1]>1?x[0]+' \\u00d7'+x[1]:x[0]}).join(' \\u00b7 '))+'</div><div class="wn">'+e(D.t)+'</div><div class="ls">'+ls+'</div></div><div class="th">'+th+'</div></div>';
seen=n}
draw();
if(W&&W.request&&D.id)W.request('c:'+D.id).then(function(r){var o=null;try{o=JSON.parse(r&&r.result||'null')}catch(x){}if(o&&o.i&&o.i.length>(D.i||[]).length){o.id=D.id;D=o;draw()}},function(){});
`

const KEYS = { ca: 'activity.caught', cc: 'activity.caughtClaimed', tn: 'activity.territoryN', fl: 'activity.fishLower', an: 'common.angler' } as const satisfies Record<string, TKey>

export function catchesWidgetHtml(lang: Lang): string {
  const strings: Record<string, unknown> = Object.fromEntries(Object.entries(KEYS).map(([k, key]) => [k, translate(lang, key)]))
  strings.lang = lang
  strings.fi = [1, 2, 5].map((n) => translate(lang, 'plural.fish', { count: n }))
  strings.g = CATEGORY_GRADIENT
  return pack(CSS, '<div id="r"></div>', (MIN_JS.catches || JS).replace('__S__', jsonForScript(strings)))
}

export function catchesChatData(d: CatchSeriesData): string {
  const build = (max: number) =>
    JSON.stringify({
      w: clipBytes(d.who, 48),
      s: d.sectorId,
      k: d.kind,
      c: d.claimed ? 1 : 0,
      t: d.when,
      i: d.items.slice(0, max).map((c) => [clipBytes(c.species, 40), c.meta, c.time, c.category]),
      ...(d.catchId ? { id: d.catchId } : {}),
    })
  let out = build(12)
  for (let max = 11; new TextEncoder().encode(out).length > 1000 && max > 1; max--) out = build(max)
  return out
}

export const CATCHES_SOURCE_JS = JS
