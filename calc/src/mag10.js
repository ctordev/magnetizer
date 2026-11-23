
const MAT={
  ferrite:{n:"Феррит Ba/Sr",HcJ:250e3,k:4.0},
  ndfeb:{n:"NdFeB спечённый",HcJ:1200e3,k:3.0},
  bonded:{n:"NdFeB связанный",HcJ:950e3,k:4.0},
  alnico:{n:"AlNiCo",HcJ:60e3,k:6.0}
};
const $=id=>document.getElementById(id);
const nf=(x,d=1)=>x.toLocaleString('ru-RU',{maximumFractionDigits:d,minimumFractionDigits:d});
function calc(){
  const m=MAT[$('mat').value];
  const eta=parseFloat($('fix').value);
  const lmag=parseFloat($('lmag').value)/1000;
  const sf=parseFloat($('sf').value)||1;
  const N=parseFloat($('n').value);
  const L=parseFloat($('ll').value)*1e-6;
  const U=parseFloat($('uu').value);
  const C=parseFloat($('cc').value)*1e-3;
  const Itsm=parseFloat($('itsm').value)*1e3;
  const didtR=parseFloat($('didt').value);

  const Hsat=m.HcJ*m.k;
  const NIreq=Hsat*lmag/eta*sf;
  const Ireq=NIreq/N;
  const Ipk=U*Math.sqrt(C/L);
  const NIavl=N*Ipk;
  const T=Math.PI*Math.sqrt(L*C);
  const E=0.5*C*U*U;
  const didt=U/L/1e6;                 // A/us
  const rEst=0.016;                  // Ом, штатный контур установки: обмотка 8.5 + шины/тиристор 3.5 + ESR банка 4 мОм
  const zeta=rEst/2*Math.sqrt(C/L);
  const esrDrop=Ipk*0.004;           // падение на ESR банка (10 × 40 мОм параллельно)
  const Q=C*U;
  const id2=Ipk*T*0.5/30;            // средний за 30 с цикла

  $('o-hsat').textContent=nf(Hsat/1e6,2)+" МА/м (k="+m.k+")";
  $('o-nireq').textContent=nf(NIreq/1000,0)+" кА·витков";
  $('o-ireq').textContent=nf(Ireq/1000,2)+" кА";
  $('o-ipk').textContent=nf(Ipk/1000,2)+" кА";
  $('o-niavl').textContent=nf(NIavl/1000,0)+" кА·витков  ("+nf(NIavl/NIreq*100,0)+" % от требуемого)";
  $('o-t').textContent=nf(T*1000,1)+" мс";
  $('o-e').textContent=nf(E/1000,2)+" кДж";
  $('o-didt').textContent=nf(didt,1)+" А/мкс";
  $('o-z').textContent=zeta<0.25?"ζ="+nf(zeta,2)+" — недозатухающий (нужен D2)":zeta<0.7?"ζ="+nf(zeta,2)+" — около критического":"ζ="+nf(zeta,2)+" — сильно затухающий (много тепла в обмотке)";
  $('o-esr').textContent=nf(esrDrop,0)+" В";
  $('o-q').textContent=nf(Q,1)+" Кл";
  $('o-id2').textContent=nf(id2,1)+" А (при 1 выстреле / 30 с)";

  const msgs=[];
  if(NIavl<NIreq) msgs.push(["bad","Не хватает энергии: доступное N·I на "+nf((1-NIavl/NIreq)*100,0)+"% ниже требуемого. Поднимите U (энергия ∝U²), увеличьте C или поставьте ярмо."]);
  else msgs.push(["ok","Полю по ампер-виткам: запас "+nf((NIavl/NIreq-1)*100,0)+"%"]);
  if(Ipk>Itsm) msgs.push(["bad","Тиристор не годится: I_pk "+nf(Ipk/1000,1)+" кА > Itsm "+nf(Itsm/1000,1)+" кА. Нужен импульсный тиристор с Itsm ≥ "+nf(Ipk*1.6/1000,0)+" кА."]);
  else msgs.push(["ok","Тиристор по Itsm: I_pk "+nf(Ipk/1000,1)+" кА < Itsm "+nf(Itsm/1000,1)+" кА"]);
  if(didt>didtR) msgs.push(["bad","di/dt "+nf(didt,0)+" А/мкс превышает допустимый "+nf(didtR,0)+" А/мкс: больше витков (L↑), либо крутой затвор + последовательный дроссель."]);
  else if(didt>0.5*didtR) msgs.push(["warn","di/dt "+nf(didt,1)+" А/мкс при допустимом "+nf(didtR,0)+" — запас меньше 2×: обязателен крутой импульс затвора и снаббер."]);
  else msgs.push(["ok","di/dt "+nf(didt,1)+" А/мкс при допустимом "+nf(didtR,0)+" — запас двукратный и больше"]);
  if(T*1000<3) msgs.push(["warn","Импульс короче 3 мс: поле не успеет проникнуть в сталь магнитной системы. Увеличьте L (больше витков) или C."]);
  if(T*1000>20) msgs.push(["warn","Импульс длиннее 20 мс: лишний нагрев оснастки и медленный цикл. Уменьшите C или витки."]);
  if(Q>50) msgs.push(["warn","Заряд "+nf(Q,0)+" Кл — опасен для жизни, разрядный контур и блокировка кожуха обязательны."]);
  const v=$('verdict');
  v.innerHTML=msgs.map(m=>'<div class="verdict v-'+m[0]+'">'+(m[0]==='ok'?'✔':m[0]==='warn'?'▲':'✖')+' '+m[1]+'</div>').join('');
}
function doublerule(){
  const N=parseFloat($('n').value),L=parseFloat($('ll').value),U=parseFloat($('uu').value),C=parseFloat($('cc').value);
  const Ipk1=U*Math.sqrt((C*1e-3)/(L*1e-6))/1000;
  const L2=L*4;
  const Ipk2v=U*Math.sqrt((C*1e-3)/(L2*1e-6))/1000;
  const T1=Math.PI*Math.sqrt(L*1e-6*C*1e-3)*1000;
  const T2=Math.PI*Math.sqrt(L2*1e-6*C*1e-3)*1000;
  const L3=L*2, Ipk3=U*Math.sqrt((C*1e-3)/(L3*1e-6))/1000, T3=Math.PI*Math.sqrt(L3*1e-6*C*1e-3)*1000;
  $('rule').innerHTML='При N='+N+' → N·I = '+nf(N*Ipk1,0)+' кА·витков, I = '+nf(Ipk1,1)+' кА, T/2 = '+nf(T1,1)+' мс.<br>'+
    'Витки ×2 <b>на той же форме</b> (L ×4): N·I = '+nf(N*2*Ipk2v,0)+' кА·витков, I = '+nf(Ipk2v,1)+' кА, T/2 = '+nf(T2,1)+' мс — ампер-витки те же, ток вдвое меньше, энергия та же.<br>'+
    'Витки ×2 <b>той же жилой</b> (шаг тот же ⇒ намотка вдвое длиннее, L только ×2): N·I = '+nf(N*2*Ipk3,0)+' кА·витков, I = '+nf(Ipk3,1)+' кА, T/2 = '+nf(T3,1)+' мс — выигрыш лишь √2, а поле в bore почти не меняется (§4).';
}
/* ================= 3D вид оснастки (свой мини-рендерер, ортографическая проекция) ================= */
const DEG=Math.PI/180;
const fx={yaw:-34,pitch:24,yoke:true,cut:true,flow:true,flip:1};
const FXV={cx:470,cy:310,s:2.3};
const LIGHT=(()=>{const v=[-0.38,-0.62,0.68],l=Math.hypot(...v);return v.map(x=>x/l);})();

function fxT(p){                                    // мир -> камера: [x, глубина, вверх]
  const a=fx.yaw*DEG,b=fx.pitch*DEG,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);
  const x1=p[0]*ca-p[1]*sa, y1=p[0]*sa+p[1]*ca, z1=p[2];
  return [x1, y1*cb-z1*sb, y1*sb+z1*cb];
}
const scr=c=>[FXV.cx+FXV.s*c[0], FXV.cy-FXV.s*c[2]];
const poly=p=>`M${p.map(q=>q[0].toFixed(1)+' '+q[1].toFixed(1)).join(' L ')} z`;   // полигон из экранных точек
const RP=(r,a,z)=>[r*Math.cos(a*DEG), r*Math.sin(a*DEG), z];
function newell(pts){
  let n=[0,0,0];
  for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length];
    n[0]+=(p[1]-q[1])*(p[2]+q[2]); n[1]+=(p[2]-q[2])*(p[0]+q[0]); n[2]+=(p[0]-q[0])*(p[1]+q[1]);}
  const l=Math.hypot(...n)||1; return [n[0]/l,n[1]/l,n[2]/l];
}
const cen=p=>{const s=[0,0,0];p.forEach(v=>{s[0]+=v[0];s[1]+=v[1];s[2]+=v[2]});return s.map(v=>v/p.length)};

let PARTS=[];
function face(pts,ref,col,cap){
  let n=newell(pts), c=cen(pts), d=[c[0]-ref[0],c[1]-ref[1],c[2]-ref[2]];
  if(n[0]*d[0]+n[1]*d[1]+n[2]*d[2]<0){pts=pts.slice().reverse();n=newell(pts);}
  PARTS.push({pts,n,col,cap});
}
function addBox(x0,x1,y0,y1,z0,z1,col){
  const ref=[(x0+x1)/2,(y0+y1)/2,(z0+z1)/2];
  face([[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]],ref,col);
  face([[x0,y1,z0],[x0,y0,z0],[x0,y0,z1],[x0,y1,z1]],ref,col);
  face([[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]],ref,col);
  face([[x1,y0,z0],[x0,y0,z0],[x0,y0,z1],[x1,y0,z1]],ref,col);
  face([[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],ref,col);
  face([[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]],ref,col);
}
function addSeg(r0,r1,a0,a1,z0,z1,col,cap0,cap1){
  if(a1-a0<0.4) return;
  const ref=RP((r0+r1)/2,(a0+a1)/2,(z0+z1)/2);
  face([RP(r1,a0,z0),RP(r1,a1,z0),RP(r1,a1,z1),RP(r1,a0,z1)],ref,col);
  face([RP(r0,a1,z0),RP(r0,a0,z0),RP(r0,a0,z1),RP(r0,a1,z1)],ref,col);
  face([RP(r0,a0,z1),RP(r1,a0,z1),RP(r1,a1,z1),RP(r0,a1,z1)],ref,col);
  face([RP(r0,a1,z0),RP(r1,a1,z0),RP(r1,a0,z0),RP(r0,a0,z0)],ref,col);
  face([RP(r0,a0,z0),RP(r0,a0,z1),RP(r1,a0,z1),RP(r1,a0,z0)],ref,col,cap0);   // торцы = стенки разреза
  face([RP(r1,a1,z0),RP(r1,a1,z1),RP(r0,a1,z1),RP(r0,a1,z0)],ref,col,cap1);
}
// разрез плоскостью, проходящей через ось: оставляем дальнюю от камеры половину кольца,
// границы сегментов ставим ровно по плоскости отсечения, поэтому стенка получается плоской
const norm180=a=>((a+180)%360+360)%360-180;
function ringCut(r0,r1,z0,z1,col,n){
  const c=90-fx.yaw;                                        // центр сохраняемой (дальней) половины
  for(let i=0;i<n;i++){
    const a0=i*360/n, a1=(i+1)*360/n;
    if(!fx.cut){ addSeg(r0,r1,a0,a1,z0,z1,col); continue; }
    const d0=norm180(a0-c), d1=norm180(a1-c);
    const s0=Math.max(d0,-90), s1=Math.min(d1,90);
    if(s1-s0<0.4) continue;
    addSeg(r0,r1,c+s0,c+s1,z0,z1,col, s0>d0+0.01, s1<d1-0.01);
  }
}
const COL={coil:[186,110,42], mag:[104,116,134], yoke:[122,132,144], yoke2:[108,118,130]};

function build(){
  PARTS=[];
  ringCut(50,56.5,-39,39,COL.coil,20);                                // обмотка, слой 1 (12 витков)
  ringCut(57.5,64,-39,39,COL.coil,20);                                // обмотка, слой 2 (12 витков)
  ringCut(25,40,-8,8,COL.mag,20);                                     // кольцо ⌀80×⌀50×16 мм
  const ring=(r0,r1,z0,z1,c)=>{addBox(r0,r1,-r1,r1,z0,z1,c);addBox(-r1,-r0,-r1,r1,z0,z1,c);
                               addBox(-r1,r1,r0,r1,z0,z1,c);addBox(-r1,r1,-r1,-r0,z0,z1,c);};
  if(fx.yoke){
    // Полюс-стакан: bore катушки ⌀100, значит стальной полюс — максимум ⌀96.
    // Диск прижимается к кольцу, его стенка поднимается над торцом обмотки и
    // выводит поток наружу, к коробу возврата. Сечение стенки π(48²−28²)=53 см²,
    // моста 2πr·t≈52 см² — под поток 8 мВб от кольца ⌀80×16 это ≈1.5 Тл, не насыщение.
    for(const s of [1,-1]){
      const zd=s>0?[10,24]:[-24,-10], zw=s>0?[24,44]:[-44,-24], zm=s>0?[44,58]:[-58,-44];   // верх витка с изоляцией — 42 мм, мост начинаем с 44
      ringCut(1,48,zd[0],zd[1],COL.yoke,20);          // полюсный диск ⌀96
      ringCut(28,48,zw[0],zw[1],COL.yoke,20);         // стенка стакана (поднимает поток над кольцом)
      ring(48,70,zm[0],zm[1],COL.yoke2);              // мост над обмоткой (|z|≥42 — витки не задевает)
    }
    ring(70,94,-58,58,COL.yoke2);                     // короб возврата потока: ⌀140 в свету, обмотка ⌀128
  }
  fxCheck();
}
// ярмо не имеет права попадать в тело обмотки (r 50…64 мм, |z| ≤ 42 мм)
function fxCheck(){
  if(!fx.yoke) return;
  let bad=0;
  for(const p of PARTS){
    if(p.col!==COL.yoke&&p.col!==COL.yoke2) continue;
    for(let i=0;i<p.pts.length;i+=3){
      const r=Math.hypot(p.pts[i][0],p.pts[i][1]);
      if(r>49&&r<65&&Math.abs(p.pts[i][2])<43){bad++;break;}
    }
  }
  if(bad) console.warn('fx3d: '+bad+' граней ярма внутри обмотки — геометрика оснастки некорректна');
}
function shade(col,n){
  const d=Math.max(0,n[0]*LIGHT[0]+n[1]*LIGHT[1]+n[2]*LIGHT[2]), k=0.34+0.66*d;
  const c=col.map(v=>Math.max(0,Math.min(255,Math.round(v*k)))), s=c.map(v=>Math.round(v*0.7));
  return {f:`rgb(${c[0]},${c[1]},${c[2]})`,s:`rgb(${s[0]},${s[1]},${s[2]})`};
}
function arrowPath(pts,heads){
  const p=pts.map(fxT).map(scr);
  let d='M'+p.map(q=>q[0].toFixed(1)+' '+q[1].toFixed(1)).join(' L '), a='';
  (heads||[]).forEach(k=>{
    const A=p[k-1],B=p[k],dx=B[0]-A[0],dy=B[1]-A[1],L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L;
    const bx=B[0]-ux*9, by=B[1]-uy*9;
    a+=`<path d="M${B[0].toFixed(1)} ${B[1].toFixed(1)} L${(bx-uy*4.5).toFixed(1)} ${(by+ux*4.5).toFixed(1)} L${(bx+uy*4.5).toFixed(1)} ${(by-ux*4.5).toFixed(1)} z" fill="#4da3ff"/>`;
  });
  return `<path d="${d}" fill="none" stroke="#4da3ff" stroke-width="2.1" opacity=".9"/>`+a;
}
function flow(){
  const f=fx.flip, out=[];
  if(fx.yoke){
    [[1,0],[0,1]].forEach(([ax,ay])=>{
      const P=(r,z)=>[ax*r,ay*r,z*f];
      out.push(arrowPath([P(32,-8),P(32,16),P(38,30),P(38,51),P(82,51),P(82,-51),P(38,-51),P(38,-30),P(32,-16)],
                         [1,3,5,7]));
    });
  } else {
    [45,135,225,315].forEach(a=>out.push(arrowPath([RP(20,0,-58*f),RP(20,0,58*f)],[])));
  }
  return out.join('');
}
function tag(text,anchor,side,y){
  const a=scr(fxT(anchor));
  if(side==='r'){
    return `<path d="M${a[0].toFixed(1)} ${a[1].toFixed(1)} L700 ${y-4}" stroke="#5b6577" stroke-dasharray="3 3" fill="none"/>`+
           `<circle cx="${a[0].toFixed(1)}" cy="${a[1].toFixed(1)}" r="2.5" fill="#98a3b5"/>`+
           `<text x="706" y="${y}" class="lblb">${text}</text>`;
  }
  return `<path d="M${a[0].toFixed(1)} ${a[1].toFixed(1)} L292 ${y-4}" stroke="#5b6577" stroke-dasharray="3 3" fill="none"/>`+
         `<circle cx="${a[0].toFixed(1)}" cy="${a[1].toFixed(1)}" r="2.5" fill="#98a3b5"/>`+
         `<text x="296" y="${y}" text-anchor="end" class="lblb">${text}</text>`;
}
function fxRender(){
  build();
  const solid=[],ghost=[];
  for(const f of PARTS){
    const nc=fxT(f.n); if(nc[1]>=0) continue;                    // отсечка задних граней
    const cam=f.pts.map(fxT);
    const rec={d:cam,dep:cen(cam)[1],col:f.col,n:nc,cap:f.cap};
    (f.col===COL.yoke||f.col===COL.yoke2?ghost:solid).push(rec); // ярмо — отдельным полупрозрачным слоем
  }
  const mix=(a,b,k)=>a.map((v,i)=>Math.round(v+(b[i]-v)*k));
  const paint=(list,op,stw)=>{
    list.sort((a,b)=>b.dep-a.dep);                               // painter: от дальних к ближним
    let out='';
    for(const v of list){
      const col=v.cap?mix(v.col,[236,226,205],0.5):v.col;        // секущая плоскость — светлее
      const sh=shade(col,v.n), p=v.d.map(scr);
      out+=`<path d="${poly(p)}" fill="${sh.f}" fill-opacity="${op}" stroke="${sh.s}" stroke-width="${stw}" stroke-opacity=".85"/>`;
    }
    return out;
  };
  let out=`<text x="24" y="34" class="lblb">Оснастка: ${fx.yoke?'с ярмом — вариант B':'воздушный соленоид — вариант A'}</text>`+
          `<text x="24" y="52" class="lbl">ортографика · 2 слоя × 12 витков, ℓ=78 мм · кольцо ⌀80×⌀50×16 мм · полюс-стакан ⌀96 в bore ⌀100 · короб ⌀140…188 мм</text>`;
  out+=paint(ghost,.22,1.1);      // ярмо полупрозрачным контуром, чтобы видеть что внутри
  out+=paint(solid,1,.7);         // обмотка и кольцо — сплошными
  if(fx.flow) out+=flow();
  out+=tag('обмотка 2 слоя × 12',RP(62,20,30),'r',150);
  out+=tag('ярмо: короб из плит и швеллеров',fx.yoke?[78,0,-30]:[72,200,-40],'r',430);
  out+=tag('магнитное кольцо',RP(40,190,0),'l',300);
  out+=tag('полюс-стакан ⌀96',fx.yoke?[0,-34,17]:[72,150,50],'l',120);
  out+=tag('мост над обмоткой',fx.yoke?[0,-59,49]:[72,150,50],'l',180);
  if(fx.flow && Math.abs(fx.pitch)<72){
    const n=scr(fxT([0,0,fx.flip*80])), s=scr(fxT([0,0,-fx.flip*80]));   // метки полюсов — сразу за ярмом, не за краем кадра
    out+=`<text x="${n[0].toFixed(1)}" y="${(n[1]-8).toFixed(1)}" class="lblb" fill="#4da3ff" text-anchor="middle">N</text>`+
         `<text x="${s[0].toFixed(1)}" y="${(s[1]+18).toFixed(1)}" class="lblb" fill="#ff9f43" text-anchor="middle">S</text>`;
  }
  document.getElementById('fxsvg').innerHTML=out;
}
function fxInit(){
  const svg=document.getElementById('fxsvg');
  if(!svg) return;
  let drag=null;
  svg.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY];svg.classList.add('drag');try{svg.setPointerCapture(e.pointerId)}catch(_){ }});
  svg.addEventListener('pointermove',e=>{if(!drag)return;
    fx.yaw+=(e.clientX-drag[0])*0.55; fx.pitch=Math.max(-88,Math.min(88,fx.pitch+(e.clientY-drag[1])*0.45));
    drag=[e.clientX,e.clientY]; fxRender();});
  const up=()=>{drag=null;svg.classList.remove('drag')};
  svg.addEventListener('pointerup',up); svg.addEventListener('pointercancel',up);
  const bind=(id,key)=>{const el=document.getElementById(id); if(el){fx[key]=el.checked; el.addEventListener('change',()=>{fx[key]=el.checked;fxRender();});}};
  bind('fx-yoke','yoke'); bind('fx-cut','cut'); bind('fx-flow','flow');
  document.querySelectorAll('.fxbar [data-view]').forEach(b=>b.addEventListener('click',()=>{
    const v=b.dataset.view;
    if(v==='iso'){fx.yaw=-34;fx.pitch=24} if(v==='top'){fx.yaw=-34;fx.pitch=86}
    if(v==='front'){fx.yaw=-90;fx.pitch=2} if(v==='flip'){fx.flip*=-1}
    fxRender();
  }));
  fxRender();
}
calc();
fxInit();
