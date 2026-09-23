
const $=id=>document.getElementById(id);
const cv=$('c'),ctx=cv.getContext('2d'),stageEl=$('stageEl');

const ASSETS={ player:'assets/characters/player_idle.png', partner:'assets/characters/partner_idle.png' };
const imgCache={};
function getImg(u){if(!u)return null;if(imgCache[u])return imgCache[u];const im=new Image();im.src=u;imgCache[u]=im;return im;}

let W,H,DPR;
function positionProgress(){
  // 진행도 바는 CSS로 게임 화면 최하단에 고정한다.
}

function resize(){
  DPR=Math.min(devicePixelRatio||1,2);
  const aspect=9/20;let w=innerWidth,h=innerHeight;
  if(w/h>aspect)w=h*aspect; else h=w/aspect;
  stageEl.style.width=w+'px';stageEl.style.height=h+'px';
  W=w;H=h;cv.style.width=w+'px';cv.style.height=h+'px';cv.width=w*DPR;cv.height=h*DPR;ctx.setTransform(DPR,0,0,DPR,0,0);positionProgress();
}
addEventListener('resize',resize);
addEventListener('orientationchange',()=>setTimeout(resize,100));

const scenes=['title','game','result'];
let current='title';
function show(name){
  scenes.forEach(s=>$(s).classList.toggle('on',s===name));
  current=name;
  const ph=$('progressHUD');
  if(ph) ph.style.display=(name==='game')?'block':'none';
}

let best=+(localStorage.getItem('kjump_best_m')||0);

const PPM=()=>H*0.085;
  const PHYS={gravity:()=>H*1.72,launch:()=>-H*1.42,airMax:()=>H*.95,cameraDead:()=>H*.24,cameraFollow:4.2,landingTolerance:()=>H*.13};
let G={};
const REGIONS=[
  {max:100,name:'하늘마을',sub:'따뜻한 봄 하늘'},
  {max:250,name:'구름마을',sub:'구름 위로 더 높이'},
  {max:400,name:'노을하늘',sub:'붉게 물드는 하늘'},
  {max:600,name:'달빛하늘',sub:'달빛이 비추는 밤'},
  {max:1000,name:'별의 하늘',sub:'별빛을 따라 점프'},
  {max:Infinity,name:'천상계',sub:'하늘 끝까지 도전'}
];
function getRegion(m){return REGIONS.find(r=>m<r.max)||REGIONS[REGIONS.length-1];}
function updateRegion(){
  // 구간/진행도는 현재 높이가 아니라 이번 플레이에서 달성한 최고 높이를 기준으로 한다.
  const r=getRegion(G.peakM);
  $('regionName').textContent=r.name; $('regionSub').textContent=`최고 높이 · ${G.peakM}m`;
  const points=[0,100,250,500,1000];
  const max=1000; const pct=Math.min(100,(G.peakM/max)*100);
  $('progressFill').style.width=pct+'%';
  document.querySelectorAll('.mile').forEach((el,i)=>el.classList.toggle('active',G.curM>=points[i]));
}
const TARGET_HEIGHT=100; // 현재 1스테이지 목표 높이
let board,player,items,rocks,floats,petals;

function startGame(){
  show('game');
  if(!W||!H)resize();
  G={cam:0,curM:0,peakM:0,lastJumpM:0,star:0,gem:0,hearts:3,over:false,targetReached:false}; paused=false; $('pauseOverlay').classList.remove('on');
  board={cx:W*0.5,y:H*0.72,w:W*0.78,tilt:0,gaugePhase:0};
  player={x:0,y:0,vy:0,r:W*0.12,onBoard:true};
  player.x=board.cx-board.w*0.42*0.8;
  player.y=board.y-player.r*0.5;
  items=[];rocks=[];floats=[];particles=[];jumpTrail=[];launchFlash=0;shake=0;
  petals=Array.from({length:14},()=>({x:Math.random()*W,y:Math.random()*H,s:2+Math.random()*3,vy:.4+Math.random(),vx:(Math.random()-.5)*.6}));
  spawnAhead(-H*0.4);
  updateHud();
}

function spawnAhead(fromY){
  let y=fromY;
  for(let seg=0;seg<14;seg++){
    y-=H*0.22+Math.random()*H*0.14;
    const n=4+Math.floor(Math.random()*3);
    const shape=Math.floor(Math.random()*3);
    const baseX=W*(0.2+Math.random()*0.6), spanX=W*0.45*(Math.random()<.5?1:-1);
    for(let i=0;i<n;i++){
      const t=i/(n-1);let ox,oy;
      if(shape===0){ox=baseX+spanX*(t-0.5);oy=-Math.sin(t*Math.PI)*H*0.06;}
      else if(shape===1){ox=baseX+spanX*t;oy=-t*H*0.06;}
      else{ox=baseX+spanX*(t-0.5);oy=Math.sin(t*Math.PI*2)*H*0.03;}
      const type='star';
      items.push({wx:Math.max(30,Math.min(W-30,ox)),wy:y+oy,type,got:false});
    }
  }
}

function tapGame(){
  if(current!=='game'||G.over||!player.onBoard)return;
  const q=Math.max(0,Math.min(1,board.gaugeVal||0));
  let power,label,col;
  if(q>0.8){power=1.0;label='PERFECT!';col='#ff4d6d';}
  else if(q>0.5){power=0.7;label='GOOD';col='#ffb703';}
  else{power=0.45;label='OK';col='#8ecae6';}
  player.onBoard=false;
  player.vy=-(H*0.040)*(0.7+power*0.6);
  launchFlash=1;
  jumpTrail=[];
  G.lastJudge={label,col};
}
let tsx=null;
let paused=false;
let inputLock=false;

function down(e){
  if(current!=='game'||G.over||paused)return;
  if(e.cancelable)e.preventDefault();
  const t=e.touches&&e.touches.length?e.touches[0]:e;
  tsx=t.clientX;
  tapGame();
}
function mv(e){
  if(current!=='game'||G.over||paused||player.onBoard||tsx==null)return;
  if(e.cancelable)e.preventDefault();
  const t=e.touches&&e.touches.length?e.touches[0]:e;
  const dx=t.clientX-tsx;tsx=t.clientX;
  player.x=Math.max(player.r,Math.min(W-player.r,player.x+dx*0.95));
}
function up(){tsx=null;inputLock=false;}

// 입력은 game 요소가 아니라 stage 전체에서 받는다.
// 캔버스/HTML HUD가 위에 있어도 게임 영역 어디를 눌러도 점프하도록 한다.
const gameScene=$('game');
function handlePointerDown(e){
  if(e.pointerType==='mouse' && e.button!==0)return;
  if(current!=='game'||G.over||paused)return;
  if(inputLock)return;
  inputLock=true;
  down(e);
}
if(window.PointerEvent){
  stageEl.addEventListener('pointerdown',handlePointerDown,{passive:false});
  stageEl.addEventListener('pointermove',mv,{passive:false});
  stageEl.addEventListener('pointerup',up,{passive:false});
  stageEl.addEventListener('pointercancel',up,{passive:false});
}
// iOS/구형 WebView 등에서 pointer 이벤트가 막히는 경우를 위한 touch fallback
gameScene.addEventListener('touchstart',e=>{
  if(window.PointerEvent && e.pointerType!==undefined)return;
  handlePointerDown(e);
},{passive:false});
gameScene.addEventListener('touchmove',mv,{passive:false});
gameScene.addEventListener('touchend',up,{passive:false});
// PC에서 pointer 이벤트가 없는 환경
gameScene.addEventListener('mousedown',e=>{if(!window.PointerEvent)handlePointerDown(e);});
gameScene.addEventListener('mousemove',e=>{if(!window.PointerEvent&&e.buttons)mv(e);});
addEventListener('mouseup',up);
// 최후의 fallback: 실제 click이 발생해도 점프 처리
gameScene.addEventListener('click',e=>{
  if(current==='game'&&!G.over&&!paused&&player.onBoard){
    tapGame();
  }
});

addEventListener('deviceorientation',e=>{if(current==='game'&&!G.over&&!paused&&!player.onBoard&&e.gamma!=null)player.x=Math.max(player.r,Math.min(W-player.r,player.x+e.gamma*0.14));});

function addFloat(x,y,t,c){floats.push({x,y,txt:t,col:c,life:1});}
function ensureLifeHud(){
  let el=$('hearts');
  if(!el){
    el=document.createElement('div'); el.id='hearts';
    const game=$('game')||stageEl; game.appendChild(el);
  }
  // HUD가 다른 레이어에 가려지지 않도록 게임 화면에 직접 고정한다.
  el.style.position='absolute';
  el.style.top='104px';
  el.style.left='16px';
  el.style.zIndex='50';
  el.style.display='block';
  el.style.visibility='visible';
  el.style.opacity='1';
  el.style.pointerEvents='none';
  el.style.fontSize='25px';
  el.style.padding='7px 11px';
  el.style.borderRadius='18px';
  el.style.background='rgba(24,44,72,.88)';
  el.style.border='2px solid rgba(255,255,255,.45)';
  el.style.boxShadow='0 3px 8px rgba(0,0,0,.28)';
  el.style.lineHeight='1';
  el.style.letterSpacing='1px';
  el.style.filter='drop-shadow(0 2px 2px rgba(0,0,0,.35))';
  return el;
}
function updateHud(){
  $('gStar').textContent=G.star;$('gGem').textContent=G.gem;
  const heartEl=ensureLifeHud();
  heartEl.textContent='❤️'.repeat(G.hearts)+'🤍'.repeat(3-G.hearts);
  $('depth').textContent=G.curM+' m'; updateRegion();
}

let squash=0;
let particles=[];   // 먼지·반짝임 파티클
let jumpTrail=[];   // 점프 궤적
let launchFlash=0;
let landingSquash=0;
let landingKick=0;
let shake=0;         // 화면 흔들림 강도
let missFlash=0;
let judgeFx={text:'',color:'#fff',life:0,max:0.78,x:W*.5,y:H*.35};
let missText='';
function spawnDust(x,y,n,power){
  for(let i=0;i<n;i++){
    const a=Math.PI+Math.random()*Math.PI;   // 위쪽 반원으로 퍼짐
    const sp=(0.5+Math.random()*1.5)*power;
    particles.push({x,y,vx:Math.cos(a)*sp*3,vy:Math.sin(a)*sp*3,life:1,type:'dust',size:3+Math.random()*4});
  }
}
function spawnSparkle(x,y,color){
  for(let i=0;i<6;i++){
    const a=Math.random()*Math.PI*2;
    particles.push({x,y,vx:Math.cos(a)*2,vy:Math.sin(a)*2-1,life:1,type:'sparkle',color,size:2+Math.random()*2});
  }
}
function updateParticles(){
  particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.15;p.life-=p.type==='dust'?0.035:0.045;});
  particles=particles.filter(p=>p.life>0);
  if(shake>0)shake*=0.85; if(shake<0.05)shake=0;
  if(launchFlash>0)launchFlash*=0.82; if(launchFlash<0.02)launchFlash=0;
  if(landingSquash>0)landingSquash*=0.78; if(landingSquash<0.02)landingSquash=0;
  if(landingKick>0)landingKick*=0.72; if(landingKick<0.02)landingKick=0;
  if(missFlash>0)missFlash-=0.035; if(missFlash<0)missFlash=0;
  if(judgeFx.life>0)judgeFx.life-=dt;
}
function drawParticles(){
  particles.forEach(p=>{
    ctx.globalAlpha=Math.max(0,p.life);
    if(p.type==='dust'){ctx.fillStyle='#d8c9a8';ctx.beginPath();ctx.arc(p.x,p.y,p.size*p.life,0,7);ctx.fill();}
    else{ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,7);ctx.fill();}
  });
  ctx.globalAlpha=1;
}
function updateGame(){
  if(current!=='game'||G.over||paused)return;
  const halfW=board.w/2;
  if(player.onBoard){
    if(landingSquash>0.01){
      squash=Math.max(squash,landingSquash*0.34);
      board.tilt += Math.sin(landingSquash*Math.PI)*0.012;
    }else{
      squash+=(0-squash)*0.2;
    }
    board.gaugePhase+=0.045;
    board.gaugeVal=(Math.sin(board.gaugePhase-Math.PI/2)+1)/2;
    board.tilt=board.gaugeVal*0.4;
    player.x=board.cx-Math.cos(board.tilt)*halfW*0.8;
    player.y=board.y-Math.sin(board.tilt)*halfW*0.8-player.r*0.5;
    squash+=(0-squash)*0.2;
  }else{
    jumpTrail.push({x:player.x,y:player.y,life:1});
    if(jumpTrail.length>18)jumpTrail.shift();
    jumpTrail.forEach(p=>p.life-=0.055);
    jumpTrail=jumpTrail.filter(p=>p.life>0);
    board.tilt+=(-0.15-board.tilt)*0.06;
    player.vy+=H*0.00072;player.y+=player.vy;
    squash=Math.max(-0.35,Math.min(0.35,-player.vy*4/H));
    // V24: V15 카메라 방식 복원. G.cam은 음수로 이동할 수 있어야 한다.
    // 플레이어가 상승하면 카메라도 따라가고, 플레이어는 화면 약 40%에 머문다.
    const cameraTarget=player.y-H*0.40;
    G.cam += (cameraTarget-G.cam)*0.16;
    if(Math.abs(cameraTarget-G.cam)<0.35) G.cam=cameraTarget;
    // 높이는 카메라 이동량이 아니라 '널판지에서 플레이어가 얼마나 올라갔는지'로 계산한다.
    // 상승할 때는 증가하고, 하강하면 다시 감소한다. 최고 높이는 별도로 유지한다.
    const heightNow=Math.max(0,(board.y-player.y)/PPM());
    const m=Math.max(0,Math.floor(heightNow));
    const changed=(m!==G.curM);
    G.curM=m;
    if(m>G.peakM)G.peakM=m;
    if(m>G.lastJumpM)G.lastJumpM=m;
    if(changed)updateHud();
    if(G.peakM>=TARGET_HEIGHT)G.targetReached=true;

    // 널판지는 처음부터 끝까지 같은 월드 좌표에 고정.
    const bw=board.y;
    const landX=Math.max(board.cx-board.w*0.42,Math.min(board.cx+board.w*0.42,player.x));
    // 플레이어는 널판지의 왼쪽 절반에만 착지할 수 있다.
    // 중앙선을 넘어 상대방 사이드에 착지하면 실패로 처리한다.
    const playerSideLeft=board.cx-board.w*0.42;
    const playerSideRight=board.cx;
    const validLanding=player.x>=playerSideLeft-player.r*0.35 && player.x<=playerSideRight+player.r*0.15;
    const landHalf=board.w*0.48;
    board.landX=landX;board.landR=player.r*0.9;
    if(player.vy>0&&player.y+player.r>=bw-10&&player.y+player.r<=bw+player.r*1.8&&validLanding){
      player.onBoard=true;player.vy=0;player.x=Math.max(board.cx-board.w*0.42,Math.min(board.cx+board.w*0.42,player.x));player.y=board.y-player.r*0.5;board.gaugePhase=0;
      // 한 번의 점프가 끝나면 현재 높이는 0으로 돌아간다. 최고 높이는 유지한다.
      G.curM=0;
      updateHud();
      jumpTrail=[];
      landingSquash=1;
      landingKick=1;
      // V34: 착지 자체의 위치를 판정한다. 플레이어 사이드 안에서는
      // 이상적인 착지점에 가까울수록 PERFECT / GOOD / OK로 보여준다.
      const idealX=board.cx-board.w*0.30;
      const dist=Math.abs(player.x-idealX);
      const perfectRange=board.w*0.085;
      const goodRange=board.w*0.18;
      let landingJudge;
      if(dist<=perfectRange) landingJudge={label:'PERFECT!',col:'#ff4d6d',power:1.6};
      else if(dist<=goodRange) landingJudge={label:'GOOD',col:'#ffb703',power:1.1};
      else landingJudge={label:'OK',col:'#8ecae6',power:0.7};
      spawnDust(player.x,board.y,Math.round(7*landingJudge.power),landingJudge.power);
      shake=Math.min(1,shake+0.55*landingJudge.power);
      board.tilt += landingJudge.label==='PERFECT!' ? 0.16 : landingJudge.label==='GOOD' ? 0.10 : 0.05;
      bigJudge(landingJudge.label,landingJudge.col);
      G.lastJudge=null;
      // 목표 높이를 넘었더라도 착지까지 기다린 뒤 클리어한다.
      if(G.targetReached)clearGame();
    }
    // 플레이어 사이드가 아닌 곳에 착지하려 했거나 널판지를 완전히 지나치면 실패.
    // 중앙선을 넘은 상대방 사이드 착지는 성공 처리하지 않는다.
    if(player.vy>0&&player.y+player.r>bw+player.r*2.4)loseLife();
  }
  // STAR COLLECTION: items stay in world space; collision uses world coordinates.
  for(const s of items){
    if(s.got)continue;
    const screenY=s.wy-G.cam;
    if(screenY<-80||screenY>H+80)continue;
    if(!player.onBoard&&Math.hypot(s.wx-player.x,s.wy-player.y)<player.r+W*0.045){
      s.got=true;
      G.star++;
      addFloat(s.wx,s.wy,'+1','#ffd166');
      spawnSparkle(s.wx,s.wy,'#ffd166');
      updateHud();
    }
  }
  // 장애물은 이번 단계에서 비활성화. 수집 시스템만 먼저 확정한다.
  const topY=items.length?items.reduce((mn,s)=>Math.min(mn,s.wy),Infinity):-H*0.4;
  if(topY-G.cam>H*1.5)spawnAhead(topY);
  floats.forEach(f=>{f.y-=1.2;f.life-=0.02;});floats=floats.filter(f=>f.life>0);
  petals.forEach(p=>{p.y+=p.vy;p.x+=p.vx;if(p.y>H){p.y=-10;p.x=Math.random()*W;}});
  updateParticles();
}
function bigJudge(t,c){
  // V36: 판정은 DOM HUD가 아니라 게임 캔버스의 SCREEN SPACE에 직접 그린다.
  // 카메라/scene/z-index에 가려지지 않도록 한다.
  judgeFx.text=t;
  judgeFx.color=c;
  judgeFx.life=judgeFx.max;
  judgeFx.x=player?player.x:W*.5;
  judgeFx.y=player?player.y-G.cam-player.r*1.9:H*.38;
}
function drawJudgeFx(){
  if(judgeFx.life<=0||!judgeFx.text)return;
  const t=judgeFx.life/judgeFx.max;
  const fade=t<0.22?t/0.22:1;
  const rise=(1-t)*H*.07;
  const x=Math.max(W*.15,Math.min(W*.85,judgeFx.x));
  const y=Math.max(H*.12,Math.min(H*.72,judgeFx.y-rise));
  ctx.save();
  ctx.globalAlpha=fade;
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.font='1000 '+Math.round(W*.115)+'px Arial, sans-serif';
  ctx.lineWidth=Math.max(3,W*.014);
  ctx.strokeStyle='rgba(0,0,0,.32)';
  ctx.strokeText(judgeFx.text,x,y);
  ctx.fillStyle=judgeFx.color;
  ctx.fillText(judgeFx.text,x,y);
  ctx.restore();
}
function clearGame(){
  if(G.over)return;
  G.over=true;
  if(G.curM>best){best=G.curM;localStorage.setItem('kjump_best_m',best);}
  $('resTitle').textContent='CLEAR!';
  $('resM').textContent=G.peakM;
  $('resStar').textContent=G.star;
  $('resGem').textContent=G.gem;
  show('result');
}
function loseLife(){
  if(G.over)return;
  G.hearts=Math.max(0,G.hearts-1);
  updateHud();
  missFlash=1;
  missText='MISS!';
  // 실패 순간에는 현재 점프를 완전히 종료하고, 땅에 고정된 원래 널판지로 돌아온다.
  player.onBoard=true;
  player.vy=0;
  player.x=board.cx-board.w*0.42*0.8;
  player.y=board.y-player.r*0.5;
  G.cam=0;
  G.curM=0;
  G.lastJumpM=0;
  board.gaugePhase=0;
  board.gaugeVal=0.5;
  board.tilt=0;
  jumpTrail=[];
  landingSquash=0;
  landingKick=0;
  shake=Math.min(1,shake+0.8);
  updateHud();
  // 목숨이 남아 있으면 바로 다시 도전할 수 있다. 0개일 때만 최종 결과.
  if(G.hearts<=0){
    gameOver();
  }
}
function gameOver(){
  if(G.over)return;G.over=true;
  if(G.peakM>best){best=G.peakM;localStorage.setItem('kjump_best_m',best);}
  $('resTitle').textContent='GAME OVER';
  $('resM').textContent=G.peakM;$('resStar').textContent=G.star;$('resGem').textContent=G.gem;
  show('result');
}

function skyColor(m){
  const stops=[
    [0,   [74,163,239],[143,208,255],[223,247,255]],
    [150, [255,153,102],[255,204,153],[255,236,214]],
    [350, [30,20,70],[70,40,120],[130,90,180]],
    [600, [5,5,20],[10,10,40],[20,20,60]],
  ];
  let lo=stops[0],hi=stops[stops.length-1];
  for(let i=0;i<stops.length-1;i++){if(m>=stops[i][0]&&m<=stops[i+1][0]){lo=stops[i];hi=stops[i+1];break;}}
  if(m>=stops[stops.length-1][0])lo=hi=stops[stops.length-1];
  const t=hi[0]===lo[0]?0:Math.max(0,Math.min(1,(m-lo[0])/(hi[0]-lo[0])));
  const mix=(a,b)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t));
  return [mix(lo[1],hi[1]),mix(lo[2],hi[2]),mix(lo[3],hi[3])];
}
function drawBG(){
  const [c1,c2,c3]=skyColor(G.curM||0);
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,`rgb(${c1})`);g.addColorStop(.5,`rgb(${c2})`);g.addColorStop(1,`rgb(${c3})`);
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  if(G.curM>300){
    ctx.fillStyle=`rgba(255,255,255,${Math.min(1,(G.curM-300)/200)})`;
    for(let i=0;i<30;i++){const sx=(i*137)%W,sy=(i*197)%H;ctx.beginPath();ctx.arc(sx,sy,1.5,0,7);ctx.fill();}
  }
  // distant floating islands / Korean silhouettes
  const night=G.curM>380;
  ctx.save(); ctx.globalAlpha=.28;
  for(let i=0;i<7;i++){
    const ix=(i*171+Math.sin(i*2.3)*60)%W;
    const iy=((i*119)%(H*1.8)+H*1.8)%(H*1.8)-H*.2;
    ctx.fillStyle=night?'#27365f':'#477d8a';
    ctx.beginPath();ctx.ellipse(ix,iy,W*.09,H*.018,0,0,7);ctx.fill();
    ctx.beginPath();ctx.moveTo(ix-W*.065,iy);ctx.lineTo(ix+W*.065,iy);ctx.lineTo(ix+W*.025,iy+H*.065);ctx.lineTo(ix-W*.03,iy+H*.08);ctx.closePath();ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle='rgba(255,255,255,.9)';
  for(let i=0;i<6;i++){const cy=((i*H*0.6)%(H*2.2)+H*2.2)%(H*2.2)-H*0.5;cloud((i*151)%W,cy,W*0.15);}
}
function cloud(x,y,r){ctx.beginPath();ctx.arc(x,y,r*.6,0,7);ctx.arc(x+r*.5,y+4,r*.5,0,7);ctx.arc(x-r*.5,y+4,r*.45,0,7);ctx.arc(x,y+r*.3,r*.6,0,7);ctx.fill();}

function drawStar(x,y,r,c){ctx.save();ctx.translate(x,y);ctx.fillStyle=c;ctx.shadowColor=c;ctx.shadowBlur=8;ctx.beginPath();for(let i=0;i<5;i++){ctx.lineTo(Math.cos((18+i*72)/180*Math.PI)*r,-Math.sin((18+i*72)/180*Math.PI)*r);ctx.lineTo(Math.cos((54+i*72)/180*Math.PI)*r*.45,-Math.sin((54+i*72)/180*Math.PI)*r*.45);}ctx.closePath();ctx.fill();ctx.restore();}
function drawGem(x,y,r){ctx.save();ctx.translate(x,y);ctx.fillStyle='#39b7ff';ctx.strokeStyle='#bfeaff';ctx.lineWidth=2;ctx.shadowColor='#39b7ff';ctx.shadowBlur=8;ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(r*.8,-r*.2);ctx.lineTo(r*.5,r);ctx.lineTo(-r*.5,r);ctx.lineTo(-r*.8,-r*.2);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
function drawRock(x,y,r){ctx.save();ctx.translate(x,y);ctx.fillStyle='#3a2a22';ctx.beginPath();ctx.arc(0,0,r,0,7);ctx.fill();ctx.fillStyle='#ff7a1a';for(let i=0;i<4;i++){ctx.beginPath();ctx.arc((i*0.6-0.9)*r*0.5,(i%2?0.4:-0.4)*r,r*.18,0,7);ctx.fill();}ctx.restore();}


function drawJumpTrail(){
  if(jumpTrail.length<2)return;
  ctx.save();
  ctx.lineCap='round';
  for(let i=1;i<jumpTrail.length;i++){
    const a=jumpTrail[i-1],b=jumpTrail[i];
    const t=i/jumpTrail.length;
    ctx.globalAlpha=t*0.34;
    ctx.strokeStyle='#ffffff';
    ctx.lineWidth=Math.max(2,W*0.018*t);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }
  ctx.globalAlpha=1;
  ctx.restore();
}

function drawPlayer(px,py,r){
  const landingPose=landingSquash*0.22;
  const sq=1-squash+landingPose,st=1+squash-landingPose*0.45;
  const im=getImg(ASSETS.player);
  ctx.save();ctx.translate(px,py);ctx.scale(st,sq);
  if(im&&im.complete&&im.naturalWidth){const d=r*2.35;ctx.drawImage(im,-d/2,-d*0.82,d,d);}
  else{
    ctx.fillStyle='#fdfdfd';ctx.beginPath();ctx.arc(0,r*0.4,r*0.95,0,7);ctx.fill();
    ctx.fillStyle='#2f6fd0';ctx.beginPath();ctx.arc(0,r*0.1,r*0.85,Math.PI*0.15,Math.PI*0.85);ctx.fill();
  }
  ctx.restore();
}
function drawPartner(px,py,r){
  const im=getImg(ASSETS.partner);
  if(im&&im.complete&&im.naturalWidth){const d=r*2.4;ctx.drawImage(im,px-d/2,py-d*0.72,d,d);return;}
  ctx.save();ctx.translate(px,py);
  ctx.fillStyle='#2a4a86';ctx.beginPath();ctx.arc(0,r*0.4,r*0.9,0,7);ctx.fill();
  ctx.fillStyle='#ffe0bd';ctx.beginPath();ctx.arc(0,-r*0.5,r*0.65,0,7);ctx.fill();
  ctx.restore();
}

function drawGame(){
  ctx.save();
  if(shake>0.02){
    const sx=(Math.random()-0.5)*shake*W*0.03, sy=(Math.random()-0.5)*shake*W*0.03;
    ctx.translate(sx,sy);
  }

  // 화면에 붙어 있는 배경/UI와, 카메라가 따라가는 월드 오브젝트를 분리한다.
  drawBG();
  ctx.fillStyle='rgba(255,183,197,.85)';
  petals.forEach(p=>{ctx.beginPath();ctx.ellipse(p.x,p.y,p.s,p.s*0.6,0,0,7);ctx.fill();});

  // ================= WORLD SPACE =================
  // 플레이어를 따라 카메라가 이동하면 '땅에 놓인' 모든 월드 요소가
  // 같은 양만큼 화면에서 이동해야 한다. 널판지는 월드 좌표에 고정한다.
  ctx.save();
  ctx.translate(0,-G.cam);

  // 수집 아이템
  for(const s of items){
    if(s.got)continue;
    const sy=s.wy;
    if(sy-G.cam<-40||sy-G.cam>H+40)continue;
    drawStar(s.wx,sy,W*0.045,'#ffd23f');
  }

  // 장애물
  for(const r of rocks){
    if(r.hit)continue;
    const ry=r.wy;
    if(ry-G.cam<-80||ry-G.cam>H+80)continue;
    drawRock(r.wx,ry,r.r);
  }

  const pivotX=board.cx,pivotY=board.y,halfW=board.w/2,tilt=board.tilt||0;

  // 널판지: 월드 좌표에서 완전히 고정. 카메라 이동에 따라 화면에서만 이동한다.
  ctx.save();
  ctx.fillStyle='#7a7f87';
  ctx.beginPath();
  ctx.moveTo(pivotX-W*0.05,pivotY+H*0.02);
  ctx.lineTo(pivotX+W*0.05,pivotY+H*0.02);
  ctx.lineTo(pivotX,pivotY-H*0.01);
  ctx.closePath();ctx.fill();
  ctx.translate(pivotX,pivotY);ctx.rotate(tilt);
  ctx.fillStyle='#a9743a';ctx.fillRect(-halfW,-H*0.012,board.w,H*0.024);
  ctx.strokeStyle='#6e4620';ctx.lineWidth=1.5;ctx.strokeRect(-halfW,-H*0.012,board.w,H*0.024);
  if(!player.onBoard&&board.landR){
    const zoneX=halfW*0.8*0.8,pulse=0.5+0.5*Math.sin(Date.now()/180);
    ctx.save();ctx.globalAlpha=0.35+0.35*pulse;ctx.fillStyle='#7CFC5A';
    ctx.beginPath();ctx.ellipse(zoneX,-H*0.02,board.landR*1.15,board.landR*0.4,0,0,7);ctx.fill();
    ctx.strokeStyle='#3ea832';ctx.lineWidth=3;ctx.setLineDash([6,4]);
    ctx.beginPath();ctx.ellipse(zoneX,-H*0.02,board.landR*1.15,board.landR*0.4,0,0,7);ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  if(landingKick>0.03){
    ctx.save();
    ctx.globalAlpha=landingKick*0.45;
    ctx.strokeStyle='#fff3b0';ctx.lineWidth=2;
    ctx.beginPath();
    ctx.ellipse(pivotX+halfW*0.8,pivotY+2,player.r*(0.8+landingKick*1.4),player.r*(0.22+landingKick*0.18),0,0,7);
    ctx.stroke();ctx.restore();
  }

  // 상대 캐릭터도 널판지와 같은 월드에 붙어 있다.
  const partX=pivotX+Math.cos(tilt)*halfW*0.8;
  const partY=pivotY+Math.sin(tilt)*halfW*0.8;
  drawPartner(partX,partY-W*0.11,W*0.11);

  if(!player.onBoard)drawJumpTrail();
  if(!player.onBoard&&launchFlash>0.05){
    ctx.save();ctx.globalAlpha=launchFlash*0.22;ctx.fillStyle='#fff';
    ctx.beginPath();ctx.arc(player.x,player.y,player.r*(1.2+launchFlash),0,7);ctx.fill();ctx.restore();
  }
  drawPlayer(player.x,player.y,player.r);

  // 월드 파티클도 월드와 함께 움직인다.
  drawParticles();
  if(missFlash>0){
    ctx.save();
    ctx.globalAlpha=Math.min(1,missFlash*1.5);
    ctx.fillStyle='#ff4d6d';
    ctx.font='900 '+Math.round(W*0.11)+'px system-ui';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.shadowColor='rgba(0,0,0,.25)';ctx.shadowBlur=10;
    ctx.fillText(missText,W*.5,H*.34);
    ctx.restore();
  }
  ctx.restore();

  // ================= SCREEN SPACE UI =================
  drawJudgeFx();
  ctx.textAlign='center';ctx.font='900 20px sans-serif';
  floats.forEach(f=>{ctx.globalAlpha=f.life;ctx.fillStyle=f.col;ctx.fillText(f.txt,f.x,f.y-G.cam);ctx.globalAlpha=1;});

  if(player.onBoard){
    const q=board.gaugeVal||0,bx=W*0.5,by=H*0.875,rr=W*0.13;
    ctx.save();ctx.lineWidth=W*0.045;ctx.lineCap='round';
    ctx.strokeStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.arc(bx,by,rr,Math.PI,0);ctx.stroke();
    const seg=[['#4aa3ef',0,.5],['#F7E85B',.5,.8],['#ff4d6d',.8,1]];
    seg.forEach(([c,a,b])=>{ctx.strokeStyle=c;ctx.beginPath();ctx.arc(bx,by,rr,Math.PI+Math.PI*a,Math.PI+Math.PI*b);ctx.stroke();});
    const ang=Math.PI+Math.PI*q;
    ctx.strokeStyle='#fff';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx+Math.cos(ang)*rr,by+Math.sin(ang)*rr);ctx.stroke();
    ctx.fillStyle='#ffb733';ctx.beginPath();ctx.arc(bx,by,7,0,7);ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
function loop(){
  if(current==='game'){updateGame();drawGame();}
  else ctx.clearRect(0,0,W,H);
  requestAnimationFrame(loop);
}


$('pauseBtn').onclick=(e)=>{e.stopPropagation(); if(G.over)return; paused=true; $('pauseOverlay').classList.add('on');};
$('resumeBtn').onclick=()=>{paused=false; $('pauseOverlay').classList.remove('on');};
$('pauseRetryBtn').onclick=()=>{paused=false; $('pauseOverlay').classList.remove('on'); startGame();};

$('startBtn').onclick=()=>{
  if(typeof DeviceOrientationEvent!=='undefined'&&DeviceOrientationEvent.requestPermission)DeviceOrientationEvent.requestPermission().catch(()=>{});
  startGame();
};
$('retryBtn').onclick=startGame;

resize();$('bestNum').textContent=best;show('title');requestAnimationFrame(loop);
