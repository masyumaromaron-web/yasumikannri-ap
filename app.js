const staffInput = document.getElementById("staffId");
const nameInput = document.getElementById("name");
const passInput = document.getElementById("staffPass");
const form = document.getElementById("leaveForm");
const leaveTableBody = document.querySelector("#leaveTable tbody");
const dateInput = document.getElementById("date");
const remainingCount = document.getElementById("remainingCount");
const dateScroll = document.getElementById("dateScroll");
const hourlyLeave = document.getElementById("hourlyLeave");

let staffList = [], leaveData = {}, staffRemaining = {}, currentUserName = "";
let isAdmin = false;
const MAX_PER_SLOT = 8; // 1日あたり最大人数

const GAS_URL = "https://script.google.com/macros/s/AKfycbzynZWpLkuW0kZqfrOSzoMs7Aplf6-53fJMm6n6QXw/dev";

// --- staff.json 読み込み ---
fetch("staff.json")
  .then(res => res.json())
  .then(data => {
    staffList = data;
    staffList.forEach(s => staffRemaining[s.id]=20);
  });

// --- 職員番号で名前自動入力 ---
staffInput.addEventListener("input", ()=>{
  const staff = staffList.find(s=>s.id===staffInput.value.trim());
  nameInput.value = staff ? staff.name : "";
  passInput.value="";
});

// --- 日付ボタン生成 ---
function generateDateButtons(){
  dateScroll.innerHTML="";
  const today = new Date();
  const maxDate = new Date(today.getFullYear(), today.getMonth()+3,0);
  for(let d=new Date(today); d<=maxDate; d.setDate(d.getDate()+1)){
    const day = d.getDay();
    if(day===0||day===6) continue; // 土日は非表示
    const btn=document.createElement("button");
    const weekday=["日","月","火","水","木","金","土"];
    btn.textContent=`${d.getMonth()+1}/${d.getDate()}(${weekday[day]})`;
    const iso=d.toISOString().slice(0,10);
    btn.addEventListener("click",()=>{ renderTable(iso); });
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
      else if(item.time==="全日"){ AM+=8; PM+=8; }
    }
  });
  return {AM, PM};
}

// --- 残数更新 ---
function updateRemaining(date){
  const list = leaveData[date]||[];
  const counts = countTimeSlots(list);
  remainingCount.innerHTML=`AM: <span>${Math.max(0,MAX_PER_SLOT-counts.AM)}</span>人 / PM: <span>${Math.max(0,MAX_PER_SLOT-counts.PM)}</span>人`;
}

// --- 表描画 ---
function renderTable(date){
  leaveTableBody.innerHTML="";
  const list = leaveData[date]||[];
  list.forEach((item,i)=>{
    const tr = document.createElement("tr");
    tr.innerHTML=`<td>${i+1}</td><td>${item.name}</td><td>${item.type}</td><td>${item.time}</td><td>${item.hours}</td>`;
    leaveTableBody.appendChild(tr);
  });
  updateRemaining(date);
}

// --- 管理者ログイン ---
function adminLogin(pass){
  if(pass==="admin123"){ // 管理者パスワード
    isAdmin = true;
    alert("管理者権限取得");
  } else {
    alert("パスワード違います");
  }
}

// --- 休み追加 ---
form.addEventListener("submit", e=>{
  e.preventDefault();
  const staff = staffList.find(s=>s.id===staffInput.value.trim());
  if(!staff){ alert("職員番号が正しくありません"); return; }
  if(passInput.value!==staff.password && !isAdmin){ alert("パスワードが正しくありません"); return; }

  const name=nameInput.value;
  currentUserName=name;
  const date=dateInput.value;
  let type=document.getElementById("leaveType").value;
  const time=document.getElementById("leaveTime").value;
  const hours=parseInt(hourlyLeave.value);

  if(!leaveData[date]) leaveData[date]=[];

  // 1日人数上限チェック
  const counts = countTimeSlots(leaveData[date]);
  if(time==="AM" && counts.AM+hours>MAX_PER_SLOT) type="しだい";
  if(time==="PM" && counts.PM+hours>MAX_PER_SLOT) type="しだい";
  if(time==="全日" && (counts.AM+8>MAX_PER_SLOT || counts.PM+8>MAX_PER_SLOT)) type="しだい";

  if(type==="年休" && staffRemaining[staff.id]<hours){ alert("残り年休が足りません"); return; }

  leaveData[date].push({name,type,time,hours});
  if(type==="年休") staffRemaining[staff.id]-=hours;

  renderTable(date);

  // --- GASに送信 ---
  fetch(GAS_URL,{ method:"POST", body:JSON.stringify({date,name,type,time,hours})})
    .then(res=>res.json())
    .then(d=>console.log(d));

  form.reset();
});
