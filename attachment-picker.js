/* Local attachment selection. Nothing uploads until the caller saves/sends. */
(()=>{'use strict';
const photo=window.QAUploadPhoto;
const imageTypes=['image/jpeg','image/png','image/webp'],videoTypes=['video/mp4','video/webm'];
const preparingMessage='กำลังเตรียมรูป กรุณารอสักครู่';
function check(files,{images=0,videos=0}={},beforeResize=false){
 images=Number(images);videos=Number(videos);
 for(const file of files){
  if(beforeResize?photo.isImage(file):imageTypes.includes(file.type)){
   images++;
   if(!file.size)throw Error('ไฟล์รูปว่างเปล่า: '+file.name);
   if(!beforeResize&&file.size>photo.maxBytes)throw Error('รูปที่เตรียมเสร็จต้องไม่เกิน 5 MB ต่อรูป');
  }else if(videoTypes.includes(file.type)){
   videos++;
   if(file.size>52428800)throw Error('วิดีโอต้องไม่เกิน 50 MB ต่อคลิป');
  }else throw Error('รองรับ JPG, PNG, WebP, HEIC/HEIF, MP4 และ WebM');
 }
 if(images>5||videos>1)throw Error('แนบได้รวมสูงสุด 5 รูป และ 1 วิดีโอ กรุณาลบไฟล์เดิมก่อนเพิ่มเกินจำนวน');
}
function validate(files,existing){check(files,existing);return files;}
function merge(current,incoming,existing){return validate([...current,...incoming],existing);}
function prepare(current,incoming,existing){
 check([...current,...incoming],existing,true);
 if(incoming.every(file=>videoTypes.includes(file.type)||(imageTypes.includes(file.type)&&file.size<=photo.maxBytes)))return incoming;
 return (async()=>{
  const prepared=[];
  for(const file of incoming)prepared.push(videoTypes.includes(file.type)?file:await photo.prepare(file));
  merge(current,prepared,existing);
  return prepared;
 })();
}
let styled=false;function styles(){if(styled)return;styled=true;const s=document.createElement('style');s.textContent='.qa-pick-controls{display:flex;gap:16px;flex-wrap:wrap;margin:12px 0}.qa-pick-controls>label{flex:1;min-width:200px}.qa-pick-grid{display:flex;gap:10px;flex-wrap:wrap}.qa-pick-item{width:150px;border:1px solid #dce3ec;border-radius:9px;padding:8px;background:#f8fafc}.qa-pick-item img,.qa-pick-item video{width:100%;height:100px;object-fit:contain;background:white;border-radius:5px}.qa-pick-item textarea{width:100%;min-height:58px;font-size:12px}.qa-pick-item button{font-size:12px;padding:6px 9px}.qa-pick-count{font-size:13px;color:#64748b}.qa-pick-item .qa-pick-name{font-size:11px;word-break:break-all;margin:5px 0}';document.head.append(s);}
function mount(host,{entries=[],existing={},onChange=()=>{},onError=()=>{}}={}){styles();host.innerHTML='<div class="qa-pick-controls"><label>เพิ่มภาพ (รวมไม่เกิน 5 ภาพ)<input class="qa-pick-images" type="file" accept="'+photo.accept+'" multiple></label><label>เพิ่มวิดีโอ (รวมไม่เกิน 1 คลิป)<input class="qa-pick-video" type="file" accept="video/mp4,video/webm"></label></div><p class="qa-pick-count" role="status"></p><div class="qa-pick-grid"></div>';
let urls=[],preparing=false,destroyed=false;const revoke=()=>{urls.forEach(u=>URL.revokeObjectURL(u));urls=[];};
function changed(){onChange(entries);render();}
function render(){revoke();host.querySelector('.qa-pick-count').textContent=preparing?preparingMessage:entries.length?'ไฟล์ที่เลือกเพิ่ม '+entries.filter(e=>imageTypes.includes(e.file.type)).length+' รูป · '+entries.filter(e=>videoTypes.includes(e.file.type)).length+' วิดีโอ (ยังไม่ส่ง)':'เลือกรูปหรือวิดีโอเพิ่มได้หลายครั้ง ไฟล์เดิมจะอยู่จนกว่าจะกดลบ';const grid=host.querySelector('.qa-pick-grid');grid.replaceChildren();for(const entry of entries){const item=document.createElement('div');item.className='qa-pick-item';const image=imageTypes.includes(entry.file.type),media=document.createElement(image?'img':'video'),url=URL.createObjectURL(entry.file);urls.push(url);media.src=url;const full=QAMediaViewer.createTrigger(document,image?'IMAGE':'VIDEO',()=>url,image?{thumbnail:media}:{inlineVideo:media});if(image)media.alt=entry.file.name;else media.preload='metadata';const name=document.createElement('p');name.className='qa-pick-name';name.textContent=entry.file.name;const note=document.createElement('textarea');note.placeholder='หมายเหตุ';note.maxLength=2000;note.value=entry.note||'';note.oninput=()=>{entry.note=note.value;onChange(entries);};if(!image)item.append(media);item.append(full,name,note);if(image&&window.V38ImageEditor){const edit=document.createElement('button');edit.type='button';edit.textContent='แก้ไขรูป';edit.disabled=!!entry.attachmentId;edit.onclick=async()=>{try{const file=await V38ImageEditor.edit(entry.file);if(file){validate([file]);entry.file=file;changed();}}catch(e){onError(e.message);}};item.append(edit);}const remove=document.createElement('button');remove.type='button';remove.textContent='ลบ';remove.disabled=!!entry.attachmentId;if(entry.attachmentId){const saved=document.createElement('p');saved.className='qa-pick-count';saved.textContent='ไฟล์นี้บันทึกแล้ว · กดบันทึก/ส่งอีกครั้งเพื่อทำรายการต่อ';item.append(saved);}remove.onclick=()=>{entries.splice(entries.indexOf(entry),1);changed();};item.append(remove);grid.append(item);}}
const fileInputs=[...host.querySelectorAll('input[type=file]')];
for(const input of fileInputs)input.onchange=async()=>{
 if(destroyed||preparing)return;
 const added=[...input.files];
 let accepted=false;
 input.value='';
 if(!added.length)return;
 try{
  let prepared=prepare(entries.map(e=>e.file),added,typeof existing==='function'?existing():existing);
  if(!Array.isArray(prepared)){
   preparing=true;
   fileInputs.forEach(field=>field.disabled=true);
   host.querySelector('.qa-pick-count').textContent=preparingMessage;
   prepared=await prepared;
  }
  if(destroyed)return;
  entries.push(...prepared.map(file=>({id:crypto.randomUUID(),file,note:''})));
  accepted=true;
 }catch(e){if(!destroyed)onError(e.message);}
 finally{
  if(!destroyed){
   if(preparing)fileInputs.forEach(field=>field.disabled=false);
   preparing=false;
   if(accepted)onChange(entries);
   render();
  }
 }
};
render();
return {entries,render,isPreparing:()=>preparing&&!destroyed,destroy(){destroyed=true;revoke();}};
}
window.QAMediaPicker={validate,merge,prepare,mount,preparingMessage};
})();
