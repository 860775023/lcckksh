const Agv = require('../models/Agv');

class AgvUpdateService {
    static async updateAgvData() {
        try {
            const agvData = [
                {
                    id: 'AGV001',
                    location: `A${Math.floor(Math.random() * 5) + 1}`,
                    task: ['运输中', '待机中', '充电中'][Math.floor(Math.random() * 3)],
                    battery: Math.floor(Math.random() * 30) + 70,
                    status: ['normal', 'warning', 'error'][Math.floor(Math.random() * 3)],
                    statusText: '正常运行',
                    speed: Math.floor(Math.random() * 5) + 1,
                    loadStatus: Math.random() > 0.5
                },
                {
                    id: 'AGV002',
                    location: `B${Math.floor(Math.random() * 5) + 1}`,
                    task: ['运输中', '待机中', '充电中'][Math.floor(Math.random() * 3)],
                    battery: Math.floor(Math.random() * 30) + 70,
                    status: ['normal', 'warning', 'error'][Math.floor(Math.random() * 3)],
                    statusText: '正常运行',
                    speed: Math.floor(Math.random() * 5) + 1,
                    loadStatus: Math.random() > 0.5
                }
            ];

            // 更新或创建 AGV 数据
            for (const agv of agvData) {
                await Agv.findOneAndUpdate(
                    { id: agv.id },
                    { ...agv, lastUpdated: new Date() },
                    { upsert: true, new: true }
                );
            }

            console.log('AGV data updated successfully');
        } catch (error) {
            console.error('Error updating AGV data:', error);
        }
    }
}

module.exports = AgvUpdateService; 