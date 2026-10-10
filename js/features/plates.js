/* Iron Ledger — Plate plan: pick plate combinations (and nudge warm-up weights) so you strip and reload as little as possible */
import { S, ST, esc, fmtW, r2 } from '../core.js';
import { exById, loadOptions, missing, roundLoad } from '../equipment.js';

// Plates available per side, heaviest first: [[weight, count], ...]
function inventory(){
  const m=new Map();
  for(const p of S.equipment.plates){ const w=+p.weight, n=Math.floor((+p.qty||0)/2); if(w>0&&n>0) m.set(w,(m.get(w)||0)+n); }
  return [...m.entries()].sort((a,b)=>b[0]-a[0]);
}
// Every way to make one side's weight, each as a heaviest-first stack (innermost plate first).
export function sideCombos(side,inv,limit){
  limit=limit||40; const out=[];
  const rec=(i,rem,acc)=>{
    if(out.length>=limit) return;
    if(Math.abs(rem)<0.001){ out.push(acc.slice()); return; }
    if(i>=inv.length||rem<0) return;
    const [w,n]=inv[i]; const max=Math.min(n,Math.floor(rem/w+0.001));
    for(let k=max;k>=0;k--){ for(let j=0;j<k;j++) acc.push(w); rec(i+1,r2(rem-k*w),acc); acc.length-=k; }
  };
  rec(0,r2(side),[]); return out;
}
const prefix=(a,b)=>{ let p=0; while(p<a.length&&p<b.length&&Math.abs(a[p]-b[p])<0.001) p++; return p; };
// Plates touched per side going from stack a to stack b: outer plates come off, new ones go on.
export const changeCost=(a,b)=>{ const p=prefix(a,b); return (a.length-p)+(b.length-p); };
export function diff(a,b){ const p=prefix(a,b); return {remove:a.slice(p).reverse(),add:b.slice(p)}; }

function theBar(){ const bars=S.equipment.bars.filter(b=>b.kind==='barbell'&&+b.qty>0); return bars.length===1?bars[0]:null; }

/* steps: [{target, flex: [lo, hi] | null, seg}] in loading order.
   Returns [{w, side, remove, add}] with the cheapest total plate handling, or null if it can't be planned. */
export function planPath(steps){
  const bar=theBar(); if(!bar||!steps.length) return null;
  const B=+bar.weight, inv=inventory(), ex={load:'barbell'};
  const loadable=loadOptions(ex).filter(o=>o.bar===bar).map(o=>o.w);
  const layers=steps.map((st,i)=>{
    let ws;
    if(st.flex) ws=loadable.filter(w=>w>=st.flex[0]-0.01&&w<=st.flex[1]+0.01);
    else ws=[roundLoad(ex,st.target)];
    if(!ws.length) ws=[roundLoad(ex,st.target)];
    const states=[];
    for(const w of ws) for(const c of sideCombos((w-B)/2,inv)) states.push({w,side:c,drift:Math.abs(w-st.target)/ST()});
    return states;
  });
  if(layers.some(l=>!l.length)) return null;
  // Dynamic programming over (weight, stack) states.
  let prev=[{w:-1,side:[],cost:0,back:null,seg:null}];
  for(let i=0;i<layers.length;i++){
    const st=steps[i], next=[];
    for(const s of layers[i]){
      let best=null;
      for(const p of prev){
        if(st.flex&&p.seg===st.seg&&s.w<=p.w+0.01) continue;           // warm-ups climb within an exercise
        const c=p.cost+changeCost(p.side,s.side)+0.35*s.drift+0.01*s.side.length;
        if(!best||c<best.cost) best={w:s.w,side:s.side,cost:c,back:p,seg:st.seg};
      }
      if(best) next.push(best);
    }
    if(!next.length) return null;
    prev=next;
  }
  let end=prev.reduce((a,b)=>b.cost<a.cost?b:a); const chain=[];
  while(end&&end.back){ chain.unshift(end); end=end.back; }
  let last=[]; return chain.map(s=>{ const d=diff(last,s.side); last=s.side; return {w:s.w,side:s.side,remove:d.remove,add:d.add}; });
}

export function changeText(st){
  const f=a=>a.map(fmtW).join(' · ');
  if(!st.remove.length&&!st.add.length) return 'No change';
  if(!st.remove.length) return 'Add '+f(st.add);
  if(!st.add.length) return st.side.length?'Take off '+f(st.remove):'Strip to the bar';
  return 'Take off '+f(st.remove)+', add '+f(st.add);
}

/* Whole-day plan for a workout's barbell lifts.
   warmFn(ex, workWeight, heavy) gives the default warm-up list [{w, r, p}]. */
export function dayPlan(entries,warmFn){
  const steps=[], meta=[];
  entries.forEach((e,ei)=>{
    const ex=exById(e.exId); if(ex.load!=='barbell'||missing(ex).length) return;
    const ws=e.sets.map((s,j)=>+s.w||(e.target.rows[j]||e.target.rows[e.target.rows.length-1]).w).filter(w=>w>0);
    if(!ws.length) return;
    const work=Math.max(...ws), heavy=Math.max(...e.target.rows.map(r=>r.r))<=5;
    const warm=warmFn(ex,work,heavy), band=Math.max(ST(),work*0.05);
    warm.forEach((x,k)=>{ steps.push({target:x.w,flex:k===0?null:[x.w-band,Math.min(x.w+band,work-ST())],seg:e.id}); meta.push({eid:e.id,kind:'warm',r:x.r,p:x.p,k}); });
    let lastW=null; ws.forEach((w,j)=>{ if(lastW!==null&&Math.abs(w-lastW)<0.01) return; lastW=w; steps.push({target:w,flex:null,seg:e.id}); meta.push({eid:e.id,kind:'work',set:j}); });
  });
  const path=planPath(steps); if(!path) return null;
  const by={}; path.forEach((p,i)=>{ const m=meta[i]; (by[m.eid]=by[m.eid]||[]).push(Object.assign({},p,m)); });
  return by;
}

export function stackHTML(side){ return side.length?'<span class="mono">'+side.map(fmtW).join(' · ')+'</span>':'<span class="muted">empty bar</span>'; }
export function stepHTML(st,label){
  const touched=st.remove.length+st.add.length;
  return '<div class="pstep"><span class="mono">'+label+'</span><b class="mono">'+fmtW(st.w)+'</b><span class="pchg'+(touched?'':' muted')+'">'+esc(changeText(st))+'</span><span class="small muted">'+stackHTML(st.side)+' per side</span></div>';
}
