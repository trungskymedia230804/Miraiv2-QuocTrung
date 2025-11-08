'use strict';
/* eslint-disable linebreak-style */
const utils = require('./utils');

global.Fca = new Object({
    isThread: new Array(),
    isUser: new Array(),
    startTime: Date.now(),
    Setting: new Map(),
    Require: new Object({
        fs: require("fs"),
        Fetch: require('got'),
        log: require("npmlog"),
        utils: require("./utils.js"),
        logger: require('./logger.js'),
        languageFile: require('./Language/index.json'),
        Security: require('./Extra/Src/uuid.js')
    }),
    getText: function(...Data) {
        var Main = (Data.splice(0,1)).toString();
            for (let i = 0; i < Data.length; i++) Main = Main.replace(RegExp(`%${i + 1}`, 'g'), Data[i]);
        return Main;
    },
    Data: new Object({
        ObjFastConfig: {
            "Language": "vi",
            "MainColor": "#9900FF",
            "MainName": "[ HORIZON ]",
            "Uptime": false,
            "Config": "default",
            "DevMode": false,
            "ResetDataLogin": false,
            "AutoRestartMinutes": 0,
            "RestartMQTT_Minutes": 60,
            "AntiGetInfo": {
                "Database_Type": "default",
                "AntiGetThreadInfo": true,
                "AntiGetUserInfo": true
            },
            "Stable_Version": {
                "Accept": false,
                "Version": ""
            },
            "AntiStuckAndMemoryLeak": {
                "AutoRestart": {
                    "Use": true,
                    "Explain": "When this feature is turned on, the system will continuously check and confirm that if memory usage reaches 90%, it will automatically restart to avoid freezing or stopping."
                },
                "LogFile": {
                    "Use": false,
                    "Explain": "Record memory usage logs to fix errors. Default location: Horizon/memory.logs"
                }
            }
        },
        CountTime: function() {
            var fs = global.Fca.Require.fs;
            if (fs.existsSync(__dirname + '/CountTime.json')) {
                try {
                    var data = Number(fs.readFileSync(__dirname + '/CountTime.json', 'utf8')),
                    hours = Math.floor(data / (60 * 60));
                }
                catch (e) {
                    fs.writeFileSync(__dirname + '/CountTime.json', 0);
                    hours = 0;
                }
            }
            else {
                hours = 0;
            }
            return `${hours} Hours`;
        }
    })
});

try {
    let Boolean_Fca = ["Uptime","ResetDataLogin", "DevMode"];
    let String_Fca = ["MainName","Language","Config"]
    let Number_Fca = ["AutoRestartMinutes","RestartMQTT_Minutes"];
    let Object_Fca = ["Stable_Version","AntiGetInfo", "AntiStuckAndMemoryLeak"];
    let All_Variable = Boolean_Fca.concat(String_Fca,Number_Fca,Object_Fca);

    if (!global.Fca.Require.fs.existsSync(process.cwd() + '/FastConfigFca.json')) {
        global.Fca.Require.fs.writeFileSync(process.cwd() + "/FastConfigFca.json", JSON.stringify(global.Fca.Data.ObjFastConfig, null, "\t"));
        process.exit(1);
    }

    try {
        var Data_Setting = require(process.cwd() + "/FastConfigFca.json");
    }
    catch (e) {
        global.Fca.Require.logger.Error('Detect Your FastConfigFca Settings Invalid!, Carry out default restoration');
        global.Fca.Require.fs.writeFileSync(process.cwd() + "/FastConfigFca.json", JSON.stringify(global.Fca.Data.ObjFastConfig, null, "\t"));     
        process.exit(1);
    }

    if (global.Fca.Require.fs.existsSync(process.cwd() + '/FastConfigFca.json')) {
        for (let i of All_Variable) {
            if (Data_Setting[i] == undefined) {
                Data_Setting[i] = global.Fca.Data.ObjFastConfig[i];
                global.Fca.Require.fs.writeFileSync(process.cwd() + "/FastConfigFca.json", JSON.stringify(Data_Setting, null, "\t"));
            }
        }

        for (let i in Data_Setting) {
            if (Boolean_Fca.includes(i)) {
                if (global.Fca.Require.utils.getType(Data_Setting[i]) != "Boolean") logger.Error(i + " Is Not A Boolean, Need To Be true Or false !", function() { process.exit(0) });
            }
            else if (String_Fca.includes(i)) {
                if (global.Fca.Require.utils.getType(Data_Setting[i]) != "String") logger.Error(i + " Is Not A String, Need To Be String!", function() { process.exit(0) });
            }
            else if (Number_Fca.includes(i)) {
                if (global.Fca.Require.utils.getType(Data_Setting[i]) != "Number") logger.Error(i + " Is Not A Number, Need To Be Number !", function() { process.exit(0) });
            }
            else if (Object_Fca.includes(i)) {
                if (global.Fca.Require.utils.getType(Data_Setting[i]) != "Object") {
                    Data_Setting[i] = global.Fca.Data.ObjFastConfig[i];
                    global.Fca.Require.fs.writeFileSync(process.cwd() + "/FastConfigFca.json", JSON.stringify(Data_Setting, null, "\t"));
                }
            }
        }

        for (let i of Object_Fca) {
            const All_Paths = utils.getPaths(global.Fca.Data.ObjFastConfig[i]);
            const Mission = { Main_Path: i, Data_Path: All_Paths }
            for (let i of Mission.Data_Path) {
                if (Data_Setting[Mission.Main_Path] == undefined) {
                    Data_Setting[Mission.Main_Path] = global.Fca.Data.ObjFastConfig[Mission.Main_Path];
                    global.Fca.Require.fs.writeFileSync(process.cwd() + "/FastConfigFca.json", JSON.stringify(Data_Setting, null, "\t"));      
                }
                const User_Data = (utils.getData_Path(Data_Setting[Mission.Main_Path], i, 0))
                const User_Data_Type = utils.getType(User_Data);
                if (User_Data_Type == "Number") {
                    const Mission_Path = User_Data == 0 ? i : i.slice(0, User_Data); 
                    const Mission_Obj = utils.getData_Path(global.Fca.Data.ObjFastConfig[Mission.Main_Path], Mission_Path, 0);
                    Data_Setting[Mission.Main_Path] = utils.setData_Path(Data_Setting[Mission.Main_Path], Mission_Path, Mission_Obj)
                    global.Fca.Require.fs.writeFileSync(process.cwd() + "/FastConfigFca.json", JSON.stringify(Data_Setting, null, "\t"));      
                }
            }
        }

        if (!global.Fca.Require.languageFile.some((i) => i.Language == Data_Setting.Language)) { 
            global.Fca.Require.logger.Warning("Not Support Language: " + Data_Setting.Language + " Only 'en' and 'vi'");
            process.exit(0); 
        }
        global.Fca.Require.Language = global.Fca.Require.languageFile.find((i) => i.Language == Data_Setting.Language).Folder;
    } else process.exit(1);
    global.Fca.Require.FastConfig = Data_Setting;
}
catch (e) {
    console.log(e);
    global.Fca.Require.logger.Error();
}

module.exports = function(loginData, options, callback) {
    const Language = global.Fca.Require.languageFile.find((i) => i.Language == global.Fca.Require.FastConfig.Language).Folder.Index;
    var login;
    try {
        login = require('./Main');
    }
    catch (e) {
        console.log(e);
        if (typeof callback === 'function') return callback(e);
        throw e;
    }

    if (typeof login !== 'function') {
        const err = new Error('Invalid fb-chat-api Main export: expected function');
        if (typeof callback === 'function') return callback(err);
        throw err;
    }

    try {
        login(loginData, options, callback);
    }
    catch (e) {
        console.log(e);
        if (typeof callback === 'function') return callback(e);
        throw e;
    }
};