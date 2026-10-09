/* 灯の旅路 — original faceted coastal scenery. Canvas2D projection of 3D vertices.
   New independent game, no inherited GUILD∞ renderer or proprietary assets. */
(()=>{'use strict';
const PAL={sky:'#eee1c5',skyShade:'#bbc6cd',distant:'#969da9',sea:'#648f97',seaDeep:'#496f82',seaHi:'#a9c9bd',land:'#a2aa78',landHi:'#bcc18b',landShade:'#858e64',stone:'#cbbd99',stoneHi:'#e9d9b6',stoneShade:'#938c79',stoneDeep:'#6d726c',slate:'#677d89',slateHi:'#9aa4a6',slateDeep:'#495a69',wood:'#906b4d',woodHi:'#bd9564',woodDeep:'#624938',copper:'#b88c56',copperShade:'#806746',leaf:'#788c5c',leafHi:'#a1ad76',leafDeep:'#506c54',ink:'#3d4b51',paper:'#f5e1ad',warm:'#edbc76',violet:'#77768c'};
const bounds=Object.freeze({minX:-360,maxX:360,minY:-300,maxY:300});
const landmarks=[
{id:'guild',name:'潮鐘の修道院',x:-55,y:7,footprint:[[-137,-139],[31,-139],[31,-37],[-33,-37],[-33,-14],[-77,-14],[-77,-37],[-137,-37]]},
{id:'forest',name:'風見の峠',x:139,y:-171,footprint:[[103,-216],[114,-216],[114,-186],[103,-186]]},
{id:'workshop',name:'修繕工房',x:-205,y:107,footprint:[[-240,37],[-166,37],[-166,87],[-240,87]]},
{id:'quest',name:'旅人の掲示板',x:-7,y:101,footprint:[[-23,78],[11,78],[11,85],[-23,85]]},
{id:'fountain',name:'潮待ちの泉',x:49,y:154,footprint:[[18,104],[35,88],[63,88],[80,104],[80,135],[64,149],[35,149],[18,135]]},
{id:'dock',name:'古い船着き場',x:180,y:212,footprint:[]}
];
const trunkData=[[-300,-226,91],[-251,-257,71],[-186,-251,89],[-104,-277,66],[8,-267,94],[72,-237,86],[196,-271,94],[246,-223,86],[309,-172,102],[296,-75,82],[325,33,73],[277,103,62],[-316,-117,92],[-318,-5,72],[-294,109,79],[-242,172,64],[-166,196,57],[111,-138,51],[204,-167,54],[251,-100,71]];
const coast=[[-390,177],[-278,191],[-218,203],[-134,190],[-74,207],[0,182],[78,194],[128,210],[207,186],[290,212],[390,187]];
const point=(x,y,h=0)=>({x,y,h});
function viewOf(v={}){const camera=v.camera||{};return{width:v.width||390,height:v.height||650,camera:{x:camera.x||0,y:camera.y||0,zoom:camera.zoom||.9}}}
function project(p,v){v=viewOf(v);const {camera:k}=v,dx=p.x-k.x,dy=p.y-k.y;return{x:v.width/2+(dx+.28*dy)*k.zoom,y:v.height*.46+(.62*dy-(p.h||p.height||0))*k.zoom}}
function unproject(p,v){v=viewOf(v);const k=v.camera,y=k.y+(p.y-v.height*.46)/(.62*k.zoom);return{x:k.x+(p.x-v.width/2)/k.zoom-.28*(y-k.y),y}}
function hash(a,b=0){let v=Math.imul(a|0,374761393)^Math.imul(b|0,668265263);v=Math.imul(v^(v>>>13),1274126177);return((v^(v>>>16))>>>0)/4294967295}
function tint(hex,n){return'#'+[1,3,5].map(i=>Math.max(0,Math.min(255,parseInt(hex.slice(i,i+2),16)+n)).toString(16).padStart(2,'0')).join('')}
function polygon(c,vertices,k){c.fillStyle=k;c.beginPath();vertices.forEach((p,i)=>i?c.lineTo(Math.round(p.x),Math.round(p.y)):c.moveTo(Math.round(p.x),Math.round(p.y)));c.closePath();c.fill()}
function face(c,v,vertices,k){polygon(c,vertices.map(p=>project(p,v)),k)}
function line(c,v,a,b,k,width=1){const p=project(a,v),q=project(b,v);c.strokeStyle=k;c.lineWidth=width;c.beginPath();c.moveTo(Math.round(p.x)+.5,Math.round(p.y)+.5);c.lineTo(Math.round(q.x)+.5,Math.round(q.y)+.5);c.stroke()}
function rect(c,x,y,w,h,k){c.fillStyle=k;c.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)))}
function dot(c,v,x,y,h,k,size=1){const p=project(point(x,y,h),v);rect(c,p.x,p.y,size,size,k)}
function groundPoly(c,v,a,k,h=0){face(c,v,a.map(p=>point(p[0],p[1],h)),k)}
function inside(x,y,p){let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const[a,b]=p[i],[d,e]=p[j];if((b>y)!==(e>y)&&x<(d-a)*(y-b)/(e-b)+a)hit=!hit}return hit}
function shoreY(x){for(let i=0;i<coast.length-1;i++){const[a,b]=coast[i],[d,e]=coast[i+1];if(x>=a&&x<=d)return b+(e-b)*(x-a)/(d-a)}return 190}
function isBlocked(x,y){if(x<bounds.minX||x>bounds.maxX||y<bounds.minY||y>bounds.maxY)return true;const onDock=x>159&&x<207&&y>182&&y<293;if(y>shoreY(x)-2&&!onDock)return true;if(landmarks.some(m=>m.footprint.length&&inside(x,y,m.footprint)))return true;if(x>160&&x<173&&y>-218&&y<-187)return true;return trunkData.some(([a,b])=>Math.hypot(x-a,(y-b)*1.2)<11)}
function getLandmarks(){return landmarks.map(m=>({...m,footprint:m.footprint.map(p=>p.slice())}))}
function shadow(c,v,x,y,w,d,height=0){groundPoly(c,v,[[x-w/2,y-d/2],[x+w/2,y-d/2],[x+w/2+height*.4,y+d/2+height*.36],[x-w/2+height*.4,y+d/2+height*.36]],'#535b5924');groundPoly(c,v,[[x-w*.46,y-d*.4],[x+w*.46,y-d*.4],[x+w*.46+10,y+d*.4+7],[x-w*.46+10,y+d*.4+7]],'#3f554322')}
function block(c,v,x,y,w,d,h,material=PAL.stone,base=0){const X=x-w/2,Y=y-d/2;face(c,v,[point(X,Y+d,base),point(X+w,Y+d,base),point(X+w,Y+d,h+base),point(X,Y+d,h+base)],material);face(c,v,[point(X+w,Y,base),point(X+w,Y+d,base),point(X+w,Y+d,h+base),point(X+w,Y,h+base)],tint(material,-29));face(c,v,[point(X,Y,h+base),point(X+w,Y,h+base),point(X+w,Y+d,h+base),point(X,Y+d,h+base)],tint(material,18))}
function brickwork(c,v,x,y,w,d,h,base=0){for(let hh=base+5;hh<h+base;hh+=8){line(c,v,point(x-w/2,y+d/2,hh),point(x+w/2,y+d/2,hh),'#887e654d');line(c,v,point(x+w/2,y-d/2,hh),point(x+w/2,y+d/2,hh),'#62665760');for(let xx=-w/2;xx<w/2;xx+=15){let a=x+xx+(Math.floor(hh/8)%2?7:0);if(a<x+w/2)line(c,v,point(a,y+d/2,hh),point(a,y+d/2,Math.min(h+base,hh+8)),'#92876c66')}}}
function gableRoof(c,v,x,y,w,d,h,r,color=PAL.slate,axis='x'){
 if(axis==='y'){
 face(c,v,[point(x-w/2,y-d/2,h),point(x,y-d/2,h+r),point(x,y+d/2,h+r),point(x-w/2,y+d/2,h)],tint(color,12));
 face(c,v,[point(x,y-d/2,h+r),point(x+w/2,y-d/2,h),point(x+w/2,y+d/2,h),point(x,y+d/2,h+r)],tint(color,-12));
 face(c,v,[point(x-w/2,y+d/2,h),point(x+w/2,y+d/2,h),point(x,y+d/2,h+r)],PAL.stoneHi);
 line(c,v,point(x,y-d/2,h+r+1),point(x,y+d/2,h+r+1),PAL.slateHi,2);
 for(let t=.12;t<1;t+=.15)for(let q of[-1,1]){const xx=x+q*w/2*t,hh=h+r*(1-t);line(c,v,point(xx,y-d/2,hh),point(xx,y+d/2,hh),q===-1?'#c5cbc17a':'#354b6666')}
 return}
 face(c,v,[point(x-w/2,y-d/2,h),point(x+w/2,y-d/2,h),point(x+w/2,y,h+r),point(x-w/2,y,h+r)],tint(color,-19));
 face(c,v,[point(x-w/2,y,h+r),point(x+w/2,y,h+r),point(x+w/2,y+d/2,h),point(x-w/2,y+d/2,h)],color);
 face(c,v,[point(x+w/2,y-d/2,h),point(x+w/2,y+d/2,h),point(x+w/2,y,h+r)],PAL.stoneShade);
 for(let t=.08;t<1;t+=.13){const yy=y+t*d/2,hh=h+r*(1-t);line(c,v,point(x-w/2,yy,hh),point(x+w/2,yy,hh),PAL.slateHi);for(let xx=-w/2;xx<w/2;xx+=11){const off=Math.floor(t*10)%2?5:0;line(c,v,point(x+xx+off,yy,hh),point(x+xx+off,yy+d*.065,hh-r*.13),'#43586c80')}}
 line(c,v,point(x-w/2,y,h+r),point(x+w/2,y,h+r),tint(color,42),2);line(c,v,point(x-w/2,y+d/2,h),point(x+w/2,y+d/2,h),PAL.slateDeep,2)
}
function frontWindow(c,v,x,y,h,w=15,height=24,lit=true,broken=false){face(c,v,[point(x-w/2-3,y,h-3),point(x+w/2+3,y,h-3),point(x+w/2+3,y,h+height+3),point(x-w/2-3,y,h+height+3)],PAL.stoneDeep);
face(c,v,[point(x-w/2,y+.3,h),point(x+w/2,y+.3,h),point(x+w/2,y+.3,h+height),point(x-w/2,y+.3,h+height)],lit?'#e9c38b':'#6f8d91');line(c,v,point(x,y+1,h),point(x,y+1,h+height),PAL.woodDeep);line(c,v,point(x-w/2,y+1,h+height*.5),point(x+w/2,y+1,h+height*.5),PAL.woodDeep);line(c,v,point(x-w/2,y+2,h+height),point(x+w/2,y+2,h+height),'#efd7a7');if(broken){line(c,v,point(x-w/2-1,y+3,h+5),point(x+w/2+1,y+3,h+height-4),PAL.wood,2);line(c,v,point(x-w/2-1,y+3,h+height-4),point(x+w/2+1,y+3,h+5),PAL.wood,2)}}
function flag(c,v,x,y,h,time,color=PAL.copper,w=16){line(c,v,point(x,y,h-27),point(x,y,h+4),PAL.woodDeep);const f=Math.sin(time*.0018+x)*3;face(c,v,[point(x,y,h),point(x+w,y+f,h-3),point(x+w-3,y+f,h-17),point(x,y,h-16)],color);line(c,v,point(x+1,y+.5,h-1),point(x+w-1,y+f,h-4),tint(color,38));dot(c,v,x+6,y+1,h-7,PAL.paper,2)}
function lantern(c,v,x,y,h,time=0){block(c,v,x,y,5,5,9,PAL.woodDeep,h);block(c,v,x,y,3,3,5,PAL.warm,h+2);const p=project(point(x,y,h+5),v);rect(c,p.x-1,p.y,2,3,'#ffe5a6');line(c,v,point(x,y,h+9),point(x,y,h+14),PAL.woodDeep)}
function chimney(c,v,x,y,h,time){block(c,v,x,y,15,18,28,PAL.stoneShade,h);brickwork(c,v,x,y,15,18,27,h);block(c,v,x,y,18,21,3,PAL.stoneHi,h+28);face(c,v,[point(x-6,y-5,h+31),point(x+6,y-5,h+31),point(x+6,y+5,h+31),point(x-6,y+5,h+31)],'#5e635e');for(let i=0;i<4;i++){const phase=(time*.007+i*11)%46,p=project(point(x+phase*.15,y,h+35+phase),v);polygon(c,[{x:p.x-2,y:p.y+3},{x:p.x-4,y:p.y-1},{x:p.x,y:p.y-5},{x:p.x+4,y:p.y-2},{x:p.x+3,y:p.y+3}],'#b9b6a332')}}
function abbey(c,v,level,time){const x=-55,y=-87,w=157,d=97,wall=82;shadow(c,v,x,y,w,d,142);
 // The taller east bell tower is truly separate 3D geometry.
 const tx=x+67,ty=y-19;block(c,v,tx,ty,38,41,153,PAL.stoneShade);brickwork(c,v,tx,ty,38,41,153);block(c,v,tx,ty,43,46,5,PAL.stone,119);block(c,v,tx,ty,43,46,5,PAL.stoneHi,147);
 frontWindow(c,v,tx,ty+21,124,16,17,false,level===0);gableRoof(c,v,tx,ty,49,50,155,28,PAL.slateDeep,'y');line(c,v,point(tx,ty,182),point(tx,ty,196),PAL.copperShade);line(c,v,point(tx-5,ty,189),point(tx+5,ty,189),PAL.copperShade);
 // Brass bell hangs behind the tower opening after its second repair.
 if(level>=2){const bp=project(point(tx,ty+22,137+Math.sin(time*.0012)*.35),v);polygon(c,[{x:bp.x-5,y:bp.y-8},{x:bp.x+3,y:bp.y-8},{x:bp.x+4,y:bp.y-2},{x:bp.x+7,y:bp.y+1},{x:bp.x-8,y:bp.y+1},{x:bp.x-5,y:bp.y-2}],PAL.copper);rect(c,bp.x-5,bp.y-7,2,5,PAL.paper);rect(c,bp.x-1,bp.y+2,2,2,PAL.copperShade)}
 block(c,v,x,y,w,d,12,PAL.stoneDeep);block(c,v,x,y,w,d,wall-12,PAL.stone,12);brickwork(c,v,x,y,w,d,wall);block(c,v,x,y,w+4,d+4,3,PAL.stoneHi,wall-4);
 const front=y+d/2;for(let a of[-55,-24,24,55])frontWindow(c,v,x+a,front+1,31,15,28,level>=1,level===0&&Math.abs(a)===55);
 for(let a of[-68,68]){block(c,v,x+a,front+2,6,7,71,PAL.stoneHi,8);block(c,v,x+a,front+2,9,10,4,PAL.stone,77)}
 // Exposed oak braces and chipped limestone details remain individual1pxmarks.
 for(let hh=16;hh<78;hh+=18)for(let xx=-72;xx<72;xx+=22){if(hash(xx,hh)>.55)line(c,v,point(x+xx,front+1,hh),point(x+xx+5,front+1,hh+1),'#efdbac55')}
 gableRoof(c,v,x-1,y,w+19,d+14,wall+3,42);
 chimney(c,v,x-44,y-24,106,time);
 // Intersecting axial portico, not a second flat roof painted on the facade.
 block(c,v,x,front+8,44,33,57,PAL.stoneHi);brickwork(c,v,x,front+8,44,33,57);gableRoof(c,v,x,front+6,54,40,59,27,PAL.slate,'y');
 const dy=front+25;face(c,v,[point(x-10,dy,7),point(x+10,dy,7),point(x+10,dy,39),point(x+6,dy,46),point(x-6,dy,46),point(x-10,dy,39)],PAL.woodDeep);for(let a=-7;a<10;a+=4)line(c,v,point(x+a,dy+1,8),point(x+a,dy+1,40),PAL.wood);dot(c,v,x+5,dy+2,23,PAL.copper,2);
 for(let i=0;i<4;i++){let sw=35+i*5;if(level===0&&i===3)sw=24;block(c,v,x+(level===0&&i===3?-4:0),dy+4+i*6,sw,7,9-i*2,PAL.stone,0)}
 lantern(c,v,x-23,dy,40,time);lantern(c,v,x+23,dy,40,time);
 const crest=project(point(x,front+27,74),v);polygon(c,[{x:crest.x,y:crest.y-7},{x:crest.x+5,y:crest.y-4},{x:crest.x+4,y:crest.y+3},{x:crest.x,y:crest.y+6},{x:crest.x-4,y:crest.y+3},{x:crest.x-5,y:crest.y-4}],PAL.copperShade);rect(c,crest.x-1,crest.y-3,2,6,PAL.paper);
 // Sparse ivy follows the wall's actual front plane.
 for(let i=0;i<27;i++){const xx=x-71+hash(i,53)*14,hh=7+hash(i,57)*59;dot(c,v,xx,front+3,hh,i%3?'#7c915f':'#a0ac72',1+hash(i,41)*2)}
 if(level>=1){block(c,v,x-75,front+24,23,16,5,PAL.stoneShade);for(let i=0;i<12;i++)dot(c,v,x-83+hash(i,21)*18,front+20+hash(i,7)*7,9+hash(i,11)*6,i%3?'#a58b9b':'#c0bc89',2)}
 if(level>=3){flag(c,v,tx-17,ty+18,161,time,'#9a706a',16);flag(c,v,x-68,front+5,70,time,'#7f819e',10);line(c,v,point(x-76,front,81),point(x+77,front,81),PAL.copper,1)}
 if(level===0){for(let a of[-17,17])line(c,v,point(x+a,dy+35,0),point(x+a,dy+35,41),PAL.wood,2);for(let hh of[10,25,39])line(c,v,point(x-20,dy+35,hh),point(x+20,dy+35,hh),PAL.wood,2);line(c,v,point(x-20,dy+35,10),point(x+20,dy+35,39),PAL.woodHi)}
}
function rock(c,v,x,y,w=25,h=15,seed=0){shadow(c,v,x,y,w,w*.65,h);const a=[point(x-w*.6,y,h*.2),point(x-w*.32,y-w*.3,h*.8),point(x+w*.1,y-w*.3,h),point(x+w*.52,y,h*.5),point(x+w*.4,y+w*.28,0),point(x-w*.5,y+w*.25,0)],mid=point(x,y,h*.67);face(c,v,[a[0],a[1],mid,a[5]],'#b5b49a');face(c,v,[a[1],a[2],a[3],mid],'#d0c7a7');face(c,v,[mid,a[3],a[4],a[5]],'#818e83');line(c,v,a[1],mid,'#e5d6b3');dot(c,v,x-3,y,4,'#708957',2)}
function tree(c,v,x,y,h=80,seed=0,time=0){shadow(c,v,x,y,34,26,h);block(c,v,x,y,5,6,h*.63,PAL.woodDeep);const sway=Math.sin(time*.00065+seed)*1.1;
 // Irregular crown is a small3Dmesh made of separately lit triangular faces.
 for(let tier=0;tier<3;tier++){const radius=23-tier*5,base=h*.29+tier*h*.19,apex=point(x+sway,y-3,base+34),ring=[];for(let i=0;i<7;i++){const ang=i/7*Math.PI*2,r=radius*(.88+hash(seed*9+i,tier)*.3);ring.push(point(x+Math.cos(ang)*r,y+Math.sin(ang)*r*.85,base+hash(i,seed)*5))}
 const faces=[];for(let i=0;i<7;i++)faces.push({verts:[ring[i],ring[(i+1)%7],apex],sort:(ring[i].y+ring[(i+1)%7].y)/2,k:[PAL.leaf,PAL.leafDeep,'#687e5b',PAL.leafHi,'#8e9f6b','#72875f','#526e55'][i]});faces.sort((a,b)=>a.sort-b.sort).forEach(f=>face(c,v,f.verts,f.k));for(let i=1;i<6;i+=2){const q=ring[i];line(c,v,point(q.x*.9+x*.1,q.y,base+8),point((q.x+x)/2,(q.y+y)/2,base+18),'#bcc18b66')}}
}
function gateway(c,v,time){const x=140,y=-201;for(let dx of[-32,32]){block(c,v,x+dx,y,11,23,62,PAL.stoneShade);brickwork(c,v,x+dx,y,11,23,62);block(c,v,x+dx,y,15,27,4,PAL.stoneHi,60);lantern(c,v,x+dx,y+13,36,time)}block(c,v,x,y,78,14,8,PAL.woodDeep,62);line(c,v,point(x-37,y+8,65),point(x+37,y+8,65),PAL.woodHi,2);flag(c,v,x-29,y-3,76,time,'#9d7162',20);const p=project(point(x,y+9,67),v);rect(c,p.x-10,p.y-2,20,7,PAL.wood);rect(c,p.x-8,p.y,7,1,PAL.paper);rect(c,p.x+3,p.y,5,1,PAL.paper)}
function workshop(c,v,time){const x=-203,y=62;shadow(c,v,x,y,75,49,61);block(c,v,x,y,74,49,6,PAL.stoneShade);block(c,v,x,y-17,74,12,42,PAL.wood);for(let dx of[-33,33])block(c,v,x+dx,y+22,4,5,42,PAL.woodDeep);gableRoof(c,v,x,y,84,64,43,17,PAL.slateDeep,'x');block(c,v,x-6,y+7,35,14,20,PAL.woodDeep);block(c,v,x-6,y+7,38,18,3,PAL.woodHi,20);for(let i=0;i<5;i++){block(c,v,x-30+i*9,y+15,5,8,4,i%2?PAL.stoneShade:PAL.wood,23)}line(c,v,point(x-19,y+17,28),point(x-2,y+17,28),PAL.stoneHi,2);lantern(c,v,x+30,y+23,29,time);barrel(c,v,x+45,y+14);barrel(c,v,x+41,y-1)}
function barrel(c,v,x,y){block(c,v,x,y,15,15,19,PAL.wood);for(let h of[4,15]){line(c,v,point(x-8,y+8,h),point(x+8,y+8,h),PAL.stoneDeep,2);line(c,v,point(x+8,y-8,h),point(x+8,y+8,h),PAL.stoneDeep,2)}for(let a=-4;a<8;a+=5)line(c,v,point(x+a,y+8,3),point(x+a,y+8,18),PAL.woodHi)}
function board(c,v){const x=-6,y=82;for(let dx of[-14,14])block(c,v,x+dx,y,3,4,31,PAL.woodDeep);face(c,v,[point(x-19,y+2,12),point(x+19,y+2,12),point(x+19,y+2,34),point(x-19,y+2,34)],PAL.wood);gableRoof(c,v,x,y,45,13,35,7,PAL.slateDeep);for(let i=0;i<3;i++){let xx=x-14+i*11;face(c,v,[point(xx,y+3,17),point(xx+8,y+3,17),point(xx+8,y+3,29-i%2*2),point(xx,y+3,29-i%2*2)],PAL.paper);line(c,v,point(xx+2,y+4,25),point(xx+6,y+4,25),PAL.wood);dot(c,v,xx+5,y+4,19,'#a66c54',2)}}
function octagon(x,y,r){return Array.from({length:8},(_,i)=>[x+Math.cos(Math.PI/8+i*Math.PI/4)*r,y+Math.sin(Math.PI/8+i*Math.PI/4)*r])}
function fountain(c,v,time){const x=49,y=120,out=octagon(x,y,33),inner=octagon(x,y,25);shadow(c,v,x,y,68,59,28);for(let i=0;i<8;i++){const j=(i+1)%8;face(c,v,[point(...out[i],0),point(...out[j],0),point(...out[j],12),point(...out[i],12)],i<4?PAL.stoneShade:PAL.stone)}groundPoly(c,v,out,PAL.stoneHi,12);groundPoly(c,v,inner,PAL.sea,13);for(let i=0;i<8;i++)face(c,v,[point(x,y,13),point(...inner[i],13),point(...inner[(i+1)%8],13)],i%2?'#88aaa2':'#759b9c');block(c,v,x,y,11,11,33,PAL.stoneShade,12);block(c,v,x,y,18,18,4,PAL.stoneHi,43);for(let i=0;i<10;i++){const t=((time*.0025+i*.13)%1),a=i*Math.PI*.73;dot(c,v,x+Math.cos(a)*18*t,y+Math.sin(a)*18*t,44-31*t,PAL.seaHi,1)}for(let i=0;i<4;i++){let t=(time*.00035+i*.24)%1;line(c,v,point(x-21+t*4,y+13-i*7,14),point(x-11+t*4,y+13-i*7,14),'#d6ded08c')}}
function dock(c,v,time){const x=184,y=242;shadow(c,v,x,y,44,112,8);block(c,v,x,y,44,112,6,PAL.woodDeep);for(let yy=y-55;yy<y+55;yy+=8){block(c,v,x,yy,44,7,3,PAL.wood,6);line(c,v,point(x-20,yy,10),point(x+20,yy,10),'#d7b47d66');for(let a of[-17,17])dot(c,v,x+a,yy,10,PAL.woodDeep,1)}for(let xx of[x-20,x+20])for(let yy of[y-48,y+43]){block(c,v,xx,yy,5,5,22,PAL.woodDeep);block(c,v,xx,yy,7,7,2,PAL.woodHi,21)}line(c,v,point(x-20,y-48,19),point(x-20,y+43,19),'#d4bd8e',1);line(c,v,point(x+20,y-48,19),point(x+20,y+43,19),'#d4bd8e',1);const by=y+3;face(c,v,[point(x+40,by-29,3),point(x+51,by-22,3),point(x+52,by+21,3),point(x+41,by+29,3),point(x+31,by+20,3),point(x+31,by-21,3)],PAL.woodDeep);face(c,v,[point(x+40,by-23,5),point(x+47,by-19,5),point(x+48,by+17,5),point(x+41,by+22,5),point(x+36,by+15,5),point(x+36,by-16,5)],PAL.wood);line(c,v,point(x+32,by-10,7),point(x+49,by-10,7),PAL.woodHi,2)}
function foliage(c,v,x,y,time=0,seed=0){for(let i=0;i<5;i++){const dx=hash(seed*9+i,9)*9-4,dy=hash(i,seed)*7-3,h=4+hash(i,seed+2)*4;line(c,v,point(x+dx,y+dy,0),point(x+dx+Math.sin(time*.001+seed)*1.6,y+dy,h),i%2?PAL.leafHi:PAL.leafDeep);if(i%3===0)dot(c,v,x+dx,y+dy,h,'#d5c6a1',1)}}
function ground(c,v,time,expedition){
 // Distant atmosphere is separated from ground geometry.
 const g=c.createLinearGradient(0,0,0,v.height);g.addColorStop(0,PAL.sky);g.addColorStop(.46,'#cdd6c7');g.addColorStop(1,PAL.seaDeep);c.fillStyle=g;c.fillRect(0,0,v.width,v.height);
 for(let layer=0;layer<3;layer++){const baseline=v.height*(.23+layer*.05),pts=[{x:-30,y:baseline+80}];for(let i=-1;i<9;i++){pts.push({x:i*v.width/6-(v.camera.x*.07)/(layer+1),y:baseline-20-hash(i,layer)*54})}pts.push({x:v.width+50,y:baseline+100});polygon(c,pts,['#c4bdba','#aeb9b5','#91a6a0'][layer])}
 // Water consists of broad, original triangulated color planes.
 const seaTop=project(point(0,175),v).y;rect(c,0,seaTop,v.width,v.height-seaTop,PAL.sea);for(let yy=150;yy<460;yy+=44)for(let xx=-520;xx<520;xx+=82){const h=hash(xx,yy),color=h>.6?'#789f9f':h<.2?'#557f90':'#6b949a';groundPoly(c,v,[[xx,yy],[xx+82,yy],[xx+82,yy+44]],color);groundPoly(c,v,[[xx,yy],[xx+82,yy+44],[xx,yy+44]],tint(color,5))}
 for(let i=0;i<45;i++){const x=hash(i,63)*920-460,y=190+hash(i,41)*250;if(y<shoreY(x))continue;let dx=Math.sin(time*.0005+i)*3;line(c,v,point(x+dx,y,.6),point(x+dx+8+hash(i,31)*20,y,.6),'#b0cfc081')}
 const outline=[[-480,-410],[480,-410],[480,188],...coast.slice().reverse(),[-480,177]];groundPoly(c,v,outline,PAL.land);
 // Small angular terrain triangles vary material subtly, not giant flatgreen tiles.
 for(let yy=-400;yy<180;yy+=34)for(let xx=-470;xx<470;xx+=45){const h=hash(xx,yy),j=(hash(xx+1,yy)*16)-8,q=(hash(xx,yy+1)*10)-5,k=h>.7?PAL.landHi:h<.2?PAL.landShade:PAL.land;groundPoly(c,v,[[xx,yy],[xx+45,yy+q],[xx+23+j,yy+34]],k);groundPoly(c,v,[[xx+45,yy+q],[xx+45,yy+34],[xx+23+j,yy+34]],tint(k,-3))}
 // Stone paths are irregular cobble ribbons embedded in ground, not a checkerboard.
 const paths=expedition?[[140,-310,140,20]]:[[-55,-4,-6,101],[-6,101,-205,107],[-6,101,140,-175],[-6,101,180,212]];
 paths.forEach(([ax,ay,bx,by],pi)=>{const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;for(let d=0;d<len;d+=10)for(let col=-1;col<=1;col++){const t=d/len,x=ax+dx*t+nx*col*9,y=ay+dy*t+ny*col*9;if(y>shoreY(x)&&!(x>159&&x<207))continue;const rr=hash(Math.floor(d),col+pi*9),w=4+rr*2;groundPoly(c,v,[[x-w,y-5],[x+w,y-5],[x+w+1,y+4],[x-w-1,y+5]],rr>.7?'#bcb393':rr<.2?'#a49f80':'#b1ac8a');line(c,v,point(x-w+1,y-4,.2),point(x+w-1,y-4,.2),'#d5c6a277')}});
 for(let i=0;i<coast.length-1;i++){const[a,b]=coast[i],[d,e]=coast[i+1];groundPoly(c,v,[[a,b],[d,e],[d,e+9],[a,b+8]],'#c9c4a0');groundPoly(c,v,[[a,b+8],[d,e+9],[d,e+14],[a,b+14]],'#5f918f');line(c,v,point(a,b+15),point(d,e+15),'#b8d0bc80')}
 for(let i=0;i<210;i++){let x=hash(i,53)*800-400,y=hash(i,59)*560-350;if(y>shoreY(x)-8)continue;const p=project(point(x,y),v);if(p.x<-6||p.x>v.width+6||p.y<-8||p.y>v.height)continue;let k=hash(i,41);if(k>.6)foliage(c,v,x,y,time,i);else{dot(c,v,x,y,.5,i%3?'#c2c598':'#778963',1);if(i%11===0)dot(c,v,x+1,y,2,'#f0dbb7',2)}}
}
function hero(c,v,h,time){const p=project(point(h.x,h.y),v),z=v.camera.zoom,role=h.job||'player',facing=h.facing||'down',walk=h.walking?Math.sin(time*.014):0,working=h.working||h.state==='work',j=working?Math.sin(time*.007):0,x=Math.round(p.x),y=Math.round(p.y),s=Math.max(.75,z);c.save();c.translate(x,y);c.scale(s,s);
 // The tiny adventurer is hand-built from original polygon clothing planes.
 polygon(c,[{x:-8,y:2},{x:5,y:1},{x:11,y:5},{x:0,y:8},{x:-9,y:5}],'#4f665342');
 const player=role==='player',body=h.color||(player?'#657f9b':role==='wood'?'#ac8461':role==='herb'?'#83936c':'#929392'),side=tint(body,-27),skin='#d9b590',hair=player?'#514938':'#6d5b43';
 const back=facing==='up'||facing==='north',left=facing==='left'||facing==='west',right=facing==='right'||facing==='east';
 polygon(c,[{x:-4,y:-9},{x:-1,y:-9},{x:-1+walk*1.2,y:0},{x:-5+walk*1.2,y:1}],PAL.woodDeep);polygon(c,[{x:1,y:-9},{x:4,y:-9},{x:5-walk*1.2,y:1},{x:1-walk*1.2,y:1}],'#4b4e4d');rect(c,-5+walk,y,5,2,'#4e4239');rect(c,1-walk,y,5,2,'#4e4239');
 if(player||role==='herb')polygon(c,[{x:-6,y:-21},{x:6,y:-21},{x:8+(walk>0?1:0),y:-7},{x:1,y:-5},{x:-8,y:-8}],side);
 polygon(c,[{x:-5,y:-23},{x:4,y:-23},{x:6,y:-14},{x:4,y:-7},{x:-4,y:-7},{x:-6,y:-16}],body);polygon(c,[{x:2,y:-22},{x:5,y:-20},{x:6,y:-13},{x:3,y:-7},{x:2,y:-7}],side);
 rect(c,-4,-12,9,2,player?'#9f8258':'#6e6150');rect(c,-1,-12,2,2,PAL.paper);rect(c,-4,-21,2,5,tint(body,39));
 const arm=working?j*3:walk;polygon(c,[{x:-5,y:-21},{x:-7,y:-20},{x:-8,y:-13-arm},{x:-5,y:-12-arm}],side);rect(c,-8,-14-arm,3,4,skin);polygon(c,[{x:5,y:-21},{x:7,y:-20},{x:8,y:-13+arm},{x:5,y:-12+arm}],side);rect(c,5,-14+arm,3,4,skin);
 polygon(c,[{x:-5,y:-30},{x:3,y:-31},{x:6,y:-27},{x:5,y:-23},{x:2,y:-20},{x:-3,y:-21},{x:-6,y:-25}],skin);polygon(c,[{x:-5,y:-30},{x:3,y:-32},{x:6,y:-29},{x:4,y:-27},{x:-3,y:-27},{x:-5,y:-23},{x:-7,y:-27}],hair);
 if(back){polygon(c,[{x:-5,y:-30},{x:4,y:-31},{x:6,y:-26},{x:4,y:-22},{x:-4,y:-22},{x:-6,y:-26}],hair);rect(c,-2,-27,4,1,tint(hair,28))}else{rect(c,left?-4:right?3:-2,-26,1,1,PAL.ink);if(!left&&!right)rect(c,3,-26,1,1,PAL.ink);rect(c,left?-3:right?4:0,-23,2,1,'#a77859')}
 if(player){polygon(c,[{x:-7,y:-29},{x:5,y:-30},{x:8,y:-28},{x:2,y:-26},{x:-7,y:-27}],PAL.paper);polygon(c,[{x:-4,y:-34},{x:3,y:-34},{x:5,y:-29},{x:-5,y:-28}],PAL.stone);rect(c,-5,-30,9,1,PAL.wood);polygon(c,[{x:4,y:-32},{x:8,y:-38},{x:8,y:-34},{x:5,y:-30}],PAL.copper);rect(c,8,-21,1,18,PAL.stoneHi);rect(c,6,-9,5,1,PAL.copper)}
 if(role==='wood'){polygon(c,[{x:-7,y:-29},{x:5,y:-30},{x:7,y:-28},{x:-7,y:-27}],'#bc9e6f');rect(c,-4,-33,7,4,'#bda06c');const ay=working?-16+j*7:-7;rect(c,8,ay-10,1,17,PAL.wood);polygon(c,[{x:9,y:ay-10},{x:14,y:ay-9},{x:13,y:ay-5},{x:9,y:ay-6}],PAL.stoneHi)}
 if(role==='herb'){polygon(c,[{x:-6,y:-30},{x:3,y:-33},{x:6,y:-29},{x:4,y:-27},{x:-5,y:-28}],body);rect(c,-9,-11,5,7,PAL.wood);rect(c,-8,-13,3,3,PAL.leafHi);rect(c,-11,-10,7,1,PAL.woodHi)}
 if(role==='stone'){rect(c,-6,-30,11,2,PAL.stoneDeep);polygon(c,[{x:-5,y:-34},{x:3,y:-35},{x:6,y:-31},{x:-5,y:-30}],PAL.stoneHi);rect(c,-2,-34,1,3,PAL.paper);let ay=working?-17+j*5:-11;rect(c,8,ay-7,1,13,PAL.wood);rect(c,6,ay-8,8,3,PAL.stoneDeep);rect(c,-4,-18,8,7,'#ada589');rect(c,-3,-18,1,6,PAL.paper)}
 if(h.carry){rect(c,-12,-12,7,7,PAL.wood);rect(c,-11,-11,5,1,PAL.woodHi)}
 c.restore();if(h.isPlayer||player){rect(c,x-2,y+10,4,1,'#a58e58')}
}
function selection(c,v,s,time){if(!s)return;let p;if(typeof s==='string'){p=landmarks.find(a=>a.id===s)}else p=s;if(!p)return;const rr=12+Math.sin(time*.006);const pts=Array.from({length:12},(_,i)=>[p.x+Math.cos(i/12*Math.PI*2)*rr,p.y+Math.sin(i/12*Math.PI*2)*rr]);for(let i=0;i<12;i+=2)line(c,v,point(...pts[i],.5),point(...pts[(i+1)%12],.5),'#fff0b8',1)}
function expeditionTerrain(c,v,time){
 // Combat is staged in a genuinely open woodland clearing. Its center includes
 // traveler(-90,85) and enemy(85,35); crowns and trunks remain beyond both.
 const clearing=[[-207,-40],[-168,-160],[-64,-211],[75,-189],[183,-96],[210,67],[165,151],[-128,164],[-207,103]];
 groundPoly(c,v,clearing,'#adb087');
 groundPoly(c,v,[[-207,-40],[-168,-160],[-64,-211],[-79,-82]],'#9fa779');
 groundPoly(c,v,[[75,-189],[183,-96],[210,67],[141,-17]],'#a2a979');
 groundPoly(c,v,[[-128,164],[-207,103],[-79,111]],'#a5ad7d');
 const routes=[[-127,124,-130,-53],[-130,-53,-18,-142],[-18,-142,134,-72]];
 routes.forEach(([ax,ay,bx,by])=>{for(let t=0;t<1;t+=.08){const x=ax+(bx-ax)*t,y=ay+(by-ay)*t;groundPoly(c,v,[[x-6,y-4],[x+6,y-4],[x+7,y+4],[x-7,y+4]],'#c0b69a')}});
 const edgeTrees=[[-255,-200],[-198,-222],[-130,-270],[-40,-290],[65,-272],[160,-225],[235,-155],[255,-70],[264,48],[252,157],[-260,149],[-268,52],[-258,-50],[-227,-110]];
 edgeTrees.forEach(([x,y],i)=>tree(c,v,x,y,61+hash(i,44)*31,i+50,time));
 rock(c,v,-179,-85,25,13,41);rock(c,v,171,-75,34,19,42);foliage(c,v,-20,-162,time,31);
 // Sparse fine grass and fallen leaves add texture without masking action.
 for(let i=0;i<23;i++){let x=-145+hash(i,271)*290,y=-81+hash(i,277)*203;if(Math.hypot(x+90,y-85)<31||Math.hypot(x-85,y-35)<58)continue;dot(c,v,x,y,.5,i%3?'#c5c59a':'#8c9a70',1);if(i%5===0)foliage(c,v,x,y,time,i+78)}
}
function weatherPass(c,v,weather,time){const twilight=weather==='twilight'||weather?.time==='twilight';if(twilight){c.fillStyle='#6a719125';c.fillRect(0,0,v.width,v.height)}if(weather==='rain'||weather?.kind==='rain'){c.strokeStyle='#d2dddc58';c.lineWidth=1;for(let i=0;i<30;i++){const x=hash(i,111)*v.width,y=(hash(i,91)*v.height+time*.13)%v.height;c.beginPath();c.moveTo(x,y);c.lineTo(x-2,y+7);c.stroke()}}}
function render(c,state={}){const v=viewOf(state),time=state.time||0,level=Math.max(0,Math.min(3,state.level||0)),expedition=state.scene==='expedition';c.save();c.imageSmoothingEnabled=false;ground(c,v,time,expedition);selection(c,v,state.selection,time);let objects=[];
 if(expedition){expeditionTerrain(c,v,time);for(const h of(state.heroes||[]).slice(0,4))objects.push({y:h.y+2,draw:()=>hero(c,v,h,time)})}
 else{
 objects=[{y:-150,draw:()=>gateway(c,v,time)},{y:-10,draw:()=>abbey(c,v,level,time)},{y:87,draw:()=>workshop(c,v,time)},{y:85,draw:()=>board(c,v)},{y:150,draw:()=>fountain(c,v,time)},{y:295,draw:()=>dock(c,v,time)}];
 trunkData.forEach(([x,y,h],i)=>objects.push({y:y+5,draw:()=>tree(c,v,x,y,h,i,time)}));
 [[-257,-166,31,16],[-296,155,32,17],[255,-42,38,25],[287,165,31,12],[117,-270,38,25],[-81,180,17,11],[237,201,24,10]].forEach(([x,y,w,h],i)=>objects.push({y:y+8,draw:()=>rock(c,v,x,y,w,h,i)}));
 for(const h of(state.heroes||[]).slice(0,4))objects.push({y:h.y+3,draw:()=>hero(c,v,h,time)});
 }
 objects.sort((a,b)=>a.y-b.y).forEach(o=>o.draw());weatherPass(c,v,state.weather,time);c.restore()}
window.HearthArt=Object.freeze({render,project,unproject,getLandmarks,isBlocked,palette:PAL,bounds,version:'independent-faceted-coast-1.0'});
})();
