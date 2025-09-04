let vocabularyData = [], addedSets = new Set(), incorrectCounts = {};
let availableSets = [];
const API_BASE_URL = 'https://jlpt-voca-webapp-v5.onrender.com/api';

async function initializeApp() { /* 이전과 동일 */ }
async function postRequest(endpoint, body = {}) { /* 이전과 동일 */ }
async function addSetToDatabase() { /* 이전과 동일 */ }
async function addWordSet(setKey) { /* 이전과 동일 */ }
async function addAllSets() { /* 이전과 동일 */ }
async function addRange() { /* 이전과 동일 */ }
async function markIncorrect(event, wordId) { /* 이전과 동일 */ }
async function deleteAllWords() { /* 이전과 동일 */ }
async function shuffleWords() { /* 이전과 동일 */ }
async function deleteWord(event, wordId) { /* 이전과 동일 */ }
async function refreshApp() { /* 이전과 동일 */ }
function createSetButtons() { /* 이전과 동일 */ }
function updateSetButtons() { /* 이전과 동일 */ }
function renderVocabulary() { /* 이전과 동일 */ }
function toggleDetails(wordId) { /* 이전과 동일 */ }


// --- 새로운 기능: 오답순 정렬 ---
function sortByIncorrect() {
    if (vocabularyData.length < 2) return;

    // vocabularyData 배열을 incorrectCounts를 기준으로 내림차순 정렬
    vocabularyData.sort((a, b) => {
        const countA = incorrectCounts[a.japanese] || 0;
        const countB = incorrectCounts[b.japanese] || 0;
        return countB - countA;
    });

    // 정렬된 순서대로 화면을 다시 그림
    renderVocabulary();
}


document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    const batchAddBtn = document.querySelector('.add-btn');
    if(batchAddBtn) {
        batchAddBtn.textContent = '세트 등록';
        batchAddBtn.onclick = addSetToDatabase;
    }
});

// (편의상 생략된 함수들의 전체 코드)
async function initializeApp() { try { const [userDataRes, setsDataRes] = await Promise.all([ fetch(`${API_BASE_URL}/userdata`), fetch(`${API_BASE_URL}/wordsets`) ]); const userData = await userDataRes.json(); const setsData = await setsDataRes.json(); vocabularyData = userData.vocabularyData || []; addedSets = new Set(userData.addedSets || []); incorrectCounts = userData.incorrectCounts || {}; availableSets = setsData || []; createSetButtons(); renderVocabulary(); } catch (error) { console.error('앱 초기화 실패:', error); } }
async function postRequest(endpoint, body = {}) { try { const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return response.ok; } catch (error) { console.error(`${endpoint} 요청 실패:`, error); return false; } }
async function addSetToDatabase() { const batchText = document.getElementById('batchInput').value.trim(); if (!batchText) return alert("입력창에 추가할 세트 정보를 입력해주세요."); const regex = /'(\d+)':\s*`([\s\S]*?)`/g; let match; const setsToAdd = []; while ((match = regex.exec(batchText)) !== null) { setsToAdd.push({ key: match[1], content: match[2].trim() }); } if (setsToAdd.length === 0) return alert("형식에 맞는 세트를 찾을 수 없습니다. (예: '82':`단어...`)"); const results = await Promise.all( setsToAdd.map(set => postRequest('/wordsets', set)) ); const successCount = results.filter(ok => ok).length; if (successCount > 0) { alert(`${successCount}개의 세트가 데이터베이스에 등록되었습니다!`); document.getElementById('batchInput').value = ''; await initializeApp(); } else { alert('세트 등록에 실패했습니다.'); } }
async function addWordSet(setKey) { const setNumber = String(setKey); if (addedSets.has(setNumber)) return; const success = await postRequest(`/add-set-to-user/${setNumber}`); if (success) { await initializeApp(); } else { alert(`${setNumber}번 세트 추가에 실패했습니다.`); } }
async function addAllSets() { const setsToAdd = availableSets.filter(key => !addedSets.has(String(key))); if (setsToAdd.length === 0) return; await Promise.all(setsToAdd.map(setKey => postRequest(`/add-set-to-user/${setKey}`))); await initializeApp(); }
async function addRange() { const start = parseInt(document.getElementById('startNum').value); const end = parseInt(document.getElementById('endNum').value); if (!start || !end || start > end) return; const setsToAdd = []; for (let i = start; i <= end; i++) { const setKey = String(i); if (availableSets.includes(setKey) && !addedSets.has(setKey)) { setsToAdd.push(setKey); } } if (setsToAdd.length > 0) { await Promise.all(setsToAdd.map(setKey => postRequest(`/add-set-to-user/${setKey}`))); await initializeApp(); } }
async function markIncorrect(event, wordId) { event.stopPropagation(); const word = vocabularyData.find(w => w.id === wordId); if (word) { const newCount = (incorrectCounts[word.japanese] || 0) + 1; const success = await postRequest('/incorrect/update', { word: word.japanese, count: newCount }); if (success) { incorrectCounts[word.japanese] = newCount; const itemElement = document.getElementById(wordId); if (itemElement) { let badge = itemElement.querySelector('.incorrect-badge'); if (!badge) { badge = document.createElement('span'); badge.className = 'incorrect-badge'; const wordSpan = itemElement.querySelector('.japanese-word'); wordSpan.parentNode.insertBefore(badge, wordSpan.nextSibling); } badge.textContent = newCount; } } } }
async function deleteAllWords() { if (vocabularyData.length === 0) return; if (confirm(`학습 목록의 모든 단어를 삭제하시겠습니까? (오답 기록은 유지됩니다)`)) { const success = await postRequest('/delete-all-words'); if (success) await initializeApp(); } }
async function shuffleWords() { if (vocabularyData.length < 2) return; for (let i = vocabularyData.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [vocabularyData[i], vocabularyData[j]] = [vocabularyData[j], vocabularyData[i]]; } renderVocabulary(); await postRequest('/shuffle-words', { shuffledVocabularyData: vocabularyData }); }
async function deleteWord(event, wordId) { event.stopPropagation(); const word = vocabularyData.find(w => w.id === wordId); if (word && confirm(`'${word.japanese}' 단어를 삭제하시겠습니까?`)) { const success = await fetch(`${API_BASE_URL}/words/${word.id}`, { method: 'DELETE' }); if (success.ok) { await initializeApp(); } else { alert('단어 삭제에 실패했습니다.'); } } }
async function refreshApp() { const refreshButton = document.getElementById('refreshBtn'); if (!refreshButton) return; const setsToReAdd = Array.from(addedSets); const icon = refreshButton.querySelector('i'); refreshButton.disabled = true; icon.classList.remove('fa-sync-alt'); icon.classList.add('fa-spinner', 'fa-spin'); const deleteSuccess = await postRequest('/delete-all-words'); if (deleteSuccess) { if (setsToReAdd.length > 0) { await Promise.all(setsToReAdd.map(setKey => postRequest(`/add-set-to-user/${setKey}`))); } await initializeApp(); } else { alert('새로고침 중 오류가 발생했습니다.'); } refreshButton.disabled = false; icon.classList.remove('fa-spinner', 'fa-spin'); icon.classList.add('fa-sync-alt'); }
function createSetButtons() { const buttonContainer = document.getElementById('wordSetButtons'); buttonContainer.innerHTML = ''; availableSets.sort((a, b) => Number(a) - Number(b)).forEach(key => { const button = document.createElement('button'); button.className = 'set-btn'; button.textContent = key; button.onclick = () => addWordSet(key); buttonContainer.appendChild(button); }); updateSetButtons(); }
function updateSetButtons() { const buttons = document.querySelectorAll('.set-btn'); buttons.forEach(button => { const setKey = button.textContent; if (addedSets.has(setKey)) { button.classList.add('added'); button.disabled = true; } else { button.classList.remove('added'); button.disabled = false; } }); }
function renderVocabulary() { const listContainer = document.getElementById('vocabularyList'); document.getElementById('deleteAllBtn').disabled = vocabularyData.length === 0; document.getElementById('shuffleBtn').disabled = vocabularyData.length < 2; document.getElementById('sortBtn').disabled = vocabularyData.length < 2; if (vocabularyData.length === 0) { listContainer.innerHTML = `<div class="empty-state"><h3>학습할 단어가 없습니다.</h3></div>`; return; } listContainer.innerHTML = vocabularyData.map(word => { const title = word.japanese; const [korean, hiragana, pronunciation, ...kanjiReadings] = word.parts || []; const japaneseRegex = /[\u4e00-\u9faf]/g; let wordForKanjiExtraction = ''; if (japaneseRegex.test(title)) { wordForKanjiExtraction = title; } else if (korean && japaneseRegex.test(korean)) { wordForKanjiExtraction = korean; } const kanjiChars = wordForKanjiExtraction.match(japaneseRegex) || []; const kanjiHtml = kanjiChars.map((char, index) => { const reading = (kanjiReadings[index]) ? kanjiReadings[index].replace(/:/g, '') : ''; return `<div class="kanji-item"><span class="kanji-char">${char}</span><span class="kanji-reading">${reading}</span></div>`; }).join(''); const count = incorrectCounts[word.japanese] || 0; const incorrectBadge = count > 0 ? `<span class="incorrect-badge">${count}</span>` : ''; return `<div class="vocab-item" id="${word.id}" onclick="toggleDetails('${word.id}')"><div class="vocab-header"><div><span class="japanese-word">${title}</span>${incorrectBadge}</div><div><button class="incorrect-btn" onclick="markIncorrect(event, '${word.id}')">오답</button><button class="delete-btn" onclick="deleteWord(event, '${word.id}')">&times;</button></div></div><div class="vocab-details" id="details-${word.id}"><div class="vocab-main-details"><p><strong>뜻:</strong> ${korean}</p><p><strong>히라가나:</strong> ${hiragana}</p><p><strong>발음:</strong> ${pronunciation}</p></div>${kanjiHtml ? `<div class="kanji-details">${kanjiHtml}</div>` : ''}</div></div>`; }).join(''); }
function toggleDetails(wordId) { const detailsElement = document.getElementById(`details-${wordId}`); const itemElement = document.getElementById(wordId); if (detailsElement && itemElement) { detailsElement.classList.toggle('show'); itemElement.classList.toggle('revealed'); } }