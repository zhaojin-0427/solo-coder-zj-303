import express from 'express';
import cors from 'cors';
import routes from './routes';

const app = express();
const PORT = 9202;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '宝宝绘本借阅平台API运行正常' });
});

app.use('/api', routes);

app.listen(PORT, () => {
  console.log(`🚀 后端服务器已启动: http://localhost:${PORT}`);
  console.log(`📚 API文档: http://localhost:${PORT}/api/health`);
});
