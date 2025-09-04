let vocabularyData = [], addedSets = new Set(), incorrectCounts = {}, correctCounts = {}; // 정답 카운트 변수 추가
let availableSets = [];
const API_BASE_URL = 'https://jlpt-voca-webapp-v5.onrender.com/api'; 

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
        correctCounts = userData.correctCounts || {}; // 정답 카운트 데이터 로드
        availableSets = setsData || [];
        
        createSetButtons();
        renderVocabulary();
    } catch (error) {
        console.error('앱 초기화 실패:', error);
    }
}

async function postRequest(endpoint, body = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return response.ok;
    } catch (error) { console.error(`${endpoint} 요청 실패:`, error); return false; }
}

// 새로운 기능: 정답 카운트
async function markCorrect(event, wordId) {
    event.stopPropagation();
    const word = vocabularyData.find(w => w.id === wordId);
    if (word) {
        const newCount = (correctCounts[word.japanese] || 0) + 1;
        const success = await postRequest('/correct/update', { word: word.japanese, count: newCount });
        if (success) {
            correctCounts[word.japanese] = newCount;
            renderVocabulary(); // 화면 업데이트
        }
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

// 화면 렌더링 함수 수정
function renderVocabulary() {
    const listContainer = document.getElementById('vocabularyList');
    document.getElementById('deleteAllBtn').disabled = vocabularyData.length === 0;
    document.getElementById('shuffleBtn').disabled = vocabularyData.length < 2;
    if (vocabularyData.length === 0) {
        listContainer.innerHTML = `<div class="empty-state"><h3>학습할 단어가 없습니다.</h3></div>`;
        return;
    }
    listContainer.innerHTML = vocabularyData.map(word => {
        const title = word.japanese; // 이 줄이 누락되었습니다.
        const [korean, hiragana, pronunciation, ...kanjiReadings] = word.parts || [];
        const japaneseRegex = /[\u4e00-\u9faf]/g;
        let wordForKanjiExtraction = '';
        if (japaneseRegex.test(title)) {
            wordForKanjiExtraction = title;
        } else if (korean && japaneseRegex.test(korean)) {
            wordForKanjiExtraction = korean;
        }
        const kanjiChars = wordForKanjiExtraction.match(japaneseRegex) || [];
        const kanjiHtml = kanjiChars.map((char, index) => {
            const reading = (kanjiReadings[index]) ? kanjiReadings[index].replace(/:/g, '') : '';
            return `<div class="kanji-item"><span class="kanji-char">${char}</span><span class="kanji-reading">${reading}</span></div>`;
        }).join('');
        const incorrectCount = incorrectCounts[word.japanese] || 0;
        const correctCount = correctCounts[word.japanese] || 0;
        const incorrectBadge = incorrectCount > 0 ? `<span class="incorrect-badge">${incorrectCount}</span>` : '';
        const correctBadge = correctCount > 0 ? `<span class="correct-badge" style="background-color: #55efc4; color: #2d3436;">${correctCount}</span>` : '';
        
        return `<div class="vocab-item" id="${word.id}" onclick="toggleDetails('${word.id}')"><div class="vocab-header"><div><span class="japanese-word">${title}</span>${correctBadge}${incorrectBadge}</div><div><button class="correct-btn" onclick="markCorrect(event, '${word.id}')">정답</button><button class="incorrect-btn" onclick="markIncorrect(event, '${word.id}')">오답</button><button class="delete-btn" onclick="deleteWord(event, '${word.id}')">&times;</button></div></div><div class="vocab-details" id="details-${word.id}"><div class="vocab-main-details"><p><strong>뜻:</strong> ${korean}</p><p><strong>히라가나:</strong> ${hiragana}</p><p><strong>발음:</strong> ${pronunciation}</p></div>${kanjiHtml ? `<div class="kanji-details">${kanjiHtml}</div>` : ''}</div></div>`;
    }).join('');
}

// (이하 나머지 함수들은 이전과 동일. 전체 코드를 아래에 첨부.)

// --- 전체 script.js 코드 ---

async function initializeApp() { try { const [userDataRes, setsDataRes] = await Promise.all([ fetch(`${API_BASE_URL}/userdata`), fetch(`${API_BASE_URL}/wordsets`) ]); const userData = await userDataRes.json(); const setsData = await setsDataRes.json(); vocabularyData = userData.vocabularyData || []; addedSets = new Set(userData.addedSets || []); incorrectCounts = userData.incorrectCounts || {}; correctCounts = userData.correctCounts || {}; availableSets = setsData || []; createSetButtons(); renderVocabulary(); } catch (error) { console.error('앱 초기화 실패:', error); } }
async function postRequest(endpoint, body = {}) { try { const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return response.ok; } catch (error) { console.error(`${endpoint} 요청 실패:`, error); return false; } }
async function addSetToDatabase() { const batchText = document.getElementById('batchInput').value.trim(); if (!batchText) return alert("입력창에 추가할 세트 정보를 입력해주세요."); const regex = /'(\d+)':\s*`([\s\S]*?)`/g; let match; const setsToAdd = []; while ((match = regex.exec(batchText)) !== null) { setsToAdd.push({ key: match[1], content: match[2].trim() }); } if (setsToAdd.length === 0) return alert("형식에 맞는 세트를 찾을 수 없습니다. (예: '82':`단어...`)"); const results = await Promise.all(setsToAdd.map(set => postRequest('/wordsets', set))); const successCount = results.filter(ok => ok).length; if (successCount > 0) { alert(`${successCount}개의 세트가 데이터베이스에 등록되었습니다!`); document.getElementById('batchInput').value = ''; await initializeApp(); } else { alert('세트 등록에 실패했습니다.'); } }
async function addWordSet(setKey) { const setNumber = String(setKey); if (addedSets.has(setNumber)) return; const success = await postRequest(`/add-set-to-user/${setNumber}`); if (success) { await initializeApp(); } else { alert(`${setNumber}번 세트 추가에 실패했습니다.`); } }
async function addAllSets() { const setsToAdd = availableSets.filter(key => !addedSets.has(String(key))); if (setsToAdd.length === 0) return; await Promise.all(setsToAdd.map(setKey => postRequest(`/add-set-to-user/${setKey}`))); await initializeApp(); }
async function addRange() { const start = parseInt(document.getElementById('startNum').value); const end = parseInt(document.getElementById('endNum').value); if (!start || !end || start > end) return; const setsToAdd = []; for (let i = start; i <= end; i++) { const setKey = String(i); if (availableSets.includes(setKey) && !addedSets.has(setKey)) { setsToAdd.push(setKey); } } if (setsToAdd.length > 0) { await Promise.all(setsToAdd.map(setKey => postRequest(`/add-set-to-user/${setKey}`))); await initializeApp(); } }
async function markCorrect(event, wordId) { event.stopPropagation(); const word = vocabularyData.find(w => w.id === wordId); if (word) { const newCount = (correctCounts[word.japanese] || 0) + 1; const success = await postRequest('/correct/update', { word: word.japanese, count: newCount }); if (success) { correctCounts[word.japanese] = newCount; renderVocabulary(); } } }
async function markIncorrect(event, wordId) { event.stopPropagation(); const word = vocabularyData.find(w => w.id === wordId); if (word) { const newCount = (incorrectCounts[word.japanese] || 0) + 1; const success = await postRequest('/incorrect/update', { word: word.japanese, count: newCount }); if (success) { incorrectCounts[word.japanese] = newCount; renderVocabulary(); } } }
async function deleteAllWords() { if (vocabularyData.length === 0) return; if (confirm(`학습 목록의 모든 단어를 삭제하시겠습니까? (오답 기록은 유지됩니다)`)) { const success = await postRequest('/delete-all-words'); if (success) await initializeApp(); } }
async function shuffleWords() { if (vocabularyData.length < 2) return; for (let i = vocabularyData.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [vocabularyData[i], vocabularyData[j]] = [vocabularyData[j], vocabularyData[i]]; } renderVocabulary(); await postRequest('/shuffle-words', { shuffledVocabularyData: vocabularyData }); }
async function deleteWord(event, wordId) { event.stopPropagation(); const word = vocabularyData.find(w => w.id === wordId); if (word && confirm(`'${word.japanese}' 단어를 삭제하시겠습니까?`)) { const success = await fetch(`${API_BASE_URL}/words/${word.id}`, { method: 'DELETE' }); if (success.ok) { await initializeApp(); } else { alert('단어 삭제에 실패했습니다.'); } } }
function createSetButtons() { const buttonContainer = document.getElementById('wordSetButtons'); buttonContainer.innerHTML = ''; availableSets.sort((a, b) => Number(a) - Number(b)).forEach(key => { const button = document.createElement('button'); button.className = 'set-btn'; button.textContent = key; button.onclick = () => addWordSet(key); buttonContainer.appendChild(button); }); updateSetButtons(); }
function updateSetButtons() { const buttons = document.querySelectorAll('.set-btn'); buttons.forEach(button => { const setKey = button.textContent; if (addedSets.has(setKey)) { button.classList.add('added'); button.disabled = true; } else { button.classList.remove('added'); button.disabled = false; } }); }
function renderVocabulary() { const listContainer = document.getElementById('vocabularyList'); document.getElementById('deleteAllBtn').disabled = vocabularyData.length === 0; document.getElementById('shuffleBtn').disabled = vocabularyData.length < 2; if (vocabularyData.length === 0) { listContainer.innerHTML = `<div class="empty-state"><h3>학습할 단어가 없습니다.</h3></div>`; return; } listContainer.innerHTML = vocabularyData.map(word => { const title = word.japanese; const [korean, hiragana, pronunciation, ...kanjiReadings] = word.parts || []; const japaneseRegex = /[\u4e00-\u9faf]/g; let wordForKanjiExtraction = ''; if (japaneseRegex.test(title)) { wordForKanjiExtraction = title; } else if (korean && japaneseRegex.test(korean)) { wordForKanjiExtraction = korean; } const kanjiChars = wordForKanjiExtraction.match(japaneseRegex) || []; const kanjiHtml = kanjiChars.map((char, index) => { const reading = (kanjiReadings[index]) ? kanjiReadings[index].replace(/:/g, '') : ''; return `<div class="kanji-item"><span class="kanji-char">${char}</span><span class="kanji-reading">${reading}</span></div>`; }).join(''); const incorrectCount = incorrectCounts[word.japanese] || 0; const correctCount = correctCounts[word.japanese] || 0; const incorrectBadge = incorrectCount > 0 ? `<span class="incorrect-badge">${incorrectCount}</span>` : ''; const correctBadge = correctCount > 0 ? `<span class="correct-badge" style="background-color: #55efc4; color: #2d3436;">${correctCount}</span>` : ''; return `<div class="vocab-item" id="${word.id}" onclick="toggleDetails('${word.id}')"><div class="vocab-header"><div><span class="japanese-word">${title}</span>${correctBadge}${incorrectBadge}</div><div><button class="correct-btn" onclick="markCorrect(event, '${word.id}')">정답</button><button class="incorrect-btn" onclick="markIncorrect(event, '${word.id}')">오답</button><button class="delete-btn" onclick="deleteWord(event, '${word.id}')">&times;</button></div></div><div class="vocab-details" id="details-${word.id}"><div class="vocab-main-details"><p><strong>뜻:</strong> ${korean}</p><p><strong>히라가나:</strong> ${hiragana}</p><p><strong>발음:</strong> ${pronunciation}</p></div>${kanjiHtml ? `<div class="kanji-details">${kanjiHtml}</div>` : ''}</div></div>`; }).join(''); }
function toggleDetails(wordId) { const detailsElement = document.getElementById(`details-${wordId}`); const itemElement = document.getElementById(wordId); if (detailsElement && itemElement) { detailsElement.classList.toggle('show'); itemElement.classList.toggle('revealed'); } }
document.addEventListener('DOMContentLoaded', () => { initializeApp(); const batchAddBtn = document.querySelector('.add-btn'); if(batchAddBtn) { batchAddBtn.textContent = '세트 등록'; batchAddBtn.onclick = addSetToDatabase; } });