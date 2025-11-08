// Tạo file mới: src/createStory.js

"use strict";

var utils = require("../utils");
var log = require("npmlog");
var bluebird = require("bluebird");

module.exports = function(defaultFuncs, api, ctx) {
  
  // Upload video/media cho story
  function uploadStoryMedia(attachments, callback) {
    var uploads = [];

    for (var i = 0; i < attachments.length; i++) {
      if (!utils.isReadableStream(attachments[i])) {
        throw { error: "Attachment should be a readable stream and not " + utils.getType(attachments[i]) + "." };
      }

      var form = {
        upload_1024: attachments[i],
        voice_clip: "true"
      };

      uploads.push(
        defaultFuncs
          .postFormData("https://upload.facebook.com/ajax/mercury/upload.php", ctx.jar, form)
          .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
          .then(function(resData) {
            if (resData.error) throw resData;
            return resData.payload.metadata[0];
          })
      );
    }

    // Resolve tất cả promises
    bluebird
      .all(uploads)
      .then(resData => callback(null, resData))
      .catch(function(err) {
        log.error("uploadAttachment", err);
        return callback(err);
      });
  }

  return function postStory(attachments, callback) {
    var resolveFunc = function() {};
    var rejectFunc = function() {};

    var returnPromise = new Promise(function(resolve, reject) {
      resolveFunc = resolve;
      rejectFunc = reject;
    });

    if (!callback) {
      callback = function(err, data) {
        if (err) return rejectFunc(err);
        resolveFunc(data);
      };
    }

    // Upload media trước
    uploadStoryMedia(attachments, function(err, media) {
      if (err) return callback(err);

      // Form data để tạo story
      var form = {
        video_waterfall_id: Math.floor(Math.random() * 1000000000),
        video_id: "",
        visual_clips: JSON.stringify({
          clips: [{
            video_url: media[0],
            playback_duration_ms: 0
          }]
        }),
        container_type: "STORY",
        story_status_type: "VIDEO",
        privacy_setting: "EVERYONE",
        composer_entry_point: "inline_composer",
        composer_type: "story",
        logging: {source: "WWW"},
        source: "WWW",
        audiences: {
          privacy: {
            tag: "EVERYONE",
            allow: [],
            deny: []  
          }
        },
        actor_id: ctx.userID,
        client_mutation_id: Math.floor(Math.random() * 17)
      };

      defaultFuncs
        .post("https://www.facebook.com/api/graphql/", ctx.jar, {
          doc_id: "5486218168088865",
          variables: JSON.stringify({input: form}),
          fb_api_req_friendly_name: "StoriesCreateMutation"
        })
        .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
        .then(function(resData) {
          if (resData.error) throw resData;
          return callback(null, resData);
        })
        .catch(function(err) {
          log.error("createStory", err);
          return callback(err);
        });

    });

    return returnPromise;
  };
};