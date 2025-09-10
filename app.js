// --- グローバル変数 ---
const staffInput = document.getElementById("staffId");
const nameInput = document.getElementById("name");
const passInput = document.getElementById("staffPass");
let staffList = [];

const form = document.getElementById("leaveForm");
const leaveTableBody = document.querySelector("#leaveTable tbody");
const dateInput = document.getElementById("date");
const remainingCount = document.getElementById("remainingCount");
const dateScroll = document.getElementById("dateScroll");
const viewDateInput = document.createElement("input");
viewDateInput.type = "hidden";

const leaveData = {};   // { date: [ {name, type, time, hours} ] }
const dailyMax = {};    // 日付別人数上限
let currentUserName = "";
const staffRemaining = {}; // { staffId: 残日数 }

const personalSection = document.getElementById("personalPage");
const myLeaveList = document.getElementById("myLeaveList");
const myRemaining = document.getElementById("myRemaining");

// --- 管理者 ---
const adminPass = "admin123";
let isAdmin = false;
const adminLoginBtn = document.getElementById("adminLogin");
const adminPanel = document.getElementById("adminPanel");

// --- staff.json 読み込み ---
fetch("staff.json")
  .then(res => res.json())
  .then(data => {
    staffList = data;
    staffList.forEach(s => staffRemaining[s.id] = 20); // デフォ20日
  });

// --- 職員番号で自動入力 ---
staffInput.addEventListener("input", () => {
  const staff = staffList.find(s => s.id === staffInput.value.trim());
  nameInput.value = staff ? staff.name : "";
  passInput.value = "";
});

// --- 管理者ログイン ---
adminLoginBtn.addEventListener("click", () => {
  const passVal = document.getElementById("adminPass").value;
  if(passVal === adminPass){ alert("管理者ログイン成功"); adminPanel.style.display="block"; isAdmin=true; }
  else { alert("パスワード違います"); isAdmin=false; }
});

// --- 日付制限 ---
const today = new Date();
dateInput.min = today.toISOString().slice(0,10);
const maxDate = new Date(today.getFullYear(), today.getMonth()+3,0);
dateInput.max = maxDate.toISOString().slice(0,10);

// --- 日付ボタン生成 ---
function generateDateButtons(){
  dateScroll.innerHTML = "";
  for(let d=new Date(today); d<=maxDate; d.setDate(d.getDate()+1)){
    const btn = document.createElement("button");
    btn.textContent = `${d.getMonth()+1}/${d.getDate()}`;
    const iso = d.toISOString().slice(0,10);
    btn.addEventListener("click", ()=>{ viewDateInput.value=iso; renderTable(iso); updateRemaining(iso); });
    dateScroll.appendChild(btn);
  }
}
generateDateButtons();

// --- AM/PMカウント ---
function countTimeSlots(list){
  let AM=0, PM=0;
  list.forEach(item=>{
    if(item.type!=="しだい"){
      if(item.time==="AM") AM+=item.hours;
      else if(item.time==="PM") PM+=item.hours;
      else if(item.time==="全日"){ AM+=4; PM+=4; }
    }
  });
  return {AM, PM};
}

// --- 残り人数 ---
function updateRemaining(date){
  const list = leaveData[date] || [];
  const max = dailyMax[date] || 10;
  const counts = countTimeSlots(list);
  remainingCount.innerHTML = `AM: <span>${Math.max(0,max-counts.AM)}</span>人 / PM: <span>${Math.max(0,max-counts.PM)}</span>人`;
}

// --- 表描画 ---
function renderTable(date){
  leaveTableBody.innerHTML = "";
  const list = leaveData[date] || [];
  list.forEach((item,i)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i+1}</td><td>${item.name}</td><td class="${item.type}">${item.type}</td><td>${item.time}</td>`;
    const tdOp = document.createElement("td");
    if(isAdmin){
      const delBtn = document.createElement("button");
      delBtn.textContent="削除"; delBtn.className="deleteBtn";
      delBtn.addEventListener("click", ()=>deleteLeave(date,i));
      tdOp.appendChild(delBtn);
    } else if(item.name===currentUserName && new Date(date)>=today){
      const cancelBtn = document.createElement("button");
      cancelBtn.textContent="取り消し"; cancelBtn.className="cancelBtn";
      cancelBtn.addEventListener("click", ()=>deleteLeave(date,i));
      tdOp.appendChild(cancelBtn);
    }
    tr.appendChild(tdOp);
    leaveTableBody.appendChild(tr);
  });
}

// --- 削除処理 ---
function deleteLeave(date,index){
  const item = leaveData[date][index];
  if(item.type==="年休") staffRemaining[staffList.find(s=>s.name===item.name).id] += item.hours/4;
  leaveData[date].splice(index,1);
  renderTable(date); updateRemaining(date); showPersonalPage(currentUserName);
}

// --- 休み追加 ---
form.addEventListener("submit", e=>{
  e.preventDefault();
  const staff = staffList.find(s=>s.id===staffInput.value.trim());
  if(!staff){ alert("職員番号が正しくありません"); return; }
  if(passInput.value!==staff.password){ alert("パスワードが正しくありません"); return; }

  const name = nameInput.value; currentUserName = name;
  const date = dateInput.value;
  const type = document.getElementById("leaveType").value;
  const time = document.getElementById("leaveTime").value;
  const hours = Number(document.getElementById("leaveHours")?.value || 4); // 1~4時間

  if(!leaveData[date]) leaveData[date]=[];

  // 年休残数チェック
  if(type==="年休" && staffRemaining[staff.id] < hours/4){ alert("残り年休が足りません"); return; }

  // 同日重複防止（同時間帯）
  if(leaveData[date].some(item=>item.name===name && item.time===time && item.type!=="しだい")){
    alert("同じ時間帯で既に登録済みです"); return;
  }

  // 人数上限チェック
  const max = dailyMax[date]||10;
  const counts = countTimeSlots(leaveData[date]);
  let actualType = type;
  if((time==="AM" && counts.AM>=max) || (time==="PM" && counts.PM>=max) || (time==="全日" && (counts.AM>=max||counts.PM>=max))){
    actualType="しだい";
  }

  leaveData[date].push({name,type:actualType,time,hours,origType:type});
  if(type==="年休") staffRemaining[staff.id] -= hours/4;

  renderTable(date); updateRemaining(date); showPersonalPage(name);
  form.reset();

  // --- スプレッドシート保存 ---
  fetch("https://script.google.com/macros/s/AKfycbzynZWpLkuW0kZqfrOSzoMs7Aplf6-53fJMm6n6QXw/dev",{
    method:"POST",
    body: JSON.stringify({name,date,leaveType:type,time,hours})
  });
});

// --- 個人ページ表示 ---
function showPersonalPage(userName){
  personalSection.style.display="block";
  myLeaveList.innerHTML="";
  let totalLeaves=0;
  for(const date in leaveData){
    leaveData[date].forEach(item=>{
      if(item.name===userName){
        const tr = document.createElement("tr");
        tr.innerHTML=`<td>${date}</td><td>${item.type}</td><td>${item.time}</td>`;
        myLeaveList.appendChild(tr);
        if(item.type==="年休") totalLeaves+=item.hours/4;
      }
    });
  }
  const staff = staffList.find(s=>s.name===userName);
  if(staff) myRemaining.textContent = staffRemaining[staff.id];
}

// --- 初期表示 ---
viewDateInput.value = today.toISOString().slice(0,10);
renderTable(viewDateInput.value); updateRemaining(viewDateInput.value);

// --- スプレッドシートからデータ取得して反映 ---
async function loadFromSheet(){
  try{
    const res = await fetch("https://script.google.com/macros/s/AKfycbzynZWpLkuW0kZqfrOSzoMs7Aplf6-53fJMm6n6QXw/dev");
    const data = await res.json();
    data.forEach(item=>{
      if(!leaveData[item.date]) leaveData[item.date]=[];
      leaveData[item.date].push({
        name:item.name,
        type:item.leaveType,
        time:item.time,
        hours:Number(item.hours),
        origType:item.leaveType
      });
    });
    renderTable(viewDateInput.value);
    updateRemaining(viewDateInput.value);
  }catch(e){ console.error(e); }
}

// ページロード時に呼び出す
loadFromSheet();
