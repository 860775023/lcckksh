const axios = require('axios');
const https = require('https');

class AIService {
  constructor() {
    // 确保环境变量已加载
    if (!process.env.GLM_API_KEY || !process.env.GLM_API_URL) {
      throw new Error('Missing required environment variables: GLM_API_KEY or GLM_API_URL');
    }

    this.apiKey = process.env.GLM_API_KEY;
    this.apiUrl = process.env.GLM_API_URL;
    
    // 创建 axios 实例
    this.client = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
        timeout: 30000
      }),
      timeout: 30000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    // 添加请求拦截器，打印请求详情
    this.client.interceptors.request.use(config => {
      console.log('Request details:', {
        url: config.url,
        method: config.method,
        headers: config.headers,
        data: {
          ...config.data,
          messages: config.data.messages.map(m => ({
            ...m,
            content: m.content.map(c => ({
              ...c,
              image_base64: c.image_base64 ? 'BASE64_DATA' : c.image_base64
            }))
          }))
        }
      });
      return config;
    });

    // 添加响应拦截器，打印响应详情
    this.client.interceptors.response.use(
      response => {
        console.log('Response details:', {
          status: response.status,
          headers: response.headers,
          data: response.data
        });
        return response;
      },
      error => {
        console.error('Response error details:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        throw error;
      }
    );

    console.log('AI Service initialized with config:', {
      apiUrl: this.apiUrl,
      keyPrefix: this.apiKey.substring(0, 8) + '...'
    });

    // 修改节流控制
    this.lastAnalysisTime = 0;
    this.minInterval = 10000; // 增加到10秒
    this.pendingAnalysis = null;
    this.lastResult = null;
    this.maxQueueSize = 2;
    this.requestQueue = [];
    
    // 添加AGV状态跟踪
    this.lastAgvStatus = {
      timestamp: 0,
      position: null,
      isMoving: false,
      isAbnormal: false
    };
  }

  async analyzeImage(imageBase64) {
    try {
      const now = Date.now();
      const timeSinceLastAnalysis = now - this.lastAnalysisTime;

      // 如果队列已满，返回最后一次的结果
      if (this.requestQueue.length >= this.maxQueueSize) {
        console.log('Queue full, returning last result');
        return this.lastResult || 'Analysis in progress...';
      }

      // 如果间隔太短
      if (timeSinceLastAnalysis < this.minInterval) {
        // 如果已经有待处理的分析，返回最后一次结果
        if (this.pendingAnalysis) {
          console.log('Request too frequent, returning cached result');
          return this.lastResult || 'Analysis in progress...';
        }

        // 添加到队列
        console.log(`Queuing request - ${this.requestQueue.length + 1} requests pending`);
        const queuePromise = new Promise(async (resolve) => {
          this.requestQueue.push({ imageBase64, resolve });
        });

        // 如果是第一个请求，启动处理
        if (this.requestQueue.length === 1) {
          this._processQueue();
        }

        return queuePromise;
      }

      // 直接执行分析
      this.lastAnalysisTime = now;
      const result = await this._doAnalyze(imageBase64);
      this.lastResult = result;
      return result;

    } catch (error) {
      console.error('\n=== AI Analysis Failed ===');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      if (error.response?.data) {
        console.error('Error response data:', error.response.data);
      }
      // 发生错误时返回上一次的结果
      return this.lastResult || 'Analysis failed, please try again later';
    }
  }

  // 处理队列的私有方法
  async _processQueue() {
    while (this.requestQueue.length > 0) {
      const timeSinceLastAnalysis = Date.now() - this.lastAnalysisTime;
      if (timeSinceLastAnalysis < this.minInterval) {
        await new Promise(r => setTimeout(r, this.minInterval - timeSinceLastAnalysis));
      }

      const { imageBase64, resolve } = this.requestQueue[0];
      try {
        this.lastAnalysisTime = Date.now();
        const result = await this._doAnalyze(imageBase64);
        this.lastResult = result;
        resolve(result);
      } catch (error) {
        console.error('Queue processing error:', error);
        resolve(this.lastResult || 'Analysis failed, please try again later');
      }
      this.requestQueue.shift();
    }
  }

  // 实际执行分析的私有方法
  async _doAnalyze(imageBase64) {
    console.log('\n=== Starting Image Analysis ===');
    
    const requestBody = {
      model: "glm-4v",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "请详细描述这张图片中的场景。如果看到AGV小车，请特别关注：1. 它是否在正常移动 2. 是否发生侧翻或异常 3. 是否长时间静止不动。另外也请描述场景中的其他物体和状况。"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      temperature: 0.7,
      top_p: 0.7,
      request_id: Date.now().toString()
    };

    // 打印请求体（不包含图片数据）
    console.log('Request body structure:', {
      ...requestBody,
      messages: requestBody.messages.map(m => ({
        ...m,
        content: m.content.map(c => ({
          type: c.type,
          ...(c.type === 'text' ? { text: c.text } : { image_url: 'BASE64_IMAGE' })
        }))
      }))
    });

    console.log('Sending request to GLM API...');
    const response = await this.client({
      method: 'post',
      url: this.apiUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Request-Id': Date.now().toString()
      },
      data: requestBody
    });

    if (!response.data?.choices?.[0]?.message?.content) {
      console.error('Invalid response format:', response.data);
      throw new Error('Invalid response format from AI API');
    }

    const result = response.data.choices[0].message.content;
    
    // 分析结果，检测异常
    const now = Date.now();
    const analysis = this._analyzeResponse(result, now);
    
    // 如果检测到异常，添加警告信息
    if (analysis.isAbnormal) {
      return `⚠️ 警告！${analysis.warning}\n\n${result}`;
    }

    return result;
  }

  _analyzeResponse(response, timestamp) {
    const analysis = {
      isAbnormal: false,
      warning: null
    };

    // 检查是否提到AGV
    if (response.toLowerCase().includes('agv')) {
      // 检查侧翻
      if (response.includes('侧翻') || response.includes('倾倒') || response.includes('翻倒')) {
        analysis.isAbnormal = true;
        analysis.warning = 'AGV发生侧翻！';
      }
      
      // 检查是否提到静止状态
      const isStationary = response.includes('静止') || response.includes('停止') || response.includes('不动');
      
      // 如果提到静止，且上次状态也是静止，检查时间间隔
      if (isStationary && this.lastAgvStatus.isMoving === false) {
        const stationaryDuration = timestamp - this.lastAgvStatus.timestamp;
        if (stationaryDuration > 30000) { // 如果超过30秒未移动
          analysis.isAbnormal = true;
          analysis.warning = 'AGV已静止超过30秒，可能存在故障！';
        }
      }

      // 更新AGV状态
      this.lastAgvStatus = {
        timestamp,
        isMoving: !isStationary,
        isAbnormal: analysis.isAbnormal
      };
    }

    return analysis;
  }
}

// 创建单例并验证配置
const aiService = new AIService();
console.log('AI Service created and ready');

module.exports = aiService; 