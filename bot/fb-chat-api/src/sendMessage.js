"use strict";

var utils = require("../utils");
var log = require("npmlog");
var bluebird = require("bluebird");
var fs = require("fs-extra");
const { Readable } = require("stream");

// @nvhzx
// Update 09/09/2025

var allowedProperties = {
  attachment: true,
  url: true,
  sticker: true,
  emoji: true,
  emojiSize: true,
  body: true,
  mentions: true,
  location: true,
};

module.exports = function (defaultFuncs, api, ctx) {

  // === Upload Attachment ===
  function uploadAttachment(attachments, callback) {
    try {
      if (!attachments) return callback(null, []);

      if (utils.getType(attachments) !== "Array") {
        attachments = [attachments];
      }

      const uploads = [];

      for (let item of attachments) {
        if (Array.isArray(item) && item.length >= 2 && /_id$/.test(item[0])) {
          uploads.push(bluebird.resolve({ [item[0]]: item[1] }));
          continue;
        }

        let stream = item;

        if (!utils.isReadableStream(item)) {
          if (Buffer.isBuffer(item)) {
            const s = new Readable();
            s.push(item);
            s.push(null);
            stream = s;
          } else if (typeof item === "string" && fs.existsSync(item)) {
            stream = fs.createReadStream(item);
          } else {
            throw {
              error:
                "Attachment must be a readable stream, Buffer, or valid file path. Got: " +
                utils.getType(item),
            };
          }
        }

        const form = {
          upload_1024: stream,
          voice_clip: "true",
        };

        uploads.push(
          defaultFuncs
            .postFormData(
              "https://upload.facebook.com/ajax/mercury/upload.php",
              ctx.jar,
              form,
              {}
            )
            .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
            .then((resData) => {
              if (resData.error) throw resData;
              return resData.payload.metadata[0];
            })
        );
      }

      bluebird
        .all(uploads)
        .then((res) => callback(null, res))
        .catch((err) => {
          log.error("uploadAttachment", err);
          callback(err);
        });
    } catch (err) {
      log.error("uploadAttachment", err);
      callback(err);
    }
  }

  // === Get URL share data ===
  function getUrl(url, callback) {
    var form = {
      image_height: 960,
      image_width: 960,
      uri: url,
    };

    defaultFuncs
      .post(
        "https://www.facebook.com/message_share_attachment/fromURI/",
        ctx.jar,
        form
      )
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
      .then(function (resData) {
        if (resData.error) return callback(resData);
        if (!resData.payload) return callback({ error: "Invalid url" });
        callback(null, resData.payload.share_data.share_params);
      })
      .catch(function (err) {
        log.error("getUrl", err);
        callback(err);
      });
  }

  // === Send content to thread (Bỏ gửi riêng) ===
  function sendContent(form, threadID, messageAndOTID, callback) {
    form["thread_fbid"] = threadID;

    if (ctx.globalOptions.pageID) {
      form["author"] = "fbid:" + ctx.globalOptions.pageID;
      form["creator_info[creatorID]"] = ctx.userID;
      form["creator_info[creatorType]"] = "direct_admin";
      form["creator_info[labelType]"] = "sent_message";
      form["creator_info[pageID]"] = ctx.globalOptions.pageID;
      form["request_user_id"] = ctx.globalOptions.pageID;
      form["creator_info[profileURI]"] =
        "https://www.facebook.com/profile.php?id=" + ctx.userID;
    }

    defaultFuncs
      .post("https://www.facebook.com/messaging/send/", ctx.jar, form)
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
      .then((resData) => {
        if (!resData) return callback({ error: "Send message failed." });
        if (resData.error) return callback(resData);

        var messageInfo = resData.payload.actions.reduce((p, v) => {
          return {
            threadID: v.thread_fbid,
            messageID: v.message_id,
            timestamp: v.timestamp,
          } || p;
        }, null);

        callback(null, messageInfo);
      })
      .catch((err) => {
        log.error("sendMessage", err);
        callback(err);
      });
  }

  // === Send wrapper ===
  function send(form, threadID, messageAndOTID, callback) {
    sendContent(form, threadID, messageAndOTID, callback);
  }

  // === Handlers ===
  function handleUrl(msg, form, callback, cb) {
    if (msg.url) {
      form["shareable_attachment[share_type]"] = "100";
      getUrl(msg.url, function (err, params) {
        if (err) return callback(err);
        form["shareable_attachment[share_params]"] = params;
        cb();
      });
    } else cb();
  }

  function handleLocation(msg, form, callback, cb) {
    if (msg.location) {
      if (msg.location.latitude == null || msg.location.longitude == null)
        return callback({
          error: "location property needs both latitude and longitude",
        });
      form["location_attachment[coordinates][latitude]"] =
        msg.location.latitude;
      form["location_attachment[coordinates][longitude]"] =
        msg.location.longitude;
      form["location_attachment[is_current_location]"] = !!msg.location.current;
    }
    cb();
  }

  function handleSticker(msg, form, callback, cb) {
    if (msg.sticker) form["sticker_id"] = msg.sticker;
    cb();
  }

  function handleEmoji(msg, form, callback, cb) {
    if (msg.emojiSize != null && msg.emoji == null)
      return callback({ error: "emoji property is empty" });
    if (msg.emoji) {
      if (!msg.emojiSize) msg.emojiSize = "medium";
      if (!["small", "medium", "large"].includes(msg.emojiSize))
        return callback({ error: "emojiSize property is invalid" });
      if (form.body != null && form.body != "")
        return callback({ error: "body is not empty" });
      form.body = msg.emoji;
      form["tags[0]"] = "hot_emoji_size:" + msg.emojiSize;
    }
    cb();
  }

  function handleAttachment(msg, form, callback, cb) {
    if (msg.attachment) {
      form["image_ids"] = [];
      form["gif_ids"] = [];
      form["file_ids"] = [];
      form["video_ids"] = [];
      form["audio_ids"] = [];

      if (utils.getType(msg.attachment) !== "Array") {
        msg.attachment = [msg.attachment];
      }

      uploadAttachment(msg.attachment, function (err, files) {
        if (err) return callback(err);
        files.forEach(function (file) {
          var key = Object.keys(file)[0]; // image_id, file_id, etc
          form[key + "s"].push(file[key]);
        });
        cb();
      });
    } else cb();
  }

  function handleMention(msg, form, callback, cb) {
    if (msg.mentions) {
      for (let i = 0; i < msg.mentions.length; i++) {
        const mention = msg.mentions[i];
        const tag = mention.tag;
        if (typeof tag !== "string")
          return callback({ error: "Mention tags must be strings." });
        const offset = msg.body.indexOf(tag, mention.fromIndex || 0);
        if (offset < 0)
          log.warn(
            "handleMention",
            'Mention for "' + tag + '" not found in message string.'
          );
        const id = mention.id || 0;
        const emptyChar = "\u200E";
        form.body = emptyChar + msg.body;
        form["profile_xmd[" + i + "][offset]"] = offset + 1;
        form["profile_xmd[" + i + "][length]"] = tag.length;
        form["profile_xmd[" + i + "][id]"] = id;
        form["profile_xmd[" + i + "][type]"] = "p";
      }
    }
    cb();
  }

  // === Main sendMessage function ===
  return function sendMessage(msg, threadID, callback, replyToMessage, isGroup) {
    typeof isGroup === "undefined" ? (isGroup = null) : "";

    if (!callback && ["Function", "AsyncFunction"].includes(utils.getType(threadID))) {
      return threadID({ error: "Pass a threadID as a second argument." });
    }
    if (!replyToMessage && utils.getType(callback) === "String") {
      replyToMessage = callback;
      callback = undefined;
    }

    var resolveFunc, rejectFunc;
    var returnPromise = new Promise(function (resolve, reject) {
      resolveFunc = resolve;
      rejectFunc = reject;
    });
    if (!callback)
      callback = function (err, data) {
        if (err) return rejectFunc(err);
        resolveFunc(data);
      };

    var msgType = utils.getType(msg);
    var threadIDType = utils.getType(threadID);
    var messageIDType = utils.getType(replyToMessage);

    if (!["String", "Object"].includes(msgType))
      return callback({
        error: "Message should be string or object and not " + msgType,
      });
    if (!["Array", "Number", "String"].includes(threadIDType))
      return callback({
        error: "ThreadID should be number, string, or array and not " + threadIDType,
      });
    if (replyToMessage && messageIDType !== "String")
      return callback({
        error: "MessageID should be string and not " + threadIDType,
      });

    if (msgType === "String") msg = { body: msg };
    var disallowedProperties = Object.keys(msg).filter((prop) => !allowedProperties[prop]);
    if (disallowedProperties.length > 0)
      return callback({
        error: "Dissallowed props: `" + disallowedProperties.join(", ") + "`",
      });

    var messageAndOTID = utils.generateOfflineThreadingID();

    var form = {
      client: "mercury",
      action_type: "ma-type:user-generated-message",
      author: "fbid:" + ctx.userID,
      timestamp: Date.now(),
      timestamp_absolute: "Today",
      timestamp_relative: utils.generateTimestampRelative(),
      timestamp_time_passed: "0",
      is_unread: false,
      is_cleared: false,
      is_forward: false,
      is_filtered_content: false,
      is_filtered_content_bh: false,
      is_filtered_content_account: false,
      is_filtered_content_quasar: false,
      is_filtered_content_invalid_app: false,
      is_spoof_warning: false,
      source: "source:chat:web",
      "source_tags[0]": "source:chat",
      body: msg.body ? msg.body.toString() : "",
      html_body: false,
      ui_push_phase: "V3",
      status: "0",
      offline_threading_id: messageAndOTID,
      message_id: messageAndOTID,
      threading_id: utils.generateThreadingID(ctx.clientID),
      "ephemeral_ttl_mode:": "0",
      manual_retry_cnt: "0",
      has_attachment: !!(msg.attachment || msg.url || msg.sticker),
      signatureID: utils.getSignatureID(),
      replied_to_message_id: replyToMessage,
    };

    handleLocation(msg, form, callback, () =>
      handleSticker(msg, form, callback, () =>
        handleAttachment(msg, form, callback, () =>
          handleUrl(msg, form, callback, () =>
            handleEmoji(msg, form, callback, () =>
              handleMention(msg, form, callback, () =>
                send(form, threadID, messageAndOTID, callback)
              )
            )
          )
        )
      )
    );

    return returnPromise;
  };
};