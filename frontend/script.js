let vocabularyData = [], addedSets = new Set(), incorrectCounts = {};
const API_BASE_URL = 'https://jlpt-voca-webapp-v2.onrender.com/api';

async function postRequest(endpoint, body) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        return response.ok;
    } catch (error) { console.error(`${endpoint} 요청 실패:`, error); return false; }
}

async function loadDataFromServer() {
    try {
        const response = await fetch(`${API_BASE_URL}/data`);
        if (!response.ok) throw new Error('서버 응답 오류');
        const data = await response.json();
        vocabularyData = data.vocabularyData || [];
        addedSets = new Set(data.addedSets || []);
        incorrectCounts = data.incorrectCounts || {};
        renderVocabulary();
        createSetButtons(); // ✨ 데이터 로딩 후 버튼 생성 및 상태 업데이트
    } catch (error) {
        console.error('데이터 로딩 실패:', error);
        document.getElementById('vocabularyList').innerHTML = `<div class="empty-state"><h3>서버 연결 실패.</h3><p>백엔드 서버가 실행 중인지 확인해주세요.</p></div>`;
    }
}

async function handleAdd(newWords, newSetKeys = []) {
    if (newWords.length === 0) return;
    const success = await postRequest('/words/add', { words: newWords, sets: newSetKeys });
    if (success) {
        await loadDataFromServer();
    } else {
        alert('단어 추가에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
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
        handleAdd(newWords);
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

async function deleteWord(event, wordId) {
    event.stopPropagation();
    const word = vocabularyData.find(w => w.id === wordId);
    if (word) {
        await fetch(`${API_BASE_URL}/words/${wordId}`, { method: 'DELETE' });
        await loadDataFromServer();
    }
}

// ✨ [버그 수정] 오답 기록을 보존하는 로직으로 최종 수정
async function deleteAllWords() {
    if (vocabularyData.length === 0) return;
    const preservedIncorrectCounts = { ...incorrectCounts }; // 현재 오답 기록 보존
    await postRequest('/data/replace', { 
        vocabularyData: [], // 단어 목록 비우기
        addedSets: [],      // 추가된 세트 기록 비우기
        incorrectCounts: preservedIncorrectCounts // ✨ 보존된 오답 기록은 그대로 서버에 다시 저장
    });
    await loadDataFromServer();
}

async function shuffleWords() {
    if (vocabularyData.length < 2) return;
    for (let i = vocabularyData.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [vocabularyData[i], vocabularyData[j]] = [vocabularyData[j], vocabularyData[i]];
    }
    // 섞인 단어 목록과 함께, 현재 세트/오답 기록을 그대로 다시 저장
    await postRequest('/data/replace', { vocabularyData, addedSets: Array.from(addedSets), incorrectCounts });
    await loadDataFromServer();
}

function renderVocabulary() { /* 이전과 동일 */ }
function toggleDetails(wordId) { /* 이전과 동일 */ }
function createSetButtons() { /* 이전과 동일 */ }
function updateSetButtons() { /* 이전과 동일 */ }
function addAllSets() { /* 이전과 동일 */ }
function addRange() { /* 이전과 동일 */ }

document.addEventListener('DOMContentLoaded', () => {
    loadDataFromServer();
});

// (편의상 생략된 함수들의 전체 코드)
function renderVocabulary() { const listContainer = document.getElementById('vocabularyList'); document.getElementById('deleteAllBtn').disabled = vocabularyData.length === 0; document.getElementById('shuffleBtn').disabled = vocabularyData.length < 2; if (vocabularyData.length === 0) { listContainer.innerHTML = `<div class="empty-state"><h3>저장된 단어가 없습니다.</h3></div>`; return; } listContainer.innerHTML = vocabularyData.map(word => { const [korean, hiragana, pronunciation, ...kanjiReadings] = word.parts || []; const kanjiChars = word.japanese.match(/[\u4e00-\u9faf]/g) || []; const kanjiHtml = kanjiChars.map((char, index) => { const reading = (kanjiReadings && kanjiReadings[index]) ? kanjiReadings[index].replace(/:/g, '') : ''; return `<div class="kanji-item"><span class="kanji-char">${char}</span><span class="kanji-reading">${reading}</span></div>`; }).join(''); const count = incorrectCounts[word.japanese] || 0; const incorrectBadge = count > 0 ? `<span class="incorrect-badge">${count}</span>` : ''; return `<div class="vocab-item" id="item-${word.id}" onclick="toggleDetails(${word.id})"><div class="vocab-header"><div><span class="japanese-word">${word.japanese}</span>${incorrectBadge}</div><div><button class="incorrect-btn" onclick="markIncorrect(event, ${word.id})">오답</button><button class="delete-btn" onclick="deleteWord(event, ${word.id})">&times;</button></div></div><div class="vocab-details" id="details-${word.id}"><div class="vocab-main-details"><p><strong>뜻:</strong> ${korean || ''}</p><p><strong>히라가나:</strong> ${hiragana || ''}</p><p><strong>발음:</strong> ${pronunciation || ''}</p></div>${kanjiHtml ? `<div class="kanji-details">${kanjiHtml}</div>` : ''}</div></div>