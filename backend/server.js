const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const port = 3000;

const uri = "mongodb+srv://ghdtnsqls11:ghdtnsqls11@cluster0.7vvslpu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

const dbName = 'jlpt-vocab-app-v3';
const collectionName = 'data';

const corsOptions = {
  origin: 'https://jlpt-voca-webapp-v3.netlify.app',
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

        // ✨ [핵심 수정] GET 요청은 이제 절대로 데이터를 쓰지 않습니다.
        app.get('/api/data', async (req, res) => {
            try {
                const result = await collection.findOne({ _id: 'main' });
                if (result && result.data) {
                    res.json(result.data); // 데이터가 있으면 그대로 반환
                } else {
                    // 데이터가 없으면, 새로 만들지 않고 그냥 비어있는 상태를 반환
                    res.json({ vocabularyData: [], addedSets: [], incorrectCounts: {} });
                }
            } catch (e) {
                res.status(500).json({ message: "DB 조회 오류" });
            }
        });

        // ✨ [핵심 수정] 데이터가 없을 경우, POST 요청이 처음으로 데이터를 생성합니다.
        app.post('/api/data/replace', async (req, res) => {
            try {
                const newData = req.body;
                // upsert: true 옵션 덕분에 _id: 'main' 문서가 없으면 새로 생성해줍니다.
                await collection.updateOne(
                    { _id: 'main' },
                    { $set: { data: newData } },
                    { upsert: true }
                );
                res.status(200).json({ message: '데이터 교체 성공' });
            } catch (e) {
                res.status(500).json({ message: "데이터 교체 중 오류" });
            }
        });
        
        // (다른 API들은 이전과 동일하게 유지됩니다)
        app.post('/api/words/add', async (req, res) => { try { const { words, sets } = req.body; if (!words || !words.length) return res.status(400).json({ message: '추가할 단어가 없습니다.' }); const updateQuery = { $push: { 'data.vocabularyData': { $each: words } } }; if (sets && sets.length > 0) { updateQuery.$addToSet = { 'data.addedSets': { $each: sets } }; } await collection.updateOne({ _id: 'main' }, updateQuery, { upsert: true }); res.status(200).json({ message: '단어 추가 성공' }); } catch (e) { console.error(e); res.status(500).json({ message: "단어 추가 중 오류" }); } });
        app.post('/api/incorrect/update', async (req, res) => { try { const { word, count } = req.body; await collection.updateOne({ _id: 'main' }, { $set: { [`data.incorrectCounts.${word}`]: count } }); res.status(200).json({ message: '오답 횟수 업데이트 성공' }); } catch (e) { res.status(500).json({ message: "오답 횟수 업데이트 중 오류" }); } });
        app.delete('/api/words/:id', async (req, res) => { try { const wordId = Number(req.params.id); await collection.updateOne({ _id: 'main' }, { $pull: { 'data.vocabularyData': { id: wordId } } }); res.status(200).json({ message: '단어 삭제 성공' }); } catch (e) { res.status(500).json({ message: "단어 삭제 중 오류" }); } });


        app.listen(port, () => { console.log(`최종 안정화 서버가 ${port}번 포트에서 실행 중입니다.`); });
    } catch (e) {
        console.error("DB 연결 실패.", e);
        process.exit(1);
    }
}

startServer();