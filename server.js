require('dotenv').config();
//require('./database/User');
//require('./database/Task');
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
//const User = mongoose.model('User');
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






//==========================================================================================================================



/*
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
}*/


/*
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
} */

//let timer;

/*
function acceptTimerCountdown(task) {
    if (task['timetoaccept'] === 0 && task['status'] === 'new') { //? status=overdue?
        task['status'] = 'overdue';
        //   clearInterval(this);
        updateTaskDb(task).then(() => {
            importTasksDb(task.username).then((tasks) => {
                io.to(`/${task.username}-room`).emit('overdue', tasks);
                io.to(`/admin-room`).emit('overdue', tasks);
            });
        });
    } else if (task['timetoaccept'] > 0 && task['status'] === 'new') {
        task['timetoaccept'] -= 5;
        updateTaskDb(task).then(() => {
            importTasksDb(task.username).then((tasks) => {
                io.to(`/${task.username}-room`).emit('countdown', tasks);
                io.to(`/admin-room`).emit('countdown', tasks);
            });
        });
    } else {
    }
} */

/*
function timerCountdown(task) {
    console.log("Countdown timer - task", task.room);
    if (task['timeleft'] === 0 && task['status'] === 'pending') { // ? status timeup?
        task['status'] = 'timeup';
        updateTaskDb(task).then(() => {
            importTasksDb(task.username).then((tasks) => {
                io.to(`/admin-room`).emit('timeup', tasks);
                io.to(`/${task.username}-room`).emit('timeup', tasks);
                clearInterval(this);
            });
        });

    } else if (task['timeleft'] > 0 && task['status'] === 'pending') {
        task['timeleft'] -= 5;
        updateTaskDb(task).then(() => {
            importTasksDb(task.username).then((tasks) => {
                io.to(`/${task.username}-room`).emit('countdown', tasks);
                io.to(`/admin-room`).emit('countdown', tasks);
            });
        });

    } else {
        clearInterval(this);
    }
} */



const userlist = new Set();
const taskList = [];



function prepareTasks() {
    const tasks = taskList.map(task => task.task);
    return tasks;
}



function createTaskDb(task) {
    const taskDb = new Task({
        'username': task.username,
        'room': task.room,
        'content': task.content,
        'status': task.status,
        'timetoaccept': task.timetoaccept,
        'timeleft': task.timeleft,
        'date': task.date
    });
    return taskDb.save()
        .catch((err) => {
            console.log(err);
        });
}


function updateTaskDb(task) {
    return Task.findOne({
        username: task.username,
        room: task.room,
        content: task.content,
        date: task.date
    }, function (err, taskDb) {
        if (err) throw err;
        if (taskDb) {
            taskDb.set({
                status: task.status,
                timetoaccept: task.timetoaccept,
                timeleft: task.timeleft
            });
            return taskDb.save();
        } else {
            console.log("Task not found?");
        }

    });
}

function importTasksDb(username) {
    const day = new Date();
    const dayBeginning = new Date(day.setHours(0, 0, 0, 0));
    const dayEnd = new Date(dayBeginning.getTime() + 60 * 60 * 24 * 1000);
    return Task.find({
        username: username,
        date: {
            $gt: dayBeginning,
            $lt: dayEnd
        }
    }).then(tasks => tasks)
        .catch(() => {
            console.log({
                'msg': 'Sorry! Something went wrong.'
            });
        });
}



function importTasksByID(id) {
    return Task.findOne({
        _id: id,
    }).then(task => task)
        .catch(() => {
            console.log({
                'msg': 'Sorry! Something went wrong.'
            });
        });
}

function findTask(id) {
    return taskList.find(element => String(element.task._id) === String(id));
}

function TaskObj(task) {
    this.task = task;

    this.timer;
    this.acceptTimer;


    this.startAcceptTimer = function () {
        this.acceptTimer = setInterval(() => this.acceptTimerCountdown(this.task), 5000);
    }

    this.stopAcceptTimer = function () {
        clearInterval(this.acceptTimer);
        this.acceptTimer = null;
    }


    this.startTimer = function () {
        this.timer = setInterval(() => this.timerCountdown(this.task), 5000);
    }

    this.stopTimer = function () {
        clearInterval(this.timer);
        this.timer = null;
    }


    this.acceptTimerCountdown = function (task) {
        if (task['timetoaccept'] === 0 && task['status'] === 'new') { //? status=overdue?
            task['status'] = 'overdue';
            this.stopAcceptTimer();
            updateTaskDb(task).then(() => {
                importTasksDb(task.username).then((tasks) => {
                    io.to(`/${task.username}-room`).emit('overdue', tasks);
                    io.to(`/admin-room`).emit('overdue', tasks);
                });
            });

        } else if (task['timetoaccept'] > 0 && task['status'] === 'new') {
            task['timetoaccept'] -= 5;
            updateTaskDb(task).then(() => {
                importTasksDb(task.username).then((tasks) => {
                    io.to(`/${task.username}-room`).emit('countdown', tasks);
                    io.to(`/admin-room`).emit('countdown', tasks);
                });
            });
        } else {
        }
    }


    this.timerCountdown = function (task) {
        if (task['timeleft'] === 0 && task['status'] === 'pending') { // ? status timeup?
            task['status'] = 'timeup';
            updateTaskDb(task).then(() => {
                importTasksDb(task.username).then((tasks) => {
                    io.to(`/admin-room`).emit('timeup', tasks);
                    io.to(`/${task.username}-room`).emit('timeup', tasks);
                    this.stopTimer();
                });
            });
        } else if (task['timeleft'] > 0 && task['status'] === 'pending') {
            task['timeleft'] -= 5;
            updateTaskDb(task).then(() => {
                importTasksDb(task.username).then((tasks) => {
                    io.to(`/${task.username}-room`).emit('countdown', tasks);
                    io.to(`/admin-room`).emit('countdown', tasks);
                });
            });
        } else {
        }
    }

}

io.on('connection', function (socket) {
    console.log('a user connected');
    socket.on('disconnect', function () {
        console.log('user disconnected');
    });


    socket.on('logged', function (user) {
        if (user !== 'admin') {
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
        task['status'] = 'new';
        task['timetoaccept'] = 120;
        task['timeleft'] = 240;
        task['date'] = new Date();

        createTaskDb(task).then((taskDb) => {
            const task1 = new TaskObj(taskDb);
            taskList.push(task1);
            task1.startAcceptTimer();
            console.log("Create", task1);
            prepareTasks();
            importTasksDb(task.username).then((tasks) => {
                io.to(`/admin-room`).emit('usertasks', tasks);
                io.to(`/${task.username}-room`).emit('taskreceived', taskDb);
            });
        });
    });

    socket.on('gettasks', function (user) { //this is only emitted by admin so I can use socket.emit
        importTasksDb(user).then((tasks) => {
            //io.to(`/admin-room`).emit('usertasks', tasks);
            socket.emit('usertasks', tasks);
        });
    });

    socket.on('accept', function (task) {
        let foundTask = findTask(task._id);
        if (foundTask === undefined) {
            importTasksByID(task._id).then((taskDb) => { //securing in case of losing connection - tasklist empties after reset
                const task1 = new TaskObj(taskDb);
                taskList.push(task1);
                foundTask = task1;
            });
        }

        if (foundTask !== undefined) {
            foundTask.task.status = 'pending';
            updateTaskDb(foundTask.task).then(() => {
                importTasksDb(task.username).then((tasks) => {
                    io.to(`/${task.username}-room`).emit('countdown', tasks);
                    io.to(`/admin-room`).emit('countdown', tasks);
                    foundTask.stopAcceptTimer();
                    foundTask.startTimer();
                });
            });

        }

    });


    socket.on('finish', function (task) {
        let foundTask = findTask(task._id);
        if (foundTask === undefined) {
            importTasksByID(task._id).then((taskDb) => { //securing in case of losing connection - tasklist empties after reset
                const task1 = new TaskObj(taskDb);
                taskList.push(task1);
                foundTask = task1;
            });
        }

        if (foundTask !== undefined) {
            foundTask.task.status = 'done';
            updateTaskDb(foundTask.task).then(() => {
                importTasksDb(task.username).then((tasks) => {
                    io.to(`/admin-room`).emit('userfinished', tasks);
                    io.to(`/${task.username}-room`).emit('userfinished', tasks);
                    foundTask.stopTimer();
                });
            });
        }
    });



    socket.on('cancel', function (task) {
        let foundTask = findTask(task._id);
        foundTask.task.status = 'cancelled';
        updateTaskDb(foundTask.task).then(() => {
            importTasksDb(task.username).then((tasks) => {
                io.to(`/admin-room`).emit('cancelled', tasks);
                io.to(`/${task.username}-room`).emit('cancelled', tasks);
                foundTask.stopTimer();
            });
        });

    });


    socket.on('reset', function (task) {
        let foundTask = findTask(task._id);

        if (foundTask === undefined) {
            importTasksByID(task._id).then((taskDb) => { //securing in case of losing connection - tasklist empties after reset
                const task1 = new TaskObj(taskDb);
                taskList.push(task1);
                foundTask = task1;
            });
        }

        if (foundTask !== undefined) {
            foundTask.task.status = 'pending';
            foundTask.task.timetoaccept = 60;
            foundTask.task.timeleft = 240;
            updateTaskDb(foundTask.task).then(() => {
                importTasksDb(task.username).then((tasks) => {
                    io.to(`/admin-room`).emit('reset', tasks);
                    io.to(`/${task.username}-room`).emit('reset', tasks);
                    foundTask.startTimer();
                });
            });
        }
    });




    socket.on('logout', function (user) {
        userlist.delete(user);
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

module.exports = {io,app,userlist};
