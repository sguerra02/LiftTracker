/* Iron Ledger — Change upcoming weights: set a lift's working weight (or 5/3/1 training max) for this and later workouts */
import { DERIVED, S, U, esc, fmtW, save, todayISO } from '../core.js';
import { exById, roundLoad } from '../equipment.js';
import { activePlan, planState, schemeOf, slotKey } from '../engine.js';
import { V, render } from '../state.js';
import { toast } from '../ui.js';
import { ACT } from '../registry.js';

/* Each change is stored on the plan as {key, w, at, runId}. `at` is how many workouts had been logged when it was made,
   so the engine applies it at that point in the replay and progression carries on from the new weight. */
const forRun=plan=>(plan.adjust||[]).filter(a=>a.runId===plan.runId);
export const adjustedNow=(plan,key,count)=>forRun(plan).find(a=>a.key===key&&a.at===count)||null;

function baseOf(plan,slot,ps){
  const key=slotKey(plan,slot); const st=ps.lifts[key];
  return st?st.w:null;
}

// The control under one lift on the Today preview.
export function adjustHTML(plan,slot,ps,t){
  const sc=schemeOf(plan,slot); if(DERIVED[sc]) return '';
  const key=slotKey(plan,slot), ex=exById(slot.exId), adj=adjustedNow(plan,key,ps.count);
  const base=baseOf(plan,slot,ps); const cur=base!=null?base:t.w;
  const what=sc==='W'?'training max':ex.load==='bodyweight'?'added weight':'working weight';
  if(V.adj===key){
    return '<div class="adj stack" style="gap:8px"><div class="row"><label class="f">New '+what+' ('+U()+(ex.load==='dumbbell'?' each':'')+')<input type="number" inputmode="decimal" step="any" min="0" id="adj-w" value="'+esc(fmtW(cur))+'" style="width:110px"></label><button class="primary" data-act="adjSave" data-k="'+esc(key)+'">Save</button><button class="ghost" data-act="adjCancel">Cancel</button></div>'+
      '<p class="small muted">Applies to every upcoming workout with '+esc(ex.name)+(/^T[123]$/.test(sc)?' as '+sc:'')+' on this plan. Progression carries on from the new '+what+'.</p></div>';
  }
  return '<div class="adj row">'+(adj?'<span class="chip t2">Changed from '+fmtW(adj.from)+'</span><button class="ghost small" data-act="adjUndo" data-k="'+esc(key)+'">Undo</button>':'')+'<button class="ghost small" data-act="adjOpen" data-k="'+esc(key)+'">Change weight</button></div>';
}

Object.assign(ACT,{
  adjOpen(b){ V.adj=b.dataset.k; render(); const el=document.getElementById('adj-w'); if(el){ el.focus(); el.select(); } },
  adjCancel(){ V.adj=null; render(); },
  adjSave(b){
    const plan=activePlan(); if(!plan) return; const key=b.dataset.k; const [exId,sc]=key.split('|'); const ex=exById(exId);
    const v=parseFloat(document.getElementById('adj-w').value); if(!(v>=0)){ toast('Enter a weight'); return; }
    const w=ex.load==='bodyweight'||sc==='W'?Math.round(v*100)/100:roundLoad(ex,v);
    const ps=planState(plan); const st=ps.lifts[key]; const prev=adjustedNow(plan,key,ps.count);
    const from=prev?prev.from:(st?st.w:null);   // the plan's own weight, before any change made at this point
    plan.adjust=(plan.adjust||[]).filter(a=>!(a.runId===plan.runId&&a.key===key&&a.at===ps.count));
    if(from==null||Math.abs(w-from)>0.001) plan.adjust.push({key,w,at:ps.count,runId:plan.runId,date:todayISO(),from});
    V.adj=null; save(); render();
    toast(Math.abs(w-v)>0.01?'Set to '+fmtW(w)+' '+U()+', the closest your plates can load':'Weight updated');
  },
  adjUndo(b){
    const plan=activePlan(); if(!plan) return; const ps=planState(plan);
    plan.adjust=(plan.adjust||[]).filter(a=>!(a.runId===plan.runId&&a.key===b.dataset.k&&a.at===ps.count));
    save(); render(); toast('Back to the plan’s weight');
  }
});
