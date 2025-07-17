const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const port = 3000;

const uri = "mongodb+srv://ghdtnsqls11:ghdtnsqls11@cluster0.7vvslpu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

const dbName = 'jlpt-vocab-app-v2';
const collectionName = 'data';

// ✨ CORS 설정 수정 시작
const allowedOrigins = [
    'https://my-vocab-app-sync-v2.netlify.app'
];

const corsOptions = {
  origin: function (origin, callback) {
    // 요청이 허용된 origin 목록에 있거나, origin이 없는 경우(예: Postman) 허용
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
// ✨ CORS 설정 수정 끝

app.use(express.json({ limit: '50mb' }));

async function startServer() {
    try {
        await client.connect();
        console.log("MongoDB Atlas 데이터베이스에 성공적으로 연결되었습니다.");
        const collection = client.db(dbName).collection(collectionName);

        // --- API 엔드포인트들 (이전과 동일) ---
        
        app.get('/api/data', async (req, res) => { try { const result = await collection.findOne({ _id: 'main' }); if (result && result.data) { res.json(result.data); } else { const initialData = { vocabularyData: [], addedSets: [], incorrectCounts: {} }; await collection.insertOne({ _id: 'main', data: initialData }); res.json(initialData); } } catch (e) { res.status(500).json({ message: "DB 조회 오류" }); } });
        app.post('/api/words/add', async (req, res) => { try { const { words, sets } = req.body; if (!words || !words.length) return res.status(400).json({ message: '추가할 단어가 없습니다.' }); const updateQuery = { $push: { 'data.vocabularyData': { $each: words } } }; if (sets && sets.length > 0) { updateQuery.$addToSet = { 'data.addedSets': { $each: sets } }; } await collection.updateOne({ _id: 'main' }, updateQuery, { upsert: true }); res.status(200).json({ message: '단어 추가 성공' }); } catch (e) { console.error(e); res.status(500).json({ message: "단어 추가 중 오류" }); } });
        app.post('/api/incorrect/update', async (req, res) => { try { const { word, count } = req.body; await collection.updateOne({ _id: 'main' }, { $set: { [`data.incorrectCounts.${word}`]: count } }); res.status(200).json({ message: '오답 횟수 업데이트 성공' }); } catch (e) { res.status(500).json({ message: "오답 횟수 업데이트 중 오류" }); } });
        app.post('/api/data/replace', async (req, res) => { try { const newData = req.body; await collection.updateOne({ _id: 'main' }, { $set: { data: newData } }, { upsert: true }); res.status(200).json({ message: '데이터 교체 성공' }); } catch (e) { res.status(500).json({ message: "데이터 교체 중 오류" }); } });
        app.delete('/api/words/:id', async (req, res) => { try { const wordId = Number(req.params.id); await collection.updateOne({ _id: 'main' }, { $pull: { 'data.vocabularyData': { id: wordId } } }); res.status(200).json({ message: '단어 삭제 성공' }); } catch (e) { res.status(500).json({ message: "단어 삭제 중 오류" }); } });

        app.listen(port, () => { console.log(`서버가 ${port}번 포트에서 실행 중입니다.`); });

    } catch (e) {
        console.error("DB 연결 실패.", e);
        process.exit(1);
    }
}

startServer();