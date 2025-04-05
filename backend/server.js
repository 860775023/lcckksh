const dotenv = require('dotenv');
const path = require('path');

// 指定 .env 文件路径并添加调试信息
const envPath = path.resolve(__dirname, '.env');
console.log('Loading .env file from:', envPath);

const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('Error loading .env file:', result.error);
  process.exit(1);
}

// 打印环境变量状态
console.log('Environment variables loaded:', {
  hasGlmApiKey: !!process.env.GLM_API_KEY,
  hasGlmApiUrl: !!process.env.GLM_API_URL,
  port: process.env.PORT
});

// 验证环境变量
if (!process.env.GLM_API_KEY || !process.env.GLM_API_URL) {
  console.error('Missing required environment variables:', {
    GLM_API_KEY: !!process.env.GLM_API_KEY,
    GLM_API_URL: !!process.env.GLM_API_URL
  });
  process.exit(1);
}

// 如果环境变量加载失败，使用默认值（仅用于测试）
if (!process.env.GLM_API_KEY) {
  process.env.GLM_API_KEY = '1ce9df0b177048fab77659f147bd484a.nBgwml9AWLiqqkEk';
}
if (!process.env.GLM_API_URL) {
  process.env.GLM_API_URL = 'https://api.zhipuai.cn/api/v1/chat/completions';
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const socketIo = require('socket.io');
const Agv = require('./models/Agv');
const AnalysisData = require('./models/AnalysisData');
const DataUpdateService = require('./services/dataUpdateService');
const AgvUpdateService = require('./services/agvUpdateService');
const axios = require('axios');
const aiService = require('./services/aiService');

const app = express();
const server = http.createServer(app);

// 配置 CORS - 允许所有来源
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// 配置 Socket.IO
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  path: '/socket.io',
  transports: ['websocket', 'polling']
});

app.use(bodyParser.json());

// MongoDB连接
mongoose.connect('mongodb://localhost:27017/warehouse', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected successfully');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// WebSocket 连接处理
io.on('connection', (socket) => {
  console.log('Client connected');

  socket.on('videoFrame', (frameData) => {
    // 广播给除了发送者之外的所有客户端
    socket.broadcast.emit('videoFrame', frameData);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// 获取AGV列表
app.get('/api/agvs', async (req, res) => {
    try {
        const agvs = await Agv.find();
        res.json(agvs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 更新AGV状态
app.put('/api/agvs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updatedAgv = await Agv.findOneAndUpdate({ id }, req.body, { new: true });
        res.json(updatedAgv);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 获取数据分析数据
app.get('/api/analysis', async (req, res) => {
    try {
        const analysisData = await AnalysisData.find().sort({ date: -1 }).limit(1);
        res.json(analysisData[0] || {});
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 更新数据分析数据
app.post('/api/analysis', async (req, res) => {
    try {
        const newData = new AnalysisData(req.body);
        const savedData = await newData.save();
        res.json(savedData);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 获取历史趋势数据
app.get('/api/analysis/trends', async (req, res) => {
    try {
        const trends = await AnalysisData.find({}, 'inventory')
            .sort({ date: -1 })
            .limit(12);
        res.json(trends);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 获取仓库利用率数据
app.get('/api/analysis/utilization', async (req, res) => {
    try {
        const utilization = await AnalysisData.find({}, 'warehouseUtilization')
            .sort({ date: -1 })
            .limit(1);
        res.json(utilization[0]?.warehouseUtilization || []);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 设置定时更新
const UPDATE_INTERVAL = 1500; // 1.5秒更新一次
setInterval(() => {
    DataUpdateService.updateInventoryData();
}, UPDATE_INTERVAL);

// 设置 AGV 数据更新定时器
setInterval(() => {
    AgvUpdateService.updateAgvData();
}, 1500); // 1.5秒更新一次

// 添加新的API端点
app.get('/api/analysis/latest', async (req, res) => {
    try {
        const latestData = await AnalysisData.findOne().sort({ date: -1 });
        res.json(latestData);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 获取历史趋势
app.get('/api/analysis/history', async (req, res) => {
    try {
        const history = await AnalysisData.find()
            .sort({ date: -1 })
            .limit(30);
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 修改图像识别接口
app.post('/api/recognize', async (req, res) => {
  try {
    console.log('\n=== New Image Recognition Request ===');
    console.log('Time:', new Date().toISOString());
    
    const { image } = req.body;
    if (!image) {
      throw new Error('No image data received');
    }
    
    // 验证图片数据格式
    if (!image.startsWith('data:image/')) {
      throw new Error('Invalid image format. Must be base64 data URL.');
    }

    const base64Data = image.split(',')[1];
    console.log('Image validation:', {
      totalLength: image.length,
      base64Length: base64Data.length,
      isBase64: /^[A-Za-z0-9+/=]+$/.test(base64Data)
    });

    // 调用 AI 服务
    console.log('Calling AI service...');
    const description = await aiService.analyzeImage(base64Data);
    
    console.log('AI Analysis completed');
    res.json({ description });
    
  } catch (error) {
    console.error('\n=== Recognition Request Failed ===');
    console.error('Time:', new Date().toISOString());
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      error: 'Image recognition failed',
      details: error.message,
      type: error.constructor.name,
      time: new Date().toISOString()
    });
  }
});

// 添加测试路由
app.get('/api/test', async (req, res) => {
  try {
    console.log('=== Test API called ===');
    
    // 测试环境变量
    const envStatus = {
      status: 'ok',
      env: {
        apiKey: process.env.GLM_API_KEY ? `${process.env.GLM_API_KEY.substring(0, 8)}...` : 'missing',
        apiUrl: process.env.GLM_API_URL || 'missing',
        port: process.env.PORT || '3000'
      },
      server: {
        time: new Date().toISOString(),
        uptime: process.uptime()
      }
    };
    console.log('Environment status:', envStatus);

    // 测试 AI 服务
    const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    try {
      console.log('Testing AI service...');
      const testResult = await aiService.analyzeImage(testImage);
      envStatus.aiTest = {
        status: 'success',
        result: testResult.substring(0, 100) + '...'
      };
    } catch (error) {
      envStatus.aiTest = {
        status: 'error',
        error: error.message
      };
    }

    res.json(envStatus);
  } catch (error) {
    console.error('Test API error:', error);
    res.status(500).json({
      error: 'Test failed',
      message: error.message
    });
  }
});

// 添加环境变量测试路由
app.get('/api/env-test', (req, res) => {
  res.json({
    hasApiKey: !!process.env.GLM_API_KEY,
    hasApiUrl: !!process.env.GLM_API_URL,
    apiUrl: process.env.GLM_API_URL,
    keyPrefix: process.env.GLM_API_KEY ? process.env.GLM_API_KEY.substring(0, 8) + '...' : 'missing'
  });
});

// 添加错误处理中间件
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 启动服务器时监听所有网络接口
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
}); 