let vocabularyData = [], addedSets = new Set(), incorrectCounts = {};
let availableSets = []; // 추가 가능한 세트 목록
const API_BASE_URL = 'https://jlpt-voca-webapp-v3.onrender.com/api'; // v3 서버 주소

async function initializeApp() {
    try {
        const response = await fetch(`${API_BASE_URL}/data`);
        if (!response.ok) throw new Error('서버 응답 오류');
        const data = await response.json();
        vocabularyData = data.vocabularyData || [];
        addedSets = new Set(data.addedSets || []);
        incorrectCounts = data.incorrectCounts || {};
        renderVocabulary();
        createSetButtons();
        updateSetButtons();
    } catch (error) { console.error('데이터 로딩 실패:', error); }
}

async function postRequest(endpoint, body) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        return response.ok;
    } catch (error) { console.error(`${endpoint} 요청 실패:`, error); return false; }
}

async function handleAdd(newWords, newSetKeys = []) {
    if (newWords.length === 0) return;
    
    // 1. 먼저 화면에 낙관적으로 업데이트
    vocabularyData.push(...newWords);
    newSetKeys.forEach(key => addedSets.add(key));
    renderVocabulary();
    updateSetButtons();

    // 2. 서버에 '업무 지시'를 보냄
    postRequest('/words/add', { words: newWords, sets: newSetKeys });
}

function addWordSet(setKey) {
    const setNumber = String(setKey);
    if (addedSets.has(setNumber) || !wordSets[setKey]) return;
    const lines = wordSets[setNumber].split('\n').filter(line => line.trim());
    const newWords = [];
    lines.forEach((line, index) => {
        const parts = line.split(',').map(part => part.trim());
        if (parts.length >= 4) {
            const [japanese, ...rest] = parts;
            if (japanese && !vocabularyData.some(word => word.japanese === japanese)) {
                newWords.push({ id: Date.now() + index, japanese, parts: rest });
            }
        }
    });
    handleAdd(newWords, [setNumber]);
}

function addWordsFromTextarea() {
    const batchText = document.getElementById('batchInput').value.trim();
    if (!batchText) return;
    const newWords = [];
    const lines = batchText.split('\n').filter(line => line.trim());
    lines.forEach((line, index) => {
        const parts = line.split(',').map(part => part.trim());
        if (parts.length >= 4) {
            const [japanese, ...rest] = parts;
            if (japanese && !vocabularyData.some(word => word.japanese === japanese)) {
                newWords.push({ id: Date.now() + index, japanese, parts: rest });
            }
        }
    });
    if (newWords.length > 0) {
        document.getElementById('batchInput').value = '';
        addWords(newWords);
    }
}

function addAllSets() {
    if (typeof wordSets === 'undefined') return;
    const allSetKeys = Object.keys(wordSets);
    const newWords = [];
    const newSets = [];
    allSetKeys.forEach(key => {
        if (!addedSets.has(String(key))) {
            const lines = wordSets[key].split('\n').filter(line => line.trim());
            lines.forEach((line, index) => {
                const parts = line.split(',').map(part => part.trim());
                if (parts.length >= 4) {
                    const [japanese, ...rest] = parts;
                    if (japanese && !vocabularyData.some(word => word.japanese === japanese)) {
                        newWords.push({ id: Date.now() + index, japanese, parts: rest });
                        if (incorrectCounts[japanese] === undefined) incorrectCounts[japanese] = 0;
                    }
                }
            });
            newSets.push(key);
        }
    });
    if (newWords.length > 0) {
        addWords(newWords, newSets);
    }
}

function addRange() {
    const start = parseInt(document.getElementById('startNum').value);
    const end = parseInt(document.getElementById('endNum').value);
    if (!start || !end || start > end) return;
    const newWords = [];
    const newSets = [];
    for (let i = start; i <= end; i++) {
        const setKey = String(i);
        if (wordSets && wordSets[setKey] && !addedSets.has(setKey)) {
            const lines = wordSets[setKey].split('\n').filter(line => line.trim());
            lines.forEach((line, index) => {
                const parts = line.split(',').map(part => part.trim());
                if (parts.length >= 4) {
                    const [japanese, ...rest] = parts;
                    if (japanese && !vocabularyData.some(word => word.japanese === japanese)) {
                        newWords.push({ id: Date.now() + index, japanese, parts: rest });
                        if (incorrectCounts[japanese] === undefined) incorrectCounts[japanese] = 0;
                    }
                }
            });
            newSets.push(setKey);
        }
    }
    if (newWords.length > 0) {
        addWords(newWords, newSets);
    }
}

async function markIncorrect(event, wordId) {
    event.stopPropagation();
    const word = vocabularyData.find(w => w.id === wordId);
    if (word) {
        const japaneseWord = word.japanese;
        const newCount = (incorrectCounts[japaneseWord] || 0) + 1;
        incorrectCounts[japaneseWord] = newCount;
        renderVocabulary();
        await postRequest('/incorrect/update', { word: japaneseWord, count: newCount });
    }
}

async function deleteAllWords() {
    if (vocabularyData.length === 0) return;
    vocabularyData = [];
    addedSets.clear();
    incorrectCounts = {};
    renderVocabulary();
    updateSetButtons();
    await postRequest('/data/replace', { vocabularyData, addedSets: [], incorrectCounts });
}

async function shuffleWords() {
    if (vocabularyData.length < 2) return;
    for (let i = vocabularyData.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [vocabularyData[i], vocabularyData[j]] = [vocabularyData[j], vocabularyData[i]];
    }
    renderVocabulary();
    await postRequest('/data/replace', { vocabularyData, addedSets: Array.from(addedSets), incorrectCounts });
}

function renderVocabulary() { /* 이전과 동일 */ }
function toggleDetails(wordId) { /* 이전과 동일 */ }
function createSetButtons() { /* 이전과 동일 */ }
function updateSetButtons() { /* 이전과 동일 */ }
document.addEventListener('DOMContentLoaded', () => { createSetButtons(); loadDataFromServer(); });

// (편의상 생략된 함수들의 전체 코드)
function renderVocabulary() { const listContainer = document.getElementById('vocabularyList'); document.getElementById('deleteAllBtn').disabled = vocabularyData.length === 0; document.getElementById('shuffleBtn').disabled = vocabularyData.length < 2; if (vocabularyData.length === 0) { listContainer.innerHTML = `<div class="empty-state"><h3>저장된 단어가 없습니다.</h3></div>`; return; } listContainer.innerHTML = vocabularyData.map(word => { const [korean, hiragana, pronunciation, ...kanjiReadings] = word.parts; const kanjiChars = word.japanese.match(/[\u4e00-\u9faf]/g) || []; const kanjiHtml = kanjiChars.map((char, index) => { const reading = (kanjiReadings && kanjiReadings[index]) ? kanjiReadings[index].replace(/:/g, '') : ''; return `<div class="kanji-item"><span class="kanji-char">${char}</span><span class="kanji-reading">${reading}</span></div>`; }).join(''); const count = incorrectCounts[word.japanese] || 0; const incorrectBadge = count > 0 ? `<span class="incorrect-badge">${count}</span>` : ''; return `<div class="vocab-item" id="item-${word.id}" onclick="toggleDetails(${word.id})"><div class="vocab-header"><div><span class="japanese-word">${word.japanese}</span>${incorrectBadge}</div><div><button class="incorrect-btn" onclick="markIncorrect(event, ${word.id})">오답</button><button class="delete-btn" onclick="deleteWord(event, ${word.id})">&times;</button></div></div><div class="vocab-details" id="details-${word.id}"><div class="vocab-main-details"><p><strong>뜻:</strong> ${korean}</p><p><strong>히라가나:</strong> ${hiragana}</p><p><strong>발음:</strong> ${pronunciation}</p></div>${kanjiHtml ? `<div class="kanji-details">${kanjiHtml}</div>` : ''}</div></div>`; }).join(''); }
function toggleDetails(wordId) { const detailsElement = document.getElementById(`details-${wordId}`); const itemElement = document.getElementById(`item-${wordId}`); if (detailsElement && itemElement) { detailsElement.classList.toggle('show'); itemElement.classList.toggle('revealed'); } }
function createSetButtons() { const buttonContainer = document.getElementById('wordSetButtons'); if (!buttonContainer || typeof wordSets === 'undefined') return; const setKeys = Object.keys(wordSets); buttonContainer.innerHTML = ''; setKeys.forEach(key => { const button = document.createElement('button'); button.className = 'set-btn'; button.textContent = key; button.onclick = () => addWordSet(key); buttonContainer.appendChild(button); }); }
function updateSetButtons() { const buttons = document.querySelectorAll('.set-btn'); buttons.forEach(button => { const setKey = button.textContent; if (addedSets.has(setKey)) { button.classList.add('added'); button.disabled = true; } else { button.classList.remove('added'); button.disabled = false; } }); }