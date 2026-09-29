
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
  if(ph) ph.style.display='none';
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

  const idx=REGIONS.indexOf(r);
  if(idx>G.lastRegionIndex){
    G.lastRegionIndex=idx;
    G.regionBanner={name:r.name,t:150};
  }
}
const TARGET_HEIGHT=1000; // V93: 100m에서 멈추지 않고 1000m까지 계속 플레이
let board,player,items,rocks,floats,petals;

function startGame(){
  up();
  show('game');
  if(!W||!H)resize();
  G={cam:0,curM:0,peakM:0,lastJumpM:0,star:0,coin:+(localStorage.getItem('kjump_coin')||0),hearts:3,over:false,targetReached:false,lastRegionIndex:0,lastMilestone:0,combo:0,landingTap:null,relaunchFrames:0,powerMode:false,powerVal:0,powerDir:1,hitCooldown:0,birdGrace:0,pressHeld:false,pressArmed:false}; paused=false; $('pauseOverlay').classList.remove('on');
  board={cx:W*0.5,y:H*0.755,w:W*0.82,tilt:0,gaugePhase:0};
  player={x:0,y:0,vy:0,r:W*0.12,onBoard:true};
  player.x=board.cx-board.w*0.42*0.8;
  player.y=board.y-player.r*0.5;
  items=[];rocks=[];floats=[];particles=[];jumpTrail=[];launchFlash=0;shake=0;
  petals=Array.from({length:14},()=>({x:Math.random()*W,y:Math.random()*H,s:2+Math.random()*3,vy:.4+Math.random(),vx:(Math.random()-.5)*.6}));
  spawnAhead(-H*0.4);
  // V89: first simple flying obstacle.
  rocks=[{kind:'bird',x:-W*.12,y:-H*.78,vx:W*.0019,dir:1,r:W*.064,phase:Math.random()*6.28,hit:false}];
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
        got:false,
        phase:Math.random()*Math.PI*2
      });
    }
    // V62: 고도별 장애물. 하늘마을=새, 구름마을=먹구름, 그 위=연/유성.
    if(Math.random()<0.48){
      const alt=Math.max(0,(board.y-y)/PPM());
      const type=alt<100?'bird':alt<250?'cloud':alt<500?'kite':'meteor';
      rocks.push({wx:Math.random()<.5?-W*.12:W*1.12,wy:y-H*.06,r:W*(type==='cloud'?.065:.045),type,dir:Math.random()<.5?1:-1,hit:false,phase:Math.random()*6.28});
      const o=rocks[rocks.length-1]; if(o.wx<0)o.dir=1; else o.dir=-1;
    }
  }
}


function kjJumpEquipMult(){
 const id=(kjEquip&&kjEquip.equipped&&kjEquip.equipped.shoes)||'flower';
 return ({flower:1.15,wind:1.22,cloud:1.30})[id]||1;
}

function launchWithPower(mult=1){
  player.onBoard=false;
  // V63: 같은 높이감을 유지하면서 상승/하강 시간을 약 20% 늘린다.
  player.vy=-(H*0.0484)*1.066*mult*kjJumpEquipMult();
  launchFlash=1; jumpTrail=[];
}
function tapGame(){
  if(current!=='game'||G.over||paused)return;
  // V64: 누르는 순간. 공중에서는 '착지 타이밍'을 예약하고,
  // 널 위에서는 바로 힘을 눌러 담기 시작한다.
  G.pressHeld=true;
  if(player.onBoard){
    G.pressArmed=true;
    G.powerMode=true;
    if(G.powerVal<=0.06)G.powerVal=0.08;
    return;
  }
  if(player.vy>0){
    const d=Math.max(0,board.y-(player.y+player.r));
    // V87: predict frames-to-impact from current fall speed.
    // This makes the grade depend on when the player actually taps, rather than a broad distance band.
    const fallSpeed=Math.max(0.001,player.vy);
    const framesToImpact=d/fallSpeed;
    let label='OK',col='#8ecae6',mult=0.96;
    if(framesToImpact<=2.6){label='PERFECT!';col='#ff4d6d';mult=1.10;}
    else if(framesToImpact<=6.5){label='GOOD';col='#ffb703';mult=1.03;}
    G.landingTap={label,col,mult,d,framesToImpact};
    G.pressArmed=true;
    addFloat(player.x,player.y-H*0.045,label,col);
  }
}

function releaseCharge(){
  if(!G.pressHeld)return;
  G.pressHeld=false;
  if(!player.onBoard||!G.pressArmed||!G.powerMode)return;
  const p=Math.max(0,Math.min(1,G.powerVal));
  // V91: one landing-rebound timing bar. Center is strongest.
  const dist=Math.abs(p-.5);
  // V96 balance: clear four-step rebound hierarchy without making non-perfect runs feel dead.
  let label='OK',col='#f39c32',power=.94;
  if(dist<=.050){label='PERFECT!';col='#ffd43b';power=1.24;}
  else if(dist<=.155){label='GOOD';col='#58d68d';power=1.09;}
  else if(dist>=.455){label='MISS!';col='#c77dff';power=.78;}
  if(label==='PERFECT!'){G.combo=(G.combo||0)+1;comboPulse=1;}
  else G.combo=0;
  launchGrade=label;launchGradeLife=1;gaugeFlash=1;launchFlash=(label==='PERFECT!'?1:.65);
  bigJudge(label,col);
  if(G.combo>=2)addFloat(player.x,board.y-H*.15,'PERFECT ×'+G.combo,'#ffd34d');
  G.powerMode=false;G.pressArmed=false;G.landingTap=null;
  launchWithPower(power);
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
  if(!wasOnBoard && !G.pressArmed) airSteer=(t.clientX < innerWidth*0.5 ? -1 : 1);
}
function mv(e){
  if(current!=='game'||G.over||paused||player.onBoard||tsx==null)return;
  if(e.cancelable)e.preventDefault();
  const t=e.touches&&e.touches.length?e.touches[0]:e;
  const dx=t.clientX-tsx;tsx=t.clientX;
  // V59: 손가락의 현재 위치를 기준으로 방향을 즉시 갱신해 이전 방향이 남지 않게 한다.
  airSteer=(t.clientX < innerWidth*0.5 ? -1 : 1);
  // 상승은 민감하게, 하강은 약 60%로 낮춰 착지 직전 과조향을 줄인다.
  const dragGain=player.vy>0 ? 0.74 : (Math.abs(player.vy)<H*0.004 ? 0.98 : 1.22);
  player.x=Math.max(player.r,Math.min(W-player.r,player.x+dx*dragGain));
}
function up(){releaseCharge();tsx=null;airSteer=0;inputLock=false;activePointerId=null;activeTouchId=null;}
function clearAirInput(){tsx=null;airSteer=0;inputLock=false;activePointerId=null;activeTouchId=null;}

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

// ================= V65 CLEAN PLAY HUD =================
// 확정 시안 기준: ❤️ 좌측 / 현재 높이 중앙 / ⭐·🪙·일시정지 우측.
// 지역명·상시 진행바는 플레이 중 숨기고, 공중 시야를 최대한 확보한다.
function applyV65Hud(){
  const game=$('game')||stageEl;
  if(!game)return;
  game.style.position='relative';

  // V66: 기존 HUD 부모에는 절대 배경/크기 스타일을 주지 않는다.
  // V65의 화면 중앙 갈색 세로판은 depth.parentElement가 전체 HUD 래퍼였기 때문에 생겼다.
  const oldDepth=$('depth');
  if(oldDepth) oldDepth.style.display='none';

  let hud=document.getElementById('v66CleanHud');
  if(!hud){
    hud=document.createElement('div');
    hud.id='v66CleanHud';
    hud.innerHTML=`
      <div class="v66-hearts"></div>
      <div class="v66-height"><small>현재 높이</small><b>0m</b><em>♛ BEST 0m</em></div>
      <div class="v66-money"><span class="v66-star"><i class="v84-star-icon">★</i> <b>0</b></span><span class="v66-coin"><i class="v67-coin-icon">◇</i> <b>0</b></span></div>`;
    game.appendChild(hud);
    Object.assign(hud.style,{position:'absolute',inset:'0',zIndex:'39',pointerEvents:'none'});
    const hearts=hud.querySelector('.v66-hearts');
    Object.assign(hearts.style,{position:'absolute',left:'3.5%',top:'2.3%',padding:'6px 9px',borderRadius:'18px',background:'rgba(25,57,91,.92)',fontSize:'clamp(18px,5.2vw,25px)',whiteSpace:'nowrap',boxShadow:'0 3px 7px rgba(0,0,0,.22)'});
    const h=hud.querySelector('.v66-height');
    Object.assign(h.style,{position:'absolute',left:'50%',top:'1.25%',transform:'translateX(-50%)',minWidth:'25%',padding:'5px 10px 6px',borderRadius:'13px',background:'linear-gradient(180deg,#80512f,#59351f)',border:'3px solid #b98555',boxShadow:'0 4px 8px rgba(0,0,0,.25)',textAlign:'center',color:'#fff'});
    Object.assign(h.querySelector('small').style,{display:'block',fontSize:'10px',fontWeight:'900',lineHeight:'1'});
    Object.assign(h.querySelector('b').style,{display:'block',fontSize:'clamp(25px,7vw,36px)',lineHeight:'1',textShadow:'0 3px 2px rgba(0,0,0,.4)'});
    Object.assign(h.querySelector('em').style,{position:'absolute',left:'50%',top:'calc(100% + 3px)',transform:'translateX(-50%)',padding:'2px 7px',borderRadius:'11px',background:'rgba(25,57,91,.94)',border:'2px solid #d8a45f',color:'#ffe2a0',fontSize:'9px',fontWeight:'900',fontStyle:'normal',whiteSpace:'nowrap'});
    const money=hud.querySelector('.v66-money');
    Object.assign(money.style,{position:'absolute',right:'13.5%',top:'2.1%',display:'flex',flexDirection:'column',gap:'4px'});
    money.querySelectorAll('span').forEach(x=>Object.assign(x.style,{minWidth:'60px',padding:'3px 8px',borderRadius:'13px',background:'rgba(25,57,91,.94)',color:'#fff',fontSize:'14px',fontWeight:'900',textAlign:'center'}));
    const si=money.querySelector('.v84-star-icon');if(si)Object.assign(si.style,{color:'#ffd84a',fontSize:'19px',textShadow:'0 1px 0 #9a6200,0 0 5px rgba(255,210,50,.65)',verticalAlign:'middle',fontStyle:'normal'});const ci=money.querySelector('.v67-coin-icon');
    if(ci)Object.assign(ci.style,{display:'inline-flex',width:'18px',height:'18px',borderRadius:'50%',alignItems:'center',justifyContent:'center',background:'linear-gradient(145deg,#ffe06a,#d89408)',border:'2px solid #fff0a8',boxShadow:'inset 0 -2px 0 rgba(120,70,0,.28)',color:'#8a5100',fontSize:'10px',fontWeight:'1000',fontStyle:'normal',verticalAlign:'middle'});
  }
  hud.querySelector('.v66-hearts').textContent='❤️'.repeat(G.hearts)+'🤍'.repeat(3-G.hearts);
  hud.querySelector('.v66-height b').textContent=G.curM+'m';
  hud.querySelector('.v66-height em').textContent='♛ BEST '+Math.max(best,G.peakM||0)+'m';
  hud.querySelector('.v66-star b').textContent=G.star;
  hud.querySelector('.v66-coin b').textContent=G.coin;

  // 기존 중복 HUD 요소 숨김
  const life=$('lifeHud'); if(life)life.style.display='none';
  const star=$('gStar'), coin=$('gCoin');
  if(star&&star.parentElement)star.parentElement.style.display='none';
  if(coin&&coin.parentElement)coin.parentElement.style.display='none';
  const rn=$('regionName'), rs=$('regionSub'), ph=$('progressHUD');
  if(rn&&rn.parentElement)rn.parentElement.style.display='none';
  if(rs&&rs.parentElement&&rs.parentElement!==rn?.parentElement)rs.parentElement.style.display='none';
  if(ph)ph.style.display='none';

  // 목표 높이 카드는 기존 것을 유지하되 중앙을 가리지 않게 한다.
  const target=$('targetHeight');
  if(target&&target.parentElement){
    Object.assign(target.parentElement.style,{position:'absolute',left:'3.5%',top:'11.2%',zIndex:'38',width:'auto',height:'auto',maxWidth:'22%',transform:'scale(.86)',transformOrigin:'top left',margin:'0'});
  }

  const pause=$('pauseBtn');
  if(pause)Object.assign(pause.style,{position:'absolute',right:'3.5%',top:'2.0%',zIndex:'41',width:'44px',height:'44px',margin:'0',borderRadius:'50%'});
}
function updateHud(){
  $('gStar').textContent=G.star;$('gCoin').textContent=G.coin;
  const heartEl=ensureLifeHud();
  heartEl.textContent='❤️'.repeat(G.hearts)+'🤍'.repeat(3-G.hearts);
  $('depth').textContent=G.curM+'m';
  updateRegion();
  applyV65Hud();

  const hs=document.querySelector('.v66-star'),hc=document.querySelector('.v66-coin');
  if(hs)hs.style.transform=`scale(${1+hudPopStar*.16})`;
  if(hc)hc.style.transform=`scale(${1+hudPopCoin*.16})`;
}

let squash=0;
let particles=[];
let pickupFly=[]; let hudPopStar=0,hudPopCoin=0;
let perfectFX=[]; let comboPulse=0;
let launchGrade='OK',launchGradeLife=0,gaugeFlash=0;
let landingImpactFX=[];
let milestoneFX=null;   // 먼지·반짝임 파티클
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
  for(let i=0;i<10;i++){
    const a=Math.random()*Math.PI*2;
    particles.push({x,y,vx:Math.cos(a)*(2.4+Math.random()*1.8),vy:Math.sin(a)*(2.4+Math.random()*1.8)-1,life:1,type:'sparkle',color,size:2.2+Math.random()*3});
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
    // 널은 board.y에 고정. 착지 후에는 카메라만 부드럽게 원점으로 복귀한다.
    G.cam=0;
    if(landingSquash>0.01){
      squash=Math.max(squash,landingSquash*0.34);
      board.tilt += (0-board.tilt)*0.28;
    }else{
      squash+=(0-squash)*0.2;
    }
    // V62: 자동 재점프 없음. 첫 탭으로 시작한 파워 게이지만 빠르게 왕복한다.
    if(G.powerMode && G.pressHeld){
      // V64: 누르고 있는 동안 0→100%로 차오른다. PERFECT를 지나면 과충전.
      G.powerVal=Math.min(1,G.powerVal+0.018);
      board.gaugeVal=G.powerVal;
      // 힘을 모으는 동안 널이 눌리는 느낌.
      board.tilt += (0.035*G.powerVal-board.tilt)*0.10;
    }else board.gaugeVal=G.powerMode?G.powerVal:0;
    board.tilt+=(0-board.tilt)*0.18;
    player.x=board.cx-Math.cos(board.tilt)*halfW*0.8;
    player.y=board.y-Math.sin(board.tilt)*halfW*0.8-player.r*0.5;
    squash+=(0-squash)*0.2;
  }else{
    jumpTrail.push({x:player.x,y:player.y,life:1});
    if(jumpTrail.length>18)jumpTrail.shift();
    jumpTrail.forEach(p=>p.life-=0.055);
    jumpTrail=jumpTrail.filter(p=>p.life>0);
    board.tilt+=(-0.15-board.tilt)*0.06;
    // V97: smooth apex -> descent. Upward motion keeps the original gravity;
    // once descending, gravity eases in and terminal fall speed is softened.
    const baseG=H*0.000260;
    if(player.vy<=0){
      player.vy+=baseG;
    }else{
      const fallBlend=Math.min(1,player.vy/(H*.020));
      player.vy+=baseG*(.58+.24*fallBlend);
      player.vy=Math.min(player.vy,H*.0205);
    }
    player.y+=player.vy;
    // V59: 상승/정점/하강 조향을 분리한다.
    // 상승은 V57의 민감도를 유지하고, 정점은 조금 완화, 하강은 60%로 낮춘다.
    // 자동 착지 보정은 하지 않으며 손을 떼면 airSteer=0으로 즉시 중립이다.
    if(airSteer){
      const absVy=Math.abs(player.vy);
      let steerGain;
      if(player.vy>0) steerGain=0.0087;       // 하강: V57의 약 60%
      else if(absVy<H*0.004) steerGain=0.0112; // 정점 부근
      else steerGain=0.0145;                  // 상승: V57 유지
      player.x=Math.max(player.r,Math.min(W-player.r,player.x+airSteer*W*steerGain));
    }
    squash=Math.max(-0.35,Math.min(0.35,-player.vy*4/H));
    // V24: V15 카메라 방식 복원. G.cam은 음수로 이동할 수 있어야 한다.
    // 플레이어가 상승하면 카메라도 따라가고, 플레이어는 화면 약 40%에 머문다.
    // V75: 카메라는 플레이어를 따라 상승/하강하되 지면(0) 아래로는 가지 않는다.
    // 이 값 하나로 월드 전체(널/상대/아이템)가 움직이므로 널 자체 좌표는 절대 변경하지 않는다.
    const landingDist=board.y-(player.y+player.r);
    // V77: 하강 마지막 구간에서는 카메라를 먼저 지면에 붙인다.
    // 착지 판정 뒤에 월드가 움직이지 않으므로 널이 튀어 오르는 착시가 사라진다.
    const nearGround=player.vy>0 && landingDist < H*0.30;
    const cameraTarget=nearGround ? 0 : Math.min(0,player.y-H*0.40);
    G.cam += (cameraTarget-G.cam)*(nearGround ? 0.52 : (player.vy>0 ? 0.22 : 0.16));
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
    // V60: 고도 구간에 처음 진입할 때 짧은 월드 이벤트를 표시한다.
    const regionIndex=REGIONS.findIndex(r=>m<r.max);
    if(regionIndex>G.lastRegionIndex){
      G.lastRegionIndex=regionIndex;
      const rr=REGIONS[regionIndex];
      addFloat(player.x,player.y-H*0.10,rr.name+' 진입!','#ffffff');
      spawnDust(player.x,player.y,10,1.15);
    }
    if(G.peakM>=TARGET_HEIGHT)G.targetReached=true;
    // V93: 100m 단위는 클리어가 아니라 통과 이정표.
    const milestone=Math.floor(G.peakM/100)*100;
    if(milestone>=100 && milestone<TARGET_HEIGHT && milestone>(G.lastMilestone||0)){
      G.lastMilestone=milestone;
      const major=(milestone%500===0); milestoneFX={m:milestone,life:1,major}; addFloat(player.x,player.y-H*.10,milestone+'m 돌파!','#fff1a8'); if(major){shake=Math.min(1,shake+.32);spawnSparkle(player.x,player.y,'#fff1a8');}
    }

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
      const impactSpeed=Math.max(0,player.vy);
      landingImpactFX.push({x:player.x,y:board.y-G.cam,life:1,power:Math.max(.65,Math.min(1.25,impactSpeed/(H*.018)))});
      gaugeFlash=1;
      player.onBoard=true;clearAirInput();player.vy=0;player.x=Math.max(board.cx-board.w*0.42,Math.min(board.cx+board.w*0.42,player.x));player.y=board.y-player.r*0.5;board.gaugePhase=0;
      // 한 번의 점프가 끝나면 현재 높이는 0으로 돌아간다. 최고 높이는 유지한다.
      G.curM=0;
      // V76: 착지 순간 카메라를 0으로 강제 스냅하지 않는다.
      // 마지막 남은 카메라 오프셋은 지상 상태에서 부드럽게 0으로 복귀시킨다.
      updateHud();
      jumpTrail=[];
      landingSquash=1;
      landingKick=1;
      // V62: 착지 판정은 보여주되 멈춰 선다. 다음 점프는 반드시 플레이어가 파워 게이지를 조작한다.
      const landingJudge=G.landingTap||{label:'OK',col:'#8ecae6',mult:0.96};
      const isPerfect=landingJudge.label==='PERFECT!';
      if(isPerfect){G.combo=(G.combo||0)+1;comboPulse=1;if(G.combo>=2)addFloat(player.x,board.y-H*0.15,'PERFECT ×'+G.combo,'#ffd34d');}else{G.combo=0;}
      spawnDust(player.x,board.y,isPerfect?14:landingJudge.label==='GOOD'?8:5,isPerfect?1.75:1);
      shake=Math.min(1,shake+(isPerfect?.82:.45));
      if(isPerfect){
        perfectFX.push({x:player.x,y:board.y-G.cam,life:1});
        spawnSparkle(player.x,board.y,'#fff1a8');
      }
      bigJudge(landingJudge.label,landingJudge.col);
      G.landingTap=null;
      G.powerMode=true; G.pressArmed=true; G.powerVal=0.08; G.powerDir=1; G.relaunchFrames=0;
      G.lastJudge=null;
      // 목표 높이를 넘었더라도 착지까지 기다린 뒤 클리어한다.
      if(G.peakM>=TARGET_HEIGHT)clearGame();
    }
    // 플레이어 사이드가 아닌 곳에 착지하려 했거나 널판지를 완전히 지나치면 실패.
    // 중앙선을 넘은 상대방 사이드 착지는 성공 처리하지 않는다.
    if(player.vy>0&&player.y+player.r>bw+player.r*2.4)loseLife();
  }
  // V62: 고도별 장애물 이동 + 충돌. 충돌 시 하트 1개 감소하고 같은 장애물은 제거한다.
  if(G.hitCooldown>0)G.hitCooldown--;
    if(G.birdGrace>0)G.birdGrace--;
  for(const o of rocks){
    if(o.hit)continue;
    const speed=(o.type==='bird'?W*.0048:o.type==='cloud'?W*.0025:o.type==='kite'?W*.0036:W*.0055);
    o.wx+=o.dir*speed;
    o.phase=(o.phase||0)+0.08;
    o.wy+=Math.sin(o.phase)*0.12;
    if(o.wx<-W*.2)o.wx=W*1.15; else if(o.wx>W*1.2)o.wx=-W*.15;
    if(false){ /* V100: legacy direct-damage obstacle collision disabled */ }
  }

  // STAR COLLECTION: items stay in world space; collision uses world coordinates.
  for(const s of items){
    if(s.got)continue;
    const screenY=s.wy-G.cam;
    if(screenY<-80||screenY>H+80)continue;
    if(!player.onBoard&&Math.hypot(s.wx-player.x,s.wy-player.y)<player.r+W*0.045){
      s.got=true;
      const pickupSY=s.wy-G.cam;
      pickupFly.push({x:s.wx,y:pickupSY,type:s.type,life:1,phase:s.phase||0});
      if(s.type==='coin'){
        G.coin++;
        localStorage.setItem('kjump_coin',G.coin);
        addFloat(s.wx,s.wy,'+1 엽','#f4b942');
        spawnSparkle(s.wx,s.wy,'#f4b942');
        hudPopCoin=1;
      }else{
        G.star++;
        addFloat(s.wx,s.wy,'+1','#ffd166');
        spawnSparkle(s.wx,s.wy,'#ffd166');
        hudPopStar=1;
      }
      updateHud();
    }
  }
  // V89 bird obstacle: horizontal patrol in world space.
  for(const b of rocks){
    if(b.kind!=='bird')continue;
    b.x+=b.vx*b.dir;
    if(b.x>W*1.12){b.x=W*1.12;b.dir=-1;}
    if(b.x<-W*.12){b.x=-W*.12;b.dir=1;}
    b.phase+=.12;
    const birdDist=Math.hypot(b.x-player.x,b.y-player.y);
    // V90: bird is a trajectory hazard, not direct life damage.
    // Visual bird stays readable, but the damaging body hitbox is deliberately smaller.
    if(G.hitCooldown<=0&&!player.onBoard&&!b.hit&&birdDist<player.r*.58+b.r*.40){
      b.hit=true;G.hitCooldown=34;
      const push=(player.x<b.x?-1:1)*W*.034;
      player.x=Math.max(player.r,Math.min(W-player.r,player.x+push));
      player.vy-=H*.055;
      airSteer=0;
      missFlash=.55;missText='BUMP!';shake=Math.min(1,shake+.62);
      addFloat(player.x,player.y-H*.05,'BUMP!','#ffcf66');spawnSparkle(player.x,player.y,'#fff1a8');
    }
    // Wing graze: small sideways nudge only, no flash/life loss.
    else if(G.hitCooldown<=0&&!player.onBoard&&!b.hit&&birdDist<player.r*.72+b.r*.82){
      b.hit=true;G.hitCooldown=24;G.birdGrace=36;
      player.x=Math.max(player.r,Math.min(W-player.r,player.x+(player.x<b.x?-1:1)*W*.014));
      addFloat(player.x,player.y-H*.035,'SWISH!','#d9f3ff');
    }
    if(birdDist>player.r+b.r*2.5)b.hit=false;
  }
  if(G.hitCooldown>0)G.hitCooldown--;
  // 장애물은 이번 단계에서 비활성화. 수집 시스템만 먼저 확정한다.
  const topY=items.length?items.reduce((mn,s)=>Math.min(mn,s.wy),Infinity):-H*0.4;
  if(topY-G.cam>H*1.5)spawnAhead(topY);
  floats.forEach(f=>{f.y-=1.2;f.life-=0.02;});floats=floats.filter(f=>f.life>0);
  petals.forEach(p=>{p.y+=p.vy;p.x+=p.vx;if(p.y>H){p.y=-10;p.x=Math.random()*W;}});
  pickupFly.forEach(f=>{f.life-=0.055;const tx=W*.82,ty=H*.075;const k=.12+(1-f.life)*.12;f.x+=(tx-f.x)*k;f.y+=(ty-f.y)*k;});pickupFly=pickupFly.filter(f=>f.life>0);
  hudPopStar=Math.max(0,hudPopStar-.07);hudPopCoin=Math.max(0,hudPopCoin-.07);
  perfectFX.forEach(f=>f.life-=.055);perfectFX=perfectFX.filter(f=>f.life>0);
  comboPulse=Math.max(0,comboPulse-.045);
  launchGradeLife=Math.max(0,launchGradeLife-.018);gaugeFlash=Math.max(0,gaugeFlash-.10);
  landingImpactFX.forEach(f=>f.life-=.065);landingImpactFX=landingImpactFX.filter(f=>f.life>0);
  if(milestoneFX){milestoneFX.life-=milestoneFX.major?.020:.026;if(milestoneFX.life<=0)milestoneFX=null;}
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
  $('resTitle').textContent=TARGET_HEIGHT+'m CLEAR!';
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
  board.gaugeVal=0;
  G.powerMode=false;G.powerVal=0;G.powerDir=1;G.landingTap=null;G.combo=0;G.pressHeld=false;G.pressArmed=false;
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

// V69: 0~100m 실제 게임 배경 이미지
const V69_BG=new Image();
V69_BG.src='assets/bg_skyvillage.jpg';
const V78_UPPER_BG=new Image();
V78_UPPER_BG.src='assets/bg_upper_sky.jpg';
const V79_WORLD_BG=new Image();
V79_WORLD_BG.src='assets/bg_world_01.jpg';
const V80_STAGE_BG=new Image();
V80_STAGE_BG.src='assets/bg_stage1_chunks.jpg';
const V81_WORLD1000=new Image();
V81_WORLD1000.src='assets/bg_world_1000m.jpg';
const V82_WORLD1000=new Image();
V82_WORLD1000.src='assets/bg_world_1000m_simple.jpg';
const V83_WORLD1000=new Image();
V83_WORLD1000.src='assets/bg_world_1000m_medium.jpg';

function drawV69PhotoBG(){
  if(!V69_BG.complete || !V69_BG.naturalWidth)return false;
  const iw=V69_BG.naturalWidth, ih=V69_BG.naturalHeight;
  // V73: 배경도 월드의 일부처럼 카메라를 따라 움직인다.
  // 시작 화면에서는 지면/마을이 보이고, 플레이어가 상승하면 지상 풍경은 아래로 사라진다.
  const scale=Math.max(W/iw,H/ih)*1.14;
  const dw=iw*scale, dh=ih*scale, dx=(W-dw)*0.5;
  const travel=Math.max(0,dh-H);
  const startY=-travel; // 시작 시 이미지 하단(지면)을 화면 하단에 맞춤
  // G.cam은 상승 시 음수가 된다. 배경은 전경보다 느리게 움직여 깊이감을 준다.
  const cameraRise=Math.max(0,-(G.cam||0));
  const dy=startY + cameraRise*0.34;
  ctx.drawImage(V69_BG,0,0,iw,ih,dx,dy,dw,dh);
  const veil=ctx.createLinearGradient(0,0,0,H);
  veil.addColorStop(0,'rgba(80,175,245,.03)');
  veil.addColorStop(.62,'rgba(255,255,255,.015)');
  veil.addColorStop(1,'rgba(255,245,225,.04)');
  ctx.fillStyle=veil;ctx.fillRect(0,0,W,H);
  return true;
}

function drawV78UpperBG(){
  if(!V78_UPPER_BG.complete||!V78_UPPER_BG.naturalWidth)return false;
  const iw=V78_UPPER_BG.naturalWidth,ih=V78_UPPER_BG.naturalHeight;
  const scale=Math.max(W/iw,H/ih)*1.12,dw=iw*scale,dh=ih*scale,dx=(W-dw)*0.5;
  const rise=Math.max(0,-(G.cam||0));
  // 상공 배경은 지상 배경보다 느리게 움직여 멀리 있는 하늘처럼 보인다.
  const dy=-(dh-H)*0.88 + rise*0.20;
  ctx.drawImage(V78_UPPER_BG,0,0,iw,ih,dx,dy,dw,dh);
  return true;
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
  // V83: 중간 퀄리티 0~1000m 월드.
  // 현재 고도(m)를 월드 스트립의 실제 세로 위치에 직접 대응한다.
  if(V83_WORLD1000.complete&&V83_WORLD1000.naturalWidth){
    const iw=V83_WORLD1000.naturalWidth,ih=V83_WORLD1000.naturalHeight;
    const viewAspect=W/H;
    let sw=iw,sh=sw/viewAspect;
    if(sh>ih){sh=ih;sw=sh*viewAspect;}
    const sx=(iw-sw)*0.5;
    const altitude=Math.max(0,Math.min(1000,G.curM||0));
    const t=altitude/1000;
    const sy=(ih-sh)*(1-t);
    ctx.drawImage(V83_WORLD1000,sx,sy,sw,sh,0,0,W,H);
    return;
  }
  ctx.fillStyle='#73c8ff';ctx.fillRect(0,0,W,H);
}
function cloud(x,y,r){
  ctx.beginPath();
  ctx.arc(x,y,r*.62,0,7);ctx.arc(x+r*.48,y+4,r*.5,0,7);ctx.arc(x-r*.5,y+4,r*.46,0,7);ctx.arc(x,y+r*.28,r*.62,0,7);ctx.fill();
}

function drawStar(x,y,r,c,phase=0){
  const pulse=1+Math.sin(performance.now()*0.004+phase)*0.055;
  ctx.save();ctx.translate(x,y);ctx.scale(pulse,pulse);ctx.rotate(-.08);
  ctx.shadowColor='rgba(255,190,30,.72)';ctx.shadowBlur=r*.42;
  ctx.fillStyle='#f5a900';ctx.strokeStyle='#fff0a0';ctx.lineWidth=Math.max(2,r*.10);
  ctx.beginPath();for(let i=0;i<10;i++){const rr=i%2===0?r:r*.46,ang=-Math.PI/2+i*Math.PI/5,px=Math.cos(ang)*rr,py=Math.sin(ang)*rr;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.closePath();ctx.fill();ctx.stroke();
  ctx.shadowBlur=0;ctx.fillStyle='#ffd94a';ctx.beginPath();ctx.arc(0,r*.03,r*.49,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.86)';ctx.beginPath();ctx.ellipse(-r*.22,-r*.28,r*.18,r*.10,-.55,0,Math.PI*2);ctx.fill();
  const tw=(Math.sin(performance.now()*0.007+phase)+1)*.5;if(tw>.68){ctx.globalAlpha=(tw-.68)/.32;ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(r*.58,-r*.56);ctx.lineTo(r*.58,-r*.18);ctx.moveTo(r*.39,-r*.37);ctx.lineTo(r*.77,-r*.37);ctx.stroke();}
  ctx.restore();
}
function drawYeopjeon(x,y,r,phase=0){
  const turn=.72+.28*Math.abs(Math.cos(performance.now()*0.0032+phase)),bob=Math.sin(performance.now()*0.0038+phase)*r*.06;
  ctx.save();ctx.translate(x,y+bob);ctx.scale(turn,1);ctx.shadowColor='rgba(128,72,0,.42)';ctx.shadowBlur=r*.34;
  const g=ctx.createRadialGradient(-r*.28,-r*.34,r*.08,0,0,r);g.addColorStop(0,'#fff1a0');g.addColorStop(.34,'#ffd34f');g.addColorStop(.72,'#e9a21b');g.addColorStop(1,'#a9650c');
  ctx.fillStyle=g;ctx.strokeStyle='#fff0a0';ctx.lineWidth=Math.max(2,r*.10);ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.shadowBlur=0;ctx.strokeStyle='rgba(139,78,4,.65)';ctx.lineWidth=Math.max(2,r*.07);ctx.beginPath();ctx.arc(0,0,r*.67,0,Math.PI*2);ctx.stroke();
  const q=r*.26;ctx.fillStyle='#70420c';ctx.strokeStyle='#ffe27a';ctx.lineWidth=Math.max(1.5,r*.06);ctx.beginPath();ctx.rect(-q,-q,q*2,q*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.52)';ctx.beginPath();ctx.arc(-r*.34,-r*.36,r*.13,0,Math.PI*2);ctx.fill();ctx.restore();
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
function drawObstacle(o){
  const x=o.wx,y=o.wy,r=o.r;
  ctx.save();ctx.translate(x,y);
  if(o.type==='bird'){
    ctx.strokeStyle='#263238';ctx.lineWidth=Math.max(3,r*.18);ctx.lineCap='round';
    ctx.beginPath();ctx.arc(-r*.48,0,r*.55,3.55,5.95);ctx.stroke();
    ctx.beginPath();ctx.arc(r*.48,0,r*.55,3.48,5.88);ctx.stroke();
  }else if(o.type==='cloud'){
    ctx.fillStyle='#66717d';
    ctx.beginPath();ctx.arc(-r*.45,0,r*.55,0,7);ctx.arc(0,-r*.18,r*.72,0,7);ctx.arc(r*.55,0,r*.5,0,7);ctx.fill();
    ctx.strokeStyle='#ffd54f';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,r*.45);ctx.lineTo(-r*.18,r*.95);ctx.lineTo(r*.12,r*.82);ctx.lineTo(-r*.02,r*1.35);ctx.stroke();
  }else if(o.type==='kite'){
    ctx.rotate(.25);ctx.fillStyle='#ef476f';ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(r*.75,0);ctx.lineTo(0,r);ctx.lineTo(-r*.75,0);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#444';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,r);ctx.quadraticCurveTo(r*.7,r*1.6,0,r*2.2);ctx.stroke();
  }else{
    ctx.rotate(-.55);ctx.fillStyle='#ff8c42';ctx.beginPath();ctx.arc(0,0,r*.65,0,7);ctx.fill();
    ctx.fillStyle='rgba(255,190,80,.65)';ctx.beginPath();ctx.moveTo(-r*.4,0);ctx.lineTo(-r*2.2,-r*.45);ctx.lineTo(-r*1.7,r*.45);ctx.closePath();ctx.fill();
  }
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


// ================= V68 ALTITUDE WORLD =================
function altitudeWorld(){
  const m=Math.max(G.curM||0,G.peakM||0);
  if(m<100)return {top:'rgba(74,176,244,.06)',bottom:'rgba(120,214,255,.02)',accent:'#fff2b0'};
  if(m<250)return {top:'rgba(105,150,235,.18)',bottom:'rgba(235,247,255,.10)',accent:'#dff6ff'};
  if(m<500)return {top:'rgba(79,126,194,.24)',bottom:'rgba(185,221,240,.08)',accent:'#d8f2ff'};
  if(m<1000)return {top:'rgba(31,57,122,.36)',bottom:'rgba(88,139,200,.12)',accent:'#b9d9ff'};
  return {top:'rgba(7,15,55,.54)',bottom:'rgba(40,55,120,.20)',accent:'#d9ddff'};
}
function drawAltitudeWorld(){
  const a=altitudeWorld(), m=Math.max(G.curM||0,G.peakM||0);
  const gr=ctx.createLinearGradient(0,0,0,H);
  gr.addColorStop(0,a.top);gr.addColorStop(1,a.bottom);
  ctx.save();ctx.fillStyle=gr;ctx.fillRect(0,0,W,H);
  if(m>=100){
    ctx.globalAlpha=Math.min(.55,.14+m/2200);ctx.fillStyle=a.accent;
    for(let k=0;k<11;k++){
      const x=(k*97+G.cam*.11)%W, y=(k*151-G.cam*.035)%(H*.70);
      ctx.beginPath();ctx.arc((x+W)%W,(y+H)%H,1.1+(k%3)*.5,0,Math.PI*2);ctx.fill();
    }
  }
  ctx.restore();
}
function drawRegionBanner(){
  if(!G.regionBanner||G.regionBanner.t<=0)return;
  G.regionBanner.t--;
  const t=G.regionBanner.t, alpha=Math.min(1,(150-t)/18,t/28);
  ctx.save();ctx.globalAlpha=alpha;
  const bw=W*.58,bh=H*.062,x=(W-bw)/2,y=H*.19;
  ctx.fillStyle='rgba(24,47,73,.80)';roundRect(ctx,x,y,bw,bh,16);ctx.fill();
  ctx.strokeStyle='rgba(255,230,155,.85)';ctx.lineWidth=2;roundRect(ctx,x,y,bw,bh,16);ctx.stroke();
  ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font=`900 ${Math.max(17,W*.050)}px system-ui`;
  ctx.fillText(G.regionBanner.name,W/2,y+bh*.55);
  ctx.fillStyle='#ffe6a0';ctx.font=`800 ${Math.max(9,W*.025)}px system-ui`;
  ctx.fillText('새로운 고도 영역',W/2,y+bh*.82);ctx.restore();
}

function roundRect(c,x,y,w,h,r){r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function drawGame(){
  // V74: 이전 프레임의 카메라 transform/잔상을 완전히 제거한 뒤 새 프레임을 그린다.
  ctx.save();
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.clearRect(0,0,W,H);
  ctx.restore();
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
    if(s.type==='coin'){drawYeopjeon(s.wx,sy,W*0.041,s.phase||0);}
    else{drawStar(s.wx,sy,W*0.045,'#ffd23f',s.phase||0);}
  }

  // 장애물
  for(const r of rocks){
    if(r.hit)continue;
    const ry=r.wy;
    if(ry-G.cam<-80||ry-G.cam>H+80)continue;
    drawObstacle(r);
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

  // V98 milestone overlay.
  if(milestoneFX){const f=milestoneFX,t=1-f.life,a=Math.min(1,t/.18,f.life/.22);ctx.save();ctx.globalAlpha=a;ctx.translate(W*.5,H*.30);
    const rg=ctx.createRadialGradient(0,0,0,0,0,W*(f.major?.38:.30));rg.addColorStop(0,f.major?'rgba(255,224,112,.25)':'rgba(255,255,255,.17)');rg.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=rg;ctx.beginPath();ctx.arc(0,0,W*(f.major?.38:.30),0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=f.major?'rgba(255,218,82,.72)':'rgba(255,255,255,.5)';ctx.lineWidth=Math.max(2,W*.006);ctx.beginPath();ctx.ellipse(0,0,W*(.11+t*.17),H*(.018+t*.020),0,0,Math.PI*2);ctx.stroke();
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=8;ctx.font=`900 ${Math.floor(W*(f.major?.078:.066))}px system-ui,sans-serif`;ctx.lineWidth=Math.max(3,W*.010);ctx.strokeStyle='rgba(67,42,22,.72)';ctx.strokeText(f.m+'m 돌파!',0,0);ctx.fillStyle=f.major?'#ffe16b':'#fff7df';ctx.fillText(f.m+'m 돌파!',0,0);
    ctx.shadowBlur=0;ctx.font=`800 ${Math.floor(W*.030)}px system-ui,sans-serif`;ctx.fillStyle='rgba(255,255,255,.92)';ctx.fillText(f.major?'HALFWAY!':'KEEP JUMPING!',0,H*.052);ctx.restore();}
  // ================= SCREEN SPACE UI =================
  // V63: 첨부 레퍼런스처럼 반원형 타이밍 게이지. 착지 즉시 활성화되고 탭 한 번으로 발사한다.
  if(player.onBoard && G.powerMode){
    // V94: chunky arcade rebound meter inspired by the approved reference.
    const gx=W*.105,gy=Math.min(H*.905,board.y-G.cam+H*.075),gw=W*.79,gh=Math.max(28,W*.078);
    const v=Math.max(0,Math.min(1,G.powerVal)),px=gx+gw*v,r=gh*.5;
    ctx.save();
    if(gaugeFlash>0){const pop=1+gaugeFlash*.045;ctx.translate(W*.5,gy);ctx.scale(pop,pop);ctx.translate(-W*.5,-gy);}
    // shadow + bronze/metal housing
    ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=12;
    const frame=ctx.createLinearGradient(0,gy-gh,0,gy+gh);
    frame.addColorStop(0,'#f4d8a0');frame.addColorStop(.22,'#8b5a32');frame.addColorStop(.55,'#2b2525');frame.addColorStop(.82,'#a87543');frame.addColorStop(1,'#f1d08d');
    ctx.fillStyle=frame;roundRect(ctx,gx-W*.032,gy-gh*.72,gw+W*.064,gh*1.44,r+8);ctx.fill();
    ctx.shadowBlur=0;ctx.fillStyle='#171a20';roundRect(ctx,gx-W*.012,gy-gh*.51,gw+W*.024,gh*1.02,r);ctx.fill();
    // colored track
    ctx.save();roundRect(ctx,gx,gy-gh*.34,gw,gh*.68,gh*.30);ctx.clip();
    const grad=ctx.createLinearGradient(gx,0,gx+gw,0);
    grad.addColorStop(0,'#7d35b5');grad.addColorStop(.10,'#e74c3c');grad.addColorStop(.28,'#f39c32');
    grad.addColorStop(.345,'#58d66b');grad.addColorStop(.45,'#ffe34e');grad.addColorStop(.50,'#fff7b0');
    grad.addColorStop(.55,'#ffe34e');grad.addColorStop(.655,'#58d66b');grad.addColorStop(.72,'#f39c32');
    grad.addColorStop(.90,'#e74c3c');grad.addColorStop(1,'#7d35b5');
    ctx.fillStyle=grad;ctx.fillRect(gx,gy-gh*.34,gw,gh*.68);
    // inner shine
    const shine=ctx.createLinearGradient(0,gy-gh*.34,0,gy+gh*.34);shine.addColorStop(0,'rgba(255,255,255,.42)');shine.addColorStop(.5,'rgba(255,255,255,0)');shine.addColorStop(1,'rgba(0,0,0,.24)');
    ctx.fillStyle=shine;ctx.fillRect(gx,gy-gh*.34,gw,gh*.68);ctx.restore();
    // center target beam
    ctx.shadowColor='#ffd94a';ctx.shadowBlur=18;ctx.strokeStyle='#fff7c0';ctx.lineWidth=Math.max(4,W*.010);
    ctx.beginPath();ctx.moveTo(gx+gw*.5,gy-gh*.66);ctx.lineTo(gx+gw*.5,gy+gh*.66);ctx.stroke();
    // pointer
    ctx.shadowColor='#6ee7ff';ctx.shadowBlur=15;ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(3,W*.008);
    ctx.beginPath();ctx.moveTo(px,gy-gh*.50);ctx.lineTo(px,gy+gh*.50);ctx.stroke();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(px,gy-gh*.67);ctx.lineTo(px-W*.018,gy-gh*.48);ctx.lineTo(px+W*.018,gy-gh*.48);ctx.closePath();ctx.fill();
    ctx.restore();
  }
  drawJudgeFx();
  ctx.textAlign='center';ctx.font='900 20px sans-serif';
  // V95 landing impact FX.
  for(const f of landingImpactFX){
    const t=1-f.life,p=f.power;ctx.save();ctx.globalAlpha=Math.max(0,f.life)*.72;ctx.strokeStyle='#fff3cf';ctx.lineWidth=Math.max(2,W*.010*f.life);ctx.shadowColor='rgba(255,220,150,.7)';ctx.shadowBlur=10;
    ctx.beginPath();ctx.ellipse(f.x,f.y,W*(.045+t*.20)*p,H*(.008+t*.018),0,0,Math.PI*2);ctx.stroke();
    ctx.globalAlpha=Math.max(0,f.life)*.35;ctx.strokeStyle='#d8c5a4';ctx.lineWidth=Math.max(1,W*.006*f.life);ctx.beginPath();ctx.ellipse(f.x,f.y,W*(.025+t*.13)*p,H*(.004+t*.010),0,0,Math.PI*2);ctx.stroke();
    ctx.globalAlpha=Math.max(0,f.life)*.72;ctx.strokeStyle='#fff8df';ctx.lineWidth=Math.max(2,W*.006*f.life);
    for(let i=0;i<7;i++){const a=Math.PI+(i/6)*Math.PI,ri=W*.035,ro=W*(.065+t*.07)*p;ctx.beginPath();ctx.moveTo(f.x+Math.cos(a)*ri,f.y+Math.sin(a)*ri*.38);ctx.lineTo(f.x+Math.cos(a)*ro,f.y+Math.sin(a)*ro*.38);ctx.stroke();}ctx.restore();
  }
  if(!player.onBoard&&player.vy>0){const d=board.y-(player.y+player.r);if(d>0&&d<H*.20){const a=1-d/(H*.20);ctx.save();ctx.globalAlpha=a*.34;ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(1,W*.004);for(let i=-2;i<=2;i++){const x=player.x+i*player.r*.38;ctx.beginPath();ctx.moveTo(x,player.y-G.cam-player.r*.7);ctx.lineTo(x,player.y-G.cam-player.r*(1.15+a*.65));ctx.stroke();}ctx.restore();}}
  // V94 launch-grade trail: visual feedback only.
  if(!player.onBoard&&launchGradeLife>0){
    const cfg=launchGrade==='PERFECT!'?['#ffd84a',.95,4]:launchGrade==='GOOD'?['#63e6be',.72,3]:launchGrade==='MISS!'?['#c77dff',.48,2]:['#ffad55',.58,2];
    ctx.save();ctx.globalAlpha=launchGradeLife*cfg[1];ctx.strokeStyle=cfg[0];ctx.shadowColor=cfg[0];ctx.shadowBlur=launchGrade==='PERFECT!'?18:9;ctx.lineWidth=W*.012*cfg[2];
    ctx.lineCap='round';ctx.beginPath();ctx.moveTo(player.x,player.y-G.cam+player.r*.45);ctx.quadraticCurveTo(player.x-W*.025,player.y-G.cam+H*.065,player.x-W*.01,player.y-G.cam+H*.13);ctx.stroke();
    if(launchGrade==='PERFECT!'){ctx.globalAlpha=launchGradeLife*.75;for(let i=0;i<4;i++){const a=performance.now()*.004+i*1.57,rr=W*(.035+i*.009);ctx.fillStyle='#fff4a8';ctx.beginPath();ctx.arc(player.x+Math.cos(a)*rr,player.y-G.cam+H*.07+Math.sin(a)*rr*.35,W*.006,0,Math.PI*2);ctx.fill();}}
    ctx.restore();
  }
  // V91 landing timing cue: appears only on final descent.
  if(!player.onBoard&&player.vy>0){
    const d=board.y-(player.y+player.r);
    if(d>0&&d<H*.24){
      const a=Math.max(0,Math.min(1,1-d/(H*.24)));
      ctx.save();ctx.globalAlpha=.35+.65*a;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.font='900 '+Math.round(W*.09)+'px system-ui';ctx.lineWidth=Math.max(4,W*.014);
      ctx.strokeStyle='rgba(91,48,0,.72)';ctx.fillStyle='#fff3a6';
      ctx.strokeText('TAP!',W*.5,H*.52);ctx.fillText('TAP!',W*.5,H*.52);ctx.restore();
    }
  }
  // V89 simple commercial-style bird obstacle.
  for(const b of rocks){
    if(b.kind!=='bird')continue;
    const sy=b.y-G.cam;if(sy<-100||sy>H+100)continue;
    const flap=Math.sin(b.phase)*W*.014;
    ctx.save();ctx.translate(b.x,sy);ctx.scale(b.dir,1);
    ctx.shadowColor='rgba(0,0,0,.18)';ctx.shadowBlur=W*.012;
    ctx.fillStyle='#334b63';
    ctx.beginPath();ctx.ellipse(0,0,b.r*.72,b.r*.40,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#466985';
    ctx.beginPath();ctx.moveTo(-b.r*.15,0);ctx.quadraticCurveTo(-b.r*.65,-b.r*.55-flap,-b.r*.95,-b.r*.18);ctx.quadraticCurveTo(-b.r*.55,-b.r*.08,-b.r*.12,b.r*.10);ctx.fill();
    ctx.beginPath();ctx.moveTo(b.r*.08,0);ctx.quadraticCurveTo(b.r*.48,-b.r*.52+flap,b.r*.72,-b.r*.16);ctx.quadraticCurveTo(b.r*.45,-b.r*.05,b.r*.10,b.r*.12);ctx.fill();
    ctx.fillStyle='#f0b44c';ctx.beginPath();ctx.moveTo(b.r*.65,-b.r*.05);ctx.lineTo(b.r*1.02,b.r*.08);ctx.lineTo(b.r*.65,b.r*.20);ctx.closePath();ctx.fill();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(b.r*.40,-b.r*.13,b.r*.12,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#17212b';ctx.beginPath();ctx.arc(b.r*.43,-b.r*.13,b.r*.055,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  // V88 consecutive PERFECT combo badge — visual only.
  if((G.combo||0)>=2&&comboPulse>0){ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';const sc=1+comboPulse*.18;ctx.translate(W*.5,H*.165);ctx.scale(sc,sc);ctx.globalAlpha=Math.min(1,.65+comboPulse*.35);ctx.font='900 '+Math.round(W*.046)+'px system-ui';ctx.lineWidth=Math.max(3,W*.009);ctx.strokeStyle='rgba(108,58,0,.65)';ctx.fillStyle='#fff2a6';ctx.strokeText('PERFECT ×'+G.combo,0,0);ctx.fillText('PERFECT ×'+G.combo,0,0);ctx.restore();}
  // V86 PERFECT landing impact ring. Purely visual; no jump physics/reward changes.
  for(const f of perfectFX){
    const t=1-f.life,r=W*(.07+t*.24);
    ctx.save();ctx.globalAlpha=Math.max(0,f.life)*.72;ctx.strokeStyle='#fff1a8';ctx.lineWidth=Math.max(2,W*.012*f.life);
    ctx.beginPath();ctx.ellipse(f.x,f.y,r,r*.22,0,0,Math.PI*2);ctx.stroke();
    ctx.globalAlpha=Math.max(0,f.life)*.32;ctx.strokeStyle='#ffd34d';ctx.lineWidth=Math.max(1,W*.006*f.life);
    ctx.beginPath();ctx.ellipse(f.x,f.y,r*.72,r*.14,0,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
  // V85 pickup reward flight: collected icon zips toward HUD.
  for(const f of pickupFly){
    ctx.save();ctx.globalAlpha=Math.min(1,f.life*2.4);
    const sc=.45+.55*f.life;ctx.translate(f.x,f.y);ctx.scale(sc,sc);
    if(f.type==='coin')drawYeopjeon(0,0,W*.028,f.phase);else drawStar(0,0,W*.031,'#ffd23f',f.phase);
    ctx.restore();
  }
  floats.forEach(f=>{ctx.globalAlpha=f.life;ctx.fillStyle=f.col;ctx.fillText(f.txt,f.x,f.y-G.cam);ctx.globalAlpha=1;});

  // V61: 대기형 MAX 파워게이지 제거. 착지 타이밍이 다음 점프 파워를 결정한다.
  ctx.restore();

  drawRegionBanner();
}
function loop(){
  ctx.setTransform(DPR,0,0,DPR,0,0);
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


/* V101 — Equipment shop phase 1. UI/state only; jump physics untouched. */
const KJ_EQUIP={
 shoes:[['flower','날아라 꽃신',0,'최대 점프 높이 +15%'],['wind','바람신',1200,'최대 점프 높이 +22%'],['cloud','구름신',2200,'최대 점프 높이 +30%']],
 suit:[['basic','기본 한복',0,'기본 장비'],['cloudrobe','구름 도포',1500,'PERFECT 보너스 +20%'],['warrior','바람 전사복',2800,'PERFECT 보너스 +30%']],
 charm:[['luck','행운 노리개',0,'공중 조작력 +10%'],['bell','구름 방울',1000,'엽전 획득량 +20%'],['starlight','별빛 노리개',2400,'별 획득량 +25%']]
};
let kjEquip=JSON.parse(localStorage.getItem('kjump_equipment')||'null')||{tab:'shoes',owned:['flower','basic','luck'],equipped:{shoes:'flower',suit:'basic',charm:'luck'}};
function kjSaveEquip(){localStorage.setItem('kjump_equipment',JSON.stringify(kjEquip));}
function kjEnsureShop(){
 if(document.getElementById('kjShop'))return;
 const e=document.createElement('div');e.id='kjShop';
 e.innerHTML=`<section class="kjs"><button class="kjs-x">×</button><div class="kjs-money">🪙 <b id="kjsCoin"></b>　⭐ <b id="kjsStar"></b></div><h2>상점</h2><div class="kjs-tabs"><button data-tab="shoes">👟 신발</button><button data-tab="suit">🥋 의상</button><button data-tab="charm">🧿 노리개</button></div><p class="kjs-copy">장비를 갖추고 더 높은 하늘에 도전!</p><div id="kjsCards" class="kjs-cards"></div><div class="kjs-stat"><b>현재 장비</b><div id="kjsStat"></div></div></section>`;
 document.body.appendChild(e);
 const st=document.createElement('style');st.textContent=`#kjShop{display:none;position:fixed;inset:0;z-index:99999;background:#081522c9;align-items:center;justify-content:center;font-family:system-ui,sans-serif}.kjs{position:relative;width:min(91vw,430px);max-height:88vh;overflow:auto;box-sizing:border-box;padding:18px;background:linear-gradient(#f7dba5,#c98949);border:5px solid #70401f;border-radius:24px;box-shadow:0 16px 45px #0008;color:#4b2b18}.kjs h2{text-align:center;font-size:30px;margin:3px 0 14px}.kjs-x{position:absolute;right:11px;top:10px;width:39px;height:39px;border:0;border-radius:50%;background:#86502d;color:white;font-size:27px}.kjs-money{margin:0 48px 10px;padding:8px;text-align:center;border-radius:18px;background:#253746;color:white}.kjs-tabs{display:flex;gap:6px}.kjs-tabs button{flex:1;padding:11px 2px;border:2px solid #8a572f;border-radius:11px;background:#edd1a0;font-weight:900;color:#56321d}.kjs-tabs button.on{background:#ffbd35}.kjs-copy{text-align:center;font-weight:800}.kjs-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.kjs-card{min-height:154px;padding:9px 5px;box-sizing:border-box;text-align:center;background:#fff0cc;border:2px solid #99683d;border-radius:13px}.kjs-card.eq{outline:4px solid #3fa75c}.kjs-icon{font-size:35px}.kjs-name{font-size:13px;font-weight:900;min-height:38px}.kjs-bonus{min-height:31px;font-size:11px;font-weight:800;color:#248449}.kjs-card button{width:100%;padding:8px 1px;border:0;border-radius:8px;background:#e9a52d;color:white;font-weight:900}.kjs-card.eq button{background:#3ca15a}.kjs-stat{margin-top:13px;padding:12px;border-radius:13px;background:#57331f;color:#fff1cf}.kjs-stat div{margin-top:6px;font-size:12px;line-height:1.55}`;
 document.head.appendChild(st);
 e.querySelector('.kjs-x').onclick=()=>e.style.display='none';
 e.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{kjEquip.tab=b.dataset.tab;kjSaveEquip();kjRenderShop();});
}
function kjRenderShop(){
 kjEnsureShop();const e=document.getElementById('kjShop'),tab=kjEquip.tab||'shoes',icons={shoes:'👟',suit:'🥋',charm:'🧿'};
 document.getElementById('kjsCoin').textContent=+(localStorage.getItem('kjump_coin')||0);document.getElementById('kjsStar').textContent=(G&&G.star)||0;
 e.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
 document.getElementById('kjsCards').innerHTML=KJ_EQUIP[tab].map(x=>{const own=kjEquip.owned.includes(x[0]),eq=kjEquip.equipped[tab]===x[0];return `<div class="kjs-card ${eq?'eq':''}"><div class="kjs-icon">${icons[tab]}</div><div class="kjs-name">${x[1]}<br>Lv.1</div><div class="kjs-bonus">${x[3]}</div><button data-buy="${x[0]}">${eq?'장착중':own?'장착':`🪙 ${x[2]}`}</button></div>`}).join('');
 e.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{const x=KJ_EQUIP[tab].find(v=>v[0]===b.dataset.buy);if(!kjEquip.owned.includes(x[0])){let c=+(localStorage.getItem('kjump_coin')||0);if(c<x[2]){b.textContent='엽전 부족';return;}localStorage.setItem('kjump_coin',c-x[2]);kjEquip.owned.push(x[0]);}kjEquip.equipped[tab]=x[0];kjSaveEquip();kjRenderShop();});
 const lines=['shoes','suit','charm'].map(k=>KJ_EQUIP[k].find(x=>x[0]===kjEquip.equipped[k])).filter(Boolean).map(x=>`${x[1]} · ${x[3]}`);
 document.getElementById('kjsStat').innerHTML=lines.join('<br>');
}
function openEquipShop(){kjEnsureShop();kjRenderShop();document.getElementById('kjShop').style.display='flex';}
window.openEquipShop=openEquipShop;


function kjInstallShopButton(){
 if(document.getElementById('kjShopBtn'))return;
 const b=document.createElement('button');b.id='kjShopBtn';b.type='button';b.innerHTML='🛍️<span>상점</span>';
 b.onclick=()=>openEquipShop();
 const st=document.createElement('style');st.textContent=`#kjShopBtn{position:fixed;z-index:8500;left:18px;bottom:max(18px,env(safe-area-inset-bottom));border:3px solid #70401f;border-radius:18px;background:linear-gradient(#ffd36a,#d98b27);color:#563019;box-shadow:0 5px 12px #0005;padding:8px 13px;font-size:23px;font-weight:900}#kjShopBtn span{display:block;font-size:11px;line-height:1}`;
 document.head.appendChild(st);document.body.appendChild(b);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',kjInstallShopButton);else kjInstallShopButton();

/* V103 one-time test wallet */
if(!localStorage.getItem('kjump_v103_test_wallet')){const c=+(localStorage.getItem('kjump_coin')||0);localStorage.setItem('kjump_coin',Math.max(c,20000));localStorage.setItem('kjump_v103_test_wallet','1');}
