// «Ежедневная награда ждёт» as a chat widget: the app's daily reward sheet
// (RewardsModal DailyTab, in the glass look of nav-glass.css) without its coin
// and ring of dots (owner's choice 17.11) — «Ежедневная награда», «4 из 10 · день серии», the «Серия 10 дней» card with the days in two
// rows of five (taken ones ticked in orange, today's orange and pulsing, the
// tenth outlined) and the hint under it. The reward is taken in the app (the
// button under the message), as in the sheet's «Забрать».
//
// Not like the app: no coin and ring of dots at the top (removed on the owner's
// word), the system font.

import { translate, type Lang, type TKey } from '@/lib/i18n/core'
import { pack, jsonForScript } from './core'
import { MIN_JS } from './min.generated'

const CSS = `
body{margin:0}
.dl{padding:16px 14px 14px;font:15px/1.35 system-ui,sans-serif;color:#17181B;text-align:center;background:radial-gradient(120% 90% at 50% 0%,rgba(252,82,0,.06) 0%,rgba(252,82,0,0) 72%),#fff}
.ti{font-size:19px;font-weight:800}
.tm{display:flex;flex-direction:column;align-items:center;gap:5px;margin:12px 0 16px}
.tm b{font-size:30px;line-height:1;font-weight:800;font-variant-numeric:tabular-nums}
.tm small{margin-left:2px;font-size:15px;font-weight:800;color:#A8A9AE}
.tm span{font-size:12.5px;color:#A8A9AE}
.wh{padding:14px 14px 15px;border-radius:20px;background:linear-gradient(180deg,#FFFFFF 0%,#F4F5F8 100%);box-shadow:0 1px 0 #fff inset,0 0 0 1px rgba(23,24,27,.06),0 4px 12px rgba(23,24,27,.06);text-align:left}
.kk{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#A8A9AE}
.sr{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:12px}
.ce{height:42px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:13.5px;font-weight:800;color:#6B6D76;font-variant-numeric:tabular-nums;background:linear-gradient(180deg,#FFFFFF 0%,#F1F2F6 100%);box-shadow:0 1px 0 #fff inset,0 0 0 1px rgba(23,24,27,.06),0 2px 6px rgba(23,24,27,.06)}
.ce.z{background:linear-gradient(180deg,#FFFFFF 0%,#FFEFE2 100%);color:#FC5200;box-shadow:0 1px 0 #fff inset,0 0 0 1.5px rgba(252,82,0,.4)}
.ce.d{background:linear-gradient(180deg,#FFF4EC 0%,#FFE6D6 100%);color:#FC5200;box-shadow:0 1px 0 #fff inset,0 0 0 1px rgba(252,82,0,.16)}
.ce.c{background:linear-gradient(160deg,#FF8A3D,#FC5200);color:#fff;box-shadow:0 1px 0 rgba(255,255,255,.35) inset,0 4px 12px rgba(252,82,0,.32);animation:pu 1.8s ease-in-out infinite}
.nt{margin:10px 4px 2px;font-size:12px;line-height:1.4;color:#A8A9AE}
@keyframes pu{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
`

const JS = `
var W=window.TelegramWidget,S=__S__,D={},i,st='';
try{D=JSON.parse(W&&W.chatData||'{}')||{}}catch(e){}
var a=D.a||[10,15,20,25,30,35,40,50,60,100],t=Math.max(1,Math.min(10,+D.d||1));
for(i=0;i<10;i++){var k=i+1<t?'d':i+1===t?'c':i===9?'z':'';
st+='<div class="ce '+k+'">'+(k==='d'?'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>':a[i])+'</div>'}
document.getElementById('r').innerHTML='<div class="dl">'+'<div class="ti">'+S.ti+'</div><div class="tm"><b>'+t+'<small>'+S.of+'</small></b><span>'+S.sd+'</span></div><div class="wh"><div class="kk">'+S.sk+'</div><div class="sr">'+st+'</div></div><div class="nt">'+(D.b?S.br:S.hi)+'</div></div>';
`

const KEYS = { ti: 'daily.title', of: 'daily.ofTen', sd: 'daily.streakDay', sk: 'daily.streakTitle', hi: 'daily.hint', br: 'daily.broken' } as const satisfies Record<string, TKey>

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function dailyWidgetHtml(lang: Lang): string {
  const strings = Object.fromEntries(Object.entries(KEYS).map(([k, key]) => [k, esc(translate(lang, key))]))
  return pack(CSS, '<div id="r"></div>', (MIN_JS.daily || JS).replace('__S__', jsonForScript(strings)))
}

// day: today's day of the run (1–10, the one to take); amounts: _daily_reward_amounts(); broken: the run restarted.
export function dailyChatData(day: number, amounts: number[], broken: boolean): string {
  return JSON.stringify({ d: day, a: amounts.slice(0, 10), b: broken ? 1 : 0 })
}

export const DAILY_SOURCE_JS = JS
