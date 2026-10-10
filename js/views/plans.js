/* Iron Ledger — Plan picker and plan editor */
import { S, SCHEME_NAME, TYPES, U, esc, fmtDL } from '../core.js';
import { avail, exById, missing } from '../equipment.js';
import { planSessions, schemeOf, weekLen } from '../engine.js';
import { V } from '../state.js';

import { planImportHTML } from '../features/share.js';
/* ---------- PLANS ---------- */
function viewPlans(){
  if(V.editPlan){ const p=S.plans.find(x=>x.id===V.editPlan); if(p) return viewPlanEdit(p); V.editPlan=null; }
  let h='<section class="panel"><div><h2>Plans</h2><p class="muted small">Workouts rotate through a plan’s days in order, however many days a week you train. Each plan has its own rule for what the next workout looks like.</p></div><label class="row small" style="gap:8px;align-items:flex-start"><input type="checkbox" id="rpe-adj" data-ch="rpeAdj"'+(S.settings.rpeAdjust!==false?' checked':'')+' style="margin-top:2px"><span><b>Let RPE adjust progression.</b> When you hit your targets: RPE 9.5–10 holds the weight one more time, RPE 6.5 or lower jumps two steps. Leave RPE blank to use the normal rule. Doesn’t apply to 5/3/1 main lifts or T3 accessories.</span></label><div>';
  for(const p of S.plans){
    if(p.archived) continue;
    const on=p.id===S.activePlanId; const n=p.runId?planSessions(p).length:0; const bad=p.days.flatMap(d=>d.slots).filter(s=>!avail(exById(s.exId))).length; const T=TYPES[p.type]||TYPES.double;
    h+='<div class="plan-card"><div><div class="row"><h3>'+esc(p.name)+'</h3>'+(on?'<span class="chip good">Active</span>':'')+(bad?'<span class="chip warn">'+bad+' exercise'+(bad>1?'s':'')+' need equipment</span>':'')+'</div><p class="small muted">'+T.label+' · '+p.days.length+'-day rotation ('+p.days.map(d=>esc(d.name)).join(' → ')+') · '+(p.mode==='progress'?'Progress':'Maintain')+(p.runId?' · started '+fmtDL(p.startedAt)+', '+n+' logged':' · not started')+'</p><p class="small">'+esc(T.desc)+'</p></div>';
    h+='<div class="row">'+(on?'':'<button class="primary" data-act="usePlan" data-p="'+p.id+'">Use this plan</button>')+'<button data-act="editPlan" data-p="'+p.id+'">Edit</button><button data-act="dupPlan" data-p="'+p.id+'">Duplicate</button><button data-act="planShare" data-p="'+p.id+'">Share</button>'+(p.runId?'<button data-act="restartPlan" data-p="'+p.id+'">Restart with new weights</button>':'')+'<button class="danger" data-act="delPlan" data-p="'+p.id+'">Delete</button></div></div>';
  }
  h+='</div><div class="row"><select id="np-type" data-ch="newType" aria-label="Plan type">'+Object.keys(TYPES).map(k=>'<option value="'+k+'"'+(V.newType===k?' selected':'')+'>'+TYPES[k].label+'</option>').join('')+'</select><button data-act="newPlan">+ New blank plan</button></div></section>';
  h+=planImportHTML();
  return h;
}
function exOptions(sel){
  const list=S.exercises.slice().sort((a,b)=>a.name.localeCompare(b.name));
  let h=''; const cur=exById(sel);
  if(sel&&!avail(cur)) h+='<option value="'+sel+'" selected>'+esc(cur.name)+' (needs '+esc(missing(cur).join(', '))+')</option>';
  for(const e of list){ if(!avail(e)) continue; h+='<option value="'+e.id+'"'+(e.id===sel?' selected':'')+'>'+esc(e.name)+'</option>'; }
  return h;
}
function paramInputs(p,di,si,s){
  const sc=schemeOf(p,s); const f=[];
  if(sc==='L') f.push(['sets','Sets'],['reps','Reps'],['inc','+'+U()]);
  else if(sc==='G') f.push(['sets','Sets']);
  else if(sc==='D') f.push(['sets','Sets'],['repMin','Reps'],['repMax','to']);
  const dflt={sets:3,reps:5,repMin:8,repMax:12,inc:''};
  return f.map(([k,l])=>'<label class="small muted">'+l+' <input type="number" min="1" step="1" id="pn-'+s.id+'-'+k+'" data-ch="slotNum" data-f="'+k+'" data-p="'+p.id+'" data-d="'+di+'" data-s="'+si+'" value="'+esc(s[k]!=null?s[k]:dflt[k])+'"></label>').join('');
}
function viewPlanEdit(p){
  const T=TYPES[p.type]||TYPES.double;
  let h='<section class="panel"><div class="row between"><h2>Edit plan</h2><button class="primary" data-act="doneEdit">Done</button></div>';
  if(p.type==='w531') h+='<div class="row"><label class="f">Days per 5/3/1 week<input type="number" min="1" step="1" id="pe-wl" data-ch="planNum" data-f="weekLen" data-p="'+p.id+'" value="'+esc(weekLen(p))+'" style="width:80px"></label><label class="row small"><input type="checkbox" id="pe-dl" data-ch="planDeload" data-p="'+p.id+'"'+(p.deload===false?'':' checked')+'> Include deload week</label><label class="f">BBB weight (% of TM)<input type="number" min="30" max="80" step="5" id="pe-bbb" data-ch="planNum" data-f="bbbPct" data-p="'+p.id+'" value="'+Math.round((+p.bbbPct||0.5)*100)+'" style="width:80px"></label></div><p class="small muted">The week advances after every '+weekLen(p)+' workouts, so each lift uses the same week’s percentages until the week is done. Training maxes go up at the end of each '+(p.deload===false?'3':'4')+'-week cycle.</p>';
  h+='<div class="entry-foot"><label class="f grow">Name<input type="text" id="pe-name" data-ch="planName" data-p="'+p.id+'" value="'+esc(p.name)+'"></label><label class="f">Mode<select id="pe-mode" data-ch="planMode" data-p="'+p.id+'"><option value="progress"'+(p.mode==='progress'?' selected':'')+'>Progress</option><option value="maintain"'+(p.mode==='maintain'?' selected':'')+'>Maintain</option></select></label></div>';
  h+='<p class="small muted"><b>'+T.label+'.</b> '+esc(T.desc)+' Only exercises your equipment supports are listed.</p>';
  p.days.forEach((d,di)=>{
    h+='<div class="day"><div class="row between"><label class="f">Day name<input type="text" id="pd-'+d.id+'" data-ch="dayName" data-p="'+p.id+'" data-d="'+di+'" value="'+esc(d.name)+'" style="width:130px"></label><div class="row" style="gap:4px"><button class="mv" data-act="mvDay" data-p="'+p.id+'" data-d="'+di+'" data-dir="-1" aria-label="Move day up"'+(di===0?' disabled':'')+'>↑</button><button class="mv" data-act="mvDay" data-p="'+p.id+'" data-d="'+di+'" data-dir="1" aria-label="Move day down"'+(di===p.days.length-1?' disabled':'')+'>↓</button><button class="danger ghost" data-act="rmDay" data-p="'+p.id+'" data-d="'+di+'">Remove day</button></div></div>';
    d.slots.forEach((s,si)=>{
      const miss=missing(exById(s.exId)); const sc=schemeOf(p,s);
      h+='<div class="slot"><select class="ex" id="ps-'+s.id+'" data-ch="slotEx" data-p="'+p.id+'" data-d="'+di+'" data-s="'+si+'" aria-label="Exercise">'+exOptions(s.exId)+'</select>';
      if(T.schemes.length>1) h+='<select id="pt-'+s.id+'" data-ch="slotScheme" data-p="'+p.id+'" data-d="'+di+'" data-s="'+si+'" aria-label="Set scheme">'+T.schemes.map(k=>'<option value="'+k+'"'+(sc===k?' selected':'')+'>'+SCHEME_NAME[k]+'</option>').join('')+'</select>';
      h+=paramInputs(p,di,si,s);
      h+='<span class="row" style="gap:2px"><button class="mv" data-act="mvSlot" data-p="'+p.id+'" data-d="'+di+'" data-s="'+si+'" data-dir="-1" aria-label="Move up"'+(si===0?' disabled':'')+'>↑</button><button class="mv" data-act="mvSlot" data-p="'+p.id+'" data-d="'+di+'" data-s="'+si+'" data-dir="1" aria-label="Move down"'+(si===d.slots.length-1?' disabled':'')+'>↓</button></span><button class="ghost danger" data-act="rmSlot" data-p="'+p.id+'" data-d="'+di+'" data-s="'+si+'" aria-label="Remove exercise">✕</button>'+(miss.length?'<span class="chip warn">needs '+esc(miss.join(', '))+'</span>':'')+'</div>';
    });
    h+='<div><button class="ghost" data-act="addSlot" data-p="'+p.id+'" data-d="'+di+'">+ Exercise</button></div></div>';
  });
  h+='<div class="row"><button data-act="addDay" data-p="'+p.id+'">+ Day</button></div>';
  if(p.runId) h+='<p class="small muted">Changes apply from the next workout. New lifts start at a suggested weight you can adjust while logging.</p>';
  return h+'</section>';
}

export { viewPlans };
