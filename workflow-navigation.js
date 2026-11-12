/* Keep personal dashboard context in this tab; return only after completed handoffs. */
(()=>{'use strict';
const messages={REQUEST_APPROVAL:'ส่งให้หัวหน้าตรวจสอบแล้ว',HEAD_SEND:'ส่งงานแล้ว',APPROVE:'อนุมัติและส่งงานแล้ว',RETURN:'ส่งกลับให้แก้ไขแล้ว',REQUESTER_PASS:'ตรวจรับผ่านแล้ว',REQUESTER_FAIL:'ส่งกลับให้แก้ไขแล้ว',TRANSFER:'ส่งต่อแผนกแล้ว'};
const ttl=24*60*60*1000;
function key(){const id=window.QA?.profile?.user_id;return id?'qa-dashboard-return:'+id+':'+new URL('.',location.href).pathname:null;}
function read(){try{const k=key(),v=k&&JSON.parse(sessionStorage.getItem(k)||'null');return v&&Number.isFinite(v.at)&&Date.now()-v.at>=0&&Date.now()-v.at<ttl?v:null;}catch{return null;}}
function write(value){try{const k=key();if(k)sessionStorage.setItem(k,JSON.stringify(value));}catch{}}
function dashboardUrl(raw){try{const url=new URL(raw,location.href);if(url.origin===location.origin&&url.pathname===new URL('dashboard.html',location.href).pathname)return url.href;}catch{}return new URL('dashboard.html',location.href).href;}
function saveDashboard(state){write({at:Date.now(),url:dashboardUrl(location.href),state});}
function isTerminal(action){return Object.prototype.hasOwnProperty.call(messages,action);}
function home(action){if(!isTerminal(action))return false;const previous=read();write({...previous,at:Date.now(),pending:true,action});location.assign(dashboardUrl(previous?.url));return true;}
function takeReturn(){const previous=read();if(!previous?.pending||!isTerminal(previous.action))return null;write({...previous,pending:false});return {state:previous.state||null,message:messages[previous.action]};}
function showMessage(message){if(!message)return;let node=document.getElementById('qaActionResult');if(!node){node=document.createElement('p');node.id='qaActionResult';node.setAttribute('role','status');node.style.cssText='margin:0 0 12px;padding:10px 14px;border:1px solid #c6e7d6;border-radius:10px;background:#effaf3;color:#14603a;font-size:14px';(document.querySelector('main.main')||document.querySelector('main')||document.body).prepend(node);}node.textContent=message;}
window.QAReturn={saveDashboard,isTerminal,home,takeReturn,showMessage};
})();
