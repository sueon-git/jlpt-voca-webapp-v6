const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const port = 3000;

const uri = "mongodb+srv://ghdtnsqls11:ghdtnsqls11@cluster0.7vvslpu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

const dbName = 'jlpt-vocab-app-v3'; // v3용 데이터베이스 이름
const userDataCollectionName = 'userdata'; // 사용자 학습 데이터
const wordSetsCollectionName = 'wordsets'; // 단어 세트 원본 데이터

const corsOptions = {
  origin: 'https://jlpt-voca-webapp-v3.netlify.app', // v3용 Netlify 주소
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

async function startServer() {
    try {
        await client.connect();
        console.log("MongoDB Atlas 데이터베이스에 성공적으로 연결되었습니다.");
        const db = client.db(dbName);
        const userDataCollection = db.collection(userDataCollectionName);
        const wordSetsCollection = db.collection(wordSetsCollectionName);

        // --- API 엔드포인트 ---

        // GET /api/userdata : 사용자 학습 데이터를 가져오는 API
        app.get('/api/userdata', async (req, res) => {
            try {
                let result = await userDataCollection.findOne({ _id: 'main' });
                if (!result) {
                    const initialData = { vocabularyData: [], addedSets: [], incorrectCounts: {} };
                    await userDataCollection.insertOne({ _id: 'main', data: initialData });
                    result = { data: initialData };
                }
                res.json(result.data);
            } catch (e) { res.status(500).json({ message: "사용자 데이터 조회 오류" }); }
        });

        // GET /api/wordsets : 추가 가능한 모든 단어 세트 목록을 가져오는 API
        app.get('/api/wordsets', async (req, res) => {
            try {
                const sets = await wordSetsCollection.find({}, { projection: { _id: 1 } }).toArray();
                const setKeys = sets.map(s => s._id);
                res.json(setKeys);
            } catch (e) { res.status(500).json({ message: "단어 세트 목록 조회 오류" }); }
        });
        
        // POST /api/wordsets : 새로운 단어 세트를 DB에 추가하는 API
        app.post('/api/wordsets', async (req, res) => {
            try {
                const { key, content } = req.body;
                if (!key || !content) return res.status(400).json({ message: '세트 번호와 내용이 필요합니다.' });
                
                await wordSetsCollection.updateOne(
                    { _id: key },
                    { $set: { content: content } },
                    { upsert: true }
                );
                res.status(201).json({ message: `${key}번 세트가 성공적으로 저장되었습니다.` });
            } catch (e) { res.status(500).json({ message: "단어 세트 저장 오류" }); }
        });

        // POST /api/add-set-to-user/:setKey : 특정 세트를 사용자 학습 목록에 추가하는 API
        app.post('/api/add-set-to-user/:setKey', async (req, res) => {
            const { setKey } = req.params;
            try {
                const wordSet = await wordSetsCollection.findOne({ _id: setKey });
                if (!wordSet) return res.status(404).json({ message: '세트를 찾을 수 없습니다.' });

                const lines = wordSet.content.split('\n').filter(line => line.trim());
                const newWords = [];
                lines.forEach((line, index) => {
                    const parts = line.split(',').map(part => part.trim());
                    if (parts.length >= 4) {
                        const [japanese, ...rest] = parts;
                        newWords.push({ id: Date.now() + index, japanese, parts: rest });
                    }
                });

                const userDoc = await userDataCollection.findOne({ _id: 'main' });
                const currentVocab = userDoc.data.vocabularyData || [];
                const uniqueNewWords = newWords.filter(nw => !currentVocab.some(ew => ew.japanese === nw.japanese));

                await userDataCollection.updateOne(
                    { _id: 'main' },
                    {
                        $push: { 'data.vocabularyData': { $each: uniqueNewWords } },
                        $addToSet: { 'data.addedSets': setKey }
                    }
                );
                res.status(200).json({ message: `${setKey}번 세트가 학습 목록에 추가되었습니다.` });
            } catch (e) { res.status(500).json({ message: "학습 목록 추가 오류" }); }
        });

        // (기존 오답, 삭제, 섞기 API들은 userDataCollection을 바라보도록 수정 필요)
        // ... 생략 ... (이후 단계에서 구체화)

        app.listen(port, () => { console.log(`v3 서버가 ${port}번 포트에서 실행 중입니다.`); });

    } catch (e) {
        console.error("DB 연결 실패.", e);
        process.exit(1);
    }
}
startServer();