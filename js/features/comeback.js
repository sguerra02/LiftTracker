/* Iron Ledger — Comeback ramp: after a break of two weeks or more, ease back in over a few sessions */
import { DAY, S, ST, parseISO, save, todayISO } from '../core.js';
import { exById, roundDown } from '../equipment.js';
import { planSessions } from '../engine.js';
import { render } from '../state.js';
import { toast } from '../ui.js';
import { ACT } from '../registry.js';

export const GAP_DAYS=14;
// Longer breaks get a longer, gentler ramp. Each number is a share of your normal working weights.
export function rampSteps(gap){ return gap>=56?[0.75,0.85,0.9,0.95]:gap>=28?[0.85,0.9,0.95]:[0.9,0.95]; }
const daysBetween=(a,b)=>Math.round((parseISO(b)-parseISO(a))/DAY);
const byDate=(a,b)=>a.date<b.date?-1:a.date>b.date?1:(a.createdAt||0)-(b.createdAt||0);

// Where you are in a comeback, or null when there's nothing to ease back from.
export function comebackInfo(plan,today){
  today=today||todayISO();
  if(!plan||!plan.runId) return null;
  const ss=S.sessions.slice().sort(byDate); if(!ss.length) return null;
  let anchor=null, gap=0, after=0;
  const last=ss[ss.length-1];
  if(daysBetween(last.date,today)>=GAP_DAYS){ anchor=last; gap=daysBetween(last.date,today); }
  else for(let i=ss.length-1;i>0;i--){ const g=daysBetween(ss[i-1].date,ss[i].date); if(g>=GAP_DAYS){ anchor=ss[i-1]; gap=g; after=ss.length-i; break; } }
  if(!anchor||S.settings.comebackSkip===anchor.id) return null;
  const steps=rampSteps(gap); if(after>=steps.length) return null;
  if(!planSessions(plan).some(s=>s.date<=anchor.date)) return null;   // plan started after the break: its weights are already fresh
  return {gap,steps,k:after,ramp:steps[after],anchor};
}

const rampW=(ex,w,ramp)=>ex.load==='bodyweight'?w:roundDown(ex,Math.floor(w*ramp/ST()+1e-9)*ST());
// Scale a target's working weights. 5/3/1 keeps its training max; only the sets get lighter.
export function rampTarget(t,ex,ramp){
  const n=JSON.parse(JSON.stringify(t)); n.rows.forEach(r=>{ r.w=rampW(ex,r.w,ramp); });
  if(n.kind!=='W') n.w=n.rows.length?n.rows[0].w:rampW(ex,n.w,ramp);
  n.ramp=ramp; return n;
}
export function rampEntry(e,ramp){ const ex=exById(e.exId); e.target=rampTarget(e.target,ex,ramp); e.sets.forEach((s,j)=>{ s.w=(e.target.rows[j]||e.target.rows[e.target.rows.length-1]).w; }); }

export function comebackHTML(cb){
  const pct=x=>Math.round(x*100)+'%';
  const rest=cb.steps.slice(cb.k+1).map(pct);
  const head=cb.k===0?'<b>Welcome back.</b> '+cb.gap+' days since your last workout.':'<b>Comeback session '+(cb.k+1)+' of '+cb.steps.length+'.</b>';
  return '<div class="note info stack" style="gap:6px"><div>'+head+' Today’s weights are set to <b>'+pct(cb.ramp)+'</b> of normal'+(rest.length?', then '+rest.join(', then ')+', then back to normal.':', then back to normal next time.')+' These sessions don’t move your progression up or down.</div><div><button class="ghost" data-act="skipComeback">Use my normal weights</button></div></div>';
}

Object.assign(ACT,{
  skipComeback(){ const plan=S.plans.find(p=>p.id===S.activePlanId); const cb=comebackInfo(plan); if(!cb) return; S.settings.comebackSkip=cb.anchor.id; save(); render(); toast('Back to normal weights'); }
});
