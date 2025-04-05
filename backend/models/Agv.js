const mongoose = require('mongoose');

const agvSchema = new mongoose.Schema({
    id: { type: String, required: true },
    location: { type: String, required: true },
    task: { type: String, required: true },
    battery: { type: Number, required: true },
    status: { type: String, required: true },
    statusText: { type: String, required: true },
    lastUpdated: { type: Date, default: Date.now },
    speed: { type: Number, default: 0 },
    loadStatus: { type: Boolean, default: false },
    destination: { type: String, default: '' },
    path: { type: [String], default: [] }
});

module.exports = mongoose.model('Agv', agvSchema); 