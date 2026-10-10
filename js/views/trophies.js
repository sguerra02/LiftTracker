/* Iron Ledger — Trophies: records, streaks, badges, ladder, strength levels, year review */
import { DAY, S, ST, U, esc, fmtD, fmtW, fromLb, iso, memoize, parseISO, toLb, todayISO } from '../core.js';
import { exById, unitW } from '../equipment.js';
import { LADDER, THINGS, fmtBig, fmtMass, funHTML, lastBW, massParts, sessionVolume } from '../fun.js';
import { V } from '../state.js';

import { prShareButton } from '../features/share.js';
/* ---------- TROPHIES: records, streaks, badges, ladder, strength levels, year review ---------- */
const STREAK_MIN=2;
const LEVELS=['Beginner','Novice','Intermediate','Advanced','Elite'];
// Rough 1RM ÷ bodyweight guides for men
const STANDARDS={bench:[.5,.75,1,1.5,2],squat:[.75,1.25,1.5,2.25,2.75],deadlift:[1,1.5,2,2.5,3],ohp:[.35,.55,.75,1,1.4]};
const MAINS=[['squat','Back squat'],['bench','Bench press'],['deadlift','Deadlift'],['ohp','Overhead press']];
const BADGES=[
 ['first','1','First rep','Log your first workout.'],
 ['n10','10','Regular','Log 10 workouts.'],['n25','25','Committed','Log 25 workouts.'],['n50','50','Fixture','Log 50 workouts.'],['n100','100','Centurion','Log 100 workouts.'],['n250','250','Iron habit','Log 250 workouts.'],
 ['st4','4W','Month strong','4 weeks in a row with '+STREAK_MIN+'+ workouts or cardio sessions.'],['st8','8W','Two months strong','8 weeks in a row with '+STREAK_MIN+'+ workouts or cardio sessions.'],['st12','12W','Quarter strong','12 weeks in a row with '+STREAK_MIN+'+ workouts or cardio sessions.'],['st26','26W','Half-year strong','26 weeks in a row with '+STREAK_MIN+'+ workouts or cardio sessions.'],
 ['pr1','PR','First record','Set your first personal record.'],['pr10','10PR','Record setter','Set 10 personal records.'],['pr50','50PR','Record machine','Set 50 personal records.'],
 ['bwb','1×','Bodyweight bench','Bench press your bodyweight.'],['s15','1.5×','Big squat','Squat 1.5× your bodyweight.'],['d2','2×','Double-bodyweight pull','Deadlift 2× your bodyweight.'],
 ['early','AM','Early bird','Start a workout before 6 am.'],['late','PM','Night owl','Start a workout after 9 pm.']
].map(([id,mark,name,desc])=>({id,mark,name,desc}));
const LIFT_BADGES_LB=[['o95','ohp',95],['o135','ohp',135],['b135','bench',135],['b185','bench',185],['b225','bench',225],['s225','squat',225],['s315','squat',315],['d315','deadlift',315],['d405','deadlift',405]];
const LIFT_BADGES_KG=[['o40','ohp',40],['o60','ohp',60],['b60','bench',60],['b80','bench',80],['b100','bench',100],['s100','squat',100],['s140','squat',140],['d140','deadlift',140],['d180','deadlift',180]];
const liftBadges=()=>U()==='kg'?LIFT_BADGES_KG:LIFT_BADGES_LB;
const VOL_BADGES=[[1e5,'v100k','Heavy lifter'],[1e6,'v1m','Millionaire'],[5e6,'v5m','Tonnage king']];
function badges(){ const LN={ohp:['Press','Overhead press'],bench:['Bench','Bench press'],squat:['Squat','Back squat'],deadlift:['Deadlift','Deadlift']};
  const vb=VOL_BADGES.map(([lb,id,name])=>{ const m=massParts(fromLb(lb)); return {id,mark:m.n.replace(/,000$/,'K')+(m.u==='tons'?'T':m.u==='tonnes'?'t':''),name,desc:'Lift '+fmtMass(fromLb(lb))+' in total.'}; });
  const lb=liftBadges().map(([id,ex,w])=>({id,mark:String(w),name:LN[ex][0]+' '+w,desc:LN[ex][1]+' '+w+' '+U()+' for a rep.'}));
  const i=BADGES.findIndex(b=>b.id==='bwb'); return BADGES.slice(0,i).concat(vb,lb,BADGES.slice(i)); }
function sortedSessions(){ return memoize('sorted',()=>S.sessions.slice().sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:(a.createdAt||0)-(b.createdAt||0))); }
function weekKey(isoS){ const d=parseISO(isoS); const dow=(d.getDay()+6)%7; return iso(new Date(d.getFullYear(),d.getMonth(),d.getDate()-dow)); }
function weekBefore(wk){ const d=parseISO(wk); return iso(new Date(d.getFullYear(),d.getMonth(),d.getDate()-7)); }
const e1of=(w,r)=>r>=1&&r<=10?w*(r>1?1+r/30:1):0;
function analyze(){ return memoize('analyze',analyzeRaw); }
function analyzeRaw(){
  const ss=sortedSessions(); const best={}, prs={}, allPR=[], earned={}, weekCount={}, qual={};
  let n=0, vol=0, prCount=0, curBW=+S.settings.bw||null, bestStreak=0;
  const award=(id,s)=>{ if(!earned[id]) earned[id]={date:s.date,sid:s.id}; };
  for(const s of ss){
    n++; if(s.bw) curBW=+s.bw; vol+=sessionVolume(s); const list=[];
    for(const e of s.entries){
      const ex=exById(e.exId); const d=e.sets.filter(x=>x.done&&+x.r>0); if(!d.length) continue;
      const b=best[e.exId]||(best[e.exId]={e1:0,maxW:0,reps:{},seen:false});
      let sE1=0,sMax=0,rep=null,eSet=null,hSet=null;
      for(const x of d){ const w=+x.w||0, r=+x.r; const v1=e1of(w,r); if(v1>sE1){ sE1=v1; eSet={w,r}; } if(!hSet||w>sMax+0.01){ sMax=w; hSet={w,r}; } else if(Math.abs(w-sMax)<0.01&&r>hSet.r) hSet={w,r};
        let prev=0; for(const k in b.reps) if(+k>=w-0.01) prev=Math.max(prev,b.reps[k]);
        if(b.seen&&prev>0&&r>prev&&(!rep||w*r>rep.w*rep.r)) rep={w,r,prev}; }
      let pr=null;
      if(b.seen){
        if(ex.load!=='bodyweight'&&b.e1>0&&sE1>b.e1+0.5) pr={type:'e1',set:eSet,val:sE1,was:b.e1,text:'New best estimated max: '+fmtBig(sE1)+' '+U()+' (was '+fmtBig(b.e1)+')'};
        else if(ex.load!=='bodyweight'&&sMax>b.maxW+0.01) pr={type:'heavy',set:hSet,val:sMax,was:b.maxW,text:'Heaviest ever: '+unitW(ex,sMax)+' (was '+fmtW(b.maxW)+')'};
        else if(rep) pr={type:'reps',set:{w:rep.w,r:rep.r},val:rep.r,was:rep.prev,text:'Rep record: '+rep.r+' reps at '+unitW(ex,rep.w)+' (was '+rep.prev+')'};
      }
      if(pr){ Object.assign(pr,{exId:e.exId,date:s.date,sid:s.id}); list.push(pr); allPR.push(pr); prCount++; }
      b.e1=Math.max(b.e1,sE1); b.maxW=Math.max(b.maxW,sMax); for(const x of d){ const w=+x.w||0; b.reps[w]=Math.max(b.reps[w]||0,+x.r); } b.seen=true;
    }
    prs[s.id]=list;
    award('first',s); [[10,'n10'],[25,'n25'],[50,'n50'],[100,'n100'],[250,'n250']].forEach(([k,id])=>{ if(n>=k) award(id,s); });
    [[1,'pr1'],[10,'pr10'],[50,'pr50']].forEach(([k,id])=>{ if(prCount>=k) award(id,s); });
    [[1e5,'v100k'],[1e6,'v1m'],[5e6,'v5m']].forEach(([k,id])=>{ if(toLb(vol)>=k) award(id,s); });
    for(const [id,ex,w] of liftBadges()) if(best[ex]&&best[ex].maxW>=w) award(id,s);
    if(curBW){ if(best.bench&&best.bench.maxW>=curBW) award('bwb',s); if(best.squat&&best.squat.maxW>=1.5*curBW) award('s15',s); if(best.deadlift&&best.deadlift.maxW>=2*curBW) award('d2',s); }
    if(s.startedAt){ const h=new Date(s.startedAt).getHours(); if(h<6) award('early',s); if(h>=21) award('late',s); }
  }
  // Weekly streaks count lifting and cardio alike.
  const acts=ss.map(s=>({date:s.date,id:s.id,createdAt:s.createdAt||0})).concat((S.cardio||[]).map(c=>({date:c.date,id:c.id,createdAt:c.createdAt||0}))).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:a.createdAt-b.createdAt);
  for(const a of acts){ const wk=weekKey(a.date); weekCount[wk]=(weekCount[wk]||0)+1;
    if(weekCount[wk]===STREAK_MIN){ qual[wk]=(qual[weekBefore(wk)]||0)+1; bestStreak=Math.max(bestStreak,qual[wk]); [[4,'st4'],[8,'st8'],[12,'st12'],[26,'st26']].forEach(([k,id])=>{ if(qual[wk]>=k) award(id,a); }); } }
  const wkNow=weekKey(todayISO()); const curStreak=qual[wkNow]||qual[weekBefore(wkNow)]||0;
  return {ss,prs,allPR,earned,best,bestStreak,curStreak,weekCount,qual,vol,n,prCount,wkNow};
}
function ladder(){ return LADDER.slice().sort((a,b)=>a[0]-b[0]); }
function bodyweight(){ return lastBW()||(+S.settings.bw||null); }
function strengthRows(A){
  const bw=bodyweight(); const cutoff=iso(new Date(Date.now()-90*DAY));
  return MAINS.map(([id,name])=>{
    let e1=0; for(const s of A.ss){ if(s.date<cutoff) continue; for(const e of s.entries) if(e.exId===id) for(const x of e.sets) if(x.done) e1=Math.max(e1,e1of(+x.w||0,+x.r||0)); }
    const recent=e1>0; if(!recent&&A.best[id]) e1=A.best[id].e1;
    return {id,name,e1,recent,bw,ratio:bw&&e1?e1/bw:0,std:STANDARDS[id]};
  });
}
function levelBar(ratio,std){
  let i=-1; for(let k=0;k<std.length;k++) if(ratio>=std[k]) i=k;
  let pos; if(i<0) pos=Math.max(0,ratio/std[0])*(100/6); else if(i>=std.length-1) pos=100; else pos=(100/6)*(i+1+(ratio-std[i])/(std[i+1]-std[i]));
  const segs=['',...LEVELS].map((l,k)=>'<div class="seg'+(k<=i+1&&ratio>0?' on':'')+'"></div>').join('');
  return {i,html:'<div class="lvl"><div class="segs">'+segs+'</div><div class="mk" style="left:calc('+Math.min(100,pos).toFixed(1)+'% - 6px)"></div></div><div class="lvl-lbl"><span>Start</span>'+LEVELS.map(l=>'<span>'+l+'</span>').join('')+'</div>'};
}
function viewTrophies(){
  const A=analyze(); let h='';
  if(!A.n) h+='<section class="panel"><h2>Trophies</h2><p>Records, streaks and badges show up here once you log workouts.</p><div class="row"><button class="primary" data-act="tab" data-tab="today">Go to Today</button>'+(S.demo?'':'<button data-act="demo">Preview with sample data</button>')+'</div></section>';
  // streak
  const thisWeek=A.weekCount[A.wkNow]||0;
  let wkRow=''; for(let w=11;w>=0;w--){ const d=parseISO(A.wkNow); const k=iso(new Date(d.getFullYear(),d.getMonth(),d.getDate()-7*w)); const c=A.weekCount[k]||0; wkRow+='<span class="wkp'+(c>=STREAK_MIN?' on':'')+(w===0?' now':'')+'" title="Week of '+fmtD(parseISO(k))+': '+c+'">'+(c||'')+'</span>'; }
  h+='<section class="panel"><div class="row between"><div><div class="eyebrow">Weekly streak</div><div class="big">'+A.curStreak+'<small> week'+(A.curStreak===1?'':'s')+'</small></div></div><div class="small muted" style="text-align:right">Best: <b class="mono">'+A.bestStreak+'</b> weeks<br>This week: <b class="mono">'+thisWeek+'</b> of '+STREAK_MIN+'</div></div><div class="wkrow">'+wkRow+'</div><p class="small muted">A week counts when you log '+STREAK_MIN+' or more workouts or cardio sessions (Monday to Sunday). This week still counts toward the streak until Sunday.</p></section>';
  // ladder
  const L=ladder(); const LV=toLb(A.vol); let cur=null,next=null; for(const t of L){ if(t[0]<=LV) cur=t; else { next=t; break; } }
  const passed=L.filter(t=>t[0]<=LV).length;
  h+='<section class="panel"><div class="eyebrow">Lifetime ladder · '+passed+' of '+L.length+' rungs</div><div><b class="mono" style="font-size:22px">'+fmtMass(A.vol)+'</b> lifted all-time</div>';
  h+=cur?'<p>You’ve out-lifted '+esc(cur[1])+' ('+fmtMass(fromLb(cur[0]))+').</p>':'<p>First rung: '+esc(L[0][1])+' ('+fmtMass(fromLb(L[0][0]))+').</p>';
  if(next){ const lo=cur?cur[0]:0; const pct=Math.max(0,Math.min(100,(LV-lo)/(next[0]-lo)*100)); h+='<div class="row between small"><span>Next: <b>'+esc(next[1])+'</b></span><span class="mono">'+fmtMass(fromLb(next[0])-A.vol)+' to go</span></div><div class="meter"><div style="width:'+pct.toFixed(1)+'%"></div></div>'; }
  else h+='<p><b>You’ve out-lifted the Earth.</b> Nothing left to climb.</p>';
  h+='<details><summary class="small" style="cursor:pointer">See the whole ladder</summary><div class="ladder">'+L.map(t=>'<div class="'+(t[0]<=LV?'got':'')+'"><span>'+esc(t[1].charAt(0).toUpperCase()+t[1].slice(1))+'</span><span class="mono">'+fmtMass(fromLb(t[0]))+'</span></div>').join('')+'</div></details><p class="small muted">Weights are approximate. '+(U()==='kg'?'Tonnes are metric (1,000 kg).':'Tons are US tons (2,000 lb).')+'</p></section>';
  // strength levels
  const rows=strengthRows(A); const bw=bodyweight();
  h+='<section class="panel"><div class="row between"><h3>Strength levels</h3><label class="f">Bodyweight ('+U()+')<input type="number" id="set-bw" data-ch="setBw" step="any" inputmode="decimal" value="'+esc(lastBW()||S.settings.bw||'')+'" style="width:96px"'+(lastBW()?' disabled title="Using the bodyweight from your latest workout"':'')+'></label></div>';
  if(!bw) h+='<div class="note info">Enter your bodyweight (or log it in a workout) to see levels.</div>';
  for(const r of rows){
    if(!r.e1){ h+='<div class="sl"><div class="row between"><b>'+esc(r.name)+'</b><span class="small muted">Not logged yet</span></div></div>'; continue; }
    const lb=levelBar(r.ratio,r.std); const lvl=lb.i<0?'Getting started':LEVELS[lb.i]; const nxt=lb.i<r.std.length-1&&bw?'Next: '+LEVELS[lb.i+1]+' at about '+fmtBig(Math.ceil(r.std[lb.i+1]*bw/ST())*ST())+' '+U():'Top level';
    h+='<div class="sl"><div class="row between"><b>'+esc(r.name)+'</b><span class="chip '+(lb.i>=2?'good':lb.i>=0?'t2':'')+'">'+lvl+'</span></div><div class="small muted">Est. max <b class="mono">'+fmtBig(r.e1)+' '+U()+'</b>'+(bw?' · <span class="mono">'+r.ratio.toFixed(2)+'×</span> bodyweight':'')+(r.recent?'':' · older than 90 days')+'</div>'+(bw?lb.html+'<div class="small muted">'+nxt+'</div>':'')+'</div>';
  }
  h+='<p class="small muted">Rough guide for men, based on estimated 1-rep max from sets of 10 or fewer in the last 90 days. Levels are common strength-standard ratios, not a test result.</p></section>';
  // records
  const recent=A.allPR.slice().reverse().slice(0,12);
  h+='<section class="panel"><div class="row between"><h3>Personal records</h3><span class="small muted mono">'+A.prCount+' total</span></div>';
  h+=recent.length?'<div class="stack" style="gap:6px">'+recent.map(p=>'<div class="prrow"><span class="small muted mono">'+fmtD(parseISO(p.date))+'</span><div><b>'+esc(exById(p.exId).name)+'</b><div class="small">'+esc(p.text)+'</div></div>'+prShareButton(p)+'</div>').join('')+'</div>':'<p class="small muted">Records start after the second time you log an exercise: a heavier weight, a higher estimated max, or more reps at a weight.</p>';
  h+='</section>';
  // badges
  const got=badges().filter(b=>A.earned[b.id]).length;
  h+='<section class="panel"><div class="row between"><h3>Badges</h3><span class="small muted mono">'+got+' of '+badges().length+'</span></div><div class="badges">'+badges().sort((x,y)=>(!!A.earned[y.id])-(!!A.earned[x.id])).map(b=>{ const e=A.earned[b.id]; return '<div class="badge'+(e?'':' locked')+'"><span class="medal">'+esc(b.mark)+'</span><div><b>'+esc(b.name)+'</b><div class="small muted">'+esc(b.desc)+'</div>'+(e?'<div class="small" style="color:var(--good)">Earned '+fmtD(parseISO(e.date))+'</div>':'')+'</div></div>'; }).join('')+'</div></section>';
  // year in review
  const years=[...new Set(A.ss.map(s=>s.date.slice(0,4)))].sort().reverse();
  if(years.length){ if(!V.year||!years.includes(V.year)) V.year=years[0]; h+=yearReview(A,V.year,years); }
  return h;
}
function yearReview(A,y,years){
  const ss=A.ss.filter(s=>s.date.startsWith(y)); const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  let vol=0,reps=0,sets=0,mins=0; const byMonth={}, setsByEx={}; let heavy=null; const e1s={};
  for(const s of ss){ vol+=sessionVolume(s); const m=+s.date.slice(5,7)-1; byMonth[m]=(byMonth[m]||0)+1;
    if(s.startedAt&&s.endedAt) mins+=Math.min(240,(s.endedAt-s.startedAt)/60000);
    for(const e of s.entries){ const ex=exById(e.exId); let se1=0; for(const x of e.sets){ if(!x.done||!(+x.r>0)) continue; sets++; reps+=+x.r; setsByEx[e.exId]=(setsByEx[e.exId]||0)+1;
        const w=+x.w||0; if(ex.load!=='bodyweight'&&(!heavy||w>heavy.w)) heavy={w,r:+x.r,ex,date:s.date}; se1=Math.max(se1,e1of(w,+x.r)); }
      if(se1>0){ (e1s[e.exId]=e1s[e.exId]||[]).push(se1); } } }
  const topMonth=Object.entries(byMonth).sort((a,b)=>b[1]-a[1])[0];
  const fav=Object.entries(setsByEx).sort((a,b)=>b[1]-a[1])[0];
  const gains=Object.entries(e1s).filter(([id,a])=>a.length>=2&&exById(id).load!=='bodyweight').map(([id,a])=>({id,from:a[0],to:Math.max(...a.slice(-3))})).map(g=>Object.assign(g,{d:g.to-g.from})).filter(g=>g.d>0).sort((a,b)=>b.d-a.d).slice(0,3);
  let yStreak=0; for(const wk in A.qual) if(wk.startsWith(y)) yStreak=Math.max(yStreak,A.qual[wk]);
  const prs=A.allPR.filter(p=>p.date.startsWith(y)).length; const yb=badges().filter(b=>A.earned[b.id]&&A.earned[b.id].date.startsWith(y));
  const pin=THINGS[0]; const partial=y===String(new Date().getFullYear());
  let h='<section class="panel yr"><div class="row between"><div><div class="eyebrow">Year in review'+(partial?' · so far':'')+'</div><h2>'+esc(y)+'</h2></div>'+(years.length>1?'<select id="yr" data-ch="year" aria-label="Year">'+years.map(v=>'<option'+(v===y?' selected':'')+'>'+v+'</option>').join('')+'</select>':'')+'</div>';
  if(!ss.length) return h+'<p class="muted">No workouts logged this year.</p></section>';
  h+='<div class="yrgrid"><div><b class="mono">'+ss.length+'</b><span>workouts</span></div><div><b class="mono">'+massParts(vol).n+'</b><span>'+massParts(vol).u+' lifted</span></div><div><b class="mono">'+fmtBig(reps)+'</b><span>reps in '+fmtBig(sets)+' sets</span></div><div><b class="mono">'+(mins/60).toFixed(1)+'</b><span>hours training</span></div><div><b class="mono">'+prs+'</b><span>personal records</span></div><div><b class="mono">'+yStreak+'</b><span>longest week streak</span></div></div>';
  h+='<div class="stack" style="gap:6px">';
  if(topMonth) h+='<p>Busiest month: <b>'+MONTHS[+topMonth[0]]+'</b> with '+topMonth[1]+' workouts.</p>';
  if(fav) h+='<p>Most-trained lift: <b>'+esc(exById(fav[0]).name)+'</b>, '+fav[1]+' sets.</p>';
  if(heavy) h+='<p>Heaviest set: <b>'+esc(heavy.ex.name)+' '+unitW(heavy.ex,heavy.w)+' × '+heavy.r+'</b> on '+fmtD(parseISO(heavy.date))+'.</p>';
  if(gains.length) h+='<p>Biggest gains (estimated max): '+gains.map(g=>'<b>'+esc(exById(g.id).name)+'</b> +'+fmtBig(g.d)+' '+U()).join(', ')+'.</p>';
  if(yb.length) h+='<p>Badges earned: '+yb.map(b=>esc(b.name)).join(', ')+'.</p>';
  h+='<p>Strangest way to put it: that’s <b>'+fmtBig(toLb(vol)/pin[0])+' '+pin[2]+'</b>.</p>';
  h+='</div>'+funHTML(vol,y+' total')+'</section>';
  return h;
}

export { LEVELS, MAINS, STANDARDS, STREAK_MIN, analyze, badges, bodyweight, e1of, sortedSessions, viewTrophies, weekKey };
