
const musicBtn=document.getElementById('musicBtn');
const gate=document.getElementById('gate');
const bloom=document.getElementById('bloom');

let musicOn=false;
let audioCtx=null;
let master=null;
let musicTimer=null;
let musicStart=0;
let delayNode=null;
let delayFeedback=null;
let delayWet=null;

const CHORDS=[
  [48,52,55,59],
  [45,48,52,55],
  [41,45,48,52],
  [43,47,50,52]
];

const MELODY=[
  [0,64],[1.5,67],[3.25,71],[5.5,67],
  [8,64],[10,69],[12,67],[14.5,64],
  [16,67],[18,69],[20.5,72],[23,71],
  [24,69],[26.5,67],[29,64],[31,62]
];

const midiToHz=m=>440*Math.pow(2,(m-69)/12);

function makeVoice(freq,start,dur,gain,type='sine',detune=0,pan=0,send=.12){
  if(!audioCtx||!master)return;

  const o=audioCtx.createOscillator();
  const g=audioCtx.createGain();
  const p=audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;

  o.type=type;
  o.frequency.value=freq;
  o.detune.value=detune;

  g.gain.setValueAtTime(.0001,start);
  g.gain.exponentialRampToValueAtTime(gain,start+.38);
  g.gain.exponentialRampToValueAtTime(Math.max(.0001,gain*.5),start+Math.max(.8,dur-1.5));
  g.gain.exponentialRampToValueAtTime(.0001,start+dur);

  o.connect(g);

  if(p){
    p.pan.value=pan;
    g.connect(p);
    p.connect(master);
    if(delayNode){
      const sendGain=audioCtx.createGain();
      sendGain.gain.value=send;
      p.connect(sendGain);
      sendGain.connect(delayNode);
    }
  }else{
    g.connect(master);
    if(delayNode){
      const sendGain=audioCtx.createGain();
      sendGain.gain.value=send;
      g.connect(sendGain);
      sendGain.connect(delayNode);
    }
  }

  o.start(start);
  o.stop(start+dur+.05);
}

function scheduleBar(barIndex,when){
  if(!audioCtx||!musicOn)return;
  const chord=CHORDS[barIndex%CHORDS.length];

  chord.forEach((m,i)=>{
    const pan=[-.38,-.12,.12,.38][i];
    makeVoice(midiToHz(m),when,8.6,.026,'sine',i%2?3:-3,pan,.16);
    makeVoice(midiToHz(m+12),when+.08,7.6,.008,'triangle',i%2?-4:4,-pan,.18);
  });

  const pattern=[0,2,1,3,2,1,0,2];
  pattern.forEach((p,i)=>{
    const pan=i%2===0?-.2:.2;
    makeVoice(midiToHz(chord[p]+12),when+i,2.15,.017,'sine',0,pan,.24);
  });

  if(barIndex%2===0){
    makeVoice(midiToHz(chord[3]+12),when+1.15,4.8,.011,'triangle',0,.16,.28);
  }

  if(barIndex%4===0){
    MELODY.forEach(([offset,midi])=>{
      if(offset<32){
        makeVoice(midiToHz(midi),when+offset,2.8,.011,'triangle',0,.08,.30);
      }
    });
  }
}

function scheduler(){
  if(!musicOn||!audioCtx)return;
  const elapsed=audioCtx.currentTime-musicStart;
  const target=Math.floor(elapsed/8)+3;

  if(scheduler.lastBar==null)scheduler.lastBar=0;

  while(scheduler.lastBar<target){
    const b=scheduler.lastBar++;
    scheduleBar(b,musicStart+b*8);
  }

  musicTimer=setTimeout(scheduler,900);
}

async function playMusic(){
  try{
    if(!audioCtx){
      audioCtx=new (window.AudioContext||window.webkitAudioContext)();

      master=audioCtx.createGain();
      master.gain.value=.66;

      const warmth=audioCtx.createBiquadFilter();
      warmth.type='lowpass';
      warmth.frequency.value=3400;
      warmth.Q.value=.25;

      const compressor=audioCtx.createDynamicsCompressor();
      compressor.threshold.value=-18;
      compressor.knee.value=20;
      compressor.ratio.value=3;
      compressor.attack.value=.015;
      compressor.release.value=.35;

      delayNode=audioCtx.createDelay(1);
      delayNode.delayTime.value=.34;

      delayFeedback=audioCtx.createGain();
      delayFeedback.gain.value=.22;

      delayWet=audioCtx.createGain();
      delayWet.gain.value=.22;

      delayNode.connect(delayFeedback);
      delayFeedback.connect(delayNode);
      delayNode.connect(delayWet);
      delayWet.connect(warmth);

      master.connect(warmth);
      warmth.connect(compressor);
      compressor.connect(audioCtx.destination);

      scheduler.lastBar=0;
    }

    if(audioCtx.state==='suspended')await audioCtx.resume();

    musicOn=true;
    musicStart=audioCtx.currentTime+.06;
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
const secondsPerScene=8.2;

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
    timer=setTimeout(()=>document.querySelector('.memories').scrollIntoView({behavior:'smooth'}),secondsPerScene*1000);
  }

  if(manual){
    document.getElementById('story').scrollIntoView({behavior:'smooth',block:'center'});
  }
}

document.getElementById('beginStory').addEventListener('click',()=>{
  started=true;
  paused=false;
  pauseBtn.textContent='Pause';
  document.getElementById('story').scrollIntoView({behavior:'smooth',block:'center'});
  go(0);
});

pauseBtn.addEventListener('click',()=>{
  paused=!paused;
  pauseBtn.textContent=paused?'Play':'Pause';
  clearTimeout(timer);

  if(!paused){
    started=true;
    go(current);
  }
});

function restartAll(){
  clearTimeout(timer);
  current=0;
  started=false;
  paused=false;
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
      position:'fixed',
      left:'50%',
      top:'53%',
      zIndex:'90',
      pointerEvents:'none',
      color:i%3===0?'#ffd27d':i%2===0?'#ff95bd':'#cabfff',
      fontSize:(12+Math.random()*18)+'px',
      opacity:'1',
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
  e.currentTarget.textContent='I really mean it, Mary Gladys.';
});

const canvas=document.getElementById('stars');
const ctx=canvas.getContext('2d');
let W=0;
let H=0;
let dpr=1;
let points=[];

function resize(){
  dpr=Math.min(devicePixelRatio||1,2);
  W=innerWidth;
  H=innerHeight;

  canvas.width=W*dpr;
  canvas.height=H*dpr;
  canvas.style.width=W+'px';
  canvas.style.height=H+'px';

  ctx.setTransform(dpr,0,0,dpr,0,0);

  const count=Math.min(100,Math.max(42,Math.floor(W/17)));

  points=Array.from({length:count},()=>({
    x:Math.random()*W,
    y:Math.random()*H,
    r:.4+Math.random()*1.5,
    s:.1+Math.random()*.4,
    a:.12+Math.random()*.5,
    h:[330,270,195,45][Math.floor(Math.random()*4)]
  }));
}

function draw(){
  ctx.clearRect(0,0,W,H);

  points.forEach(p=>{
    p.y-=p.s;
    p.x+=Math.sin(p.y*.01)*.06;

    if(p.y<-8){
      p.y=H+8;
      p.x=Math.random()*W;
    }

    ctx.beginPath();
    ctx.fillStyle=`hsla(${p.h},90%,72%,${p.a})`;
    ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
    ctx.fill();
  });

  requestAnimationFrame(draw);
}

addEventListener('resize',resize,{passive:true});
resize();
draw();

addEventListener('keydown',e=>{
  if(e.key==='ArrowRight')go(current+1,true);
  if(e.key==='ArrowLeft')go(current-1,true);
  if(e.key===' '){
    e.preventDefault();
    pauseBtn.click();
  }
});
