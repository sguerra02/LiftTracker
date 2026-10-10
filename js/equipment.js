/* Iron Ledger — Equipment and plate/load math */
import { S, ST, U, esc, fmtW, r2, toLb, touch } from './core.js';

/* ---------- equipment & load math ---------- */
let eqVer=0; const cache=new Map();
function eqChanged(){ eqVer++; cache.clear(); if(typeof touch==='function') touch(); }
function station(id){ return S.equipment.stations.find(s=>s.id===id); }
function stationOn(id){ const s=station(id); return !!(s&&s.on); }
function exById(id){ return S.exercises.find(e=>e.id===id)||{id,name:'(removed exercise)',load:'bodyweight',req:[],pattern:'core',inc:0}; }
function plateItems(div){ const out=[]; for(const p of S.equipment.plates){ const n=Math.floor((+p.qty||0)/div); for(let i=0;i<n;i++) out.push(p);} return out.filter(p=>+p.weight>0).sort((a,b)=>b.weight-a.weight); }
function better(a,b){ return a.length<b.length; }
function sideTable(div){
  const k='side|'+eqVer+'|'+div; if(cache.has(k)) return cache.get(k);
  let t=new Map([[0,[]]]);
  for(const it of plateItems(div)){ const nx=new Map(t); for(const [s,c] of t){ const ns=r2(s+ +it.weight), nc=c.concat(it), ex=nx.get(ns); if(!ex||better(nc,ex)) nx.set(ns,nc);} t=nx; }
  cache.set(k,t); return t;
}
function cost(o){ if(o.fixed) return 0; const p=o.side||o.stack||[]; return p.length; }
function loadOptions(ex){
  const k='opt|'+eqVer+'|'+ex.load; if(cache.has(k)) return cache.get(k);
  const E=S.equipment, out=[];
  if(ex.load==='barbell'){ for(const b of E.bars.filter(b=>b.kind==='barbell'&&+b.qty>0)) for(const [s,c] of sideTable(2)) out.push({w:r2(+b.weight+2*s),bar:b,side:c}); }
  else if(ex.load==='dumbbell'||ex.load==='dumbbell1'){
    const need=ex.load==='dumbbell'?2:1;
    for(const b of E.bars.filter(b=>b.kind==='dumbbell'&&+b.qty>=need)) for(const [s,c] of sideTable(need*2)) out.push({w:r2(+b.weight+2*s),bar:b,side:c});
    for(const f of E.fixed.filter(f=>+f.qty>=need)) out.push({w:r2(+f.weight),fixed:f});
  } else if(ex.load==='cable'){ for(const [s,c] of sideTable(1)) if(s>0) out.push({w:s,stack:c}); }
  const m=new Map(); for(const o of out){ const e=m.get(o.w); if(!e||cost(o)<cost(e)) m.set(o.w,o); }
  const arr=[...m.values()].sort((a,b)=>a.w-b.w); cache.set(k,arr); return arr;
}
function roundLoad(ex,t){ if(ex.load==='bodyweight') return Math.max(0,r2(t)); const o=loadOptions(ex); if(!o.length) return r2(t); let best=o[0]; for(const x of o){ if(Math.abs(x.w-t)<Math.abs(best.w-t)-1e-9) best=x; } return best.w; }
function snap5(ex,t){ return roundLoad(ex,Math.round(t/ST())*ST()); }
function roundDown(ex,t){ if(ex.load==='bodyweight') return Math.max(0,Math.round(t*2)/2); const o=loadOptions(ex); if(!o.length) return r2(t); let best=o[0]; for(const x of o) if(x.w<=t+0.01) best=x; return best.w; }
function stepUp(ex,w,inc){
  inc=+inc>0?+inc:+ex.inc; if(ex.load==='bodyweight'||!(inc>0)) return w;
  const c=loadOptions(ex).filter(o=>o.w>w+0.01); if(!c.length) return w;
  const within=c.filter(o=>o.w<=w+inc+0.01); return within.length?within[within.length-1].w:c[0].w;
}
function missing(ex){
  const m=[], E=S.equipment;
  for(const r of ex.req||[]) if(!stationOn(r)) m.push((station(r)||{name:r}).name.toLowerCase());
  if(ex.load==='barbell'&&!E.bars.some(b=>b.kind==='barbell'&&+b.qty>0)) m.push('a barbell');
  if(ex.load==='dumbbell'&&!E.bars.some(b=>b.kind==='dumbbell'&&+b.qty>=2)&&!E.fixed.some(f=>+f.qty>=2)) m.push('a pair of dumbbells');
  if(ex.load==='dumbbell1'&&!E.bars.some(b=>b.kind==='dumbbell'&&+b.qty>=1)&&!E.fixed.some(f=>+f.qty>=1)) m.push('a dumbbell');
  if(!m.length&&ex.load!=='bodyweight'&&!loadOptions(ex).length) m.push('plates');
  return m;
}
const avail=ex=>!missing(ex).length;
function unitW(ex,w){ if(ex.load==='bodyweight') return +w>0?'BW +'+fmtW(w)+' '+U():'Bodyweight'; return fmtW(w)+' '+U()+((ex.load==='dumbbell')?' each':''); }
function wtText(ex,t){ return t.kind==='W'?'TM '+fmtW(t.w)+' '+U():unitW(ex,t.w); }
function plateGfx(ps){ return '<span class="pg" aria-hidden="true">'+ps.map(p=>'<i style="height:'+Math.round(9+15*Math.sqrt(toLb(p.weight)/50))+'px"></i>').join('')+'</span>'; }
function loadHTML(ex,w){
  if(ex.load==='bodyweight') return '';
  const o=loadOptions(ex).find(o=>Math.abs(o.w-w)<0.01);
  if(!o){ const opts=loadOptions(ex); if(!opts.length) return '<span class="lw warn">No way to load this with your equipment</span>';
    return '<span class="lw warn">'+fmtW(w)+' can’t be loaded with your plates. Nearest is '+fmtW(roundLoad(ex,w))+'.</span>'; }
  if(o.fixed) return '<span class="lw">'+esc(o.fixed.name)+(ex.load==='dumbbell'?' ×2':'')+'</span>';
  const ps=o.side||o.stack||[];
  let lbl; if(o.side){ const nm=o.bar.kind==='barbell'?'bar':'handle'; lbl=ps.length?fmtW(o.bar.weight)+' '+nm+' + each side':'Empty '+nm; } else lbl='On the pin';
  return '<span class="lw"><span>'+lbl+'</span>'+(ps.length?plateGfx(ps)+'<span class="mono">'+ps.map(p=>fmtW(p.weight)).join(' · ')+'</span>':'')+'</span>';
}

export { plateGfx, avail, eqChanged, exById, loadHTML, loadOptions, missing, roundDown, roundLoad, snap5, station, stepUp, unitW, wtText };
