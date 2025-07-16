// --- 전역 변수 및 상수 ---
let vocabularyData = [];
let addedSets = new Set();
let incorrectCounts = {};
const API_BASE_URL = 'https://jlpt-voca-webapp-v2.onrender.com/api';

// --- 데이터 동기화 기능 ---
async function loadDataFromServer() {
    try {
        const response = await fetch(`${API_BASE_URL}/data`);
        if (!response.ok) throw new Error('서버 응답 오류');
        const data = await response.json();
        
        vocabularyData = data.vocabularyData || [];
        addedSets = new Set(data.addedSets || []);
        incorrectCounts = data.incorrectCounts || {};

        createSetButtons();
        renderVocabulary();
    } catch (error) {
        console.error('데이터 로딩 실패:', error);
        document.getElementById('vocabularyList').innerHTML = `<div class="empty-state"><h3>서버에 연결할 수 없습니다.</h3><p>백엔드 서버가 실행 중인지 확인해주세요.</p></div>`;
        createSetButtons();
    }
}

async function postRequest(endpoint, body) {
    try {
        await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    } catch (error) {
        console.error(`${endpoint} 요청 실패:`, error);
    }
}

// --- 단어 추가 및 관리 ---
function addWords(text) {
    const batchText = text || document.getElementById('batchInput').value.trim();
    if (!batchText) return;

    const newWords = [];
    const lines = batchText.split('\n').filter(line => line.trim());
    lines.forEach((line, index) => {
        const parts = line.split(',').map(part => part.trim());
        if (parts.length >= 4) {
            const [japanese, ...rest] = parts;
            if (japanese && !vocabularyData.some(word => word.japanese === japanese)) {
                const newWord = { id: Date.now() + index, japanese, parts: rest };
                newWords.push(newWord);
                if (incorrectCounts[japanese] === undefined) {
                    incorrectCounts[japanese] = 0;
                }
            }
        }
    });

    if (newWords.length > 0) {
        if (!text) document.getElementById('batchInput').value = '';
        vocabularyData.push(...newWords);
        renderVocabulary();
        postRequest('/words/add', { words: newWords, sets: Array.from(addedSets) });
    }
}

async function deleteWord(event, wordId) {
    event.stopPropagation();
    const word = vocabularyData.find(w => w.id === wordId);
    if (word) {
        vocabularyData = vocabularyData.filter(w => w.id !== wordId);
        renderVocabulary();
        try {
            await fetch(`${API_BASE_URL}/words/${wordId}`, { method: 'DELETE' });
        } catch (error) { console.error('단어 삭제 요청 실패:', error); }
    }
}

// ✨ 여기가 최종 수정된 함수입니다.
function deleteAllWords() {
    if (vocabularyData.length === 0) return;
    vocabularyData = [];
    addedSets.clear();
    incorrectCounts = {};
    renderVocabulary();
    updateSetButtons();
    // '데이터 교체'를 위한 올바른 API 주소로 요청을 보냅니다.
    postRequest('/data/replace', { vocabularyData, addedSets: [], incorrectCounts });
}

function shuffleWords() {
    if (vocabularyData.length < 2) return;
    for (let i = vocabularyData.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [vocabularyData[i], vocabularyData[j]] = [vocabularyData[j], vocabularyData[i]];
    }
    renderVocabulary();
    // '데이터 교체'를 위한 올바른 API 주소로 요청을 보냅니다.
    postRequest('/data/replace', { vocabularyData, addedSets: Array.from(addedSets), incorrectCounts });
}

function markIncorrect(event, wordId) {
    event.stopPropagation();
    const word = vocabularyData.find(w => w.id === wordId);
    if (word) {
        const japaneseWord = word.japanese;
        const newCount = (incorrectCounts[japaneseWord] || 0) + 1;
        incorrectCounts[japaneseWord] = newCount;
        renderVocabulary();
        postRequest('/incorrect/update', { word: japaneseWord, count: newCount });
    }
}

function addWordSet(setKey) {
    const setNumber = String(setKey);
    if (addedSets.has(setNumber) || !wordSets[setNumber]) return;
    addWords(wordSets[setNumber]);
    addedSets.add(setNumber);
    updateSetButtons();
}

function addWordsFromTextarea() { addWords(); }
function addAllSets() { if (typeof wordSets === 'undefined') return; const allSetKeys = Object.keys(wordSets); let combinedText = ''; allSetKeys.forEach(key => { if (!addedSets.has(String(key))) { combinedText += wordSets[key] + '\n'; addedSets.add(String(key)); } }); if (combinedText) { addWords(combinedText); updateSetButtons(); } }
function addRange() { const start = parseInt(document.getElementById('startNum').value); const end = parseInt(document.getElementById('endNum').value); if (!start || !end || start > end) return; let combinedText = ''; for (let i = start; i <= end; i++) { const setKey = String(i); if (wordSets && wordSets[setKey] && !addedSets.has(setKey)) { combinedText += wordSets[setKey] + '\n'; addedSets.add(setKey); } } if (combinedText) { addWords(combinedText); updateSetButtons(); } }

// --- UI 렌더링 및 조작 ---
function renderVocabulary() { const listContainer = document.getElementById('vocabularyList'); document.getElementById('deleteAllBtn').disabled = vocabularyData.length === 0; document.getElementById('shuffleBtn').disabled = vocabularyData.length < 2; if (vocabularyData.length === 0) { listContainer.innerHTML = `<div class="empty-state"><h3>저장된 단어가 없습니다.</h3><p>단어 세트를 추가하거나 직접 입력해보세요.</p></div>`; return; } listContainer.innerHTML = vocabularyData.map(word => { const [korean, hiragana, pronunciation, ...kanjiReadings] = word.parts; const kanjiChars = word.japanese.match(/[\u4e00-\u9faf]/g) || []; const kanjiHtml = kanjiChars.map((char, index) => { const reading = (kanjiReadings && kanjiReadings[index]) ? kanjiReadings[index].replace(/:/g, '') : ''; return `<div class="kanji-item"><span class="kanji-char">${char}</span><span class="kanji-reading">${reading}</span></div>`; }).join(''); const count = incorrectCounts[word.japanese] || 0; const incorrectBadge = count > 0 ? `<span class="incorrect-badge" title="틀린 횟수">${count}</span>` : ''; return `<div class="vocab-item" id="item-${word.id}" onclick="toggleDetails(${word.id})"><div class="vocab-header"><div><span class="japanese-word">${word.japanese}</span>${incorrectBadge}</div><div><button class="incorrect-btn" onclick="markIncorrect(event, ${word.id})">오답</button><button class="delete-btn" onclick="deleteWord(event, ${word.id})">&times;</button></div></div><div class="vocab-details" id="details-${word.id}"><div class="vocab-main-details"><p class="detail-line"><strong>뜻:</strong> ${korean}</p><p class="detail-line"><strong>히라가나:</strong> ${hiragana}</p><p class="detail-line"><strong>발음:</strong> ${pronunciation}</p></div>${kanjiHtml ? `<div class="kanji-details">${kanjiHtml}</div>` : ''}</div></div>`; }).join(''); }
function toggleDetails(wordId) { const detailsElement = document.getElementById(`details-${wordId}`); const itemElement = document.getElementById(`item-${wordId}`); if (detailsElement && itemElement) { detailsElement.classList.toggle('show'); itemElement.classList.toggle('revealed'); } }
function createSetButtons() { const buttonContainer = document.getElementById('wordSetButtons'); if (!buttonContainer || typeof wordSets === 'undefined') return; const setKeys = Object.keys(wordSets); buttonContainer.innerHTML = ''; setKeys.forEach(key => { const button = document.createElement('button'); button.className = 'set-btn'; button.textContent = key; button.onclick = () => addWordSet(key); if (addedSets.has(key)) { button.classList.add('added'); button.disabled = true; } buttonContainer.appendChild(button); }); }
function updateSetButtons() { const buttons = document.querySelectorAll('.set-btn'); buttons.forEach(button => { const setKey = button.textContent; if (addedSets.has(setKey)) { button.classList.add('added'); button.disabled = true; } else { button.classList.remove('added'); button.disabled = false; } }); }

// --- 페이지 초기화 ---
document.addEventListener('DOMContentLoaded', () => {
    createSetButtons();
    loadDataFromServer();
});