/* Iron Ledger — Real-world weight comparisons and the lifetime ladder */
import { S, U, esc, fmtW, fromLb, memoize, toLb, uid } from './core.js';
import { exById } from './equipment.js';
import { EDIT } from './state.js';

/* ---------- fun comparisons (approximate weights, lb) ---------- */
const THINGS=[
 [3.5,'bowling pin','bowling pins'],[10,'house cat','house cats'],[14,'bowling ball','bowling balls'],[15,'Thanksgiving turkey','Thanksgiving turkeys'],
 [20,'watermelon','watermelons'],[27.4,'400-oz gold bar','400-oz gold bars'],[35,'cinder block','cinder blocks'],[45,'Olympic barbell','Olympic barbells'],
 [65,'golden retriever','golden retrievers'],[75,'emperor penguin','emperor penguins'],[80,'bag of concrete','bags of concrete'],[100,'blacksmith’s anvil','blacksmith’s anvils'],
 [100,'gray wolf','gray wolves'],[160,'full beer keg','full beer kegs'],[170,'washing machine','washing machines'],[190,'red kangaroo','red kangaroos'],
 [220,'giant panda','giant pandas'],[250,'ostrich','ostriches'],[250,'refrigerator','refrigerators'],[330,'sumo wrestler','sumo wrestlers'],
 [350,'silverback gorilla','silverback gorillas'],[550,'snowmobile','snowmobiles'],[600,'grizzly bear','grizzly bears'],[700,'Harley-Davidson','Harley-Davidsons'],
 [800,'American alligator','American alligators'],[800,'vending machine','vending machines'],[1000,'grand piano','grand pianos'],[1000,'polar bear','polar bears'],
 [1000,'saltwater crocodile','saltwater crocodiles'],[1100,'horse','horses'],[1200,'Ford Model T','Ford Model Ts'],[1200,'bull moose','bull moose'],
 [1500,'dairy cow','dairy cows'],[1700,'Cessna 172','Cessna 172s'],[1800,'American bison','American bison'],[2000,'Clydesdale','Clydesdales'],
 [2080,'Liberty Bell','Liberty Bells'],[2260,'Mars Perseverance rover','Mars Perseverance rovers'],[2400,'great white shark','great white sharks'],[2600,'giraffe','giraffes'],
 [2700,'Mini Cooper','Mini Coopers'],[2700,'walrus','walruses'],[2900,'Honda Civic','Honda Civics'],[3300,'hippopotamus','hippopotamuses'],
 [4600,'Tesla Model S','Tesla Model Ss'],[4700,'Ford F-150','Ford F-150s'],[5000,'white rhino','white rhinos'],[8000,'orca','orcas'],
 [11000,'Stegosaurus','Stegosauruses'],[12000,'African elephant','African elephants'],[13000,'woolly mammoth','woolly mammoths'],[18000,'Tyrannosaurus rex','T. rexes'],
 [19700,'F-16 fighter jet','F-16 fighter jets'],[20000,'Triceratops','Triceratops'],[24500,'Hubble Space Telescope','Hubble Space Telescopes'],[25000,'school bus','school buses'],
 [27500,'Easter Island moai','Easter Island moai'],[30000,'Big Ben bell','Big Ben bells'],[33000,'city bus','city buses'],[33500,'Apollo lunar module','Apollo lunar modules'],
 [40000,'fire truck','fire trucks'],[50000,'Stonehenge sarsen stone','Stonehenge sarsen stones'],[66000,'humpback whale','humpback whales'],[80000,'fully loaded semi truck','fully loaded semi trucks'],
 [100000,'Brachiosaurus','Brachiosauruses'],[136000,'M1 Abrams tank','M1 Abrams tanks'],[160000,'Argentinosaurus','Argentinosauruses'],[172000,'Space Shuttle orbiter','Space Shuttle orbiters'],
 [300000,'blue whale','blue whales'],[400000,'empty Boeing 747','empty Boeing 747s'],[420000,'diesel locomotive','diesel locomotives'],[450000,'Statue of Liberty','Statues of Liberty'],
 [925000,'International Space Station','International Space Stations'],[6200000,'fueled Saturn V rocket','fueled Saturn V rockets'],[22000000,'Eiffel Tower','Eiffel Towers'],
 [114000000,'Iowa-class battleship','Iowa-class battleships'],[117000000,'RMS Titanic','RMS Titanics'],[200000000,'Nimitz-class aircraft carrier','Nimitz-class aircraft carriers']
];

// Lifetime ladder: [lb, phrase, singular, plural, isGroup]. Weights are approximate.
const LADDER=[
 [1000,"a grand piano","grand piano","grand pianos"],
 [1200,"a Ford Model T","Ford Model T","Ford Model Ts"],
 [1500,"a dairy cow","dairy cow","dairy cows"],
 [1700,"a Cessna 172","Cessna 172","Cessna 172s"],
 [2000,"a Clydesdale","Clydesdale","Clydesdales"],
 [2260,"the Mars Perseverance rover","Mars Perseverance rover","Mars Perseverance rovers"],
 [2600,"a giraffe","giraffe","giraffes"],
 [3300,"a hippopotamus","hippopotamus","hippopotamuses"],
 [3800,"a Ford Mustang","Ford Mustang","Ford Mustangs"],
 [4700,"a Ford F-150","Ford F-150","Ford F-150s"],
 [5800,"a Chevy Suburban","Chevy Suburban","Chevy Suburbans"],
 [7000,"a Hummer H1","Hummer H1","Hummer H1s"],
 [8000,"an orca","orca","orcas"],
 [10000,"an Asian elephant","Asian elephant","Asian elephants"],
 [12000,"an African elephant","African elephant","African elephants"],
 [14000,"a woolly mammoth","woolly mammoth","woolly mammoths"],
 [18000,"a Tyrannosaurus rex","Tyrannosaurus rex","T. rexes"],
 [22000,"a Triceratops","Triceratops","Triceratops"],
 [25000,"a school bus","school bus","school buses"],
 [30000,"the Big Ben bell","Big Ben bell","Big Ben bells"],
 [33500,"an Apollo lunar module","Apollo lunar module","Apollo lunar modules"],
 [40000,"a fire truck","fire truck","fire trucks"],
 [50000,"a Stonehenge sarsen stone","Stonehenge sarsen stone","Stonehenge sarsen stones"],
 [60000,"an M2 Bradley fighting vehicle","M2 Bradley","M2 Bradleys"],
 [66000,"a humpback whale","humpback whale","humpback whales"],
 [80000,"a fully loaded semi truck","fully loaded semi truck","fully loaded semi trucks"],
 [91300,"an empty Boeing 737","empty Boeing 737","empty Boeing 737s"],
 [100000,"a Brachiosaurus","Brachiosaurus","Brachiosauruses"],
 [136000,"an M1 Abrams tank","M1 Abrams tank","M1 Abrams tanks"],
 [160000,"an Argentinosaurus","Argentinosaurus","Argentinosauruses"],
 [172000,"a Space Shuttle orbiter","Space Shuttle orbiter","Space Shuttle orbiters"],
 [198000,"an empty Boeing 767","empty Boeing 767","empty Boeing 767s"],
 [286000,"a loaded coal railcar","loaded coal railcar","loaded coal railcars"],
 [300000,"a blue whale","blue whale","blue whales"],
 [400000,"an empty Boeing 747","empty Boeing 747","empty Boeing 747s"],
 [450000,"the Statue of Liberty","Statue of Liberty","Statues of Liberty"],
 [544000,"a platoon of four M1 Abrams tanks",'','',1],
 [585000,"a C-17 Globemaster at max takeoff weight","C-17 Globemaster at max takeoff","C-17 Globemasters at max takeoff"],
 [750000,"a large wind turbine, tower and all","large wind turbine","large wind turbines"],
 [875000,"a Boeing 747 at max takeoff weight","Boeing 747 at max takeoff","Boeing 747s at max takeoff"],
 [925000,"the International Space Station","International Space Station","International Space Stations"],
 [1250000,"a Big Boy steam locomotive with tender","Big Boy steam locomotive","Big Boy steam locomotives"],
 [1410000,"the Antonov An-225 at max takeoff weight","Antonov An-225 at max takeoff","Antonov An-225s at max takeoff"],
 [1800000,"a herd of 150 African elephants",'','',1],
 [2600000,"both fueled Space Shuttle rocket boosters",'','',1],
 [3000000,"a pod of 10 blue whales",'','',1],
 [3400000,"one Iowa-class battleship gun turret","Iowa-class gun turret","Iowa-class gun turrets"],
 [4200000,"the General Sherman sequoia","General Sherman sequoia","General Sherman sequoias"],
 [5500000,"the water in an Olympic swimming pool","Olympic pool of water","Olympic pools of water"],
 [6200000,"a fueled Saturn V rocket","fueled Saturn V rocket","fueled Saturn V rockets"],
 [10200000,"all three Iowa-class gun turrets",'','',1],
 [19100000,"the Seattle Space Needle","Space Needle","Space Needles"],
 [22000000,"the Eiffel Tower","Eiffel Tower","Eiffel Towers"],
 [28600000,"a loaded 100-car coal train",'','',1],
 [32000000,"the Leaning Tower of Pisa","Leaning Tower of Pisa","Leaning Towers of Pisa"],
 [40600000,"the battleship HMS Dreadnought","HMS Dreadnought","HMS Dreadnoughts"],
 [70000000,"the USS Arizona","USS Arizona","USS Arizonas"],
 [114000000,"an Iowa-class battleship","Iowa-class battleship","Iowa-class battleships"],
 [117000000,"the RMS Titanic","RMS Titanic","RMS Titanics"],
 [170000000,"a fully loaded 1,000-foot Great Lakes freighter","fully loaded Great Lakes freighter","fully loaded Great Lakes freighters"],
 [200000000,"a Nimitz-class aircraft carrier","Nimitz-class aircraft carrier","Nimitz-class aircraft carriers"],
 [467000000,"all the gold ever mined",'','',1],
 [730000000,"the Empire State Building",'','',1],
 [1100000000,"the Burj Khalifa",'','',1],
 [1470000000,"the Seawise Giant supertanker, fully loaded",'','',1],
 [2050000000,"the Mackinac Bridge",'','',1],
 [13000000000,"the Great Pyramid of Giza",'','',1],
 [32000000000,"every registered vehicle in Michigan",'','',1],
 [134000000000,"the asteroid Apophis",'','',1],
 [160000000000,"the asteroid Bennu",'','',1],
 [460000000000,"a full day of water over Niagara Falls",'','',1],
 [1100000000000,"every person on Earth",'','',1],
 [4200000000000,"a year of the world’s steel production",'','',1],
 [18000000000000,"all the plastic ever made",'','',1],
 [77000000000000,"all the water in a full Lake Mead",'','',1],
 [357000000000000,"Mount Everest",'','',1],
 [485000000000000,"Halley’s Comet",'','',1],
 [1.07e+15,"all the water in Lake Erie",'','',1],
 [3.26e+15,"Mars’s moon Deimos",'','',1],
 [7.8e+15,"all the water in Lake Huron",'','',1],
 [1.08e+16,"all the water in Lake Michigan",'','',1],
 [2.35e+16,"Mars’s moon Phobos",'','',1],
 [5e+16,"all five Great Lakes",'','',1],
 [1.74e+17,"the Caspian Sea",'','',1],
 [1.24e+18,"the Black Sea",'','',1],
 [5.9e+18,"the Greenland ice sheet",'','',1],
 [8.5e+18,"the Mediterranean Sea",'','',1],
 [1.135e+19,"Earth’s entire atmosphere",'','',1],
 [5.4e+19,"the Antarctic ice sheet",'','',1],
 [8.3e+19,"Saturn’s moon Mimas",'','',1],
 [2.38e+20,"Saturn’s moon Enceladus",'','',1],
 [5.7e+20,"the asteroid Vesta",'','',1],
 [2.07e+21,"the dwarf planet Ceres",'','',1],
 [2.98e+21,"all of Earth’s oceans",'','',1],
 [7.5e+21,"Uranus’s moon Titania",'','',1],
 [2.87e+22,"Pluto",'','',1],
 [4.72e+22,"Neptune’s moon Triton",'','',1],
 [1.06e+23,"Jupiter’s moon Europa",'','',1],
 [1.619e+23,"the Moon",'','',1],
 [7.28e+23,"the planet Mercury",'','',1],
 [1.415e+24,"Mars",'','',1],
 [1.317e+25,"the Earth",'','',1]
];
for(const l of LADDER) if(!l[4]&&!THINGS.some(t=>t[1]===l[2])) THINGS.push([l[0],l[2],l[3]]);
function tonsParts(t,u,L){ if(t<1e6) return {n:(t<100?(Math.round(t*10)/10).toLocaleString('en-US'):fmtBig(t)),u,label:L};
  const N=[[1e24,'septillion'],[1e21,'sextillion'],[1e18,'quintillion'],[1e15,'quadrillion'],[1e12,'trillion'],[1e9,'billion'],[1e6,'million']];
  for(const [v,n] of N) if(t>=v){ const x=t/v; return {n:String(x<10?x.toFixed(2):x<100?x.toFixed(1):Math.round(x)),u:n+' '+u,label:n.charAt(0).toUpperCase()+n.slice(1)+' '+u}; } }
function massParts(v){ if(U()==='kg'){ if(v<10000) return {n:fmtBig(v),u:'kg',label:'Kilograms'}; return tonsParts(v/1000,'tonnes','Tonnes'); }
  if(v<20000) return {n:fmtBig(v),u:'lb',label:'Pounds'}; return tonsParts(v/2000,'tons','Tons'); }
function fmtMass(v){ const p=massParts(v); return p.n+' '+p.u; }
let lastThing=null;
function bwPoints(){ const pts=[]; for(const s of S.sessions) if(+s.bw>0) pts.push({date:s.date,w:+s.bw,sid:s.id}); for(const b of (S.bodyweights||[])) if(+b.w>0) pts.push({date:b.date,w:+b.w,id:b.id}); return pts.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0); }
function lastBW(){ const p=bwPoints(); return p.length?p[p.length-1].w:null; }
function entryVolume(e,bw){ const ex=exById(e.exId); let v=0; for(const s of e.sets){ if(!s.done) continue; const r=+s.r||0; let w=+s.w||0; if(ex.load==='dumbbell') w*=2; if(ex.load==='bodyweight'){ const b=+bw||lastBW()||0; w+=ex.pattern==='hpush'?b*0.64:b; } v+=w*r; } return v; }
function sessionVolume(s){ return memoize('vol|'+s.id+'|'+(s===EDIT||s===S.current?Math.random():''),()=>s.entries.reduce((a,e)=>a+entryVolume(e,s.bw),0)); }
function fmtBig(n){ return Math.round(n).toLocaleString('en-US'); }
function compareText(vol){
  if(!(vol>0)) return 'Log some sets to see what that’s equal to.';
  const lbv=toLb(vol); let pool=THINGS.filter(t=>lbv/t[0]>=1&&lbv/t[0]<=400); if(!pool.length) pool=THINGS.filter(t=>lbv/t[0]>=1); if(!pool.length) pool=[THINGS[0]];
  if(pool.length>1) pool=pool.filter(t=>t!==lastThing);
  const t=pool[Math.floor(Math.random()*pool.length)]; lastThing=t; const n=lbv/t[0];
  const ns=n<10?(Math.round(n*10)/10).toString():fmtBig(n);
  return 'That’s like lifting '+ns+' '+(Math.abs(n-1)<0.05?t[1]:t[2])+'.';
}
function funHTML(vol,label){ const id='fx-'+uid(); return '<div class="fun"><div><span class="eyebrow">'+esc(label)+'</span> <b class="mono">'+fmtMass(vol)+'</b></div><div class="row"><span id="'+id+'">'+esc(compareText(vol))+'</span><button class="ghost" data-act="reroll" data-v="'+vol+'" data-t="'+id+'">Another</button></div></div>'; }


function prevMaxW(exId,sid){ let m=0; for(const s of S.sessions){ if(s.id===sid) continue; for(const e of s.entries) if(e.exId===exId) for(const x of e.sets) if(x.done&&+x.r>0) m=Math.max(m,+x.w||0); } return m; }
function checkEntries(entries,sid){
  const out=[];
  for(const e of entries){ const ex=exById(e.exId), t=e.target||{rows:[]}; const R=t.rows||[]; if(!R.length) continue;
    const maxR=t.kind==='D'?t.params.repMax:Math.max(...R.map(r=>r.r)); const pm=prevMaxW(e.exId,sid);
    e.sets.forEach((x,j)=>{ if(!x.done) return; const r=+x.r||0, w=+x.w||0; const am=!!(R[j]&&R[j].amrap);
      if(r>Math.max(am?maxR*3:maxR*2,maxR+10)) out.push(ex.name+' set '+(j+1)+': '+r+' reps (target '+maxR+(am?'+':'')+')');
      if(ex.load!=='bodyweight'){
        if(w<=0) out.push(ex.name+' set '+(j+1)+': no weight entered');
        else if(pm>0&&w>pm*1.3&&w>pm+fromLb(20)) out.push(ex.name+' set '+(j+1)+': '+fmtW(w)+' '+U()+' is far above your previous best of '+fmtW(pm)+' '+U());
        else if(t.w>0&&w>t.w*1.5&&w>t.w+fromLb(25)) out.push(ex.name+' set '+(j+1)+': '+fmtW(w)+' '+U()+' vs a target of '+fmtW(t.w)+' '+U());
      } });
  }
  return [...new Set(out)];
}

export { LADDER, THINGS, bwPoints, checkEntries, compareText, fmtBig, fmtMass, funHTML, lastBW, massParts, sessionVolume };
