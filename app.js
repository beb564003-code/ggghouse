import { FilesetResolver, HandLandmarker, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/vision_bundle.mjs";

const $ = s => document.querySelector(s);
const video = $("#video"), canvas = $("#fx"), ctx = canvas.getContext("2d");
const openBtn=$("#openBtn"), overlay=$("#startOverlay"), trackBtn=$("#trackBtn"), clearBtn=$("#clearBtn");
const smoothEl=$("#smooth"), lengthEl=$("#length"), sizeEl=$("#size");
const showHandEl=$("#showHand"), mirrorEl=$("#mirror");
const styles=[...document.querySelectorAll(".style")];

let landmarker=null, stream=null, running=false, tracking=false, lastVideoTime=-1;
let lastInfer=0, inferEvery=55;       // ~18 fps inference to reduce mobile lag
let rafId=0, points=[], smoothPoint=null, currentRaw=null;
let lastTs=performance.now(), fpsFrames=0, fps=0, style="neon";

const MODEL="https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

async function init(){
  try{
    $("#status").textContent="โหลดโมเดล…";
    const vision=await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm");
    landmarker=await HandLandmarker.createFromOptions(vision,{
      baseOptions:{modelAssetPath:MODEL},
      runningMode:"VIDEO",numHands:1,
      minHandDetectionConfidence:.55,
      minHandPresenceConfidence:.5,
      minTrackingConfidence:.5
    });
    $("#status").textContent="พร้อม";
    $("#dot").style.background="#fff";
  }catch(e){
    console.error(e); $("#status").textContent="โหลดโมเดลไม่สำเร็จ";
  }
}

async function cameraOn(){
  try{
    stream=await navigator.mediaDevices.getUserMedia({
      video:{facingMode:"user",width:{ideal:960,max:1280},height:{ideal:540,max:720},frameRate:{ideal:30,max:30}},
      audio:false
    });
    video.srcObject=stream; await video.play(); running=true;
    overlay.classList.add("hidden"); openBtn.textContent="ปิดกล้อง"; trackBtn.disabled=false;
    resize(); loop();
  }catch(e){
    console.error(e); alert("เปิดกล้องไม่ได้ กรุณาอนุญาต Camera แล้วลองใหม่");
  }
}
function cameraOff(){
  stream?.getTracks().forEach(t=>t.stop()); stream=null; running=false; cancelAnimationFrame(rafId);
  openBtn.textContent="เปิดกล้อง"; trackBtn.disabled=true; overlay.classList.remove("hidden");
}

function resize(){
  if(!video.videoWidth)return;
  const d=Math.min(devicePixelRatio||1,1.5);
  canvas.width=video.videoWidth*d; canvas.height=video.videoHeight*d;
  canvas.style.aspectRatio=`${video.videoWidth}/${video.videoHeight}`;
  ctx.setTransform(d,0,0,d,0,0);
}

function lerp(a,b,t){return a+(b-a)*t}
function smoothTo(p){
  if(!smoothPoint){smoothPoint={...p};return smoothPoint}
  const amt=Number(smoothEl.value)/100;
  // Lower value = more responsive. Keep a tiny minimum to suppress jitter.
  const t=Math.max(.18,1-amt*.82);
  smoothPoint.x=lerp(smoothPoint.x,p.x,t);
  smoothPoint.y=lerp(smoothPoint.y,p.y,t);
  return smoothPoint;
}

function draw(result){
  if(!video.videoWidth)return;
  ctx.clearRect(0,0,video.videoWidth,video.videoHeight);

  const has=!!result.landmarks?.length;
  $("#detect").textContent=has?"HAND: OK":"HAND: --";
  $("#confidence").textContent=has?`${Math.round((result.handedness?.[0]?.[0]?.score||0)*100)}%`:"--";
  if(!has){ currentRaw=null; return; }

  const lm=result.landmarks[0], p=lm[8];
  const raw={x:p.x*video.videoWidth,y:p.y*video.videoHeight};
  currentRaw=raw;

  if(showHandEl.checked){
    const d=new DrawingUtils(ctx);
    d.drawConnectors(lm,HandLandmarker.HAND_CONNECTIONS,{color:"#ffffff99",lineWidth:2});
    d.drawLandmarks(lm,{color:"#fff",fillColor:"#111",radius:2.5,lineWidth:1});
  }

  const q=smoothTo(raw);
  // fingertip target
  const r=Number(sizeEl.value);
  ctx.beginPath();ctx.arc(q.x,q.y,r,0,Math.PI*2);
  ctx.fillStyle="#fff";ctx.fill();

  if(tracking){
    points.push({x:q.x,y:q.y,t:performance.now()});
    const max=Number(lengthEl.value);
    if(points.length>max)points.splice(0,points.length-max);
  }
}

function drawTrail(){
  if(!points.length)return;
  const now=performance.now();
  const visible=points.filter(p=>now-p.t<900);
  points=visible.slice(-Number(lengthEl.value));

  if(style==="dot"){
    for(let i=0;i<points.length;i+=2){
      const p=points[i], a=(i+1)/points.length;
      ctx.globalAlpha=a*.8;ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill();
    }
    ctx.globalAlpha=1;return;
  }

  if(points.length<2)return;
  ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    ctx.quadraticCurveTo(a.x,a.y,mx,my);
  }
  ctx.lineTo(points.at(-1).x,points.at(-1).y);
  ctx.lineCap="round";ctx.lineJoin="round";
  if(style==="neon"){
    ctx.shadowColor="#fff";ctx.shadowBlur=16;ctx.strokeStyle="#fff";ctx.lineWidth=4;ctx.stroke();
    ctx.shadowBlur=4;ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.stroke();ctx.shadowBlur=0;
  }else{
    ctx.strokeStyle="#fff";ctx.lineWidth=4;ctx.stroke();
  }
}

function frame(now){
  if(!running)return;
  resize();
  ctx.clearRect(0,0,video.videoWidth,video.videoHeight);

  if(video.currentTime!==lastVideoTime && now-lastInfer>=inferEvery){
    lastVideoTime=video.currentTime;lastInfer=now;
    const result=landmarker.detectForVideo(video,now);
    draw(result);
  }else{
    // keep the visual trail alive even between AI inference frames
  }
  drawTrail();

  fpsFrames++;
  if(now-lastTs>700){fps=Math.round(fpsFrames*1000/(now-lastTs));fpsFrames=0;lastTs=now;$("#fps").textContent=fps}
  $("#perf").textContent=`TRACK: ${tracking?"ON":"OFF"}`;
  $("#count").textContent=points.length;
  rafId=requestAnimationFrame(frame);
}
function loop(){rafId=requestAnimationFrame(frame)}

openBtn.onclick=()=>running?cameraOff():cameraOn();
trackBtn.onclick=()=>{
  tracking=!tracking;trackBtn.textContent=tracking?"หยุดลากเส้น":"เริ่มลากเส้น";
  if(tracking){points=[];smoothPoint=null}
};
clearBtn.onclick=()=>{points=[]};
mirrorEl.onchange=()=>{video.style.transform=mirrorEl.checked?"scaleX(-1)":"none"};
[smoothEl,lengthEl,sizeEl].forEach(el=>el.addEventListener("input",()=>{
  $("#smoothVal").textContent=smoothEl.value;
  $("#lengthVal").textContent=lengthEl.value;
  $("#sizeVal").textContent=sizeEl.value;
}));
styles.forEach(b=>b.onclick=()=>{styles.forEach(x=>x.classList.remove("active"));b.classList.add("active");style=b.dataset.style});

$("#smoothVal").textContent=smoothEl.value;
$("#lengthVal").textContent=lengthEl.value;
$("#sizeVal").textContent=sizeEl.value;
init();
