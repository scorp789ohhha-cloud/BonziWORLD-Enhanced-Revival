const log = require('./log.js').log;
const fs = require('fs-extra');
const settings = require(__dirname + "/json/settings.json");
const io = require('./server.js').io;
const sanitize = require('sanitize-html');

let bans;
let mutes;
let logins;
let accounts;
let rooms;
var rooms_table = [];
let reports;

process.on("uncaughtException", function(err) {
  console.log(err.stack);
});

function replace_crap(string) {
return string
    .replaceAll("@", "%")
    .replaceAll("`", "\u200B ")
    .replaceAll(" ", "\u200B ")
    .replaceAll("http://", "hgrunt/ass.wav ")
    .replaceAll("https://", "hgrunt/ass.wav ")
    .replaceAll("discord.gg/", "hgrunt/ass.wav ")
    .replaceAll("discord.com/", "hgrunt/ass.wav ")
    .replaceAll("bonzi.lol", "bwe ")
    .replaceAll("bonzi.ga", "bwe ")
    .replaceAll("*", " ")
    .replaceAll("|", " ")
    .replaceAll("~", " ");
}

exports.rooms = rooms;
exports.rooms_table = rooms_table;

exports.init = function() {
    fs.writeFile(__dirname + "/json/bans.json", "{}", { flag: 'wx' }, function(err) {
        if (!err) console.log("Created empty bans list.");
        bans = require(__dirname + "/json/bans.json");
    });

    fs.writeFile(__dirname + "/json/accounts.json", "{}", { flag: 'wx' }, function(err) {
        if (!err) console.log("Created empty accounts list.");
        accounts = require(__dirname + "/json/accounts.json");
    });

    fs.writeFile(__dirname + "/json/mutes.json", "{}", { flag: 'wx' }, function(err) {
        if (!err) console.log("Created empty mutes list.");
        mutes = require(__dirname + "/json/mutes.json");
    });

    fs.writeFile(__dirname + "/json/logins.json", "{}", { flag: 'wx' }, function(err) {
        if (!err) console.log("Created empty logins list.");
        logins = require(__dirname + "/json/logins.json");
    });

    fs.writeFile(__dirname + "/json/reports.json", "{}", { flag: 'wx' }, function(err) {
        if (!err) console.log("Created empty reports list.");
        reports = require(__dirname + "/json/reports.json");
    });
};

exports.bonziAccounts = require(__dirname + "/json/accounts.json");

exports.saveBans = function() {
	fs.writeFile(__dirname + "/json/bans.json", JSON.stringify(bans), { flag: 'w' }, function(error) {
		log.info.log('info', 'banSave', { error: error });
	});
};

exports.saveAccounts = function() {
	fs.writeFile(__dirname + "/json/accounts.json", JSON.stringify(accounts), { flag: 'w' }, function(error) {
		log.info.log('info', 'accountSave', { error: error });
	});
};

exports.saveLogins = function() {
	fs.writeFile(__dirname + "/json/logins.json", JSON.stringify(logins));
};

exports.saveReport = function() {
	fs.writeFile(__dirname + "/json/reports.json", JSON.stringify(reports));
};

exports.saveMutes = function() {
	fs.writeFile(__dirname + "/json/mutes.json", JSON.stringify(mutes), { flag: 'w' }, function(error) {
		log.info.log('info', 'banSave', { error: error });
	});
};

exports.addBan = function(ip, length, reason) {
	length = parseFloat(length) || settings.banLength;
	reason = reason || "N/A";
	bans[ip] = {
		name: reason,
		end: new Date().getTime() + (length * 60000)
	};

	var sockets = io.sockets.sockets;
	var socketList = Object.keys(sockets);

	for (var i = 0; i < socketList.length; i++) {
		var socket = sockets[socketList[i]];
		if (socket.handshake.headers['cf-connecting-ip'] == ip)
			exports.handleBan(socket);
	}
	exports.saveBans();
};

exports.addAccount = function(ip, bwnzjName, guid) {
	accounts[ip] = {
		name: sanitize(bwnzjName),
		bonziId: sanitize(guid)
	};
	exports.saveAccounts();
};

exports.removeBan = function(ip) {
	delete bans[ip];
	exports.saveBans();
};

exports.removeMute = function(ip) {
	delete mutes[ip];
	exports.saveMutes();
};

exports.removeLogin = function(ip) {
	delete logins[ip];
	exports.saveLogins();
};

exports.handleBan = function(socket) {
	var ip = socket.handshake.headers['cf-connecting-ip'] || socket.request.connection.remoteAddress;

	if (bans[ip].end <= new Date().getTime()) {
		exports.removeBan(ip);
		return false;
	}

	log.access.log('info', 'ban', { ip: ip });

	socket.emit('ban', {
		reason: bans[ip].reason,
		end: bans[ip].end
	});
	socket.disconnect();
	return true;
};

exports.handleReport = function(name) {
	var ip = name;
	var username = replace_crap(reports[ip].username);
	var reason = replace_crap(reports[ip].reason);
	var reporter = replace_crap(reports[ip].reporter);
	var rid = replace_crap(reports[ip].rid);

	const message = "!!REPORT!!\n\nWho: " + username + "\nReason: " + reason + "\nReport by: " + reporter + "\nRoom ID: " + rid;
	console.log(message);
	return true;
};

exports.handleMute = function(socket) {
	var ip = socket.request.connection.remoteAddress;

	if (mutes[ip].end <= new Date().getTime()) {
		exports.removeMute(ip);
		return false;
	}

	log.access.log('info', 'mute', { ip: ip });

	socket.emit('mute', {
		reason: mutes[ip].reason + " <button onclick='hidemute()'>Close</button>",
		end: mutes[ip].end
	});
	return true;
};

exports.kick = function(ip, reason) {
	var sockets = io.sockets.sockets;
	var socketList = Object.keys(sockets);

	for (var i = 0; i < socketList.length; i++) {
		var socket = sockets[socketList[i]];
		if (socket.request.connection.remoteAddress == ip) {
			socket.emit('kick', { reason: reason || "N/A" });
			socket.disconnect();
		}
	}
};

exports.warning = function(ip, reason) {
	var sockets = io.sockets.sockets;
	var socketList = Object.keys(sockets);

	for (var i = 0; i < socketList.length; i++) {
		var socket = sockets[socketList[i]];
		if (socket.request.connection.remoteAddress == ip) {
			socket.emit('warning', {
				reason: (reason || "N/A") + " <button onclick='hidewarning()'>Close</button>"
			});
		}
	}
};

exports.mute = function(ip, length, reason) {
	var sockets = io.sockets.sockets;
	var socketList = Object.keys(sockets);

	length = parseFloat(length) || settings.banLength;

	mutes[ip] = {
		reason: reason,
		end: new Date().getTime() + (length * 600)
	};

	for (var i = 0; i < socketList.length; i++) {
		var socket = sockets[socketList[i]];
		if (socket.request.connection.remoteAddress == ip) {
			exports.handleMute(socket);
		}
	}

	exports.saveMutes();
};

exports.addReport = function(name, username, reason, reporter, rid) {
	reports[name] = {
		username: username || "missingno",
		reporter: reporter || "unknown",
		rid: rid || "unknown",
		reason: reason || "N/A"
	};

	exports.handleReport(name);
	exports.saveReport();
};

exports.login = function(ip, reason) {
	var sockets = io.sockets.sockets;
	var socketList = Object.keys(sockets);

	logins[ip] = { reason: reason };

	for (var i = 0; i < socketList.length; i++) {
		var socket = sockets[socketList[i]];
		if (socket.request.connection.remoteAddress == ip) {
			socket.emit('achieve', { reason: reason });
			exports.handleLogin(socket);
		}
	}

	exports.saveLogins();
};

exports.handleLogin = function(socket) {
	var ip = socket.request.connection.remoteAddress;
	log.access.log('info', 'loginadded', { ip: ip });
	return true;
};

exports.isBanned = function(ip) {
    return Object.keys(bans).indexOf(ip) != -1;
};

exports.hasAnAccount = function(ip) {
    return true;
};

exports.isIn = function(ip) {
    return Object.keys(logins).indexOf(ip) != -1;
};

exports.isMuted = function(ip) {
    return Object.keys(mutes).indexOf(ip) != -1;
};
