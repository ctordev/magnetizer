const C=35.9e-3, Vmains=230;
const r2=(x,n=1)=>+x.toFixed(n);
// 1) вольт-добавка и угол диммера: банка заряжается до доступного пика = Vm*sin(a) (a>90)
const busRatio=(u2)=>u2*Math.SQRT2-2;
function angleFor(V,Vm){const s=(V+2)/Vm; if(s>1) return null; const a=Math.asin(s)*180/Math.PI;
  const w=180-a; return {a:w, dVdeg: r2(Vm*Math.abs(Math.cos(w*Math.PI/180))*Math.PI/180,1)};}
const ratios=[[2,'1:2 (460 В)'],[1.3,'1:1.3 (300 В)'],[1.22,'1:22 (280 В)']].map(([k,name])=>{
  const Vm=busRatio(Vmains*k);
  return {name, u2:Vmains*k, Vdc_full:r2(Vm,0), Vdc_mains250:r2(250*k*Math.SQRT2-2,0),
    a300:angleFor(300,Vm), a350:angleFor(350,Vm), a400:angleFor(400,Vm),
    window_300_400: (angleFor(300,Vm)&&angleFor(400,Vm))?r2(angleFor(300,Vm).a-angleFor(400,Vm).a,0):'недоступно'};});
// 2) разряд банки в обмотку через мост (D1 убрана): RLC, 2 диода + R + L обмотки
function rlc(R,L,U,c=C){const w=1/Math.sqrt(L*c), z=R/2*Math.sqrt(c/L);
  let Ipk=0,It2=0; const h=5e-5;
  for(let t=0;t<0.5;t+=h){ let i;
    if(z<1){const wd=w*Math.sqrt(1-z*z); i=U/(w*L)*Math.exp(-z*w*t)*Math.sin(wd*t);}
    else{const s1=-z*w+Math.sqrt((z*w)**2-w*w), s2=-z*w-Math.sqrt((z*w)**2-w*w);
      i=U*(Math.exp(s1*t)-Math.exp(s2*t))/((s1-s2)*L);}
    Ipk=Math.max(Ipk,i); It2+=i*i*h; if(i<0.5&&t>0.005) break;}
  return {R, L_mH:r2(L*1e3,0), zeta:r2(z,2), Ipk_A:r2(Ipk,0), It2_kA2s:r2(It2/1e3,1),
    dur_ms:r2((z<1?Math.PI/(w*Math.sqrt(1-z*z)):5/Math.abs(-z*w-Math.sqrt((z*w)**2-w*w)))*1e3,0),
    E_kJ:r2(0.5*c*U*U/1e3,2)};}
const dumps=[[0.25,0.010],[0.5,0.010],[0.5,0.020],[1.0,0.015],[3.0,0.010]].map(a=>rlc(a[0],a[1],350));
// 3) зарядка: R ограничитель, Vm доступный
function charge(R,Vm,target){const tau=R*C; const t=-tau*Math.log(1-(target+2)/Vm);
  const I0=Vm/R, P0=Vm*Vm/R, Pavg=(0.5*C*target*target + 0.5*C*(Vm-target)*(Vm-target))/t;
  return {R_om:r2(R,0), Vm:r2(Vm,0), target, I0_A:r2(I0,2), P0_kW:r2(P0/1e3,2), tau_s:r2(tau,1), t_s:r2(t,0), P_avg_W:r2(Pavg,0)};}
const schemes=[charge(484,396,300),charge(484,396,350),charge(242,396,350),charge(75,424,350),charge(150,648,350),charge(484,648,350)];
// 4) пиковые токи без балласта при фазовом регулировании (окно 180-a)
function spikes(Vm,alphaDeg,Iavg){const win=(180-alphaDeg)/180*0.01; const Qh=Iavg*0.01; const IavgWin=Qh/win;
  const Irms=IavgWin*Math.sqrt(win/0.02);
  return {alpha:alphaDeg, win_ms:r2(win*1e3,2), IavgWin_A:r2(IavgWin,1), Irms_A:r2(Irms,1)};}
const out={bus:ratios, dumps, charge:schemes,
 spikes:[12,25,40].map(a=>spikes(648,a,1)), spikes300:[60,80,110].map(a=>spikes(424,a,1)),
 transformer:{rated_400VA_460V_A:r2(400/460,2)}};
// Пуск без аргументов — печать своего прогона; через require() — только rlc(),
// чтобы модель разряда банки в обмотку осталась одна на все скрипты.
if (require.main === module) console.log(JSON.stringify(out,null,1));
module.exports = { rlc, charge, C };
