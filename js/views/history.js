/* Iron Ledger — History: calendar, bodyweight, now-vs-peak, session list */
import { DAY, S, U, esc, fmtD, fmtDL, fmtW, iso, parseISO, todayISO } from '../core.js';
import { avail, exById, wtText } from '../equipment.js';
import { bwPoints, checkEntries, fmtBig, funHTML, massParts, sessionVolume } from '../fun.js';
import { modeWeight, schemeChip, tgtText } from '../engine.js';
import { EDIT, V } from '../state.js';
import { entryCard } from './today.js';
import { MAINS, analyze, e1of } from './trophies.js';
import { timingHTML } from '../features/timing.js';
import { cardioByDate } from '../features/cardio.js';

/* ---------- HISTORY ---------- */
function sessionMetrics(s,exId){
  const out=[]; for(const e of s.entries){ if(exId&&e.exId!==exId) continue; const d=e.sets.filter(x=>x.done&&+x.r>0); if(!d.length) continue;
    const w=modeWeight(d); const e1=Math.max(...d.map(x=>(+x.w||0)*(+x.r>1?1+(+x.r)/30:1))); const vol=d.reduce((a,x)=>a+(+x.w||0)*(+x.r||0),0); const reps=d.reduce((a,x)=>a+(+x.r||0),0);
    out.push({e,w,e1,vol,reps}); } return out;
}

function calendarHTML(ss){
  const now=new Date(); if(!V.calMonth) V.calMonth=iso(new Date(now.getFullYear(),now.getMonth(),1)).slice(0,7);
  const [y,mo]=V.calMonth.split('-').map(Number); const first=new Date(y,mo-1,1); const days=new Date(y,mo,0).getDate(); const lead=(first.getDay()+6)%7;
  const byDate={}; for(const s of ss) (byDate[s.date]=byDate[s.date]||[]).push(s); const cdx=cardioByDate();
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const n=ss.filter(s=>s.date.startsWith(V.calMonth)).length; const ncd=(S.cardio||[]).filter(c=>c.date.startsWith(V.calMonth)).length;
  let h='<section class="panel"><div class="row between"><button data-act="calPrev" aria-label="Previous month">‹</button><div style="text-align:center"><h3>'+MONTHS[mo-1]+' '+y+'</h3><div class="small muted">'+n+' workout'+(n===1?'':'s')+(ncd?' · '+ncd+' cardio':'')+'</div></div><button data-act="calNext" aria-label="Next month">›</button></div><div class="mcal">'+['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>'<span class="mh">'+d+'</span>').join('');
  for(let i=0;i<lead;i++) h+='<span></span>';
  const today=todayISO();
  for(let d=1;d<=days;d++){ const k=V.calMonth+'-'+String(d).padStart(2,'0'); const list=byDate[k]||[];
    const cl=cdx[k]||[]; const cdot=cl.length?'<i class="cdot" title="Cardio"></i>':'';
    if(list.length) h+='<button class="mday on'+(k===today?' today':'')+'" data-act="calOpen" data-s="'+list[0].id+'" title="'+esc(list.map(s=>'Day '+s.dayName).join(', ')+(cl.length?', cardio':''))+'"><span>'+d+cdot+'</span><small>'+esc(list[0].dayName)+(list.length>1?' +'+(list.length-1):'')+'</small></button>';
    else if(cl.length) h+='<button class="mday cd'+(k===today?' today':'')+'" data-act="sub" data-p="progress" data-s="cardio" title="Cardio"><span>'+d+'</span><small>'+esc(cl.map(c=>c.min+'m').join(' '))+'</small></button>';
    else h+='<span class="mday'+(k===today?' today':'')+'"><span>'+d+'</span></span>'; }
  return h+'</div><p class="small muted">Tap a highlighted day to open that workout.</p></section>';
}
function peakHTML(ss){
  const cutoff=iso(new Date(Date.now()-60*DAY)); let h='<section class="panel"><h3>Now vs your best</h3><div class="stack" style="gap:10px">';
  for(const [id,name] of MAINS){ let peak=null,cur=null;
    for(const s of ss) for(const e of s.entries) if(e.exId===id) for(const x of e.sets){ if(!x.done) continue; const w=+x.w||0,r=+x.r||0,e1=e1of(w,r); if(e1<=0) continue; const o={e1,w,r,date:s.date};
      if(!peak||e1>peak.e1) peak=o; if(s.date>=cutoff&&(!cur||e1>cur.e1)) cur=o; }
    if(!peak) continue; const pct=cur?Math.round(cur.e1/peak.e1*100):0;
    h+='<div class="pk"><div class="row between"><b>'+esc(name)+'</b><span class="mono small">'+(cur?pct+'% of best':'not trained in 60 days')+'</span></div><div class="meter"><div style="width:'+pct+'%"></div></div><div class="small muted">Best: <b class="mono">'+fmtBig(peak.e1)+' '+U()+'</b> est. max ('+fmtW(peak.w)+' × '+peak.r+', '+fmtD(parseISO(peak.date))+' '+peak.date.slice(0,4)+')'+(cur?' · Now: <b class="mono">'+fmtBig(cur.e1)+' '+U()+'</b> ('+fmtW(cur.w)+' × '+cur.r+')':'')+(cur&&pct<100?' · <span class="mono">'+fmtBig(peak.e1-cur.e1)+' '+U()+'</span> to go':'')+'</div></div>'; }
  return h+'</div><p class="small muted">Estimated 1-rep max from your best set. "Now" is the last 60 days.</p></section>';
}
function bwHTML(){
  const pts=bwPoints(); const last=pts[pts.length-1];
  let h='<section class="panel"><div class="row between"><h3>Bodyweight</h3>'+(last?'<span class="mono">'+fmtW(last.w)+' '+U()+' <span class="small muted">'+fmtD(parseISO(last.date))+'</span></span>':'')+'</div>';
  h+='<div class="row"><input type="number" step="any" inputmode="decimal" id="bw-new" placeholder="'+U()+'" style="width:96px" aria-label="Bodyweight in pounds"><input type="date" id="bw-date" value="'+todayISO()+'" aria-label="Date"><button data-act="bwAdd">Log weight</button></div>';
  if(pts.length>=2){ const cut=iso(new Date(Date.now()-30*DAY)); const base=pts.filter(p=>p.date<=cut).pop()||pts[0]; const d=last.w-base.w;
    h+='<div class="chart" id="chart-bw"></div><p class="small muted">'+(d===0?'No change':(d>0?'Up ':'Down ')+fmtW(Math.abs(d))+' '+U())+' since '+fmtD(parseISO(base.date))+'. Includes weights logged with workouts.</p>'; }
  else h+='<p class="small muted">Log your weight here or in a workout. A chart appears after two entries.</p>';
  const own=(S.bodyweights||[]).slice().sort((a,b)=>a.date<b.date?1:-1).slice(0,5);
  if(own.length) h+='<div class="small">'+own.map(b=>'<span class="chip">'+fmtD(parseISO(b.date))+' · '+fmtW(b.w)+' <button class="x" data-act="bwDel" data-id="'+b.id+'" aria-label="Delete">×</button></span>').join(' ')+'</div>';
  return h+'</section>';
}
function viewHistory(){
  if(EDIT) return viewEditor();
  const AH=analyze();
  const ss=S.sessions.slice().sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:(b.createdAt||0)-(a.createdAt||0));
  if(!ss.length) return '<section class="panel"><h2>No workouts logged yet</h2><p>Finish a workout on the Today tab and it shows up here with charts and a calendar.</p><div class="row"><button class="primary" data-act="tab" data-tab="today">Go to Today</button><button data-act="demo">Preview with sample data</button></div></section>';
  const now=new Date(); const t0=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const in30=ss.filter(s=>t0-parseISO(s.date)<30*DAY), in28=ss.filter(s=>t0-parseISO(s.date)<28*DAY);
  const vol=in30.reduce((a,s)=>a+sessionVolume(s),0); const life=ss.reduce((a,s)=>a+sessionVolume(s),0);
  let h='<div class="stats"><div class="stat"><b class="mono">'+in30.length+'</b><span>Workouts, last 30 days</span></div><div class="stat"><b class="mono">'+(in28.length/4).toFixed(1)+'</b><span>Per week, last 4 weeks</span></div><div class="stat"><b class="mono">'+massParts(vol).n+'</b><span>'+massParts(vol).label+' lifted, last 30 days</span></div></div>';
  h+='<section class="panel">'+funHTML(life,'Lifted all-time')+'</section>';
  h+=calendarHTML(ss)+peakHTML(ss)+bwHTML();
  const exIds=[...new Set(ss.flatMap(s=>s.entries.filter(e=>e.sets.some(x=>x.done)).map(e=>e.exId)))];
  if(!V.histEx||!exIds.includes(V.histEx)) V.histEx=exIds[0];
  h+='<section class="panel"><div class="row between"><h3>Progress by exercise</h3><div class="row"><select id="hist-ex" data-ch="histEx" aria-label="Exercise">'+exIds.map(id=>'<option value="'+id+'"'+(id===V.histEx?' selected':'')+'>'+esc(exById(id).name)+'</option>').join('')+'</select><select id="hist-m" data-ch="histM" aria-label="Metric"><option value="w"'+(V.histMetric==='w'?' selected':'')+'>Working weight</option><option value="e1"'+(V.histMetric==='e1'?' selected':'')+'>Estimated 1-rep max</option><option value="vol"'+(V.histMetric==='vol'?' selected':'')+'>Volume ('+U()+' × reps)</option><option value="reps"'+(V.histMetric==='reps'?' selected':'')+'>Total reps</option></select></div></div><div class="rng" role="group" aria-label="Range">'+[['3m','3 months'],['1y','1 year'],['all','All']].map(([k,l])=>'<button data-act="histRange" data-r="'+k+'" aria-pressed="'+((V.histRange||'all')===k)+'">'+l+'</button>').join('')+'</div><div class="chart" id="chart-hist"></div><p class="small muted">Touch and drag across the chart to read each workout. Estimated 1-rep max uses the Epley formula (weight × (1 + reps ÷ 30)) on your best set.</p></section>';
  if(V.openSess&&!ss.slice(0,15).some(s=>s.id===V.openSess)) V.showAll=true;
  const list=V.showAll?ss:ss.slice(0,15);
  h+='<section class="panel"><h3>Workouts</h3><div>';
  for(const s of list){
    const plan=S.plans.find(p=>p.id===s.planId); const dur=s.endedAt&&s.startedAt?Math.round((s.endedAt-s.startedAt)/60000):null;
    const line=s.entries.map(e=>{ const d=e.sets.filter(x=>x.done); const ex=exById(e.exId); return d.length?ex.name+' '+d.length+'×'+(d.map(x=>x.r).join('/'))+' @ '+fmtW(modeWeight(d)):ex.name+' skipped'; }).join(' · ');
    const flag=checkEntries(s.entries,s.id).length;
    h+='<details class="sess" id="sess-'+s.id+'"'+(V.openSess===s.id?' open':'')+'><summary><span class="l1"><b>'+fmtDL(s.date)+'</b>'+(flag?'<span class="chip warn">Check numbers</span>':'')+'<span class="chip">Day '+esc(s.dayName)+'</span>'+(plan?'<span class="small muted">'+esc(plan.name)+'</span>':'')+(dur?'<span class="small muted mono">'+dur+' min</span>':'')+(s.bw?'<span class="small muted mono">BW '+fmtW(s.bw)+'</span>':'')+'</span><span class="small muted">'+esc(line)+'</span></summary><div class="body">';
    s.entries.forEach((e,ei)=>{ const ex=exById(e.exId);
      h+='<div><div class="row"><b>'+esc(ex.name)+'</b>'+schemeChip(e.scheme,e.target)+((AH.prs[s.id]||[]).find(p=>p.exId===e.exId)?'<span class="chip good" title="'+esc((AH.prs[s.id]||[]).find(p=>p.exId===e.exId).text)+'">PR</span>':'')+'<span class="small muted mono">target '+tgtText(e.target)+' @ '+esc(wtText(ex,e.target))+'</span>'+(e.rpe?'<span class="chip">RPE '+esc(e.rpe)+'</span>':'')+'</div>';
      h+='<div class="tbl-wrap"><table><thead><tr><th>Set</th><th>Weight</th><th>Reps</th><th>Done</th></tr></thead><tbody>'+e.sets.map((x,j)=>'<tr><td class="mono">'+(j+1)+'</td><td><input type="number" step="any" id="hs-'+s.id+'-'+ei+'-'+j+'-w" data-ch="hs" data-s="'+s.id+'" data-e="'+ei+'" data-j="'+j+'" data-f="w" value="'+esc(x.w)+'" aria-label="Weight"></td><td><input type="number" step="1" id="hs-'+s.id+'-'+ei+'-'+j+'-r" data-ch="hs" data-s="'+s.id+'" data-e="'+ei+'" data-j="'+j+'" data-f="r" value="'+esc(x.r)+'" aria-label="Reps"></td><td><input type="checkbox" id="hs-'+s.id+'-'+ei+'-'+j+'-d" data-ch="hs" data-s="'+s.id+'" data-e="'+ei+'" data-j="'+j+'" data-f="done"'+(x.done?' checked':'')+' aria-label="Done"></td></tr>').join('')+'</tbody></table></div>'+(e.notes?'<p class="small muted">'+esc(e.notes)+'</p>':'')+'</div>';
    });
    if(s.notes) h+='<p class="small"><b>Notes:</b> '+esc(s.notes)+'</p>';
    const iss=checkEntries(s.entries,s.id); if(iss.length) h+='<div class="note warn"><b>Check these numbers:</b><ul class="issues">'+iss.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>';
    h+=timingHTML(s);
    h+=funHTML(sessionVolume(s),'Total lifted');
    h+='<p class="small muted">Quick fixes to weight, reps and done can be made right here. Use Edit workout to change the date, the day, or the exercises.</p><div class="row"><button class="primary" data-act="editSession" data-s="'+s.id+'">Edit workout</button><button class="danger" data-act="delSession" data-s="'+s.id+'">Delete this workout</button></div></div></details>';
  }
  h+='</div>'+(ss.length>15&&!V.showAll?'<div><button class="ghost" data-act="showAll">Show all '+ss.length+' workouts</button></div>':'')+'</section>';
  return h;
}


function addExHTML(){
  const list=S.exercises.filter(avail).sort((a,b)=>a.name.localeCompare(b.name));
  return '<section class="panel"><label class="f">Add an exercise to this workout<select id="add-entry" data-ch="addEntry"><option value="">Choose an exercise…</option>'+list.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('')+'</select></label><p class="small muted">Added exercises use a 3×8–12 rep range.</p></section>';
}
function viewEditor(){
  const c=EDIT; const plan=S.plans.find(p=>p.id===c.planId);
  let h='<section class="panel"><div class="row between"><div><div class="eyebrow">'+(plan?esc(plan.name):'Workout')+'</div><h2>Edit workout</h2></div><button data-act="cancelEdit">Cancel</button></div>';
  h+='<div class="entry-foot"><label class="f">Date<input type="date" id="ed-date" data-ch="curDate" value="'+esc(c.date)+'"></label>';
  if(plan&&plan.days.length) h+='<label class="f">Workout day<select id="ed-day" data-ch="editDay">'+plan.days.map((d,i)=>'<option value="'+i+'"'+(i===c.dayIndex?' selected':'')+'>'+esc(d.name)+'</option>').join('')+'</select></label><div><button data-act="loadDay">Use this day’s exercises</button></div>';
  else h+='<label class="f">Day name<input type="text" id="ed-dayname" data-in="editDayName" value="'+esc(c.dayName)+'"></label>';
  h+='</div><p class="small muted">The day you pick sets the rotation: the next workout follows the day of your most recent workout. Saving recalculates every target after this workout.</p></section>';
  c.entries.forEach((e,i)=>{ h+=entryCard(e,i); });
  h+=addExHTML();
  h+='<section class="panel"><div class="entry-foot"><label class="f">Bodyweight ('+U()+')<input type="number" inputmode="decimal" step="any" id="cur-bw" data-in="curBw" value="'+esc(c.bw||'')+'"></label><label class="f grow">Session notes<input type="text" id="cur-notes" data-in="curNotes" value="'+esc(c.notes||'')+'"></label></div>';
  h+='<div class="row between"><button class="primary big" data-act="saveEdit">Save changes</button><button data-act="cancelEdit">Cancel</button></div></section>';
  return h;
}

export { addExHTML, sessionMetrics, viewHistory };
