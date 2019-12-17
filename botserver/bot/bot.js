"use strict";

const BotInstance = require('../schemas/BotSchema')
const Price = require('../schemas/PriceSchema')
const AccountInfo = require('../schemas/AccountInfoSchema');
const BotOffer = require('../schemas/BotOfferSchema')
const Utils = require('../../webserver/Utils.js');
const Config = require('../../webserver/Config.js');
const { BotLogic, BotLogicElement} = require('../../webserver/public/js/BotLogic.js');
const StellarSdk = require('../node_modules/stellar-sdk');
const numeral = require('numeral')
const moment = require('moment')
const chalk = require('chalk')
const os = require('os');
const BigNumber = require('bignumber.js');

const BotLogicContainer = require('./BotLogicContainer.js');
const BotLogicTradeAction = require('./BotLogicTradeAction.js');

const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/galacticbot', { useNewUrlParser: true })
const db = mongoose.connection;

db.on('error', function(error) { console.log("Cannot connect to database."); process.exit(); });
db.once('open', () => {
	//console.log('Connected to database.');
})

class Bot {
	constructor() {
		this.resetState();

		var self = this;

		process.on('message', (msg) => {
			if (msg.action == 'initialize') {
				this.logVerbose('Initializing.');

				if (this.loadBot(msg.remoteBotData)) {
					this.logVerbose('Done initializing, ready to start.');
				} else {
					this.logError(`Could not initialize bot.`);
				}
			}  /*else if (msg.action == 'unqueue-changes') {
				var newChanges = {};

				for(var key in msg.changes) {
					var value = msg.changes[key];

					if (self.queuedChanges[key] != value) {
						newChanges[key] = self.queuedChanges[key];
					}
				}

				self.queuedChanges = newChanges;
			}*/ else if (msg.action == 'unqueue-log') {
				self.removeEntriesFromLogQueue(msg.entries);
			} else if (msg.action == 'remote-changes') {
				for(var key in  msg.changes)
					self.remoteChanges[key] = msg.changes[key];
			} else if (msg.action == 'horizon-call-response') {
				self.horizonCallResponse(msg.requestID, msg.response);
			} else if (msg.action == 'stats-update') {
				if (msg.stats) {
					self.changeAsync('systemResourcesCPUUsage', Math.round(100 * msg.stats.cpu)/100);
					self.changeAsync('systemResourcesMemoryUsage', Math.round(100 * 100 * (msg.stats.memory / os.totalmem()))/100);
				}				
			} else {
				this.logError(`Unknown action: '${msg.action}'.`);
			}
		});

		// Start the bot's loop
		this.tick();
	}

	flushLogQueue() {
		if (this.instance && this.logQueue) {
			process.send({type: 'log-entries', logQueue: this.logQueue});
		}
	}

	removeEntriesFromLogQueue(entries) {
		var newList = [];

		for(var j in entries) {
			var referenceID = entries[j];
			var found = false;

			for(var i in this.logQueue) {
				if (this.logQueue[i].referenceID == referenceID) {
					found = true;
				} else {
					
				}
			}

			if (!found) {
				newList.push(this.logQueue[i]);
			}
		}

		this.logQueue = newList;
	}

	resetState() {
		this.firstRun = true;
		this.isCreatingTrustline = false;
		this.isCreatingTrustlineForAsset = null;

		this.botLogic = new BotLogic();
		this.logicContainer = new BotLogicContainer();
		
		this.instance = null;
		this.accountInfo = null;
		this.remoteChanges = {};
		//this.queuedChanges = {};
		this.asyncChanges = {};
		this.horizonCallbacks = [];

		this.queuedTradesToProcess = [];

		this.logQueue = [];
		this.logIDCounter = 0;

		this.offersToSync = [];
	}

	async loadBot(remoteBotDataInput) {
		this.resetState();

		var remoteBotData = {};

		for(var key in remoteBotDataInput)
			if (key != '_id' && key != '__v' && key != 'state')
				remoteBotData[key] = remoteBotDataInput[key]

		remoteBotData["remoteID"] = remoteBotDataInput._id;

		this.instance = await BotInstance.findOne({remoteID: remoteBotData.remoteID});
		
		if (!this.instance || !this.instance._id) {
			this.instance = new BotInstance(remoteBotData);
		} else {
			for(var key in remoteBotData) {
				this.instance[key] = remoteBotData[key];
			}
		}

		//this.instance.state = 'STOPPED';
		//this.log('hier');
		//console.log('this.instance.state = ', this.instance.state);

		await this.instance.save();

		this.reloadLogic();

		return true;
	}

	reloadLogic() {
		if (this.inputTree || this.logicTree)
			this.logVerbose('Inputs or logic changed. Reloading inputs and logic.');

		this.inputTree = BotLogicElement.createFromJSONString(this.botLogic, this.instance.inputTree);

		if (!this.inputTree)
			this.logError('Failed to parse inputs.');

		this.logicTree = BotLogicElement.createFromJSONString(this.botLogic, this.instance.logicTree);

		if (!this.logicTree)
			this.logError('Failed to parse logic.');
	}

	log(type, message) {
		var date = new Date();
		var referenceID = date.getTime() + '-' + (this.logIDCounter++);
		
		var log = moment(date).format('MM/DD/YYYY hh:mm:ss A') + ' ';

		var botName = this.instance ? this.instance.name : '???';
		
		botName = new String(botName).substr(0,16);

		while(botName.length < 16)
			botName += ' ';

		log += ' ' + chalk.black.bgBlue('['+botName+']') + ' ';

		if (type == 'error')
			log += chalk.black.bgRed('['+type.substr(0,1)+']');
		else
			log += chalk.black.bgYellow('['+type.substr(0,1)+']');

		log += ' ' + message;

		console.log(log);

		this.logQueue.push({type: type, message: message, date: date, referenceID: referenceID});

		if (this.logIDCounter >= 1000)
			this.logIDCounter = 0;
	}

	logVerbose(message) {
		this.log('verbose', message);
	}

	logError(message) {
		this.log('error', message);
	}

	logErrorAndStop(message) {
		this.logError(message);
		this.instance.state = 'STOPPED';
		this.instance.wantedState = 'STOPPED';
	}

	horizonCall(action, data, callback) {
		var requestID = this.horizonCallbacks.length;
		this.horizonCallbacks[requestID] = callback;

		process.send({type: 'horizon-call', botInstance: this.instance, call: {requestID: requestID, onLive: this.instance.live, action: action, data: data}});
	}

	horizonCallResponse(requestID, response) {
		this.horizonCallbacks[requestID](response);

		var newList = {};

		for(var i in this.horizonCallbacks)
			if (i != requestID)
				newList[i] = this.horizonCallbacks[i];

		this.horizonCallbacks = newList;
	}

	getHorizonCallBackCount() {
		var count = 0;

		console.log('this.horizonCallbacks = ', this.horizonCallbacks);

		for(var i in this.horizonCallbacks)
			count++;
		
		return count;
	}

	changeAsync(name, value) {
		this.asyncChanges[name] = value;
	}

	createTrustlineForAsset(asset) {
		const self = this;

		this.isCreatingTrustline = true;
		this.isCreatingTrustlineForAsset = asset;

		this.horizonCall(
			'change-trust',
			{
				assetCode: asset.code,
				assetIssuer: asset.issuer
			},
			function(result) {
				if (result && result.success) {
					// force load account again					
					self.accountInfo = null;
					self.triedToLoadAccount = false;

					self.isCreatingTrustline = false;
					self.isCreatingTrustlineForAsset = asset;
				}
			}
		)
	}

	async performFullReset() {
		await BotOfferModel.find({remoteID: this.instance.remoteID, state: BotOfferModel.STATE_CANCELLED}).deleteMany();
		await BotOfferModel.find({remoteID: this.instance.remoteID, state: BotOfferModel.STATE_FILLED}).deleteMany();
		
		this.instance.startTotalAssetBalance = null;

		this.logVerbose('Full reset performed.');
	}

	async tick() {
		var self = this;

		if (this.instance) {
			var remoteChangesCount = 0;

			for(var key in this.remoteChanges)
				remoteChangesCount++;

			if (remoteChangesCount > 0) {
				var remoteChanges = this.remoteChanges;
				this.remoteChanges = {};
				var logicChanged = false;
	
				for(var key in remoteChanges) {
					logicChanged = logicChanged || key == "inputTree" || key == "logicTree";

					if (this.instance[key] != remoteChanges[key]) {
						this.instance[key] = remoteChanges[key];
					}					
				}
				
				await this.instance.save();

				if (logicChanged) {
					this.reloadLogic();
				}
			}
			
			var startData = Utils.modelToArray(this.instance);

			if (this.instance.wantedState != this.instance.state) {
				if (this.instance.wantedState == "RUNNING") {
					await this.performFullReset();
				} 
				
				this.instance.state = this.instance.wantedState;
			}

			var ayncChangesCount = 0;

			for(var key in this.asyncChanges)
			ayncChangesCount++;

			if (ayncChangesCount > 0) {
				var asyncChanges = this.asyncChanges;
				this.asyncChanges = {};
	
				for(var key in asyncChanges) {
					this.instance[key] = asyncChanges[key];
				}

				await this.instance.save();
			}

			if (this.firstRun) {
				this.firstRun = false;

				// force sending current state to webserver
				startData["state"] = null;
			}

			var now = new Date().getTime() / 1000;
			var interval = 5*60;
			var nextUpdateAccountTimestamp = Math.floor(now / interval) * interval;

			if (this.instance.baseAssetBalance == 0 && this.instance.counterAssetBalance == 0)
				interval = 10;

			var nextUpdateAccountDate = new Date(nextUpdateAccountTimestamp * 1000)
			var lastUpdateAccountTimestamp = this.instance.lastUpdateAccountTimestamp;

			let baseAsset = this.instance.live ? Utils.assetInfoToAsset(this.instance.liveBaseassetType, this.instance.liveBaseassetIssuer) : Utils.assetInfoToAsset(this.instance.testnetBaseassetType, this.instance.testnetBaseassetIssuer);
			let counterAsset = this.instance.live ? Utils.assetInfoToAsset(this.instance.liveCounterassetType, this.instance.liveCounterassetIssuer) : Utils.assetInfoToAsset(this.instance.testnetCounterassetType, this.instance.testnetCounterassetIssuer);
			let currentPrice = await Price.getCurrentPrice(this.instance.live, baseAsset, counterAsset);

			if (!this.accountInfo && !this.triedToLoadAccount) {
				// force load account at bot startup
				this.triedToLoadAccount = true;
				lastUpdateAccountTimestamp = null;
			}

			if (!lastUpdateAccountTimestamp || lastUpdateAccountTimestamp < nextUpdateAccountDate.getTime()) {
				this.instance.lastUpdateAccountTimestamp = nextUpdateAccountDate.getTime();

				this.logVerbose('Loading account details from Horizon');
				
				this.horizonCall('load-account', {}, async function(response) {
					if (response && response.account) {
						let dataAttr = {};
						let dataCount = 0;

						for(var k in response.account.data_attr) {
							if (k && response.account.data_attr[k]) {
								dataAttr[k] = response.account.data_attr[k];
								dataCount++;
							}
						}

						let data = {
							publicKey: response.account.account_id,
							sequence: response.account.sequence,
							balances: response.account.balances,
							signers: response.account.signers,
							data: dataCount > 0 ? dataAttr : null,
						}

						self.accountInfo = await AccountInfo.findOne({publicKey: data.publicKey});

						if (!self.accountInfo) {
							self.accountInfo = new AccountInfo(data);
						} else {
							for(var name in data)
							self.accountInfo[name] = data[name];
						}

						await self.accountInfo.save();

						//console.log('self.accountInfo = ', self.accountInfo);

						var baseAssetBalance = self.accountInfo.getBalanceForAsset(baseAsset);
						console.log('baseAssetBalance = ', baseAssetBalance);
						var counterAssetBalance = self.accountInfo.getBalanceForAsset(counterAsset);
						console.log('baseAssetBalance = ', baseAssetBalance);
						var totalAssetBalance = 0;
						console.log('baseAssetBalance = ', baseAssetBalance);
						
						if (currentPrice > 0) {
							var counterAssetHoldingsInBase = (1/currentPrice) * counterAssetBalance;
							totalAssetBalance = baseAssetBalance + counterAssetHoldingsInBase;								
						} else {
							totalAssetBalance = baseAssetBalance;
						}

						totalAssetBalance = numeral(totalAssetBalance).format('0.0000000'); 
						
						console.log('currentPrice = ', currentPrice);
						console.log('baseAssetBalance = ', baseAssetBalance);
						console.log('counterAssetBalance = ', counterAssetBalance);
						console.log('totalAssetBalance = ', totalAssetBalance);
						
						self.changeAsync('baseAssetBalance', baseAssetBalance);
						self.changeAsync('counterAssetBalance', counterAssetBalance);
						self.changeAsync('totalAssetBalance', totalAssetBalance);
					}
				});
			}

			if (!this.currentBotInstanceOffer || (this.currentBotInstanceOffer._id != this.instance.botInstanceOfferID)
			) {
				if (this.instance.botInstanceOfferID) {
					this.logVerbose('Loading current offer details, offerID = ' + this.instance.botInstanceOfferID);
					this.currentBotInstanceOffer = await BotOffer.findById(this.instance.botInstanceOfferID);

					if (!this.currentBotInstanceOffer) {
						this.logVerbose('Invalid offer');
						this.instance.botInstanceOfferID = null;
					}
				} else if (this.currentBotInstanceOffer) {
					this.currentBotInstanceOffer = null;
				}
			}

			for(var i in this.offersToSync)
				await this.syncOffer(this.offersToSync[i]);

			this.offersToSync = [];

			//console.log('this.instance.name = ', this.instance.name, 'this.currentBotInstanceOffer = ', this.currentBotInstanceOffer, 'this.instance.botInstanceOfferID = ', this.instance.botInstanceOfferID);

			if (this.currentBotInstanceOffer) {
				await this.currentBotInstanceOffer.updateFromResults();
				const publicKey = this.instance.live ? this.instance.liveWalletPublic : this.instance.testnetWalletPublic;

				var queue = self.queuedTradesToProcess;
				self.queuedTradesToProcess = [];
						
				for(var i in queue) {
					var toProcess = queue[i];
					var isOurOffer = false;

					if (this.currentBotInstanceOffer.offerID == toProcess.base_offer_id) {
						isOurOffer = true;
					} else if (this.currentBotInstanceOffer.offerID == toProcess.counter_offer_id) {
						isOurOffer = true;
					}

					var trade = null;

					if (isOurOffer && toProcess.base_account == publicKey) {
						trade = {
							sellerId: toProcess.counter_account,
							amountBought: toProcess.base_amount,
							amountSold: toProcess.counter_amount,
							offerId: this.currentBotInstanceOffer.offerID
						};						
					} else if (isOurOffer && toProcess.counter_account == publicKey) {
						trade = {
							sellerId: toProcess.base_account,
							amountBought: toProcess.counter_amount,
							amountSold: toProcess.base_amount,
							offerId: this.currentBotInstanceOffer.offerID
						};						
					} else if (!isOurOffer) {
						self.queuedTradesToProcess.push(toProcess);
					}

					if (trade) {
						await this.currentBotInstanceOffer.parseClaimedOffer(trade);
					}
				}

				if (this.currentBotInstanceOffer.lastSyncOn < this.currentBotInstanceOffer.lastChangedOn) {
					this.logVerbose('Need to sync current offer with web server.');

					this.currentBotInstanceOffer = await this.syncOffer(this.currentBotInstanceOffer);
				}
			}

			this.checkTradeStream();
			
			if (this.instance.state == "STOPPED") {
				if (this.instance.liveWalletSecret == "CREATE") {
					this.logVerbose('Creating live wallet');

					this.instance.liveWalletSecret = "";
					await this.instance.save();

					this.horizonCall('create-keypair', {}, function(response) {
						self.changeAsync('liveWalletPublic', response.public);
						self.changeAsync('liveWalletSecret', response.secret);
					});
				} else if (this.instance.testnetWalletSecret == "CREATE") {
					this.logVerbose('Creating testnet wallet');

					this.instance.testnetWalletSecret = "";
					await this.instance.save();

					this.horizonCall('create-keypair', {}, function(response) {
						self.changeAsync('testnetWalletPublic', response.public);
						self.changeAsync('testnetWalletSecret', response.secret);
					});
				}
			} else if (this.instance.state == "RUNNING") {
				
				if (!baseAsset) {
					this.logErrorAndStop("Base asset is not defined. Set the base asset and start this bot again.");
				} else if (!counterAsset) {
					this.logErrorAndStop("Counter asset is not defined. Set the counter asset and start this bot again.");
				} else if (this.accountInfo && baseAsset && counterAsset) {
					//console.log('baseAsset = ', baseAsset);
					//console.log('counterAsset = ', counterAsset);
					
					if (!this.isCreatingTrustline) {
						if (!this.accountInfo.doesAcceptAsset(baseAsset)) {
							this.logVerbose('The Stellar account associated with this bot does not accept the base asset: ' + baseAsset.code + '. Trying to setup a trustline now.');
							this.createTrustlineForAsset(baseAsset);
						} else if (!this.accountInfo.doesAcceptAsset(counterAsset)) {
							this.logVerbose('The Stellar account associated with this bot does not accept the counter asset: ' + counterAsset.code + '. Trying to setup a trustline now.');
							this.createTrustlineForAsset(counterAsset);
						}
					}
					
				}

				if (		currentPrice
					&&	this.accountInfo
					&&	this.instance.totalAssetBalance > 0
					&&	this.accountInfo.doesAcceptAsset(baseAsset)
					&&	this.accountInfo.doesAcceptAsset(counterAsset)
				) {
					var now = new Date().getTime() / 1000;
					var lastRunTimestamp = this.instance.lastRunTimestamp;
					var interval = this.instance.interval ? this.instance.interval : 60;
					var secondsSinceLastRun = Math.abs(now - lastRunTimestamp);

					if (secondsSinceLastRun >= interval || lastRunTimestamp == undefined) {
						this.instance.lastRunTimestamp = now;

						if (!this.instance.startTotalAssetBalance)
							this.instance.startTotalAssetBalance = this.instance.totalAssetBalance;

						//currentPrice = ', currentPrice, ', baseAssetBalance = ', this.instance.baseAssetBalance, ', counterAssetBalance = ', this.instance.counterAssetBalance);

						if (this.inputTree && this.logicTree) {
							//if (!this.logicContainer.tradeAction) {
								this.logVerbose('Running bot logic.');

								var percentage = 0;
								var lastFilledTrade = await BotOfferModel.find({type: 'BUY', state: BotOfferModel.STATE_FILLED}).sort({createdOn: -1}).limit(1);
								
								if (lastFilledTrade && lastFilledTrade.length == 1) {
									lastFilledTrade = lastFilledTrade.shift();

									var lastPrice = lastFilledTrade.type == 'BUY' ? new BigNumber(1).dividedBy(lastFilledTrade.paidPrice) : new BigNumber(lastFilledTrade.paidPrice);
									
									percentage = parseFloat(lastPrice.dividedBy(currentPrice).multipliedBy(100).toString());
									percentage = percentage - 100;

									console.log('lastFilledTrade.type = ', lastFilledTrade.type);
									console.log('lastFilledTrade.price = ', lastFilledTrade.price);
									console.log('currentPrice = ', currentPrice);
									console.log('percentage = ', percentage);
								}

								this.priceChangeSinceLastBuyPercentage = percentage;

								this.logicContainer.defineVariable_const('currentPrice', currentPrice);
								this.logicContainer.run(this, this.inputTree, this.logicTree);
							//} else {
							//	this.logVerbose('Not running bot logic while where waiting for a horizon call to complete.');
							//}
							
						} else {
							this.logError('Can\'t run with input and/or logic not filled in.');
						}
					}
				}
			}

			if (this.logicContainer.tradeAction) {
				this.instance.wantedTradeState = null;

				if (!this.instance.tradeState)
					this.instance.tradeState = "";

				switch(this.instance.tradeState) {
					case "":
					case "OFFERED":
							var currentOfferType = null;
							const wantedOfferType = this.logicContainer.tradeAction.type;

							if (this.currentBotInstanceOffer && this.currentBotInstanceOffer.type == BotOfferModel.TYPE_BUY)
								currentOfferType = BotLogicTradeAction.TYPE_BUY;
							else if (this.currentBotInstanceOffer && this.currentBotInstanceOffer.type == BotLogicTradeAction.TYPE_SELL)
								currentOfferType = BotLogicTradeAction.TYPE_SELL;
						
							console.log('currentOfferType = ', currentOfferType);
							console.log('wantedOfferType = ', wantedOfferType);
							
							if (currentOfferType && currentOfferType != wantedOfferType) {
								if (this.currentBotInstanceOffer) {
									this.instance.wantedTradeState = "CANCEL";
									this.instance.wantedTradeCancelOfferID = this.currentBotInstanceOffer.offerID;
								}
								
								if (this.logicContainer.tradeAction.type == BotLogicTradeAction.TYPE_CANCEL)
									this.logicContainer.tradeAction = null;
							} else if (wantedOfferType == BotLogicTradeAction.TYPE_CANCEL) {
								if (this.currentBotInstanceOffer) {
									this.instance.wantedTradeState = "CANCEL";
									this.instance.wantedTradeCancelOfferID = this.currentBotInstanceOffer.offerID;
								}
								
								if (this.logicContainer.tradeAction.type == BotLogicTradeAction.TYPE_CANCEL)
									this.logicContainer.tradeAction = null;
							} else if (!currentOfferType || (this.instance.wantedTradePrice != this.logicContainer.tradeAction.price.getFloat())) {
								/*console.log('currentOfferType = ', currentOfferType);
								console.log('this.instance.wantedTradePrice  = ', this.instance.wantedTradePrice );
								console.log('this.logicContainer.tradeAction.price.getFloat() = ',  this.logicContainer.tradeAction.price.getFloat());
								console.log('this.currentBotInstanceOffer.getAgeInSeconds() = ', this.currentBotInstanceOffer.getAgeInSeconds());
								process.exit();*/

								if (this.currentBotInstanceOffer && this.currentBotInstanceOffer.getAgeInSeconds() <= 60) {
									this.logVerbose('Waiting to update current offer (we don\'t want to spam the network).');
								} else if (wantedOfferType == BotLogicTradeAction.TYPE_BUY) {
									const price = new BigNumber(this.logicContainer.tradeAction.price.getFloat());
									const buyAmount = new BigNumber(this.instance.baseAssetBalance).multipliedBy(price);
	
									// create or update a buy offer
									this.instance.wantedTradeState = "SUBMIT";
									this.instance.wantedTradeType = "BUY";
									this.instance.wantedTradePrice =  price;
									this.instance.wantedTradeBuyAmount = buyAmount;
									this.logicContainer.tradeAction = null;
								} else if (wantedOfferType == BotLogicTradeAction.TYPE_SELL) {
									// create or update a buy offer
									this.instance.wantedTradeState = "SUBMIT";
									this.instance.wantedTradeType = "SELL";
									this.instance.wantedTradePrice =  new BigNumber(this.logicContainer.tradeAction.price.getFloat());
									this.instance.wantedTradeBuyAmount =  new BigNumber(this.instance.counterAssetBalance);
									this.logicContainer.tradeAction = null;
								}
							}
						break;
				}
			}
			
			//if (this.instance.tradeState)
			//	console.log('this.instance.tradeState = ', this.instance.tradeState);
			
			//if (this.instance.wantedTradeState)
			//	console.log('this.instance.wantedTradeState = ', this.instance.wantedTradeState);
			
			if (this.instance && (this.instance.tradeState || this.instance.tradeState != this.instance.wantedTradeState)) {
				//console.log('this.currentBotInstanceOffer = ', this.currentBotInstanceOffer);
				
				if (this.instance.wantedTradeState == "CANCEL") {
					//if (this.currentBotInstanceOffer) {
						this.logVerbose('Got to cancel current trade. this.instance.wantedTradeCancelOfferID ' + this.instance.wantedTradeCancelOfferID);

						//if (self.instance.wantedTradeCancelOfferID == this.currentBotInstanceOffer._id) {
							var data = {
								offerID: self.instance.wantedTradeCancelOfferID,
								type: self.instance.wantedTradeType,
								price: self.instance.wantedTradePrice,
								buyAmount: self.instance.wantedTradeBuyAmount,
							};

							this.instance.tradeState = 'CANCELLING';
							this.instance.wantedTradeState = '';

							this.horizonCall(
								'cancel-trade',
								data,
								async function(r) {
									if (self.instance.tradeState == 'CANCELLING') {
										self.logVerbose('Trade got cancelled.');

										self.instance.tradeState = 'CANCEL_CONFIRMED';
									}														
								}
							);
						//}/** else {
						//	this.logError('Trade to cancel isn\'t the current one. Current = ' + this.currentBotInstanceOffer._id + ', trying to cancel: ' + this.instance.wantedTradeCancelOfferID);
						//}**/	
					//} else {
					//	this.instance.tradeState = "CANCEL_CONFIRMED";
					//}		
				}

				console.log('hier ', this.instance.current.botInstanceOfferID);

				switch(this.instance.tradeState) {
					case "":
					case "OFFERED":
							if (this.instance.tradeState == "OFFERED") {
								this.logVerbose('Waiting for offer to fulfill.');

								if (this.currentBotInstanceOffer && this.currentBotInstanceOffer._id == this.instance.botInstanceOfferID && this.currentBotInstanceOffer.state == BotOffer.STATE_FILLED) {
									this.instance.tradeState = '';
									this.logVerbose('Offer got fulfilled and is done.');
								}
							}

							switch(this.instance.wantedTradeState) {
								case "SUBMIT":
										if (this.instance.tradeState == "OFFERED")
											this.logVerbose('Updating a current offering.');
										else
											this.logVerbose('Submit new offer.');

										this.instance.tradeState = 'SUBMITTING';
										this.instance.wantedTradeState = '';
										
										var offerID = null;

										if (self.currentBotInstanceOffer && self.currentBotInstanceOffer.state == 'OPEN')
											offerID = self.currentBotInstanceOffer.offerID;

										this.horizonCall(
											'submit-trade',
											{
												offerID: offerID,
												type: self.instance.wantedTradeType,
												price: self.instance.wantedTradePrice,
												buyAmount: self.instance.wantedTradeBuyAmount,
											},
											function(r) {
												self.instance.tradeState = '';

												if (r && r.success && r.offer)
													self.makeOfferCurrent(r.offer);
											}
										);
									break;
								
							}
						break;

					case "SUBMITTING":
							if (this.getHorizonCallBackCount() == 0) {
								this.logError('Waiting for trade to be submitted but there are no active horizon calls.');
								this.instance.tradeState = '';
							} else {
								this.logVerbose('Waiting for trade to be submitted.');
							}
						break;

					case "CANCELLING":
							if (this.getHorizonCallBackCount() == 0) {
								this.logError('Waiting for trade to be cancelled but there are no active horizon calls.');
								this.instance.tradeState = '';
							} else {
								this.logVerbose('Waiting for trade to be cancelled.');
							}
						break;

					case "CANCEL_CONFIRMED":
							if (self.currentBotInstanceOffer && self.currentBotInstanceOffer.offerID == self.instance.wantedTradeCancelOfferID) {
								self.currentBotInstanceOffer.state = BotOffer.STATE_CANCELLED;
								await self.currentBotInstanceOffer.save();
								
								self.syncOffer(self.currentBotInstanceOffer);

								self.currentBotInstanceOffer = null;
								self.instance.botInstanceOfferID = null;
							} else {
								var offer = await BotOffer.findOne({offerID: self.instance.wantedTradeCancelOfferID});

								if (offer) {
									offer.state = BotOffer.STATE_CANCELLED;
									await offer.save();

									self.syncOffer(offer);
								}
							}

							self.instance.tradeState = '';
						break;
				}
			}

			if (this.instance.startTotalAssetBalance)
				this.instance.currentProfit = Math.round(((this.instance.totalAssetBalance / this.instance.startTotalAssetBalance) - 1) * 100 * 100) / 100;
			else
				this.instance.currentProfit = 0;

			// Check changes
			var currentData = Utils.modelToArray(this.instance);
			var gotChanges = false;

			//startData.state = '';
			var keys = {};
			var changes = {};

			for(var i in startData) { keys[i] = i; }		
			for(var i in currentData) { keys[i] = i; }
		
			for(var i in keys) {
				var start = startData[i];
				var current = currentData[i];

				if (start != current) {
					gotChanges = true;

					console.log('got change to sent: ', i, current);
					
					changes[i] = current;
				}
			}

			if (gotChanges) {
				await this.instance.save();

				//console.log('this.queuedChanges = ', this.queuedChanges);

				process.send({type: 'changes', changes: changes});
			}
		}

		this.flushLogQueue();
	
		var queuedStuff = 0;
		var sleeping = false;

		for(var i in this.queuedChanges) { queuedStuff++; }
		for(var i in this.logQueue) { queuedStuff++; }

		if (
			this.instance
		&&	this.instance.state == 'STOPPED'
		&&	this.instance.wantedState == 'STOPPED'
		&&	!this.instance.tradeState
		&&	queuedStuff == 0
		) {
			sleeping = true;
		}

		/*if (
				this.instance
			&&	this.instance.state == 'STOPPED'
			&&	this.instance.wantedState == 'STOPPED'
			&&	!this.instance.tradeState
			&&	queuedStuff == 0
		) {
			this.logVerbose('Nothing to do. Stopping.');
			this.flushLogQueue();
			
			process.exit(128);
		} else {*/
			var interval = 1000;

			if (this.isCreatingTrustline || sleeping)
				interval *= 5;

			setTimeout(function() { self.tick(); }, interval);
		//}
	}

	async syncOffer(offer) {
		BotOfferModel.updateLastChangedOn = false;

		offer.lastSyncOn = offer.lastChangedOn;
		await offer.save();

		BotOfferModel.updateLastChangedOn = true;

		process.send({type: 'offer-sync', offer: offer});
		
		return offer;
	}

	checkTradeStream() {
		const self = this;
		
		let server = new StellarSdk.Server(new Config().getInstance().getHorizonServerURL(this.instance.live));
		let publicKey = this.instance.live ? this.instance.liveWalletPublic : this.instance.testnetWalletPublic;
		let streamID = publicKey + '-' + (this.instance.live ? 'LIVE' : 'TESTNET');

		if (this.stream) {
			if (streamID == this.streamID) {
				return;
			} else {
				console.log('Stopping stream.');

				// close stream
				this.stream();

				this.stream = null;
			}
		}

		if (!publicKey || !this.instance)
			return;

		console.log('Starting trade stream for account: ' + publicKey);

		this.streamID = streamID;

		console.log(' *** this.instance.lastStreamCursor = ', this.instance.lastStreamCursor);

		this.stream = server.trades()
			.forAccount(publicKey)
			.cursor(this.instance.lastStreamCursor)
			.stream({
				onmessage: async function (message) {
					if (message) {
						self.changeAsync('lastStreamCursor', new Date().getTime());

						console.log('Got a trade update from the stream.');

						self.queuedTradesToProcess.push(message);
					}
				}
			});
	}

	makeOfferCurrent(botInstanceOffer) {
		if (this.currentBotInstanceOffer && this.currentBotInstanceOffer.state == BotOfferModel.STATE_OPEN) {
			this.currentBotInstanceOffer.state = BotOfferModel.STATE_CANCELLED;
			this.currentBotInstanceOffer.save();

			this.offersToSync.push(this.currentBotInstanceOffer);
			
			this.currentBotInstanceOffer = null;
		}

		this.instance.tradeState = 'OFFERED';
		this.instance.botInstanceOfferID = botInstanceOffer._id;
	}

}

const bot = new Bot();
