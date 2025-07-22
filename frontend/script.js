let vocabularyData = [], addedSets = new Set(), incorrectCounts = {};
let availableSets = []; // 추가 가능한 세트 목록
const API_BASE_URL = 'https://jlpt-voca-webapp-v3.onrender.com/api'; // v3 서버 주소

async function initializeApp() {
    try {
        const [userDataRes, setsDataRes] = await Promise.all([
            fetch(`${API_BASE_URL}/userdata`),
            fetch(`${API_BASE_URL}/wordsets`)
        ]);
        
        const userData = await userDataRes.json();
        const setsData = await setsDataRes.json();

        vocabularyData = userData.vocabularyData || [];
        addedSets = new Set(userData.addedSets || []);
        incorrectCounts = userData.incorrectCounts || {};
        availableSets = setsData || [];
        
        renderVocabulary();
        createSetButtons();
        updateSetButtons();

    } catch (error) {
        console.error('앱 초기화 실패:', error);
    }
}

// ✨ [핵심 변경] '일괄 추가'는 이제 새로운 세트를 DB에 생성하는 역할
async function addWordsFromTextarea() {
    const batchText = document.getElementById('batchInput').value.trim();
    if (!batchText) return;
    
    // '82:`...`' 형식에서 숫자와 내용을 분리
    const match = batchText.match(/^'(\d+)':\s*`([\s\S]*)`$/);
    if (!match) {
        return alert("형식이 올바르지 않습니다. (예: '82':`단어...`)");
    }
    const key = match[1];
    const content = match[2].trim();

    const response = await fetch(`${API_BASE_URL}/wordsets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, content })
    });

    if (response.ok) {
        alert(`${key}번 세트가 데이터베이스에 성공적으로 추가되었습니다!`);
        document.getElementById('batchInput').value = '';
        await initializeApp(); // 앱 전체를 다시 로드하여 새 버튼 표시
    } else {
        alert('세트 추가에 실패했습니다.');
    }
}

// ✨ [핵심 변경] 버튼 클릭 시, 해당 세트를 학습 목록에 추가하도록 서버에 요청
async function addWordSet(setKey) {
    const setNumber = String(setKey);
    if (addedSets.has(setNumber)) return;

    const response = await fetch(`${API_BASE_URL}/add-set-to-user/${setNumber}`, { method: 'POST' });

    if (response.ok) {
        await initializeApp(); // 학습 목록이 변경되었으므로 전체 다시 로드
    } else {
        alert(`${setNumber}번 세트 추가에 실패했습니다.`);
    }
}

function createSetButtons() {
    const buttonContainer = document.getElementById('wordSetButtons');
    buttonContainer.innerHTML = '';
    availableSets.sort((a, b) => a - b).forEach(key => { // 숫자 순으로 정렬
        const button = document.createElement('button');
        button.className = 'set-btn';
        button.textContent = key;
        button.onclick = () => addWordSet(key);
        buttonContainer.appendChild(button);
    });
}

// (나머지 함수들은 이전 버전과 거의 동일하게 작동하지만, 서버 통신 부분이 일부 변경됩니다)
// ... 생략 ...

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});