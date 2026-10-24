// Reuse the live panels and their event handlers; never start a second simulation.
export function setupImmersiveMode() {
  const entry=document.getElementById('immersive-enter');
  const stage=document.getElementById('immersive-stage');
  const rail=document.getElementById('immersive-rail');
  const exit=document.getElementById('immersive-exit');
  const placements=[];
  const background=[document.querySelector('main'),document.querySelector('.topbar')];
  let active=false,nativeFullscreen=false,scrollY=0;
  function move(element,parent) {
    const marker=document.createComment('studio panel position');
    element.before(marker);placements.push({element,marker});parent.append(element);
  }
  async function leave() {
    if(!active)return;
    active=false;
    if(document.pointerLockElement)document.exitPointerLock();
    for(const {element,marker} of placements.splice(0)){marker.replaceWith(element);}
    document.body.classList.remove('immersive');stage.hidden=true;
    background.forEach(element=>{element.inert=false;});
    document.dispatchEvent(new CustomEvent('immersivechange',{detail:{active:false}}));
    entry.setAttribute('aria-expanded','false');
    if(nativeFullscreen && document.fullscreenElement){try{await document.exitFullscreen();}catch{}}
    nativeFullscreen=false;window.scrollTo(0,scrollY);entry.focus({preventScroll:true});
  }
  entry.onclick=async()=>{
    if(active)return;
    active=true;scrollY=window.scrollY;stage.hidden=false;
    move(document.querySelector('.camera-panel'),stage);
    move(document.querySelector('.world'),stage);
    move(document.getElementById('device'),rail);
    move(document.getElementById('assistant'),rail);
    move(document.querySelector('.walk-controls'),document.getElementById('immersive-movement'));
    document.body.classList.add('immersive');entry.setAttribute('aria-expanded','true');
    background.forEach(element=>{element.inert=true;});
    document.dispatchEvent(new CustomEvent('immersivechange',{detail:{active:true}}));
    exit.focus({preventScroll:true});
    // Embedded browsers may deny native fullscreen; the viewport layout still works.
    try{if(document.fullscreenEnabled && !document.fullscreenElement){await document.documentElement.requestFullscreen();nativeFullscreen=true;}}catch{}
  };
  exit.onclick=leave;
  document.addEventListener('fullscreenchange',()=>{if(active && nativeFullscreen && !document.fullscreenElement)leave();});
  document.addEventListener('keydown',event=>{if(active && event.key==='Escape'){event.preventDefault();leave();}});
}
