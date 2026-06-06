let currentLat = null;
let currentLon = null;
let mediaRecorder;
let audioChunks = [];
const UNLOCK_RADIUS = 15; // 设定解锁距离为 15 米

const statusEl = document.getElementById('location-status');
const recordBtn = document.getElementById('record-btn');
const stopBtn = document.getElementById('stop-btn');
const titleInput = document.getElementById('capsule-title');
const recordStatus = document.getElementById('record-status');
const capsulesList = document.getElementById('capsules-list');

// 1. 实时获取地理位置
if ("geolocation" in navigator) {
    navigator.geolocation.watchPosition(
        (position) => {
            currentLat = position.coords.latitude;
            currentLon = position.coords.longitude;
            statusEl.innerText = `当前坐标: ${currentLat.toFixed(4)}, ${currentLon.toFixed(4)}`;
            renderCapsules(); // 位置变动时重新计算距离
        },
        (error) => {
            statusEl.innerText = "定位失败，请确保开启了浏览器的位置权限。";
        },
        { enableHighAccuracy: true, maximumAge: 0 }
    );
} else {
    statusEl.innerText = "你的浏览器不支持地理定位。";
}

// 2. Haversine 公式计算两点距离 (米)
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; 
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// 3. 录音逻辑
recordBtn.addEventListener('click', async () => {
    if (!currentLat) return alert("请等待定位成功后再录音！");
    if (!titleInput.value) return alert("请先给胶囊起个名字！");

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = saveCapsule;

        mediaRecorder.start();
        recordBtn.innerText = "录音中...";
        recordBtn.classList.add('recording');
        recordBtn.disabled = true;
        stopBtn.disabled = false;
        recordStatus.innerText = "正在记录你的声音...";
    } catch (err) {
        alert("无法访问麦克风，请检查权限。");
    }
});

stopBtn.addEventListener('click', () => {
    mediaRecorder.stop();
    recordBtn.innerText = "🎤 开始录音";
    recordBtn.classList.remove('recording');
    recordBtn.disabled = false;
    stopBtn.disabled = true;
    recordStatus.innerText = "胶囊已埋藏！";
    setTimeout(() => recordStatus.innerText = "", 2000);
});

// 4. 将纯音频和坐标保存到本地
function saveCapsule() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = () => {
        const base64Audio = reader.result;
        const newCapsule = {
            id: Date.now(),
            title: titleInput.value,
            lat: currentLat,
            lon: currentLon,
            audio: base64Audio,
            timestamp: new Date().toLocaleString()
        };

        const existingCapsules = JSON.parse(localStorage.getItem('capsules') || '[]');
        existingCapsules.push(newCapsule);
        localStorage.setItem('capsules', JSON.stringify(existingCapsules));
        
        titleInput.value = "";
        renderCapsules();
    };
}

// 5. 渲染列表与解锁判定
function renderCapsules() {
    capsulesList.innerHTML = '';
    const existingCapsules = JSON.parse(localStorage.getItem('capsules') || '[]');

    if (existingCapsules.length === 0) {
        capsulesList.innerHTML = '<li style="text-align: center; color: #999;">附近空空如也，埋下第一个胶囊吧！</li>';
        return;
    }

    existingCapsules.forEach(capsule => {
        const li = document.createElement('li');
        let distance = 9999;
        
        if (currentLat && currentLon) {
            distance = getDistance(currentLat, currentLon, capsule.lat, capsule.lon);
        }

        const isUnlocked = distance <= UNLOCK_RADIUS;
        li.className = isUnlocked ? 'unlocked' : 'locked';

        let htmlContent = `
            <strong>${capsule.title}</strong>
            <span class="distance">距离你: ${distance === 9999 ? '计算中...' : Math.round(distance) + ' 米'}</span>
            <span style="font-size: 0.8em; color: #aaa;">埋藏于: ${capsule.timestamp}</span>
        `;

        if (isUnlocked) {
            htmlContent += `
                <div style="margin-top: 10px; color: #2ecc71; font-weight: bold;">🔓 已解锁！</div>
                <audio controls src="${capsule.audio}"></audio>
            `;
        } else {
            htmlContent += `
                <div style="margin-top: 10px; color: #e74c3c;">🔒 距离太远，请走近一些</div>
            `;
        }

        li.innerHTML = htmlContent;
        capsulesList.appendChild(li);
    });
}

// 初始渲染
renderCapsules();
