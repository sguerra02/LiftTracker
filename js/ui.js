/* Iron Ledger — Rest timer, modal and toast */
import { $, S, TYPES, esc, uid } from './core.js';
import { avail } from './equipment.js';
import { cancelRestAlert, prefs, scheduleRestAlert, vibrate } from './features/alerts.js';

/* ---------- timer / misc ---------- */
let timer=null, actx=null;
function beep(){ try{ if(!actx) return; const o=actx.createOscillator(), g=actx.createGain(); o.frequency.value=880; g.gain.value=.15; o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime+.35); }catch(e){} }
function startRest(sec,label){ try{ if(!actx) actx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} timer={end:Date.now()+sec*1000,total:sec,label,beeped:false}; $('#rest').hidden=false; tick(); scheduleRestAlert(timer); }
function tick(){
  const el=$('#elapsed'); if(el&&S.current&&S.current.startedAt){ const m=Math.floor((Date.now()-S.current.startedAt)/60000); el.textContent=m+' min'; }
  if(!timer) return; const left=Math.round((timer.end-Date.now())/1000); const r=$('#rest');
  const a=Math.abs(left); $('#restT').textContent=(left<0?'+':'')+Math.floor(a/60)+':'+String(a%60).padStart(2,'0');
  $('#restL').textContent=left>0?'Rest · '+timer.label:'Rest over · next set';
  $('#restB').style.width=Math.min(100,Math.max(0,(1-left/timer.total)*100))+'%';
  r.classList.toggle('done',left<=0);
  if(left<=0&&!timer.beeped){ timer.beeped=true; if(prefs().sound) beep(); vibrate(); }
  if(left<-300){ timer=null; r.hidden=true; }
}
setInterval(tick,500);
let wake=null; async function wakeOn(){ try{ if(navigator.wakeLock) wake=await navigator.wakeLock.request('screen'); }catch(e){} }
function wakeOff(){ try{ wake&&wake.release(); }catch(e){} wake=null; }
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>t.hidden=true,2400); }
let confirmFn=null;
function askConfirm(title,msg,yes,fn,noLabel){ confirmFn=fn; const m=$('#modal'); m.className='modal'; m.innerHTML='<div class="box" role="dialog" aria-modal="true" aria-labelledby="mt"><h3 id="mt">'+esc(title)+'</h3>'+(Array.isArray(msg)?'<ul class="issues">'+msg.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p>'+esc(msg)+'</p>')+'<div class="row"><button class="primary" data-act="cYes">'+esc(yes)+'</button><button data-act="cNo">'+esc(noLabel||'Cancel')+'</button></div></div>'; m.hidden=false; $('[data-act="cYes"]',m).focus(); }
function closeModal(){ const m=$('#modal'); m.hidden=true; m.innerHTML=''; confirmFn=null; }
const P=id=>S.plans.find(p=>p.id===id);
function newSlot(p,scheme){ const first=S.exercises.find(avail)||S.exercises[0]; const sc=scheme||TYPES[p.type].schemes[TYPES[p.type].schemes.length>1&&p.type!=='gzclp'?0:0]; const s={id:uid(),exId:first.id,scheme:sc}; if(sc==='L'){s.sets=3;s.reps=5;} if(sc==='G') s.sets=3; if(sc==='D'){s.sets=3;s.repMin=8;s.repMax=12;} return s; }

export function setTimer(v){ timer=v; if(!v) cancelRestAlert(); }
export { P, askConfirm, closeModal, confirmFn, newSlot, startRest, tick, timer, toast, wakeOff, wakeOn };
