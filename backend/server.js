const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const port = 3000;

const uri = "mongodb+srv://ghdtnsqls11:ghdtnsqls11@cluster0.7vvslpu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

const dbName = 'jlpt-vocab-app-v3';
const userDataCollectionName = 'userdata';
const wordSetsCollectionName = 'wordsets';

const corsOptions = {
  origin: 'https://my-vocab-app-sync-v3.netlify.app',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

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
                if (!result) {
                    const initialData = { vocabularyData: [], addedSets: [], incorrectCounts: {} };
                    await userdata.insertOne({ _id: 'main', data: initialData });
                    result = { data: initialData };
                }
                res.json(result.data);
            } catch (e) { res.status(500).json({ message: "사용자 데이터 조회 오류" }); }
        });

        // ✨ [핵심 수정] DB 조회 로직을 더 안정적으로 변경
        app.get('/api/wordsets', async (req, res) => {
            try {
                const sets = await wordsets.find({}).project({ _id: 1 }).toArray();
                const setKeys = sets.map(s => s._id).sort((a, b) => Number(a) - Number(b));
                res.json(setKeys);
            } catch (e) {
                console.error("단어 세트 목록 조회 중 오류:", e);
                res.status(500).json({ message: "단어 세트 목록 조회 오류" });
            }
        });
        
        app.post('/api/wordsets', async (req, res) => {
            try {
                const { key, content } = req.body;
                if (!key || !content) return res.status(400).json({ message: '세트 번호와 내용이 필요합니다.' });
                await wordsets.updateOne({ _id: key }, { $set: { content: content } }, { upsert: true });
                res.status(201).json({ message: `${key}번 세트가 성공적으로 저장되었습니다.` });
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
                        const japanese = parts[0];
                        const restOfParts = parts.slice(1);
                        wordsFromSet.push({ id: crypto.randomUUID(), japanese: japanese, parts: restOfParts });
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
            } catch (e) { res.status(500).json({ message: "학습 목록 추가 오류" }); }
        });
        
        // (다른 API들은 이전과 동일)
        app.post('/api/incorrect/update', async (req, res) => { try { const { word, count } = req.body; await userdata.updateOne({ _id: 'main' }, { $set: { [`data.incorrectCounts.${word}`]: count } }); res.status(200).json({ message: '오답 횟수 업데이트 성공' }); } catch (e) { res.status(500).json({ message: "오답 횟수 업데이트 중 오류" }); } });
        app.post('/api/delete-all-words', async (req, res) => { try { await userdata.updateOne({ _id: 'main' }, { $set: { 'data.vocabularyData': [], 'data.addedSets': [] } }); res.status(200).json({ message: '단어 목록 삭제 성공' }); } catch (e) { res.status(500).json({ message: "전체 삭제 중 오류" }); } });
        app.post('/api/shuffle-words', async (req, res) => { try { const { shuffledVocabularyData } = req.body; await userdata.updateOne({ _id: 'main' }, { $set: { 'data.vocabularyData': shuffledVocabularyData } }); res.status(200).json({ message: '순서 섞기 성공' }); } catch (e) { res.status(500).json({ message: "순서 섞기 중 오류" }); } });

        app.listen(port, () => { console.log(`v3 서버가 ${port}번 포트에서 실행 중입니다.`); });
    } catch (e) {
        console.error("DB 연결 실패.", e);
        process.exit(1);
    }
}
startServer();