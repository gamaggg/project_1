// «Завтра хороший клёв» as a chat widget: the app's forecast sheet
// (BiteForecast.tsx ForecastSheet) for the day the message is about — the day
// tab with its signal bars, the big day score in its colour with the label,
// «Оценка на весь день · лучше всего …», the «обычный час / лучшее время» line,
// the weather icon and temperatures; «По часам»: the 1–5 axis with the dashed
// lines, 24 bars as tall as each hour's level and coloured by its score, the
// «лучшее» bracket, the cursor you drag with a finger, and the chosen hour's
// readout (score, air, wind with its arrow, pressure, wave or rain). The numbers
// are the app's own model (lib/forecast/bite.ts scoreForecast), counted when
// the message is sent.
//
// Not like the app, because a widget can't: one day instead of four tabs (the
// message is about one day), no «Что влияет на оценку» block (it does not fit
// in 4 KB with the rest), the system font.

import { translate, type Lang, type TKey } from '@/lib/i18n/core'
import { HPA_TO_MMHG, compassPoint, weatherKind, type ForecastDay } from '@/lib/forecast/bite'
import { pack, jsonForScript, clipBytes } from './core'
import { MIN_JS } from './min.generated'

const CSS = `
body{margin:0}
.fs{padding:14px 12px 12px;font:15px/1.35 system-ui,sans-serif;color:#17181B;background:#fff}
.kk{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#A8A9AE}
.tt{font-size:20px;font-weight:800;margin-top:1px}
.td{display:flex;align-items:center;gap:14px;margin-top:10px;padding:14px 16px;border-radius:18px}
.ts{display:flex;align-items:baseline;flex:0 0 auto;font-variant-numeric:tabular-nums}
.ts b{font-size:40px;line-height:1;font-weight:800}
.ts span{font-size:15px;font-weight:800;color:#A8A9AE}
.tx{flex:1;min-width:0}
.tl{font-size:16px;font-weight:800}
.tb{margin-top:3px;font-size:13px;font-weight:700;color:#6B6D76}
.ty{margin-top:5px;font-size:12px;font-weight:700;line-height:1.3;color:#A8A9AE}
.tw{display:flex;flex-direction:column;align-items:center;gap:2px;flex:0 0 auto;font-size:12.5px;font-weight:800;color:#6B6D76;font-variant-numeric:tabular-nums}
.tw small{font-size:11px;font-weight:700;color:#A8A9AE}
.bk{margin-top:10px;padding:12px 14px;border-radius:16px;background:#F7F6F2}
.bh{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.lb{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#A8A9AE}
.hn{font-size:11px;font-weight:700;color:#A8A9AE}
.cw{position:relative;margin-top:6px}
.ax{position:absolute;left:0;top:28px;bottom:0;width:16px}
.ax span{position:absolute;left:0;width:100%;transform:translateY(50%);text-align:center;font-size:10.5px;font-weight:800;line-height:1;color:#A8A9AE;font-variant-numeric:tabular-nums}
.ch{position:relative;height:120px;margin-left:20px;padding-top:28px;box-sizing:border-box;touch-action:none;cursor:ew-resize}
.br{display:grid;grid-template-columns:repeat(24,minmax(0,1fr));align-items:end;gap:2px;height:100%}
.br i{display:block;border-radius:3px 3px 1px 1px}
.gd{position:absolute;left:0;right:0;top:28px;bottom:0}
.gd i{position:absolute;left:0;right:0;height:0;border-top:1px dashed rgba(23,24,27,.13)}
.be{position:absolute;top:17px;height:7px;box-sizing:border-box;border:1.5px solid #FC5200;border-bottom:none;border-radius:4px 4px 0 0}
.be span{position:absolute;left:50%;bottom:9px;transform:translateX(-50%);font-size:10.5px;font-weight:800;letter-spacing:.03em;color:#FC5200;white-space:nowrap}
.cu{position:absolute;top:22px;bottom:-3px;width:2px;margin-left:-1px;border-radius:1px;background:#17181B;transition:left 70ms linear}
.cu:before{content:'';position:absolute;left:50%;top:-3px;width:8px;height:8px;margin-left:-4px;border-radius:50%;background:#17181B}
.ha{display:flex;justify-content:space-between;margin:4px 0 0 20px;font-size:10.5px;font-weight:700;color:#A8A9AE}
.hr{margin-top:12px;padding-top:12px;border-top:1px solid rgba(23,24,27,.08)}
.hh{display:flex;align-items:center;justify-content:space-between;gap:10px}
.hh>b{font-size:17px;font-weight:800;font-variant-numeric:tabular-nums}
.hs{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:800;white-space:nowrap}
.st{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:10px}
.st b{display:flex;align-items:center;gap:4px;font-size:15px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}
.st span{display:block;margin-top:2px;font-size:11px;font-weight:700;color:#A8A9AE}
`

const JS = `
var W=window.TelegramWidget,S=__S__,D={},C=['','#B4B7BF','#E08A3C','#D9A419','#4FAE5A','#17955A'];
try{D=JSON.parse(W&&W.chatData||'{}')||{}}catch(e){}
function e(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function f(s,o){return s.replace(/\\{(\\w+)\\}/g,function(x,k){return k in o?o[k]:x})}
function mx(a,b,p){var x=parseInt(a.slice(1),16),y=parseInt(b.slice(1),16),c=function(s){return Math.round((x>>s&255)*p+(y>>s&255)*(1-p))};return 'rgb('+c(16)+','+c(8)+','+c(0)+')'}
function hh(h){return(h%24<10?'0':'')+h%24+':00'}
function dec(n){return String(n).replace('.',S.lang==='en'?'.':',')}
function bars(s,z){var w=z/5.6,o='<svg width="'+z+'" height="'+z+'" viewBox="0 0 '+z+' '+z+'">';for(var n=1;n<6;n++){var h=z*(n+1)/6;o+='<rect x="'+(n-1)*w*1.15+'" y="'+(z-h)+'" width="'+w+'" height="'+h+'" rx="'+w/3+'" fill="'+(n<=s?C[s]:'rgba(23,24,27,.12)')+'"/>'}return o+'</svg>'}
function wi(k,z){var o='<svg width="'+z+'" height="'+z+'" viewBox="0 0 24 24">',sun='<circle cx="12" cy="12" r="4.2" fill="#F5B300"/>',ry='<path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" stroke="#F5B300" stroke-width="1.8" stroke-linecap="round"/>',
cl=function(x,y,c){return '<path transform="translate('+x+' '+y+')" d="M7.5 19h9.2a3.8 3.8 0 0 0 .3-7.6A5.2 5.2 0 0 0 7 12.3 3.4 3.4 0 0 0 7.5 19z" fill="'+c+'"/>'};
if(k==='c')o+=ry+sun;else if(k==='p')o+='<g transform="translate(-3 -3) scale(.8)">'+ry+sun+'</g>'+cl(1.5,1,'#C7CCD4');else if(k==='o')o+=cl(-2,-3,'#DADDE3')+cl(1,0,'#B9BFC8');
else if(k==='f')o+='<path d="M4 9h16M6 13h12M4 17h16" stroke="#AEB4BD" stroke-width="2" stroke-linecap="round"/>';
else{o+=cl(0,-4,k==='t'?'#8E96A3':'#AEB6C2');if(k==='r')o+='<path d="M8.5 18l-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5" stroke="#3E7BFA" stroke-width="1.8" stroke-linecap="round"/>';if(k==='t')o+='<path d="M12.8 15.5l-2.6 4h2.4l-1.2 3.5 3.8-5h-2.5l1.3-2.5z" fill="#F5B300"/>';if(k==='s')o+='<g fill="#8FB4F0"><circle cx="8.5" cy="19" r="1.2"/><circle cx="12.5" cy="20.5" r="1.2"/><circle cx="16.5" cy="19" r="1.2"/></g>'}
return o+'</svg>'}
var H=String(D.h||'').split(';').map(function(r){var a=r.split(',');return{l:+a[0],s:+a[1]||1,t:+a[2],w:+a[3],d:+a[4],p:+a[5],x:+a[6],k:a[7]||'c'}});
while(H.length<24)H.push({l:0,s:1,t:0,w:0,d:0,p:0,x:0,k:'c'});
var sc=+D.s||1,c=C[sc],bf=D.f>=0?D.f:-1,bt=D.t>=0?D.t:-1,hr=bf>=0?bf:12;
document.getElementById('r').innerHTML='<div class="fs"><div class="kk">'+e(D.k)+' \u00b7 '+e(D.dt)+'</div><div class="tt">'+e(S.ti)+'</div>'

+'<div class="td" style="background:'+mx(c,'#FAF9F6',.1)+';box-shadow:inset 0 0 0 1.5px '+mx(c,'#FFFFFF',.3)+'"><div class="ts"><b style="color:'+c+'">'+sc+'</b><span>/5</span></div><div class="tx"><div class="tl">'+e(S.sc[sc])+'</div><div class="tb">'+e(S.ds)+(bf>=0?'<br>'+e(f(S.bs,{from:hh(bf),to:hh(bt)})):'')+'</div>'
+(D.b&&(D.a!==sc||D.b!==sc)?'<div class="ty">'+e(f(S.typ,{avg:D.a,best:D.b}))+'</div>':'')+'</div><div class="tw">'+wi(D.c,30)+'<span>'+e(D.n)+'</span>'+(D.w!=null?'<small>'+e(f(S.wt,{value:D.w}))+'</small>':'')+'</div></div>'
+'<div class="bk"><div class="bh"><span class="lb">'+e(S.hs)+'</span><span class="hn">'+e(S.scr)+'</span></div><div class="cw"><div class="ax"></div><div class="ch">'
+(bf>=0?'<div class="be" style="left:'+bf/24*100+'%;width:'+(bt-bf)/24*100+'%"><span>'+e(S.bm)+'</span></div>':'')+'<div class="br"></div><div class="gd"><i style="bottom:20%"></i><i style="bottom:40%"></i><i style="bottom:60%"></i><i style="bottom:80%"></i></div><div class="cu"></div></div></div>'
+'<div class="ha"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div><div class="hr"></div></div></div>';
var q=function(s){return document.querySelector(s)},ax='',bs='';
for(var n=1;n<6;n++)ax+='<span data-n="'+n+'" style="bottom:'+(n-.5)/5*100+'%">'+n+'</span>';q('.ax').innerHTML=ax;
for(var h=0;h<24;h++)bs+='<i style="height:'+Math.max(6,H[h].l/5*100)+'%"></i>';q('.br').innerHTML=bs;
function pick(x){x=Math.max(0,Math.min(23,x));if(x===hr&&q('.hr').innerHTML)return;hr=x;var a=H[x],ac=C[a.s];
var ib=q('.br').children;for(var i=0;i<24;i++)ib[i].style.background=i===x?C[H[i].s]:mx(C[H[i].s],'#E9E6DF',.34);
var sp=q('.ax').children;for(i=0;i<5;i++){var on=i+1===a.s;sp[i].style.color=on?mx(C[i+1],'#17181B',.82):'';sp[i].style.transform='translateY(50%)'+(on?' scale(1.25)':'')}
q('.cu').style.left=(x+.5)/24*100+'%';
q('.hr').innerHTML='<div class="hh"><b>'+hh(x)+'</b><span class="hs" style="color:'+mx(ac,'#17181B',.78)+'">'+bars(a.s,14)+'<b>'+a.s+'/5</b>'+e(S.sc[a.s])+'</span></div><div class="st">'
+'<div><b>'+wi(a.k,20)+Math.round(a.t)+'\\u00b0</b><span>'+e(S.air)+'</span></div>'
+'<div><b><svg width="13" height="13" viewBox="0 0 12 12" style="transform:rotate('+(a.d*45+180)+'deg)"><path d="M6 1l4 9-4-2.2L2 10z" fill="currentColor"/></svg>'+e(f(S.ms,{value:dec(a.w)}))+'</b><span>'+e(f(S.wd,{dir:S.cp[a.d]||''}))+'</span></div>'
+'<div><b>'+a.p+'</b><span>'+e(S.pr)+'</span></div>'
+'<div><b>'+e(D.x?f(S.wv,{value:dec(a.x/10)}):f(S.mm,{value:dec(a.x/10)}))+'</b><span>'+e(D.x?S.wa:S.ra)+'</span></div></div>';
var hp=W&&W.HapticFeedback;if(hp&&dragging)try{hp.selectionChanged()}catch(z){}}
var dragging=false,ch=q('.ch');
function at(ev){var b=ch.getBoundingClientRect();pick(Math.floor((ev.clientX-b.left)/b.width*24))}
ch.addEventListener('pointerdown',function(ev){dragging=true;at(ev)});
ch.addEventListener('pointermove',function(ev){if(dragging)at(ev)});
ch.addEventListener('pointerup',function(){dragging=false});ch.addEventListener('pointercancel',function(){dragging=false});
q('.hr').innerHTML='';pick(hr);
`

const KEYS = {
  ti: 'forecast.title',
  ds: 'forecast.dayScore',
  bs: 'forecast.bestShort',
  typ: 'forecast.dayTypical',
  wt: 'forecast.waterShort',
  hs: 'forecast.hours',
  scr: 'forecast.scrub',
  bm: 'forecast.bestMark',
  air: 'forecast.statAir',
  wd: 'forecast.statWind',
  pr: 'forecast.statPressure',
  wa: 'forecast.statWave',
  ra: 'forecast.statRain',
  ms: 'forecast.msValue',
  mm: 'forecast.mmValue',
  wv: 'forecast.waveValue',
} as const satisfies Record<string, TKey>

const COMPASS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const
const KIND_LETTER: Record<ReturnType<typeof weatherKind>, string> = { clear: 'c', partly: 'p', cloudy: 'o', fog: 'f', rain: 'r', snow: 's', storm: 't' }

export function forecastWidgetHtml(lang: Lang): string {
  const strings: Record<string, unknown> = Object.fromEntries(Object.entries(KEYS).map(([k, key]) => [k, translate(lang, key)]))
  strings.lang = lang
  strings.sc = ['', ...[1, 2, 3, 4, 5].map((n) => translate(lang, `forecast.scores.s${n}` as TKey))]
  strings.cp = COMPASS.map((c) => translate(lang, `forecast.windShort.${c}` as TKey))
  // The sheet's «мм, давление» is for mmHg; English shows hPa.
  return pack(CSS, '<div id="r"></div>', (MIN_JS.forecast || JS).replace('__S__', jsonForScript(strings)))
}

const r1 = (n: number) => Math.round(n * 10) / 10

// One day of scoreForecast as the widget reads it (ASCII, ~700 bytes).
// kicker: the city or the sector id; dayLabel: «Завтра · 18 нояб.».
export function forecastChatData(day: ForecastDay, lang: Lang, kicker: string, dayLabel: string): string {
  const mm = lang !== 'en'
  const sea = day.hourly.some((h) => h.wave != null)
  const hours = day.hourly
    .slice(0, 24)
    .map((h) =>
      [
        r1(h.level),
        h.score,
        Math.round(h.temp),
        r1(h.wind),
        COMPASS.indexOf(compassPoint(h.windDir)),
        Math.round(mm ? h.pressureHpa * HPA_TO_MMHG : h.pressureHpa),
        Math.round(((sea ? h.wave : h.precip) ?? 0) * 10),
        KIND_LETTER[weatherKind(h.code)],
      ].join(',')
    )
    .join(';')
  return JSON.stringify({
    k: clipBytes(kicker, 40),
    dt: clipBytes(dayLabel, 40),
    s: day.score,
    a: day.avgScore,
    b: day.bestScore,
    f: day.best ? day.best.from : -1,
    t: day.best ? day.best.to : -1,
    n: `${Math.round(day.tempMin)}…${Math.round(day.tempMax)}°`,
    w: day.waterTemp != null ? Math.round(day.waterTemp) : null,
    c: KIND_LETTER[weatherKind(day.code)],
    x: sea ? 1 : 0,
    h: hours,
  })
}

// The template's source, for scripts/build-widgets.mjs (it writes min.generated.ts).
export const FORECAST_SOURCE_JS = JS
