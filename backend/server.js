const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const port = 3000;

const uri = "mongodb+srv://ghdtnsqls11:ghdtnsqls11@cluster0.7vvslpu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

const dbName = 'jlpt-vocab-app-v4';
const userDataCollectionName = 'userdata';
const wordSetsCollectionName = 'wordsets';

const corsOptions = {
  origin: 'https://my-vocab-app-sync-v4.netlify.app',
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
                await wordsets.updateOne({ _id: key }, { $set: { content } }, { upsert: true });
                res.status(201).json({ message: `${key}번 세트 저장 성공` });
            } catch (e) { res.status(500).json({ message: "단어 세트 저장 오류" }); }
        });

        // ✨ [핵심 수정] 입력 순서를 그대로 존중하는 로직으로 변경
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
                        const title = parts[0]; // 첫 번째 항목을 무조건 제목(japanese 필드)으로 사용
                        const restOfParts = parts.slice(1); // 나머지를 상세 정보로 사용
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
        
        app.post('/api/incorrect/update', async (req, res) => {
            const { word, count } = req.body;
            try {
                await userdata.updateOne({ _id: 'main' }, { $set: { [`data.incorrectCounts.${word}`]: count } });
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

        app.listen(port, () => { console.log(`v4 서버가 ${port}번 포트에서 실행 중입니다.`); });
    } catch (e) {
        console.error("DB 연결 실패.", e);
        process.exit(1);
    }
}
startServer();