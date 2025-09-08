const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const port = 3000;

const uri = "mongodb+srv://ghdtnsqls11:ghdtnsqls11@cluster0.7vvslpu.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri);

const dbName = 'jlpt-vocab-app-v5';
const userDataCollectionName = 'userdata';
const wordSetsCollectionName = 'wordsets';

const corsOptions = {
  origin: 'https://jlpt-voca-webapp-v5.netlify.app',
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
                const sets = await wordsets.find({}, { projection: { _id: 1 } }).toArray();
                const setKeys = sets.map(s => s._id).sort((a, b) => Number(a) - Number(b));
                res.json(setKeys);
            } catch (e) { res.status(500).json({ message: "단어 세트 목록 조회 오류" }); }
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
                const uniqueNewWords = wordsFromSet.filter(nw => !currentVocab.some(ew => ew.japanese === nw.japanese));

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
                const { count } = req.body;
                if (!count || count < 1) {
                    return res.status(400).json({ message: '올바른 개수를 입력해주세요.' });
                }

                const allSets = await wordsets.find({}).toArray();
                let allWords = [];

                allSets.forEach(setDoc => {
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

        app.listen(port, () => { console.log(`v5 서버가 ${port}번 포트에서 실행 중입니다.`); });
    } catch (e) {
        console.error("DB 연결 실패.", e);
        process.exit(1);
    }
}
startServer();