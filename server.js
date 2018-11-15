require('dotenv').config();
require('./database/User');
const mongoose = require('mongoose');
var express = require('express'),
    app = express();
var cors = require('cors');
var http = require('http').Server(app);
const { body, validationResult } = require('express-validator/check');
var bodyParser = require('body-parser');
const path = require('path');
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
app.use(bodyParser.json()); // support json encoded bodies 
const User = mongoose.model('User');
const auth = require('http-auth');

const basic = auth.basic({
    file: path.join(__dirname, 'users.htpasswd'),
});



mongoose.connect(process.env.DATABASE);
mongoose.Promise = global.Promise;
mongoose.connection
    .on('connected', () => {
        console.log(`Mongoose connection open on ${process.env.DATABASE}`);
    })
    .on('error', (err) => {
        console.log(`Connection error: ${err.message}`);
    });




app.options('*', cors()) // include before other routes

app.get('/', function(req, res) {
    let date = new Date();
    res.send(date);

});


app.post('/createuser', [
        body('username')
        .isLength({ min: 1 })
        .withMessage('Please put content'),
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (errors.isEmpty()) {
              const data = req.body;
            const date = new Date();

            const user = new User({ 'username': data.username, 'password': data.password, 'date': date , 'role' : data.role});
            console.log(user);
            user.save()
                .then(() => {
                    res.json({ 'success': true, 'msg': 'Saved' })
                })
                .catch((err) => { console.log(err);res.json({ 'success': false, 'msg': 'Sorry! Something went wrong.' }); });

        } else {
            res.send('Chuj!');
        }
    }
);



app.get('/getusers', (req, res) => {
    User.find()
        .then((users) => {
            res.json(users)
            console.log(users);
        })
        .catch(() => { res.json({ 'msg': 'Sorry! Something went wrong.' }); });
});

/*
// create a user a new user
var testUser = new User({
    username: 'jmar777',
    password: 'Password123';
});

// save user to database
testUser.save(function(err) {
    if (err) throw err;
});


User.findOne({ username: 'jmar777' }, function(err, user) {
    if (err) throw err;

    // test a matching password
    user.comparePassword('Password123', function(err, isMatch) {
        if (err) throw err;
        console.log('Password123:', isMatch); // -&gt; Password123: true
    });

    // test a failing password
    user.comparePassword('123Password', function(err, isMatch) {
        if (err) throw err;
        console.log('123Password:', isMatch); // -&gt; 123Password: false
    });
});

*/


const server = app.listen(3005, () => {
    console.log(`Express is running on port ${server.address().port}`);
});

module.exports = app;