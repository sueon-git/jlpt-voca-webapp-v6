const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const port = 3000;

const uri = "mongodb+srv://ghdtnsqls11:ghdtnsqls11@cluster0.7vvslpu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

const dbName = 'jlpt-vocab-app-v2'; // 프로젝트 #2용 DB
const collectionName = 'data';

const corsOptions = {
  origin: 'https://my-vocab-app-sync-v2.netlify.app',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

async function startServer() {
    try {
        await client.connect();
        console.log("MongoDB Atlas 데이터베이스에 성공적으로 연결되었습니다.");
        const collection = client.db(dbName).collection(collectionName);

        // --- API 엔드포인트 ---

        app.get('/api/data', async (req, res) => {
            try {
                const result = await collection.findOne({ _id: 'main' });
                if (result && result.data) {
                    res.json(result.data);
                } else {
                    // 데이터가 없으면 초기화해서 생성
                    const initialData = { vocabularyData: [], addedSets: [], incorrectCounts: {} };
                    await collection.insertOne({ _id: 'main', data: initialData });
                    res.json(initialData);
                }
            } catch (e) { res.status(500).json({ message: "DB 조회 오류" }); }
        });

        // ✨ [핵심 개선] 세트 추가 API
        app.post('/api/add-words', async (req, res) => {
            try {
                const { newWords, newSets } = req.body;
                if (!newWords || !newWords.length) return res.status(400).json({ message: '추가할 단어가 없습니다.' });

                // $push로 단어 배열에 추가, $addToSet으로 중복 없이 세트 번호 추가
                await collection.updateOne(
                    { _id: 'main' },
                    { 
                        $push: { 'data.vocabularyData': { $each: newWords } },
                        $addToSet: { 'data.addedSets': { $each: newSets } }
                    },
                    { upsert: true }
                );
                res.status(200).json({ message: '단어 추가 성공' });
            } catch (e) { res.status(500).json({ message: "단어 추가 중 오류" }); }
        });

        // [성능 개선] 오답 횟수만 수정하는 API
        app.post('/api/incorrect/update', async (req, res) => {
            try {
                const { word, count } = req.body;
                await collection.updateOne(
                    { _id: 'main' },
                    { $set: { [`data.incorrectCounts.${word}`]: count } }
                );
                res.status(200).json({ message: '오답 횟수 업데이트 성공' });
            } catch (e) { res.status(500).json({ message: "오답 횟수 업데이트 중 오류" }); }
        });
        
        // [성능 개선] 전체 데이터 교체 API (삭제, 섞기용)
        app.post('/api/data/replace', async (req, res) => {
            try {
                const newData = req.body;
                await collection.updateOne(
                    { _id: 'main' },
                    { $set: { data: newData } },
                    { upsert: true }
                );
                res.status(200).json({ message: '데이터 교체 성공' });
            } catch (e) { res.status(500).json({ message: "데이터 교체 중 오류" }); }
        });

        app.listen(port, () => { console.log(`최종 서버가 ${port}번 포트에서 실행 중입니다.`); });
    } catch (e) {
        console.error("DB 연결 실패.", e);
        process.exit(1);
    }
}

startServer();