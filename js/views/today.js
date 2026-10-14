/* Iron Ledger — Today tab: start, log and edit workouts */
import { S, ST, U, esc, fmtDL, fmtW, fromLb } from '../core.js';
import { plateGfx, avail, exById, loadHTML, loadOptions, missing, roundDown, roundLoad, wtText } from '../equipment.js';
import { funHTML, sessionVolume } from '../fun.js';
import { activePlan, fromOneRM, lastUsed, planSessions, planState, schemeChip, schemeOf, setupGroups, slotKey, slotTarget, suggestStart, tgt, tgtText, verdictText } from '../engine.js';
import { V, cur } from '../state.js';
import { dayPlan, stepHTML } from '../features/plates.js';
import { addExHTML } from './history.js';
import { MAINS, analyze, badges } from './trophies.js';
import { goalNow, goalReached } from './goals.js';
import { backupDue } from './data.js';
import { cardioTodayHTML } from '../features/cardio.js';
import { prShareButton } from '../features/share.js';
import { adjustHTML } from '../features/adjust.js';
import { comebackHTML, comebackInfo, rampTarget } from '../features/comeback.js';

/* ---------- TODAY ---------- */
function goalStrip(){ const G=S.goals||{}; const ids=MAINS.filter(([id])=>G[id]); if(!ids.length) return '';
  return '<button class="gstrip" data-act="tab" data-tab="goals">'+ids.map(([id,nm])=>{ const g=G[id]; const now=goalNow(id,g.measure); const r=goalReached(id,g); const st=Math.min(g.start||0,now?now.v:0); const pct=r?100:now&&g.target>0?Math.max(0,Math.min(100,now.v/g.target*100)):0;
    return '<span class="gs"><span class="small">'+({squat:'Squat',bench:'Bench',deadlift:'Deadlift',ohp:'Press'})[id]+'</span><span class="mini"><i style="width:'+pct.toFixed(0)+'%"></i></span><span class="mono small">'+(r?'✓':fmtW(g.target))+'</span></span>'; }).join('')+'</button>'; }
function viewToday(){ const h=viewTodayMain(); return S.current?h:h+cardioTodayHTML(); }
function viewTodayMain(){
  const plan=activePlan();
  if(!plan) return '<section class="panel"><h2>No plan selected</h2><p>Pick a plan to start logging.</p><div><button class="primary" data-act="tab" data-tab="plans">Choose a plan</button></div></section>';
  if(S.current) return viewLogging(plan);
  if(!plan.runId) return viewStart(plan);
  if(!plan.days.length) return '<section class="panel"><h2>'+esc(plan.name)+' has no days</h2><div><button data-act="editPlan" data-p="'+plan.id+'">Edit plan</button></div></section>';
  const ps=planState(plan); let h='';
  if(S.lastResult) h+=resultPanel();
  const cb=comebackInfo(plan);
  const di=(V.pick!=null&&V.pick<plan.days.length)?V.pick:ps.next;
  const d=plan.days[di];
  h+='<section class="panel"><div class="row between"><div><div class="eyebrow">'+esc(plan.name)+'</div><h2>Day '+esc(d.name)+'</h2></div><button class="primary big" data-act="startWorkout" data-d="'+di+'">Start workout</button></div>';
  h+='<div class="rot" role="group" aria-label="Rotation">'+plan.days.map((x,i)=>'<button data-act="pick" data-d="'+i+'" aria-pressed="'+(i===di)+'" class="'+(i===ps.next?'next':'')+'">'+esc(x.name)+'</button>').join('')+'</div>';
  if(cb) h+=comebackHTML(cb);
  h+='<div class="lifts">';
  for(const s of d.slots){
    const ex=exById(s.exId), sc=schemeOf(plan,s), key=slotKey(plan,s);
    let t=slotTarget(plan,s,ps.lifts,ps.count); if(cb) t=rampTarget(t,ex,cb.ramp); const miss=missing(ex);
    let ld;
    if(miss.length) ld='<span class="lw warn">Needs '+esc(miss.join(', '))+'. You can swap it when you start.</span>';
    else if(sc==='W') ld='<span class="lw mono">'+t.rows.map(r=>Math.round(r.pct*100)+'% '+fmtW(r.w)).join(' · ')+'</span> '+loadHTML(ex,t.rows[t.rows.length-1].w);
    else ld=loadHTML(ex,t.w);
    h+='<div class="lift"><div class="nm">'+esc(ex.name)+' '+schemeChip(sc,t)+'</div><div class="rx">'+tgtText(t)+' <small>'+esc(wtText(ex,t))+'</small></div><div class="ld">'+ld+'</div>'+adjustHTML(plan,s,ps,t)+'</div>';
  }
  h+='</div>'+goalStrip()+'<p class="small muted">'+ps.count+' session'+(ps.count===1?'':'s')+' logged since '+fmtDL(ps.count&&planSessions(plan)[0].date<plan.startedAt?planSessions(plan)[0].date:plan.startedAt)+' · '+(plan.mode==='progress'?'Progress mode: weight goes up when you hit your targets.':'Maintain mode: weight holds steady and drops only after repeated misses.')+'</p></section>';
  return h;
}
function resultPanel(){
  const r=S.lastResult; const s=S.sessions.find(x=>x.id===r.sessionId); const plan=S.plans.find(p=>p.id===(s&&s.planId));
  if(!s||!plan){ S.lastResult=null; return ''; }
  const ps=planState(plan);
  let h='<section class="panel"><div class="row between"><div><div class="eyebrow">Logged '+fmtDL(s.date)+'</div><h2>Day '+esc(s.dayName)+' done</h2></div><button data-act="dismissResult">Dismiss</button></div><div class="stack">';
  for(const e of s.entries){ const res=ps.results[s.id+'|'+e.id]; if(!res) continue; const [cls,txt]=verdictText(res,e); h+='<div class="note '+cls+'"><b>'+esc(exById(e.exId).name)+'</b>: '+esc(txt)+'</div>'; }
  const A=analyze(); const pr=A.prs[s.id]||[]; const nb=badges().filter(b=>A.earned[b.id]&&A.earned[b.id].sid===s.id);
  if(pr.length||nb.length){ h+='<div class="celebrate"><div class="eyebrow">New today</div>'+pr.map(p=>'<div><span class="chip good">PR</span> <b>'+esc(exById(p.exId).name)+'</b>: '+esc(p.text)+' '+prShareButton(p)+'</div>').join('')+nb.map(b=>'<div class="row" style="gap:8px"><span class="medal sm">'+esc(b.mark)+'</span><span><b>Badge: '+esc(b.name)+'</b> · '+esc(b.desc)+'</span></div>').join('')+'</div>'; }
  for(const [gid,gnm] of MAINS){ const g=(S.goals||{})[gid]; if(!g) continue; const r=goalReached(gid,g); if(r&&r.date===s.date) h+='<div class="note good"><b>Goal reached:</b> '+esc(gnm)+' '+fmtW(g.target)+' '+U()+'. Set your next one on the Goals page.</div>'; }
  if(A.curStreak>0) h+='<p class="small muted">Weekly streak: <b class="mono">'+A.curStreak+'</b> week'+(A.curStreak===1?'':'s')+'.</p>';
  const due=backupDue(); if(due) h+='<div class="note warn row between"><span>'+due+' workouts since your last backup.</span><button data-act="export">Download backup</button></div>';
  return h+'</div>'+funHTML(sessionVolume(s),'Total lifted today')+'</section>';
}
function slotDesc(k){ const ex=exById(k.exId); const t=tgt(k.scheme,{w:0,stage:0,week:0},k.slot,ex); return k.scheme==='W'?'5/3/1 sets':tgtText(t); }
function pctLabel(k){ if(k.scheme==='W') return 'Training max · 90% of 1RM'; return Math.round(k.pct*100)+'% of 1RM · for '+slotDesc(k); }
function setupInfo(g,v){
  const ex=exById(g.exId);
  if(ex.load==='bodyweight') return '<span class="small muted">Weight added on top of bodyweight. Leave at 0 for none.</span>';
  const m=g.main; if(isNaN(v)) return '<span class="small muted">Enter a weight.</span>';
  const one=v/m.pct; let h='<div class="small">Estimated 1-rep max <b class="mono">'+fmtW(Math.round(one))+' '+U()+'</b></div>';
  if(m.scheme==='W'){ const t=tgt('W',{w:v,week:0},m.slot,ex); h+='<div class="small muted">Week 1 sets: <span class="mono">'+t.rows.map(r=>fmtW(r.w)).join(' · ')+'</span> ('+t.rows.map(r=>Math.round(r.pct*100)+'%').join(' / ')+' of training max)</div>'; }
  else h+='<div>'+loadHTML(ex,roundLoad(ex,v))+'</div>';
  for(const k of g.keys.slice(1)){ const w=fromOneRM(ex,k.scheme,k.slot,one); h+='<div class="small muted">Also '+esc(slotDesc(k))+' at <span class="mono">'+(k.scheme==='W'?'TM ':'')+fmtW(w)+' '+U()+'</span> ('+Math.round(k.pct*100)+'% of 1RM)</div>'; }
  return h;
}
function viewStart(plan){
  const groups=setupGroups(plan);
  let h='<section class="panel"><div><div class="eyebrow">Start '+esc(plan.name)+'</div><h2>Set your starting weights</h2></div>';
  h+='<p>Enter one weight per exercise. Each is labeled with the percentage of your 1-rep max it represents, and any other rep schemes for that lift are worked out from it. After this, every target comes from the plan’s rules and what you log.</p>';
  h+='<p class="small muted">Suggestions come from the strength estimates in your setup or your past workouts. Weights snap to what your plates can make.</p><div class="lifts">';
  for(const g of groups){
    const ex=exById(g.exId), m=g.main, miss=missing(ex);
    const w=ex.load==='bodyweight'?(lastUsed(ex.id)||0):suggestStart(g.exId,m.scheme,m.slot);
    h+='<div class="lift"><div class="stack" style="gap:2px"><div class="nm">'+esc(ex.name)+'</div><div class="small muted">'+(ex.load==='bodyweight'?'Added weight':esc(pctLabel(m)))+'</div>'+(miss.length?'<div class="small" style="color:var(--warn)">Needs '+esc(miss.join(', '))+'</div>':'')+'</div>';
    h+='<div class="row" style="justify-content:flex-end"><input type="number" inputmode="decimal" step="any" id="sw-'+g.exId+'" data-in="startW" data-ex="'+g.exId+'" value="'+w+'" style="width:96px;font-size:18px;text-align:right" aria-label="Starting weight for '+esc(ex.name)+'"><span class="small muted">'+U()+'</span></div>';
    h+='<div class="ld stack" style="gap:3px" id="si-'+g.exId+'">'+setupInfo(g,w)+'</div></div>';
  }
  h+='</div><div class="row"><button class="primary big" data-act="startPlan" data-p="'+plan.id+'">Start plan</button><button class="ghost" data-act="tab" data-tab="plans">Pick a different plan</button></div></section>';
  return h;
}
function viewLogging(plan){
  const c=S.current; const cp=S.plans.find(p=>p.id===c.planId)||plan;
  let h='<section class="panel"><div class="row between"><div><div class="eyebrow">'+esc(cp.name)+'</div><h2>Day '+esc(c.dayName)+'</h2></div><div class="row"><span class="mono muted" id="elapsed"></span><label class="f">Date<input type="date" id="cur-date" data-ch="curDate" value="'+esc(c.date)+'"></label></div></div>';
  h+='<p class="small muted">Tap ✓ when a set is done. An empty reps box fills with the target. A set marked + is as many reps as you can.</p></section>';
  c.entries.forEach((e,i)=>{ h+=entryCard(e,i); });
  h+=addExHTML();
  h+='<section class="panel"><div class="entry-foot"><label class="f">Bodyweight ('+U()+')<input type="number" inputmode="decimal" step="any" id="cur-bw" data-in="curBw" value="'+esc(c.bw||'')+'"></label><label class="f grow">Session notes<input type="text" id="cur-notes" data-in="curNotes" value="'+esc(c.notes||'')+'" placeholder="Sleep, energy, anything off"></label></div>';
  h+='<div class="row between"><button class="primary big" data-act="finish">Finish &amp; save</button><button class="danger" data-act="discard">Discard workout</button></div></section>';
  return h;
}

function warmups(ex,work,heavy){ const opts=loadOptions(ex); if(!opts.length) return []; const bar=opts[0].w; if(work<bar+fromLb(30)) return [];
  const out=[{w:bar,r:10}]; const pl=heavy?[[.5,5],[.7,3],[.85,1]]:[[.5,8],[.7,5]];
  for(const [p,r] of pl){ const w=roundDown(ex,Math.floor(work*p/ST())*ST()); if(w>out[out.length-1].w+fromLb(4)&&w<work-fromLb(4)) out.push({w,r,p}); } return out; }
function warmHTML(ex,t){ if(ex.load!=='barbell') return ''; const work=Math.max(...t.rows.map(r=>r.w)); const heavy=Math.max(...t.rows.map(r=>r.r))<=5;
  const ws=warmups(ex,work,heavy); if(ws.length<2) return '';
  return '<details class="warm"><summary>Warm-up · '+ws.length+' sets before '+fmtW(work)+' '+U()+'</summary><div class="wlist">'+ws.map((x,i)=>'<div class="wrow"><span class="mono">'+(i?Math.round(x.p*100)+'%':'Bar')+'</span><b class="mono">'+fmtW(x.w)+' × '+x.r+'</b>'+loadHTML(ex,x.w)+'</div>').join('')+'</div></details>'; }
let PP={sig:null,plan:null};
function platePlanFor(e){
  const c=cur(); if(!c||!c.entries.includes(e)) return null;
  const sig=c.entries.map(x=>x.id+':'+x.exId+':'+x.sets.map(s=>s.w).join(',')).join('|')+'|'+S.equipment.plates.map(p=>p.weight+'x'+p.qty).join(',');
  if(PP.sig!==sig) PP={sig,plan:dayPlan(c.entries,warmups)};
  return PP.plan&&PP.plan[e.id]||null;
}
function plateBlockHTML(e,ex,steps){
  const work=steps.filter(s=>s.kind==='work'), last=work[work.length-1]||steps[steps.length-1];
  const bar=S.equipment.bars.find(b=>b.kind==='barbell'&&+b.qty>0);
  let h='<div><span class="lw"><span>'+(last.side.length?fmtW(bar.weight)+' bar + each side':'Empty bar')+'</span>'+(last.side.length?plateGfx(last.side.map(w=>({weight:w})))+'<span class="mono">'+last.side.map(fmtW).join(' · ')+'</span>':'')+'</span></div>';
  const workW=Math.max(...work.map(s=>s.w)), wi=s=>work.indexOf(s);
  const lab=s=>s.kind==='warm'?(s.k===0?'Bar':Math.round(s.w/workW*100)+'%')+' × '+s.r:'Set '+(s.set+1)+(wi(s)===work.length-1&&s.set<e.sets.length-1?'–'+e.sets.length:'');
  const nw=steps.filter(s=>s.kind==='warm').length, moves=steps.reduce((a,s)=>a+s.remove.length+s.add.length,0);
  h+='<details class="warm"><summary>'+(nw?'Warm-up and plate plan · '+nw+' warm-up sets':'Plate plan')+' · '+moves+' plate move'+(moves===1?'':'s')+' per side</summary><div class="wlist">'+steps.map(s=>stepHTML(s,lab(s))).join('')+'</div><p class="small muted">Plates are listed inside to outside. Warm-up weights are nudged a little when that saves stripping plates.</p></details>';
  return h;
}
function entryCard(e,i){
  const ex=exById(e.exId), miss=missing(ex), t=e.target, R=t.rows;
  let h='<section class="entry'+(miss.length?' missing':'')+'" id="entry-'+e.id+'"><div class="row between"><div class="row"><h3>'+esc(ex.name)+'</h3>'+schemeChip(e.scheme,t)+(t.ramp?'<span class="chip">'+Math.round(t.ramp*100)+'% comeback</span>':'')+(e.exId!==e.slotExId?'<span class="chip warn">Swapped</span>':'')+'</div><div class="rx mono">'+tgtText(t)+' @ '+esc(wtText(ex,t))+'</div></div>';
  if(miss.length) h+='<div class="note warn">Your equipment list doesn’t include '+esc(miss.join(', '))+'. Swap this for something you can do below.</div>';
  else { const pp=platePlanFor(e); h+=pp?plateBlockHTML(e,ex,pp):'<div>'+loadHTML(ex,R[R.length-1].w)+'</div>'+warmHTML(ex,t); }
  h+='<div class="sets"><span class="hd">Set</span><span class="hd">'+(ex.load==='bodyweight'?'Added '+U():'Weight'+(ex.load==='dumbbell'?' / hand':''))+'</span><span class="hd">Reps</span><span></span>';
  e.sets.forEach((s,j)=>{
    const row=R[j]||R[R.length-1]; const am=!!(R[j]&&R[j].amrap); const ph=t.kind==='D'?t.params.repMin+'–'+t.params.repMax:row.r+(am?'+':'');
    h+='<span class="sn"'+(am?' style="color:var(--accent)"':'')+'>'+(j+1)+(am?'+':'')+'</span>';
    h+='<input type="number" inputmode="decimal" step="any" id="w-'+e.id+'-'+j+'" data-in="setW" data-i="'+i+'" data-j="'+j+'" value="'+esc(s.w)+'" class="'+(s.done?'dn':'')+'" aria-label="Set '+(j+1)+' weight">';
    h+='<input type="number" inputmode="numeric" step="1" id="r-'+e.id+'-'+j+'" data-in="setR" data-i="'+i+'" data-j="'+j+'" value="'+esc(s.r)+'" placeholder="'+ph+'" class="'+(s.done?'dn':'')+'" aria-label="Set '+(j+1)+' reps">';
    h+='<button class="chk" data-act="done" data-i="'+i+'" data-j="'+j+'" aria-pressed="'+(!!s.done)+'" aria-label="Set '+(j+1)+' done">✓</button>';
  });
  h+='</div><div id="lw-'+e.id+'" class="small"></div><div class="row"><button class="ghost" data-act="addSet" data-i="'+i+'">+ Set</button>'+(e.sets.length>1?'<button class="ghost" data-act="rmSet" data-i="'+i+'">− Set</button>':'')+'<button class="ghost danger" data-act="rmEntry" data-i="'+i+'" style="margin-left:auto">Remove exercise</button></div>';
  const alts=S.exercises.filter(x=>x.id!==e.exId&&avail(x)); const same=alts.filter(x=>x.pattern===ex.pattern), other=alts.filter(x=>x.pattern!==ex.pattern);
  h+='<div class="entry-foot"><label class="f">RPE<select id="rpe-'+e.id+'" data-ch="rpe" data-i="'+i+'"><option value="">—</option>'+[6,6.5,7,7.5,8,8.5,9,9.5,10].map(v=>'<option'+(String(e.rpe)===String(v)?' selected':'')+'>'+v+'</option>').join('')+'</select></label>';
  h+='<label class="f grow">Notes<input type="text" id="n-'+e.id+'" data-in="enNotes" data-i="'+i+'" value="'+esc(e.notes||'')+'"></label>';
  h+='<label class="f grow">Swap exercise<select id="swp-'+e.id+'" data-ch="swap" data-i="'+i+'"><option value="">Keep '+esc(ex.name)+'</option>'+(same.length?'<optgroup label="Same movement">'+same.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('')+'</optgroup>':'')+'<optgroup label="Other">'+other.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('')+'</optgroup></select></label></div>';
  return h+'</section>';
}

export { warmups, entryCard, setupInfo, slotDesc, viewToday };
