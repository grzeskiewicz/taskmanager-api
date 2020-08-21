import {app,io,userlist} from 'server';
require('./database/User');
require('./database/Task');
const Task = mongoose.model('Task');

const {
    body,
    validationResult
} = require('express-validator/check');

var bodyParser = require('body-parser');
const path = require('path');

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
                if (!user) {
                    res.json({ success: false, msg: 'No such user!' });
                    return;
                };
                // test a matching password
                user.comparePassword(data.password, function (err, isMatch) {
                    if (err) {
                        res.json({ success: false, msg: 'Wrong password!' })
                    }
                    if (isMatch) {
                        res.json({
                            success: true,
                            msg: 'Credentials are ok',
                            token: 'JWT ' + jwt.sign({
                                username: user.username,
                                id: user._id,
                                role: user.role
                            }, 'RESTFULAPIs')
                        });
                    } else {
                        res.json({ success: false, msg: 'Wrong password!' })
                        return;
                    }
                });
            });

        } else {
            res.send('Chuj!');
        }
    }
);


app.get('/memberinfo', (req, res) => {
    if (req.headers && req.headers.authorization && req.headers.authorization.split(' ')[0] === 'JWT') {
        jwt.verify(req.headers.authorization.split(' ')[1], 'RESTFULAPIs', function (err, decode) {
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
            const dayBeginning = new Date(day.setHours(0, 0, 0, 0));
            const dayEnd = new Date(dayBeginning.getTime() + 60 * 60 * 24 * 1000);
            Task.find({
                date: {
                    $gt: dayBeginning,
                    $lt: dayEnd
                }
            })
                .then((tasks) => {
                    res.json({ tasks: tasks });
                })
                .catch(() => {
                    console.log({
                        'msg': 'Sorry! Something went wrong.'
                    });
                });
        } else {
            res.send('Chuj!');
        }
    }
);




app.post('/gettasksmonth',
    (req, res) => {
        const errors = validationResult(req);
        if (errors.isEmpty()) {
            const year = req.body.year;
            const month = req.body.month;
            const firstDayBeginning = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);

            //  const dayBeginning = new Date(day.setHours(0, 0, 0, 0));
            const lastDayEnd = new Date(lastDay.getTime() + 60 * 60 * 24 * 1000);

            Task.find({
                date: {
                    $gt: firstDayBeginning,
                    $lt: lastDayEnd
                }
            })
                .then((tasks) => {
                    res.json({ tasks: tasks });
                })
                .catch(() => {
                    console.log({
                        'msg': 'Sorry! Something went wrong.'
                    });
                });
        } else {
            res.send('Chuj!');
        }
    }
);