/* Iron Ledger — Next-month projection */
import { DAY, DERIVED, S, ST, esc, fmtD, fmtW, parseISO } from '../core.js';
import { avail, exById, loadOptions, roundDown, stepUp } from '../equipment.js';
import { activePlan, cycleLen, planState, schemeOf, slotKey, suggestStart } from '../engine.js';
import { V } from '../state.js';
import { slotDesc } from './today.js';

/* ---------- PROJECTION ---------- */
function autoSpw(){ const now=new Date(); const t0=new Date(now.getFullYear(),now.getMonth(),now.getDate()); const n=S.sessions.filter(s=>t0-parseISO(s.date)<28*DAY).length; if(n<3) return 2.5; return Math.min(4,Math.max(1,Math.round(n/4*2)/2)); }
function project(plan,spw,days){
  const ps=planState(plan); const n=Math.max(1,Math.round(spw*days/7)); const gap=days/n;
  const best={}, exp={}, cnt={}, pts={}, rates={}, slots={};
  for(const k in ps.lifts){ best[k]=ps.lifts[k].w; exp[k]=ps.lifts[k].w; cnt[k]=ps.lifts[k].week||0; }
  let next=ps.next; const now=new Date(); const t0=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
  const rate=(key,sc)=>{ if(rates[key]) return rates[key]; const x=ps.stats[key]; let r,assumed=false;
    if(!x||x.n<3){ r=.75; assumed=true; } else if(sc==='T3'||sc==='D') r=Math.min(1,x.up*(sc==='T3'?3:x.k)/x.n); else r=x.ok/x.n;
    return rates[key]={r,assumed}; };
  const cyc=cycleLen(plan);
  for(let i=1;i<=n;i++){
    const d=new Date(t0+Math.round(i*gap)*DAY); const dd=plan.days[next];
    if(plan.type==='w531'&&i>1&&(ps.count+i-1)%cyc===0&&plan.mode==='progress') for(const k in best) if(k.endsWith('|W')){ const inc=+exById(k.split('|')[0]).inc||ST(); exp[k]+=rate(k,'W').r*inc; best[k]+=inc; }
    for(const s of dd.slots){
      const ex=exById(s.exId); if(!avail(ex)) continue; const sc=schemeOf(plan,s), key=slotKey(plan,s); if(DERIVED[sc]) continue; slots[key]=s;
      if(best[key]==null){ best[key]=exp[key]=suggestStart(s.exId,sc,s); cnt[key]=0; }
      if(!pts[key]) pts[key]=[{d:new Date(t0),best:best[key],exp:exp[key]}];
      const w=best[key]; let nw=w;
      if(plan.mode==='progress'){
        if(sc==='T1'||sc==='T2'||sc==='L'||sc==='G') nw=stepUp(ex,w,s.inc);
        else if(sc==='W'){ }
        else { cnt[key]++; const k=sc==='T3'?3:Math.max(1,(+s.repMax-+s.repMin)||4); if(cnt[key]%k===0) nw=stepUp(ex,w); }
      }
      exp[key]+=rate(key,sc).r*(nw-w); best[key]=nw;
      pts[key].push({d,best:nw,exp:exp[key]});
    }
    next=(next+1)%plan.days.length;
  }
  return {n,pts,rates,ps,slots,end:new Date(t0+days*DAY)};
}
function paceW(ex,sc,v){ return sc==='W'?Math.round(v):roundDown(ex,v); }
function viewProjection(){
  const plan=activePlan();
  if(!plan||!plan.runId||!plan.days.length) return '<section class="panel"><h2>Start a plan to see a projection</h2><p>The projection runs your active plan forward 30 days using its progression rules.</p><div><button class="primary" data-act="tab" data-tab="today">Go to Today</button></div></section>';
  const spw=V.projSpw||autoSpw(); const Pj=project(plan,spw,30); const keys=Object.keys(Pj.pts);
  if(!V.projKey||!keys.includes(V.projKey)) V.projKey=keys[0];
  const lbl=k=>{ const [id,sc]=k.split('|'); return exById(id).name+' · '+(sc==='T1'||sc==='T2'||sc==='T3'?sc:slotDesc({exId:id,scheme:sc,slot:Pj.slots[k]})); };
  let h='<section class="panel"><div class="row between"><div><div class="eyebrow">'+esc(plan.name)+'</div><h2>Next 30 days</h2></div><label class="f">Workouts per week<select id="proj-spw" data-ch="spw">'+[1,1.5,2,2.5,3,3.5,4].map(v=>'<option value="'+v+'"'+(v===spw?' selected':'')+'>'+v+'</option>').join('')+'</select></label></div>';
  h+='<p class="small muted">'+Pj.n+' workouts through '+fmtD(Pj.end)+', continuing the rotation from Day '+esc(plan.days[Pj.ps.next].name)+'. '+(plan.mode==='maintain'?'This plan is in Maintain mode, so weights hold flat.':'<b>Best case</b> assumes every target is hit. <b>Your pace</b> scales that by how often you’ve hit targets on each lift so far.')+(plan.type==='w531'?' 5/3/1 main lifts show the training max.':'')+'</p>';
  h+='<div class="row"><select id="proj-key" data-ch="projKey" aria-label="Lift">'+keys.map(k=>'<option value="'+esc(k)+'"'+(k===V.projKey?' selected':'')+'>'+esc(lbl(k))+'</option>').join('')+'</select></div>';
  h+='<div class="chart" id="chart-proj"></div><div class="legend"><span><i style="border-color:var(--ink)"></i>Logged</span><span><i class="d" style="border-color:var(--accent)"></i>Best case</span><span><i class="d" style="border-color:var(--muted)"></i>Your pace</span></div></section>';
  h+='<section class="panel"><h3>Where each lift lands</h3><div class="tbl-wrap"><table><thead><tr><th>Lift</th><th class="num">Now</th><th class="num">Best</th><th class="num">Pace</th><th class="num">Hit</th></tr></thead><tbody>';
  for(const k of keys){ const [id,sc]=k.split('|'); const ex=exById(id); const p=Pj.pts[k]; const a=p[0], z=p[p.length-1]; const rr=Pj.rates[k]||{r:.75,assumed:true};
    const mx=loadOptions(ex); const capped=sc!=='W'&&ex.load!=='bodyweight'&&mx.length&&z.best>=mx[mx.length-1].w;
    h+='<tr><td>'+esc(lbl(k))+(capped?' <span class="chip warn">at max load</span>':'')+'</td><td class="num">'+fmtW(a.best)+'</td><td class="num">'+fmtW(z.best)+'</td><td class="num">'+fmtW(paceW(ex,sc,z.exp))+'</td><td class="num">'+(rr.assumed?'<span class="muted">75%*</span>':Math.round(rr.r*100)+'%')+'</td></tr>'; }
  h+='</tbody></table></div><p class="small muted">* Fewer than 3 logged attempts, so 75% is assumed. Pace weights round down to what your plates can load. Dumbbell weights are per hand.</p></section>';
  return h;
}

export { autoSpw, paceW, project, viewProjection };
