// The week's rating as a chat widget, for «Тебя обогнали в рейтинге недели»
// (rating_overtaken, this week) and «Итоги недели» (weekly_result, last week).
// Both are the app's rating screens (WeeklyLeaderboard / LastWeekScreen): the
// week badge, the podium 2–1–3 — the avatar with its medal-coloured glow, the
// crown on the first, the medal with the place, the name, «N секторов» in
// orange and the catches under it; the first floats over its shadow — then
// the rows: place, avatar, name with «Ты», sectors and catches, the player's
// own row tinted. For last week the podium comes up 3rd → 2nd → 1st with the
// hexagon confetti, as on LastWeekScreen. The places are counted when the
// message is sent, by the same rule as get_weekly_leaderboard.
//
// Not like the app, because a widget can't: avatars as initials (no photos),
// no clan crests by the names, a smaller podium (a chat bubble is narrower),
// the system font.

import { translate, type Lang, type TKey } from '@/lib/i18n/core'
import { pack, jsonForScript, clipBytes } from './core'
import { MIN_JS } from './min.generated'

export type RatingRow = { rank: number; name: string; sectors: number; catches: number; me: boolean }
export type RatingWidgetData = {
  lastWeek: boolean
  // «Ноябрь, 3 неделя».
  weekLabel: string
  top: RatingRow[]
  // Rows under the podium: around the player this week, the player's own place last week.
  rows: RatingRow[]
}

const CSS = `
body{margin:0}
.rt{position:relative;padding:14px 12px 12px;font:15px/1.35 system-ui,sans-serif;color:#17181B;background:#fff;overflow:hidden}
.hd{display:flex;align-items:center;justify-content:space-between;gap:8px}
.hd b{font-size:15px;font-weight:800}
.wb{font-size:11px;font-weight:800;letter-spacing:.3px;text-transform:uppercase;color:#FC5200;background:#FFE4D6;padding:5px 10px;border-radius:20px;white-space:nowrap}
.po{display:flex;align-items:flex-end;justify-content:center;gap:8px;padding:22px 0 18px}
.pi{display:flex;flex-direction:column;align-items:center;gap:7px;width:31%;min-width:0}
.r1{padding-bottom:14px}
.l .pi{opacity:0;animation:pp .5s cubic-bezier(.22,.85,.3,1.25) both}
.st{position:relative;display:flex;align-items:center;justify-content:center}
.aw{position:relative;display:flex;align-items:center;justify-content:center}
.r1 .aw{animation:fb 3s ease-in-out infinite}
.sd{position:absolute;left:50%;bottom:-6px;width:48px;height:9px;margin-left:-24px;background:radial-gradient(closest-side,rgba(23,24,27,.28),rgba(23,24,27,0));animation:sp 3s ease-in-out infinite}
.gl{position:absolute;left:-14px;top:-14px;right:-14px;bottom:-14px;border-radius:50%;filter:blur(10px);animation:gp 2.6s ease-in-out infinite}
.av{position:relative;border-radius:50%;background:#17181B;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;box-shadow:0 4px 10px rgba(23,24,27,.18)}
.pi .av{border:3px solid #fff}
.md{position:absolute;bottom:-2px;right:-2px;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;border:2px solid #fff}
.cr{position:absolute;top:-11px;right:-3px;width:30px;height:25px;transform:rotate(22deg);filter:drop-shadow(0 2px 3px rgba(23,24,27,.25))}
.nm{font-weight:800;font-size:13px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.me .nm,.pi.me .nm{color:#FC5200}
.s1{font-weight:800;font-size:13px;color:#FC5200}
.s2{font-size:11px;color:#A8A9AE;margin-top:-4px}
.cd{border:1px solid #E7E5E0;border-radius:16px;overflow:hidden}
.rw{display:flex;align-items:center;gap:11px;padding:11px 12px}
.rw+.rw{border-top:1px solid #E7E5E0}
.rw.me{background:#FFE4D6}
.rk{width:18px;flex:none;text-align:center;font-weight:800;font-size:13.5px;color:#A8A9AE}
.rw .nm{flex:1;min-width:0;font-weight:700;font-size:14.5px;color:#17181B}
.tg{font-size:10.5px;font-weight:800;color:#FC5200;background:rgba(252,82,0,.16);padding:3px 7px;border-radius:8px;margin-left:6px}
.rr{text-align:right;flex:none}
.cf{position:absolute;left:0;right:0;top:40px;height:0}
.cf svg{position:absolute;top:-10px;width:7px;height:6px;opacity:0;animation:cf 1.4s ease-in both}
@keyframes pp{0%{opacity:0;transform:translateY(14px) scale(.92)}70%{opacity:1;transform:translateY(-3px) scale(1.03)}100%{opacity:1;transform:none}}
@keyframes fb{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes sp{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(.7);opacity:.24}}
@keyframes gp{0%,100%{opacity:.22;transform:scale(.92)}50%{opacity:.55;transform:scale(1.06)}}
@keyframes cf{0%{opacity:0;transform:translateY(0) rotate(0)}12%{opacity:1}100%{opacity:0;transform:translateY(190px) rotate(200deg)}}
`

const JS = `
var W=window.TelegramWidget,S=__S__,D={},M=['','#F0A93E','#B8C0CC','#B06B36'];
try{D=JSON.parse(W&&W.chatData||'{}')||{}}catch(e){}
function e(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function pl(n,fs){var a=n%10,b=n%100;return n+' '+(S.lang==='ru'?(a===1&&b!==11?fs[0]:a>=2&&a<=4&&(b<12||b>14)?fs[1]:fs[2]):S.lang==='en'&&n===1?fs[0]:fs[2])}
function av(n,z){return '<div class="av" style="width:'+z+'px;height:'+z+'px;font-size:'+Math.round(z*.3)+'px">'+e((n||S.an).slice(0,2).toUpperCase())+'</div>'}
var L=D.l,p=D.p||[],h='',i,o=[p[1],p[0],p[2]],dl=[0,260,540];
if(p.length<2)o=p;
for(i=0;i<o.length;i++){var r=o[i];if(!r){h+='<div class="pi"></div>';continue}var k=r[0],z=k===1?76:62;
h+='<div class="pi'+(k===1?' r1':'')+(r[4]?' me':'')+'" style="animation-delay:'+dl[3-k]+'ms"><div class="st">'+(k===1?'<div class="sd"></div>':'')+'<div class="aw"><div class="gl" style="background:'+M[k]+'"></div>'
+(k===1?'<svg class="cr" viewBox="0 0 32 26"><path d="M4 11L9 15L16 4L23 15L28 11L26 21H6Z" fill="#F0A93E" stroke="#FFFCF5" stroke-width="1.5" stroke-linejoin="round"/><circle cx="9" cy="15" r="1.6" fill="#FFE7BE"/><circle cx="16" cy="4" r="1.8" fill="#FFE7BE"/><circle cx="23" cy="15" r="1.6" fill="#FFE7BE"/></svg>':'')
+av(r[1],z)+'<div class="md" style="background:'+M[k]+'">'+k+'</div></div></div><div class="nm">'+e(r[1])+'</div><div class="s1">'+pl(r[2],S.se)+'</div><div class="s2">'+pl(r[3],S.ca)+'</div></div>'}
var rw='',rs=D.r||[];
for(i=0;i<rs.length;i++){var q=rs[i];rw+='<div class="rw'+(q[4]?' me':'')+'"><div class="rk">'+q[0]+'</div>'+av(q[1],36)+'<div class="nm">'+e(q[1])+(q[4]?'<span class="tg">'+e(S.you)+'</span>':'')+'</div><div class="rr"><div class="s1">'+pl(q[2],S.se)+'</div><div class="s2" style="margin-top:1px">'+pl(q[3],S.ca)+'</div></div></div>'}
var cf='';if(L&&p.length>2)for(i=0;i<12;i++)cf+='<svg viewBox="0 0 2 1.73" style="left:'+(6+(i*37%88))+'%;animation-delay:'+(.5+(i*7%10)/25)+'s"><polygon points=".5,0 1.5,0 2,.87 1.5,1.73 .5,1.73 0,.87" fill="'+['#FC5200','#F0A93E','#B8C0CC','#B06B36'][i%4]+'"/></svg>';
document.getElementById('r').innerHTML='<div class="rt'+(L?' l':'')+'"><div class="hd"><b>'+e(L?S.lt:S.wt)+'</b><span class="wb">'+e(D.t)+'</span></div>'+(L?'<div class="cf">'+cf+'</div>':'')+'<div class="po">'+h+'</div>'+(rw?'<div class="cd">'+rw+'</div>':'')+'</div>';
`

const KEYS = { lt: 'weekly.lastTitle', wt: 'terr.tabRating', you: 'sector.you', an: 'common.angler' } as const satisfies Record<string, TKey>

const forms = (lang: Lang, key: TKey) => [1, 2, 5].map((n) => translate(lang, key, { count: n }))

export function ratingWidgetHtml(lang: Lang): string {
  const strings: Record<string, unknown> = Object.fromEntries(Object.entries(KEYS).map(([k, key]) => [k, translate(lang, key)]))
  strings.lang = lang
  strings.se = forms(lang, 'plural.sector')
  strings.ca = forms(lang, 'plural.catch')
  return pack(CSS, '<div id="r"></div>', (MIN_JS.rating || JS).replace('__S__', jsonForScript(strings)))
}

const row = (r: RatingRow, nameBytes: number) => [r.rank, clipBytes(r.name, nameBytes), r.sectors, r.catches, r.me ? 1 : 0]

export function ratingChatData(d: RatingWidgetData): string {
  const build = (nameBytes: number) => JSON.stringify({ l: d.lastWeek ? 1 : 0, t: clipBytes(d.weekLabel, 40), p: d.top.slice(0, 3).map((r) => row(r, nameBytes)), r: d.rows.slice(0, 4).map((r) => row(r, nameBytes)) })
  let out = build(48)
  if (new TextEncoder().encode(out).length > 1000) out = build(20)
  return out
}

export const RATING_SOURCE_JS = JS
