const log = require("./log.js").log;
const Ban = require("./ban.js");
const Utils = require("./utils.js");
const io = require('./server.js').io;
const settings = require(__dirname + "/json/settings.json");
const sanitize = require("sanitize-html");
const sleep = require("util").promisify(setTimeout);
const axios = require('axios').default;
const fs = require('fs');

const isReplit = settings.isReplit;

if (isReplit === true) {
	var port = 80;
} else {
	var port = process.env.port || settings.port;
}

process.on("uncaughtException", (err) => {
    console.error("Uncaught:", err.stack);
});

function sanitizeHTML(string){
return string
    .replaceAll("&",  "&amp;")
    .replaceAll("#",  "&num;")
    .replaceAll("\"", "&quot;");
}

function sanitizeHTML2(string){
return string
    .replaceAll("&",  "&amp;")
    .replaceAll("#",  "&num;")
    .replaceAll("'",  "&apos;")
    .replaceAll("\"", "&quot;");
}

var onCooldown = false;
var onloginCooldown = false;
var registerCool = false;
var registerCooldwn;
let roomsPublic = [];
let rooms = {};
let usersAll = [];
let sockets = [];
var ips = [];
var noflood = [];
let mutes = Ban.mutes;

var Filter = require('bad-words'),
    filter = new Filter();

function getTimeLeft(timeout) {
    return Math.ceil((timeout._idleStart + timeout._idleTimeout - Date.now()) / 1000);
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min);
}

exports.beat = function () {
    io.on("connection", function (socket) {
        if(socket.handshake.query.version == settings.version && socket.handshake.query.channel == settings.channel) {
            new User(socket);
        } else {
            io.use((socket, next) => {
                next(new Error('authentication_failed'));
                setTimeout(() => { socket.disconnect(true); }, 3000);
            });
        }
    });
};

class User {
    constructor(socket) {
        this.guid = Utils.guidGen();
        this.socket = socket;

        if (Ban.isBanned(this.getIp())) {
            Ban.handleBan(this.socket);
        }

        this.private = {
            login: false,
            sanitize: true,
            runlevel: 0
        };

        this.public = {
            color: settings.bonziColors[Math.floor(
                Math.random() * settings.bonziColors.length
            )]
        };

        log.access.log('info', 'connect', {
            guid: this.guid,
            ip: this.getIp()
        });

        if (this.getIp() == "::1" || this.getIp() == "::ffff:127.0.0.1") {
            this.private.runlevel = 3;
            this.socket.emit("admin");
            this.private.sanitize = false;
        }

        this.socket.on('login', this.login.bind(this));
    }

    getIp() {
        return this.socket.request.connection.remoteAddress;
    }

    login(data) {
        if (typeof data != 'object') return;
        if (this.private.login) return;

        let rid = data.room || Utils.guidGen();

        if (!rooms[rid]) {
            rooms[rid] = {
                rid: rid,
                users: [],
                prefs: settings.prefs.public
            };
        }

        this.room = rooms[rid];
        this.room.users.push(this);

        this.private.login = true;

        this.public.name = sanitize(sanitizeHTML(data.name)) || "Anonymous";

        this.socket.emit('updateAll', {
            usersPublic: {}
        });

        this.socket.emit('room', {
            room: rid
        });

        this.socket.on('talk', this.talk.bind(this));
        this.socket.on('disconnect', this.disconnect.bind(this));
    }

    talk(data) {
        if (typeof data != 'object') return;

        let text = this.private.sanitize
            ? sanitize(sanitizeHTML(data.text))
            : sanitizeHTML(data.text);

        console.log("[CHAT]", this.public.name, ":", text);

        this.room.users.forEach(user => {
            user.socket.emit('talk', {
                guid: this.guid,
                text: text
            });
        });
    }

    disconnect() {
        log.access.log('info', 'disconnect', {
            guid: this.guid,
            ip: this.getIp()
        });

        this.room.users = this.room.users.filter(u => u !== this);
    }
}
