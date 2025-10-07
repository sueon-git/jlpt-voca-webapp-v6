const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const port = 3000;

const uri = "mongodb+srv://ghdtnsqls11:ghdtnsqls11@cluster0.7vvslpu.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri);

const dbName = 'jlpt-vocab-app-v6';
const userDataCollectionName = 'userdata';
const wordSetsCollectionName = 'wordsets';

const corsOptions = {
  origin: 'https://jlpt-voca-webapp-v6.netlify.app',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

async function startServer() {
    try {
        await client.connect();
        console.log("MongoDB Atlas 데이터베이스에 성공적으로 연결되었습니다.");
        const db = client.db(dbName);
        const userdata = db.collection(userDataCollectionName);
        const wordsets = db.collection(wordSetsCollectionName);

        app.get('/api/userdata', async (req, res) => {
            try {
                let result = await userdata.findOne({ _id: 'main' });
                if (!result || !result.data) {
                    const initialData = { vocabularyData: [], addedSets: [], incorrectCounts: {}, correctCounts: {} };
                    await userdata.updateOne({ _id: 'main' }, { $set: { data: initialData } }, { upsert: true });
                    result = { data: initialData };
                }
                if (!result.data.correctCounts) result.data.correctCounts = {};
                res.json(result.data);
            } catch (e) { res.status(500).json({ message: "사용자 데이터 조회 오류" }); }
        });

        app.get('/api/wordsets', async (req, res) => {
            try {
             const threshold = parseInt(req.query.threshold) || 0; // URL 파라미터에서 X값 받기

             const userDoc = await userdata.findOne({ _id: 'main' });
             const correctCounts = userDoc?.data?.correctCounts || {};
             const incorrectCounts = userDoc?.data?.incorrectCounts || {};

             const allSets = await wordsets.find({}).toArray();
             const setStats = {};
             const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;

             allSets.forEach(setDoc => {
                const lines = setDoc.content.split('\n').filter(line => line.trim());
                let belowThresholdCount = 0;

                lines.forEach(line => {
                    const parts = line.split(',').map(p => p.trim());
                    if (parts.length < 1) return;

                    const title = parts[0];
                    const correct = correctCounts[title] || 0;
                    const incorrect = incorrectCounts[title] || 0;
                
                    if ((correct + incorrect) <= threshold) {
                        belowThresholdCount++;
                    }
                });
                setStats[setDoc._id] = belowThresholdCount;
            });
        
            res.json(setStats);
            } catch (e) {
                console.error("세트 통계 계산 오류:", e);
                res.status(500).json({ message: "단어 세트 목록 조회 오류" });
            }
        });

         app.get('/api/wordsets/search', async (req, res) => { // 단어세트 내용 검색 필터
            try {
                const searchTerm = req.query.q;
                if (!searchTerm) {
                    const allSets = await wordsets.find({}, { projection: { _id: 1 } }).toArray();
                    const allSetKeys = allSets.map(s => s._id);
                    return res.json(allSetKeys);
                }
                const query = { content: { $regex: searchTerm, $options: 'i' } };
                const sets = await wordsets.find(query, { projection: { _id: 1 } }).toArray();
                const setKeys = sets.map(s => s._id);
                res.json(setKeys);
            } catch (e) {
                res.status(500).json({ message: "세트 검색 중 오류 발생" });
            }
        });
        
        app.post('/api/wordsets', async (req, res) => {
            try {
                const { key, content } = req.body;
                if (!key || !content) return res.status(400).json({ message: '세트 번호와 내용이 필요합니다.' });
                await wordsets.updateOne({ _id: key }, { $set: { content } }, { upsert: true });
                res.status(201).json({ message: `${key}번 세트 저장 성공` });
            } catch (e) { res.status(500).json({ message: "단어 세트 저장 오류" }); }
        });

        app.post('/api/add-set-to-user/:setKey', async (req, res) => {
            const { setKey } = req.params;
            try {
                const wordSet = await wordsets.findOne({ _id: setKey });
                if (!wordSet) return res.status(404).json({ message: '세트를 찾을 수 없습니다.' });

                const lines = wordSet.content.split('\n').filter(line => line.trim());
                const wordsFromSet = [];
                
                lines.forEach(line => {
                    const parts = line.split(',').map(part => part.trim());
                    if (parts.length >= 4) {
                        const title = parts[0];
                        const restOfParts = parts.slice(1);
                        wordsFromSet.push({ id: crypto.randomUUID(), japanese: title, parts: restOfParts });
                    }
                });

                const userDoc = await userdata.findOne({ _id: 'main' });
                const currentVocab = userDoc.data.vocabularyData || [];
                const uniqueNewWords = wordsFromSet;

                const updateQuery = { $addToSet: { 'data.addedSets': setKey } };
                if (uniqueNewWords.length > 0) {
                    updateQuery.$push = { 'data.vocabularyData': { $each: uniqueNewWords } };
                }

                await userdata.updateOne({ _id: 'main' }, updateQuery, { upsert: true });
                res.status(200).json({ message: '학습 목록 추가 성공' });
            } catch (e) { console.error(e); res.status(500).json({ message: "학습 목록 추가 오류" }); }
        });
        
        app.post('/api/correct/update', async (req, res) => {
            const { word, count } = req.body;
            try {
                await userdata.updateOne({ _id: 'main' }, { $set: { [`data.correctCounts.${word}`]: count } }, { upsert: true });
                res.status(200).json({ message: '정답 횟수 업데이트 성공' });
            } catch (e) { res.status(500).json({ message: "정답 횟수 업데이트 중 오류" }); }
        });
        
        app.post('/api/incorrect/update', async (req, res) => {
            const { word, count } = req.body;
            try {
                await userdata.updateOne({ _id: 'main' }, { $set: { [`data.incorrectCounts.${word}`]: count } }, { upsert: true });
                res.status(200).json({ message: '오답 횟수 업데이트 성공' });
            } catch (e) { res.status(500).json({ message: "오답 횟수 업데이트 중 오류" }); }
        });

        app.post('/api/delete-all-words', async (req, res) => {
            try {
                await userdata.updateOne({ _id: 'main' }, { $set: { 'data.vocabularyData': [], 'data.addedSets': [] } });
                res.status(200).json({ message: '단어 목록 삭제 성공' });
            } catch (e) { res.status(500).json({ message: "전체 삭제 중 오류" }); }
        });
        
        app.post('/api/shuffle-words', async (req, res) => {
            try {
                const { shuffledVocabularyData } = req.body;
                await userdata.updateOne({ _id: 'main' }, { $set: { 'data.vocabularyData': shuffledVocabularyData } });
                res.status(200).json({ message: '순서 섞기 성공' });
            } catch (e) { res.status(500).json({ message: "순서 섞기 중 오류" }); }
        });
        
        app.delete('/api/words/:wordId', async (req, res) => {
            try {
                const { wordId } = req.params;
                await userdata.updateOne({ _id: 'main' }, { $pull: { 'data.vocabularyData': { id: wordId } } });
                res.status(200).json({ message: '단어 삭제 성공' });
            } catch (e) { res.status(500).json({ message: "단어 삭제 중 오류" }); }
        });
        
        app.post('/api/userdata/random-set', async (req, res) => {
            try {
                const { count, start, end } = req.body;
                if (!count || count < 1) {
                    return res.status(400).json({ message: '올바른 개수를 입력해주세요.' });
                }

                // 범위가 지정되었다면, 해당 범위의 세트만 가져오도록 쿼리 수정
                const query = {};
                if (start && end) {
                    const setKeysInRange = [];
                    for (let i = start; i <= end; i++) {
                        setKeysInRange.push(String(i));
                    }
                    query._id = { $in: setKeysInRange };
                }

                const targetSets = await wordsets.find(query).toArray();
                let allWords = [];

                targetSets.forEach(setDoc => {
                    const lines = setDoc.content.split('\n').filter(line => line.trim());
                    lines.forEach(line => {
                        const parts = line.split(',').map(part => part.trim());
                        if (parts.length >= 4) {
                            const title = parts[0];
                            const restOfParts = parts.slice(1);
                            allWords.push({ id: crypto.randomUUID(), japanese: title, parts: restOfParts });
                        }
                    });
                });
        
                if (allWords.length === 0) {
                    return res.status(404).json({ message: '해당 범위에 단어 세트가 없습니다.' });
                }

                for (let i = allWords.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [allWords[i], allWords[j]] = [allWords[j], allWords[i]];
                }
        
                const randomSample = allWords.slice(0, count);

                await userdata.updateOne(
                    { _id: 'main' },
                    { $set: { 'data.vocabularyData': randomSample, 'data.addedSets': [] } },
                    { upsert: true }
                );
        
                res.status(200).json({ message: '랜덤 단어 목록 생성 성공' });
            } catch (e) {
                console.error(e);
                res.status(500).json({ message: '랜덤 단어 목록 생성 중 오류 발생' });
            }
        });

        app.post('/api/userdata/search-and-add', async (req, res) => {
            try {
             const { searchTerm } = req.body;
                if (!searchTerm) {
                    return res.status(400).json({ message: '검색어를 입력해주세요.' });
                }

                // 1. DB에서 검색어로 단어 찾기
                const query = { content: { $regex: searchTerm, $options: 'i' } };
                const matchingSets = await wordsets.find(query).toArray();
                let foundWords = [];
                matchingSets.forEach(doc => {
                    const lines = doc.content.split('\n');
                    const filteredLines = lines.filter(line => line.toLowerCase().includes(searchTerm.toLowerCase()));
                    filteredLines.forEach(line => {
                        const parts = line.split(',').map(part => part.trim());
                        if (parts.length >= 4) {
                            const title = parts[0];
                            const restOfParts = parts.slice(1);
                            foundWords.push({ id: crypto.randomUUID(), japanese: title, parts: restOfParts });
                        }
                    });
                });

                // 2. 현재 사용자의 단어 목록 가져오기
                const userDoc = await userdata.findOne({ _id: 'main' });
                const currentVocab = userDoc?.data?.vocabularyData || [];
                const currentVocabTitles = new Set(currentVocab.map(word => word.japanese));

                // 3. 이미 학습 목록에 있는 단어는 제외
                const newWordsToAdd = foundWords.filter(word => !currentVocabTitles.has(word.japanese));

                if (newWordsToAdd.length === 0) {
                    return res.status(200).json({ message: '새롭게 추가할 단어가 없습니다. (이미 학습 목록에 포함)' });
                }

                // 4. 새로운 단어를 기존 목록의 맨 앞에 추가하여 새 목록 생성
                const updatedVocab = [...newWordsToAdd, ...currentVocab];

                // 5. DB 업데이트
                await userdata.updateOne(
                    { _id: 'main' },
                    { $set: { 'data.vocabularyData': updatedVocab } }
                );
        
             res.status(200).json({ message: `${newWordsToAdd.length}개의 단어를 학습 목록에 추가했습니다.` });
            } catch (e) {
                console.error(e);
                res.status(500).json({ message: '단어 검색 및 추가 중 오류 발생' });
            }
        });

        app.listen(port, () => { console.log(`v5 서버가 ${port}번 포트에서 실행 중입니다.`); });
    } catch (e) {
        console.error("DB 연결 실패.", e);
        process.exit(1);
    }
}
startServer();