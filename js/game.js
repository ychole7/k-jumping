
const $=id=>document.getElementById(id);
const cv=$('c'),ctx=cv.getContext('2d'),stageEl=$('stageEl');

const ASSETS={ player:'assets/characters/player_idle.png', partner:'assets/characters/partner_idle.png', board:'assets/board/seesaw_final.png' };
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
  up();
  show('game');
  if(!W||!H)resize();
  G={cam:0,curM:0,peakM:0,lastJumpM:0,star:0,coin:+(localStorage.getItem('kjump_coin')||0),hearts:3,over:false,targetReached:false}; paused=false; $('pauseOverlay').classList.remove('on');
  board={cx:W*0.5,y:H*0.72,w:W*0.82,tilt:0,gaugePhase:0};
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
  for(let seg=0;seg<12;seg++){
    y-=H*0.24+Math.random()*H*0.16;
    const baseX=W*(0.18+Math.random()*0.64);
    const span=W*(0.26+Math.random()*0.30);
    const pattern=Math.floor(Math.random()*5);
    const n=4+Math.floor(Math.random()*3);
    for(let i=0;i<n;i++){
      const t=n===1?0:i/(n-1);
      let ox=baseX, oy=0;
      if(pattern===0){
        // 완만한 상승 라인
        ox=baseX-span*0.5+span*t;
        oy=-Math.sin(t*Math.PI)*H*0.035;
      }else if(pattern===1){
        // 좌우 지그재그
        ox=baseX+Math.sin(t*Math.PI*2)*span*0.42;
        oy=-Math.sin(t*Math.PI)*H*0.025;
      }else if(pattern===2){
        // 별 아치: 중앙 별이 조금 높다
        ox=baseX-span*0.5+span*t;
        oy=-Math.sin(t*Math.PI)*H*0.075;
      }else if(pattern===3){
        // 좁은 세로 묶음
        ox=baseX+(Math.random()-.5)*span*0.28;
        oy=-t*H*0.10;
      }else{
        // 양쪽으로 벌어지는 선택형 배치
        ox=baseX+(t<0.5?-1:1)*span*(0.12+Math.abs(t-.5)*0.72);
        oy=-Math.sin(t*Math.PI)*H*0.045;
      }
      items.push({
        wx:Math.max(30,Math.min(W-30,ox)),
        wy:y+oy,
        type:(Math.random()<0.24?'coin':'star'),
        got:false
      });
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
  // V38: 100m 1스테이지를 실제로 도달할 수 있도록 점프 높이를 상향.
  // PERFECT 약 110m / GOOD 약 83m / OK 약 62m 수준.
  player.vy=-(H*0.0484)*(0.7+power*0.6);
  launchFlash=1;
  jumpTrail=[];
  G.lastJudge={label,col};
}
let tsx=null;
let airSteer=0; // V56: 공중에서 화면 좌/우를 누르고 있는 동안 이동 방향
let paused=false;
let inputLock=false;
let activePointerId=null;
let activeTouchId=null;

function down(e){
  if(current!=='game'||G.over||paused)return;
  if(e.cancelable)e.preventDefault();
  const t=e.touches&&e.touches.length?e.touches[0]:e;
  tsx=t.clientX;
  const wasOnBoard=player.onBoard;
  tapGame();
  // V56: 이미 공중에 있을 때 새로 누르면 화면 좌/우 절반으로 이동한다.
  // 점프를 시작한 최초 탭은 조향으로 취급하지 않아 기존 타이밍 입력을 보존한다.
  if(!wasOnBoard) airSteer=(t.clientX < innerWidth*0.5 ? -1 : 1);
}
function mv(e){
  if(current!=='game'||G.over||paused||player.onBoard||tsx==null)return;
  if(e.cancelable)e.preventDefault();
  const t=e.touches&&e.touches.length?e.touches[0]:e;
  const dx=t.clientX-tsx;tsx=t.clientX;
  player.x=Math.max(player.r,Math.min(W-player.r,player.x+dx*1.22));
}
function up(){tsx=null;airSteer=0;inputLock=false;activePointerId=null;activeTouchId=null;}

// 입력은 game 요소가 아니라 stage 전체에서 받는다.
// 캔버스/HTML HUD가 위에 있어도 게임 영역 어디를 눌러도 점프하도록 한다.
const gameScene=$('game');
function handlePointerDown(e){
  if(e.pointerType==='mouse' && e.button!==0)return;
  if(current!=='game'||G.over||paused)return;
  if(inputLock)return;
  inputLock=true;
  if(e.pointerId!=null)activePointerId=e.pointerId;
  down(e);
}
if(window.PointerEvent){
  stageEl.addEventListener('pointerdown',e=>{
    handlePointerDown(e);
    if(activePointerId===e.pointerId && stageEl.setPointerCapture){
      try{stageEl.setPointerCapture(e.pointerId);}catch(_){}
    }
  },{passive:false});
  stageEl.addEventListener('pointermove',e=>{if(e.pointerId===activePointerId)mv(e);},{passive:false});
  const releasePointer=e=>{if(e.pointerId===activePointerId)up();};
  stageEl.addEventListener('pointerup',releasePointer,{passive:false});
  stageEl.addEventListener('pointercancel',releasePointer,{passive:false});
  stageEl.addEventListener('lostpointercapture',releasePointer);
}
// Pointer Events 미지원 환경에서만 터치 fallback 사용: 중복 입력 방지.
if(!window.PointerEvent){
  gameScene.addEventListener('touchstart',e=>{
    if(inputLock || !e.changedTouches.length)return;
    activeTouchId=e.changedTouches[0].identifier;
    handlePointerDown(e);
  },{passive:false});
  gameScene.addEventListener('touchmove',e=>{
    if(activeTouchId==null)return;
    const t=Array.from(e.changedTouches).find(t=>t.identifier===activeTouchId);
    if(t)mv({touches:[t],cancelable:e.cancelable,preventDefault:()=>e.preventDefault()});
  },{passive:false});
  const releaseTouch=e=>{
    if(activeTouchId!=null && Array.from(e.changedTouches).some(t=>t.identifier===activeTouchId))up();
  };
  gameScene.addEventListener('touchend',releaseTouch,{passive:false});
  gameScene.addEventListener('touchcancel',releaseTouch,{passive:false});
  gameScene.addEventListener('mousedown',handlePointerDown);
  gameScene.addEventListener('mousemove',e=>{if(e.buttons)mv(e);});
}
addEventListener('mouseup',up);
addEventListener('blur',up);
document.addEventListener('visibilitychange',()=>{if(document.hidden)up();});
// 최후의 fallback: 실제 click이 발생해도 점프 처리
gameScene.addEventListener('click',e=>{
  if(current==='game'&&!G.over&&!paused&&player.onBoard){
    tapGame();
  }
});



function addFloat(x,y,t,c){floats.push({x,y,txt:t,col:c,life:1});}
function ensureLifeHud(){
  let el=$('hearts');
  if(!el){
    el=document.createElement('div'); el.id='hearts';
    const game=$('game')||stageEl; game.appendChild(el);
  }
  // V45: 하트는 상단 HUD의 왼쪽 흐름에 배치한다.
  // 별/엽전/일시정지는 오른쪽으로, 현재 높이는 중앙으로 분리해 겹침을 막는다.
  el.style.position='static';
  el.style.top='auto';
  el.style.left='auto';
  el.style.zIndex='20';
  el.style.display='block';
  el.style.visibility='visible';
  el.style.opacity='1';
  el.style.pointerEvents='none';
  el.style.fontSize='23px';
  el.style.padding='7px 11px 6px';
  el.style.minWidth='108px';
  el.style.textAlign='center';
  el.style.marginTop='4px';
  el.style.borderRadius='18px';
  el.style.background='linear-gradient(180deg,rgba(33,62,91,.96),rgba(20,40,65,.96))';
  el.style.border='2px solid rgba(255,255,255,.55)';
  el.style.boxShadow='inset 0 2px 0 rgba(255,255,255,.14),0 4px 9px rgba(0,0,0,.3)';
  el.style.lineHeight='1';
  el.style.letterSpacing='0';
  el.style.filter='none';
  return el;
}
function updateHud(){
  $('gStar').textContent=G.star;$('gCoin').textContent=G.coin;
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
let judgeFx={text:'',color:'#fff',life:0,max:0.78,x:0,y:0};
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
  if(judgeFx.life>0){ judgeFx.life-=0.035; if(judgeFx.life<0)judgeFx.life=0; }
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
    player.vy+=H*0.000387;player.y+=player.vy;
    // V57: 더 민감한 한 손 공중 조향. 누르고 있는 쪽으로 부드럽게 이동하며 화면 밖으로 나가지 않는다.
    if(airSteer) player.x=Math.max(player.r,Math.min(W-player.r,player.x+airSteer*W*0.0145));
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
      player.onBoard=true;up();player.vy=0;player.x=Math.max(board.cx-board.w*0.42,Math.min(board.cx+board.w*0.42,player.x));player.y=board.y-player.r*0.5;board.gaugePhase=0;
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
      if(s.type==='coin'){
        G.coin++;
        localStorage.setItem('kjump_coin',G.coin);
        addFloat(s.wx,s.wy,'+1 엽','#f4b942');
        spawnSparkle(s.wx,s.wy,'#f4b942');
      }else{
        G.star++;
        addFloat(s.wx,s.wy,'+1','#ffd166');
        spawnSparkle(s.wx,s.wy,'#ffd166');
      }
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
  up();
  G.over=true;
  if(G.curM>best){best=G.curM;localStorage.setItem('kjump_best_m',best);}
  $('resTitle').textContent='100m CLEAR!';
  $('resM').textContent=G.peakM;
  $('resStar').textContent=G.star;
  $('resCoin').textContent=G.coin;
  show('result');
}
function loseLife(){
  if(G.over)return;
  up();
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
  $('resM').textContent=G.peakM;$('resStar').textContent=G.star;$('resCoin').textContent=G.coin;
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
  g.addColorStop(0,`rgb(${c1})`);g.addColorStop(.48,`rgb(${c2})`);g.addColorStop(1,`rgb(${c3})`);
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);

  // 따뜻한 태양빛과 하늘 깊이감을 위한 소프트 글로우
  const sun=ctx.createRadialGradient(W*.18,H*.15,0,W*.18,H*.15,W*.38);
  sun.addColorStop(0,'rgba(255,248,205,.48)');sun.addColorStop(.45,'rgba(255,244,194,.16)');sun.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=sun;ctx.fillRect(0,0,W,H);

  // 멀리 떠 있는 섬과 작은 폭포
  const night=G.curM>380;
  ctx.save();ctx.globalAlpha=night?.34:.38;
  for(let i=0;i<7;i++){
    const ix=(i*171+Math.sin(i*2.3)*60)%W;
    const iy=((i*119)%(H*1.8)+H*1.8)%(H*1.8)-H*.2;
    ctx.fillStyle=night?'#26365e':'#4d8d94';
    ctx.beginPath();ctx.ellipse(ix,iy,W*.095,H*.018,0,0,7);ctx.fill();
    ctx.beginPath();ctx.moveTo(ix-W*.068,iy);ctx.lineTo(ix+W*.068,iy);ctx.lineTo(ix+W*.026,iy+H*.062);ctx.lineTo(ix-W*.03,iy+H*.078);ctx.closePath();ctx.fill();
    if(!night){
      ctx.strokeStyle='rgba(190,240,255,.34)';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(ix,iy+H*.045);ctx.lineTo(ix+W*.005,iy+H*.075);ctx.stroke();
    }
  }
  ctx.restore();

  // 부드러운 구름층
  ctx.save();ctx.fillStyle='rgba(255,255,255,.86)';
  for(let i=0;i<7;i++){
    const cy=((i*H*.58)%(H*2.3)+H*2.3)%(H*2.3)-H*.42;
    cloud((i*151)%W,cy,W*(.13+(i%3)*.018));
  }
  ctx.restore();

  // 100m 아래쪽에서 한국 마을이 살짝 보이도록 레이어링
  if((G.curM||0)<140){
    const base=H*.94;
    ctx.save();ctx.globalAlpha=.72;
    ctx.fillStyle='#78a85c';ctx.beginPath();ctx.ellipse(W*.18,base,W*.42,H*.09,0,0,7);ctx.fill();
    ctx.fillStyle='#659451';ctx.beginPath();ctx.ellipse(W*.78,base+H*.02,W*.48,H*.11,0,0,7);ctx.fill();
    for(let i=0;i<4;i++){
      const x=W*(.07+i*.27), y=base-H*(.02+(i%2)*.015), w=W*.15, h=H*.045;
      ctx.fillStyle='#e7c17a';ctx.fillRect(x,y,w,h);
      ctx.fillStyle='#56412f';ctx.beginPath();ctx.moveTo(x-W*.015,y);ctx.lineTo(x+w/2,y-H*.035);ctx.lineTo(x+w+W*.015,y);ctx.closePath();ctx.fill();
      ctx.fillStyle='#6b4d2e';ctx.fillRect(x+w*.44,y+h*.35,w*.11,h*.65);
    }
    ctx.restore();
  }
}
function cloud(x,y,r){
  ctx.beginPath();
  ctx.arc(x,y,r*.62,0,7);ctx.arc(x+r*.48,y+4,r*.5,0,7);ctx.arc(x-r*.5,y+4,r*.46,0,7);ctx.arc(x,y+r*.28,r*.62,0,7);ctx.fill();
}

function drawStar(x,y,r,c){
  ctx.save();ctx.translate(x,y);ctx.rotate(-.08);
  ctx.fillStyle=c;ctx.shadowColor='rgba(255,213,67,.9)';ctx.shadowBlur=10;
  ctx.beginPath();
  for(let i=0;i<5;i++){
    ctx.lineTo(Math.cos((18+i*72)/180*Math.PI)*r,-Math.sin((18+i*72)/180*Math.PI)*r);
    ctx.lineTo(Math.cos((54+i*72)/180*Math.PI)*r*.44,-Math.sin((54+i*72)/180*Math.PI)*r*.44);
  }
  ctx.closePath();ctx.fill();
  ctx.shadowBlur=0;ctx.fillStyle='rgba(255,255,255,.72)';ctx.beginPath();ctx.arc(-r*.2,-r*.22,r*.18,0,7);ctx.fill();
  ctx.restore();
}
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
  // 캐릭터 원본 비율/크기를 항상 고정한다. 상승/하강/착지에 따른 이미지 변형은 사용하지 않는다.
  const im=getImg(ASSETS.player);
  ctx.save();
  if(im&&im.complete&&im.naturalWidth){
    const d=r*2.35;
    ctx.drawImage(im,px-d/2,py-d*0.82,d,d);
  }else{
    ctx.translate(px,py);
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
    if(s.type==='coin'){
      ctx.save();
      ctx.translate(s.wx,sy);
      ctx.fillStyle='#f6c64d';ctx.strokeStyle='#b87924';ctx.lineWidth=Math.max(2,W*0.006);
      ctx.beginPath();ctx.arc(0,0,W*0.040,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle='#8b5a22';ctx.font='900 '+Math.round(W*0.030)+'px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('엽',0,1);
      ctx.restore();
    }else{
      drawStar(s.wx,sy,W*0.045,'#ffd23f');
    }
  }

  // 장애물
  for(const r of rocks){
    if(r.hit)continue;
    const ry=r.wy;
    if(ry-G.cam<-80||ry-G.cam>H+80)continue;
    drawRock(r.wx,ry,r.r);
  }

  const pivotX=board.cx,pivotY=board.y,halfW=board.w/2,tilt=board.tilt||0;

  // 널은 '회전하는 판'과 '땅에 고정된 받침'을 분리해서 그린다.
  // 기존 seesaw_final.png가 한 장으로 합쳐져 있으므로 원본의 상단 판/하단 받침 영역을
  // source crop으로 나눠 렌더링한다. 물리 좌표와 캐릭터 좌표는 그대로 유지한다.
  const boardImg=getImg(ASSETS.board);
  if(boardImg && boardImg.complete && boardImg.naturalWidth){
    const drawW=board.w*1.02;
    const scale=drawW/boardImg.naturalWidth;
    const anchorY=H*0.018;
    const sourceW=boardImg.naturalWidth;
    const sourceH=boardImg.naturalHeight;

    // 원본 이미지 기준: 회전 판과 고정 받침을 분리.
    // 고정 받침은 y=382부터 사용해 원본에 남은 얇은 수평 널 조각을 완전히 제외한다.
    const plankSy=145, plankEy=Math.min(350,sourceH);
    const supportSy=382, supportEy=sourceH;

    // 받침/꽃/통나무는 땅에 고정. 절대 board.tilt를 적용하지 않는다.
    const supportTop=anchorY + (supportSy/boardImg.naturalHeight)*(drawW*(boardImg.naturalHeight/boardImg.naturalWidth)) -
      (drawW*(boardImg.naturalHeight/boardImg.naturalWidth))*0.285;
    const supportH=(supportEy-supportSy)*scale;
    ctx.save();
    ctx.imageSmoothingEnabled=true;
    // 받침 이미지 양옆에 남아 있는 원본의 얇은 수평 널 조각은 제외하고,
    // 중앙의 통나무/꽃 받침 영역만 고정 렌더링한다.
    const supportSx=Math.round(sourceW*0.27);
    const supportCropW=Math.round(sourceW*0.46);
    const supportDrawW=drawW*0.46;
    ctx.drawImage(boardImg,supportSx,supportSy,supportCropW,supportEy-supportSy,
      pivotX-supportDrawW/2,pivotY+supportTop-H*0.012,supportDrawW,supportH);
    ctx.restore();

    // 널판만 중앙 회전축을 기준으로 회전.
    const plankH=(plankEy-plankSy)*scale;
    const fullDrawH=drawW*(boardImg.naturalHeight/boardImg.naturalWidth);
    const plankTop=anchorY + (plankSy*scale) - fullDrawH*0.285;
    ctx.save();
    ctx.translate(pivotX,pivotY);
    ctx.rotate(tilt);
    ctx.imageSmoothingEnabled=true;
    ctx.drawImage(boardImg,0,plankSy,sourceW,plankEy-plankSy,
      -drawW/2,plankTop,drawW,plankH);
    ctx.restore();
  } else {
    // 이미지 로딩 전에도 게임 물리가 깨지지 않도록 간단한 판을 유지한다.
    // 받침은 고정, 판만 회전한다.
    ctx.save();
    ctx.translate(pivotX,pivotY+H*0.018);
    ctx.rotate(tilt);
    ctx.fillStyle='#9b6330';ctx.fillRect(-halfW,-H*.014,board.w,H*.032);
    ctx.restore();
    ctx.save();
    ctx.fillStyle='#8a5a32';
    ctx.beginPath();ctx.arc(pivotX,pivotY+H*.045,H*.055,0,7);ctx.fill();
    ctx.restore();
  }

  // 착지 가능 영역은 물리 판정과 동일하게 시각적으로만 표시한다.
  if(!player.onBoard&&board.landR){
    const zoneX=board.cx+Math.cos(tilt)*halfW*0.8;
    const zoneY=board.y+Math.sin(tilt)*halfW*0.8;
    const pulse=0.5+0.5*Math.sin(Date.now()/180);
    ctx.save();
    ctx.translate(zoneX,zoneY);ctx.rotate(tilt);
    ctx.globalAlpha=0.26+0.22*pulse;ctx.fillStyle='#7CFC5A';
    ctx.beginPath();ctx.ellipse(0,-H*0.008,board.landR*1.15,board.landR*0.34,0,0,7);ctx.fill();
    ctx.globalAlpha=0.75;ctx.strokeStyle='#3ea832';ctx.lineWidth=3;ctx.setLineDash([6,4]);
    ctx.beginPath();ctx.ellipse(0,-H*0.008,board.landR*1.15,board.landR*0.34,0,0,7);ctx.stroke();
    ctx.restore();
  }

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
  drawPartner(partX,partY-W*0.030,W*0.11);

  if(!player.onBoard)drawJumpTrail();
  if(!player.onBoard&&launchFlash>0.05){
    ctx.save();ctx.globalAlpha=launchFlash*0.22;ctx.fillStyle='#fff';
    ctx.beginPath();ctx.arc(player.x,player.y,player.r*(1.2+launchFlash),0,7);ctx.fill();ctx.restore();
  }
  drawPlayer(player.x,player.y+(player.onBoard?W*0.059:0),player.r);

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


$('pauseBtn').onclick=(e)=>{e.stopPropagation(); if(G.over)return; up(); paused=true; $('pauseOverlay').classList.add('on');};
$('resumeBtn').onclick=()=>{paused=false; $('pauseOverlay').classList.remove('on');};
$('pauseRetryBtn').onclick=()=>{paused=false; $('pauseOverlay').classList.remove('on'); startGame();};

$('startBtn').onclick=()=>{
  startGame();
};
$('retryBtn').onclick=startGame;

resize();$('bestNum').textContent=best;show('title');requestAnimationFrame(loop);
