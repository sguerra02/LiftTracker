/* Iron Ledger — Goals and goal projections */
import { DAY, S, ST, U, esc, fmtD, fmtDL, fmtW, memoize, parseISO } from '../core.js';
import { fmtBig } from '../fun.js';
import { activePlan, schemePct } from '../engine.js';
import { V } from '../state.js';
import { LEVELS, MAINS, STANDARDS, bodyweight, e1of, sortedSessions } from './trophies.js';
import { autoSpw, project } from './projection.js';
import { lineChart } from '../charts.js';

/* ---------- GOALS ---------- */
const GOAL_MEASURES={e1:'Estimated 1-rep max',top:'Heaviest set lifted'};
function goalPoints(id,measure){
  return memoize('gp|'+id+'|'+measure,()=>{ const out=[];
    for(const s of sortedSessions()){ let v=0; for(const e of s.entries) if(e.exId===id) for(const x of e.sets){ if(!x.done||!(+x.r>0)) continue; const w=+x.w||0; v=Math.max(v,measure==='top'?w:e1of(w,+x.r)); }
      if(v>0) out.push({x:+parseISO(s.date),y:Math.round(v*10)/10,date:s.date}); }
    return out; });
}
function goalNow(id,measure){ const pts=goalPoints(id,measure); if(!pts.length) return null; const cut=Date.now()-60*DAY; const rec=pts.filter(p=>p.x>=cut);
  const src=rec.length?rec:pts; let b=src[0]; for(const p of src) if(p.y>b.y) b=p; return {v:b.y,date:b.date,recent:!!rec.length}; }
function goalReached(id,g){ return goalPoints(id,g.measure).find(p=>p.date>=g.set&&p.y>=g.target)||null; }
function planGoalEta(id,g){
  const plan=activePlan(); if(!plan||!plan.runId||!plan.days.length||plan.mode!=='progress') return null;
  const spw=V.projSpw||autoSpw();
  const P=memoize('proj365|'+plan.id+'|'+spw,()=>project(plan,spw,365));
  const keys=Object.keys(P.pts).filter(k=>k.split('|')[0]===id); if(!keys.length) return null;
  const conv=(k,w)=>{ const sc=k.split('|')[1]; if(sc==='W') return g.measure==='top'?w*0.95:w/0.9; return g.measure==='top'?w:w/schemePct(sc,P.slots[k]); };
  let best=null,pace=null;
  for(const k of keys) for(const q of P.pts[k]){ if(!best||+q.d<best){ if(conv(k,q.best)>=g.target) best=+q.d; } if(!pace||+q.d<pace){ if(conv(k,q.exp)>=g.target) pace=+q.d; } }
  return {best,pace,spw};
}
function trendGoalEta(id,g,now){
  const pts=goalPoints(id,g.measure).filter(p=>p.x>=Date.now()-120*DAY); if(pts.length<3) return null;
  const n=pts.length, mx=pts.reduce((a,p)=>a+p.x,0)/n, my=pts.reduce((a,p)=>a+p.y,0)/n;
  let sxy=0,sxx=0; for(const p of pts){ sxy+=(p.x-mx)*(p.y-my); sxx+=(p.x-mx)**2; }
  if(!sxx) return null; const slope=sxy/sxx*DAY; if(slope<=0.01) return {flat:true};
  const days=(g.target-now)/slope; return {date:Date.now()+days*DAY,perWeek:slope*7};
}
function fmtEta(t){ if(!t) return null; const d=new Date(t); const wks=Math.max(0,Math.round((t-Date.now())/DAY/7)); return fmtD(d)+(d.getFullYear()!==new Date().getFullYear()?' '+d.getFullYear():'')+' <span class="muted">(~'+(wks<1?'this week':wks+' week'+(wks>1?'s':''))+')</span>'; }
function goalSuggest(id,now){
  const bw=bodyweight(); const out=[];
  if(bw&&STANDARDS[id]){ const cur=now?now.v/bw:0; const i=STANDARDS[id].findIndex(r=>r>cur+0.01); if(i>=0) out.push([LEVELS[i],Math.ceil(STANDARDS[id][i]*bw/ST())*ST()]); }
  if(now) out.push(['+10%',Math.ceil(now.v*1.1/ST())*ST()]);
  const peak=goalPoints(id,'e1').reduce((a,p)=>Math.max(a,p.y),0); if(peak&&now&&peak>now.v*1.03) out.push(['Your best ever',Math.round(peak/ST())*ST()]);
  return out;
}
function viewGoals(){
  S.goals=S.goals||{};
  let h='<section class="panel"><div><h2>Goals</h2><p class="small muted">Set a target for each main lift. Progress uses your best set from the last 60 days. The projection runs your active plan forward, and falls back to your recent trend for lifts outside the plan.</p></div></section>';
  for(const [id,name] of MAINS){
    const g=S.goals[id]; const measure=(g&&g.measure)||'e1'; const now=goalNow(id,measure);
    h+='<section class="panel goal" id="goal-'+id+'"><div class="row between"><h3>'+esc(name)+'</h3>'+(g?'<button class="ghost small" data-act="goalClear" data-id="'+id+'">Remove goal</button>':'')+'</div>';
    if(!g){
      const sug=goalSuggest(id,now);
      h+='<div class="small muted">Now: '+(now?'<b class="mono">'+fmtBig(now.v)+' '+U()+'</b> estimated 1-rep max':'no sets logged yet')+'</div>';
      h+='<div class="row"><label class="f">Goal ('+U()+')<input type="number" inputmode="decimal" step="any" id="gt-'+id+'" style="width:110px"></label><label class="f">Measured by<select id="gm-'+id+'">'+Object.entries(GOAL_MEASURES).map(([k,l])=>'<option value="'+k+'">'+l+'</option>').join('')+'</select></label><button class="primary" data-act="goalSet" data-id="'+id+'">Set goal</button></div>';
      if(sug.length) h+='<div class="row small">Ideas: '+sug.map(([l,v])=>'<button class="chipbtn" data-act="goalFill" data-id="'+id+'" data-v="'+v+'">'+esc(l)+' · '+fmtW(v)+'</button>').join('')+'</div>';
      h+='</section>'; continue;
    }
    const reached=goalReached(id,g); const cur=now?now.v:0; const start=Math.min(g.start||0,cur||g.start||0);
    const pct=g.target>0?Math.max(0,Math.min(100,cur/g.target*100)):0;
    h+='<div class="goalnums"><div><span class="eyebrow">Now</span><b class="mono">'+(now?fmtBig(cur):'—')+'</b></div><div><span class="eyebrow">Goal</span><b class="mono">'+fmtW(g.target)+'</b></div><div><span class="eyebrow">To go</span><b class="mono">'+(reached?'0':fmtBig(Math.max(0,g.target-cur)))+'</b></div></div>';
    h+='<div class="small muted">'+GOAL_MEASURES[g.measure]+' in '+U()+(now&&!now.recent?' · no sets in the last 60 days, showing your latest':'')+' · set '+fmtD(parseISO(g.set))+'</div>';
    h+='<div class="row between small"><span><b class="mono">'+(reached?100:Math.round(pct))+'%</b> of goal</span>'+(g.start&&!reached&&cur>g.start?'<span class="muted">+'+fmtBig(cur-g.start)+' '+U()+' since you set it</span>':'')+'</div><div class="meter big"><div style="width:'+(reached?100:pct).toFixed(1)+'%"></div></div>';
    if(reached) h+='<div class="note good"><b>Goal reached</b> on '+fmtDL(reached.date)+' with '+fmtBig(reached.y)+' '+U()+'. Set a new one to keep going.</div>';
    else {
      const pe=planGoalEta(id,g), te=trendGoalEta(id,g,cur); let lines=[];
      if(pe&&(pe.best||pe.pace)){ lines.push('Best case (every target hit): <b>'+(fmtEta(pe.best)||'more than a year out')+'</b>'); lines.push('At your pace: <b>'+(fmtEta(pe.pace)||'more than a year out')+'</b>'); }
      else if(pe) lines.push('Your active plan doesn’t reach this within a year.');
      if(te&&te.date) lines.push('Recent trend (+'+fmtW(Math.round(te.perWeek*10)/10)+' '+U()+'/week): <b>'+(te.date-Date.now()>3*365*DAY?'more than 3 years out':fmtEta(te.date))+'</b>');
      else if(te&&te.flat) lines.push('Recent trend is flat, so there’s no trend-based date yet.');
      if(!lines.length) lines.push('Log a few more sessions with this lift to get a projection.');
      h+='<div class="eta stack" style="gap:4px">'+lines.map(l=>'<div class="small">'+l+'</div>').join('')+'</div>';
    }
    h+='<div class="chart goal-chart" id="chart-goal-'+id+'" data-id="'+id+'"></div></section>';
  }
  return h;
}
function drawGoalCharts(){
  document.querySelectorAll('.goal-chart').forEach(el=>{
    const id=el.dataset.id, g=(S.goals||{})[id]; if(!g) return;
    const pts=goalPoints(id,g.measure).filter(p=>p.x>=Date.now()-240*DAY);
    const series=[{name:'Logged',pts:pts.map(p=>({x:p.x,y:p.y})),color:'var(--accent)',dots:true,area:true}];
    const reached=goalReached(id,g); let endX=Date.now()+30*DAY;
    if(!reached){ const pe=planGoalEta(id,g); const now=goalNow(id,g.measure); const eta=pe&&(pe.pace||pe.best);
      if(eta&&now&&eta-Date.now()<400*DAY){ endX=eta; series.push({name:'Projection',pts:[{x:Date.now(),y:now.v},{x:eta,y:g.target}],color:'var(--muted)',dash:true,label:false}); } }
    const x0=pts.length?pts[0].x:Date.now()-30*DAY;
    series.push({name:'Goal',pts:[{x:x0,y:g.target},{x:Math.max(endX,Date.now()+7*DAY),y:g.target}],color:'var(--good)',dash:true});
    lineChart(el,series,190,{fmt:v=>fmtW(Math.round(v))+' '+U()});
  });
}

export { drawGoalCharts, goalNow, goalReached, viewGoals };
