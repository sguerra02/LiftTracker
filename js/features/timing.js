/* Iron Ledger — Set timestamps: how long each exercise took and how long you actually rested */
import { REST, esc } from '../core.js';
import { exById } from '../equipment.js';

const MIN_GAP=15e3;   // sets checked off faster than this were logged after the fact, not live

export const fmtClock=ms=>{ const s=Math.max(0,Math.round(ms/1000)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };

// Timeline of a session. Returns null when the sets carry no usable times.
export function sessionTiming(s){
  const marks=[];
  s.entries.forEach((e,ei)=>e.sets.forEach((x,j)=>{ if(x.done&&x.t>0) marks.push({t:+x.t,ei,j}); }));
  if(marks.length<2) return null;
  marks.sort((a,b)=>a.t-b.t);
  const gaps=marks.slice(1).map((m,i)=>m.t-marks[i].t);
  const live=gaps.filter(g=>g>=MIN_GAP).length;
  if(live<gaps.length*0.6) return {batch:true};
  const start=s.startedAt&&s.startedAt<=marks[0].t?s.startedAt:marks[0].t;
  const ents=[]; let prevEnd=start;
  s.entries.forEach((e,ei)=>{
    const ts=marks.filter(m=>m.ei===ei).map(m=>m.t);
    if(!ts.length) return;
    const rests=ts.slice(1).map((t,i)=>t-ts[i]).filter(g=>g>=MIN_GAP&&g<20*60e3);
    const first=Math.min(...ts), last=Math.max(...ts);
    ents.push({ei,exId:e.exId,name:exById(e.exId).name,from:Math.min(prevEnd,first),first,last,mins:(last-Math.min(prevEnd,first))/60e3,
      rests,avgRest:rests.length?rests.reduce((a,b)=>a+b,0)/rests.length:null,target:(REST[e.scheme]||90)*1000});
    prevEnd=last;
  });
  const end=s.endedAt&&s.endedAt>=marks[marks.length-1].t?s.endedAt:marks[marks.length-1].t;
  const all=ents.flatMap(x=>x.rests);
  return {start,end,ents,marks,totalMins:(end-start)/60e3,avgRest:all.length?all.reduce((a,b)=>a+b,0)/all.length:null};
}

export function restVerdict(avg,target){
  if(avg==null) return '';
  const r=avg/target;
  if(r<0.75) return '<span class="chip warn">short</span>';
  if(r>1.6) return '<span class="chip">long</span>';
  return '';
}

// Compact timeline bar: one band per exercise with a tick for every set.
function timelineSVG(T){
  const W=600,H=34, span=Math.max(1,T.end-T.start); const X=t=>((t-T.start)/span*W).toFixed(1);
  let g='';
  T.ents.forEach((x,i)=>{ g+='<rect x="'+X(x.from)+'" y="6" width="'+Math.max(2,X(x.last)-X(x.from))+'" height="22" rx="3" class="tlb'+(i%2)+'"/>'; });
  for(const m of T.marks) g+='<line x1="'+X(m.t)+'" x2="'+X(m.t)+'" y1="3" y2="31" class="tlt"/>';
  return '<svg class="tline" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" role="img" aria-label="Session timeline">'+g+'</svg>';
}

export function timingHTML(s,compact){
  const T=sessionTiming(s);
  if(!T) return '';
  if(T.batch) return compact?'':'<p class="small muted">Sets were checked off together after the workout, so there are no rest times for this one.</p>';
  let h='<div class="timing">';
  if(!compact) h+='<div class="row between"><b>Time</b><span class="small muted mono">'+Math.round(T.totalMins)+' min'+(T.avgRest!=null?' · avg rest '+fmtClock(T.avgRest):'')+'</span></div>'+timelineSVG(T);
  h+='<div class="tbl-wrap"><table class="ttbl"><thead><tr><th>Exercise</th><th class="num">Time</th><th class="num">Avg rest</th><th class="num">Plan</th></tr></thead><tbody>';
  for(const x of T.ents) h+='<tr><td>'+esc(x.name)+'</td><td class="num">'+Math.max(1,Math.round(x.mins))+' min</td><td class="num">'+(x.avgRest!=null?fmtClock(x.avgRest)+' '+restVerdict(x.avgRest,x.target):'—')+'</td><td class="num muted">'+fmtClock(x.target)+'</td></tr>';
  h+='</tbody></table></div></div>';
  return h;
}
