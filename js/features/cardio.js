/* Iron Ledger — Cardio log: walks, runs, rides and the rest, with weekly active minutes */
import { DAY, S, U, esc, fmtD, iso, parseISO, save, todayISO, uid } from '../core.js';
import { V, render } from '../state.js';
import { askConfirm, toast } from '../ui.js';
import { ACT } from '../registry.js';

export const CARDIO_TYPES=[['walk','Walk'],['run','Run'],['bike','Bike'],['row','Row'],['elliptical','Elliptical'],['stairs','Stairs'],['swim','Swim'],['hike','Hike'],['other','Other']];
export const EFFORTS=[['light','Light','Easy pace, could sing'],['moderate','Moderate','Can talk, can’t sing'],['vigorous','Vigorous','A few words at a time']];
// Health guidelines (CDC, WHO): 150 minutes a week of moderate activity, where a vigorous minute counts as two.
export const WEEK_TARGET=150;
const typeName=k=>(CARDIO_TYPES.find(t=>t[0]===k)||[k,'Cardio'])[1];
const distUnit=()=>U()==='kg'?'km':'mi';
export const activeMin=c=>c.effort==='vigorous'?2*(+c.min||0):c.effort==='moderate'?(+c.min||0):0;

function weekStart(isoS){ const d=parseISO(isoS); const dow=(d.getDay()+6)%7; return iso(new Date(d.getFullYear(),d.getMonth(),d.getDate()-dow)); }
export function cardioList(){ return (S.cardio||[]).slice().sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:(b.createdAt||0)-(a.createdAt||0)); }
export function cardioWeek(wk){
  const end=iso(new Date(parseISO(wk).getTime()+6.5*DAY));
  const list=(S.cardio||[]).filter(c=>c.date>=wk&&c.date<=end);
  const dist={}; for(const c of list) if(+c.dist>0) dist[c.du]=(dist[c.du]||0)+(+c.dist);
  return {list,n:list.length,min:list.reduce((a,c)=>a+(+c.min||0),0),active:list.reduce((a,c)=>a+activeMin(c),0),dist};
}
const distText=d=>Object.entries(d).map(([u,v])=>(Math.round(v*10)/10)+' '+u).join(' + ');
export function cardioSummaryLine(wk){
  const W=cardioWeek(wk); if(!W.n) return '';
  return '<p class="small"><span class="chip cd">Cardio</span> '+W.n+' session'+(W.n>1?'s':'')+' · '+W.min+' min'+(distText(W.dist)?' · '+distText(W.dist):'')+' · <b class="mono">'+W.active+'</b> of '+WEEK_TARGET+' active minutes</p>';
}
export function cardioByDate(){ const m={}; for(const c of S.cardio||[]) (m[c.date]=m[c.date]||[]).push(c); return m; }

function formHTML(){
  const f=V.cardio||{}; const ty=f.type||((S.cardio||[]).length?cardioList()[0].type:'walk'); const ef=f.effort||'moderate';
  let h='<div class="stack cform" style="gap:10px">';
  h+='<div class="row"><label class="f">Activity<select id="cd-type">'+CARDIO_TYPES.map(([k,l])=>'<option value="'+k+'"'+(k===ty?' selected':'')+'>'+l+'</option>').join('')+'</select></label>';
  h+='<label class="f">Minutes<input type="number" inputmode="numeric" min="1" step="1" id="cd-min" style="width:84px" value="'+esc(f.min||'')+'"></label>';
  h+='<label class="f">Distance ('+distUnit()+')<input type="number" inputmode="decimal" min="0" step="any" id="cd-dist" style="width:96px" placeholder="optional" value="'+esc(f.dist||'')+'"></label>';
  h+='<label class="f">Date<input type="date" id="cd-date" value="'+esc(f.date||todayISO())+'"></label></div>';
  h+='<fieldset class="effort"><legend class="small">How hard</legend>'+EFFORTS.map(([k,l,d])=>'<label class="eff"><input type="radio" name="cd-effort" id="cd-ef-'+k+'" value="'+k+'"'+(k===ef?' checked':'')+'><span><b>'+l+'</b><small>'+d+'</small></span></label>').join('')+'</fieldset>';
  h+='<label class="f">Notes<input type="text" id="cd-notes" placeholder="Route, how it felt" value="'+esc(f.notes||'')+'"></label>';
  h+='<div class="row"><button class="primary" data-act="cardioSave">Save cardio</button><button class="ghost" data-act="cardioClose">Cancel</button></div></div>';
  return h;
}
function weekMeter(){
  const W=cardioWeek(weekStart(todayISO())); const pct=Math.min(100,W.active/WEEK_TARGET*100);
  return '<div class="stack" style="gap:4px"><div class="row between small"><span><b class="mono">'+W.active+'</b> of '+WEEK_TARGET+' active minutes this week</span><span class="muted">'+W.n+' session'+(W.n===1?'':'s')+'</span></div><div class="meter cdm"><div style="width:'+pct.toFixed(1)+'%"></div></div></div>';
}
export function cardioTodayHTML(){
  let h='<section class="panel" id="cardio-panel"><div class="row between"><h3>Cardio</h3>'+(V.cardioOpen?'':'<button data-act="cardioOpen">Log cardio</button>')+'</div>';
  h+=weekMeter();
  if(V.cardioOpen) h+=formHTML();
  return h+'</section>';
}

function weeksChart(){
  const now=parseISO(weekStart(todayISO())); const wks=[];
  for(let i=11;i>=0;i--){ const k=iso(new Date(now.getFullYear(),now.getMonth(),now.getDate()-7*i)); wks.push([k,cardioWeek(k)]); }
  const W=600,H=260,L=48,B=34,T=14, max=Math.max(WEEK_TARGET*1.2,...wks.map(w=>w[1].active)); const bw=(W-L-8)/12;
  const Y=v=>T+(1-v/max)*(H-T-B);
  let g='';
  for(const v of [0,50,100,150,200,250,300].filter(v=>v<=max)) g+='<line x1="'+L+'" x2="'+(W-4)+'" y1="'+Y(v)+'" y2="'+Y(v)+'" class="gl"/><text x="'+(L-6)+'" y="'+(Y(v)+4)+'" text-anchor="end" class="ax">'+v+'</text>';
  wks.forEach(([k,w],i)=>{ const x=L+i*bw+3, h=Y(0)-Y(w.active);
    g+='<rect x="'+x.toFixed(1)+'" y="'+Y(w.active).toFixed(1)+'" width="'+(bw-6).toFixed(1)+'" height="'+Math.max(0,h).toFixed(1)+'" rx="3" class="'+(w.active>=WEEK_TARGET?'bar ok':'bar')+'"><title>Week of '+fmtD(parseISO(k))+': '+w.active+' active min</title></rect>';
    if(i%3===0||i===11) g+='<text x="'+(x+(bw-6)/2).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle" class="ax">'+fmtD(parseISO(k))+'</text>'; });
  g+='<line x1="'+L+'" x2="'+(W-4)+'" y1="'+Y(WEEK_TARGET)+'" y2="'+Y(WEEK_TARGET)+'" class="tgt"/>';
  return '<svg class="cdchart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Active cardio minutes per week, last 12 weeks">'+g+'</svg>';
}
export function viewCardio(){
  const list=cardioList();
  let h='<section class="panel"><div class="row between"><h2>Cardio</h2>'+(V.cardioOpen?'':'<button class="primary" data-act="cardioOpen">Log cardio</button>')+'</div>'+weekMeter()+(V.cardioOpen?formHTML():'');
  h+='<p class="small muted">Active minutes follow the health guideline of 150 a week: moderate minutes count once, vigorous minutes count twice, light minutes are logged but not counted. Cardio sessions also count toward your weekly streak.</p></section>';
  if(!list.length) return h+'<section class="panel"><p class="muted">No cardio logged yet. Walks, rides, runs and rowing all count.</p></section>';
  h+='<section class="panel"><h3>Last 12 weeks</h3>'+weeksChart()+'</section>';
  const cut=iso(new Date(Date.now()-30*DAY)); const by={};
  for(const c of list) if(c.date>=cut){ const b=by[c.type]||(by[c.type]={n:0,min:0,dist:{}}); b.n++; b.min+=+c.min||0; if(+c.dist>0) b.dist[c.du]=(b.dist[c.du]||0)+(+c.dist); }
  if(Object.keys(by).length) h+='<section class="panel"><h3>Last 30 days</h3><div class="tbl-wrap"><table><thead><tr><th>Activity</th><th class="num">Sessions</th><th class="num">Minutes</th><th class="num">Distance</th></tr></thead><tbody>'+Object.entries(by).sort((a,b)=>b[1].min-a[1].min).map(([k,b])=>'<tr><td>'+typeName(k)+'</td><td class="num">'+b.n+'</td><td class="num">'+b.min+'</td><td class="num">'+(distText(b.dist)||'—')+'</td></tr>').join('')+'</tbody></table></div></section>';
  const show=V.cardioAll?list:list.slice(0,20);
  h+='<section class="panel"><h3>Log</h3><div class="stack" style="gap:0">'+show.map(c=>'<div class="cdrow"><span class="small muted mono">'+fmtD(parseISO(c.date))+'</span><div><b>'+typeName(c.type)+'</b> <span class="mono">'+c.min+' min'+(+c.dist>0?' · '+c.dist+' '+c.du:'')+'</span> <span class="chip'+(c.effort==='vigorous'?' warn':c.effort==='moderate'?' cd':'')+'">'+(EFFORTS.find(e=>e[0]===c.effort)||['', 'Moderate'])[1]+'</span>'+(c.notes?'<div class="small muted">'+esc(c.notes)+'</div>':'')+'</div><button class="ghost small" data-act="cardioDel" data-id="'+c.id+'" aria-label="Delete">Delete</button></div>').join('')+'</div>'+(list.length>20&&!V.cardioAll?'<div><button class="ghost" data-act="cardioAll">Show all '+list.length+'</button></div>':'')+'</section>';
  return h;
}

Object.assign(ACT,{
  cardioOpen(){ V.cardioOpen=true; V.cardio={}; render(); const el=document.getElementById('cd-min'); if(el) el.focus(); },
  cardioClose(){ V.cardioOpen=false; render(); },
  cardioAll(){ V.cardioAll=true; render(); },
  cardioSave(){
    const g=id=>document.getElementById(id); const min=Math.round(parseFloat(g('cd-min').value));
    if(!(min>0)){ toast('Enter how many minutes'); g('cd-min').focus(); return; }
    const ty=g('cd-type').value; const dist=parseFloat(g('cd-dist').value); const ef=(document.querySelector('input[name="cd-effort"]:checked')||{}).value||'moderate';
    S.cardio=S.cardio||[];
    S.cardio.push({id:uid(),date:g('cd-date').value||todayISO(),createdAt:Date.now(),type:ty,min,dist:dist>0?Math.round(dist*100)/100:null,du:distUnit(),effort:ef,notes:g('cd-notes').value.trim()});
    V.cardioOpen=false; save(); render(); toast(typeName(ty)+' logged');
  },
  cardioDel(b){ askConfirm('Delete this cardio session?','It’s removed from your log and weekly totals.','Delete',()=>{ S.cardio=(S.cardio||[]).filter(c=>c.id!==b.dataset.id); save(); render(); }); }
});
