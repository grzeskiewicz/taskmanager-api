require('dotenv').config();
require('./database/User');
require('./database/Task');
var jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
var express = require('express'),
    app = express();
var cors = require('cors');
app.use(cors());
var http = require('http').Server(app);
var io = require('socket.io')(http);
const {
    body,
    validationResult
} = require('express-validator/check');
var bodyParser = require('body-parser');
const path = require('path');
/*var corsOptions = {  //for reacts js 
  origin: 'http://localhost:3000',
  credentials:true,
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}*/
app.use(bodyParser.urlencoded({
    extended: true
})); // support encoded bodies
app.use(bodyParser.json()); // support json encoded bodies 
const User = mongoose.model('User');
const Task = mongoose.model('Task');
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

app.get('/', function (req, res) {
    let date = new Date();
    res.send(date);

});


app.post('/createuser', [
    body('username')
        .isLength({
            min: 1
        })
        .withMessage('Please put content'),
],
    (req, res) => {
        const errors = validationResult(req);
        if (errors.isEmpty()) {
            const data = req.body;
            const date = new Date();

            const user = new User({
                'username': data.username,
                'password': data.password,
                'date': date,
                'role': data.role
            });
            user.save()
                .then(() => {
                    io.to(`/admin-room`).emit('userlist', {
                        userlist: Array.from(userlist)
                    });
                    res.json({
                        'success': true,
                        'msg': 'Saved'
                    })
                })
                .catch((err) => {
                    // console.log(err);
                    res.json({
                        'success': false,
                        'msg': 'Sorry! Something went wrong.'
                    });
                });

        } else {
            res.send('Chuj!');
        }
    }
);



app.post('/resetpassword',
    (req, res) => {
        const errors = validationResult(req);
        if (errors.isEmpty()) {
            const user = req.body;
            console.log(user);
            User.findOne({
                username: user.username,
            }, function (err, userRecord) {
                if (err) throw err;
                if (userRecord) {
                    userRecord.set({
                        password: user.password
                    });
                    userRecord.save()
                        .then(() => {
                            // console.log('Updated password');
                            res.json({
                                'success': true,
                                'msg': 'Password changed nicely'
                            });
                        })
                        .catch((err) => {
                            console.log(err);
                        });
                } else {
                    //res.json({ success: false, msg: "No such user registered" });
                }

            });

        } else {
            res.send('Chuj!');
        }
    }
);


app.post('/deleteuser',
    (req, res) => {
        const errors = validationResult(req);
        if (errors.isEmpty()) {
            const user = req.body;
            User.findOneAndDelete({
                username: user.user,
            }, function (err) {
                if (err) { throw err } else {
                    userlist.delete(user);
                    io.to(`/admin-room`).emit('userlist', {
                        userlist: Array.from(userlist)
                    });
                    res.json({
                        'success': true,
                        'msg': 'User deleted!'
                    });
                }
            });




        } else {
            res.send('Chuj!');
        }
    }
);



app.get('/getusers', (req, res) => {
    User.find()
        .then((users) => {
            const usernames = [];
            for (const user of users) if (user.username !== "admin") usernames.push(user.username);
            res.json(usernames);
            // console.log(usernames);
        })
        .catch(() => {
            res.json({
                'msg': 'Sorry! Something went wrong.'
            });
        });
});


app.post('/authuser', [
    body('username')
        .isLength({
            min: 1
        })
        .withMessage('Please put content'),
    body('password')
        .isLength({
            min: 1
        })
        .withMessage('Please put content')
],
    (req, res) => {
        const errors = validationResult(req);
        if (errors.isEmpty()) {
            const data = req.body;
            // console.log(data);
            User.findOne({
                username: data.username
            }, function (err, user) {
                if (err) throw err;
                // test a matching password
                user.comparePassword(data.password, function (err, isMatch) {
                    if (err) throw err;
                    if (isMatch) res.json({
                        success: true,
                        msg: 'Credentials are ok',
                        token: 'JWT ' + jwt.sign({
                            username: user.username,
                            id: user._id,
                            role: user.role
                        }, 'RESTFULAPIs')
                    });
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
        jwt.verify(req.headers.authorization.split(' ')[1], 'RESTFULAPIs', function (err, decode) {
            // console.log("DECODE: ");
            //console.log(decode);
            if (err) req.user = undefined;
            if (decode === undefined) {
                res.json({
                    success: false,
                    msg: "No token"
                });
            }

            User.findOne({
                username: decode.username
            }, function (err, user) {
                if (err) throw err;
                if (user) {
                    res.json({
                        success: true,
                        msg: decode.username,
                        role: decode.role
                    });
                } else {
                    res.json({
                        success: false,
                        msg: "No such user registered"
                    });
                }

            });
            req.user = decode; //?
        });
    } else {
        res.json({
            success: false,
            msg: "Token not provided"
        });
        req.user = undefined;
    }
});



app.post('/gettasksday',
    (req, res) => {
        const errors = validationResult(req);
        if (errors.isEmpty()) {
            const selectedDay = req.body.date;
            const day = new Date(Date.parse(selectedDay));
            console.log(selectedDay, day);
           // const dayBeginning = new Date(day.setHours(0, 0, 0, 0));
           // const dayEnd = new Date(dayBeginning.getTime() + 60 * 60 * 24 * 1000);
            /*return Task.find({
  
                date: {
                    $gt: dayBeginning,
                    $lt: dayEnd
                }
            })
                // .where('date').gt(dayBeginning).lt(dayEnd)
                .then((tasks) => {
                    return tasks
                })
                .catch(() => {
                    console.log({
                        'msg': 'Sorry! Something went wrong.'
                    });
                });*/
        } else {
            res.send('Chuj!');
        }
    }
);

function socketExists(user) {
    let sockets = io.sockets.sockets;
    for (var socketId in sockets) { //check if the nsp already exists, don't create new one when logging in
        //loop through and do whatever with each connected socket
        const socketL = sockets[socketId];
        const socketNames = Object.keys(socketL.nsp.server.nsps);
        for (var socketName of socketNames) {
            console.log(socketName);
            if (socketName === user) return true;

        }
        //namespaces.push();

    }
    return false;
}

function switchTask(username, updatedTask) {
    const userTasks = tasklist[username];
    for (taskElem in userTasks) {
        if (userTasks[taskElem].room === updatedTask.room && userTasks[taskElem].content === updatedTask.content) {
            userTasks[taskElem] = updatedTask;
        }
    }
}


function createTaskDb(task) {
    const date = new Date();
    const taskDb = new Task({
        'username': task.username,
        'room': task.room,
        'content': task.content,
        'status': task.status,
        'timetoaccept': task.timetoaccept,
        'timeleft': task.timeleft,
        'date': date
    });
    return taskDb.save()
        .then(() => {
            console.log('Saved task');
        })
        .catch((err) => {
            console.log(err);
        });
}


function updateTaskDb(task) {

    return Task.findOne({
        username: task.username,
        room: task.room,
        content: task.content
    }, function (err, taskDb) {
        if (err) throw err;
        if (taskDb) {
            taskDb.set({
                status: task.status,
                timetoaccept: task.timetoaccept,
                timeleft: task.timeleft
            });
            taskDb.save()
                .then(() => {
                    console.log('Updated task');
                })
                .catch((err) => {
                    console.log(err);
                });
        } else {
            //res.json({ success: false, msg: "No such user registered" });
        }

    });
}

function importTasksDb(username) {
    const day = new Date();
    console.log(day);
    const dayBeginning = new Date(day.setHours(0, 0, 0, 0));
    const dayEnd = new Date(dayBeginning.getTime() + 60 * 60 * 24 * 1000);
    return Task.find({
        username: username,
        date: {
            $gt: dayBeginning,
            $lt: dayEnd
        }
    })
        // .where('date').gt(dayBeginning).lt(dayEnd)
        .then((tasks) => {
            return tasks
        })
        .catch(() => {
            console.log({
                'msg': 'Sorry! Something went wrong.'
            });
        });
}

function importTasksDbSpecifiedDay(username, date) {
    const day = new Date(date);
    const dayBeginning = new Date(day.setHours(0, 0, 0, 0));
    const dayEnd = new Date(dayBeginning.getTime() + 60 * 60 * 24 * 1000);
    return Task.find({
        username: username,
        date: {
            $gt: dayBeginning,
            $lt: dayEnd
        }
    })
        // .where('date').gt(dayBeginning).lt(dayEnd)
        .then((tasks) => {
            return tasks
        })
        .catch(() => {
            console.log({
                'msg': 'Sorry! Something went wrong.'
            });
        });
}



const userlist = new Set();
const tasklist = {};
let timer;
let acceptTimer;

io.on('connection', function (socket) {
    console.log('a user connected');
    socket.on('disconnect', function () {
        console.log('user disconnected');
    });


    socket.on('logged', function (user) {

        if (user !== 'admin') {
            if (!tasklist[user]) tasklist[user] = [];
            console.log('someone connected', user);
            socket.join(`/${user}-room`);
            userlist.add(user);
            io.emit('userlist', {
                userlist: Array.from(userlist)
            });
            importTasksDb(user).then((tasks) => {
                io.to(`/${user}-room`).emit('usertasks-for-user', tasks);
            });

        } else {
            console.log('ADMIN JOINED');
            socket.join(`/${user}-room`);
            io.emit('userlist', {
                userlist: Array.from(userlist)
            });
        }

    });


    socket.on('newtask', function (task) {
        console.log('newtask');
        task['status'] = 'new';
        task['timetoaccept'] = 120;
        task['timeleft'] = 240;


        // tasklist[task.username].push(task);

        createTaskDb(task).then(() => {
            importTasksDb(task.username).then((tasks) => {
                io.to(`/admin-room`).emit('usertasks', tasks);
                io.to(`/${task.username}-room`).emit('taskreceived', task);

            });
        });
        acceptTimer = setInterval(() => {
            if (task['timetoaccept'] === 0 && task['status'] !== 'cancelled' && task['status'] !== 'done') {
                task['status'] = 'overdue';
                updateTaskDb(task).then(() => {
                    importTasksDb(task.username).then((tasks) => {
                        io.to(`/${task.username}-room`).emit('overdue', tasks);
                        io.to(`/admin-room`).emit('overdue', tasks);
                        clearInterval(acceptTimer);
                    });
                });
            } else {

                task['timetoaccept'] -= 5;
                updateTaskDb(task).then(() => {
                    importTasksDb(task.username).then((tasks) => {
                        io.to(`/${task.username}-room`).emit('countdown', tasks);
                        io.to(`/admin-room`).emit('countdown', tasks);
                    });
                });
            }
        }, 5000);

    });

    socket.on('gettasks', function (user) { //this is only emitted by admin so I can use socket.emit
        importTasksDb(user).then((tasks) => {
            console.log("Sending tasks to admin", tasks, user);
            //io.to(`/admin-room`).emit('usertasks', tasks);
            socket.emit('usertasks', tasks);
        });
    });

    socket.on('accept', function (task) {
        task['status'] = 'pending';
        //switchTask(task.username, task);
        updateTaskDb(task).then(() => {
            importTasksDb(task.username).then((tasks) => {
                io.to(`/${task.username}-room`).emit('countdown', tasks);
                io.to(`/admin-room`).emit('countdown', tasks);
                clearInterval(acceptTimer);
            });
        });

        timer = setInterval(() => {
            console.log(task);
            if (task['timeleft'] === 0 && task['status'] !== 'cancelled' && task['status'] !== 'done') {
                task['status'] = 'timeup';
                //task['timeleft'] = 0;
                //switchTask(task.username, task);
                updateTaskDb(task).then(() => {
                    importTasksDb(task.username).then((tasks) => {
                        io.to(`/admin-room`).emit('timeup', tasks);
                        io.to(`/${task.username}-room`).emit('timeup', tasks);
                        clearInterval(timer);
                    });
                });

            } else if (task['status'] !== 'timeup') {
                task['timeleft'] -= 5;
                updateTaskDb(task).then(() => {
                    importTasksDb(task.username).then((tasks) => {
                        io.to(`/${task.username}-room`).emit('countdown', tasks);
                        io.to(`/admin-room`).emit('countdown', tasks);
                    });
                });

            }
        }, 5000);

    });


    socket.on('finish', function (task) {
        task['timeleft'] = 0;
        task['status'] = 'done';
        //switchTask(task.username, task);
        updateTaskDb(task).then(() => {
            importTasksDb(task.username).then((tasks) => {
                io.to(`/admin-room`).emit('userfinished', tasks);
                io.to(`/${task.username}-room`).emit('userfinished', tasks);
                clearInterval(timer);
            });
        });




    });



    socket.on('cancel', function (task) {
        console.log('cancel', task);
        task['status'] = 'cancelled';
        //switchTask(task.username, task);
        updateTaskDb(task).then(() => {
            importTasksDb(task.username).then((tasks) => {
                io.to(`/admin-room`).emit('cancelled', tasks);
                io.to(`/${task.username}-room`).emit('cancelled', tasks);
                clearInterval(timer);
                clearInterval(acceptTimer);
            });
        });

    });

    socket.on('logout', function (user) {
        userlist.delete(user);
        //  console.log(userlist);
        console.log('logout', user)
        io.emit('userlist', {
            userlist: Array.from(userlist)
        });
        io.to(`/admin-room`).emit('userlogout', { username: user });
        //socket.disconnect();

    });


    socket.on('newuser', function (user) {
        io.emit('userlist', {
            userlist: Array.from(userlist)
        });

    });

    /* socket.on('ticketordered', function(ticket) {
         console.log('message: ' + ticket);
         io.emit('seatstakennow', { showing: ticket.showing, seats: ticket.seats });
     });*/
});



var port = process.env.PORT || 8080,
    ip = process.env.IP || '0.0.0.0';

http.listen(port, ip);
console.log('Server running on http://%s:%s', ip, port);

module.exports = app;