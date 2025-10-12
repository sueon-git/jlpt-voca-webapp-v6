let vocabularyData = [], addedSets = new Set(), incorrectCounts = {}, correctCounts = {};
let availableSets = [];
let availableSetData = {};
const API_BASE_URL = 'https://jlpt-voca-webapp-v6.onrender.com/api';
let debounceTimer;
let isSortDescending = true;
let isAttemptSortAscending = true;
let currentThreshold = 0;
let newlyAddedWords = new Map();

function updateStats() {  // 통계 기능추가
    const statsContainer = document.getElementById('statsDisplay');
    if (!statsContainer) return;

    const totalCount = vocabularyData.length;
    const unstudiedCount = vocabularyData.filter(word => {
        const correct = correctCounts[word.japanese] || 0;
        const incorrect = incorrectCounts[word.japanese] || 0;
        return correct === 0 && incorrect === 0;
    }).length;

    if (totalCount > 0) {
        statsContainer.innerHTML = `총: ${totalCount} / 학습 전: ${unstudiedCount}`;
    } else {
        statsContainer.innerHTML = '';
    }
}
//  함수 추가 (스태퍼 값 변경 및 데이터 요청)
function changeThreshold(amount) {
    const thresholdInput = document.getElementById('thresholdValue');
    let currentValue = parseInt(thresholdInput.value) || 0;
    
    currentValue += amount;
    if (currentValue < 0) currentValue = 0;
    
    thresholdInput.value = currentValue;
    currentThreshold = currentValue; // 전역 변수 업데이트
    updateSetCounts(); // 데이터 다시 불러오기
}

//  함수 추가 (서버에 통계 데이터 요청)
async function updateSetCounts() {
    try {
        const response = await fetch(`${API_BASE_URL}/wordsets?threshold=${currentThreshold}`);
        const setsData = await response.json();
        availableSetData = setsData || {};
        availableSets = Object.keys(availableSetData);
        createSetButtons();
    } catch (error) {
        console.error('세트 카운트 업데이트 실패:', error);
    }
}

async function initializeApp() {
    try {
        // wordsets fetch를 분리
        const userDataRes = await fetch(`${API_BASE_URL}/userdata`);
        const userData = await userDataRes.json();
        
        vocabularyData = userData.vocabularyData || [];
        addedSets = new Set(userData.addedSets || []);
        incorrectCounts = userData.incorrectCounts || {};
        correctCounts = userData.correctCounts || {};
        
        await updateSetCounts(); 

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

async function addSetToDatabase() {
    const batchText = document.getElementById('batchInput').value.trim();
    if (!batchText) return alert("입력창에 추가할 세트 정보를 입력해주세요.");
    const regex = /'(\d+)':\s*`([\s\S]*?)`/g;
    let match;
    const setsToAdd = [];
    while ((match = regex.exec(batchText)) !== null) {
        setsToAdd.push({ key: match[1], content: match[2].trim() });
    }
    if (setsToAdd.length === 0) return alert("형식에 맞는 세트를 찾을 수 없습니다. (예: '82':`단어...`)");
    const results = await Promise.all(setsToAdd.map(set => postRequest('/wordsets', set)));
    const successCount = results.filter(ok => ok).length;
    if (successCount > 0) {
        alert(`${successCount}개의 세트가 데이터베이스에 등록되었습니다!`);
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

async function addAllSets() {
    const setsToAdd = availableSets.filter(key => !addedSets.has(String(key)));
    if (setsToAdd.length === 0) return;
    await Promise.all(setsToAdd.map(setKey => postRequest(`/add-set-to-user/${setKey}`)));
    await initializeApp();
}

async function addRange() {
    const start = parseInt(document.getElementById('startNum').value);
    const end = parseInt(document.getElementById('endNum').value);
    if (!start || !end || start > end) return;
    const setsToAdd = [];
    for (let i = start; i <= end; i++) {
        const setKey = String(i);
        if (availableSets.includes(setKey) && !addedSets.has(setKey)) {
            setsToAdd.push(setKey);
        }
    }
    if (setsToAdd.length > 0) {
        await Promise.all(setsToAdd.map(setKey => postRequest(`/add-set-to-user/${setKey}`)));
        await initializeApp();
    }
}

function preserveOpenCards(callback) {
    const openCardIds = new Set();
    document.querySelectorAll('.vocab-details.show').forEach(el => {
        openCardIds.add(el.id.replace('details-', ''));
    });

    callback();

    openCardIds.forEach(id => {
        const itemElement = document.getElementById(id);
        const detailsElement = document.getElementById(`details-${id}`);
        if (itemElement && detailsElement) {
            itemElement.classList.add('revealed'); // 테두리 색상 복구
            detailsElement.classList.add('show');   // ✨ 내용 부분 펼치기 복구
        }
    });
}

async function markCorrect(event, wordId) {
    event.stopPropagation();
    const word = vocabularyData.find(w => w.id === wordId);
    if (word) {
        const newCount = (correctCounts[word.japanese] || 0) + 1;
        const success = await postRequest('/correct/update', { word: word.japanese, count: newCount });
        if (success) {
            correctCounts[word.japanese] = newCount;
            preserveOpenCards(renderVocabulary);
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
            preserveOpenCards(renderVocabulary);
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
    renderVocabulary();
    await postRequest('/shuffle-words', { shuffledVocabularyData: vocabularyData });
}

async function deleteWord(event, wordId) {
    event.stopPropagation();
    const word = vocabularyData.find(w => w.id === wordId);
    if (word && confirm(`'${word.japanese}' 단어를 삭제하시겠습니까?`)) {
        const success = await fetch(`${API_BASE_URL}/words/${word.id}`, { method: 'DELETE' });
        if (success.ok) {
            await initializeApp();
        } else {
            alert('단어 삭제에 실패했습니다.');
        }
    }
}

async function refreshApp() {
    const refreshButton = document.getElementById('refreshBtn');
    if (!refreshButton) return;
    const setsToReAdd = Array.from(addedSets);
    const icon = refreshButton.querySelector('i');
    refreshButton.disabled = true;
    icon.classList.remove('fa-sync-alt');
    icon.classList.add('fa-spinner', 'fa-spin');
    const deleteSuccess = await postRequest('/delete-all-words');
    if (deleteSuccess) {
        if (setsToReAdd.length > 0) {
            await Promise.all(setsToReAdd.map(setKey => postRequest(`/add-set-to-user/${setKey}`)));
        }
        await initializeApp();
    } else {
        alert('새로고침 중 오류가 발생했습니다.');
    }
    refreshButton.disabled = false;
    icon.classList.remove('fa-spinner', 'fa-spin');
    icon.classList.add('fa-sync-alt');
}

// --- 새로운 기능: 오답률 기반 정렬 ---
function sortByIncorrectRate() {
    if (vocabularyData.length < 2) return;

    if (isSortDescending) {
        // 1. 첫 클릭 시: 복잡한 오답률 정렬 실행
        vocabularyData.sort((a, b) => {
            const correctA = correctCounts[a.japanese] || 0;
            const incorrectA = incorrectCounts[a.japanese] || 0;
            const totalA = correctA + incorrectA;

            const correctB = correctCounts[b.japanese] || 0;
            const incorrectB = incorrectCounts[b.japanese] || 0;
            const totalB = correctB + incorrectB;

            const getCategory = (total, incorrect) => {
                if (incorrect > 0) return 1; // 오답률 정렬 1순위 : 오답이 있는 경우 
                if (total === 0) return 3; // 오답률 정렬 3순위 : 미학습 (카운트=='0', 제로)
                return 2; // 오답률 정렬 2순위 : 정답만 있는 경우 
            };
            
            const categoryA = getCategory(totalA, incorrectA);
            const categoryB = getCategory(totalB, incorrectB);

            if (categoryA !== categoryB) {
                return categoryA - categoryB;
            }

            if (categoryA === 1) {
                const rateA = incorrectA / totalA;
                const rateB = incorrectB / totalB;
                if (rateB !== rateA) {
                    return rateB - rateA;
                }
                return totalB - totalA;
            }
            
            if (categoryA === 2) {
                return correctA - correctB;
            }

            return 0;
        });
    } else {
        // 2. 두 번째 클릭 시: 현재 순서를 그냥 뒤집기
        vocabularyData.reverse();
    }

    // 정렬 방향을 뒤집고, 버튼 아이콘도 변경
    isSortDescending = !isSortDescending;
    const sortButtonIcon = document.querySelector('#sortBtn i');
    if (sortButtonIcon) {
        sortButtonIcon.className = isSortDescending ? 'fas fa-sort-amount-down' : 'fas fa-sort-amount-up';
    }
    
    renderVocabulary();
}

// 시행횟수 정렬 함수 추가 
function sortByAttemptCount() {
    if (vocabularyData.length < 2) return;

    vocabularyData.sort((a, b) => {
        const correctA = correctCounts[a.japanese] || 0;
        const incorrectA = incorrectCounts[a.japanese] || 0;
        const totalA = correctA + incorrectA;

        const correctB = correctCounts[b.japanese] || 0;
        const incorrectB = incorrectCounts[b.japanese] || 0;
        const totalB = correctB + incorrectB;

        // 1. 주 정렬: 총 시행 횟수 비교
        if (totalA !== totalB) {
            // isAttemptSortAscending이 true이면 오름차순, false이면 내림차순
            return isAttemptSortAscending ? totalA - totalB : totalB - totalA;
        }
        
        // 2. 부 정렬: 시행 횟수가 같으면 오답이 많은 순서대로 (내림차순)
        return incorrectB - incorrectA;
    });

    // 정렬 방향을 뒤집고, 버튼 아이콘도 변경
    isAttemptSortAscending = !isAttemptSortAscending;
    const sortButtonIcon = document.querySelector('#attemptSortBtn i');
    if (sortButtonIcon) {
        sortButtonIcon.className = isAttemptSortAscending ? 'fas fa-sort-numeric-down' : 'fas fa-sort-numeric-up';
    }
    
    renderVocabulary();
}

async function getRandomWords() {
    const countInput = document.getElementById('randomCount');
    const startInput = document.getElementById('randomStartNum');
    const endInput = document.getElementById('randomEndNum');
    
    const count = parseInt(countInput.value);
    const start = parseInt(startInput.value);
    const end = parseInt(endInput.value);

    if (!count || count < 1) {
        alert('추출할 단어의 개수를 1 이상으로 입력해주세요.');
        return;
    }
    
    let confirmMessage = `현재 학습 목록을 지우고, `;
    if (start && end) {
        confirmMessage += `${start} ~ ${end}번 세트에서 ${count}개의 단어를 무작위로 가져옵니다.`;
    } else {
        confirmMessage += `전체 DB에서 ${count}개의 단어를 무작위로 가져옵니다.`;
    }
    confirmMessage += ` 계속하시겠습니까?`;

    if (!confirm(confirmMessage)) {
        return;
    }

    const success = await postRequest('/userdata/random-set', { count, start, end });

    if (success) {
        alert(`${count}개의 랜덤 단어를 불러왔습니다!`);
        await initializeApp();
    } else {
        alert('랜덤 단어를 불러오는 데 실패했습니다. (범위 내에 세트가 없는지 확인해주세요)');
    }
}

function createSetButtons() {
    const buttonContainer = document.getElementById('wordSetButtons');
    buttonContainer.innerHTML = '';
    
    const sortedKeys = Object.keys(availableSetData).sort((a, b) => Number(a) - Number(b));

    sortedKeys.forEach(key => {
        const button = document.createElement('button');
        const count = availableSetData[key];

        button.className = 'set-btn';
        button.innerHTML = `${key} (<span class="remaining-count">${count}</span>)`;
        button.dataset.setKey = key;
        button.onclick = () => addWordSet(key);
        buttonContainer.appendChild(button);
    });
    const buttonsToRemove = [''];
    document.querySelectorAll('.set-btn').forEach(button => {
        if (buttonsToRemove.includes(button.dataset.setKey)) {
            button.remove();
        }
    });

    filterSetButtons();
    updateSetButtons();
}

function updateSetButtons() {
    const buttons = document.querySelectorAll('.set-btn');
    buttons.forEach(button => {
        const setKey = button.dataset.setKey;
        if (addedSets.has(setKey)) {
            button.classList.add('added');
            button.disabled = true;
        } else {
            button.classList.remove('added');
            button.disabled = false;
        }
    });
}

function renderVocabulary() {
    updateStats(); // 단어 목록을 그리기 전 통계 업데이트
    
    const listContainer = document.getElementById('vocabularyList');
    document.getElementById('deleteAllBtn').disabled = vocabularyData.length === 0;
    document.getElementById('shuffleBtn').disabled = vocabularyData.length < 2;
    document.getElementById('sortBtn').disabled = vocabularyData.length < 2;
    document.getElementById('attemptSortBtn').disabled = vocabularyData.length < 2;
    if (vocabularyData.length === 0) {
        listContainer.innerHTML = `<div class="empty-state"><h3>학습할 단어가 없습니다.</h3></div>`;
        return;
    }
    listContainer.innerHTML = vocabularyData.map(word => {
        const title = word.japanese;
        const parts = word.parts || [];

        let displayTitle = title;
        const sourceInfo = newlyAddedWords.get(word.id);

        if (sourceInfo) {
            // 새로 추가된 단어일 경우, 파란색 배경과 위치 정보 추가
            const sourceText = `<span class="source-info">(${sourceInfo.set}-${sourceInfo.index})</span>`;
            displayTitle = `<span class="highlight-new-word">${title}</span> ${sourceText}`;
        } else {
            // 기존 검색 하이라이트 기능은 그대로 유지
            const searchTerm = document.getElementById('setSearchInput').value.trim();
            if (searchTerm) {
                const containsSearchTerm = [word.japanese, ...parts]
                    .some(part => part && part.toLowerCase().includes(searchTerm.toLowerCase()));
                if (containsSearchTerm) {
                    displayTitle = `<span class="highlight-search">${title}</span>`;
                }
            }
        }

        const korean = parts[0] || '';
        const hiragana = parts[1] || '';
        const pronunciation = parts[2] || '';
        const kanjiReadings = parts.slice(3);
        
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
        
        const correctCount = correctCounts[word.japanese] || 0;
        const incorrectCount = incorrectCounts[word.japanese] || 0;
        const correctBadge = correctCount > 0 ? `<span class="correct-badge">${correctCount}</span>` : '';
        const incorrectBadge = incorrectCount > 0 ? `<span class="incorrect-badge">${incorrectCount}</span>` : '';
        return `<div class="vocab-item" id="${word.id}" onclick="toggleDetails('${word.id}')"><div class="vocab-header"><div><span class="japanese-word">${displayTitle}</span>${correctBadge}${incorrectBadge}</div><div><button class="correct-btn" onclick="markCorrect(event, '${word.id}')">정답</button><button class="incorrect-btn" onclick="markIncorrect(event, '${word.id}')">오답</button><button class="delete-btn" onclick="deleteWord(event, '${word.id}')">&times;</button></div></div><div class="vocab-details" id="details-${word.id}"><div class="vocab-main-details"><p><strong>뜻:</strong> ${korean}</p><p><strong>히라가나:</strong> ${hiragana}</p><p><strong>발음:</strong> ${pronunciation}</p></div>${kanjiHtml ? `<div class="kanji-details">${kanjiHtml}</div>` : ''}</div></div>`;
    }).join('');
    newlyAddedWords.clear();
}

function toggleDetails(wordId) { const detailsElement = document.getElementById(`details-${wordId}`); const itemElement = document.getElementById(wordId); if (detailsElement && itemElement) { detailsElement.classList.toggle('show'); itemElement.classList.toggle('revealed'); } }

function filterSetButtons() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
        const searchTerm = document.getElementById('setSearchInput').value;
        try {
            const response = await fetch(`${API_BASE_URL}/wordsets/search?q=${searchTerm}`);
            if (!response.ok) throw new Error('서버 응답 실패');

            const matchingSetKeys = await response.json();
            const matchingSet = new Set(matchingSetKeys);

            const allSetButtons = document.querySelectorAll('.set-btn');
            allSetButtons.forEach(button => {
                if (matchingSet.has(button.dataset.setKey)) {
                    button.style.display = '';
                } else {
                    button.style.display = 'none';
                }
            });
        } catch (error) {
            console.error('세트 검색 실패:', error);
        }
    }, 300); 
}

// 찾기 & 덱추가 기능 함수추가 
async function searchAndAddWords() {
    const searchInput = document.getElementById('wordSearchInput');
    const searchTerm = searchInput.value.trim();
    if (!searchTerm) {
        alert('검색어를 입력해주세요.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/userdata/search-and-add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ searchTerm })
        });

        const result = await response.json();
        alert(result.message);

        if (response.ok && result.newWords) {
            // 새로 추가된 단어 정보를 Map에 저장 (id를 key로)
            result.newWords.forEach(word => {
                newlyAddedWords.set(word.id, word.source);
            });
        }
        
        searchInput.value = '';
        await initializeApp();
    } catch (error) {
        alert('단어 검색 및 추가에 실패했습니다.');
        console.error(error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    const batchAddBtn = document.querySelector('.add-btn');
    if (batchAddBtn) {
        batchAddBtn.textContent = '세트 등록';
        batchAddBtn.onclick = addSetToDatabase;
    }
    const thresholdInput = document.getElementById('thresholdValue');
    if (thresholdInput) {
        thresholdInput.addEventListener('change', () => {
            currentThreshold = parseInt(thresholdInput.value) || 0;
            if (currentThreshold < 0) {
                currentThreshold = 0;
                thresholdInput.value = 0;
            }
            updateSetCounts();
        });
    }
});


