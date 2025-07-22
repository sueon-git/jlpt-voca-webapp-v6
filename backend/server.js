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
  // ✨ 주소 끝의 슬래시(/)를 제거합니다.
  origin: 'https://jlpt-voca-webapp-v3.netlify.app',
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

        // (이하 모든 API 코드는 이전과 동일합니다.)
        app.get('/api/userdata', async (req, res) => { try { let result = await userdata.findOne({ _id: 'main' }); if (!result) { const initialData = { vocabularyData: [], addedSets: [], incorrectCounts: {} }; await userdata.insertOne({ _id: 'main', data: initialData }); result = { data: initialData }; } res.json(result.data); } catch (e) { res.status(500).json({ message: "사용자 데이터 조회 오류" }); } });
        app.get('/api/wordsets', async (req, res) => { try { const sets = await wordsets.find({}, { projection: { _id: 1 } }).toArray(); const setKeys = sets.map(s => s._id); res.json(setKeys); } catch (e) { res.status(500).json({ message: "단어 세트 목록 조회 오류" }); } });
        app.post('/api/wordsets', async (req, res) => { try { const { key, content } = req.body; if (!key || !content) return res.status(400).json({ message: '세트 번호와 내용이 필요합니다.' }); await wordsets.updateOne({ _id: key }, { $set: { content } }, { upsert: true }); res.status(201).json({ message: `${key}번 세트 저장 성공` }); } catch (e) { res.status(500).json({ message: "단어 세트 저장 오류" }); } });
        app.post('/api/add-set-to-user/:setKey', async (req, res) => { const { setKey } = req.params; try { const wordSet = await wordsets.findOne({ _id: setKey }); if (!wordSet) return res.status(404).json({ message: '세트를 찾을 수 없습니다.' }); const lines = wordSet.content.split('\n').filter(line => line.trim()); const wordsFromSet = []; lines.forEach((line, index) => { const parts = line.split(',').map(part => part.trim()); if (parts.length >= 4) { const [japanese, ...rest] = parts; wordsFromSet.push({ id: crypto.randomUUID(), japanese, parts }); } }); const userDoc = await userdata.findOne({ _id: 'main' }); const currentVocab = userDoc.data.vocabularyData || []; const uniqueNewWords = wordsFromSet.filter(nw => !currentVocab.some(ew => ew.japanese === nw.japanese)); if (uniqueNewWords.length > 0) { await userdata.updateOne({ _id: 'main' }, { $push: { 'data.vocabularyData': { $each: uniqueNewWords } } }); } await userdata.updateOne({ _id: 'main' }, { $addToSet: { 'data.addedSets': setKey } }); res.status(200).json({ message: `${setKey}번 세트가 학습 목록에 추가되었습니다.` }); } catch (e) { res.status(500).json({ message: "학습 목록 추가 오류" }); } });
        app.post('/api/incorrect/update', async (req, res) => { const { word, count } = req.body; try { await userdata.updateOne({ _id: 'main' }, { $set: { [`data.incorrectCounts.${word}`]: count } }); res.status(200).json({ message: '오답 횟수 업데이트 성공' }); } catch (e) { res.status(500).json({ message: "오답 횟수 업데이트 중 오류" }); } });
        app.post('/api/delete-all-words', async (req, res) => { try { await userdata.updateOne({ _id: 'main' }, { $set: { 'data.vocabularyData': [], 'data.addedSets': [] } }); res.status(200).json({ message: '단어 목록 삭제 성공' }); } catch (e) { res.status(500).json({ message: "전체 삭제 중 오류" }); } });
        app.post('/api/shuffle-words', async (req, res) => { try { const { shuffledVocabularyData } = req.body; await userdata.updateOne({ _id: 'main' }, { $set: { 'data.vocabularyData': shuffledVocabularyData } }); res.status(200).json({ message: '순서 섞기 성공' }); } catch (e) { res.status(500).json({ message: "순서 섞기 중 오류" }); } });

        app.listen(port, () => { console.log(`v3 서버가 ${port}번 포트에서 실행 중입니다.`); });
    } catch (e) {
        console.error("DB 연결 실패.", e);
        process.exit(1);
    }
}
startServer();