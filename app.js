
const musicBtn=document.getElementById('musicBtn');
const gate=document.getElementById('gate');
const bloom=document.getElementById('bloom');

let musicOn=false;
let audioCtx=null;
let master=null;
let musicTimer=null;
let musicStart=0;

const CHORDS=[
  [48,52,55,59],
  [45,48,52,55],
  [41,45,48,52],
  [43,47,50,52]
];
const midiToHz=m=>440*Math.pow(2,(m-69)/12);

function makeVoice(freq,start,dur,gain,type='sine',detune=0){
  if(!audioCtx||!master)return;
  const o=audioCtx.createOscillator();
  const g=audioCtx.createGain();
  o.type=type;o.frequency.value=freq;o.detune.value=detune;
  g.gain.setValueAtTime(.0001,start);
  g.gain.exponentialRampToValueAtTime(gain,start+.75);
  g.gain.exponentialRampToValueAtTime(Math.max(.0001,gain*.42),start+Math.max(1.25,dur-1.4));
  g.gain.exponentialRampToValueAtTime(.0001,start+dur);
  o.connect(g);g.connect(master);
  o.start(start);o.stop(start+dur+.05);
}
function scheduleBar(barIndex,when){
  if(!audioCtx||!musicOn)return;
  const chord=CHORDS[barIndex%CHORDS.length];
  chord.forEach((m,i)=>{
    makeVoice(midiToHz(m),when,8.4,.018,'sine',i%2?4:-4);
    makeVoice(midiToHz(m+12),when+.12,7.4,.006,'triangle',i%2?-5:5);
  });
  const pattern=[0,2,1,3,2,1,0,2];
  pattern.forEach((p,i)=>makeVoice(midiToHz(chord[p]+12),when+i,2,.013,'sine'));
  if(barIndex%2===0) makeVoice(midiToHz(chord[3]+12),when+1.25,4.6,.0085,'triangle');
}
function scheduler(){
  if(!musicOn||!audioCtx)return;
  const elapsed=audioCtx.currentTime-musicStart;
  const target=Math.floor(elapsed/8)+2;
  if(scheduler.lastBar==null)scheduler.lastBar=0;
  while(scheduler.lastBar<target){
    const b=scheduler.lastBar++;
    scheduleBar(b,musicStart+b*8);
  }
  musicTimer=setTimeout(scheduler,1000);
}
async function playMusic(){
  try{
    if(!audioCtx){
      audioCtx=new (window.AudioContext||window.webkitAudioContext)();
      master=audioCtx.createGain();
      const filter=audioCtx.createBiquadFilter();
      filter.type='lowpass';
      filter.frequency.value=2400;
      filter.Q.value=.35;
      master.gain.value=.48;
      master.connect(filter);
      filter.connect(audioCtx.destination);
      scheduler.lastBar=0;
    }
    if(audioCtx.state==='suspended')await audioCtx.resume();
    musicOn=true;
    musicStart=audioCtx.currentTime+.08;
    scheduler.lastBar=0;
    scheduler();
    musicBtn.textContent='♫';
    musicBtn.style.background='rgba(255,255,255,.14)';
  }catch(e){}
}
function pauseMusic(){
  musicOn=false;
  clearTimeout(musicTimer);
  if(audioCtx&&audioCtx.state==='running')audioCtx.suspend();
  musicBtn.textContent='♪';
  musicBtn.style.background='rgba(255,255,255,.06)';
}
musicBtn.addEventListener('click',()=>musicOn?pauseMusic():playMusic());

function openLetter(withMusic){
  gate.classList.add('open');
  if(withMusic)playMusic();
  setTimeout(()=>document.getElementById('hero').scrollIntoView({behavior:'smooth'}),1250);
}
document.getElementById('openBtn').addEventListener('click',()=>openLetter(true));
document.getElementById('quietBtn').addEventListener('click',()=>openLetter(false));

const words=[...document.querySelectorAll('.wordline span')];
const heroObserver=new IntersectionObserver(entries=>{
  if(entries.some(e=>e.isIntersecting)){
    words.forEach((word,i)=>setTimeout(()=>word.classList.add('on'),i*115));
  }
},{threshold:.45});
heroObserver.observe(document.getElementById('hero'));

const revealObserver=new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting)entry.target.classList.add('visible');
  });
},{threshold:.15});
document.querySelectorAll('.reveal').forEach(el=>revealObserver.observe(el));

const scenes=[...document.querySelectorAll('.scene')];
const dotsWrap=document.getElementById('dots');
const progress=document.getElementById('progress');
const pauseBtn=document.getElementById('pause');
let current=0;
let timer=null;
let paused=false;
let started=false;
const secondsPerScene=7.2;

scenes.forEach((_,i)=>{
  const b=document.createElement('button');
  b.className='dot'+(i===0?' active':'');
  b.setAttribute('aria-label','Go to message '+(i+1));
  b.addEventListener('click',()=>{started=true;go(i,true)});
  dotsWrap.appendChild(b);
});
const dots=[...dotsWrap.children];

function go(i,manual=false){
  clearTimeout(timer);
  current=Math.max(0,Math.min(i,scenes.length-1));
  scenes.forEach((s,j)=>s.classList.toggle('active',j===current));
  dots.forEach((d,j)=>d.classList.toggle('active',j===current));
  progress.style.width=((current+1)/scenes.length*100)+'%';

  if(!paused&&started&&current<scenes.length-1){
    timer=setTimeout(()=>go(current+1),secondsPerScene*1000);
  }else if(!paused&&started&&current===scenes.length-1){
    timer=setTimeout(()=>document.getElementById('finale').scrollIntoView({behavior:'smooth'}),secondsPerScene*1000);
  }
  if(manual)document.getElementById('story').scrollIntoView({behavior:'smooth',block:'center'});
}
document.getElementById('beginStory').addEventListener('click',()=>{
  started=true;paused=false;pauseBtn.textContent='Pause';
  document.getElementById('story').scrollIntoView({behavior:'smooth',block:'center'});
  go(0);
});
pauseBtn.addEventListener('click',()=>{
  paused=!paused;
  pauseBtn.textContent=paused?'Play':'Pause';
  clearTimeout(timer);
  if(!paused){started=true;go(current)}
});

function restartAll(){
  clearTimeout(timer);
  current=0;started=false;paused=false;
  pauseBtn.textContent='Pause';
  gate.classList.remove('open');
  progress.style.width='0%';
  scenes.forEach((s,i)=>s.classList.toggle('active',i===0));
  dots.forEach((d,i)=>d.classList.toggle('active',i===0));
  words.forEach(w=>w.classList.remove('on'));
  window.scrollTo({top:0,behavior:'smooth'});
}
document.getElementById('restart').addEventListener('click',restartAll);
document.getElementById('restartTop').addEventListener('click',restartAll);

function burstHearts(){
  const symbols=['♥','✦','•'];
  for(let i=0;i<26;i++){
    const h=document.createElement('div');
    h.textContent=symbols[Math.floor(Math.random()*symbols.length)];
    Object.assign(h.style,{
      position:'fixed',left:'50%',top:'53%',zIndex:'90',pointerEvents:'none',
      color:i%3===0?'#ffd27d':i%2===0?'#ff95bd':'#cabfff',
      fontSize:(12+Math.random()*18)+'px',opacity:'1',
      transition:'all 1.55s cubic-bezier(.1,.7,.2,1)',
      transform:'translate(-50%,-50%) scale(.7)'
    });
    document.body.appendChild(h);
    requestAnimationFrame(()=>{
      const a=Math.PI*2*i/26+Math.random()*.3;
      const dist=110+Math.random()*220;
      h.style.transform=`translate(calc(-50% + ${Math.cos(a)*dist}px),calc(-50% + ${Math.sin(a)*dist}px)) scale(1.5) rotate(${Math.random()*200-100}deg)`;
      h.style.opacity='0';
    });
    setTimeout(()=>h.remove(),1700);
  }
}
document.getElementById('lastBtn').addEventListener('click',e=>{
  bloom.classList.remove('go');
  void bloom.offsetWidth;
  bloom.classList.add('go');
  burstHearts();
  e.currentTarget.textContent='I mean every word, Mary Gladys.';
});

const canvas=document.getElementById('stars');
const ctx=canvas.getContext('2d');
let W=0,H=0,dpr=1,points=[];
function resize(){
  dpr=Math.min(devicePixelRatio||1,2);
  W=innerWidth;H=innerHeight;
  canvas.width=W*dpr;canvas.height=H*dpr;
  canvas.style.width=W+'px';canvas.style.height=H+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const count=Math.min(100,Math.max(42,Math.floor(W/17)));
  points=Array.from({length:count},()=>({
    x:Math.random()*W,y:Math.random()*H,r:.4+Math.random()*1.5,
    s:.1+Math.random()*.4,a:.12+Math.random()*.5,
    h:[330,270,195,45][Math.floor(Math.random()*4)]
  }));
}
function draw(){
  ctx.clearRect(0,0,W,H);
  points.forEach(p=>{
    p.y-=p.s;
    p.x+=Math.sin(p.y*.01)*.06;
    if(p.y<-8){p.y=H+8;p.x=Math.random()*W}
    ctx.beginPath();
    ctx.fillStyle=`hsla(${p.h},90%,72%,${p.a})`;
    ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
    ctx.fill();
  });
  requestAnimationFrame(draw);
}
addEventListener('resize',resize,{passive:true});
resize();draw();

addEventListener('keydown',e=>{
  if(e.key==='ArrowRight')go(current+1,true);
  if(e.key==='ArrowLeft')go(current-1,true);
  if(e.key===' '){e.preventDefault();pauseBtn.click()}
});
