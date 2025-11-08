module.exports = function({
    api,
    models
}) {
    // Controller and Utility Imports
    const Users = require("../../database/controllers/users.js")({
        models,
        api
    });
    const Threads = require("../../database/controllers/threads")({
        models,
        api
    });
    const Currencies = require("../../database/controllers/currencies")({
        models
    });
    const logger = require("../../utils/log.js");
    const util = require('util');
    const fs = require("fs-extra");
    const path = require("path");
    const moment = require("moment-timezone");
    const axios = require("axios");

    var day = moment.tz("Asia/Ho_Chi_Minh").day();
    const checkttDataPath = process.cwd() + '/modules/commands/tt/';

    // ---------------------------------------------------------------- //
    // ----------- Automatic Daily and Weekly Top Posters ------------- //
    // ---------------------------------------------------------------- //

    setInterval(async () => {
        const day_now = moment.tz("Asia/Ho_Chi_Minh").day();
        if (day != day_now) {
          day = day_now;
          const checkttData = fs.readdirSync(checkttDataPath);
      
          logger('--> CHECKTT: Ngày Mới');
      
          checkttData.forEach(async (checkttFile) => {
            const checktt = JSON.parse(fs.readFileSync(checkttDataPath + checkttFile));
            let storage = [];
            let count = 1;
      
            for (const item of checktt.day) {
              const userName = await Users.getNameUser(item.id) || 'Facebook User';
              const itemToPush = { ...item, name: userName };
              storage.push(itemToPush);
            }
      
            storage.sort((a, b) => {
              if (a.count > b.count) return -1;
              if (a.count < b.count) return 1;
              return a.name.localeCompare(b.name);
            });
      
            const timechecktt = moment.tz('Asia/Ho_Chi_Minh').format('DD/MM/YYYY || HH:mm:ss');
            const haha = `\n────────────────────\n💬 Tổng tin nhắn: ${storage.reduce((a, b) => a + b.count, 0)}\n⏰ Time: ${timechecktt}\n✏️ Các bạn khác cố gắng tương tác nếu muốn lên top nha`;
      
            let checkttBody = '[ TOP TƯƠNG TÁC NGÀY ]\n────────────────────\n📝 Top 15 người tương tác nhiều nhất hôm qua:\n\n';
            checkttBody += storage
              .slice(0, 15)
              .map(item => `${count++}. ${item.name} - 💬 ${item.count} tin nhắn`)
              .join('\n');
      
            api.sendMessage(checkttBody + haha, checkttFile.replace('.json', ''), (err) => err && console.log(err));
      
            checktt.day.forEach(e => (e.count = 0));
            checktt.time = day_now;
      
            fs.writeFileSync(checkttDataPath + checkttFile, JSON.stringify(checktt, null, 4));
          });
      
          if (day_now == 1) {
            logger('--> CHECKTT: Tuần Mới');
      
            checkttData.forEach(async (checkttFile) => {
              const checktt = JSON.parse(fs.readFileSync(checkttDataPath + checkttFile));
              let storage = [];
              let count = 1;
      
              for (const item of checktt.week) {
                const userName = await Users.getNameUser(item.id) || 'Facebook User';
                const itemToPush = { ...item, name: userName };
                storage.push(itemToPush);
              }
      
              storage.sort((a, b) => {
                if (a.count > b.count) return -1;
                if (a.count < b.count) return 1;
                return a.name.localeCompare(b.name);
              });
      
              const tctt = moment.tz('Asia/Ho_Chi_Minh').format('DD/MM/YYYY || HH:mm:ss');
              const dzvcl = `\n────────────────────\n⏰ Time: ${tctt}\n✏️ Các bạn khác cố gắng tương tác nếu muốn lên top nha`;
      
              let checkttBody = '[ TOP TƯƠNG TÁC TUẦN ]\n────────────────────\n📝 Top 15 người tương tác nhiều nhất tuần qua:\n\n';
              checkttBody += storage
                .slice(0, 15)
                .map(item => `${count++}. ${item.name} - 💬 ${item.count} tin nhắn`)
                .join('\n');
      
              api.sendMessage(checkttBody + dzvcl, checkttFile.replace('.json', ''), (err) => err && console.log(err));
      
              checktt.week.forEach(e => (e.count = 0));
              fs.writeFileSync(checkttDataPath + checkttFile, JSON.stringify(checktt, null, 4));
            });
          }
      
          global.client.sending_top = false;
        }
      }, 1000 * 10);      
    // ---------------------------------------------------------------- //
    // -------- Push all variables from database to environment ------- //
    // ---------------------------------------------------------------- //
    (async function() {
        try {
            logger(global.getText("listen", "startLoadEnvironment"), "[ DATABASE ]");
            let threads = await Threads.getAll();
            let users = await Users.getAll(["userID", "name", "data"]);
            let currencies = await Currencies.getAll(["userID"]);

            for (const data of threads) {
                const idThread = String(data.threadID);
                global.data.allThreadID.push(idThread);
                global.data.threadData.set(idThread, data["data"] || {});
                global.data.threadInfo.set(idThread, data.threadInfo || {});

                if (data["data"] && data["data"]["banned"] === !![]) {
                    global.data.threadBanned.set(idThread, {
                        reason: data["data"]["reason"] || "",
                        dateAdded: data["data"]["dateAdded"] || "",
                    });
                }
                if (data["data"] && data["data"]["commandBanned"] && data["data"]["commandBanned"].length !== 0) {
                    global.data.commandBanned.set(idThread, data["data"]["commandBanned"]);
                }
                if (data["data"] && data["data"]["NSFW"]) {
                    global.data.threadAllowNSFW.push(idThread);
                }
            }
            logger.loader(global.getText("listen", "loadedEnvironmentThread"));

            for (const dataU of users) {
                const idUsers = String(dataU["userID"]);
                global.data.allUserID.push(idUsers);
                if (dataU.name && dataU.name.length !== 0) {
                    global.data.userName.set(idUsers, dataU.name);
                }
                if (dataU.data && dataU.data.banned === 1) {
                    global.data.userBanned.set(idUsers, {
                        reason: dataU.data.reason || "",
                        dateAdded: dataU.data.dateAdded || "",
                    });
                }
                if (dataU.data && dataU.data.commandBanned && dataU.data.commandBanned.length !== 0) {
                    global.data.commandBanned.set(idUsers, dataU.data.commandBanned);
                }
            }

            for (const dataC of currencies) {
                global.data.allCurrenciesID.push(String(dataC["userID"]));
            }

            logger.loader(global.getText("listen", "loadedEnvironmentUser"));
            logger(global.getText("listen", "successLoadEnvironment"), "[ DATABASE ]");
        } catch (error) {
            return logger.loader(global.getText("listen", "failLoadEnvironment", error), "error");
        }
    })();

    logger(
        `${api.getCurrentUserID()} - [ ${global.config.PREFIX} ] • ${!global.config.BOTNAME ? "This bot was made by CatalizCS and SpermLord" : global.config.BOTNAME}`,
        "[ BOT INFO ]"
    );

    // ---------------------------------------------------------------- //
    // ----------------- Require all handle modules ------------------- //
    // ---------------------------------------------------------------- //
    const handleCommand = require("../handle/handleCommand")({
        api,
        models,
        Users,
        Threads,
        Currencies
    });
    const handleCommandEvent = require("../handle/handleCommandEvent")({
        api,
        models,
        Users,
        Threads,
        Currencies
    });
    const handleReply = require("../handle/handleReply")({
        api,
        models,
        Users,
        Threads,
        Currencies
    });
    const handleReaction = require("../handle/handleReaction")({
        api,
        models,
        Users,
        Threads,
        Currencies
    });
    const handleEvent = require("../handle/handleEvent")({
        api,
        models,
        Users,
        Threads,
        Currencies
    });
    const handleCreateDatabase = require("../handle/handleCreateDatabase")({
        api,
        Threads,
        Users,
        Currencies,
        models
    });
    const handleRefresh = require("../handle/handleRefresh")({
        api,
        models,
        Users,
        Threads,
        Currencies
    });
    const handleUpload = require("../handle/handleUpload")({
        api
    });

    logger.loader(`====== ${Date.now() - global.client.timeStart}ms ======`);

    // ---------------------------------------------------------------- //
    // ------------- Main Event Listener and Dispatcher --------------- //
    // ---------------------------------------------------------------- //
    return async (event) => {
        const {
            threadID,
            author,
            image,
            type,
            logMessageType,
            logMessageBody,
            logMessageData
        } = event;
        var data_anti = JSON.parse(fs.readFileSync(global.anti, "utf8"));

        // Anti-change Group Image
        if (type == "change_thread_image") {
            const botID = api.getCurrentUserID();
            var threadInf = await api.getThreadInfo(threadID);
            const findAd = threadInf.adminIDs.find((el) => el.id === author);
            const findAnti = data_anti.boximage.find((item) => item.threadID === threadID);

            if (findAnti) {
                if (findAd || botID.includes(author)) {
                    api.sendMessage(`» [ CẬP NHẬT NHÓM ] ${event.snippet}`, event.threadID);
                    var options = {
                        method: "POST",
                        url: "https://api.imgur.com/3/image",
                        headers: {
                            Authorization: "Client-ID fc9369e9aea767c",
                        },
                        data: {
                            image: image.url
                        },
                    };
                    const res = await axios(options);
                    var data = res.data.data;
                    findAnti.url = data.link;
                    return fs.writeFileSync(global.anti, JSON.stringify(data_anti, null, 4));
                } else {
                    const res = await axios.get(findAnti.url, {
                        responseType: "stream"
                    });
                    api.sendMessage(`Bạn không có quyền đổi ảnh nhóm`, threadID);
                    return api.changeGroupImage(res.data, threadID);
                }
            }
        }

        // Anti-change Group Name
        if (logMessageType === "log:thread-name") {
            const botID = api.getCurrentUserID();
            var threadInf = await api.getThreadInfo(threadID);
            const findAd = threadInf.adminIDs.find((el) => el.id === author);
            const findAnti = data_anti.boxname.find((item) => item.threadID === threadID);

            if (findAnti) {
                if (findAd || botID.includes(author)) {
                    api.sendMessage(`» [ CẬP NHẬT NHÓM ] ${logMessageBody}`, event.threadID);
                    findAnti.name = logMessageData.name;
                    return fs.writeFileSync(global.anti, JSON.stringify(data_anti, null, 4));
                } else {
                    api.sendMessage(`Bạn không có quyền đổi tên nhóm`, threadID);
                    return api.setTitle(findAnti.name, threadID);
                }
            }
        }

        // Anti-change User Nickname
        if (logMessageType === "log:user-nickname") {
            const botID = api.getCurrentUserID();
            var threadInf = await api.getThreadInfo(threadID);
            const findAd = threadInf.adminIDs.find((el) => el.id === author);
            const findAnti = data_anti.antiNickname.find((item) => item.threadID === threadID);

            if (findAnti) {
                if (findAd || botID.includes(author)) {
                    api.sendMessage(`» [ CẬP NHẬT NHÓM ] ${logMessageBody}`, event.threadID);
                    findAnti.data[logMessageData.participant_id] = logMessageData.nickname;
                    return fs.writeFileSync(global.anti, JSON.stringify(data_anti, null, 4));
                } else {
                    api.sendMessage(`Bạn không có quyền đổi tên người dùng`, threadID);
                    return api.changeNickname(
                        findAnti.data[logMessageData.participant_id] || "",
                        threadID,
                        logMessageData.participant_id
                    );
                }
            }
        }

        // Anti-out (re-add user if they leave)
        if (logMessageType === "log:unsubscribe") {
            const botID = api.getCurrentUserID();
            var threadInf = await api.getThreadInfo(threadID);
            const findAd = threadInf.adminIDs.find((el) => el.id === author);
            const findAnti = !!data_anti.antiout[threadID];

            if (findAnti) {
                const typeOut = author == logMessageData.leftParticipantFbId ? "out" : "kick";
                if (typeOut == "out") {
                    api.addUserToGroup(logMessageData.leftParticipantFbId, threadID, (error, info) => {
                        if (error) {
                            api.sendMessage(
                                `❎ Thêm người dùng trở lại thất bại!\nhttps://www.facebook.com/profile.php?id=${logMessageData.leftParticipantFbId}\n[ 𝐌𝐎𝐃𝐄 ] → Đang kích hoạt chế độ cấm thoát nhóm!`,
                                threadID
                            );
                        } else {
                            api.sendMessage(
                                `✅ Đã thêm người dùng trở lại thành công!\nhttps://www.facebook.com/profile.php?id=${logMessageData.leftParticipantFbId}\n[ 𝐌𝐎𝐃𝐄 ] → Đang kích hoạt chế độ cấm thoát nhóm!`,
                                threadID
                            );
                        }
                    });
                }
            }
        }

        // Bot Subscription/Rental Check
        let form_mm_dd_yyyy = (input = "", split = input.split("/")) => `${split[1]}/${split[0]}/${split[2]}`;
        let prefix = (global.data.threadData.get(event.threadID) || {}).PREFIX || global.config.PREFIX;

        if ((event.body || "").startsWith(prefix) && event.senderID != api.getCurrentUserID() && !global.config.ADMINBOT.includes(event.senderID)) {
            let thuebot;
            try {
                thuebot = JSON.parse(require("fs").readFileSync(process.cwd() + "/modules/commands/data/thuebot.json"));
            } catch {
                thuebot = [];
            }
            let find_thuebot = thuebot.find(($) => $.t_id == event.threadID);

            if (!find_thuebot) {
                return api.sendMessage(threadID, async () => {
                    await api.shareContact("⛔ Nhóm của bạn chưa thuê bot, Vui lòng thuê bot để tiếp tục sử dụng.\n\nLiên hệ Admin: Đỗ Quốc Trung",100050467390630, threadID);
                });
            }
            if (new Date(form_mm_dd_yyyy(find_thuebot.time_end)).getTime() <= Date.now() + 25200000) {
                return api.sendMessage(threadID, async () => {
                    await api.shareContact("⚠️ Nhóm của bạn đã hết hạn thuê bot, Vui lòng thanh toán để tiếp tục gia hạn.\n\nLiên hệ Admin: Đỗ Quốc Trung", 100050467390630, threadID);
                });
            }
        }

        

        // --- reply khi người dùng chỉ gõ đúng prefix ---
        if (event.body && event.body.trim() === global.config.PREFIX) {
            const replies = [
                "Hii 🧸💗",
                "Nèee, bot cute xuất hiện ✨",
                "Ủa gọi tui đó hảa~ 🐻",
                "Xin chào cục cưng đáng iu 💞",
                "Chào cậu, hôm nay ổn hong 🥺"
            ];
            const reply = replies[Math.floor(Math.random() * replies.length)];
            return api.sendMessage(reply, event.threadID, event.messageID);
        }

        // Event Type Switch
        switch (event.type) {
            
            case "message":
            case "message_reply": 
            case "message_unsend":
                handleCreateDatabase({
                    event
                });
                handleCommand({
                    event
                });
                handleReply({
                    event
                });
                handleCommandEvent({
                    event
                });
                break;

            case "event":
                handleEvent({
                    event
                });
                handleRefresh({
                    event
                });
                break;

            case "message_reaction":
                var {
                    iconUnsend
                } = global.config;
                if (iconUnsend.status && event.senderID == api.getCurrentUserID() && event.reaction == iconUnsend.icon) {
                    api.unsendMessage(event.messageID);
                }
                handleReaction({
                    event
                });
                break;

            default:
                break;
        }
    };
};