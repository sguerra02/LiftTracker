/* Iron Ledger — SVG line charts with drag-to-scrub */
import { $, DAY, S, U, esc, fmtD, fmtDL, fmtW, iso, parseISO, r2 } from './core.js';
import { exById } from './equipment.js';
import { bwPoints, fmtBig } from './fun.js';
import { activePlan, modeWeight } from './engine.js';
import { V } from './state.js';
import { sessionMetrics } from './views/history.js';
import { bestSet } from './views/report.js';
import { drawGoalCharts } from './views/goals.js';
import { autoSpw, paceW, project } from './views/projection.js';

/* ---------- charts ---------- */
function niceTicks(a,b,n){ const span=Math.max(b-a,1e-6); const raw=span/n; const mag=Math.pow(10,Math.floor(Math.log10(raw))); const st=[1,2,2.5,5,10].map(k=>k*mag).find(s=>s>=raw); const out=[]; let v=Math.floor(a/st)*st; while(v<b-1e-9){ out.push(r2(v)); v+=st; } out.push(r2(v)); return out; }
function lineChart(el,series,H,opts){
  opts=opts||{}; H=H||230; const W=Math.max(280,Math.floor(el.clientWidth||600)); const m={l:46,r:16,t:14,b:28};
  const all=series.flatMap(s=>s.pts); if(!all.length){ el.innerHTML='<p class="muted small">No data yet.</p>'; return; }
  let x0=Math.min(...all.map(p=>+p.x)), x1=Math.max(...all.map(p=>+p.x)); if(x1-x0<DAY){ x0-=3*DAY; x1+=3*DAY; }
  let y0=Math.min(...all.map(p=>p.y)), y1=Math.max(...all.map(p=>p.y)); const pad=(y1-y0)*.15||Math.max(5,y1*.1); y0=Math.max(0,y0-pad); y1+=pad;
  const tk=niceTicks(y0,y1,4); y0=tk[0]; y1=tk[tk.length-1];
  const X=x=>m.l+(x-x0)/(x1-x0)*(W-m.l-m.r), Y=y=>H-m.b-(y-y0)/(y1-y0)*(H-m.t-m.b);
  let s='<svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="Line chart">';
  for(const t of tk){ s+='<line x1="'+m.l+'" x2="'+(W-m.r)+'" y1="'+Y(t)+'" y2="'+Y(t)+'" stroke="var(--line)" stroke-width="1"/><text x="'+(m.l-8)+'" y="'+(Y(t)+4)+'" text-anchor="end" font-size="11" fill="var(--muted)" font-family="IBM Plex Mono,monospace">'+fmtW(t)+'</text>'; }
  const nx=Math.max(2,Math.min(5,Math.floor((W-m.l-m.r)/90)));
  for(let i=0;i<nx;i++){ const x=x0+(x1-x0)*i/(nx-1); const anc=i===0?'start':i===nx-1?'end':'middle'; s+='<text x="'+X(x)+'" y="'+(H-8)+'" text-anchor="'+anc+'" font-size="11" fill="var(--muted)">'+fmtD(new Date(x))+'</text>'; }
  const now=Date.now(); if(now>x0&&now<x1) s+='<line x1="'+X(now)+'" x2="'+X(now)+'" y1="'+m.t+'" y2="'+(H-m.b)+'" stroke="var(--line)" stroke-dasharray="2 3"/>';
  series.forEach((se,si)=>{ if(!se.pts.length) return; const p=se.pts.map(q=>X(+q.x).toFixed(1)+','+Y(q.y).toFixed(1));
    if(se.area&&se.pts.length>1) s+='<path d="M'+p.join(' L')+' L'+X(+se.pts[se.pts.length-1].x).toFixed(1)+','+(H-m.b)+' L'+X(+se.pts[0].x).toFixed(1)+','+(H-m.b)+' Z" fill="'+se.color+'" fill-opacity=".09"/>';
    s+='<path d="M'+p.join(' L')+'" fill="none" stroke="'+se.color+'" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round"'+(se.dash?' stroke-dasharray="6 5"':'')+'/>';
    if(se.dots) se.pts.forEach(q=>{ s+='<circle cx="'+X(+q.x)+'" cy="'+Y(q.y)+'" r="3" fill="'+se.color+'"><title>'+fmtD(new Date(+q.x))+': '+fmtW(q.y)+'</title></circle>'; });
    const L=se.pts[se.pts.length-1]; const lx=X(+L.x), ly=Y(L.y);
    s+='<circle cx="'+lx+'" cy="'+ly+'" r="4.5" fill="var(--surface)" stroke="'+se.color+'" stroke-width="2"/>';
    if(se.label!==false) s+='<text x="'+(lx-8)+'" y="'+(ly-(si===2?-16:9))+'" text-anchor="end" font-size="12" font-weight="600" fill="'+se.color+'" font-family="IBM Plex Mono,monospace">'+fmtW(L.y)+'</text>';
  });
  s+='<g class="scrub" visibility="hidden" pointer-events="none"><line class="sc-l" y1="'+m.t+'" y2="'+(H-m.b)+'" stroke="var(--ink)" stroke-width="1.5"/><g class="sc-d"></g><g class="sc-b"><rect rx="6" fill="var(--ink)"/><text class="sc-t" font-size="12" fill="var(--bg)" font-family="IBM Plex Sans,system-ui,sans-serif"></text></g></g>';
  el.innerHTML=s+'</svg>';
  el._c={X,Y,W,H,m,series,fmt:opts.fmt||(v=>fmtW(v))};
  if(!el._scrub){ el._scrub=true; let active=false;
    const show=ev=>{ const c=el._c, svg=el.querySelector('svg'); if(!c||!svg) return; const r=svg.getBoundingClientRect(); const sx=(ev.clientX-r.left)*(c.W/r.width);
      const main=c.series.find(se=>se.pts.length); if(!main) return;
      let best=null; for(const se of c.series) for(const q of se.pts){ const d=Math.abs(c.X(+q.x)-sx); if(!best||d<best.d) best={d,q}; }
      const x=c.X(+best.q.x); const g=svg.querySelector('.scrub'); g.setAttribute('visibility','visible');
      const ln=g.querySelector('.sc-l'); ln.setAttribute('x1',x); ln.setAttribute('x2',x);
      const lines=[fmtDL(iso(new Date(+best.q.x)))+' '+new Date(+best.q.x).getFullYear()]; let dots='';
      for(const se of c.series){ let n=null; for(const q of se.pts){ const d=Math.abs(+q.x-+best.q.x); if(d<DAY/2&&(!n||d<n.d)) n={d,q}; } if(!n) continue;
        dots+='<circle cx="'+x+'" cy="'+c.Y(n.q.y)+'" r="5.5" fill="'+se.color+'" stroke="var(--surface)" stroke-width="2"/>';
        lines.push((se.name?se.name+': ':'')+c.fmt(n.q.y)+(n.q.note?' · '+n.q.note:'')); }
      g.querySelector('.sc-d').innerHTML=dots;
      const t=g.querySelector('.sc-t'); t.innerHTML=lines.map((l,i)=>'<tspan x="0" dy="'+(i?15:0)+'"'+(i===0?' font-weight="600"':'')+'>'+esc(l)+'</tspan>').join('');
      const bb=t.getBBox(); const bw=bb.width+16, bh=bb.height+10; let bx=x+10; if(bx+bw>c.W-4) bx=x-10-bw; bx=Math.max(4,bx);
      const rc=g.querySelector('rect'); rc.setAttribute('width',bw); rc.setAttribute('height',bh); rc.setAttribute('x',bx); rc.setAttribute('y',c.m.t);
      t.setAttribute('transform','translate('+(bx+8)+','+(c.m.t+5-bb.y)+')'); t.querySelectorAll('tspan').forEach(ts=>ts.setAttribute('x',0));
    };
    el.addEventListener('pointerdown',ev=>{ active=true; try{ el.setPointerCapture(ev.pointerId); }catch(e){} show(ev); });
    el.addEventListener('pointermove',ev=>{ if(active||ev.pointerType==='mouse') show(ev); });
    ['pointerup','pointercancel'].forEach(t=>el.addEventListener(t,()=>{ active=false; }));
    el.addEventListener('pointerleave',ev=>{ if(ev.pointerType==='mouse'){ const g=el.querySelector('.scrub'); if(g) g.setAttribute('visibility','hidden'); } });
  }
}
function drawCharts(){
  const hc=$('#chart-hist');
  if(hc&&V.histEx){ const pts=[]; for(const s of S.sessions){ for(const m of sessionMetrics(s,V.histEx)){ const b=bestSet(m.e); const n=m.e.sets.filter(x=>x.done&&+x.r>0).length; pts.push({x:+parseISO(s.date),y:m[V.histMetric],note:n+' set'+(n>1?'s':'')+(b?', best '+fmtW(b.w)+'×'+b.r:'')}); } } const rg=V.histRange||'all'; if(rg!=='all'){ const cut=Date.now()-(rg==='3m'?92:366)*DAY; for(let i=pts.length-1;i>=0;i--) if(pts[i].x<cut) pts.splice(i,1); } pts.sort((a,b)=>a.x-b.x);
    const f={w:v=>fmtW(v)+' '+U(),e1:v=>'est. max '+fmtBig(v)+' '+U(),vol:v=>fmtBig(v)+' '+U(),reps:v=>fmtBig(v)+' reps'}[V.histMetric];
    lineChart(hc,[{pts,color:'var(--accent)',area:true,dots:true}],230,{fmt:f}); }
  drawGoalCharts();
  const bc=$('#chart-bw'); if(bc){ lineChart(bc,[{pts:bwPoints().map(p=>({x:+parseISO(p.date),y:p.w})),color:'var(--accent)',dots:true,area:true}],180,{fmt:v=>fmtW(v)+' '+U()}); }
  const pc=$('#chart-proj');
  if(pc&&V.projKey){ const plan=activePlan(); const Pj=project(plan,V.projSpw||autoSpw(),30); const p=Pj.pts[V.projKey]||[]; const [id,sc]=V.projKey.split('|'); const ex=exById(id);
    const hist=[]; for(const s of S.sessions){ if(parseISO(s.date)<Date.now()-60*DAY) continue; for(const e of s.entries){ if(e.exId===id&&e.scheme===sc){ if(sc==='W'){ if(e.sets.some(x=>x.done)) hist.push({x:+parseISO(s.date),y:e.target.w}); } else { const d=e.sets.filter(x=>x.done); if(d.length) hist.push({x:+parseISO(s.date),y:modeWeight(d)}); } } } } hist.sort((a,b)=>a.x-b.x);
    lineChart(pc,[{name:'Logged',pts:hist,color:'var(--ink)',dots:true,label:false},{name:'Best case',pts:p.map(q=>({x:+q.d,y:q.best})),color:'var(--accent)',dash:true},{name:'Your pace',pts:p.map(q=>({x:+q.d,y:paceW(ex,sc,q.exp)})),color:'var(--muted)',dash:true}]); }
}

export { drawCharts, lineChart };
