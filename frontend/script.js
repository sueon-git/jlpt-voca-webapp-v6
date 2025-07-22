let vocabularyData = [], addedSets = new Set(), incorrectCounts = {};
let availableSets = [];
const API_BASE_URL = 'https://jlpt-voca-webapp-v3.onrender.com/api';

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
        
        createSetButtons();
        renderVocabulary();
    } catch (error) {
        console.error('앱 초기화 실패:', error);
    }
}

async function postRequest(endpoint, body) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        return response.ok;
    } catch (error) { console.error(`${endpoint} 요청 실패:`, error); return false; }
}

async function addSetToDatabase() {
    const batchText = document.getElementById('batchInput').value.trim();
    if (!batchText) return alert("입력창에 추가할 세트 정보를 입력해주세요.");
    
    const match = batchText.match(/^'(\d+)':\s*`([\s\S]*)`$/);
    if (!match) return alert("형식이 올바르지 않습니다. (예: '82':`단어...`)");
    
    const key = match[1];
    const content = match[2].trim();

    const success = await postRequest('/wordsets', { key, content });
    if (success) {
        alert(`${key}번 세트가 데이터베이스에 성공적으로 등록되었습니다!`);
        document.getElementById('batchInput').value = '';
        await initializeApp();
    } else {
        alert('세트 등록에 실패했습니다.');
    }
}

async function addWordSet(setKey) {
    const setNumber = String(setKey);
    if (addedSets.has(setNumber)) return;
    const success = await postRequest(`/add-set-to-user/${setNumber}`);
    if (success) {
        await initializeApp();
    } else {
        alert(`${setNumber}번 세트 추가에 실패했습니다.`);
    }
}

async function markIncorrect(event, wordId) {
    event.stopPropagation();
    const word = vocabularyData.find(w => w.id === wordId);
    if (word) {
        const newCount = (incorrectCounts[word.japanese] || 0) + 1;
        const success = await postRequest('/incorrect/update', { word: word.japanese, count: newCount });
        if (success) {
            incorrectCounts[word.japanese] = newCount;
            renderVocabulary();
        }
    }
}

async function deleteAllWords() {
    if (vocabularyData.length === 0) return;
    if (confirm(`학습 목록의 모든 단어를 삭제하시겠습니까? (오답 기록은 유지됩니다)`)) {
        const success = await postRequest('/delete-all-words');
        if (success) await initializeApp();
    }
}

async function shuffleWords() {
    if (vocabularyData.length < 2) return;
    for (let i = vocabularyData.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [vocabularyData[i], vocabularyData[j]] = [vocabularyData[j], vocabularyData[i]];
    }
    const success = await postRequest('/shuffle-words', { shuffledVocabularyData: vocabularyData });
    if (success) await initializeApp();
}

function createSetButtons() {
    const buttonContainer = document.getElementById('wordSetButtons');
    buttonContainer.innerHTML = '';
    availableSets.sort((a, b) => a - b).forEach(key => {
        const button = document.createElement('button');
        button.className = 'set-btn';
        button.textContent = key;
        button.onclick = () => addWordSet(key);
        if (addedSets.has(key)) {
            button.classList.add('added');
            button.disabled = true;
        }
        buttonContainer.appendChild(button);
    });
}

function renderVocabulary() {
    const listContainer = document.getElementById('vocabularyList');
    document.getElementById('deleteAllBtn').disabled = vocabularyData.length === 0;
    document.getElementById('shuffleBtn').disabled = vocabularyData.length < 2;
    if (vocabularyData.length === 0) {
        listContainer.innerHTML = `<div class="empty-state"><h3>학습할 단어가 없습니다.</h3></div>`;
        return;
    }
    listContainer.innerHTML = vocabularyData.map(word => {
        const [korean, hiragana, pronunciation, ...kanjiReadings] = word.parts || [];
        const kanjiChars = word.japanese.match(/[\u4e00-\u9faf]/g) || [];
        const kanjiHtml = kanjiChars.map((char, index) => {
            const reading = (kanjiReadings && kanjiReadings[index]) ? kanjiReadings[index].replace(/:/g, '') : '';
            return `<div class="kanji-item"><span class="kanji-char">${char}</span><span class="kanji-reading">${reading}</span></div>`;
        }).join('');
        const count = incorrectCounts[word.japanese] || 0;
        const incorrectBadge = count > 0 ? `<span class="incorrect-badge">${count}</span>` : '';
        return `<div class="vocab-item" id="item-${word.id}" onclick="toggleDetails('${word.id}')"><div class="vocab-header"><div><span class="japanese-word">${word.japanese}</span>${incorrectBadge}</div><div><button class="incorrect-btn" onclick="markIncorrect(event, '${word.id}')">오답</button></div></div><div class="vocab-details" id="details-${word.id}"><div class="vocab-main-details"><p><strong>뜻:</strong> ${korean || ''}</p><p><strong>히라가나:</strong> ${hiragana || ''}</p><p><strong>발음:</strong> ${pronunciation || ''}</p></div>${kanjiHtml ? `<div class="kanji-details">${kanjiHtml}</div>` : ''}</div></div>`;
    }).join('');
}
function toggleDetails(wordId) { const detailsElement = document.getElementById(`details-${wordId}`); const itemElement = document.getElementById(`item-${wordId}`); if (detailsElement && itemElement) { detailsElement.classList.toggle('show'); itemElement.classList.toggle('revealed'); } }

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});