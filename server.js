require('dotenv').config();
require('./database/User');
var jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
var express = require('express'),
    app = express();
var cors = require('cors');
var http = require('http').Server(app);
var io = require('socket.io')(http);
const { body, validationResult } = require('express-validator/check');
var bodyParser = require('body-parser');
const path = require('path');
/*var corsOptions = {  //for reacts js 
  origin: 'http://localhost:3000',
  credentials:true,
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}*/
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

            const user = new User({ 'username': data.username, 'password': data.password, 'date': date, 'role': data.role });
            console.log(user);
            user.save()
                .then(() => {
                    res.json({ 'success': true, 'msg': 'Saved' })
                })
                .catch((err) => {
                    console.log(err);
                    res.json({ 'success': false, 'msg': 'Sorry! Something went wrong.' });
                });

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


app.post('/authuser', [
        body('username')
        .isLength({ min: 1 })
        .withMessage('Please put content'),
        body('password')
        .isLength({ min: 1 })
        .withMessage('Please put content')
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (errors.isEmpty()) {
            const data = req.body;
            // console.log(data);
            User.findOne({ username: data.username }, function(err, user) {
                if (err) throw err;
                // test a matching password
                user.comparePassword(data.password, function(err, isMatch) {
                    if (err) throw err;
                    if (isMatch) res.json({ success: true, msg: 'Credentials are ok', token: 'JWT ' + jwt.sign({ username: user.username, id: user._id, role: user.role }, 'RESTFULAPIs') });
                });
            });

        } else {
            res.send('Chuj!');
        }
    }
);


app.get('/memberinfo', (req, res) => {
    //console.log(req.headers);
    if (req.headers && req.headers.authorization && req.headers.authorization.split(' ')[0] === 'JWT') {
        jwt.verify(req.headers.authorization.split(' ')[1], 'RESTFULAPIs', function(err, decode) {
            // console.log("DECODE: ");
            //console.log(decode);
            if (err) req.user = undefined;
            if (decode === undefined) {
                res.json({ success: false, msg: "No token" });
            }

            User.findOne({ username: decode.username }, function(err, user) {
                if (err) throw err;
                if (user) {
                    res.json({ success: true, msg: decode.username, role: decode.role });
                } else {
                    res.json({ success: false, msg: "No such user registered" });
                }

            });
            req.user = decode; //?
        });
    } else {
        res.json({ success: false, msg: "Token not provided" });
        req.user = undefined;
    }
});

const userlist = new Set();

io.on('connection', function(socket) {
    console.log('a user connected');
    socket.on('disconnect', function() {
        console.log('user disconnected');
    });

    socket.on('test1', function(msg) {
        console.log('message: ' + msg);
    });

    /*socket.on('newtask', function(task) {
        task['status'] = 'new';

        //var nsp = io.of(`/${task.username}`);
        //console.log(task);
        //nsp.emit('taskreceived', task);
    });*/



    socket.on('logged', function(user) {
        var nsp = io.of(`/${user}`);
        nsp.on('connection', function(userSocket) {
            console.log('someone connected');
            console.log(userSocket);
            userSocket.on('newtask',function(task){
                console.log('newtask sockethehe');
                task['status'] = 'new';
                userSocket.emit('taskreceived', task);
            });
        });
        userlist.add(user);
        console.log(userlist);
        io.emit('userlist', { userlist: Array.from(userlist) });

    });

    socket.on('logout', function(user) {
        userlist.delete(user);
        console.log(userlist);
        io.emit('userlist', { userlist: Array.from(userlist) });

    });

    socket.on('ticketordered', function(ticket) {
        console.log('message: ' + ticket);
        io.emit('seatstakennow', { showing: ticket.showing, seats: ticket.seats });
    });
});



var port = process.env.PORT || 8080,
    ip = process.env.IP || '0.0.0.0';

http.listen(port, ip);
console.log('Server running on http://%s:%s', ip, port);

module.exports = app;