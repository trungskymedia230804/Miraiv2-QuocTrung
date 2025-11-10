const fs = require("fs");
module.exports.config = {
name: "buồn",
	version: "1.0.1",
	hasPermssion: 0,
	credits: "VanHung",
	description: "buồnvaicalon",
	commandCategory: "Không cần dấu lệnh",
	usages: "ko cần prefix chỉ cần chat buồn",
	cooldowns: 5,
};
module.exports.handleEvent = function({ api, event, client, __GLOBAL }) {
	var { threadID, messageID } = event;
	if (event.body.indexOf("buồn")==0 ||event.body.indexOf("bùn")==0 || event.body.indexOf("Bùn")==0 ||(event.body.indexOf("Buồn")==0)) {
		var msg = {
				body: "hoi đừng bun nhoaa ❤",
				attachment: fs.createReadStream(__dirname + `/noprefix/buồn.mp4`)
			}
			api.sendMessage(msg, threadID, messageID);
		}
	}
	module.exports.run = function({ api, event, client, __GLOBAL }) {

}

