// A center obstacle excites both temples. Side returns remain independent.
export function computeTempleHaptics(distances, fresh=true) {
  const channel=side=>{
    const readings=fresh?[distances?.[side],distances?.center].filter(d=>typeof d==='number' && Number.isFinite(d) && d>=.02 && d<=10):[];
    if(!readings.length)return {level:'unknown',distance:null,intensity:0,pulseMs:0};
    const distance=Math.min(...readings),level=distance<.7?'danger':distance<1.5?'warning':'clear';
    return {level,distance,intensity:level==='danger'?.75+.25*(1-distance/.7):level==='warning'?.25+.35*(1.5-distance)/.8:0,pulseMs:level==='danger'?180:level==='warning'?600:0};
  };
  return {left:channel('left'),right:channel('right')};
}
