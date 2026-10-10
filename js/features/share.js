/* Iron Ledger — Sharing: PR image cards and single-plan files */
import { $, S, TYPES, U, esc, fmtW, parseISO, save, todayISO, uid } from '../core.js';
import { exById, loadOptions, missing } from '../equipment.js';
import { compareText, fmtBig, fmtMass, sessionVolume } from '../fun.js';
import { render } from '../state.js';
import { askConfirm, closeModal, toast } from '../ui.js';
import { ACT, CH } from '../registry.js';
import { analyze } from '../views/trophies.js';

/* ---------- getting a file to the person ---------- */
let pending=null;   // {blob, filename, title, url}
function canShareFile(f){ try{ return !!(navigator.canShare&&navigator.share&&navigator.canShare({files:[f]})); }catch(e){ return false; } }
export function downloadBlob(blob,filename){
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),4000);
}
function fileModal({blob,filename,title,desc,image}){
  if(pending&&pending.url) URL.revokeObjectURL(pending.url);
  const url=URL.createObjectURL(blob); pending={blob,filename,title,url};
  const f=new File([blob],filename,{type:blob.type});
  const m=$('#modal'); m.className='modal';
  m.innerHTML='<div class="box sharebox" role="dialog" aria-modal="true" aria-labelledby="mt"><h3 id="mt">'+esc(title)+'</h3>'+(image?'<img class="cardprev" src="'+url+'" alt="'+esc(title)+'">':'')+(desc?'<p class="small muted">'+esc(desc)+'</p>':'')+
    '<div class="row">'+(canShareFile(f)?'<button class="primary" data-act="fileShare">Share…</button>':'')+'<button'+(canShareFile(f)?'':' class="primary"')+' data-act="fileSave">'+(image?'Save image':'Download file')+'</button><button class="ghost" data-act="cNo">Close</button></div></div>';
  m.hidden=false;
}

/* ---------- PR card ---------- */
const C={bg:'#101412',panel:'#171C19',ink:'#E4EAE6',muted:'#98A39D',line:'#2D3531',accent:'#86A8EC',good:'#72C394',plate:'#C9D2CD'};
const DISPLAY='"Barlow Condensed","Arial Narrow",Arial,sans-serif', SANS='"IBM Plex Sans",system-ui,sans-serif', MONO='"IBM Plex Mono",ui-monospace,monospace';
async function fontsReady(){ try{ await Promise.all(['700 200px "Barlow Condensed"','600 40px "Barlow Condensed"','500 30px "IBM Plex Mono"','400 34px "IBM Plex Sans"'].map(f=>document.fonts.load(f))); }catch(e){} }
function wrap(ctx,text,maxW){ const words=String(text).split(' '); const lines=[]; let cur='';
  for(const w of words){ const t=cur?cur+' '+w:w; if(ctx.measureText(t).width>maxW&&cur){ lines.push(cur); cur=w; } else cur=t; } if(cur) lines.push(cur); return lines; }
function fitFont(ctx,text,weight,family,maxPx,minPx,maxW){ let px=maxPx; do{ ctx.font=weight+' '+px+'px '+family; if(ctx.measureText(text).width<=maxW) break; px-=4; } while(px>minPx); return px; }

export function prFacts(pr){
  const ex=exById(pr.exId), u=U(), set=pr.set||{w:0,r:0};
  // The headline is drawn in pieces: big weight, small unit, big reps.
  const parts=ex.load==='bodyweight'?(set.w>0?[['BW+'+fmtW(set.w),1],[u,0],[' × '+set.r,1]]:[[String(set.r),1],[' reps',0]]):[[fmtW(set.w),1],[u+(ex.load==='dumbbell'?' each':''),0],[' × '+set.r,1]];
  const big=parts.map(p=>p[0]).join(' ');
  let sub;
  if(pr.type==='e1') sub='Estimated max '+fmtBig(pr.val)+' '+u+(pr.was>0?' · up '+fmtBig(pr.val-pr.was)+' '+u:'');
  else if(pr.type==='heavy') sub='Heaviest ever'+(pr.was>0?' · up '+fmtW(Math.round((pr.val-pr.was)*100)/100)+' '+u:'');
  else sub=set.r+' reps at '+fmtW(set.w)+' '+u+' · '+(pr.val-pr.was)+' more than before';
  const label={e1:'New best estimated max',heavy:'Heaviest set ever',reps:'Rep record'}[pr.type]||'Personal record';
  return {ex,big,parts,sub,label};
}

export async function drawPRCard(pr){
  await fontsReady();
  const W=1080,H=1350, cv=document.createElement('canvas'); cv.width=W; cv.height=H; const x=cv.getContext('2d');
  const F=prFacts(pr), s=S.sessions.find(z=>z.id===pr.sid), d=parseISO(pr.date);
  x.fillStyle=C.bg; x.fillRect(0,0,W,H);
  // faint knurling texture along the top: the bar's grip pattern
  x.strokeStyle=C.line; x.lineWidth=2; for(let i=-H;i<W;i+=22){ x.beginPath(); x.moveTo(i,0); x.lineTo(i+120,120); x.stroke(); x.beginPath(); x.moveTo(i+120,0); x.lineTo(i,120); x.stroke(); }
  x.fillStyle=C.bg; x.fillRect(0,120,W,H-120);
  const P=84;
  x.fillStyle=C.ink; x.font='700 52px '+DISPLAY; x.textBaseline='alphabetic'; x.fillText('IRON LEDGER',P,210);
  x.font='500 30px '+MONO; x.fillStyle=C.muted; x.textAlign='right'; x.fillText(d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}).toUpperCase(),W-P,208); x.textAlign='left';
  x.fillStyle=C.accent; x.font='500 34px '+MONO; x.fillText(F.label.toUpperCase(),P,330);
  // exercise name, wrapped
  x.fillStyle=C.ink; let px=fitFont(x,F.ex.name,'700',DISPLAY,132,84,W-2*P); let y=330+px*1.02;
  for(const line of wrap(x,F.ex.name,W-2*P).slice(0,2)){ x.fillText(line,P,y); y+=px*0.95; }
  // the number
  y+=40;
  // size the headline so weight, unit and reps fit on one line
  let bp=270; const widthAt=px=>F.parts.reduce((a,[t,b])=>{ x.font=(b?'700 '+px:'600 '+Math.round(px*0.3))+'px '+DISPLAY; return a+x.measureText(t).width+(b?0:16); },0);
  while(bp>120&&widthAt(bp)>W-2*P) bp-=6;
  let cx=P; const base=y+bp*0.78;
  for(const [t,b] of F.parts){ x.font=(b?'700 '+bp:'600 '+Math.round(bp*0.3))+'px '+DISPLAY; x.fillStyle=b?C.good:C.muted; if(!b) cx+=8; x.fillText(t,cx,base); cx+=x.measureText(t).width+(b?0:8); }
  y=base+70;
  x.font='400 40px '+SANS; x.fillStyle=C.ink; x.fillText(F.sub,P,y);
  // plates on one side of the bar, if this was a barbell lift
  if(F.ex.load==='barbell'&&pr.set){ const o=loadOptions(F.ex).find(z=>Math.abs(z.w-pr.set.w)<0.01);
    if(o&&o.side&&o.side.length){ const by=y+150; x.fillStyle=C.plate; x.fillRect(P,by-9,W-2*P,18);
      let px2=P+60; for(const p of o.side){ const lb=U()==='kg'?p.weight/0.4536:p.weight; const h=Math.max(70,Math.min(250,90+160*Math.sqrt(lb/45))); const w=Math.max(22,Math.min(46,16+lb*0.65));
        x.fillStyle=C.panel; x.strokeStyle=C.plate; x.lineWidth=4; x.beginPath(); x.roundRect?x.roundRect(px2,by-h/2,w,h,8):x.rect(px2,by-h/2,w,h); x.fill(); x.stroke();
        x.save(); x.translate(px2+w/2,by+h/2+30); x.fillStyle=C.muted; x.font='500 24px '+MONO; x.textAlign='center'; x.fillText(fmtW(p.weight),0,0); x.restore(); px2+=w+10; }
      y=by+170; } }
  // session total with a real-world comparison
  if(s){ const vol=sessionVolume(s); y=Math.max(y+60,H-300); x.strokeStyle=C.line; x.lineWidth=2; x.beginPath(); x.moveTo(P,y-50); x.lineTo(W-P,y-50); x.stroke();
    x.font='500 28px '+MONO; x.fillStyle=C.muted; x.fillText('WORKOUT TOTAL',P,y); x.font='700 64px '+DISPLAY; x.fillStyle=C.ink; x.fillText(fmtMass(vol),P,y+70);
    x.font='400 34px '+SANS; x.fillStyle=C.muted; let yy=y+130; for(const line of wrap(x,compareText(vol),W-2*P).slice(0,2)){ x.fillText(line,P,yy); yy+=46; } }
  return new Promise(r=>cv.toBlob(b=>r(b),'image/png'));
}

export function prShareButton(pr){ return '<button class="ghost small" data-act="prCard" data-s="'+pr.sid+'" data-ex="'+esc(pr.exId)+'">Share</button>'; }

/* ---------- plan files ---------- */
const STRIP=['id','runId','start','startedAt','archived'];
export function planPayload(p){
  const plan=JSON.parse(JSON.stringify(p)); STRIP.forEach(k=>delete plan[k]);
  plan.days.forEach(d=>{ delete d.id; d.slots.forEach(s=>delete s.id); });
  const used=new Set(p.days.flatMap(d=>d.slots.map(s=>s.exId)));
  const exercises=S.exercises.filter(e=>used.has(e.id)).map(e=>({id:e.id,name:e.name,load:e.load,req:e.req||[],pattern:e.pattern,inc:e.inc,custom:!!e.custom}));
  return {app:'iron-ledger',kind:'plan',v:1,exported:new Date().toISOString(),unit:U(),plan,exercises};
}
const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'plan';

// Turn a plan file into a plan in this log. Returns {plan, added, missing} or throws with a readable message.
export function preparePlanImport(o){
  if(!o||o.kind!=='plan'||!o.plan||!Array.isArray(o.plan.days)) throw new Error('That isn’t an Iron Ledger plan file.');
  const p=JSON.parse(JSON.stringify(o.plan)); if(!TYPES[p.type]) throw new Error('This plan uses a program type this version doesn’t know ('+p.type+').');
  const map={}, added=[];
  for(const e of o.exercises||[]){
    const same=S.exercises.find(x=>x.id===e.id&&x.name.toLowerCase()===String(e.name).toLowerCase());
    const byName=same||S.exercises.find(x=>x.name.toLowerCase()===String(e.name).toLowerCase());
    if(byName){ map[e.id]=byName.id; continue; }
    const ne={id:'x-'+uid(),name:String(e.name),load:e.load||'barbell',req:Array.isArray(e.req)?e.req.slice():[],pattern:e.pattern||'core',inc:+e.inc||0,custom:true};
    added.push(ne); map[e.id]=ne.id;
  }
  const known=id=>map[id]||(S.exercises.some(x=>x.id===id)?id:null);
  let dropped=0;
  p.days.forEach(d=>{ d.id=uid(); d.slots=d.slots.filter(s=>{ const id=known(s.exId); if(!id){ dropped++; return false; } s.exId=id; s.id=uid(); return true; }); });
  p.id=uid(); p.runId=null; p.start={}; p.startedAt=null;
  if(S.plans.some(x=>x.name===p.name)) p.name=p.name+' (imported)';
  const all=[...S.exercises,...added]; const ids=new Set(p.days.flatMap(d=>d.slots.map(s=>s.exId)));
  const miss=[...ids].map(id=>all.find(e=>e.id===id)).filter(e=>e&&!added.includes(e)&&missing(e).length).map(e=>e.name);
  if(o.unit&&o.unit!==U()) p.days.forEach(d=>d.slots.forEach(s=>{ if(s.inc) s.inc=o.unit==='lb'?s.inc/2:s.inc*2; }));
  return {plan:p,added,missing:miss,dropped};
}
export function importPlanText(txt){
  let o; try{ o=JSON.parse(String(txt||'').trim()); }catch(e){ toast('That isn’t an Iron Ledger plan file'); return false; }
  let r; try{ r=preparePlanImport(o); }catch(e){ toast(e.message); return false; }
  const lines=[r.plan.days.length+' day'+(r.plan.days.length===1?'':'s')+', '+r.plan.days.reduce((a,d)=>a+d.slots.length,0)+' exercise slots.'];
  if(r.added.length) lines.push('Adds '+r.added.length+' exercise'+(r.added.length>1?'s':'')+' to your list: '+r.added.map(e=>e.name).join(', ')+'.');
  if(r.missing.length) lines.push('Your equipment doesn’t cover: '+r.missing.join(', ')+'. You can swap those during a workout.');
  if(r.dropped) lines.push(r.dropped+' exercise'+(r.dropped>1?'s':'')+' in the file couldn’t be matched and were left out.');
  lines.push('Your workouts and other plans stay as they are.');
  askConfirm('Add “'+r.plan.name+'”?',lines,'Add plan',()=>{ S.exercises.push(...r.added); S.plans.push(r.plan); save(); render(); toast('Plan added. Pick “Use this plan” to start it.'); });
  return true;
}

Object.assign(ACT,{
  async prCard(b){
    const A=analyze(); const pr=(A.prs[b.dataset.s]||[]).find(p=>p.exId===b.dataset.ex); if(!pr){ toast('That record isn’t in your log anymore'); return; }
    b.disabled=true; let blob=null; try{ blob=await drawPRCard(pr); }catch(e){} b.disabled=false;
    if(!blob){ toast('Couldn’t make the image on this device'); return; }
    fileModal({blob,filename:'iron-ledger-pr-'+exById(pr.exId).name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-'+pr.date+'.png',title:'Your PR card',image:true});
  },
  planShare(b){
    const p=S.plans.find(x=>x.id===b.dataset.p); if(!p) return;
    const blob=new Blob([JSON.stringify(planPayload(p),null,1)],{type:'application/json'});
    fileModal({blob,filename:'iron-ledger-plan-'+slug(p.name)+'.json',title:'Share '+p.name,desc:'This file holds the plan’s days, exercises and settings. Your weights and workouts aren’t included. Whoever gets it can add it under Plans → Import a plan.'});
  },
  async fileShare(){
    if(!pending) return; const f=new File([pending.blob],pending.filename,{type:pending.blob.type});
    try{ await navigator.share({files:[f],title:pending.title}); closeModal(); }catch(e){ if(!(e&&e.name==='AbortError')) toast('Sharing didn’t work here. Use Save instead.'); }
  },
  fileSave(){ if(!pending) return; downloadBlob(pending.blob,pending.filename); closeModal(); toast('Saved'); },
  planImportPaste(){ const t=$('#plan-import-text'); if(t&&t.value.trim()) importPlanText(t.value); }
});
Object.assign(CH,{
  planFile(t){ const f=t.files&&t.files[0]; t.value=''; if(!f) return; f.text().then(importPlanText,()=>toast('Couldn’t read that file')); }
});

export function planImportHTML(){
  return '<section class="panel"><h3>Import a plan</h3><p class="small muted">Add a plan someone shared with you as an Iron Ledger plan file. Your workouts and other plans aren’t changed.</p><div class="row"><label class="btn" for="plan-file" style="display:inline-flex;align-items:center">Choose plan file</label><input type="file" id="plan-file" accept=".json,application/json" data-ch="planFile" style="position:absolute;width:1px;height:1px;opacity:0"></div><details><summary class="small" style="cursor:pointer">Paste plan text instead</summary><textarea id="plan-import-text" placeholder="Paste the plan file’s text"></textarea><div><button data-act="planImportPaste">Add plan</button></div></details></section>';
}
