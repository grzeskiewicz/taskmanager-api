require("dotenv").config();
require("./database/User");
require("./database/Task");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");


const express = require("express"),
  app = express();
const cors = require("cors");
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const http = require("http");
const server = http.createServer(app);
const socketIo = require("socket.io");

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const { body, validationResult } = require("express-validator/check");
const path = require("path");

const User = mongoose.model("User");
const Task = mongoose.model("Task");
const auth = require("http-auth");

const basic = auth.basic({
  file: path.join(__dirname, "users.htpasswd"),
});

mongoose.connect(process.env.DATABASE);
mongoose.Promise = global.Promise;
mongoose.connection
  .on("connected", () => {
    console.log(`Mongoose connection open on ${process.env.DATABASE}`);
  })
  .on("error", (err) => {
    console.log(`Connection error: ${err.message}`);
  });

app.options("*", cors()); // include before other routes

app.get("/", function (req, res) {
  let date = new Date();
  res.send(date);
});

app.post(
  "/createuser",
  [
    body("username")
      .isLength({
        min: 1,
      })
      .withMessage("Please put content"),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      const data = req.body;
      const date = new Date();
      const user = new User({
        username: data.username,
        name:data.name,
        surname: data.surname,
        password: data.password,
        date: date,
        role: data.role,
      });
      user.save().then(() => {
          io.to(`/admin-room`).emit("userlist", {
            userlist: Array.from(userlist),
          });
          res.json({
            success: true,
            msg: "Saved",
          });
        })
        .catch((err) => {
          res.json({
            success: false,
            msg: "Sorry! Something went wrong.",
          });
        });
    } else {
      res.send("Chuj!");
    }
  }
);

app.post("/resetpassword", (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    const user = req.body;
    console.log(user);
    User.findOne(
      {
        username: user.username,
      },
      function (err, userRecord) {
        if (err) throw err;
        if (userRecord) {
          userRecord.set({
            password: user.password,
          });
          userRecord
            .save()
            .then(() => {
              // console.log('Updated password');
              res.json({
                success: true,
                msg: "Password changed nicely",
              });
            })
            .catch((err) => {
              console.log(err);
            });
        } else {
          //res.json({ success: false, msg: "No such user registered" });
        }
      }
    );
  } else {
    res.send("Chuj!");
  }
});

app.post("/deleteuser", (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    const user = req.body;
    User.findOneAndDelete(
      {
        username: user.user,
      },
      function (err) {
        if (err) {
          throw err;
        } else {
          userlist.delete(user);
          io.to(`/admin-room`).emit("userlist", {
            userlist: Array.from(userlist),
          });
          res.json({
            success: true,
            msg: "User deleted!",
          });
        }
      }
    );
  } else {
    res.send("Chuj!");
  }
});

app.get("/getusers", (req, res) => {
  User.find()
    .then((users) => {
      const usernames = [];
      for (const user of users)
        if (user.username !== "admin") usernames.push(user.username);
      res.json(usernames);
    })
    .catch(() => {
      res.json({
        msg: "Sorry! Something went wrong.",
      });
    });
});

app.post(
  "/authuser",
  [
    body("username")
      .isLength({
        min: 1,
      })
      .withMessage("Please put content"),
    body("password")
      .isLength({
        min: 1,
      })
      .withMessage("Please put content"),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      const data = req.body;
      // console.log(data);
      User.findOne(
        {
          username: data.username,
        },
        function (err, user) {
          if (!user) {
            res.json({ success: false, msg: "No such user!" });
            return;
          }
          // test a matching password
          user.comparePassword(data.password, function (err, isMatch) {
            if (err) {
              res.json({ success: false, msg: "Wrong password!" });
            }
            if (isMatch) {
              res.json({
                success: true,
                msg: "Credentials are ok",
                token:
                  "JWT " +
                  jwt.sign(
                    {
                      username: user.username,
                      id: user._id,
                      role: user.role,
                    },
                    "RESTFULAPIs"
                  ),
              });
            } else {
              res.json({ success: false, msg: "Wrong password!" });
              return;
            }
          });
        }
      );
    } else {
      res.json({ success: false, msg: "Unknown error!" });
    }
  }
);

app.get("/memberinfo", (req, res) => {
  //console.log(req.headers);
  if (
    req.headers &&
    req.headers.authorization &&
    req.headers.authorization.split(" ")[0] === "JWT"
  ) {
    jwt.verify(
      req.headers.authorization.split(" ")[1],
      "RESTFULAPIs",
      function (err, decode) {
        if (err) req.user = undefined;
        if (decode === undefined) {
          res.json({
            success: false,
            msg: "No token",
          });
        }

        User.findOne(
          {
            username: decode.username,
          },
          function (err, user) {
            if (err) throw err;
            if (user) {
              res.json({
                success: true,
                msg: decode.username,
                role: decode.role,
              });
            } else {
              res.json({
                success: false,
                msg: "No such user registered",
              });
            }
          }
        );
        req.user = decode; //?
      }
    );
  } else {
    res.json({
      success: false,
      msg: "Token not provided",
    });
    req.user = undefined;
  }
});

app.post("/gettasksday", (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    const selectedDay = req.body.date;
    const day = new Date(selectedDay);
    const dayBeginning = new Date(day.setHours(0, 0, 0, 0));
    const dayEnd = new Date(dayBeginning.getTime() + 60 * 60 * 24 * 1000);
    Task.find({
      date: {
        $gt: dayBeginning,
        $lt: dayEnd,
      },
    })
      .then((tasks) => {
        res.json({ tasks: tasks });
      })
      .catch(() => {
        console.log({
          msg: "Sorry! Something went wrong.",
        });
      });
  } else {
    res.json({ errors: errors });
  }
});

app.post("/gettasksmonth", (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    //  const selectedDay = req.body.date;
    //  const day = new Date(Date.parse(selectedDay));
    const year = req.body.year;
    const month = req.body.month;
    const firstDayBeginning = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    //  const dayBeginning = new Date(day.setHours(0, 0, 0, 0));
    const lastDayEnd = new Date(lastDay.getTime() + 60 * 60 * 24 * 1000);

    Task.find({
      date: {
        $gt: firstDayBeginning,
        $lt: lastDayEnd,
      },
    })
      .then((tasks) => {
        res.json({ tasks: tasks });
      })
      .catch(() => {
        console.log({
          msg: "Sorry! Something went wrong.",
        });
      });
  } else {
    res.json({ errors: errors });
  }
});

//==========================================================================================================================



const userlist = new Set();
const taskList = [];

function prepareTasks() {
  const tasks = taskList.map((task) => task.task);
  return tasks;
}

function createTaskDb(task) {
  const taskDb = new Task({
    username: task.username,
    room: task.room,
    content: task.content,
    status: task.status,
    timetoaccept: task.timetoaccept,
    timeleft: task.timeleft,
    date: task.date,
  });
  return taskDb.save().catch((err) => {
    console.log(err);
  });
}

async function updateTaskDb(task) {
  const q = await Task.findOneAndUpdate(
    {
      username: task.username,
      room: task.room,
      content: task.content,
      date: task.date,
    },
    {
      status: task.status,
      timetoaccept: task.timetoaccept,
      timeleft: task.timeleft,
    }
  );

  /*
    await q.clone();
   // const k = await q.clone();
    if (q) {
        console.log(q);
        //const k = await q.clone();
        if (k) {
            k.set({
                status: task.status,
                timetoaccept: task.timetoaccept,
                timeleft: task.timeleft
            });
            return q.save();
        }
    }

    
    , function (err, taskDb) {
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

    });*/
}
checkPendingTasksOnStart();

function checkPendingTasksOnStart() {
  //import pending tasks
  //loop over -> findtask(id)
  //start over ? continue ?

  importTasksDbStatus("pending").then((tasks) => {
    for (const task of tasks) {
      if (taskList.length === 0 || taskList === undefined) {
        const task1 = new TaskObj(task);
        console.log(task1);
        taskList.push(task1);
        task1.startTimer();

      }
    }
  });
}

function importTasksDbStatus(status) {
  const day = new Date();
  const dayBeginning = new Date(day.setHours(0, 0, 0, 0));
  const dayEnd = new Date(dayBeginning.getTime() + 60 * 60 * 24 * 1000);
  return Task.find({
    status: status,
    date: {
      $gt: dayBeginning,
      $lt: dayEnd,
    },
  })
    .then((tasks) => tasks)
    .catch(() => {
      console.log({
        msg: "Sorry! Something went wrong.",
      });
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
      $lt: dayEnd,
    },
  })
    .then((tasks) => tasks)
    .catch(() => {
      console.log({
        msg: "Sorry! Something went wrong.",
      });
    });
}

function importTasksByID(id) {
  return Task.findOne({
    _id: id,
  })
    .then((task) => task)
    .catch(() => {
      console.log({
        msg: "Sorry! Something went wrong.",
      });
    });
}

async function findTask(id) {
  //securing in case of losing connection - tasklist empties after reset
  if (taskList.length === 0 || taskList === undefined) {
    console.log("XD");
    const task1 = new TaskObj(await importTasksByID(id));
    taskList.push(task1);
    return task1;
    // return new TaskObj(await importTasksByID(id));
  } else {
    return taskList.find((element) => String(element.task._id) == String(id));
  }
}
/*
function findTask(id){
        return taskList.find(element => String(element.task._id) == String(id));
}*/

function TaskObj(task) {
  this.task = task;

  this.timer;
  this.acceptTimer;

  this.startAcceptTimer = function () {
    this.acceptTimer = setInterval(
      () => this.acceptTimerCountdown(this.task),
      5000
    );
  };

  this.stopAcceptTimer = function () {
    clearInterval(this.acceptTimer);
    this.acceptTimer = null;
  };

  this.startTimer = function () {
    this.timer = setInterval(() => this.timerCountdown(this.task), 5000);
  };

  this.stopTimer = function () {
    clearInterval(this.timer);
    this.timer = null;
  };

  this.acceptTimerCountdown = function () {
    if (this.task["timetoaccept"] === 0 && this.task["status"] === "new") {
      this.task["status"] = "overdue";
      this.stopAcceptTimer();
      updateTaskDb(this.task).then(() => {
        importTasksDb(this.task.username).then((tasks) => {
          io.to(`/${this.task.username}-room`).emit("overdue", tasks);
          io.to(`/admin-room`).emit("overdue", tasks);
        });
      });
    } else if (this.task["timetoaccept"] > 0 && this.task["status"] === "new") {
      this.task["timetoaccept"] -= 5;
      updateTaskDb(this.task).then(() => {
        importTasksDb(this.task.username).then((tasks) => {
          io.to(`/${this.task.username}-room`).emit("countdown", tasks);
          io.to(`/admin-room`).emit("countdown", tasks);
        });
      });
    } else {
      console.log("Error acceptTimer");
    }
  };

  this.timerCountdown = function () {
    console.log(this.task);
    if (this.task["timeleft"] === 0 && this.task["status"] === "pending") {
      // ? status timeup?
      this.task["status"] = "timeup";
      updateTaskDb(this.task).then(() => {
        importTasksDb(this.task.username).then((tasks) => {
          io.to(`/admin-room`).emit("timeup", tasks);
          io.to(`/${this.task.username}-room`).emit("timeup", tasks);
          this.stopTimer();
        });
      });
    } else if (this.task["timeleft"] > 0 && this.task["status"] === "pending") {
      this.task["timeleft"] -= 5;
      updateTaskDb(this.task).then(() => {
        importTasksDb(this.task.username).then((tasks) => {
          io.to(`/${this.task.username}-room`).emit("countdown", tasks);
          io.to(`/admin-room`).emit("countdown", tasks);
        });
      });
    } else {
      console.log("Error timerCountdown");
    }
  };
}

io.on("connection", function (socket) {
  console.log("a user connected");
  socket.on("disconnect", function () {
    console.log("user disconnected");
  });

  socket.on("logged", function (user) {
    console.log(user);
    if (user !== "admin") {
      console.log("someone connected", user);
      socket.join(`/${user}-room`);
      userlist.add(user);
      io.emit("userlist", {
        userlist: Array.from(userlist),
      });
      importTasksDb(user).then((tasks) => {
        io.to(`/${user}-room`).emit("usertasks-for-user", tasks);
      });
    } else {
      console.log("ADMIN JOINED");
      socket.join(`/${user}-room`);
      io.emit("userlist", {
        userlist: Array.from(userlist),
      });
    }
  });

  socket.on("newtask", function (task) {
    task["status"] = "new";
    task["timetoaccept"] = 120;
    task["timeleft"] = 240;
    task["date"] = new Date();

    createTaskDb(task).then((taskDb) => {
      const task1 = new TaskObj(taskDb);
      taskList.push(task1);
      task1.startAcceptTimer();
      //prepareTasks(); // ??????
      importTasksDb(task.username).then((tasks) => {
        io.to(`/admin-room`).emit("usertasks", tasks);
        io.to(`/${task.username}-room`).emit("taskreceived", taskDb);
      });
    });
  });

  socket.on("gettasks", function (user) {
    //this is only emitted by admin so I can use socket.emit
    importTasksDb(user).then((tasks) => {
      //io.to(`/admin-room`).emit('usertasks', tasks);
      socket.emit("usertasks", tasks);
    });
  });

  socket.on("accept", async function (task) {
    try {
      let foundTask = await findTask(task._id);
      foundTask.task.status = "pending";
      updateTaskDb(foundTask.task).then(() => {
        importTasksDb(task.username).then((tasks) => {
          io.to(`/${task.username}-room`).emit("countdown", tasks);
          io.to(`/admin-room`).emit("countdown", tasks);
          foundTask.stopAcceptTimer();
          foundTask.startTimer();
        });
      });
    } catch (err) {
      console.log(err);
    }
  });

  socket.on("finish", async function (task) {
    try {
      let foundTask = await findTask(task._id);
      console.log(foundTask);
      foundTask.task.status = "done";
      updateTaskDb(foundTask.task).then(() => {
        importTasksDb(task.username).then((tasks) => {
          io.to(`/admin-room`).emit("userfinished", tasks);
          io.to(`/${task.username}-room`).emit("userfinished", tasks);
          foundTask.stopTimer();
        });
      });
    } catch (err) {
      console.log(err);
    }
  });

  socket.on("cancel", async function (task) {
    let foundTask = await findTask(task._id);
    foundTask.task.status = "cancelled";
    updateTaskDb(foundTask.task).then(() => {
      importTasksDb(task.username).then((tasks) => {
        io.to(`/admin-room`).emit("cancelled", tasks);
        io.to(`/${task.username}-room`).emit("cancelled", tasks);
        foundTask.stopTimer();
      });
    });
  });

  socket.on("reset", async function (task) {
    console.log(task);
    try {
      let foundTask = await findTask(task._id);
      console.log(foundTask);
      foundTask.task.status = "pending";
      foundTask.task.timetoaccept = 60;
      foundTask.task.timeleft = 240;
      updateTaskDb(foundTask.task).then(() => {
        importTasksDb(task.username).then((tasks) => {
          io.to(`/admin-room`).emit("reset", tasks);
          io.to(`/${task.username}-room`).emit("reset", tasks);
          foundTask.startTimer();
        });
      });
    } catch (err) {
      console.log(err);
    }
    /*
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
        }*/
  });

  socket.on("logout", function (user) {
    userlist.delete(user);
    console.log("logout", user);
    io.emit("userlist", {
      userlist: Array.from(userlist),
    });
    io.to(`/admin-room`).emit("userlogout", { username: user });
    //socket.disconnect();
  });

  socket.on("newuser", function (user) {
    io.emit("userlist", {
      userlist: Array.from(userlist),
    });
  });

  /* socket.on('ticketordered', function(ticket) {
         console.log('message: ' + ticket);
         io.emit('seatstakennow', { showing: ticket.showing, seats: ticket.seats });
     });*/
});

const port = process.env.PORT || 3001,
  ip = "127.0.0.1" || "0.0.0.0";

server.listen(port, ip);
console.log("Server running on http://%s:%s", ip, port);

module.exports = app;
