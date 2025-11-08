'use strict';


if (global.Fca.Require.FastConfig.Config != 'default') {
}
const Language = global.Fca.Require.languageFile.find((/** @type {{ Language: string; }} */i) => i.Language == global.Fca.Require.FastConfig.Language).Folder.Index;


var utils = global.Fca.Require.utils,
    logger = global.Fca.Require.logger,
    fs = global.Fca.Require.fs,
    getText = global.Fca.getText,
    log = global.Fca.Require.log,
    { getAll, deleteAll } = require('./Extra/ExtraGetThread'),
    { TOTP } = require('totp-generator'),
    axios = require('axios'),
    { CookieJar } = require('tough-cookie');

log.maxRecordSize = 100;
const Boolean_Option = ['online','selfListen','listenEvents','updatePresence','forceLogin','autoMarkDelivery','autoMarkRead','listenTyping','autoReconnect','emitReady'];

async function makeLogin(loginData) {
    try {
        const { email, password, twoFactorSecret, i_user } = loginData;

        if (!email || !password) throw new Error('Thiếu email hoặc password');

        logger.Normal(`Đang kiểm tra với: ${email}`);
        
        const session = await createSession();
        const response = await session.get('https://m.facebook.com/', {
            headers: headersMobile('get')
        });

        const html = response.data;
        
        const findMatch = (regex) => {
            const match = html.match(regex);
            return match ? match[1] : null;
        };

        const formData = {
            '__aaid': '0',
            '__user': '0',
            '__a': '1',
            '__req': 'd',
            '__hs': findMatch(/"haste_session":"(.*?)"/),
            'dpr': '1',
            '__ccg': 'EXCELLENT',
            '__rev': findMatch(/"server_revision":(.*?),/),
            '__hsi': findMatch(/"hsi":"(.*?)"/),
            '__csr': '',
            'fb_dtsg': findMatch(/"dtsg":{"token":"(.*?)"/),
            'jazoest': findMatch(/"jazoest", "(.*?)"/),
            'lsd': findMatch(/"LSD",\[\],{"token":"(.*?)"}/),
            'params': JSON.stringify({
                credential_type: 'password',
                username_text_input_id: 'yubcjs:61',
                password_text_input_id: 'yubcjs:62',
                contact_point: email,
                password: `#PWD_BROWSER:0:${Math.floor(Date.now()/1000)}:${password}`
            })
        };

        const loginResponse = await session.post(
            'https://m.facebook.com/async/wbloks/fetch/?appid=com.bloks.www.bloks.caa.login.async.send_login_request&type=action&__bkv=b12ba24e6c7328a7dc3b351bc5cc86130f203876c77c9b8111fa1dfc37baacb6',
            new URLSearchParams(formData).toString(),
            {
                headers: headersMobile('post')
            }
        );

        const responseStr = loginResponse.data.replace('for (;;);', '');
        const responseData = JSON.parse(responseStr);
        console.log(responseData);
        if (responseData.payload?.layout?.bloks_payload?.action?.includes('redirection_to_two_fac')) {
            const action = responseData.payload.layout.bloks_payload.action;
            
            const contexts = action.match(/Make, \"(AW[A-Za-z0-9+\/\-_]{200,})\"/g);
            if (!contexts || contexts.length === 0) {
                throw new Error("Cannot find 2FA context");
            }

            const twoStepData = contexts[contexts.length - 1]
                .replace('Make, "', '')
                .replace('"', '');
            
            if (twoStepData) {
                if (twoFactorSecret) {
                    const code = TOTP.generate(twoFactorSecret.replace(/\s/g, '').toUpperCase()).otp;

                    await new Promise(resolve => setTimeout(resolve, 1000));

                    const verify2FAData1 = {
                        '__aaid': '0',
                        '__user': '0',
                        '__a': '1',
                        '__req': 't',
                        '__hs': '20120.BP:wbloks_caa_pkg.2.0...0',
                        'dpr': '3',
                        '__ccg': 'EXCELLENT',
                        '__rev': findMatch(/"server_revision":(.*?),/),
                        '__s': ':567cxa:z3ol4q',
                        '__hsi': findMatch(/"hsi":"(.*?)"/),
                        '__dyn': '0wzpawlE72fDg9ppo5S12wAxu13wqobE6u7E39x60lW4o3Bw4Ewk9E4W099w2s8hw73wGw6tw5Uw64w8W1uwf20n6aw8m0zE2ZwrU6q3a0le0iS2eU2dwde',
                        '__csr': '',
                        'fb_dtsg': findMatch(/"dtsg":{"token":"(.*?)"/),
                        'jazoest': findMatch(/"jazoest", "(.*?)"/),
                        'lsd': findMatch(/"LSD",\[\],{"token":"(.*?)"}/),
                        'params': JSON.stringify({
                            params: {
                                server_params: {
                                    two_step_verification_context: twoStepData,
                                    flow_source: "two_factor_login",
                                    challenge: "totp",
                                    machine_id: null,
                                    device_id: null
                                },
                                client_input_params: {
                                    machine_id: '',
                                    code: code,
                                    should_trust_device: 1,
                                    auth_secure_device_id: '',
                                    openid_tokens: {}
                                }
                            }
                        })
                    };

                    const verify2FAResponse = await session.post(
                        'https://m.facebook.com/async/wbloks/fetch/?appid=com.bloks.www.two_step_verification.verify_code.async&type=action&__bkv=2c4733784ae1256fe36c8fac264a2939b8558cfc1bad5ac672c9bc60482cab5a',
                        new URLSearchParams(verify2FAData1).toString(),
                        {
                            headers: {
                                ...headersMobile('post'),
                                'Referer': 'https://m.facebook.com/'
                            }
                        }
                    );

                    const verify2FAStr = verify2FAResponse.data.replace('for (;;);', '');
                    const verify2FAData = JSON.parse(verify2FAStr);

                    if (verify2FAData.ajaxUpdateAfterLogin) {
                        let appState = parseCookiesToAppstate(verify2FAResponse.headers['set-cookie']);

                        if (i_user) {
                            appState.push({
                                key: 'i_user',
                                value: i_user,
                                domain: 'facebook.com',
                                path: '/',
                                hostOnly: false,
                                creation: new Date().toISOString(),
                                lastAccessed: new Date().toISOString()
                            });
                        }

                        return {
                            success: true,
                            appState
                        };
                    }
                } else {
                    return {
                        success: false,
                        error: 'Yêu cầu xác thực 2FA'
                    };
                }
            }
        }
        
        if (responseData.ajaxUpdateAfterLogin && responseData.ajaxUpdateAfterLogin.currentUser) {
            let appState = parseCookiesToAppstate(loginResponse.headers['set-cookie']);
            
            if (i_user) {
                appState.push({
                    key: 'i_user',
                    value: i_user,
                    domain: 'facebook.com',
                    path: '/',
                    hostOnly: false,
                    creation: new Date().toISOString(),
                    lastAccessed: new Date().toISOString()
                });
            }

            return {
                success: true,
                appState
            };
        }

        return {
            success: false,
            error: 'Đăng nhập thất bại'
        };

    } catch (error) {
        logger.Error(`Lỗi trong quá trình đăng nhập: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

async function createSession() {
    const jar = new CookieJar();
    const mod = await import('axios-cookiejar-support');
    const maybeWrapper = mod.wrapper || (mod.default && mod.default.wrapper) || mod.default || mod;
    const axiosInstance = axios.create({ jar, withCredentials: true });
    if (typeof maybeWrapper === 'function') {
        return maybeWrapper(axiosInstance);
    }
    if (maybeWrapper && typeof maybeWrapper.wrapper === 'function') {
        return maybeWrapper.wrapper(axiosInstance);
    }
    return axiosInstance;
}

function headersMobile(type) {
    const base = {
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Ch-Prefers-Color-Scheme': 'dark',
        'Sec-Ch-Ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
        'Sec-Ch-Ua-Full-Version-List': '"Not/A)Brand";v="8.0.0.0", "Chromium";v="126.0.6478.127", "Google Chrome";v="126.0.6478.127"',
        'Sec-Ch-Ua-Model': '"Nexus 5"',
        'Sec-Ch-Ua-Platform': '"Android"',
        'Sec-Ch-Ua-Platform-Version': '"6.0"',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 11; vivo 1918 Build/RP1A.200720.012; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/112.0.0000.00 Mobile Safari/537.36'
    };

    if (type.toLowerCase() === 'get') {
        return {
            ...base,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Cache-Control': 'max-age=0',
            'Dpr': '1',
            'Priority': 'u=0, i',
            'Sec-Ch-Ua-Mobile': '?1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
            'Viewport-Width': '360'
        };
    } else if (type.toLowerCase() === 'post') {
        return {
            ...base,
            'Accept': '*/*',
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'Origin': 'https://m.facebook.com',
            'Priority': 'u=1, i',
            'Referer': 'https://m.facebook.com/',
            'Sec-Ch-Ua-Mobile': '?1',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors'
        };
    }
}

function parseCookiesToAppstate(setCookieHeader) {
    const appstate = [];
    if (!setCookieHeader) return appstate;
    
    const cookieArray = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    
    cookieArray.forEach(cookieStr => {
        const [mainPart, ...options] = cookieStr.split(';');
        const [key, value] = mainPart.trim().split('=');
        
        const cookie = {
            key: key,
            value: value,
            domain: '.facebook.com',
            path: '/'
        };

        options.forEach(option => {
            const [optKey, optValue] = option.trim().split('=');
            switch(optKey.toLowerCase()) {
                case 'domain':
                    cookie.domain = optValue;
                    break;
                case 'path':
                    cookie.path = optValue;
                    break;
                case 'expires':
                    cookie.expires = new Date(optValue).getTime();
                    break;
                case 'httponly':
                    cookie.httpOnly = true;
                    break;
                case 'secure':
                    cookie.secure = true;
                    break;
            }
        });

        appstate.push(cookie);
    });
    
    return appstate;
}

async function bypassAutoBehavior(resp, jar, globalOptions, appstate, ID) {
    global.Fca.Bypass049 = bypassAutoBehavior;
    try {
        const appstateCUser = (appstate.find(i => i.key == 'i_user') || appstate.find(i => i.key == 'c_user'))
        const UID = ID || appstateCUser.value;

        function getFBDTSG(html) {
            let match = html.match(/\["DTSGInitialData",\[\],{"token":"([^"]+)"}/);
            if (match) return match[1].replace(/\\/g, '');
            match = html.match(/{"token":"([^"]+)","async_get_token"/);
            if (match) return match[1];
            match = html.match(/<input type="hidden" name="fb_dtsg" value="([^"]+)"/);
            if (match) return match[1];
            return null;
        }

        if (resp) {
            if (resp.request.uri && resp.request.uri.href.includes("https://www.facebook.com/checkpoint/")) {
                if (resp.request.uri.href.includes('601051028565049')) {
                  logger.Warning('Phát hiện cảnh báo hành vi tự động, tiến hành bypass!')
                    const fb_dtsg = getFBDTSG(resp.body);
                    const form = {
                        av: UID,
                        fb_api_caller_class: "RelayModern",
                        fb_api_req_friendly_name: "FBScrapingWarningMutation",
                        doc_id: "6339492849481770",
                        variables: JSON.stringify({}),
                        server_timestamps: true,
                        fb_dtsg
                    };
                    
                    return utils.post("https://www.facebook.com/api/graphql/", jar, form, globalOptions)
                        .then(utils.saveCookies(jar))
                        .then(() => utils.get('https://www.facebook.com/', jar, null, globalOptions));
                } 
                return resp;
            }
            return resp; 
        }
        
    } catch (e) {
        logger.Error(`Bypass thất bại: ${e}`);
    }
}

async function checkIfSuspended(resp, appstate) {
    try {
        const appstateCUser = (appstate.find(i => i.key == 'i_user') || appstate.find(i => i.key == 'c_user'))
        const UID = appstateCUser?.value;
        const suspendReasons = {};
        if (resp) {
            if (resp.request.uri && resp.request.uri.href.includes("https://www.facebook.com/checkpoint/")) {
                if (resp.request.uri.href.includes('1501092823525282')) {
                    const daystoDisable = resp.body?.match(/"log_out_uri":"(.*?)","title":"(.*?)"/);
                    if (daystoDisable && daystoDisable[2]) {
                        suspendReasons.durationInfo = daystoDisable[2];
                        logger.Error(`Tài khoản bị khóa link 282: ${suspendReasons.durationInfo}`);
                    }
                    const reasonDescription = resp.body?.match(/"reason_section_body":"(.*?)"/);
                    if (reasonDescription && reasonDescription[1]) {
                        suspendReasons.longReason = reasonDescription?.[1];
                        const reasonReplace = suspendReasons?.longReason?.toLowerCase()?.replace("your account, or activity on it, doesn't follow our community standards on ", "");
                        suspendReasons.shortReason = reasonReplace?.substring(0, 1).toUpperCase() + reasonReplace?.substring(1);
                        logger.Error(`Cảnh Báo ${UID}: Tài Khoản Đã Bị Đình Chỉ!`);
                        logger.Error(`Lí do: ${suspendReasons.longReason}`)
                        logger.Error(`Thông tin thêm: ${suspendReasons.shortReason}`);
                    }
                    return {
                        suspended: true
                    }
                }
            } else return;
        }
    } catch (error) {
        return;
    }
}

async function checkIfLocked(resp, appstate) {
    try {
        const appstateCUser = (appstate.find(i => i.key == 'i_user') || appstate.find(i => i.key == 'c_user'))
        const UID = appstateCUser?.value;
        const lockedReasons = {};
        if (resp) {
            if (resp.request.uri && resp.request.uri.href.includes("https://www.facebook.com/checkpoint/")) {
                if (resp.request.uri.href.includes('828281030927956')) {
                    const lockDesc = resp.body.match(/"is_unvetted_flow":true,"title":"(.*?)"/);
                    if (lockDesc && lockDesc[1]) {
                        lockedReasons.reason = lockDesc[1];
                        logger.Error(`Cảnh báo ${UID}: ${lockedReasons.reason}`);
                    }
                    return {
                        locked: true
                    }
                }
            } else return;
        }
    } catch (e) {
        console.error("error", e);
    }
}

function setOptions(globalOptions, options) {
    Object.keys(options).map(function(key) {
        switch (Boolean_Option.includes(key)) {
            case true: {
                globalOptions[key] = Boolean(options[key]);
                break;
            }
            case false: {
                switch (key) {
                    case 'pauseLog': {
                        if (options.pauseLog) log.pause();
                            else log.resume();
                        break;
                    }
                    case 'logLevel': {
                        log.level = options.logLevel;
                            globalOptions.logLevel = options.logLevel;
                        break;
                    }
                    case 'logRecordSize': {
                        log.maxRecordSize = options.logRecordSize;
                            globalOptions.logRecordSize = options.logRecordSize;
                        break;
                    }
                    case 'pageID': {
                        globalOptions.pageID = options.pageID.toString();
                        break;
                    }
                    case 'userAgent': {
                        globalOptions.userAgent = (options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
                        break;
                    }
                    case 'proxy': {
                        if (typeof options.proxy != "string") {
                            delete globalOptions.proxy;
                            utils.setProxy();
                        } else {
                            globalOptions.proxy = options.proxy;
                            utils.setProxy(globalOptions.proxy);
                        }
                        break;
                    }
                    default: {
                        log.warn("setOptions", "Unrecognized option given to setOptions: " + key);
                        break;
                    }
                }
                break;
            }
        }
    });
}

function buildAPI(globalOptions, html, jar) {
    let fb_dtsg = null;
    let irisSeqID = null;

    function getFBDTSG(html) {
        let match = html.match(/\["DTSGInitialData",\[\],{"token":"([^"]+)"}/);
        if (match) {
            return match[1].replace(/\\/g, '');
        }
        logger.Warning("Không tìm được fb_dtsg.");
        return null;
    }

    fb_dtsg = getFBDTSG(html);
    irisSeqID = (html.match(/irisSeqID":"([^"]+)"/) || [])[1];

    if (fb_dtsg) logger.Normal("Process OnLogin");
    var userID = (jar.getCookies("https://www.facebook.com")
        .find(cookie => cookie.key === "i_user") || 
        jar.getCookies("https://www.facebook.com")
        .find(cookie => cookie.key === "c_user") ||
        {}).value;

    if (!userID) {
            return global.Fca.Require.logger.Error(global.Fca.Require.Language.Index.ErrAppState);
    }
    process.env['UID'] = logger.Normal(getText(Language.UID, userID), userID);

    let mqttEndpoint, region;
    const endpointMatch = html.match(/"endpoint":"([^"]+)"/);
    if (endpointMatch) {
        mqttEndpoint = endpointMatch[1].replace(/\\\//g, '/');
        const url = new URL(mqttEndpoint);
        region = url.searchParams.get('region')?.toUpperCase() || "PRN";
        logger.Normal(`MQTT Region: ${region}`);
    } else {
        logger.Warning('Using default MQTT endpoint');
        mqttEndpoint = `wss://edge-chat.facebook.com/chat?region=prn&sid=${userID}`;
        region = "PRN";
    }

    var ctx = {
        userID,
        jar,
        clientID: utils.getGUID(),
        globalOptions,
        loggedIn: true,
        access_token: 'NONE',
        clientMutationId: 0,
        mqttClient: undefined,
        lastSeqId: irisSeqID,
        syncToken: undefined,
        mqttEndpoint,
        region,
        firstListen: true,
        fb_dtsg,
        req_ID: 0,
        callback_Task: {},
        lastPresence: Date.now(),
    };

    const defaultFuncs = utils.makeDefaults(html, userID, ctx);
    
    const api = {
        setOptions: setOptions.bind(null, globalOptions),
        getAppState: () => utils.getAppState(jar),
        postFormData: function(url, body) {
            return defaultFuncs.postFormData(url, ctx.jar, body);
        },
    };

    return [ctx, defaultFuncs, api];
}

function loginHelper(appState, globalOptions, callback) {
    var mainPromise = null;
    var jar = utils.getJar();
    try {
        if (appState) {
            try {
                switch (utils.getType(appState)) { 
                    case "Array": {
                    }
                        break;
                    default: {
                        logger.Warning(Language.InvaildAppState);
                        process.exit(0);
                    }
                } 
            }
            catch (e) {
                console.log(e);
            }

            try {
                appState = JSON.parse(appState);
            }
            catch (e) {
                try {
                    appState = appState;
                }
                catch (e) {
                    return logger.Error();
                }
            }

            try {
                global.Fca.Data.AppState = appState;
                appState.map(function(c) {
                    var str = c.key + "=" + c.value + "; expires=" + c.expires + "; domain=" + c.domain + "; path=" + c.path + ";";
                    jar.setCookie(str, "http://" + c.domain);
                });
                mainPromise = utils
                    .get('https://www.facebook.com/', jar, null, globalOptions, { noRef: true })
                    .then(utils.saveCookies(jar))
                    .then(res => bypassAutoBehavior(res, jar, globalOptions, appState))
                    .then(async (res) => {
                            const detectLocked = await checkIfLocked(res, appState);
                            if (detectLocked) throw detectLocked;
                            const detectSuspension = await checkIfSuspended(res, appState);
                            if (detectSuspension) throw detectSuspension;

                        const html = res.body;
                        const stuff = buildAPI(globalOptions, html, jar);
                        const ctx = stuff[0];
                        const defaultFuncs = stuff[1];
                        let api = stuff[2];
                        const folder = __dirname + '/src/';
                        fs.readdirSync(folder)
                            .filter(file => file.endsWith('.js'))
                            .forEach(file => {
                                const name = file.replace('.js', '');
                                if ((file === 'getThreadInfo.js' && !global.Fca.Require.FastConfig.AntiGetInfo.AntiGetThreadInfo) || 
                                    (file === 'getUserInfo.js' && !global.Fca.Require.FastConfig.AntiGetInfo.AntiGetUserInfo)) {
                                    api[name] = require(`./src/${file.includes('getThreadInfo') ? 'getThreadMain.js' : 'getUserInfoMain.js'}`)(defaultFuncs, api, ctx);
                                } else {
                                    api[name] = require(folder + file)(defaultFuncs, api, ctx);
                                }
                            });

                        api.listen = api.listenMqtt;
                        logger.Normal('Đã Load Xong SRC FCA');
                        return callback(null, api);
                    })
                    .catch(function(e) {
                        callback(e);
                    });
            }
            catch (e) {
                console.log(e);
                callback(e);
            }
        }
    } catch (e) {
        console.log(e);
        callback(e);
    }
}

function login(loginData, options, callback) {
    if (utils.getType(options) === 'Function' || utils.getType(options) === 'AsyncFunction') {
        callback = options;
        options = {};
    }
    logger.Normal("Bắt đầu đăng nhập")
    var globalOptions = {
        selfListen: false,
        listenEvents: true,
        listenTyping: false,
        updatePresence: false,
        forceLogin: false,
        autoMarkDelivery: false,
        autoMarkRead: false,
        autoReconnect: true,
        logRecordSize: 100,
        online: false,
        emitReady: false,
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    };

    if (utils.getType(callback) !== "Function" && utils.getType(callback) !== "AsyncFunction") {
        var rejectFunc = null;
        var resolveFunc = null;
        var returnPromise = new Promise(function(resolve, reject) {
            resolveFunc = resolve;
            rejectFunc = reject;
        }); 
        callback = function(error, api) {
            if (error) return rejectFunc(error);
            return resolveFunc(api);
        };
    }

    try {
        if (loginData.email && loginData.password) {
            logger.Normal("Đăng nhập bằng email/password", loginData);
            return makeLogin(loginData)
                .then(result => {
                    if (result.success) {
                        logger.Normal("Đăng nhập thành công qua email/password");
                        setOptions(globalOptions, options);
                        return loginHelper(result.appState, globalOptions, callback);
                    } else {
                        logger.Error(`Lỗi đăng nhập:${result.error}`);
                        throw new Error(result.error);
                    }
                })
                .catch(err => {
                    logger.Error(`Lỗi trong quá trình đăng nhập: ${err}`);
                    callback(err);
                    process.exit(0);
                });
        }
        else if (!loginData.appState) {
            logger.Warning(Language.ErrAppState);
            process.exit(0);
        } 
        else {
            logger.Normal("Đăng nhập bằng appstate ");
            setOptions(globalOptions, options);
            let All = (getAll()).filter(i => i.data.messageCount !== undefined);
            if (All.length >= 1) {
               deleteAll(All.map(obj => obj.data.threadID));
            }
            return loginHelper(loginData.appState, globalOptions, callback);
        }
    } catch (e) {
        console.error(e);
        callback(e);
    }
}

module.exports = login;