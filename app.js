// --- 初期設定 ---
const staffInput = document.getElementById("staffId");
const nameInput = document.getElementById("name");
const passInput = document.getElementById("staffPass");
const leaveForm = document.getElementById("leaveForm");
const leaveTableBody = document.querySelector("#leaveTable tbody");
const dateInput = document.getElementById("date");
const remainingCount = document.getElementById("remainingCount");
const dateScroll = document.getElementById("dateScroll");
const leaveTypeInput = document.getElementById("leaveType");
const leaveTimeInput = document.getElementById("leaveTime");
const leaveHoursInput = document.getElementById("leaveHours");

const myLeaveList = document.getElementById("myLeaveList").querySelector("tbody");
const myRemaining = document.getElementById("myRemaining");

const adminLoginBtn = document.getElementById("adminLogin");
const adminPanel = document.getElementById("adminPanel");
const limitDateInput = document.getElementById("limitDate");
const limitNumberInput = document.getElementById("limitNumber");
const saveLimitBtn = document.getElementById("saveLimit");

// --- データ ---
let staffList = [];
let leaveData = JSON.parse(localStorage.getItem("leaveData")||"{}");
let dailyMax = JSON.parse(localStorage.getItem("dailyMax")||"{}");
let staffRemaining = {}; // {staffId: 残日数}
let currentUserName = "";
let isAdmin = false;

// --- staff.json 読み込み ---
fetch("staff.json").then(r=>r.json()).then(data=>{
  staffList = data;
  staffList.forEach(s=>staffRemaining[s.id]=20); // 初期20日
  loadLocal();
});

// --- localStorage復元 ---
function loadLocal(){
  const storedRem = JSON.parse(localStorage.getItem("staffRemaining")||"{}");
  Object.assign(staffRemaining, storedRem);
}

// --- 保存 ---
function saveLocal(){
  localStorage.setItem("leaveData", JSON.stringify(leaveData));
  localStorage.setItem("dailyMax", JSON.stringify(dailyMax));
  localStorage.setItem("staffRemaining", JSON.stringify(staffRemaining));
}

// --- 職員番号で名前自動入力 ---
staffInput.addEventListener("input",()=>{
  const s = staffList.find(x=>x.id===staffInput.value.trim());
  nameInput.value = s ? s.name : "";
  passInput.value = "";
});

// --- 日付ボタン生成 ---
function generateDateButtons(){
  dateScroll.innerHTML="";
  const today=new Date();
  const maxDate=new Date(today.getFullYear(),today.getMonth()+3,0);
  for(let d=new Date(today); d<=maxDate; d.setDate(d.getDate()+1)){
    const btn=document.createElement("button");
    btn.textContent=`${d.getMonth()+1}/${d.getDate()}`;
    const iso=d.toISOString().slice(0,10);
    btn.addEventListener("click",()=>{ renderTable(iso); updateRemaining(iso); });
    dateScroll.appendChild(btn);
  }
}
generateDateButtons();

// --- AM/PMカウント ---
function countTimeSlots(list){
  let AM=0, PM=0;
  list.forEach(item=>{
    if(item.type!=="しだい"){
      const h=item.hours||4;
      if(item.time==="AM") AM+=h;
      else if(item.time==="PM") PM+=h;
      else if(item.time==="全日"){ AM+=4; PM+=4; }
    }
  });
  return {AM, PM};
}

// --- 残り人数 ---
function updateRemaining(date){
  const list = leaveData[date]||[];
  const max = dailyMax[date]||10;
  const counts = countTimeSlots(list);
  const AMRemain=Math.max(0,max-counts.AM/4);
  const PMRemain=Math.max(0,max-counts.PM/4);
  remainingCount.innerHTML = `AM: <span>${AMRemain}</span>人 / PM: <span>${PMRemain}</span>人`;
}

// --- 表描画 ---
function renderTable(date){
  leaveTableBody.innerHTML="";
  const list = leaveData[date]||[];
  list.forEach((item,i)=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${i+1}</td><td>${item.name}</td><td class="${item.type}">${item.type}</td><td>${item.time}</td><td>${item.hours||"-"}</td>`;
    const tdOp=document.createElement("td");
    if(isAdmin){
      const delBtn=document.createElement("button");
      delBtn.textContent="削除"; delBtn.className="deleteBtn";
      delBtn.addEventListener("click",()=>{deleteLeave(date,i);});
      tdOp.appendChild(delBtn);
    } else if(item.name===currentUserName && new Date(date) >= new Date()){
      const cancelBtn=document.createElement("button");
      cancelBtn.textContent="取り消し"; cancelBtn.className="cancelBtn";
      cancelBtn.addEventListener("click",()=>{deleteLeave(date,i);});
      tdOp.appendChild(cancelBtn);
    }
    tr.appendChild(tdOp);
    leaveTableBody.appendChild(tr);
  });
}

// --- 削除 ---
function deleteLeave(date,index){
  const item = leaveData[date][index];
  if(item.type==="年休") staffRemaining[staffList.find(s=>s.name===item.name).id]+=(item.hours||4)/8;
  leaveData[date].splice(index,1);
  renderTable(date); updateRemaining(date); showPersonalPage(currentUserName);
  saveLocal();
}

// --- 個人ページ ---
function showPersonalPage(userName){
  currentUserName=userName;
  myLeaveList.innerHTML="";
  let totalHours=0;
  for(const date in leaveData){
    leaveData[date].forEach(item=>{
      if(item.name===userName){
        const tr=document.createElement("tr");
        tr.innerHTML=`<td>${date}</td><td>${item.type}</td><td>${item.time}</td><td>${item.hours||"-"}</td>`;
        myLeaveList.appendChild(tr);
        if(item.type==="年休") totalHours+=item.hours||4;
      }
    });
  }
  const staff=staffList.find(s=>s.name===userName);
  if(staff) myRemaining.textContent=(staffRemaining[staff.id]).toFixed(2);
}

// --- 休み追加 ---
leaveForm.addEventListener("submit",e=>{
  e.preventDefault();
  const staff = staffList.find(s=>s.id===staffInput.value.trim());
  if(!staff){ alert("職員番号が正しくありません"); return; }
  if(passInput.value!==staff.password){ alert("パスワードが正しくありません"); return; }

  const name=nameInput.value;
  const date=dateInput.value;
  let type=leaveTypeInput.value;
  const time=leaveTimeInput.value;
  const hours=type==="年休"?Number(leaveHoursInput.value):null;

  if(!leaveData[date]) leaveData[date]=[];

  // 年休残数チェック
  if(type==="年休" && staffRemaining[staff.id]*8 < hours){ alert("残り年休が足りません"); return; }

  // 同日重複チェック（時間被りのみ）
  const conflict=leaveData[date].some(item=>{
    if(item.name!==name) return false;
    if(item.type==="しだい") return false;
    if(item.time==="全日" || time==="全日") return true;
    return item.time===time;
  });
  if(conflict){ alert("同じ時間帯に登録済みです"); return; }

  // 上限超えチェック
  const max=dailyMax[date]||10;
  const counts=countTimeSlots(leaveData[date]);
  let actualType=type;
  if((time==="AM" && counts.AM/4+hours/4>max) || (time==="PM" && counts.PM/4+hours/4>max) || (time==="全日" && (counts.AM/4+4>max||counts.PM/4+4>max))) actualType="しだい";

  leaveData[date].push({name,type:actualType,time,hours});
  if(type==="年休") staffRemaining[staff.id]-=hours/8;

  renderTable(date); updateRemaining(date); showPersonalPage(name);
  saveLocal();
  leaveForm.reset();
});

// --- 管理者 ---
adminLoginBtn.addEventListener("click",()=>{
  const pass=document.getElementById("adminPass").value;
  if(pass==="admin123"){ alert("管理者ログイン成功"); adminPanel.style.display="block"; isAdmin=true; }
  else{ alert("パスワード違います"); }
});

// --- 上限人数設定 ---
saveLimitBtn.addEventListener("click",()=>{
  const d=limitDateInput.value; const n=Number(limitNumberInput.value);
  if(d && n>0){ dailyMax[d]=n; saveLocal(); alert("保存しました"); if(leaveData[d]) updateRemaining(d); }
});

// --- 日付制限 ---
const today=new Date();
dateInput.min=today.toISOString().slice(0,10);
const maxDate=new Date(today.getFullYear(),today.getMonth()+3,0);
dateInput.max=maxDate.toISOString().slice(0,10);

// --- 初期描画 ---
const firstDate=today.toISOString().slice(0,10);
renderTable(firstDate); updateRemaining(firstDate);
