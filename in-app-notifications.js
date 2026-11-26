(() => {
 'use strict';
 const bell = document.getElementById('qaBell');
 if(!bell) return;
 const get = id => document.getElementById(id);
 const inbox = get('qaInboxPopover');
 const recent = get('qaInboxRecent');
 const history = get('qaInboxHistory');
 const historyList = get('qaInboxHistoryList');
 const more = get('qaInboxMore');
 const historyMode = new URLSearchParams(location.search).get('view') === 'notifications';
 const titles = {
  CREATED:'มีปัญหาใหม่', ACCEPT:'แผนกรับงานแล้ว', REQUEST_APPROVAL:'ส่งให้หัวหน้าแผนกตรวจ',
  APPROVE:'อนุมัติคำตอบแล้ว', HEAD_SEND:'ส่งคำตอบให้ตรวจรับ', RETURN:'หัวหน้าส่งกลับให้แก้ไข',
  REQUESTER_PASS:'ตรวจรับผ่านและปิดงานแล้ว', REQUESTER_FAIL:'ผู้แจ้งส่งกลับให้แก้ไข',
  ADMIN_ROLLBACK:'System Admin ส่งกลับให้แก้ไข', UNRELATED_REQUEST:'ขอเปลี่ยนฝ่ายรับเรื่อง',
  UNRELATED_CONFIRM:'ยืนยันการเปลี่ยนฝ่ายรับเรื่อง', UNRELATED_REJECT:'ไม่อนุมัติการเปลี่ยนฝ่ายรับเรื่อง',
  UNRELATED_CHANGE_RECEIVER:'เปลี่ยนฝ่ายรับเรื่องแล้ว', UNRELATED_RESTORE_ORIGINAL:'คืนงานให้แผนกเดิม'
 };
 const fieldTitles = {problem:'รายละเอียดปัญหา',analysis:'วิเคราะห์สาเหตุ',fix:'การแก้ปัญหา',prevent:'การป้องกัน'};
 const thaiDate = new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 let lastItem = null, loading = false, ready = false, refreshNeeded = false;
 function node(tag,className,value){
  const result = document.createElement(tag);
  if(className) result.className=className;
  if(value!==undefined) result.textContent=value;
  return result;
 }
 function title(item){
  return item.kind==='ADMIN_COMMENT'?'แอดมินคอมเมนต์ที่'+(fieldTitles[item.field]||'ใบงาน'):(titles[item.kind]||'อัปเดตใบงาน');
 }
 function entry(item){
  const li=node('li');
  const link=node('a','qa-inbox-entry'+(item.read_at?' is-read':''));
  const query=new URLSearchParams({id:item.job_id,notice:item.id});
  if(historyMode) query.set('from','notifications');
  link.href='vnext-job.html?'+query;
  const dot=node('span','qa-inbox-dot');
  dot.setAttribute('aria-hidden','true');
  const content=node('div');
  const heading=node('div','qa-inbox-row-title');
  const time=node('time','',thaiDate.format(new Date(item.created_at)));
  time.dateTime=item.created_at;
  heading.append(node('strong','',title(item)),time);
  content.append(heading,node('p','qa-inbox-sample',item.summary||''),node('p','qa-inbox-meta',item.job_code+(item.read_at?' · อ่านแล้ว':'')));
  link.append(dot,content);
  li.append(link);
  return li;
 }
 function setCount(count){
  const badge=get('qaBellCount');
  badge.hidden=count<1;
  badge.textContent=count>99?'99+':String(count);
  bell.setAttribute('aria-label',count?'การแจ้งเตือน ยังไม่อ่าน '+count+' รายการ':'การแจ้งเตือน');
  get('qaInboxCountText').textContent=count?'ยังไม่อ่าน '+count+' รายการ':'อ่านครบแล้ว';
 }
 async function load(append=false){
  if(!ready||append&&!lastItem)return;
  if(loading){
   if(!append)refreshNeeded=true;
   return;
  }
  loading=true;
  more.disabled=true;
  const message=get(historyMode?'qaInboxHistoryStatus':'qaInboxStatus');
  try{
   const args={p_limit:historyMode?20:6};
   if(append){
    args.p_before=lastItem.created_at;
    args.p_before_id=lastItem.id;
   }
   const {data,error}=await QA.client.rpc('qa_in_app_notifications_v1',args);
   if(error)throw error;
   const items=data.items||[];
   setCount(Number(data.unread_count)||0);
   if(!append){
    recent.replaceChildren(...items.slice(0,6).map(entry));
    get('qaInboxStatus').textContent=items.length?'':'ยังไม่มีการแจ้งเตือน';
   }
   if(historyMode){
    if(!append)historyList.replaceChildren();
    const present=new Set([...historyList.querySelectorAll('a')].map(link=>link.href));
    for(const item of items){
     const row=entry(item);
     if(!present.has(row.firstElementChild.href))historyList.append(row);
    }
    lastItem=items.at(-1)||null;
    more.hidden=!data.has_more;
   }
   message.textContent=items.length||append?'':'ยังไม่มีการแจ้งเตือน';
  }catch(error){
   message.textContent=['PGRST202','42883'].includes(String(error?.code||''))?
    'กรุณาติดตั้ง SQL การแจ้งเตือนก่อนใช้งาน':'โหลดการแจ้งเตือนไม่สำเร็จ กรุณาลองอีกครั้ง';
   if(historyMode&&historyList.children.length===0){more.hidden=false;lastItem=null;}
  }finally{
   loading=false;
   more.disabled=false;
   if(refreshNeeded){refreshNeeded=false;void load();}
  }
 }
 function show(open){
  inbox.hidden=!open;
  bell.setAttribute('aria-expanded',String(open));
  if(open)void load();
 }
 bell.addEventListener('click',()=>show(inbox.hidden));
 more.addEventListener('click',()=>void load(lastItem!==null));
 document.addEventListener('click',event=>{if(!event.target.closest('.qa-inbox-anchor'))show(false);});
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!inbox.hidden){show(false);bell.focus();}
 });
 window.addEventListener('pageshow',event=>{
  if(event.persisted){
   get('qaBellCount').hidden=true;
   show(false);
   void load();
  }
 });
 if(historyMode)history.hidden=false;
 async function init(){
  if(!window.QA?.whenReady)return;
  try{await QA.whenReady();}catch{return;}
  ready=true;
  void load();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void load();});
  if(!historyMode){
   window.addEventListener('focus',()=>{if(!document.hidden)void load();});
   setInterval(()=>{if(!document.hidden)void load();},15000);
  }
 }
 void init();
})();
