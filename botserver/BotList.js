"use strict";

const StellarSdk = require('stellar-sdk');
const BotInstance = require('./schemas/BotSchema')
const BotFork = require('./BotFork.js');
const Utils = require('../webserver/Utils.js');
const request = require('request');

class BotList {
	constructor() {
		this.bots = {};

		var self = this;
		this.delayedBotStartsTimeout = {};

		//do something when app is closing
		process.on('exit', function(options, exitCode) { self.onExit(options, exitCode); });
		process.on('SIGINT', function(options, exitCode) { self.onExit(options, exitCode); });
		process.on('uncaughtException', function(options, exitCode) { self.onExit(options, exitCode); });

		setInterval(function() { self.getSystemResourceUsage(); }, 10*1000);
	}

	getSystemResourceUsage() {
		var botProccessCount = 0;

		for(var ID in this.bots) {
			this.bots[ID].getSystemResourceUsage();

			botProccessCount++;
		}

		request.post(
			{
				uri: 'http://localhost:3000/api/botserver/update',
				form: {
					botProccessCount: botProccessCount
				},
				json: true
			},
			(err, res, body) => {
				if (err) { 
					console.log('Error while sending bot statistics, will try later again.'); 
				} else {
				}
			}
		);
	}

	onExit(options, exitCode) {
		console.log(options);

		for(var ID in this.bots) {
			console.log('Stopping bot: ', ID);
			this.bots[ID].stop();
		}

		this.bots = {};

		process.exit();
	}

	async addAndStartBotByRemoteID(remoteID, delayInSeconds, remoteData) {
		let self = this;			
			
		if (this.delayedBotStartsTimeout[remoteID]) {
			clearTimeout(this.delayedBotStartsTimeout[remoteID]);
			this.delayedBotStartsTimeout[remoteID] = null;
		}

		if (this.getBotByID(remoteID)) {
			console.log('[addAndStartBotByRemoteID] Bot is alreay running, send remote data as changes');
			// it's alreay running, send remote data as changes
			if (remoteData)
				this.getBotByID(remoteID).sendRemoteChanges(remoteData);

			return true;
		}
	
		if (delayInSeconds > 0) {
			this.delayedBotStartsTimeout[remoteID] = setTimeout(function() { self.addAndStartBotByRemoteID(remoteID, 0, remoteData); }, delayInSeconds * 1000);
		} else {
			var botInstance = await BotInstance.findOne({ remoteID: remoteID });
	
			if (!botInstance) {
				botInstance = new BotInstance({remoteID: remoteID})
				await botInstance.save();
			}

			if (remoteData) {
				for(var key in remoteData) {
					botInstance[key] = remoteData[key];
				}

				await botInstance.save();
			} 
			
			var data = Utils.modelToArray(botInstance);
			data._id = data.remoteID;
	
			if (!this.bots[botInstance.remoteID]) {
				this.bots[botInstance.remoteID] = new BotFork(this, botInstance.remoteID);
				this.bots[botInstance.remoteID].start(data);
			} else {
				this.bots[botInstance.remoteID].sendRemoteChanges(data);
			}
		}

		return true;
	}

	getBotByID(ID) {
		return this.bots[ID];
	}

	stopBotByID(botIDToStop) {
		const bot = this.getBotByID(botIDToStop);

		if (bot) {
			bot.stop();
		}

		return false;
	}

	removeBotByID(botIDToStop) {
		var newList = {};
		
		for(var ID in this.bots) {
			if (ID != botIDToStop) {
				newList[ID] = this.bots[ID];
			}
		}

		this.bots = newList;
	}

}

module.exports = BotList;