/* Iron Ledger — First-run setup and unit conversion */
import { S, STATIONS, STD_PLATES, TYPES, TYPICAL_PLATES, esc, save, todayISO, uid } from '../core.js';
import { eqChanged } from '../equipment.js';
import { V, goTab, render } from '../state.js';
import { MAINS } from './trophies.js';
import { toast } from '../ui.js';

/* ---------- FIRST-RUN SETUP ---------- */
const LEVEL_RATIOS={new:{squat:.6,bench:.45,deadlift:.75,ohp:.3},some:{squat:1,bench:.75,deadlift:1.25,ohp:.5},exp:{squat:1.4,bench:1,deadlift:1.75,ohp:.65}};
function wizInit(unit){ const kg=unit==='kg'; const tp=TYPICAL_PLATES[kg?'kg':'lb'];
  return {unit,barType:'olympic',barW:kg?20:45,plates:Object.assign({},tp),handles:0,handleW:kg?2:5,fixed:'',stations:{rack:true,bench:true,incline:true,pullup:true,cable:false},bw:'',level:'some',maxes:{},plan:'gzclp'}; }
function viewWizard(){
  if(!V.wiz) V.wiz=wizInit('lb'); const w=V.wiz, u=w.unit;
  const num=(k,v,extra)=>'<input type="number" inputmode="decimal" step="any" min="0" data-in="wiz" data-f="'+k+'" id="wz-'+k.replace(/\W/g,'-')+'" value="'+esc(v)+'"'+(extra||'')+'>';
  let h='<section class="panel wiz"><div><div class="eyebrow">Welcome</div><h2>Set up your gym</h2><p class="muted">Two minutes of setup so every weight the app suggests is one you can actually load. You can change any of this later under Setup.</p></div>';
  h+='<div class="wstep"><span class="wn">1</span><div class="stack"><b>Units</b><div class="unitseg" role="radiogroup">'+[['lb','Pounds (lb)'],['kg','Kilograms (kg)']].map(([k,l])=>'<button role="radio" aria-checked="'+(u===k)+'" data-act="wizUnit" data-u="'+k+'">'+l+'</button>').join('')+'</div></div></div>';
  h+='<div class="wstep"><span class="wn">2</span><div class="stack"><b>Barbell</b><div class="row"><select data-ch="wizBar" id="wz-bar"><option value="olympic"'+(w.barType==='olympic'?' selected':'')+'>Olympic bar</option><option value="standard"'+(w.barType==='standard'?' selected':'')+'>Standard 1-inch bar</option><option value="none"'+(w.barType==='none'?' selected':'')+'>No barbell</option></select>'+(w.barType!=='none'?'<label class="row small">Weight '+num('barW',w.barW,' style="width:80px"')+' '+u+'</label>':'')+'</div></div></div>';
  h+='<div class="wstep"><span class="wn">3</span><div class="stack"><b>Plates</b><span class="small muted">Count every plate you own (a pair is 2).</span><div class="pgrid">'+STD_PLATES[u].map(p=>'<label class="pl"><span class="mono">'+p+' '+u+'</span>'+num('plates.'+p,w.plates[p]||0)+'</label>').join('')+'</div><span class="small muted">Other sizes can be added later on the Equipment page.</span></div></div>';
  h+='<div class="wstep"><span class="wn">4</span><div class="stack"><b>Dumbbells</b><div class="row"><label class="row small">Adjustable handles <select data-ch="wizHandles" id="wz-handles">'+[0,1,2].map(n=>'<option'+(+w.handles===n?' selected':'')+'>'+n+'</option>').join('')+'</select></label>'+(+w.handles?'<label class="row small">each weighs '+num('handleW',w.handleW,' style="width:70px"')+' '+u+'</label>':'')+'</div><label class="f">Fixed dumbbell pairs (weights, comma separated)<input type="text" data-in="wiz" data-f="fixed" id="wz-fixed" value="'+esc(w.fixed)+'" placeholder="'+(u==='kg'?'e.g. 5, 7.5, 10, 12.5':'e.g. 10, 15, 20, 25')+'"></label></div></div>';
  h+='<div class="wstep"><span class="wn">5</span><div class="stack"><b>Stations</b><div class="chkgrid">'+STATIONS().map(st=>'<label class="row small"><input type="checkbox" data-ch="wizSt" data-id="'+st.id+'" id="wz-st-'+st.id+'"'+(w.stations[st.id]?' checked':'')+'> '+esc(st.name)+'</label>').join('')+'</div></div></div>';
  h+='<div class="wstep"><span class="wn">6</span><div class="stack"><b>About you</b><span class="small muted">Used only to suggest safe starting weights.</span><div class="row"><label class="f">Bodyweight ('+u+')'+num('bw',w.bw,' style="width:100px"')+'</label><label class="f">Lifting experience<select data-ch="wizLevel" id="wz-level"><option value="new"'+(w.level==='new'?' selected':'')+'>New to lifting</option><option value="some"'+(w.level==='some'?' selected':'')+'>Some experience</option><option value="exp"'+(w.level==='exp'?' selected':'')+'>Experienced</option></select></label></div>';
  h+='<details><summary class="small" style="cursor:pointer">I know my 1-rep maxes (optional)</summary><div class="pgrid" style="margin-top:8px">'+MAINS.map(([id,nm])=>'<label class="pl"><span>'+nm+'</span>'+num('maxes.'+id,w.maxes[id]||'')+'</label>').join('')+'</div></details></div></div>';
  h+='<div class="wstep"><span class="wn">7</span><div class="stack"><b>Pick a plan</b><select data-ch="wizPlan" id="wz-plan">'+S.plans.filter(p=>!p.archived).map(p=>'<option value="'+p.id+'"'+(w.plan===p.id?' selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select><span class="small muted">'+esc((TYPES[(S.plans.find(p=>p.id===w.plan)||{}).type]||{}).desc||'')+'</span></div></div>';
  h+='<div class="row between"><button class="primary big" data-act="wizFinish">Finish setup</button><button class="ghost" data-act="tab" data-tab="data">I have a backup file</button></div></section>';
  return h;
}
function wizFinish(){
  const w=V.wiz, u=w.unit;
  S.settings.unit=u;
  const E={bars:[],plates:[],fixed:[],stations:STATIONS().map(st=>Object.assign(st,{on:!!w.stations[st.id]}))};
  if(w.barType!=='none'&&+w.barW>0) E.bars.push({id:'bar1',name:w.barType==='olympic'?'Olympic barbell':'Standard 1-inch barbell',kind:'barbell',weight:+w.barW,qty:1});
  if(+w.handles>0) E.bars.push({id:'dbh',name:'Dumbbell handles',kind:'dumbbell',weight:+w.handleW||0,qty:+w.handles});
  for(const p of STD_PLATES[u]){ const q=Math.floor(+w.plates[p]||0); if(q>0) E.plates.push({id:uid(),weight:p,qty:q}); }
  for(const x of String(w.fixed).split(/[,\s]+/).map(Number).filter(n=>n>0)) E.fixed.push({id:uid(),name:x+' '+u+' dumbbells',weight:x,qty:2});
  S.equipment=E;
  if(u==='kg'){ S.exercises.forEach(e=>{ if(!e.custom&&e.inc) e.inc=e.inc/2; }); S.plans.forEach(p=>p.days.forEach(d=>d.slots.forEach(x=>{ if(x.inc) x.inc=x.inc/2; }))); }
  const bw=+w.bw; S.settings.est1rm={};
  if(bw>0){ S.settings.bw=bw; S.bodyweights=S.bodyweights||[]; S.bodyweights.push({id:uid(),date:todayISO(),w:bw}); const r=LEVEL_RATIOS[w.level]||LEVEL_RATIOS.some; for(const k in r) S.settings.est1rm[k]=Math.round(bw*r[k]); }
  for(const [id] of MAINS){ const m=+w.maxes[id]; if(m>0) S.settings.est1rm[id]=m; }
  S.activePlanId=w.plan; S.settings.setupDone=true; V.wiz=null; eqChanged(); save(); goTab('today'); render(); window.scrollTo(0,0); toast('Setup saved');
}
function convertUnits(to){
  const f=to==='kg'?0.45359237:1/0.45359237; const r=x=>{ if(x==null||x===''||isNaN(+x)) return x; const v=+x*f; if(to==='kg') return Math.round(v*100)/100; const t=Math.round(v*10)/10; return Math.abs(t-Math.round(t))<0.06?Math.round(t):t; };
  const fixS=s=>{ s.bw=r(s.bw); for(const e of s.entries){ if(e.target){ e.target.w=r(e.target.w); (e.target.rows||[]).forEach(q=>q.w=r(q.w)); } e.sets.forEach(x=>x.w=r(x.w)); } };
  S.sessions.forEach(fixS); if(S.current) fixS(S.current);
  S.plans.forEach(p=>{ for(const k in p.start||{}) p.start[k]=r(p.start[k]); });
  ['bars','plates','fixed'].forEach(k=>S.equipment[k].forEach(x=>x.weight=r(x.weight)));
  S.exercises.forEach(e=>{ if(e.inc) e.inc=to==='kg'?e.inc/2:e.inc*2; });
  S.plans.forEach(p=>p.days.forEach(d=>d.slots.forEach(x=>{ if(x.inc) x.inc=to==='kg'?x.inc/2:x.inc*2; })));
  (S.bodyweights||[]).forEach(b=>b.w=r(b.w)); if(S.settings.bw) S.settings.bw=r(S.settings.bw);
  const es=S.settings.est1rm||{}; for(const k in es) es[k]=r(es[k]);
  S.settings.unit=to; V.calc.w=null; eqChanged(); save(); render(); toast('Converted to '+to);
}

export { convertUnits, viewWizard, wizFinish, wizInit };
