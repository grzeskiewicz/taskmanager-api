const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    username: {
        type: String,
        trim: true,
        required: true,
    },
    room: {
        type: String,
        trim: true,
        required: true
    },
    content: {
        type: String,
        trim: true,
        required: true
    },
    status: {
        type: String,
        trim: true,
        required: true
    },
    timeleft: {
        type: Number,
        trim: true,
        required: true
    },
    date: {
        type: Date,
        trim: true,
        required: true
    }
});



module.exports = mongoose.model('Task', taskSchema);