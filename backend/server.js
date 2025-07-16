const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const port = 3000;

const uri = "mongodb+srv://ghdtnsqls11:ghdtnsqls11@cluster0.7vvslpu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

const dbName = 'jlpt-vocab-app-v2';
const collectionName = 'data';

const corsOptions = {
  origin: 'https://my-vocab-app-sync-v2.netlify.app/',
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

        // GET /api/data : 모든 데이터를 가져오는 API
        app.get('/api/data', async (req, res) => {
            try {
                const result = await collection.findOne({ _id: 'main' });
                if (result && result.data) {
                    res.json(result.data);
                } else {
                    res.json({ vocabularyData: [], addedSets: [], incorrectCounts: {} });
                }
            } catch (e) { res.status(500).json({ message: "DB 조회 오류" }); }
        });

        // POST /api/words/add : 여러 단어를 추가하는 API
        app.post('/api/words/add', async (req, res) => {
            try {
                const { words, sets } = req.body;
                await collection.updateOne(
                    { _id: 'main' },
                    { 
                        $push: { 'data.vocabularyData': { $each: words } },
                        $addToSet: { 'data.addedSets': { $each: sets } }
                    },
                    { upsert: true }
                );
                res.status(200).json({ message: '단어 추가 성공' });
            } catch (e) { res.status(500).json({ message: "단어 추가 중 오류" }); }
        });

        // POST /api/incorrect/update : 오답 횟수만 수정하는 API
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
        
        // DELETE /api/words/:id : 특정 단어 하나만 삭제하는 API
        app.delete('/api/words/:id', async (req, res) => {
            try {
                const wordId = Number(req.params.id);
                await collection.updateOne(
                    { _id: 'main' },
                    { $pull: { 'data.vocabularyData': { id: wordId } } }
                );
                res.status(200).json({ message: '단어 삭제 성공' });
            } catch (e) { res.status(500).json({ message: "단어 삭제 중 오류" }); }
        });

        // POST /api/data/replace : 단어 순서 변경, 전체 삭제 등 전체 데이터 교체가 필요할 때 사용
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

        app.listen(port, () => {
          console.log(`최종 성능 개선 서버가 ${port}번 포트에서 실행 중입니다.`);
        });

    } catch (e) {
        console.error("DB 연결 실패.", e);
        process.exit(1);
    }
}

startServer();