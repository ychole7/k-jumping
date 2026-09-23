
(function(){
 function syncBoardWood(){
  const b=document.querySelector('#board'); const o=document.querySelector('#boardWoodOverlay');
  if(!b||!o)return;
  const r=b.getBoundingClientRect(),p=o.querySelector('.plank');
  const w=r.width,h=Math.max(28,r.height+8);
  o.style.left=(r.left+r.width/2)+'px';o.style.top=(r.top+r.height/2)+'px';
  p.style.width=w+'px';p.style.height=h+'px';p.style.left=(-w/2)+'px';p.style.top=(-h/2)+'px';
  const tr=getComputedStyle(b).transform;p.style.transform=tr&&tr!=='none'?tr:'rotate(0deg)';
 }
 window.addEventListener('resize',syncBoardWood);window.addEventListener('orientationchange',syncBoardWood);
 setInterval(syncBoardWood,150);setTimeout(syncBoardWood,250);
})();
