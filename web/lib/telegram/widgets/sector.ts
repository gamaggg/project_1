// «Твой сектор отбили / атаковали» as a chat widget: the app's «Пока тебя не
// было» replay, cut down to what a widget may draw. On top the dark plaque of
// AwayReplay (.away-card: their face slams into yours, the burst, yours cracks
// and greys when the sector is lost or gets «−1» when it held); under it the
// victim's side of runSectorMoment (.smx steal / attack, victim): the catcher
// charges in from below-left and knocks your avatar off spinning, the new
// colour floods the hex, the ring and the white label, the defense marks; at the
// bottom what the sector is like now — as of sending, then refreshed by the
// bot's answer when the widget appears (the line is there from the start, so
// the widget keeps its height). The replay's explanation («Чтобы вернуть, лови в нём…») is the
// message caption under the widget, so it is not repeated inside. Timings are the app's: the plaque's
// own (.35–.95 s), the scene 700 ms after it (AwayReplay INTRO_MS) with the
// hit 400 ms later (MOMENT_HIT_AT).
//
// Not like the app, because a widget can't: the sector alone, large, on a plain
// ground instead of the map (owner's choice 17.11: one big sector, neutral background), avatars as initials (photos can't be
// loaded), the system font, the grey of a lost avatar made with colour and
// brightness (no grayscale filter), and the sector chip on the plaque drawn as
// a true hexagon next to the number.

import { translate, type Lang, type TKey } from '@/lib/i18n/core'
import { pack, jsonForScript, safeColor, clipBytes } from './core'
import { MIN_JS } from './min.generated'

export type SectorWidgetData = {
  kind: 'lost' | 'attacked'
  sectorId: string
  by: { name: string | null; color: string | null }
  me: { name: string | null; color: string | null }
  // Defense left after an attack (0–3); a lost sector ignores it.
  defense: number
  // «07:42» — when it happened, in the sector's city time.
  when: string
  // The sector when the message is sent (the line at the bottom shows it from the start, so the
  // widget never grows when the bot's fresher answer comes); null — not known.
  now?: { mine: boolean; name: string | null; defense: number } | null
}

const CSS = `
body{margin:0}
.w{position:relative;padding:10px;font:15px/1.35 system-ui,sans-serif;color:#17181B;overflow:hidden;
 background:radial-gradient(80% 70% at 50% 55%,#F3F4F0 0%,#E2E4DE 100%)}
.l{--a:#E24B4A;--g:rgba(226,75,74,.38);--b:rgba(226,75,74,.7);--h:rgba(226,75,74,.35)}
.t{--a:#F5A524;--g:rgba(245,165,36,.38);--b:rgba(245,165,36,.7);--h:rgba(245,165,36,.35)}
.c{position:relative;z-index:2;padding:12px 14px 14px;border-radius:22px;overflow:hidden;color:#fff;
 background:radial-gradient(120% 140% at 0% 0%,var(--g) 0%,rgba(0,0,0,0) 55%),repeating-linear-gradient(-45deg,rgba(255,255,255,.035) 0 10px,rgba(0,0,0,0) 10px 20px),linear-gradient(160deg,#1B1424 0%,#0E1220 100%);
 box-shadow:0 0 0 1.5px var(--b),0 0 28px var(--h);animation:dr .6s cubic-bezier(.2,1.25,.35,1) both,jo .4s ease-out .95s}
.tg{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:var(--a)}
.tg i{width:7px;height:7px;border-radius:50%;background:var(--a);animation:pu 1.4s ease-out infinite}
.rw{display:flex;align-items:center;gap:14px;margin-top:12px}
.du{position:relative;flex:none;width:84px;height:52px}
.f{position:absolute;top:50%;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#fff;font-weight:900}
.by{left:0;width:50px;height:50px;margin-top:-25px;z-index:2;font-size:16px;box-shadow:0 0 0 3px #15121F,0 0 0 5px var(--a),0 6px 16px rgba(0,0,0,.4);animation:ch .45s cubic-bezier(.5,0,.6,1.4) .35s both}
.me{right:0;width:38px;height:38px;margin-top:-19px;z-index:1;font-size:12px;animation:rc .5s ease-out .78s both}
.l .me{animation:rc .5s ease-out .78s both,gr .4s ease-out .9s both}
.ck{position:absolute;left:0;top:0;width:100%;height:100%;opacity:0;animation:fa .2s ease-out .85s both}
.mi{position:absolute;z-index:3;right:-6px;bottom:2px;padding:1px 5px;border-radius:999px;background:var(--a);color:#1B1424;font-size:10px;font-weight:900;opacity:0;animation:po .35s cubic-bezier(.2,1.6,.4,1) .9s both}
.bu{position:absolute;left:40px;top:50%;width:22px;height:22px;margin-top:-11px;z-index:3;fill:#FFD34D;stroke:#fff;stroke-width:1;filter:drop-shadow(0 0 6px rgba(255,190,40,.9));opacity:0;animation:bs .5s ease-out .74s both}
.tx{min-width:0}
.ti{font-size:19px;font-weight:900;line-height:1.12;letter-spacing:-.01em;animation:sl .4s ease-out .2s both}
.sb{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:13px;font-weight:600;color:rgba(255,255,255,.72);animation:sl .4s ease-out .3s both}
.sb svg{width:16px;height:14px;flex:none}
.sb b{color:#fff;font-weight:900;letter-spacing:.03em;margin-right:2px}
.wh{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.m{position:relative;height:230px}
.x{position:absolute;left:50%;top:56%;width:0;height:0;transform:scale(1.35)}
.hs{position:absolute;left:-60px;top:-60px;overflow:visible}
.ho{animation:sh .24s ease-in-out 1.1s,of .35s ease-out 1.4s both}
.t .ho{animation:none}
.fl{transform:scale(0);animation:fl .55s cubic-bezier(.2,.8,.3,1) 1.1s both}
.hn{opacity:0;animation:fa .3s ease-out 1.3s both}
.he{opacity:0;animation:eg .7s ease-out 1.1s both}
.rg{position:absolute;left:-52px;top:-52px;width:104px;height:104px;box-sizing:border-box;border-radius:50%;border:4px solid #E24B4A;opacity:0;animation:rg .8s cubic-bezier(.22,1,.36,1) 1.1s both}
.t .rg{border-width:3px}
.sf{position:absolute;left:-21px;top:-29px;width:42px;height:42px;box-sizing:border-box;border-radius:50%;overflow:hidden;border:3px solid;box-shadow:0 4px 14px rgba(23,24,27,.35);background:linear-gradient(160deg,#FF7A38,#FC5200 70%);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800}
.l .nw{animation:cg .6s cubic-bezier(.55,0,.75,.3) .7s both,ld .3s ease-out 1.3s forwards}
.l .ol{animation:kn .75s cubic-bezier(.15,.7,.3,1) 1.1s both}
.t .nw{animation:bo 1.15s .7s both}
.t .ol{animation:sg .7s ease-out 1.1s both}
.lb{position:absolute;left:0;top:-58px;transform:translate(-50%,-100%);display:flex;align-items:center;gap:6px;white-space:nowrap;background:#fff;color:#B42323;font-size:13px;font-weight:800;padding:6px 12px 6px 9px;border-radius:999px;box-shadow:0 6px 18px rgba(0,0,0,.18);opacity:0;animation:lb .38s ease-out 1.4s both}
.lb i{width:10px;height:10px;border-radius:50%}
.pp{position:absolute;left:0;top:23px;transform:translateX(-50%);display:flex;gap:4px;padding:4px 6px;border-radius:999px;background:rgba(255,255,255,.92);box-shadow:0 3px 10px rgba(0,0,0,.14);opacity:0;animation:fa .2s ease-out 1.5s both}
.pp span{width:14px;height:8px;border-radius:4px;background:#D9DADF}
.pp .g{animation:pi .32s ease-out 1.7s both}
.pp .z{animation:pl .6s ease-out 1.55s both}
.lv{position:relative;z-index:2;display:flex;align-items:center;gap:8px;padding:11px 14px;min-height:calc(2.6em + 22px);box-sizing:border-box;border-radius:16px;background:#fff;box-shadow:0 10px 28px rgba(0,0,0,.22);font-size:14px;font-weight:800;animation:fa .45s ease-out 2.6s both}
.lv.off{visibility:hidden}
.lv span{flex:1;min-width:0;line-height:1.3;max-height:2.6em;overflow:hidden}
.lv i{width:8px;height:8px;border-radius:50%;background:var(--a);flex:none}
.lv.ok{background:#E3F4E8;color:#1E7A39}.lv.ok i{background:#2FA84F}
@keyframes dr{from{opacity:0;transform:translateY(-130%) scale(.96)}to{opacity:1;transform:none}}
@keyframes pu{0%{box-shadow:0 0 0 0 var(--b)}100%{box-shadow:0 0 0 9px rgba(0,0,0,0)}}
@keyframes ch{0%{transform:translateX(-46px) scale(.7);opacity:0}70%{transform:translateX(10px) scale(1.06);opacity:1}100%{transform:none;opacity:1}}
@keyframes rc{0%{transform:none}30%{transform:translateX(9px) rotate(16deg)}100%{transform:translateX(3px) rotate(8deg)}}
@keyframes gr{to{background-color:#8A8C93;filter:brightness(.75)}}
@keyframes bs{0%{transform:scale(.2) rotate(-30deg);opacity:0}35%{transform:scale(1.35) rotate(10deg);opacity:1}100%{transform:scale(.9) rotate(20deg);opacity:0}}
@keyframes po{from{transform:scale(.3);opacity:0}to{transform:none;opacity:1}}
@keyframes jo{0%,100%{translate:0 0}20%{translate:-5px 0}45%{translate:4px 0}70%{translate:-2px 0}}
@keyframes sl{from{transform:translateX(12px);opacity:0}to{transform:none;opacity:1}}
@keyframes fa{from{opacity:0}to{opacity:1}}
@keyframes fl{to{transform:scale(1)}}
@keyframes of{to{opacity:0}}
@keyframes sh{0%,100%{transform:translate(0,0)}25%{transform:translate(-5px,2px)}50%{transform:translate(5px,-2px)}75%{transform:translate(-2px,1px)}}
@keyframes eg{0%{opacity:0}25%{opacity:1}100%{opacity:0}}
@keyframes rg{0%{transform:scale(.12);opacity:.85}100%{transform:scale(1.15);opacity:0}}
@keyframes cg{0%{transform:translate(-67.6px,57.2px) scale(.7);opacity:0}15%{opacity:1}66%{transform:translate(0,0) scale(1.15);opacity:1}100%{transform:translate(0,0) scale(1.22,.82);opacity:1}}
@keyframes ld{from{transform:scale(1.22,.82)}to{transform:scale(1)}}
@keyframes kn{0%{transform:translate(0,0) rotate(0) scale(1);opacity:1}100%{transform:translate(72.8px,-67.6px) rotate(420deg) scale(.4);opacity:0}}
@keyframes bo{0%{transform:translate(-67.6px,57.2px) scale(.7);opacity:0;animation-timing-function:cubic-bezier(.55,0,.75,.3)}10%{opacity:1}35%{transform:translate(-34px,4px) scale(1.05);opacity:1;animation-timing-function:ease-out}45%{transform:translate(-40px,4px) scale(.82,1.15)}100%{transform:translate(-52px,41.6px) rotate(-45deg) scale(.6);opacity:0}}
@keyframes sg{0%{transform:translate(0,0) rotate(0)}20%{transform:translate(12px,-2px) rotate(14deg)}45%{transform:translate(-4px,0) rotate(-6deg)}70%{transform:translate(2px,0) rotate(3deg)}100%{transform:translate(0,0) rotate(0)}}
@keyframes lb{0%{transform:translate(-50%,-60%) scale(.6);opacity:0}70%{transform:translate(-50%,-100%) scale(1.05);opacity:1}100%{transform:translate(-50%,-100%) scale(1);opacity:1}}
@keyframes pi{0%{transform:scale(.4);background:#D9DADF}60%{transform:scale(1.35);background:var(--p)}100%{transform:scale(1);background:var(--p)}}
@keyframes pl{0%{transform:scale(1);background:var(--p)}40%{transform:scale(1.4);background:#E24B4A}100%{transform:scale(1);background:#D9DADF}}
`

// Built in the widget from chatData, so one template serves every message.
const JS = `
var W=window.TelegramWidget,S=__S__,D={};
try{D=JSON.parse(W&&W.chatData||'{}')||{}}catch(e){}
var L=D.k!=='a',b=D.b||{},m=D.m||{},id=String(D.id||''),d=Math.max(0,Math.min(3,+D.d||0));
function e(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function f(s,o,r){return s.replace(/\\{(\\w+)\\}/g,function(x,k){return k in o?(r?String(o[k]):e(o[k])):x})}
function n2(n){return e((n||S.an).slice(0,2).toUpperCase())}
var bc=b.c||'#FC5200',mc=m.c||'#3E7BFA',tc=L?bc:mc,H='52,0 26,45 -26,45 -52,0 -26,-45 26,-45',lv=D.n||null;
function draw(){
var p='';for(var i=0;i<3;i++){var on=L?i<1:i<=d;p+='<span class="'+(L?(i<1?'g':''):(i===d?'z':''))+'" style="'+(on?'background:var(--p)':'')+'"></span>'}
document.getElementById('r').innerHTML='<div class="w '+(L?'l':'t')+'"><div class="c"><div class="tg"><i></i>'+e(S.tag)+'</div><div class="rw"><div class="du">'
+'<div class="f by" style="background:'+bc+'">'+n2(b.n)+'</div>'
+'<svg class="bu" viewBox="0 0 24 24"><path d="M12 1l2.6 6.4L21 5l-3.4 6 5.4 3.2-6.6.9L17 22l-5-4.6L7 22l.6-6.9L1 14.2 6.4 11 3 5l6.4 2.4z"/></svg>'
+'<div class="f me" style="background:'+mc+';box-shadow:0 0 0 2.5px #15121F,0 0 0 4px '+mc+'">'+n2(m.n)+(L?'<svg class="ck" viewBox="0 0 10 10"><path d="M0 0L10 10M10 0L0 10" stroke="#15121F" stroke-width="1.1"/></svg>':'')+'</div>'+(L?'':'<b class="mi">\\u22121</b>')+'</div>'
+'<div class="tx"><div class="ti">'+e(L?S.lt:S.at)+'</div><div class="sb"><svg viewBox="0 0 20 17.32"><polygon points="5,0 15,0 20,8.66 15,17.32 5,17.32 0,8.66" fill="'+tc+'" stroke="#fff" stroke-width="1.5"/></svg><b>'+e(id)+'</b><span class="wh">'+e(b.n||S.an)+(D.w?' \\u00b7 '+e(D.w):'')+'</span></div></div></div></div>'
+'<div class="m"><div class="x" style="--p:'+(L?bc:mc)+'"><svg class="hs" width="120" height="120" viewBox="-60 -60 120 120">'
+'<g class="ho"><polygon points="'+H+'" fill="'+mc+'" fill-opacity=".32" stroke="'+mc+'" stroke-opacity=".9" stroke-width="1.5"/></g>'
+(L?'<g class="fl"><polygon points="'+H+'" fill="'+bc+'" fill-opacity=".32"/></g><polygon class="hn" points="'+H+'" fill="none" stroke="'+bc+'" stroke-opacity=".9" stroke-width="1.5"/>'
:'<polygon class="he" points="'+H+'" fill="none" stroke="#E24B4A" stroke-width="3"/>')
+'</svg><span class="rg"></span><div class="sf ol" style="border-color:'+mc+'">'+n2(m.n)+'</div><div class="sf nw" style="border-color:'+(L?bc:'#E24B4A')+'">'+n2(b.n)+'</div>'
+'<div class="lb"><i style="background:'+(L?bc:'#E24B4A')+'"></i>'+f(L?S.ml:S.mh,{id:id})+'</div><div class="pp">'+p+'</div></div></div>'
+'<div class="lv off" id="lv"><i></i><span>\u00a0</span></div></div>';
if(lv)live(lv);
}
function live(o){lv=o;var el=document.getElementById('lv');if(!el)return;el.className='lv'+(o.m?' ok':'');el.querySelector('span').textContent=o.m?S.nm:f(S.nh,{name:o.n||S.an,defense:+o.d||0},1)}
draw();
if(W&&W.request&&id)W.request('s:'+id).then(function(r){var o=null;try{o=JSON.parse(r&&r.result||'null')}catch(e){}if(o)live(o)},function(){});
`

const KEYS = {
  tag: 'map.away.title',
  lt: 'map.away.lostTitle',
  at: 'map.away.attackedTitle',
  ml: 'map.moment.lost',
  mh: 'map.moment.hitBy',
  nm: 'tg.widget.nowMine',
  nh: 'tg.widget.nowHeld',
  an: 'common.angler',
} as const satisfies Record<string, TKey>

// The template — the same for every message in one language.
export function sectorWidgetHtml(lang: Lang): string {
  const strings = Object.fromEntries(Object.entries(KEYS).map(([k, key]) => [k, translate(lang, key)]))
  return pack(CSS, '<div id="r"></div>', (MIN_JS.sector || JS).replace('__S__', jsonForScript(strings)))
}

export function sectorChatData(d: SectorWidgetData): string {
  return JSON.stringify({
    k: d.kind === 'lost' ? 'l' : 'a',
    id: d.sectorId,
    b: { n: clipBytes(d.by.name ?? '', 60), c: safeColor(d.by.color, '#FC5200') },
    m: { n: clipBytes(d.me.name ?? '', 60), c: safeColor(d.me.color, '#3E7BFA') },
    d: d.defense,
    w: d.when,
    ...(d.now ? { n: d.now.mine ? { m: 1, d: d.now.defense } : { m: 0, n: clipBytes(d.now.name ?? '', 60), d: d.now.defense } } : {}),
  })
}

// The template's source, for scripts/build-widgets.mjs (it writes min.generated.ts).
export const SECTOR_SOURCE_JS = JS
