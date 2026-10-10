/* Iron Ledger — Demo data */
import { DAY, defaultState, iso, r2, setS, touch, uid } from './core.js';
import { eqChanged } from './equipment.js';
import { buildEntries, planKeys, planState, suggestStart } from './engine.js';

/* ---------- sample ---------- */
function rng(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function makeSample(){
  const st=defaultState(); st.demo=true; st.settings.setupDone=true; st.settings.est1rm={squat:225,bench:165,deadlift:275,ohp:105}; st.equipment.bars.push({id:'dbh',name:'Dumbbell handles',kind:'dumbbell',weight:5,qty:2}); setS(st); eqChanged();
  const plan=st.plans[0]; const R=rng(1989); const now=new Date(); const t0=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  plan.runId='demo'; const startD=new Date(t0-42*DAY); plan.startedAt=iso(startD); plan.start={};
  for(const k of planKeys(plan)) plan.start[k.key]=suggestStart(k.exId,k.scheme,k.slot);
  let d=startD; const gaps=[2,3,2,2,4,3,2,5]; let gi=0;
  while(d<t0){
    const ps=planState(plan); const di=ps.next; const entries=buildEntries(plan,di,ps.lifts);
    for(const e of entries){ e.sets.forEach((s,j)=>{ s.done=true; const row=e.target.rows[j]; let r=row.r;
      if(e.scheme==='T3'&&row.amrap) r=15+Math.floor(R()*12); else if(row.amrap) r+=Math.floor(R()*4);
      if(e.scheme!=='T3'&&R()<.07) r=Math.max(0,r-1); s.r=r; }); e.rpe=String(7+Math.floor(R()*5)/2); }
    const at=d.getTime()+18.5*3600e3;
    touch(); st.sessions.push({id:uid(),date:iso(d),createdAt:at,startedAt:at,endedAt:at+(50+Math.floor(R()*25))*60000,planId:plan.id,runId:'demo',mode:'progress',dayIndex:di,dayName:plan.days[di].name,entries,bw:r2(180+R()*2-1),notes:''});
    touch(); d=new Date(d.getTime()+gaps[gi++%gaps.length]*DAY);
  }
  return st;
}

export { makeSample };
