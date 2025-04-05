const AnalysisData = require('../models/AnalysisData');

class DataUpdateService {
    static async updateInventoryData() {
        try {
            // 修改月份获取逻辑
            const currentMonth = this.getCurrentMonth();
            
            const newData = {
                inventory: {
                    month: currentMonth, // 确保月份正确设置
                    predictedValue: Math.floor(Math.random() * 500) + 1000,
                    actualValue: Math.floor(Math.random() * 500) + 1000,
                    growthRate: Math.random() * 10 - 5,
                    turnoverRate: Math.random() * 20 + 80
                },
                warehouseUtilization: [
                    { name: 'A区仓库', utilization: this.generateUtilization(), capacity: 2000 },
                    { name: 'B区仓库', utilization: this.generateUtilization(), capacity: 1800 },
                    { name: 'C区仓库', utilization: this.generateUtilization(), capacity: 2200 },
                    { name: 'D区仓库', utilization: this.generateUtilization(), capacity: 1500 },
                    { name: 'E区仓库', utilization: this.generateUtilization(), capacity: 1700 }
                ].map(w => ({
                    ...w,
                    availableSpace: w.capacity * (1 - w.utilization / 100),
                    usedSpace: w.capacity * (w.utilization / 100)
                })),
                turnover: {
                    category: '综合',
                    fastTurnover: Math.random() * 0.3 + 0.3,
                    normalTurnover: Math.random() * 0.3 + 0.3,
                    slowTurnover: Math.random() * 0.2 + 0.1,
                    averageDays: Math.floor(Math.random() * 10) + 5,
                    efficiency: Math.random() * 20 + 80
                },
                inOutStatistics: {
                    date: this.getCurrentWeekDay(),
                    inbound: Math.floor(Math.random() * 100) + 100,
                    outbound: Math.floor(Math.random() * 100) + 80,
                    peakHours: ['10:00-12:00', '14:00-16:00'],
                    efficiency: Math.random() * 20 + 80
                }
            };

            await AnalysisData.create(newData);
            
            // 保持最近30天的数据
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            await AnalysisData.deleteMany({ date: { $lt: thirtyDaysAgo } });
            
            console.log('Data updated successfully');
        } catch (error) {
            console.error('Error updating data:', error);
        }
    }

    static generateUtilization() {
        return Math.floor(Math.random() * 30) + 60; // 60% to 90%
    }

    static getCurrentWeekDay() {
        const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return days[new Date().getDay()];
    }

    static getCurrentMonth() {
        // 确保返回正确的月份格式
        const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
        const currentMonthIndex = new Date().getMonth();
        return months[currentMonthIndex];
    }
}

module.exports = DataUpdateService; 