/* Iron Ledger — Rest timer alerts: vibration, sound, and a lock-screen notification through the service worker */
import { S, save } from '../core.js';
import { render } from '../state.js';
import { toast } from '../ui.js';
import { ACT, CH } from '../registry.js';

export const VIBE=[250,120,250,120,400];
const canNotify=()=>'Notification' in window&&'serviceWorker' in navigator&&window.isSecureContext;
export const prefs=()=>Object.assign({sound:true,vibrate:true,notify:false},S.settings.restAlert||{});
export function notifyReady(){ return prefs().notify&&canNotify()&&Notification.permission==='granted'; }

async function worker(){
  try{ const r=await navigator.serviceWorker.getRegistration(); return r&&(r.active||r.waiting||r.installing)||null; }catch(e){ return null; }
}
let seq=0;
export async function scheduleRestAlert(timer){
  if(!timer||!notifyReady()) return;
  const w=await worker(); if(!w) return;
  w.postMessage({type:'rest',id:++seq+'-'+timer.end,at:timer.end,title:'Rest over',body:'Next set: '+timer.label});
}
export async function cancelRestAlert(){
  if(!canNotify()) return; const w=await worker(); if(w) w.postMessage({type:'rest-cancel'});
}
export function vibrate(){ if(prefs().vibrate){ try{ navigator.vibrate&&navigator.vibrate(VIBE); }catch(e){} } }

export function alertsPanelHTML(){
  const p=prefs(); const sup=canNotify(); const perm=sup?Notification.permission:'unsupported';
  let h='<section class="panel"><h3>Rest timer</h3><div class="stack" style="gap:8px">';
  h+='<label class="row small"><input type="checkbox" id="ra-sound" data-ch="restPref" data-f="sound"'+(p.sound?' checked':'')+'> Beep when rest is over</label>';
  h+='<label class="row small"><input type="checkbox" id="ra-vibrate" data-ch="restPref" data-f="vibrate"'+(p.vibrate?' checked':'')+'> Vibrate when rest is over</label>';
  if(!sup) h+='<p class="small muted">Lock-screen alerts need the hosted version of the app (an https:// address), opened in Chrome or another browser that supports notifications.</p>';
  else if(perm==='denied') h+='<p class="small muted">Notifications are blocked for this site. Allow them in your browser’s site settings, then come back here.</p>';
  else if(p.notify&&perm==='granted') h+='<div class="row"><span class="chip good">Lock-screen alerts on</span><button class="ghost" data-act="alertsOff">Turn off</button><button class="ghost" data-act="alertsTest">Send a test</button></div>';
  else h+='<div class="row"><button data-act="alertsOn">Turn on lock-screen alerts</button></div>';
  h+='<p class="small muted">With lock-screen alerts on, you get a notification when rest is over even if your phone is locked or you’re in another app. Keep the app open in the background during a workout.</p></div></section>';
  return h;
}

Object.assign(ACT,{
  async alertsOn(){
    if(!canNotify()){ toast('Notifications aren’t available here'); return; }
    let perm=Notification.permission; if(perm==='default'){ try{ perm=await Notification.requestPermission(); }catch(e){} }
    if(perm!=='granted'){ toast('Notifications were not allowed'); render(); return; }
    S.settings.restAlert=Object.assign(prefs(),{notify:true}); save(); render(); toast('Lock-screen alerts on');
  },
  alertsOff(){ S.settings.restAlert=Object.assign(prefs(),{notify:false}); save(); render(); },
  async alertsTest(){ const w=await worker(); if(!w){ toast('Reload the page once, then try again'); return; } w.postMessage({type:'rest',id:'test-'+Date.now(),at:Date.now()+5000,title:'Rest over',body:'Test alert from Iron Ledger',force:true}); toast('Test alert in 5 seconds. Lock your phone to see it.'); }
});
Object.assign(CH,{
  restPref(t){ S.settings.restAlert=Object.assign(prefs(),{[t.dataset.f]:t.checked}); save(); }
});
