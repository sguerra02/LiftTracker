/* Iron Ledger — Workout report and body diagram */
import { DAY, S, U, esc, fmtD, fmtDL, fmtW, iso, parseISO } from '../core.js';
import { exById } from '../equipment.js';
import { compareText, fmtBig, fmtMass, massParts, sessionVolume } from '../fun.js';
import { V } from '../state.js';
import { STREAK_MIN, analyze, e1of, sortedSessions, weekKey } from './trophies.js';

import { fmtClock, sessionTiming } from '../features/timing.js';
import { cardioSummaryLine } from '../features/cardio.js';
/* ---------- WEEKLY REPORT ---------- */
const MUSCLES={quads:'Quadriceps',glutes:'Glutes',hamstrings:'Hamstrings',adductors:'Adductors',calves:'Calves',chest:'Chest',frontdelts:'Front delts',sidedelts:'Side delts',reardelts:'Rear delts',triceps:'Triceps',biceps:'Biceps',forearms:'Forearms',upperback:'Upper back',lats:'Lats',lowerback:'Lower back',abs:'Abs'};
// Primary muscle = 1 set, secondary = 0.5 set, per working set
const EX_MUSCLES={
  squat:{quads:1,glutes:.5,adductors:.5},fsquat:{quads:1,glutes:.5,adductors:.5,upperback:.5},goblet:{quads:1,glutes:.5,adductors:.5},dblunge:{quads:1,glutes:.5,adductors:.5},
  deadlift:{glutes:1,lowerback:1,hamstrings:.5,quads:.5,upperback:.5,forearms:.5},rdl:{hamstrings:1,glutes:.5,lowerback:.5},dbrdl:{hamstrings:1,glutes:.5,lowerback:.5},'bc-goodmorning':{hamstrings:1,lowerback:.5,glutes:.5},
  powerclean:{upperback:1,glutes:.5,hamstrings:.5,quads:.5,lowerback:.5},
  bench:{chest:1,triceps:.5,frontdelts:.5},incbench:{chest:1,frontdelts:.5,triceps:.5},dbbench:{chest:1,triceps:.5,frontdelts:.5},dbincline:{chest:1,frontdelts:.5,triceps:.5},pushup:{chest:1,triceps:.5,frontdelts:.5,abs:.5},'bc-benchacc':{chest:1,triceps:.5},
  ohp:{frontdelts:1,sidedelts:.5,triceps:.5,abs:.5},dbohp:{frontdelts:1,sidedelts:.5,triceps:.5},latraise:{sidedelts:1},
  bbrow:{upperback:1,lats:.5,reardelts:.5,biceps:.5,lowerback:.5},dbrow:{upperback:1,lats:.5,reardelts:.5,biceps:.5},'bc-dbborow':{upperback:1,lats:.5,reardelts:.5,biceps:.5},cablerow:{upperback:1,lats:.5,biceps:.5},
  latpd:{lats:1,biceps:.5,upperback:.5},pullup:{lats:1,biceps:.5,upperback:.5,forearms:.5},chinup:{lats:1,biceps:.5,upperback:.5,forearms:.5},facepull:{reardelts:1,upperback:.5},
  pushdown:{triceps:1},dbcurl:{biceps:1,forearms:.5}
};
const PAT_MUSCLES={squat:{quads:1,glutes:.5},hinge:{hamstrings:1,glutes:.5,lowerback:.5},hpush:{chest:1,triceps:.5,frontdelts:.5},vpush:{frontdelts:1,triceps:.5},hpull:{upperback:1,lats:.5,biceps:.5},vpull:{lats:1,biceps:.5},lunge:{quads:1,glutes:.5},arms:{biceps:.5,triceps:.5},shoulders:{sidedelts:1},core:{abs:1},power:{upperback:.5,glutes:.5,quads:.5}};
function musclesFor(exId){ if(EX_MUSCLES[exId]) return EX_MUSCLES[exId]; if(exId==='bc-optional') return {}; return PAT_MUSCLES[exById(exId).pattern]||{}; }
function weekSessions(wk){ const d=parseISO(wk); const end=iso(new Date(d.getFullYear(),d.getMonth(),d.getDate()+6)); return sortedSessions().filter(s=>s.date>=wk&&s.date<=end); }
function weekStats(wk,A){
  const ss=weekSessions(wk); const m={}, by={}; let mins=0, vol=0, prs=0;
  for(const s of ss){ vol+=sessionVolume(s); if(s.startedAt&&s.endedAt) mins+=Math.min(240,(s.endedAt-s.startedAt)/60000); prs+=(A.prs[s.id]||[]).length;
    for(const e of s.entries){ const n=e.sets.filter(x=>x.done&&+x.r>0).length; if(!n) continue; const mm=musclesFor(e.exId); for(const k in mm){ m[k]=(m[k]||0)+n*mm[k]; const b=by[k]||(by[k]={}); b[e.exId]=(b[e.exId]||0)+n*mm[k]; } } }
  return {ss,m,by,mins:Math.round(mins),vol,prs,streak:A.qual[wk]||0};
}
function mirrorPath(d,w){ w=w||200; return d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g,(_,x,y)=>(w-+x)+','+y); }
const BODY_OUTLINE='M100,8 C84,8 76,20 76,36 C76,50 82,58 88,62 L89,72 C80,76 64,78 56,84 C46,90 42,102 42,116 C40,134 38,152 38,168 C36,186 32,206 30,226 C29,236 26,246 24,256 C23,264 28,270 32,266 C36,258 38,248 40,238 C44,220 48,200 50,184 C52,172 56,160 58,148 C60,140 62,132 64,128 C66,150 70,176 70,200 C70,214 66,226 66,238 C64,262 64,290 68,316 C70,334 68,356 70,380 C71,392 68,400 66,406 C66,412 80,414 88,410 C90,398 90,388 90,378 C92,356 94,334 94,318 C96,294 98,270 98,252 L100,250 Z';
const BODY_FRONT=[
 ['upperback','M89,70 C81,75 70,78 60,84 C72,84 82,82 92,80 C91,76 90,73 89,70 Z'],
 ['frontdelts','M57,86 C49,92 46,103 47,117 C53,113 59,106 64,98 C63,92 61,88 57,86 Z'],
 ['sidedelts','M51,88 C45,94 42,106 43,120 L46,122 C46,108 48,98 54,90 Z'],
 ['chest','M98,84 C86,82 73,85 64,97 C59,107 61,120 67,130 C77,138 90,138 98,132 Z'],
 ['biceps','M50,127 C46,139 45,153 47,166 C51,168 55,160 57,148 C58,138 56,129 50,127 Z'],
 ['forearms','M46,178 C40,192 36,208 34,224 C36,228 40,228 42,222 C46,208 50,194 52,182 Z'],
 ['abs','M88,142 L98,142 L98,159 L88,159 Z'],['abs','M88,162 L98,162 L98,179 L88,179 Z'],['abs','M88,182 L98,182 L98,199 L88,199 Z'],['abs','M88,202 C88,214 92,224 98,230 L98,202 Z'],
 ['abs','M69,138 C72,158 74,180 76,204 C79,208 83,210 85,210 L85,142 C78,140 73,138 69,138 Z'],
 ['quads','M68,246 C64,270 66,296 72,312 C78,318 86,316 90,308 C92,286 92,262 90,248 C84,243 74,242 68,246 Z'],
 ['adductors','M93,252 C89,264 89,280 92,294 C96,282 98,268 98,256 Z'],
 ['calves','M72,332 C69,350 71,368 76,382 L81,380 C81,362 81,346 79,332 Z']
];
const BODY_BACK=[
 ['upperback','M100,62 C92,66 84,74 64,82 C74,86 84,93 90,110 C94,122 98,134 100,142 Z'],
 ['reardelts','M56,86 C48,92 44,104 44,118 C50,112 58,104 64,96 C62,90 60,87 56,86 Z'],
 ['lats','M66,110 C64,122 64,134 66,146 C70,166 76,186 84,198 L93,190 C91,166 89,140 87,118 C80,110 72,108 66,110 Z'],
 ['triceps','M45,124 C42,140 42,156 44,168 C48,168 52,158 54,146 C56,136 54,126 49,122 Z'],
 ['forearms','M46,178 C40,192 36,208 34,224 C36,228 40,228 42,222 C46,208 50,194 52,182 Z'],
 ['lowerback','M93,150 C90,170 90,190 92,212 L99,214 L99,148 Z'],
 ['glutes','M68,224 C64,238 66,256 76,264 C86,268 96,264 99,256 L99,222 C90,218 76,218 68,224 Z'],
 ['hamstrings','M70,271 C68,288 70,304 74,316 L90,316 C92,300 94,284 94,271 C86,267 76,267 70,271 Z'],
 ['calves','M70,330 C66,346 68,362 74,372 C78,376 84,374 88,368 C92,354 92,340 90,330 C84,324 76,324 70,330 Z']
];
function bodySVG(side,m){
  const max=Math.max(1,...Object.values(m));
  const fillFor=k=>{ const v=m[k]||0; return v>0?'fill="var(--accent)" fill-opacity="'+(0.3+0.7*v/max).toFixed(2)+'"':'fill="var(--line)"'; };
  const tip=k=>'<title>'+MUSCLES[k]+': '+(Math.round((m[k]||0)*10)/10)+' sets</title>';
  const sel=k=>' data-act="muscle" data-m="'+k+'" class="mz'+(V.muscle===k?' sel':'')+'"';
  let g='<g fill="var(--sunk)" stroke="var(--sunk)" stroke-width="0.8"><path d="'+BODY_OUTLINE+'"/><path d="'+mirrorPath(BODY_OUTLINE)+'"/></g><g stroke="var(--surface)" stroke-width="1.4" stroke-linejoin="round">';
  for(const [k,d] of (side==='front'?BODY_FRONT:BODY_BACK)){ g+='<path d="'+d+'" '+fillFor(k)+sel(k)+'>'+tip(k)+'</path><path d="'+mirrorPath(d)+'" '+fillFor(k)+sel(k)+'>'+tip(k)+'</path>'; }
  g+='</g>';
  return '<svg viewBox="0 0 200 430" role="img" aria-label="'+(side==='front'?'Front':'Back')+' view, muscles worked this week">'+g+'<text x="100" y="428" text-anchor="middle" font-size="12" fill="var(--muted)" font-family="IBM Plex Sans,system-ui,sans-serif">'+(side==='front'?'Front':'Back')+'</text></svg>';
}
function deltaHTML(cur,prev,fmt){
  if(!prev&&!cur) return '<span class="dl muted">—</span>';
  if(!prev) return '<span class="dl up">new</span>';
  const pct=Math.round((cur-prev)/prev*100); if(pct===0) return '<span class="dl muted">same as last week</span>';
  return '<span class="dl '+(pct>0?'up':'down')+'">'+(pct>0?'▲ ':'▼ ')+Math.abs(pct)+'% vs last week</span>';
}
function bestSet(e){ const ex=exById(e.exId); let b=null; for(const x of e.sets){ if(!x.done||!(+x.r>0)) continue; const w=+x.w||0,r=+x.r; const score=ex.load==='bodyweight'?r+w/1000:Math.max(e1of(w,r),w*(1+Math.min(r,30)/30)); if(!b||score>b.score) b={w,r,score}; } return b; }

let REP=null;
function muscleReadout(){
  if(!REP||!V.muscle) return '<span class="muted small">Tap a muscle or a row below to see what worked it.</span>';
  const k=V.muscle, v=REP.W.m[k]||0, by=REP.W.by[k]||{};
  const list=Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([id,n])=>esc(exById(id).name)+' <span class="mono">'+(Math.round(n*10)/10)+'</span>').join(' · ');
  return '<div class="row between"><b>'+MUSCLES[k]+'</b><span class="mono">'+(Math.round(v*10)/10).toFixed(1)+' sets</span></div><div class="small muted">'+(list||'Not trained this week.')+'</div>';
}
// The workout to compare against: the last time you did this same day (A1 vs A1), from any plan, within the past month.
// Only when there's none does it fall back to a similar workout (most exercises in common), then to an older same-day workout.
const SAME_DAY_WINDOW=31;
function prevSame(s){
  const ss=sortedSessions(); const idx=ss.findIndex(x=>x.id===s.id); const before=ss.slice(0,idx<0?ss.length:idx).reverse();
  const has=x=>x.entries.some(e=>e.sets.some(z=>z.done&&+z.r>0));
  const ids=new Set(s.entries.map(e=>e.exId));
  const overlap=x=>new Set(x.entries.filter(e=>ids.has(e.exId)).map(e=>e.exId)).size;
  const similar=x=>overlap(x)>0&&overlap(x)>=Math.ceil(ids.size/2);
  const sameDay=x=>has(x)&&x.dayName===s.dayName&&(x.planId===s.planId||similar(x));
  const recent=x=>(parseISO(s.date)-parseISO(x.date))/DAY<=SAME_DAY_WINDOW;
  return before.find(x=>sameDay(x)&&recent(x))
    ||before.find(x=>has(x)&&similar(x)&&recent(x))
    ||before.find(sameDay)
    ||before.find(x=>has(x)&&similar(x))
    ||null;
}
function exStats(e){ const d=e.sets.filter(x=>x.done&&+x.r>0); if(!d.length) return null; const ex=exById(e.exId);
  return {bw:ex.load==='bodyweight',sets:d.length,reps:d.reduce((a,x)=>a+(+x.r),0),vol:d.reduce((a,x)=>a+(+x.w||0)*(+x.r),0),e1:Math.max(...d.map(x=>{ const w=+x.w||0,r=+x.r; return r>1?w*(1+Math.min(r,30)/30):w; })),best:bestSet(e)}; }
function sessStats(s){ let sets=0,reps=0; for(const e of s.entries){ const t=exStats(e); if(t){ sets+=t.sets; reps+=t.reps; } } return {vol:sessionVolume(s),sets,reps,mins:s.startedAt&&s.endedAt?Math.round((s.endedAt-s.startedAt)/60000):null}; }
function chg(cur,prev,unit,pct){
  if(prev==null||isNaN(prev)) return '<span class="dl muted">new</span>';
  const d=cur-prev; if(Math.abs(d)<0.5) return '<span class="dl muted">same</span>';
  const txt=pct&&prev>0?Math.round(Math.abs(d)/prev*100)+'%':fmtBig(Math.abs(d))+(unit||'');
  return '<span class="dl '+(d>0?'up':'down')+'">'+(d>0?'▲ ':'▼ ')+txt+'</span>';
}
function setTxt(ex,b){ return b?(ex.load==='bodyweight'?(b.w?'BW+'+fmtW(b.w):'BW'):fmtW(b.w))+'×'+b.r:'—'; }
function exRows(s,p){
  const rows=[];
  for(const e of s.entries){ const t=exStats(e); if(!t) continue; const ex=exById(e.exId);
    const pe=p?p.entries.filter(x=>x.exId===e.exId).map(exStats).filter(Boolean).sort((a,b)=>b.e1-a.e1)[0]:null;
    rows.push({e,ex,t,pe,delta:pe?(t.bw?t.best.r-pe.best.r:t.e1-pe.e1):null}); }
  return rows;
}
function compareSummary(s,p){
  const a=sessStats(s), b=sessStats(p); const rows=exRows(s,p).filter(r=>r.pe); const up=rows.filter(r=>r.delta>0.5).length;
  return {a,b,rows,up};
}
function lastVsHTML(s){
  const p=prevSame(s); const nm='Day '+esc(s.dayName);
  let h='<section class="panel"><div><div class="eyebrow">Last workout vs last time</div><h3>'+nm+' · '+fmtDL(s.date)+'</h3>';
  if(!p) return h+'<p class="small muted">First time logging this workout, so there’s nothing to compare yet. Next time you do '+nm+' it’ll show here.</p></div></section>';
  const C=compareSummary(s,p);
  h+='<div class="small muted">Compared with '+(p.dayName===s.dayName?'Day '+esc(p.dayName):'Day '+esc(p.dayName)+' (no '+nm+' in the past month, so this is your closest match)')+' on '+fmtDL(p.date)+(p.date.slice(0,4)!==s.date.slice(0,4)?' '+p.date.slice(0,4):'')+'</div></div>';
  const tiles=[[fmtMass(C.a.vol),'lifted',chg(C.a.vol,C.b.vol,'',true)],[C.a.reps,'reps',chg(C.a.reps,C.b.reps)],[C.up+' of '+C.rows.length,'lifts improved',C.rows.length?'<span class="dl muted">by est. max or reps</span>':'<span class="dl muted">no shared lifts</span>']];
  h+='<div class="tiles t3">'+tiles.map(t=>'<div class="tile"><b class="mono sm">'+t[0]+'</b><span>'+t[1]+'</span>'+t[2]+'</div>').join('')+'</div>';
  h+='<div class="tbl-wrap"><table><thead><tr><th>Exercise</th><th class="num">Now</th><th class="num">Last time</th><th class="num">Change</th></tr></thead><tbody>';
  for(const r of exRows(s,p)) h+='<tr><td>'+esc(r.ex.name)+'</td><td class="num">'+setTxt(r.ex,r.t.best)+'</td><td class="num">'+(r.pe?setTxt(r.ex,r.pe.best):'—')+'</td><td class="num">'+(r.pe?(r.t.bw?chg(r.t.best.r,r.pe.best.r,' reps'):chg(r.t.e1,r.pe.e1,' '+U())):'<span class="dl muted">new</span>')+'</td></tr>';
  h+='</tbody></table></div><p class="small muted">Change is estimated 1-rep max from the best set (reps for bodyweight moves), so a heavier set or more reps at the same weight both count.</p></section>';
  return h;
}
function viewReport(){
  const A=analyze(); if(!V.repWeek) V.repWeek=A.wkNow;
  const wk=V.repWeek; const d=parseISO(wk); const end=new Date(d.getFullYear(),d.getMonth(),d.getDate()+6);
  const W=weekStats(wk,A); REP={W}; const isNow=wk===A.wkNow; const first=A.ss.length?weekKey(A.ss[0].date):wk;
  let h='<section class="panel"><div class="row between"><button data-act="repPrev" aria-label="Previous week"'+(wk<=first?' disabled':'')+'>‹</button><div style="text-align:center"><div class="eyebrow">Weekly report'+(isNow?' · so far':'')+'</div><h2>'+fmtD(d)+' – '+fmtD(end)+(d.getFullYear()!==new Date().getFullYear()?', '+d.getFullYear():'')+'</h2></div><button data-act="repNext" aria-label="Next week"'+(isNow?' disabled':'')+'>›</button></div>';
  const timed=W.ss.filter(s=>s.startedAt&&s.endedAt).length; const cmp=W.vol>0?compareText(W.vol).replace('That’s like lifting ','≈ ').replace(/\.$/,''):'';
  const tiles=[[W.ss.length,'Workouts','<span class="dl muted">'+(W.ss.length?esc(W.ss.map(s=>s.dayName).join(', ')):'—')+'</span>'],[W.mins,'Minutes','<span class="dl muted">'+(timed&&W.mins?'about '+Math.round(W.mins/timed)+' per workout':'—')+'</span>'],[massParts(W.vol).n,massParts(W.vol).label+' lifted','<span class="dl muted">'+esc(cmp||'—')+'</span>'],[W.streak,'Week streak','<span class="dl muted">'+(W.streak?STREAK_MIN+'+ workouts, '+W.streak+' week'+(W.streak>1?'s':'')+' running':isNow?'Need '+Math.max(0,STREAK_MIN-(A.weekCount[wk]||0))+' more this week':'Under '+STREAK_MIN+' sessions')+'</span>']];
  h+='<div class="tiles">'+tiles.map(t=>'<div class="tile"><b class="mono">'+t[0]+'</b><span>'+t[1]+'</span>'+t[2]+'</div>').join('')+'</div>';
  h+=cardioSummaryLine(wk);
  if(W.prs) h+='<p class="small"><span class="chip good">'+W.prs+' PR'+(W.prs>1?'s':'')+'</span> set this week.</p>';
  h+='</section>';
  if(!W.ss.length){ h+='<section class="panel"><p class="muted">No workouts logged this week'+(isNow?' yet':'')+'.</p></section>'; return h; }
  h+=lastVsHTML(W.ss[W.ss.length-1]);
  // muscles
  const keys=Object.keys(MUSCLES).filter(k=>(W.m[k]||0)>0).sort((a,b)=>(W.m[b]||0)-(W.m[a]||0)); const mx=Math.max(1,...Object.values(W.m));
  h+='<section class="panel"><h3>Muscles worked</h3><div class="bodies">'+bodySVG('front',W.m)+bodySVG('back',W.m)+'</div><div class="mread" id="mread" aria-live="polite">'+muscleReadout()+'</div>';
  h+='<div class="mlist">'+keys.map(k=>{ const v=W.m[k]||0;
    return '<div class="mrow'+(V.muscle===k?' sel':'')+'" data-act="muscle" data-m="'+k+'" role="button" tabindex="0"><span class="dot" style="opacity:'+(0.28+0.72*v/mx).toFixed(2)+'"></span><span>'+MUSCLES[k]+'</span><span class="mono">'+(Math.round(v*10)/10).toFixed(1)+' sets</span></div>'; }).join('')+'</div>';
  h+='<p class="small muted">Each working set counts 1 for the main muscle and 0.5 for helpers (bench: chest 1, triceps and front delts 0.5).</p></section>';
  // workouts
  h+='<h3 style="margin-top:4px">This week’s workouts <span class="muted mono">('+W.ss.length+')</span></h3>';
  for(const s of W.ss){ const plan=S.plans.find(p=>p.id===s.planId); const dur=s.startedAt&&s.endedAt?Math.round((s.endedAt-s.startedAt)/60000):null; const prl=A.prs[s.id]||[]; const p=prevSame(s);
    h+='<section class="panel"><div><h3>'+fmtDL(s.date)+'</h3><div class="small muted">Day '+esc(s.dayName)+(plan?' · '+esc(plan.name):'')+'</div><div class="small muted mono">'+[dur?dur+' min':null,(()=>{ const T=sessionTiming(s); return T&&!T.batch&&T.avgRest!=null?'avg rest '+fmtClock(T.avgRest):null; })(),fmtMass(sessionVolume(s))+' lifted',prl.length?prl.length+' PR'+(prl.length>1?'s':''):null].filter(Boolean).join(' · ')+'</div>';
    if(p){ const C=compareSummary(s,p); h+='<div class="small">vs Day '+esc(p.dayName)+' on '+fmtD(parseISO(p.date))+': lifted '+chg(C.a.vol,C.b.vol,'',true)+' · '+C.up+' of '+C.rows.length+' lifts improved</div>'; }
    else h+='<div class="small muted">First time doing this workout.</div>';
    h+='</div><div class="tbl-wrap"><table><thead><tr><th>Exercise</th><th class="num">Sets</th><th class="num">Best set</th><th class="num">vs last</th></tr></thead><tbody>';
    for(const r of exRows(s,p)){ const pr=prl.find(x=>x.exId===r.e.exId);
      h+='<tr><td>'+esc(r.ex.name)+(r.e.scheme==='T1'||r.e.scheme==='T2'||r.e.scheme==='T3'?' <span class="muted small">('+r.e.scheme+')</span>':'')+(pr?'<div><span class="chip good" title="'+esc(pr.text)+'">PR · '+({e1:'est. max',heavy:'heaviest',reps:'reps'}[pr.type])+'</span></div>':'')+'</td><td class="num">'+r.t.sets+'</td><td class="num">'+setTxt(r.ex,r.t.best)+'</td><td class="num">'+(r.pe?(r.t.bw?chg(r.t.best.r,r.pe.best.r,' reps'):chg(r.t.e1,r.pe.e1,' '+U())):'<span class="dl muted">new</span>')+'</td></tr>'; }
    h+='</tbody></table></div></section>'; }
  return h;
}

export { bestSet, muscleReadout, viewReport };
