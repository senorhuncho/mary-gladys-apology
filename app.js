
const clamp=(v,min=0,max=1)=>Math.min(max,Math.max(min,v));
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const musicBtn=document.getElementById('musicBtn');
const gate=document.getElementById('gate');
const bloom=document.getElementById('bloom');
const pageProgress=document.getElementById('pageProgress');
const autoplayToggle=document.getElementById('autoplayToggle');
const autoplayIcon=document.getElementById('autoplayIcon');
const autoplayLabel=document.getElementById('autoplayLabel');
const accountability=document.getElementById('accountability');
const respect=document.getElementById('respect');
const finale=document.getElementById('finale');

let musicOn=false;
let audioCtx=null;
let master=null;
let musicTimer=null;
let musicStart=0;
let delayNode=null;

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

  const oscillator=audioCtx.createOscillator();
  const envelope=audioCtx.createGain();
  const stereo=audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;

  oscillator.type=type;
  oscillator.frequency.value=freq;
  oscillator.detune.value=detune;

  envelope.gain.setValueAtTime(.0001,start);
  envelope.gain.exponentialRampToValueAtTime(gain,start+.38);
  envelope.gain.exponentialRampToValueAtTime(Math.max(.0001,gain*.5),start+Math.max(.8,dur-1.5));
  envelope.gain.exponentialRampToValueAtTime(.0001,start+dur);

  oscillator.connect(envelope);

  const output=stereo||envelope;
  if(stereo){
    stereo.pan.value=pan;
    envelope.connect(stereo);
  }

  output.connect(master);

  if(delayNode){
    const sendGain=audioCtx.createGain();
    sendGain.gain.value=send;
    output.connect(sendGain);
    sendGain.connect(delayNode);
  }

  oscillator.start(start);
  oscillator.stop(start+dur+.05);
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
    makeVoice(midiToHz(chord[p]+12),when+i,2.15,.017,'sine',0,i%2===0?-.2:.2,.24);
  });

  if(barIndex%2===0){
    makeVoice(midiToHz(chord[3]+12),when+1.15,4.8,.011,'triangle',0,.16,.28);
  }

  if(barIndex%4===0){
    MELODY.forEach(([offset,midi])=>{
      makeVoice(midiToHz(midi),when+offset,2.8,.011,'triangle',0,.08,.3);
    });
  }
}

function scheduler(){
  if(!musicOn||!audioCtx)return;

  const elapsed=audioCtx.currentTime-musicStart;
  const target=Math.floor(elapsed/8)+3;

  if(scheduler.lastBar==null)scheduler.lastBar=0;

  while(scheduler.lastBar<target){
    const bar=scheduler.lastBar++;
    scheduleBar(bar,musicStart+bar*8);
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

      const feedback=audioCtx.createGain();
      feedback.gain.value=.22;

      const wet=audioCtx.createGain();
      wet.gain.value=.22;

      delayNode.connect(feedback);
      feedback.connect(delayNode);
      delayNode.connect(wet);
      wet.connect(warmth);

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

  if(audioCtx&&audioCtx.state==='running'){
    audioCtx.suspend();
  }

  musicBtn.textContent='♪';
  musicBtn.style.background='rgba(255,255,255,.06)';
}

musicBtn.addEventListener('click',()=>musicOn?pauseMusic():playMusic());

function openLetter(withMusic){
  gate.classList.add('open');

  if(withMusic){
    playMusic();
  }

  setTimeout(()=>{
    document.getElementById('hero').scrollIntoView({behavior:reducedMotion?'auto':'smooth'});
  },reducedMotion?80:1250);
}

document.getElementById('openBtn').addEventListener('click',()=>openLetter(true));
document.getElementById('quietBtn').addEventListener('click',()=>openLetter(false));

/* Word by word reveals */
document.querySelectorAll('[data-split]').forEach(el=>{
  const words=el.textContent.trim().replace(/\s+/g,' ').split(' ');
  el.innerHTML=words.map((word,i)=>`<span class="split-word" style="--i:${i}">${word}</span>`).join(' ');
});

const wordline=[...document.querySelectorAll('.wordline span')];

const revealObserver=new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      entry.target.classList.add('visible');

      if(entry.target.id==='hero'){
        wordline.forEach((word,i)=>{
          setTimeout(()=>word.classList.add('on'),reducedMotion?0:i*115);
        });
      }
    }
  });
},{threshold:.22});

document.querySelectorAll('.reveal').forEach(el=>revealObserver.observe(el));

/* Scroll driven story */
const story=document.getElementById('story');
const storyCard=document.getElementById('storyCard');
const scenes=[...document.querySelectorAll('.scene')];
const dotsWrap=document.getElementById('dots');
const storyRailFill=document.getElementById('storyRailFill');
const storyWord=document.getElementById('storyWord');
const keepScrolling=document.getElementById('keepScrolling');
const haloA=document.querySelector('.halo-a');
const haloB=document.querySelector('.halo-b');

let activeScene=0;
let storyWordTimer=null;

/* Guided autoplay */
let autoPlaying=false;
let autoPaused=false;
let autoStep=0;
let autoTimer=null;
let scrollAnimationFrame=null;
let scrollAnimationToken=0;

const AUTO_SCENE_HOLDS=[6800,7200,7000,7400,8200,8600,9000];

function updateAutoplayControl(){
  autoplayToggle.classList.toggle('show',autoPlaying);
  autoplayToggle.classList.toggle('playing',autoPlaying&&!autoPaused);
  autoplayToggle.classList.toggle('paused',autoPlaying&&autoPaused);
  autoplayIcon.textContent=autoPaused?'▶':'Ⅱ';
  autoplayLabel.textContent=autoPaused?'Continue':'Pause';
  autoplayToggle.setAttribute('aria-label',autoPaused?'Continue automatic story':'Pause automatic story');
}

function cancelCinematicScroll(){
  scrollAnimationToken++;
  if(scrollAnimationFrame){
    cancelAnimationFrame(scrollAnimationFrame);
    scrollAnimationFrame=null;
  }
}

function cinematicScrollTo(target,duration=1350){
  cancelCinematicScroll();

  if(reducedMotion){
    window.scrollTo(0,target);
    return Promise.resolve();
  }

  const token=scrollAnimationToken;
  const start=window.scrollY;
  const distance=target-start;
  const startTime=performance.now();

  return new Promise(resolve=>{
    const tick=now=>{
      if(token!==scrollAnimationToken){
        resolve();
        return;
      }

      const t=clamp((now-startTime)/duration);
      const eased=t<.5
        ? 4*t*t*t
        : 1-Math.pow(-2*t+2,3)/2;

      window.scrollTo(0,start+distance*eased);

      if(t<1){
        scrollAnimationFrame=requestAnimationFrame(tick);
      }else{
        scrollAnimationFrame=null;
        resolve();
      }
    };

    scrollAnimationFrame=requestAnimationFrame(tick);
  });
}

function storyTarget(index){
  const travel=Math.max(1,story.offsetHeight-innerHeight);
  const progress=clamp((index+.18)/scenes.length,0,.965);
  return story.offsetTop+progress*travel;
}

function sectionTarget(element){
  const top=element.getBoundingClientRect().top+window.scrollY;
  return Math.max(0,top+(element.offsetHeight-innerHeight)/2);
}

function clearAutoTimer(){
  clearTimeout(autoTimer);
  autoTimer=null;
}

function finishAutoplay(){
  clearAutoTimer();
  cancelCinematicScroll();
  autoPlaying=false;
  autoPaused=false;
  updateAutoplayControl();
}

async function runAutoStep(step){
  if(!autoPlaying||autoPaused)return;

  autoStep=step;
  let target=0;
  let hold=8000;
  let duration=1350;

  if(step<scenes.length){
    target=storyTarget(step);
    hold=AUTO_SCENE_HOLDS[step]||7800;
    duration=1250;
  }else if(step===scenes.length){
    target=sectionTarget(accountability);
    hold=9800;
    duration=1650;
  }else if(step===scenes.length+1){
    target=sectionTarget(respect);
    hold=9200;
    duration=1650;
  }else{
    target=sectionTarget(finale);
    duration=1750;
  }

  await cinematicScrollTo(target,duration);

  if(!autoPlaying||autoPaused)return;

  if(step>=scenes.length+2){
    autoTimer=setTimeout(finishAutoplay,1800);
    return;
  }

  autoTimer=setTimeout(()=>{
    if(autoPlaying&&!autoPaused){
      runAutoStep(step+1);
    }
  },hold);
}

function startAutoplay(){
  if(reducedMotion){
    story.scrollIntoView({behavior:'auto',block:'start'});
    return;
  }

  clearAutoTimer();
  autoPlaying=true;
  autoPaused=false;
  autoStep=0;
  updateAutoplayControl();
  runAutoStep(0);
}

function pauseAutoplay(){
  if(!autoPlaying||autoPaused)return;

  autoPaused=true;
  clearAutoTimer();
  cancelCinematicScroll();
  updateAutoplayControl();
}

function resumeAutoplay(){
  if(!autoPlaying||!autoPaused)return;

  const storyRect=story.getBoundingClientRect();
  const inStory=storyRect.top<innerHeight*.5&&storyRect.bottom>innerHeight*.5;

  if(inStory){
    autoStep=activeScene;
  }else{
    const y=window.scrollY+innerHeight*.5;
    const accountTop=accountability.offsetTop;
    const respectTop=respect.offsetTop;
    const finaleTop=finale.offsetTop;

    if(y>=finaleTop) autoStep=scenes.length+2;
    else if(y>=respectTop) autoStep=scenes.length+1;
    else if(y>=accountTop) autoStep=scenes.length;
  }

  autoPaused=false;
  updateAutoplayControl();
  runAutoStep(autoStep);
}

autoplayToggle.addEventListener('click',()=>{
  if(autoPaused)resumeAutoplay();
  else pauseAutoplay();
});

function setScene(index){
  if(index===activeScene&&scenes[index].classList.contains('active'))return;

  activeScene=index;

  scenes.forEach((scene,i)=>{
    scene.classList.toggle('active',i===index);
    scene.classList.toggle('before',i<index);
    scene.classList.toggle('after',i>index);
  });

  [...dotsWrap.children].forEach((dot,i)=>dot.classList.toggle('active',i===index));

  if(!reducedMotion){
    storyCard.classList.remove('flash');
    void storyCard.offsetWidth;
    storyCard.classList.add('flash');
  }

  clearTimeout(storyWordTimer);
  storyWord.classList.add('change');

  storyWordTimer=setTimeout(()=>{
    storyWord.textContent=scenes[index].dataset.word||'';
    storyWord.classList.remove('change');
  },reducedMotion?0:190);
}

scenes.forEach((_,i)=>{
  const dot=document.createElement('button');
  dot.className='dot'+(i===0?' active':'');
  dot.setAttribute('aria-label','Go to memory '+(i+1));

  dot.addEventListener('click',()=>{
    pauseAutoplay();
    cinematicScrollTo(storyTarget(i),1050);
  });

  dotsWrap.appendChild(dot);
});

document.getElementById('beginStory').addEventListener('click',()=>{
  startAutoplay();
});

/* Final interaction */
function burstHearts(){
  const symbols=['♥','✦','•'];

  for(let i=0;i<30;i++){
    const heart=document.createElement('div');
    heart.textContent=symbols[Math.floor(Math.random()*symbols.length)];

    Object.assign(heart.style,{
      position:'fixed',
      left:'50%',
      top:'53%',
      zIndex:'110',
      pointerEvents:'none',
      color:i%3===0?'#ffd27d':i%2===0?'#ff95bd':'#cabfff',
      fontSize:(12+Math.random()*19)+'px',
      opacity:'1',
      transition:'all 1.6s cubic-bezier(.1,.7,.2,1)',
      transform:'translate(-50%,-50%) scale(.7)'
    });

    document.body.appendChild(heart);

    requestAnimationFrame(()=>{
      const angle=Math.PI*2*i/30+Math.random()*.25;
      const distance=120+Math.random()*240;

      heart.style.transform=`translate(calc(-50% + ${Math.cos(angle)*distance}px),calc(-50% + ${Math.sin(angle)*distance}px)) scale(1.55) rotate(${Math.random()*220-110}deg)`;
      heart.style.opacity='0';
    });

    setTimeout(()=>heart.remove(),1750);
  }
}

document.getElementById('lastBtn').addEventListener('click',event=>{
  bloom.classList.remove('go');
  void bloom.offsetWidth;
  bloom.classList.add('go');

  if(!reducedMotion){
    burstHearts();
  }

  event.currentTarget.textContent='I really mean it, Mary Gladys.';
});

function restartAll(){
  clearAutoTimer();
  cancelCinematicScroll();
  autoPlaying=false;
  autoPaused=false;
  autoStep=0;
  updateAutoplayControl();

  gate.classList.remove('open');
  setScene(0);
  wordline.forEach(word=>word.classList.remove('on'));

  cinematicScrollTo(0,reducedMotion?0:1150);
}

document.getElementById('restart').addEventListener('click',restartAll);
document.getElementById('restartTop').addEventListener('click',restartAll);

/* Continuous scroll choreography */
const orbOne=document.querySelector('.orb-one');
const orbTwo=document.querySelector('.orb-two');
const depthElements=[...document.querySelectorAll('[data-depth]')];

let ticking=false;

function renderScroll(){
  ticking=false;

  const y=window.scrollY;
  const maxPage=Math.max(1,document.documentElement.scrollHeight-innerHeight);
  const pageP=clamp(y/maxPage);

  pageProgress.style.width=(pageP*100)+'%';

  if(!reducedMotion){
    orbOne.style.transform=`translate3d(0,${y*.055}px,0) rotate(${y*.008}deg)`;
    orbTwo.style.transform=`translate3d(0,${-y*.04}px,0) rotate(${-y*.006}deg)`;

    depthElements.forEach(el=>{
      const depth=parseFloat(el.dataset.depth||0);
      const rect=el.getBoundingClientRect();
      const center=rect.top+rect.height/2-innerHeight/2;
      el.style.transform=`translate3d(0,${center*-depth}px,0)`;
    });
  }

  if(!reducedMotion){
    const rect=story.getBoundingClientRect();
    const travel=Math.max(1,story.offsetHeight-innerHeight);
    const storyP=clamp(-rect.top/travel);

    const scaled=storyP*scenes.length;
    const index=Math.min(scenes.length-1,Math.floor(scaled));
    const local=clamp(scaled-index);

    setScene(index);

    storyRailFill.style.height=(storyP*100)+'%';
    keepScrolling.classList.toggle('hide',storyP>.94);

    const tiltX=(.5-local)*2.2;
    const tiltY=Math.sin(storyP*Math.PI*2)*1.15;
    const scale=.988+Math.sin(local*Math.PI)*.012;

    storyCard.style.transform=`rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(${scale})`;
    haloA.style.transform=`translate3d(${storyP*80}px,${Math.sin(storyP*Math.PI)*45}px,0) scale(${.9+storyP*.15})`;
    haloB.style.transform=`translate3d(${-storyP*70}px,${-Math.sin(storyP*Math.PI)*35}px,0) scale(${1.05-storyP*.08})`;

    const wordScale=.9+Math.sin(local*Math.PI)*.12;
    storyWord.style.setProperty('--story-word-scale',wordScale);
  }
}

function requestScrollRender(){
  if(!ticking){
    ticking=true;
    requestAnimationFrame(renderScroll);
  }
}

addEventListener('scroll',requestScrollRender,{passive:true});
addEventListener('resize',requestScrollRender,{passive:true});

/* If she touches the page or scrolls herself, the site gives control back immediately. */
function manualNavigationIntent(event){
  if(!autoPlaying||autoPaused)return;
  if(event.target&&event.target.closest&&event.target.closest('#autoplayToggle'))return;
  pauseAutoplay();
}

addEventListener('wheel',manualNavigationIntent,{passive:true});
addEventListener('touchstart',manualNavigationIntent,{passive:true});
addEventListener('pointerdown',event=>{
  if(event.pointerType==='mouse')return;
  manualNavigationIntent(event);
},{passive:true});
addEventListener('keydown',event=>{
  if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)){
    manualNavigationIntent(event);
  }
});

/* Background particles */
const canvas=document.getElementById('stars');
const ctx=canvas.getContext('2d');

let W=0;
let H=0;
let dpr=1;
let points=[];

function resizeCanvas(){
  dpr=Math.min(devicePixelRatio||1,2);
  W=innerWidth;
  H=innerHeight;

  canvas.width=W*dpr;
  canvas.height=H*dpr;
  canvas.style.width=W+'px';
  canvas.style.height=H+'px';

  ctx.setTransform(dpr,0,0,dpr,0,0);

  const count=Math.min(110,Math.max(44,Math.floor(W/16)));

  points=Array.from({length:count},()=>({
    x:Math.random()*W,
    y:Math.random()*H,
    r:.4+Math.random()*1.55,
    s:.08+Math.random()*.38,
    drift:(Math.random()-.5)*.12,
    a:.10+Math.random()*.5,
    h:[330,270,195,45][Math.floor(Math.random()*4)]
  }));
}

function draw(){
  ctx.clearRect(0,0,W,H);

  points.forEach(point=>{
    point.y-=point.s;
    point.x+=point.drift+Math.sin(point.y*.008)*.05;

    if(point.y<-8){
      point.y=H+8;
      point.x=Math.random()*W;
    }

    if(point.x<-8)point.x=W+8;
    if(point.x>W+8)point.x=-8;

    ctx.beginPath();
    ctx.fillStyle=`hsla(${point.h},90%,72%,${point.a})`;
    ctx.arc(point.x,point.y,point.r,0,Math.PI*2);
    ctx.fill();
  });

  requestAnimationFrame(draw);
}

addEventListener('resize',resizeCanvas,{passive:true});
resizeCanvas();
draw();
updateAutoplayControl();
renderScroll();
