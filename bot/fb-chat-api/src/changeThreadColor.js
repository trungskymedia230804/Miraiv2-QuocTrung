"use strict";

const utils = require("../utils");
const log = require("npmlog");

module.exports = function (defaultFuncs, api, ctx) {
	function changeThreadColorNoMqtt(color, threadID, callback) {
		let resolveFunc = function () { };
		let rejectFunc = function () { };
		const returnPromise = new Promise(function (resolve, reject) {
			resolveFunc = resolve;
			rejectFunc = reject;
		});
		if (!callback) {
			callback = function (err) {
				if (err) {
					return rejectFunc(err);
				}
				resolveFunc(err);
			};
		}
		if (!isNaN(color)) {
			color = color.toString();
		}
		const validatedColor = color !== null ? color.toLowerCase() : color;
		const form = {
			dpr: 1,
			queries: JSON.stringify({
				o0: {
					doc_id: "1727493033983591",
					query_params: {
						data: {
							actor_id: ctx.i_userID || ctx.userID,
							client_mutation_id: "0",
							source: "SETTINGS",
							theme_id: validatedColor,
							thread_id: threadID
						}
					}
				}
			})
		};
		defaultFuncs
			.post("https://www.facebook.com/api/graphqlbatch/", ctx.jar, form)
			.then(utils.parseAndCheckLogin(ctx, defaultFuncs))
			.then(function (resData) {
				if (resData[resData.length - 1].error_results > 0) {
					throw new utils.CustomError(resData[0].o0.errors);
				}
				return callback();
			})
			.catch(function (err) {
				log.error("changeThreadColor", err);
				return callback(err);
			});
		return returnPromise;
	};
	function changeThreadColorMqtt(color, threadID, callback) {
		if (!ctx.mqttClient) {
			throw new Error("Not connected to MQTT");
		}
		var resolveFunc = function () { };
		var rejectFunc = function () { };
		var returnPromise = new Promise(function (resolve, reject) {
			resolveFunc = resolve;
			rejectFunc = reject;
		});
		if (!callback) {
			callback = function (err, data) {
				if (err) return rejectFunc(err);
				resolveFunc(data);
				data
			};
		}
		let count_req = 0
		var form = JSON.stringify({
			"app_id": "2220391788200892",
			"payload": JSON.stringify({
				epoch_id: utils.generateOfflineThreadingID(),
				tasks: [
					{
						failure_count: null,
						label: '43',
						payload: JSON.stringify({
							"thread_key": threadID,
							"theme_fbid": color,
							"source": null,
							"sync_group": 1,
							"payload": null
						}),
						queue_name: 'thread_theme',
						task_id: Math.random() * 1001 << 0
					}
				],
				version_id: '8798795233522156'
			}),
			"request_id": ++count_req,
			"type": 3
		});
		mqttClient.publish('/ls_req', form);
		return returnPromise;
	};
	return function changeThreadColor(color, threadID, callback) {
		if (ctx.mqttClient) {
			try {
				changeThreadColorMqtt(color, threadID, callback);
			} catch (e) {
				changeThreadColorNoMqtt(color, threadID, callback);
			}
		} else {
			changeThreadColorNoMqtt(color, threadID, callback);
		}
	};
};