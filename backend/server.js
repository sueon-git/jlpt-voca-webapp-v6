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

        // --- API 엔드포인트 ---

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

        app.get('/api/search', async (req, res) => {
            const { term } = req.query;
            if (!term) {
             return res.status(400).json({ message: '검색어가 필요합니다.' });
            }
            try {
             // 모든 단어 세트 문서를 가져옴
                const allSets = await wordsets.find({}).toArray();
                const results = [];

                allSets.forEach(setDoc => {
                     const lines = setDoc.content.split('\n');
                     lines.forEach((line, index) => {
                         // 줄 내용에 검색어가 포함되어 있으면 결과에 추가
                         if (line.includes(term)) {
                             results.push({
                                 set: setDoc._id,       // 세트 번호
                                 line: index + 1,       // 줄 번호
                                 content: line          // 해당 줄의 내용
                    });
                }
            });
        });
        res.json(results);
    } catch (e) {
        res.status(500).json({ message: "검색 중 오류 발생" });
    }
});
        
        app.post('/api/wordsets', async (req, res) => {
            try {
                const { key, content } = req.body;
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
                        // ✨ [핵심 수정] 여기서 데이터를 정확히 분리합니다.
                        const japanese = parts[0];
                        const restOfParts = parts.slice(1);
                        wordsFromSet.push({ id: crypto.randomUUID(), japanese: japanese, parts: restOfParts });
                    }
                });

                const userDoc = await userdata.findOne({ _id: 'main' });
                const currentVocab = userDoc.data.vocabularyData || [];
                const uniqueNewWords = wordsFromSet.filter(nw => !currentVocab.some(ew => ew.japanese === nw.japanese));

                await userdata.updateOne( { _id: 'main' }, {
                        $push: { 'data.vocabularyData': { $each: uniqueNewWords } },
                        $addToSet: { 'data.addedSets': setKey }
                    }, { upsert: true }
                );
                res.status(200).json({ message: '학습 목록 추가 성공' });
            } catch (e) { res.status(500).json({ message: "학습 목록 추가 오류" }); }
        });
        
        app.post('/api/incorrect/update', async (req, res) => {

    console.log("====== /api/incorrect/update 요청 시작 ======");
    console.log("받은 데이터 (req.body):", req.body);
    
    const { word, count } = req.body;
    const safeWordKey = word.replace(/\./g, '_'); 

    try {
        await userdata.updateOne({ _id: 'main' }, { $set: { [`data.incorrectCounts.${safeWordKey}`]: count } });
        
        console.log(`오답 횟수 업데이트 성공: { ${safeWordKey}: ${count} }`);
        res.status(200).json({ message: '오답 횟수 업데이트 성공' });

    } catch (e) {
        console.error("!!!!!! /api/incorrect/update 처리 중 오류 발생 !!!!!!");
        console.error(e); 

        res.status(500).json({ message: "오답 횟수 업데이트 중 오류" });
    }
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

        app.listen(port, () => { console.log(`v3 최종 서버가 ${port}번 포트에서 실행 중입니다.`); });
    } catch (e) {
        console.error("DB 연결 실패.", e);
        process.exit(1);
    }
}
startServer();