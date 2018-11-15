const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        trim: true,
    },
    password: {
        type: String,
        trim: true,
    },
    role: {
        type: String,
        trim: true,
    },
    date: {
        type: Date,
        trim: true,
    }
});
module.exports = mongoose.model('User', userSchema);