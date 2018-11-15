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
const Note = mongoose.model('Note');
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
        console.log('error'
            `Connection error: ${err.message}`);
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
            //  const notes = JSON.parse(req.body.content);
            const date = new Date();

            const user = new Note({ 'username': username, 'password': password, 'date': date });
            user.save()
                .then(() => {
                    res.json({ 'success': true, 'msg': 'Saved' })
                })
                .catch(() => { res.json({ 'success': false, 'msg': 'Sorry! Something went wrong.' }); });

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
app.post('/getnotesdate', [
        body('date')
        .isLength({ min: 1 })
        .withMessage('Please put content'),
    ],
    (req, res) => {
        console.log("HEHEHE");
        const errors = validationResult(req);
        if (errors.isEmpty()) {
            const datebody = req.body.date;
            const dayBeginning = new Date(datebody);
            const dayEnd=new Date(dayBeginning.getTime()+60 * 60 * 24 * 1000);
            Note.find()
            .where('date').gt(dayBeginning).lt(dayEnd)
                .then((notes) => {
                    res.json(notes)
                    console.log(notes);
                })
                .catch(() => { res.json({ 'msg': 'Sorry! Something went wrong.' }); });

        } else {
            res.send('Chuj!');
        }
    }
); */


const server = app.listen(3005, () => {
    console.log(`Express is running on port ${server.address().port}`);
});

module.exports = app;