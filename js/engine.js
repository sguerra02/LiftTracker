/* Iron Ledger — Plans and progression engine */
import { DERIVED, FSL_PCT, GZ, S, ST, U, W531, WEEK_NAME, fmtW, fromLb, memoize, repPct, uid } from './core.js';
import { exById, roundDown, snap5, stepUp, wtText } from './equipment.js';

/* ---------- plans & progression ---------- */
const activePlan=()=>S.plans.find(p=>p.id===S.activePlanId);
const schemeOf=(plan,slot)=>slot.scheme||(plan.type==='gzclp'?(slot.tier||'T1'):'D');
const slotKey=(plan,slot)=>slot.exId+'|'+schemeOf(plan,slot);
function schemePct(sc,s){ s=s||{}; switch(sc){ case 'F':return .9*.7; case 'B':return .45; case 'TV':return .72; case 'TR':return .58; case 'T1':return .85; case 'T2':return repPct(10); case 'T3':return repPct(15); case 'L':return repPct(+s.reps||5); case 'G':return repPct(5); case 'W':return .9; default:return repPct(+s.repMax||12);} }
function tgt(sc,st,s,ex){
  s=s||{}; const w=st.w; const base={kind:sc,w,stage:0,week:0,params:{}};
  const rows=(n,r,am)=>Array.from({length:n},(_,i)=>({w,r,amrap:!!am&&i===n-1}));
  if(sc==='T1'||sc==='T2'||sc==='T3'){ const arr=GZ[sc], g=Math.min(st.stage||0,arr.length-1); return Object.assign(base,{stage:g,rows:rows(arr[g].s,arr[g].r,sc!=='T2')}); }
  if(sc==='L'){ const n=+s.sets||3, r=+s.reps||5; return Object.assign(base,{params:{sets:n,reps:r,inc:s.inc},rows:rows(n,r,false)}); }
  if(sc==='F') return Object.assign(base,{rows:rows(5,5,false)});
  if(sc==='B') return Object.assign(base,{rows:rows(5,10,false)});
  if(sc==='TV') return Object.assign(base,{rows:rows(5,5,false)});
  if(sc==='TR') return Object.assign(base,{rows:rows(2,5,false)});
  if(sc==='G'){ const n=+s.sets||3; return Object.assign(base,{params:{sets:n},rows:rows(n,5,true)}); }
  if(sc==='W'){ const wk=(st.week||0)%4; return Object.assign(base,{week:wk,rows:W531[wk].map(([p,r,a])=>({w:ex?snap5(ex,w*p):Math.round(w*p/ST())*ST(),r,amrap:!!a,pct:p}))}); }
  const n=+s.sets||3, a=+s.repMin||8, b=Math.max(a,+s.repMax||12);
  return Object.assign(base,{kind:'D',params:{sets:n,repMin:a,repMax:b},rows:rows(n,a,false)});
}
function tgtText(t){ const R=t.rows||[]; if(!R.length) return '—';
  if(t.kind==='W') return R.map(r=>r.r+(r.amrap?'+':'')).join('/');
  if(t.kind==='D') return R.length+'×'+t.params.repMin+'–'+t.params.repMax;
  return R.length+'×'+R[0].r+(R[R.length-1].amrap?'+':''); }
function modeWeight(sets){ const c=new Map(); for(const s of sets){ const w=+s.w||0; c.set(w,(c.get(w)||0)+1);} let bw=0,bn=-1; for(const [w,n] of c) if(n>bn||(n===bn&&w>bw)){bw=w;bn=n;} return bw; }
function evalEntry(e,st,ex,mode){
  const t=e.target, sets=e.sets||[], done=sets.filter(s=>s.done);
  if(!done.length) return {st,verdict:'skip',ok:false,up:false};
  const rows=t.rows, need=i=>(rows[i]||rows[rows.length-1]).r;
  const reps=sets.map(s=>s.done?(+s.r||0):0), last=reps[reps.length-1];
  const hitAll=reps.length>=rows.length&&reps.every((r,i)=>r>=need(i));
  const sc=e.scheme, base=sc==='W'?st.w:modeWeight(done);
  const n=Object.assign({},st,{w:base,stage:st.stage||0,fails:st.fails||0});
  let v='hold', ok=hitAll, up=false;
  const inc=t.params&&t.params.inc; const bump=times=>{ let nw=base; for(let i=0;i<(times||1);i++) nw=stepUp(ex,nw,inc); if(nw>base+0.01){n.w=nw;v='up';up=true;} else v=ex.load==='bodyweight'?'reps':'max'; };
  const drop=()=>roundDown(ex,Math.floor(base*0.9/ST())*ST());
  const miss=lim=>{ n.fails++; if(n.fails>=lim){ n.w=drop(); n.fails=0; v='deload'; } else v='miss'; };
  if(sc==='T1'||sc==='T2'){
    if(mode==='maintain'){ if(hitAll) n.fails=0; else miss(2); }
    else if(hitAll){ n.fails=0; bump(); }
    else if(n.stage<GZ[sc].length-1){ n.stage++; v='stage'; }
    else { n.stage=0; n.w=roundDown(ex,Math.floor(base*0.85/ST())*ST()); v='reset'; }
  } else if(sc==='T3'){
    if(!hitAll) miss(2); else { n.fails=0; if(mode==='progress'&&last>=25) bump(); }
  } else if(sc==='L'){
    if(hitAll){ n.fails=0; if(mode==='progress') bump(); } else miss(3);
  } else if(sc==='G'){
    if(hitAll){ n.fails=0; if(mode==='progress') bump(last>=10?2:1); }
    else if(mode==='progress'){ n.w=drop(); v='deload'; } else miss(2);
  } else if(sc==='W'){
    const wk=(t.week||0)%4; ok=wk===3?true:last>=need(rows.length-1);
    if(wk<3&&!ok) n.cycMiss=true; v='week';
  } else {
    const top=reps.length>=rows.length&&reps.every(r=>r>=t.params.repMax), low=reps.every(r=>r<t.params.repMin);
    if(low) miss(2); else { n.fails=0; if(mode==='progress'&&top) bump(); else v=mode==='progress'?'reps':'hold'; }
  }
  if(v==='up'&&sc!=='W'&&S.settings.rpeAdjust!==false&&e.rpe!==''&&e.rpe!=null){ const rp=parseFloat(e.rpe);
    if(rp>=9.5){ n.w=base; v='rpehold'; up=false; }
    else if(rp<=6.5&&sc!=='T3'){ const w2=stepUp(ex,n.w); if(w2>n.w+0.01){ n.w=w2; v='up2'; } } }
  return {st:n,verdict:v,ok,up};
}
function weekLen(plan){ return +plan.weekLen||plan.days.length||1; }
function cycleLen(plan){ return weekLen(plan)*(plan.deload===false?3:4); }
function planWeek(plan,idx){ return Math.floor(idx/weekLen(plan))%(plan.deload===false?3:4); }
function derivedW(plan,s,lifts,idx){
  const sc=schemeOf(plan,s), ex=exById(s.exId), one=est1RM(s.exId);
  if(sc==='F'||sc==='B'){ const b=lifts[s.exId+'|W']; const tm=b?b.w:Math.round(one*0.9); const p=sc==='F'?FSL_PCT[planWeek(plan,idx)]:(+plan.bbbPct||0.5); return snap5(ex,tm*p); }
  const b=lifts[s.exId+'|L']; const I=b?b.w:one*repPct(5); return snap5(ex,I*(sc==='TV'?0.9:0.72));
}
function slotTarget(plan,s,lifts,idx){
  const sc=schemeOf(plan,s), ex=exById(s.exId), key=slotKey(plan,s);
  if(DERIVED[sc]) return tgt(sc,{w:derivedW(plan,s,lifts,idx)},s,ex);
  const st=lifts[key]||{w:suggestStart(s.exId,sc,s),stage:0,fails:0,week:0};
  return tgt(sc,sc==='W'?Object.assign({},st,{week:planWeek(plan,idx)}):st,s,ex);
}
function planSessions(plan){ return S.sessions.filter(s=>s.planId===plan.id&&s.runId&&s.runId===plan.runId).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:(a.createdAt||0)-(b.createdAt||0)); }
function planState(plan,until){ return until?planStateRaw(plan,until):memoize('ps|'+plan.id+'|'+plan.runId+'|'+plan.mode,()=>planStateRaw(plan)); }
function planStateRaw(plan,until){
  const lifts={}; for(const k in plan.start||{}) lifts[k]={w:plan.start[k],stage:0,fails:0,week:0};
  const results={}, stats={}; let next=0; let ss=planSessions(plan);
  if(until) ss=ss.filter(s=>s.id!==until.id&&(s.date<until.date||(s.date===until.date&&(s.createdAt||0)<(until.createdAt||0))));
  let idx=0; const cyc=cycleLen(plan);
  // Weight changes made from the Today screen take effect at the point in the log where they were made.
  const adj=(plan.adjust||[]).filter(a=>a.runId===plan.runId);
  const applyAdj=test=>{ for(const a of adj) if(test(a)){ const st=lifts[a.key]||{stage:0,fails:0,week:0}; lifts[a.key]=Object.assign({},st,{w:a.w,fails:0,cycMiss:false}); } };
  for(const s of ss){
    applyAdj(a=>a.at===idx);
    for(const e of s.entries){
      if(DERIVED[e.scheme]){ results[s.id+'|'+e.id]={st:null,verdict:e.sets.some(x=>x.done)?'supp':'skip',ok:true,up:false}; continue; }
      if(s.ramp&&s.ramp<1&&lifts[e.key]){ results[s.id+'|'+e.id]={before:lifts[e.key],st:Object.assign({},lifts[e.key]),verdict:e.sets.some(x=>x.done)?'ramp':'skip',ok:true,up:false,ramp:s.ramp}; continue; }
      const ex=exById(e.exId); const st=lifts[e.key]||{w:e.target.w,stage:e.target.stage||0,fails:0,week:e.target.week||0};
      const res=evalEntry(e,st,ex,s.mode||plan.mode); lifts[e.key]=res.st; results[s.id+'|'+e.id]=Object.assign({before:st},res);
      if(res.verdict!=='skip'){ const x=stats[e.key]||(stats[e.key]={n:0,ok:0,up:0,k:3}); x.n++; if(res.ok)x.ok++; if(res.up)x.up++; if(e.scheme==='D') x.k=Math.max(1,(e.target.params.repMax-e.target.params.repMin)||4); }
    }
    idx++;
    if(plan.type==='w531'&&idx%cyc===0){ const md=s.mode||plan.mode;
      for(const k in lifts){ if(!k.endsWith('|W')) continue; const st=lifts[k], ex=exById(k.split('|')[0]); let v='cycle';
        if(md==='progress'){ if(st.cycMiss){ st.w=Math.round(st.w*0.9/ST())*ST(); v='tmdown'; } else { st.w=st.w+(+ex.inc||ST()); v='tmup'; } }
        st.cycMiss=false; for(const e of s.entries) if(e.key===k&&results[s.id+'|'+e.id]){ results[s.id+'|'+e.id].verdict=v; results[s.id+'|'+e.id].st=Object.assign({},st); if(v==='tmup') results[s.id+'|'+e.id].up=true; } } }
    if(plan.days.length) next=((s.dayIndex|0)+1)%plan.days.length;
  }
  applyAdj(a=>a.at>=idx);
  return {lifts,next,results,stats,count:ss.length,last:ss[ss.length-1]};
}
function lastUsed(exId){ let best=null; for(const s of S.sessions){ for(const e of s.entries){ if(e.exId!==exId) continue; const d=e.sets.filter(x=>x.done); if(d.length&&(!best||s.date>=best.d)) best={d:s.date,w:modeWeight(d)}; } } return best&&best.w; }
function est1RM(exId){ const es=(S.settings.est1rm||{})[exId]; if(es) return es; const ex=exById(exId); const lu=lastUsed(exId); if(lu!=null) return lu/0.72; return fromLb({barbell:65,dumbbell:30,dumbbell1:35,cable:50,bodyweight:0}[ex.load]||0)/0.7; }
function fromOneRM(ex,sc,s,one){ if(ex.load==='bodyweight') return 0; if(sc==='W') return Math.round(one*0.9/ST())*ST(); return snap5(ex,one*schemePct(sc,s)); }
function suggestStart(exId,sc,s){ const ex=exById(exId); if(ex.load==='bodyweight') return lastUsed(exId)||0; return fromOneRM(ex,sc,s,est1RM(exId)); }
function planKeys(plan){ const seen=new Map(); plan.days.forEach(d=>d.slots.forEach(s=>{ const k=slotKey(plan,s); if(!seen.has(k)) seen.set(k,{key:k,exId:s.exId,scheme:schemeOf(plan,s),slot:s}); })); return [...seen.values()]; }
function setupGroups(plan){
  const g=new Map();
  for(const k of planKeys(plan)){ if(DERIVED[k.scheme]) continue; k.pct=schemePct(k.scheme,k.slot); if(!g.has(k.exId)) g.set(k.exId,{exId:k.exId,keys:[]}); g.get(k.exId).keys.push(k); }
  for(const x of g.values()){ x.keys.sort((a,b)=>(b.scheme==='W')-(a.scheme==='W')||b.pct-a.pct); x.main=x.keys[0]; }
  return [...g.values()];
}
function buildEntries(plan,di,lifts,idx){
  if(idx==null) idx=planState(plan).count;
  return plan.days[di].slots.map(s=>{
    const scheme=schemeOf(plan,s), key=slotKey(plan,s);
    const t=slotTarget(plan,s,lifts,idx);
    return {id:uid(),key,exId:s.exId,slotExId:s.exId,scheme,target:t,sets:t.rows.map(r=>({w:r.w,r:'',done:false})),rpe:'',notes:''};
  });
}
function verdictText(res,e){
  const ex=exById(e.exId);
  if(res.verdict==='supp') return ['info','Supplemental sets done. Their weight follows the main lift.'];
  if(res.verdict==='ramp') return ['info','Comeback set done at '+Math.round(res.ramp*100)+'% of normal. Your progression picks up where it left off once the ramp ends.'];
  if(e.scheme==='W'){ const tm=fmtW(res.st.w)+' '+U(); if(res.verdict==='tmup') return ['good','Cycle complete. Training max goes up to '+tm+'.']; if(res.verdict==='tmdown') return ['bad','Cycle had a missed last set, so the training max drops to '+tm+'.']; if(res.verdict==='cycle') return ['info','Cycle complete. Training max stays '+tm+'.']; if(res.verdict==='skip') return ['info','Not logged.']; return res.ok?['good','Last-set target hit. Training max '+tm+'.']:['warn','Last set came up short. Noted for this cycle.']; }
  const nt=tgt(e.scheme,res.st,e.target.params,ex);
  const nx=(nt.kind==='W'?WEEK_NAME[nt.week]+', ':'')+tgtText(nt)+' @ '+wtText(ex,nt);
  switch(res.verdict){
    case 'up': return ['good','Hit it. Next: '+nx];
    case 'up2': return ['good','Hit it at RPE '+e.rpe+', so it jumps two steps. Next: '+nx];
    case 'rpehold': return ['warn','Hit it, but at RPE '+e.rpe+', so the weight holds one more time. Next: '+nx];
    case 'max': return ['warn','Hit it, but that is the heaviest your equipment loads. Next: '+nx];
    case 'stage': return ['warn','Missed reps. Same weight, next stage: '+nx];
    case 'reset': return ['bad','Missed the last stage. Restarting lighter: '+nx];
    case 'deload': return ['bad','Weight drops 10%. Next: '+nx];
    case 'miss': return ['warn','Missed. Repeat: '+nx];
    case 'reps': return ['info','Add reps before weight. Next: '+nx];
    case 'week': return res.ok?['good','Done. Next time: '+nx]:['warn','Last set came up short. Noted for this cycle. Next: '+nx];
    case 'tmup': return ['good','Cycle complete. Training max goes up. Next: '+nx];
    case 'tmdown': return ['bad','Cycle had a missed last set. Training max drops 10%. Next: '+nx];
    case 'cycle': return ['info','Cycle complete. Training max stays the same. Next: '+nx];
    case 'skip': return ['info','Not logged. Next time: '+nx];
    default: return ['info','Repeat: '+nx];
  }
}
function schemeChip(sc,t){
  if(sc==='T1'||sc==='T2'||sc==='T3') return '<span class="chip '+sc.toLowerCase()+'">'+sc+'</span>';
  if(sc==='W') return '<span class="chip t2">Week '+((t&&t.week||0)+1)+' · '+WEEK_NAME[(t&&t.week)||0]+'</span>';
  if(sc==='G') return '<span class="chip">Last set AMRAP</span>';
  if(sc==='F') return '<span class="chip">FSL</span>'; if(sc==='B') return '<span class="chip">BBB</span>'; if(sc==='TV') return '<span class="chip t2">Volume</span>'; if(sc==='TR') return '<span class="chip">Recovery</span>';
  if(sc==='D') return '<span class="chip">Rep range</span>';
  return '';
}

export { activePlan, buildEntries, cycleLen, fromOneRM, lastUsed, modeWeight, planKeys, planSessions, planState, schemeChip, schemeOf, schemePct, setupGroups, slotKey, slotTarget, suggestStart, tgt, tgtText, verdictText, weekLen };
