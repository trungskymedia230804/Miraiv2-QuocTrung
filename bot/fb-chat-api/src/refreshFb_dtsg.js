"use strict";

const utils = require("../utils");
const log = require("npmlog");

module.exports = function(defaultFuncs, api, ctx) {
    /**
     * Làm mới giá trị fb_dtsg.
     * @param {Object} [obj] Đối tượng chứa giá trị để cập nhật trực tiếp (tùy chọn)
     * @param {Function} [callback] Hàm callback (tùy chọn)
     * @returns {Promise} Trả về promise chứa kết quả làm mới
     * @description Làm mới fb_dtsg để tránh lỗi "Please try closing and re-opening your browser window"
     * @description Nên làm mới mỗi 48h hoặc ít hơn
     * @example Sử dụng Promise:
     * api.refreshFb_dtsg().then(result => {
     *     console.log(result.data.fb_dtsg);
     * });
     * 
     * @example Sử dụng callback:
     * api.refreshFb_dtsg((err, result) => {
     *     if(err) return console.error(err);
     *     console.log(result.data.fb_dtsg);
     * });
     * 
     * @example Cập nhật trực tiếp:
     * api.refreshFb_dtsg({
     *     fb_dtsg: "giá_trị_mới"
     * }).then(result => {
     *     console.log(result.message);
     * });
     */
    return function refreshFb_dtsg(obj, callback) {
        let resolveFunc = function() {};
        let rejectFunc = function() {};
        const returnPromise = new Promise(function(resolve, reject) {
            resolveFunc = resolve;
            rejectFunc = reject;
        });

        // Xử lý trường hợp obj là callback
        if (utils.getType(obj) === "Function" || utils.getType(obj) === "AsyncFunction") {
            callback = obj;
            obj = {};
        }

        // Khởi tạo obj rỗng nếu không được cung cấp
        if (!obj) {
            obj = {};
        }

        // Kiểm tra kiểu dữ liệu của obj
        if (utils.getType(obj) !== "Object") {
            throw new utils.CustomError("tham số đầu tiên phải là một đối tượng hoặc một hàm callback");
        }

        // Thiết lập callback mặc định nếu không được cung cấp
        if (!callback) {
            callback = function(err, result) {
                if (err) return rejectFunc(err);
                resolveFunc(result);
            };
        }

        // Nếu không có giá trị được cung cấp, lấy giá trị mới từ Facebook
        if (Object.keys(obj).length == 0) {
            utils
                .get('https://www.facebook.com/settings', ctx.jar, null, ctx.globalOptions)
                .then(function(resData) {
                    const html = resData.body;
                    let fb_dtsg;

                    // Thử mẫu DTSGInitialData
                    let match = html.match(/\["DTSGInitialData",\[\],{"token":"([^"]+)"}/);
                    if (match) {
                        fb_dtsg = match[1].replace(/\\/g, '');
                    }

                    // Thử mẫu async_get_token nếu không tìm thấy
                    if (!fb_dtsg) {
                        match = html.match(/{"token":"([^"]+)","async_get_token"/);
                        if (match) {
                            fb_dtsg = match[1];
                        }
                    }

                    // Thử mẫu input field nếu vẫn không tìm thấy
                    if (!fb_dtsg) {
                        match = html.match(/<input type="hidden" name="fb_dtsg" value="([^"]+)"/);
                        if (match) {
                            fb_dtsg = match[1];
                        }
                    }

                    // Báo lỗi nếu không tìm thấy fb_dtsg
                    if (!fb_dtsg) {
                        throw new utils.CustomError("Không thể tìm thấy fb_dtsg trong HTML sau khi yêu cầu https://www.facebook.com/settings");
                    }

                    // Cập nhật context
                    ctx.fb_dtsg = fb_dtsg;

                    // Trả về kết quả
                    callback(null, {
                        data: {
                            fb_dtsg: fb_dtsg
                        },
                        message: "đã làm mới fb_dtsg"
                    });
                })
                .catch(function(err) {
                    log.error("refreshFb_dtsg", err);
                    return callback(err);
                });
        }
        else {
            // Cập nhật context với các giá trị được cung cấp
            Object.keys(obj).forEach(function(key) {
                ctx[key] = obj[key];
            });
            callback(null, {
                data: obj,
                message: "đã làm mới " + Object.keys(obj).join(", ")
            });
        }

        return returnPromise;
    };
};