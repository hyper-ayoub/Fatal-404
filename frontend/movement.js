// Horizontal capsule approximated by a circle against solid axis-aligned footprints.
// Shared by the simulator and meaningful collision tests; sliding is resolved per axis.
export function canOccupy(x,z,boxes,radius=.24) {
  if(Math.abs(x)>39 || z < -43 || z>34)return false;
  return !boxes.some(box=>{
    const dx=x-Math.max(box.minX,Math.min(x,box.maxX));
    const dz=z-Math.max(box.minZ,Math.min(z,box.maxZ));
    return dx*dx+dz*dz<radius*radius;
  });
}
export function moveWithCollisions(position,dx,dz,boxes,radius=.24) {
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.12));
  for(let i=0;i<steps;i++){
    if(canOccupy(position.x+dx/steps,position.z,boxes,radius))position.x+=dx/steps;
    if(canOccupy(position.x,position.z+dz/steps,boxes,radius))position.z+=dz/steps;
  }
  return position;
}
