const mongoose = require('mongoose');

const analysisDataSchema = new mongoose.Schema({
    date: { type: Date, default: Date.now },
    // 库存趋势数据
    inventory: {
        month: { type: String, required: true },
        predictedValue: { type: Number, required: true },
        actualValue: { type: Number, required: true },
        growthRate: { type: Number }, // 增长率
        turnoverRate: { type: Number } // 周转率
    },
    // 仓库利用率数据
    warehouseUtilization: [{
        name: { type: String, required: true },
        utilization: { type: Number, required: true },
        capacity: { type: Number, required: true },
        availableSpace: { type: Number }, // 可用空间
        usedSpace: { type: Number } // 已用空间
    }],
    // 货物周转数据
    turnover: {
        category: { type: String, required: true },
        fastTurnover: { type: Number, required: true },
        normalTurnover: { type: Number, required: true },
        slowTurnover: { type: Number, required: true },
        averageDays: { type: Number }, // 平均周转天数
        efficiency: { type: Number } // 周转效率
    },
    // 出入库统计数据
    inOutStatistics: {
        date: { type: String, required: true },
        inbound: { type: Number, required: true },
        outbound: { type: Number, required: true },
        peakHours: [{ type: String }], // 高峰时段
        efficiency: { type: Number } // 处理效率
    }
});

module.exports = mongoose.model('AnalysisData', analysisDataSchema); 