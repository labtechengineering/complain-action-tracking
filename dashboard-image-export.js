(() => {
 'use strict';
 const button = document.getElementById('downloadDashboardImage');
 if(!button) return;
 const status = document.getElementById('dashboardImageStatus');
 const main = button.closest('main');
 const canvasSize = 512;
 const timezone = 'Asia/Bangkok';
 const dateFormat = new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeZone:timezone});
 const timeFormat = new Intl.DateTimeFormat('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',timeZone:timezone});
 const fileDateFormat = new Intl.DateTimeFormat('sv-SE',{dateStyle:'short',timeStyle:'medium',timeZone:timezone});

 // Convert the same chart sectors to a bitmap for the screenshot renderer.
 function donutImage(charts){
  const donut = charts.querySelector('#donut');
  const colors = new Map([...charts.querySelectorAll('#donutLegend [data-chart-status]')]
   .map(item => [item.dataset.chartStatus,item.querySelector('.dot').style.backgroundColor]));
  const parts = JSON.parse(donut.dataset.parts || '[]');
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = canvasSize;
  const ctx = canvas.getContext('2d');
  const center = canvasSize/2;
  const toAngle = percentage => percentage/100 * 2*Math.PI - Math.PI/2;
  ctx.fillStyle = '#e4e8ef';
  ctx.beginPath();
  ctx.arc(center,center,center,0,2*Math.PI);
  ctx.fill();
  for(const part of parts){
   ctx.fillStyle = colors.get(part.s)||'#e4e8ef';
   ctx.beginPath();
   ctx.moveTo(center,center);
   ctx.arc(center,center,center,toAngle(part.from),toAngle(part.to));
   ctx.closePath();
   ctx.fill();
  }
  donut.style.background = 'url("' + canvas.toDataURL('image/png') + '") center / 100% 100% no-repeat';
 }

 function snapshot(clickedAt){
  const source = main.querySelector('header h1');
  const header = document.createElement('header');
  const time = document.createElement('time');
  time.className = 'qa-dashboard-image-time';
  time.dateTime = clickedAt.toISOString();
  time.textContent = 'ดาวน์โหลด ' + dateFormat.format(clickedAt) + ' · ' + timeFormat.format(clickedAt) + ' น.';
  header.append(source.cloneNode(true),time);
  const liveCards = main.querySelector('.cards');
  const cards = liveCards.cloneNode(true);
  const iconColors = [...liveCards.querySelectorAll('.theme-stat-icon')].map(icon=>getComputedStyle(icon).color);
  cards.querySelectorAll('.theme-stat-icon svg').forEach((icon,index)=>icon.setAttribute('stroke',iconColors[index]));
  const charts = main.querySelector('.charts').cloneNode(true);
  charts.querySelector('#downloadDashboardImage').remove();
  donutImage(charts);
  return [header,cards,charts];
 }

 async function save(canvas,clickedAt){
  const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/png'));
  if(!blob)throw new Error('PNG_ENCODING_FAILED');
  const url = URL.createObjectURL(blob);
  try{
   const link=document.createElement('a');
   link.href=url;
   link.download='Complain-Dashboard-'+fileDateFormat.format(clickedAt).replace(/[ :]/g,'-')+'.png';
   document.body.append(link);
   link.click();
   link.remove();
  }finally{
   setTimeout(()=>URL.revokeObjectURL(url),30_000);
  }
 }

 button.addEventListener('click',async()=>{
  if(button.disabled)return;
  if(main.querySelector('#nTotal')?.textContent==='—'){
   status.textContent='กรุณารอให้ข้อมูลกราฟโหลดก่อนดาวน์โหลดรูป';
   return;
  }
  const clickedAt = new Date();
  button.disabled=true;
  button.textContent='กำลังสร้างรูป…';
  status.textContent='';
  try{
   const panels = snapshot(clickedAt);
   if(!window.html2canvas){
    await QAFeatureScript.load('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
   }
   const canvas = await window.html2canvas(main,{
    windowWidth:1440,windowHeight:1000,scrollX:0,scrollY:0,scale:2,logging:false,
    onclone(doc,area){
     area.replaceChildren(...panels.map(panel=>doc.importNode(panel,true)));
     area.classList.add('qa-dashboard-image');
     doc.body.append(area);
    }
   });
   await save(canvas,clickedAt);
  }catch{
   status.textContent='ดาวน์โหลดรูปไม่สำเร็จ กรุณาลองใหม่';
  }finally{
   button.disabled=false;
   button.textContent='ดาวน์โหลดรูป';
  }
 });
})();
