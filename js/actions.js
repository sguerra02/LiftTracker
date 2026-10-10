/* Iron Ledger — Event handlers, import/export */
import { $, REST, S, TYPES, U, day, defaultPlans, defaultState, iso, load, migrate, mkPlan, parseISO, realBackup, save, saveSoon, setRealBackup, setS, todayISO, uid } from './core.js';
import { eqChanged, exById, loadHTML, loadOptions, roundLoad, station } from './equipment.js';
import { checkEntries, compareText, fmtBig } from './fun.js';
import { activePlan, buildEntries, fromOneRM, lastUsed, planState, setupGroups, suggestStart, tgt } from './engine.js';
import { EDIT, V, cur, goTab, render, setEDIT, tab } from './state.js';
import { setupInfo } from './views/today.js';
import { muscleReadout } from './views/report.js';
import { convertUnits, wizFinish, wizInit } from './views/wizard.js';
import { goalNow } from './views/goals.js';
import { drawCharts } from './charts.js';
import { makeSample } from './sample.js';
import { scheduleRestAlert } from './features/alerts.js';
import { comebackInfo, rampEntry } from './features/comeback.js';
import { importPlanText } from './features/share.js';
import { P, askConfirm, closeModal, confirmFn, newSlot, setTimer, startRest, tick, timer, toast, wakeOff, wakeOn } from './ui.js';

import { ACT, CH, IN } from './registry.js';
/* ---------- actions ---------- */
Object.assign(ACT,{
  tab(b){ goTab(b.dataset.tab); V.editPlan=null; try{localStorage.setItem('ironledger.tab',tab); localStorage.setItem('ironledger.sub',JSON.stringify(V.sub));}catch(e){} render(); window.scrollTo(0,0); },
  sub(b){ V.sub[b.dataset.p]=b.dataset.s; try{localStorage.setItem('ironledger.sub',JSON.stringify(V.sub));}catch(e){} render(); window.scrollTo(0,0); },
  pick(b){ V.pick=+b.dataset.d; render(); },
  startPlan(b){ const p=P(b.dataset.p); p.start={};
    for(const g of setupGroups(p)){ const ex=exById(g.exId); const inp=document.getElementById('sw-'+g.exId); let v=inp?parseFloat(inp.value):NaN;
      if(isNaN(v)) v=ex.load==='bodyweight'?0:suggestStart(g.exId,g.main.scheme,g.main.slot);
      if(ex.load==='bodyweight'){ g.keys.forEach(k=>p.start[k.key]=Math.max(0,v)); continue; }
      const one=v/g.main.pct;
      g.keys.forEach((k,i)=>{ p.start[k.key]= i===0 ? (k.scheme==='W'?v:roundLoad(ex,v)) : fromOneRM(ex,k.scheme,k.slot,one); }); }
    p.runId=uid(); p.startedAt=todayISO(); S.activePlanId=p.id; S.lastResult=null; save(); V.pick=null; render(); toast('Plan started'); },
  startWorkout(b){ const plan=activePlan(); const di=+b.dataset.d; const ps=planState(plan);
    S.current={id:uid(),planId:plan.id,runId:plan.runId,dayIndex:di,dayName:plan.days[di].name,date:todayISO(),startedAt:Date.now(),entries:buildEntries(plan,di,ps.lifts),bw:'',notes:''};
    const cb=comebackInfo(plan); if(cb){ S.current.entries.forEach(e=>rampEntry(e,cb.ramp)); S.current.ramp=cb.ramp; }
    S.lastResult=null; save(); wakeOn(); render(); window.scrollTo(0,0); },
  done(b){ const i=+b.dataset.i, j=+b.dataset.j; const e=cur().entries[i], s=e.sets[j]; s.done=!s.done; if(s.done){ if(!EDIT) s.t=Date.now(); } else delete s.t;
    const R=e.target.rows; if(s.done&&(s.r===''||s.r==null)){ s.r=(R[j]||R[R.length-1]).r; const ri=$('#r-'+e.id+'-'+j); if(ri) ri.value=s.r; }
    b.setAttribute('aria-pressed',String(s.done)); ['w','r'].forEach(k=>{ const x=$('#'+k+'-'+e.id+'-'+j); if(x) x.classList.toggle('dn',s.done); });
    if(s.done&&!EDIT){ const allDone=cur().entries.every(en=>en.sets.every(z=>z.done)); if(!allDone) startRest(REST[e.scheme]||90,exById(e.exId).name); }
    save(); },
  addSet(b){ const e=cur().entries[+b.dataset.i]; const l=e.sets[e.sets.length-1]; e.sets.push({w:l?l.w:e.target.w,r:'',done:false}); save(); render(); },
  rmSet(b){ const e=cur().entries[+b.dataset.i]; if(e.sets.length>1) e.sets.pop(); save(); render(); },
  finish(){ const c=S.current; const any=c.entries.some(e=>e.sets.some(s=>s.done));
    const go=()=>{ const plan=P(c.planId); const s={id:c.id,date:c.date||todayISO(),createdAt:Date.now(),startedAt:c.startedAt,endedAt:Date.now(),planId:c.planId,runId:c.runId,mode:plan?plan.mode:'progress',dayIndex:c.dayIndex,dayName:c.dayName,entries:c.entries,bw:parseFloat(c.bw)||null,notes:c.notes||''}; if(c.ramp) s.ramp=c.ramp;
      S.sessions.push(s); S.current=null; S.lastResult={sessionId:s.id}; V.pick=null; setTimer(null); $('#rest').hidden=true; wakeOff(); save(); render(); window.scrollTo(0,0); toast('Workout saved'); };
    if(!any){ askConfirm('No sets checked','Nothing is marked done. Save this as a skipped workout anyway? It still moves the rotation forward.','Save anyway',go); return; }
    const iss=checkEntries(c.entries,c.id); if(iss.length) askConfirm('Double-check these numbers',iss,'Save anyway',go,'Go back and fix'); else go(); },
  discard(){ askConfirm('Discard this workout?','Everything logged in this session will be thrown away.','Discard',()=>{ S.current=null; setTimer(null); $('#rest').hidden=true; wakeOff(); save(); render(); }); },
  dismissResult(){ S.lastResult=null; save(); render(); },
  restAdd(){ if(timer){ timer.end+=30000; timer.total+=30; timer.beeped=false; tick(); scheduleRestAlert(timer); } },
  restStop(){ setTimer(null); $('#rest').hidden=true; },

  editSession(b){ const s=S.sessions.find(x=>x.id===b.dataset.s); if(!s) return; setEDIT(JSON.parse(JSON.stringify(s))); render(); window.scrollTo(0,0); },
  cancelEdit(){ setEDIT(null); render(); },
  saveEdit(b){ if(!(b&&b.dataset.force)){ const iss=checkEntries(EDIT.entries,EDIT.id); if(iss.length){ askConfirm('Double-check these numbers',iss,'Save anyway',()=>ACT.saveEdit({dataset:{force:1}}),'Go back and fix'); return; } } const i=S.sessions.findIndex(x=>x.id===EDIT.id); if(i<0){ setEDIT(null); render(); return; } const bw=parseFloat(EDIT.bw); EDIT.bw=isNaN(bw)?null:bw; S.sessions[i]=EDIT; setEDIT(null); save(); render(); window.scrollTo(0,0); toast('Workout updated'); },
  loadDay(){ const plan=P(EDIT.planId); if(!plan) return; const d=plan.days[EDIT.dayIndex]; if(!d) return;
    askConfirm('Use Day '+d.name+'’s exercises?','The exercises in this workout are replaced with Day '+d.name+'’s lineup at the weights the plan had set for that date. Sets logged here are cleared.','Replace',()=>{ const st=planState(plan,EDIT); EDIT.entries=buildEntries(plan,EDIT.dayIndex,st.lifts,st.count); render(); }); },
  rmEntry(b){ const c=cur(); const i=+b.dataset.i; const e=c.entries[i]; askConfirm('Remove '+exById(e.exId).name+'?','It is taken out of this workout along with its sets.','Remove',()=>{ c.entries.splice(i,1); if(!EDIT) save(); render(); }); },
  reroll(b){ const el=document.getElementById(b.dataset.t); if(el) el.textContent=compareText(+b.dataset.v); },
  repPrev(){ const d=parseISO(V.repWeek); V.repWeek=iso(new Date(d.getFullYear(),d.getMonth(),d.getDate()-7)); render(); },
  repNext(){ const d=parseISO(V.repWeek); V.repWeek=iso(new Date(d.getFullYear(),d.getMonth(),d.getDate()+7)); render(); },
  calPrev(){ const [y,m]=V.calMonth.split('-').map(Number); V.calMonth=iso(new Date(y,m-2,1)).slice(0,7); render(); },
  calNext(){ const [y,m]=V.calMonth.split('-').map(Number); V.calMonth=iso(new Date(y,m,1)).slice(0,7); render(); },
  calOpen(b){ V.openSess=b.dataset.s; render(); const el=document.getElementById('sess-'+b.dataset.s); if(el){ el.open=true; el.scrollIntoView({behavior:'smooth',block:'start'}); } },
  bwAdd(){ const w=parseFloat($('#bw-new').value); if(!(w>0)){ toast('Enter a weight in pounds'); return; } S.bodyweights=S.bodyweights||[]; S.bodyweights.push({id:uid(),date:$('#bw-date').value||todayISO(),w}); save(); render(); toast('Bodyweight logged'); },
  bwDel(b){ S.bodyweights=(S.bodyweights||[]).filter(x=>x.id!==b.dataset.id); save(); render(); },
  rpeToggle(){},
  muscle(b){ const k=b.getAttribute('data-m'); V.muscle=V.muscle===k?null:k;
    document.querySelectorAll('.mz').forEach(el=>el.classList.toggle('sel',el.getAttribute('data-m')===V.muscle));
    document.querySelectorAll('.mrow').forEach(el=>el.classList.toggle('sel',el.getAttribute('data-m')===V.muscle));
    const r=$('#mread'); if(r) r.innerHTML=muscleReadout(); },
  histRange(b){ V.histRange=b.dataset.r; document.querySelectorAll('[data-act=histRange]').forEach(x=>x.setAttribute('aria-pressed',String(x===b))); drawCharts(); },
  wizUnit(b){ const o=V.wiz; V.wiz=Object.assign(wizInit(b.dataset.u),{stations:o.stations,level:o.level,plan:o.plan,handles:o.handles}); render(); },
  wizFinish(){ wizFinish(); },
  rerunSetup(){ askConfirm('Run setup again?','Your equipment list is replaced by what you enter. Workouts, plans and history stay.','Start setup',()=>{ S.settings.setupDone=false; V.wiz=wizInit(U()); save(); goTab('today'); render(); }); },
  unitSwitch(b){ const to=b.dataset.u; askConfirm('Switch to '+to+'?','Every weight in your log, plans, bodyweight and equipment is converted ('+(to==='kg'?'1 lb = 0.4536 kg':'1 kg = 2.2046 lb')+'). If you actually own '+to+' plates, update them on the Equipment page afterward.','Convert',()=>convertUnits(to)); },
  mvDay(b){ const p=P(b.dataset.p); const i=+b.dataset.d, j=i+(+b.dataset.dir); if(j<0||j>=p.days.length) return; const t=p.days[i]; p.days[i]=p.days[j]; p.days[j]=t; save(); render(); },
  mvSlot(b){ const p=P(b.dataset.p); const d=p.days[+b.dataset.d]; const i=+b.dataset.s, j=i+(+b.dataset.dir); if(j<0||j>=d.slots.length) return; const t=d.slots[i]; d.slots[i]=d.slots[j]; d.slots[j]=t; save(); render(); },
  goalSet(b){ const id=b.dataset.id; const t=parseFloat($('#gt-'+id).value); if(!(t>0)){ toast('Enter a goal weight'); return; } const m=$('#gm-'+id).value; const now=goalNow(id,m);
    if(now&&now.v>=t){ toast('You’re already at '+fmtBig(now.v)+'. Pick something higher.'); return; }
    S.goals=S.goals||{}; S.goals[id]={target:t,measure:m,set:todayISO(),start:now?Math.round(now.v):0}; save(); render(); toast('Goal set'); },
  goalClear(b){ const id=b.dataset.id; askConfirm('Remove this goal?','Your workouts aren’t affected.','Remove',()=>{ delete S.goals[id]; save(); render(); }); },
  goalFill(b){ const el=$('#gt-'+b.dataset.id); if(el){ el.value=b.dataset.v; el.focus(); } },
  cYes(){ const f=confirmFn; closeModal(); f&&f(); },
  cNo(){ closeModal(); },
  delSession(b){ askConfirm('Delete this workout?','Its sets are removed and the plan’s next targets are recalculated.','Delete',()=>{ S.sessions=S.sessions.filter(s=>s.id!==b.dataset.s); if(S.lastResult&&S.lastResult.sessionId===b.dataset.s) S.lastResult=null; save(); render(); }); },
  showAll(){ V.showAll=true; render(); },
  usePlan(b){ if(S.current){ toast('Finish or discard the current workout first'); return; } S.activePlanId=b.dataset.p; S.lastResult=null; V.pick=null; save(); goTab('today'); render(); window.scrollTo(0,0); },
  editPlan(b){ V.editPlan=b.dataset.p; goTab('plans'); render(); },
  doneEdit(){ V.editPlan=null; render(); },
  dupPlan(b){ const p=JSON.parse(JSON.stringify(P(b.dataset.p))); p.id=uid(); p.name=p.name+' (copy)'; p.runId=null; p.start={}; p.startedAt=null; p.days.forEach(d=>{d.id=uid(); d.slots.forEach(s=>s.id=uid());}); S.plans.push(p); save(); render(); },
  restartPlan(b){ const p=P(b.dataset.p); askConfirm('Restart '+p.name+'?','You’ll set new starting weights. Past workouts stay in History but no longer drive this plan’s targets.','Restart',()=>{ p.runId=null; p.start={}; p.startedAt=null; S.activePlanId=p.id; save(); goTab('today'); render(); }); },
  delPlan(b){ const p=P(b.dataset.p); askConfirm('Delete '+p.name+'?','The plan is removed. Workouts you logged with it stay in History.','Delete',()=>{ S.plans=S.plans.filter(x=>x.id!==p.id); if(defaultPlans().some(d=>d.id===p.id)) S.deletedDefaults.push(p.id); if(S.activePlanId===p.id) S.activePlanId=S.plans[0]?S.plans[0].id:null; save(); render(); }); },
  newPlan(){ const t=V.newType; const p=mkPlan(uid(),'New '+TYPES[t].label+' plan',t,[day('A',[])]); p.days[0].slots.push(newSlot(p)); S.plans.push(p); V.editPlan=p.id; save(); render(); },
  addDay(b){ const p=P(b.dataset.p); p.days.push(day(String.fromCharCode(65+p.days.length%26),[])); save(); render(); },
  rmDay(b){ const p=P(b.dataset.p); const di=+b.dataset.d; if(p.days.length<=1){ toast('A plan needs at least one day'); return; } p.days.splice(di,1); save(); render(); },
  addSlot(b){ const p=P(b.dataset.p); const d=p.days[+b.dataset.d]; d.slots.push(newSlot(p,p.type==='gzclp'?'T3':(p.type==='double'?'D':null))); save(); render(); },
  rmSlot(b){ const p=P(b.dataset.p); p.days[+b.dataset.d].slots.splice(+b.dataset.s,1); save(); render(); },
  addEq(b){ const k=b.dataset.k; const E=S.equipment; if(k==='bars') E.bars.push({id:uid(),name:'New bar',kind:'barbell',weight:U()==='kg'?20:45,qty:1}); if(k==='plates') E.plates.push({id:uid(),weight:U()==='kg'?20:45,qty:2}); if(k==='fixed') E.fixed.push({id:uid(),name:'Dumbbell',weight:U()==='kg'?10:25,qty:2}); eqChanged(); save(); render(); },
  rmEq(b){ const k=b.dataset.k; S.equipment[k]=S.equipment[k].filter(x=>x.id!==b.dataset.id); eqChanged(); save(); render(); },
  addStation(){ const v=$('#new-station').value.trim(); if(!v) return; S.equipment.stations.push({id:'st-'+uid(),name:v,on:true}); save(); render(); },
  addEx(){ const name=$('#nx-name').value.trim(); if(!name){ toast('Give the exercise a name'); return; } const req=[...document.querySelectorAll('.nx-req:checked')].map(x=>x.value);
    S.exercises.push({id:'x-'+uid(),name,load:$('#nx-load').value,req,pattern:$('#nx-pat').value,inc:parseFloat($('#nx-inc').value)||0,custom:true}); save(); render(); toast(name+' added'); },
  rmEx(b){ const id=b.dataset.id; const used=S.plans.some(p=>p.days.some(d=>d.slots.some(s=>s.exId===id))); if(used){ toast('Remove it from your plans first'); return; } S.exercises=S.exercises.filter(e=>e.id!==id); save(); render(); },
  async export(){ const o=JSON.parse(JSON.stringify(S)); delete o.demo; const text=JSON.stringify({app:'iron-ledger',exported:new Date().toISOString(),data:o});
    const filename='iron-ledger-'+todayISO()+'.json', blob=new Blob([text],{type:'application/json'});
    const done=()=>{ V.exportText=''; S.settings.lastBackupN=S.sessions.length; S.settings.lastBackupDate=todayISO(); save(); toast('Backup saved'); render(); };
    try{ const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),4000); done(); }
    catch(e){ V.exportText=text; render(); } },
  copyExport(){ const ta=$('#export-text'); try{ navigator.clipboard.writeText(V.exportText).then(()=>toast('Copied'),()=>{ ta.select(); toast('Selected. Use your copy command.'); }); }catch(e){ ta.select(); toast('Selected. Use your copy command.'); } },
  import(){ doImport(($('#import-text')||{}).value||V.importText); },
  demo(){ if(S.current){ toast('Finish or discard the current workout first'); return; } setRealBackup(S); makeSample(); goTab('history'); render(); },
  exitDemo(){ setS(realBackup||load()); setRealBackup(null); eqChanged(); render(); },
  reset(){ askConfirm('Erase all data?','Every workout, plan and equipment change in this browser is deleted.','Erase',()=>{ setS(defaultState()); eqChanged(); save(); goTab('today'); render(); }); }
});
Object.assign(CH,{
  curDate(t){ cur().date=t.value||todayISO(); save(); },
  rpe(t){ cur().entries[+t.dataset.i].rpe=t.value; save(); },
  swap(t){ if(!t.value) return; const e=cur().entries[+t.dataset.i]; const ex=exById(t.value); const plan=P(cur().planId);
    e.exId=ex.id; e.key=ex.id+'|'+e.scheme; const ps=plan?planState(plan):{lifts:{}}; const st=ps.lifts[e.key];
    const lu=lastUsed(ex.id); const w=st?st.w:(e.scheme!=='W'&&lu!=null?lu:suggestStart(ex.id,e.scheme,e.target.params));
    e.target=tgt(e.scheme,Object.assign({stage:0,week:e.target.week||0},st||{},{w}),e.target.params,ex);
    e.sets.forEach((s,j)=>{ if(!s.done) s.w=(e.target.rows[j]||e.target.rows[e.target.rows.length-1]).w; }); save(); render(); },

  editDay(t){ const plan=P(EDIT.planId); const i=+t.value; EDIT.dayIndex=i; EDIT.dayName=plan.days[i].name; },
  addEntry(t){ if(!t.value) return; const c=cur(); const ex=exById(t.value); const params={sets:3,repMin:8,repMax:12};
    const lu=lastUsed(ex.id); const w=lu!=null?lu:suggestStart(ex.id,'D',params); const tg=tgt('D',{w,stage:0,week:0},params,ex);
    c.entries.push({id:uid(),key:ex.id+'|D',exId:ex.id,slotExId:ex.id,scheme:'D',target:tg,sets:tg.rows.map(r=>({w:r.w,r:'',done:false})),rpe:'',notes:''}); if(!EDIT) save(); render(); },
  rpeAdj(t){ S.settings.rpeAdjust=t.checked; save(); render(); },
  setBw(t){ S.settings.bw=parseFloat(t.value)||null; save(); render(); },
  year(t){ V.year=t.value; render(); },
  wizBar(t){ const w=V.wiz; w.barType=t.value; const kg=w.unit==='kg'; w.barW=t.value==='olympic'?(kg?20:45):t.value==='standard'?(kg?7:15):0; render(); },
  wizHandles(t){ V.wiz.handles=+t.value; render(); },
  wizSt(t){ V.wiz.stations[t.dataset.id]=t.checked; },
  wizLevel(t){ V.wiz.level=t.value; },
  wizPlan(t){ V.wiz.plan=t.value; render(); },
  histEx(t){ V.histEx=t.value; drawCharts(); },
  histM(t){ V.histMetric=t.value; drawCharts(); },
  hs(t){ const s=S.sessions.find(x=>x.id===t.dataset.s); const set=s.entries[+t.dataset.e].sets[+t.dataset.j]; const f=t.dataset.f;
    if(f==='done') set.done=t.checked; else set[f]=t.value===''?'':parseFloat(t.value); save(); drawCharts(); },
  spw(t){ V.projSpw=parseFloat(t.value); render(); },
  projKey(t){ V.projKey=t.value; drawCharts(); },
  newType(t){ V.newType=t.value; },
  planName(t){ P(t.dataset.p).name=t.value.trim()||'Untitled plan'; save(); },
  planNum(t){ const p=P(t.dataset.p); const v=parseFloat(t.value); if(t.dataset.f==='bbbPct') p.bbbPct=Math.min(0.8,Math.max(0.3,(v||50)/100)); else p[t.dataset.f]=Math.max(1,Math.round(v)||1); save(); render(); },
  planDeload(t){ P(t.dataset.p).deload=t.checked; save(); render(); },
  planMode(t){ P(t.dataset.p).mode=t.value; save(); },
  dayName(t){ P(t.dataset.p).days[+t.dataset.d].name=t.value.trim()||'?'; save(); },
  slotEx(t){ P(t.dataset.p).days[+t.dataset.d].slots[+t.dataset.s].exId=t.value; save(); render(); },
  slotScheme(t){ const p=P(t.dataset.p); const d=p.days[+t.dataset.d]; const si=+t.dataset.s; const old=d.slots[si]; const ns=newSlot(p,t.value); ns.id=old.id; ns.exId=old.exId; d.slots[si]=ns; save(); render(); },
  slotNum(t){ const s=P(t.dataset.p).days[+t.dataset.d].slots[+t.dataset.s]; if(t.dataset.f==='inc'){ const v=parseFloat(t.value); if(v>0) s.inc=v; else delete s.inc; save(); return; } s[t.dataset.f]=Math.max(1,parseInt(t.value)||1); if(s.repMax!=null&&s.repMin!=null&&s.repMax<s.repMin) s.repMax=s.repMin; save(); },
  eq(t){ const it=S.equipment[t.dataset.k].find(x=>x.id===t.dataset.id); const f=t.dataset.f; if(!it) return;
    if(f==='name'||f==='kind') it[f]=t.value; else it[f]=Math.max(0,parseFloat(t.value)||0); eqChanged(); save(); render(); },
  station(t){ const s=station(t.dataset.id); s.on=t.checked; eqChanged(); save(); render(); },
  exInc(t){ const e=S.exercises.find(x=>x.id===t.dataset.id); e.inc=Math.max(0,parseFloat(t.value)||0); save(); },
  calc(t){ V.calc[t.dataset.f]=t.dataset.f==='w'?parseFloat(t.value)||0:t.value; render(); },
  importFile(t){ const f=t.files&&t.files[0]; if(f) readImportFile(f); t.value=''; }
});
Object.assign(IN,{
  setW(t){ const i=+t.dataset.i,j=+t.dataset.j; const e=cur().entries[i]; const old=e.sets[j].w; const v=t.value===''?'':parseFloat(t.value); e.sets[j].w=v;
    if(j===0) e.sets.forEach((s,k)=>{ if(k>0&&!s.done&&s.w===old){ s.w=v; const x=$('#w-'+e.id+'-'+k); if(x) x.value=v; } });
    const ex=exById(e.exId); const box=$('#lw-'+e.id); if(box) box.innerHTML=(v!==''&&ex.load!=='bodyweight'&&!loadOptions(ex).some(o=>Math.abs(o.w-v)<.01))?loadHTML(ex,v):''; saveSoon(); },
  setR(t){ const e=cur().entries[+t.dataset.i]; e.sets[+t.dataset.j].r=t.value===''?'':parseInt(t.value); saveSoon(); },
  enNotes(t){ cur().entries[+t.dataset.i].notes=t.value; saveSoon(); },
  curBw(t){ cur().bw=t.value; saveSoon(); },
  curNotes(t){ cur().notes=t.value; saveSoon(); },
  importText(t){ V.importText=t.value; },
  wiz(t){ const path=t.dataset.f.split('.'); const w=V.wiz; if(path.length===2){ w[path[0]]=w[path[0]]||{}; w[path[0]][path[1]]=t.value; } else w[path[0]]=t.value; },
  editDayName(t){ if(EDIT) EDIT.dayName=t.value; },
  startW(t){ const plan=activePlan(); const g=setupGroups(plan).find(x=>x.exId===t.dataset.ex); const box=document.getElementById('si-'+t.dataset.ex); if(g&&box) box.innerHTML=setupInfo(g,parseFloat(t.value)); }
});
document.addEventListener('click',e=>{ const b=e.target.closest('[data-act]'); if(!b) return; const f=ACT[b.dataset.act]; if(f){ e.preventDefault(); f(b,e); } });
document.addEventListener('change',e=>{ const t=e.target; if(t.dataset&&t.dataset.ch&&CH[t.dataset.ch]) CH[t.dataset.ch](t,e); });
document.addEventListener('input',e=>{ const t=e.target; if(t.dataset&&t.dataset.in&&IN[t.dataset.in]) IN[t.dataset.in](t,e); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!$('#modal').hidden) closeModal(); });

function readImportFile(f){
  const st=$('#import-status'); if(st) st.textContent='Reading '+f.name+'…';
  const done=txt=>{ if(st) st.textContent='Loaded '+f.name+'.'; doImport(txt); };
  const fail=()=>{ if(st) st.textContent='Couldn’t read that file. Try pasting its text below instead.'; };
  try{ if(f.text) f.text().then(done,fail); else { const fr=new FileReader(); fr.onload=()=>done(String(fr.result||'')); fr.onerror=fail; fr.readAsText(f); } }catch(e){ fail(); }
}
function doImport(txt){
  let o; try{ o=JSON.parse(String(txt||'').trim()); }catch(e){ toast('That isn’t an Iron Ledger backup file'); return; }
  if(o&&o.kind==='plan'){ importPlanText(txt); return; }
  const data=o&&o.data?o.data:o; if(!data||!Array.isArray(data.sessions)||!data.equipment){ toast('That isn’t an Iron Ledger backup file'); return; }
  askConfirm('Replace everything?','This browser’s data is replaced with the backup ('+data.sessions.length+' workouts, '+(data.plans||[]).length+' plans).','Import',()=>{ setRealBackup(null); setEDIT(null); setS(migrate(data)); eqChanged(); V.importText=''; save(); goTab('today'); render(); toast('Imported'); });
}
document.addEventListener('dragover',e=>{ if(e.target.closest&&e.target.closest('#drop')){ e.preventDefault(); e.target.closest('#drop').classList.add('over'); } });
document.addEventListener('dragleave',e=>{ const d=e.target.closest&&e.target.closest('#drop'); if(d) d.classList.remove('over'); });
document.addEventListener('drop',e=>{ const d=e.target.closest&&e.target.closest('#drop'); if(!d) return; e.preventDefault(); d.classList.remove('over'); const f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0]; if(f) readImportFile(f); });
let rz=null; window.addEventListener('resize',()=>{ clearTimeout(rz); rz=setTimeout(drawCharts,150); });

export { ACT, CH, IN, doImport, readImportFile };
