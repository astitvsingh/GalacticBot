"use strict";

const { fork } = require('child_process');
const request = require('request');
const StellarSdk = require('stellar-sdk');
const Config = require('../webserver/Config.js');
const Utils = require('../webserver/Utils.js');
const PriceWatcher = require('./PriceWatcher.js');
const pidusage = require('pidusage');
const BotInstance = require('./schemas/BotSchema')
const BotInstanceOffer = require('./schemas/BotOfferSchema')
const BigNumber = require('bignumber.js');
const numeral = require('numeral')

class BotFork {
	constructor(botList, ID) {
		this.botList = botList;
		this.ID = ID;
		this.forkedProcess = null;

		this.queuedChanges = {};
		this.queuedOffers = {};
		this.queuedLogEntries = {};
	}
	
	start(remoteBotData) {
		var self = this;

		this.forkedProcess = fork(__dirname + '/bot/bot.js');

		new PriceWatcher().getInstance().workForBotWithRemoteID(self.ID);
	
		this.forkedProcess.on('exit', (code, signal) => {
			if (code == 128) {
				console.log('Bot is done ...');
				self.forkedProcess = null;
				self.botList.removeBotByID(this.ID);
			} else {
				self.restartWithError('Bot process got interrupted. ' + code  + signal);
			}
		});

		this.forkedProcess.on('message', (msg) => {
			//console.log(msg.type);
			if (msg.type == 'error') {
				self.restartWithError(msg.message);
			} else if (msg.type == 'changes') {
				self.sendChangesToWebserver(msg.changes);
			} else if (msg.type == 'log-entries') {
				self.sendLogEntriesToWebserver(msg.logQueue);
			} else if (msg.type == 'offer-sync') {
				self.sendOfferToWebserver(msg.offer);
			} else if (msg.type == 'horizon-call') {
				self.horizonCall(msg.botInstance, msg.call);
			} /* else if (msg.type == 'log') {
				console.log('['+msg.logType+' ' + self.ID + '] ' + msg.message);
			} */ else {
				console.log('Unhandled message from child', msg);
			}
		});
	
		this.sendToProcess({action: 'initialize', remoteBotData: remoteBotData});

		return true;
	}

	sendLogEntriesToWebserver(logEntries) {
		let self = this;
		let entryCount = 0;

		for(var i in logEntries) {
			var entry = logEntries[i];
			this.queuedLogEntries[entry.referenceID] = entry;

			entryCount++;
		}

		if (entryCount == 0)
			return;

		request.post(
			{
				"rejectUnauthorized": false, // temp to make ssl 'work'
				uri: new Config().getInstance().getWebserverURL() + '/api/bot/' + self.ID + '/remote-log',
				form: {
					demoModePassword: new Config().getInstance().getDemoModePassword(),
					logEntries: this.queuedLogEntries
				},
				json: true
			},
			(err, res, body) => {
				if (err) { 
					console.log('Error while sending bot log, will try later again.'); 
				} else if (res.body && res.body.data) {
					for(var i in res.body.data.receivedEntries) {
						var receivedID = res.body.data.receivedEntries[i];
						var newList = {};

						for(var referenceID in self.queuedLogEntries) {
							if (referenceID != receivedID)
								newList[referenceID] = self.queuedLogEntries[referenceID];
						}

						self.queuedLogEntries = newList;
					}

					self.sendToProcess({action: 'unqueue-log', entries: res.body.data.receivedEntries});
				}
			}
		);
	}

	sendOfferToWebserver(offer) {
		console.log(' ***** sendOfferToWebserver = ');
		
		this.sendChangesToWebserver({}, [offer]);
	}

	sendChangesToWebserver(changes, offers) {
		let self = this;
		var gotAssetPairChanges = false;
		
		if (changes) {
			for(var name in changes) {
				gotAssetPairChanges = gotAssetPairChanges || name.match(/asset/);
							
				this.queuedChanges[name] = changes[name];
			}
		}

		if (gotAssetPairChanges) {
			new PriceWatcher().getInstance().workForBotWithRemoteID(self.ID);
		}

		if (offers)
			for(var i in offers)
				this.queuedOffers[offers[i]._id] = offers[i];

		var changesCount = 0;
		var offersCount = 0;

		var sentChanges = {};
		var sentOffers = {};
		
		for(var i in this.queuedChanges) { changesCount++; sentChanges[i] = this.queuedChanges[i]; }
		for(var i in this.queuedOffers) { offersCount++; sentOffers[i] = this.queuedOffers[i]; }

		if (changesCount == 0 && offersCount == 0)
			return;

		request.post(
			{
				"rejectUnauthorized": false, // temp to make ssl 'work'
				uri: new Config().getInstance().getWebserverURL() + '/api/bot/' + self.ID + '/remote-changes',
				form: {
					demoModePassword: new Config().getInstance().getDemoModePassword(),
					changes: sentChanges,
					offers: sentOffers
				},
				json: true
			},
			(err, res, body) => {
				if (err) { 
					console.log('Error while sending bot changes, will try later again.'); 
				} else {
					//self.sendToProcess({action: 'unqueue-changes', changes: changes});

					var newList = {};

					for(var i in self.queuedChanges) {
						var found = false;

						for(var j in sentChanges) {
							if (i == j && self.queuedChanges[i] == sentChanges[j]) {
								found = true;
							}
						}

						if (!found)
							newList[i] = self.queuedChanges[i];
					}

					self.queuedChanges = newList;

					var newList = {};

					for(var i in self.queuedOffers) {
						var found = false;

						for(var j in sentOffers) {
							if (i == j && self.queuedOffers[i].lastChangedOn == sentOffers[j].lastChangedOn) {
								found = true;
							}
						}

						if (!found)
							newList[i] = self.queuedOffers[i];
					}

					self.queuedOffers = newList;
				}
			}
		);
	}

	sendToProcess(message) {
		if (this.forkedProcess) {
			if (this.forkedProcess.exitCode !== null || this.forkedProcess.channel == null) {
				console.log('Forked bot is gone but we did not get a signal just yet. Can\'t send any messages anymore.');
				this.forkedProcess = null;
				return;
			}

			this.forkedProcess.send(message);
		}
			
	}

	getSystemResourceUsage() {
		let self = this;

		//console.log('self.forkedProcess = ', self.forkedProcess);

		if (!self.forkedProcess)
			return false;

		pidusage(
			self.forkedProcess.pid,
			function (err, stats) {
				self.sendToProcess({action: 'stats-update', stats: stats});
			}
		);

		return true;
	}
		
	assetInfoToAsset = function(type, issuer) {
		issuer = new String(issuer).trim();

		if (type == 'XLM' && issuer.length == 0)
			return new StellarSdk.Asset.native();
		else if (type && issuer)
			return new StellarSdk.Asset(type, issuer);
		
		return null;
	}

	horizonCall(botInstance, call) {
		var self = this;

		let server = new StellarSdk.Server(new Config().getInstance().getHorizonServerURL(call.onLive));
		let publicKey = call.onLive ? botInstance.liveWalletPublic : botInstance.testnetWalletPublic;

		const config = new Config().getInstance();
		const secretString = config.decryptString(call.onLive ? botInstance.liveWalletSecret : botInstance.testnetWalletSecret);
		const networkPassphrase = call.onLive ? StellarSdk.Networks.PUBLIC : StellarSdk.Networks.TESTNET;

		console.log('\n\n ***** TEMP, SECRET = ' + secretString + '\n\n\n');

		// Using the the Utils.assetInfoToAsset will fail for some reason
		// copying the function to this class solved the problem :-P
		let baseAsset = call.onLive ? this.assetInfoToAsset(botInstance.liveBaseassetType, botInstance.liveBaseassetIssuer) : this.assetInfoToAsset(botInstance.testnetBaseassetType, botInstance.testnetBaseassetIssuer);
		let counterAsset = call.onLive ? this.assetInfoToAsset(botInstance.liveCounterassetType, botInstance.liveCounterassetIssuer) : this.assetInfoToAsset(botInstance.testnetCounterassetType, botInstance.testnetCounterassetIssuer);
		const timeout = 0;

		if (call.action == 'create-keypair') {
			let keypair = StellarSdk.Keypair.random();

			const encrypted = config.encryptString(keypair.secret());
			
			self.sendHorizonCallResponse(call.requestID, {public: keypair.publicKey(), secret: encrypted});
		} else if (call.action == 'load-account') {
			server.loadAccount(publicKey).then(function(account) {
				try {
					self.sendHorizonCallResponse(call.requestID, {account: account});
				} catch(e) {
					console.log('e = ', e)
				}
			}).catch(function(error) {
				if (error.response && error.response.status == 404) {

				} else {
					console.log('error = ', error.response);
				}
			});
		} else if (call.action == 'change-trust') {
			server.loadAccount(publicKey).then(async function(account) {
				const fee = await server.fetchBaseFee();
				const builder = new StellarSdk.TransactionBuilder(account, { fee,  networkPassphrase: networkPassphrase });

				let asset = null;

				if (call.data.assetCode == 'XLM')
					asset = new 
					StellarSdk.Asset.native();
				else
					asset = new StellarSdk.Asset(call.data.assetCode, call.data.assetIssuer);
				
				builder.addOperation(StellarSdk.Operation.changeTrust({asset: asset}));
				builder.setTimeout(timeout);
				
				const transaction = builder.build();
				transaction.sign(StellarSdk.Keypair.fromSecret(secretString)); 

				try {
					// todo: do this async and not wait for the result
					const transactionResult = await server.submitTransaction(transaction);
					//console.log(transactionResult);

					self.sendHorizonCallResponse(call.requestID, {success: true});
				} catch (err) {
					// todo: do something with error
					console.error(err);
				}
			});
		} else if (call.action == 'submit-trade' || call.action == 'cancel-trade') {
			server.loadAccount(publicKey).then(async function(account) {
				const fee = await server.fetchBaseFee();
				const builder = new StellarSdk.TransactionBuilder(account, { fee,  networkPassphrase: networkPassphrase });6

				let sellingAsset = null;
				let buyingAsset = null;

				var offerId = call.data.offerID ? call.data.offerID : 0; // updating existing trade
				const cancelOrder = call.action == 'cancel-trade';
				const price = new BigNumber(call.data.price);
				var amount = new BigNumber(call.data.buyAmount);
				amount = numeral(amount.toString()).format('0.0000000')

				const botOffer = null;

				let makeBuyOffer = call.data.type == 'BUY';

				if (makeBuyOffer) {
					sellingAsset = baseAsset;
					buyingAsset = counterAsset;

					const priceInverted = new BigNumber(1).div(price);
				
					console.log(' - offerId = ', offerId);
					console.log(' - buyingAsset = ', buyingAsset.code);
					console.log(' - sellingAsset = ', sellingAsset.code);
					console.log(' - amount = ', amount);
					console.log(' - priceInverted = ', priceInverted.toString());

					builder.addOperation(StellarSdk.Operation.manageBuyOffer({
						selling: sellingAsset,
						buying: buyingAsset,
						buyAmount: cancelOrder ? new String(0) : amount,
						price: priceInverted.toString(),
						offerId: offerId
					}));
				} else {
					sellingAsset = counterAsset;
					buyingAsset = baseAsset;
					
					const priceInverted = new BigNumber(1).div(price);
				
					console.log(' - offerId = ', offerId);
					console.log(' - buyingAsset = ', buyingAsset.code);
					console.log(' - sellingAsset = ', sellingAsset.code);
					console.log(' - amount = ', amount);
					console.log(' - priceInverted = ', priceInverted.toString());

					builder.addOperation(StellarSdk.Operation.manageSellOffer({
						selling: sellingAsset,
						buying: buyingAsset,
						amount: cancelOrder ? new String(0) : amount,
						price: priceInverted.toString(),
						offerId: offerId
					}));
				}

				builder.setTimeout(timeout);
			
				const transaction = builder.build();
				transaction.sign(StellarSdk.Keypair.fromSecret(secretString)); 

				try {
					server.submitTransaction(transaction).then(async function(transactionResult) {
						if (transactionResult) {
							let offer = new BotInstanceOffer({
								remoteID: botInstance.remoteID,
								type: makeBuyOffer ? BotInstanceOffer.TYPE_BUY :  BotInstanceOffer.TYPE_SELL,
								state: BotInstanceOffer.STATE_OPEN,
								baseAsset: Utils.assetToString(baseAsset),
								counterAsset: Utils.assetToString(counterAsset),
								price: price,
								amount: amount,
								hash: transactionResult.hash,
								envelope_xdr: transactionResult.envelope_xdr,
								result_xdr: transactionResult.result_xdr,
								result_meta_xdr: transactionResult.result_meta_xdr,
								offerResults: transactionResult.offerResults
							});
		
							await offer.save();
		
							self.sendHorizonCallResponse(call.requestID, {success: true, offer: offer});
						} else {
							self.sendHorizonCallResponse(call.requestID, {success: false, offer: null});
						}
					}).catch(function(e) {
						self.sendHorizonCallResponse(call.requestID, {success: false, offer: null});

						console.log('Something went wrong.');
						console.log('extras = ', e.response.data.extras);
						console.log(' - offerId = ', offerId);
						console.log(' - buyingAsset = ', buyingAsset.code);
						console.log(' - sellingAsset = ', sellingAsset.code);
						console.log(' - amount = ', amount.toString());
						console.log(' - price = ', price.toString());

					});
					//console.log(transactionResult);

					
				} catch (err) {
					// todo: do something with error
					console.error(err);

					self.sendHorizonCallResponse(call.requestID, {success: false, offer: null});
				}
			});
		} else {
			console.log('*** UNKNOWN HORIZON CALL ***\n\tcall = ', call, '\n\n');
		}
	}

	sendHorizonCallResponse(requestID, response) {
		this.sendToProcess({action: 'horizon-call-response', requestID: requestID, response: response});
	}

	sendRemoteChanges(changes) {
		this.sendToProcess({action: 'remote-changes', changes: changes});
	}

	submitTrade(type, price, buyAmount) {
		this.sendRemoteChanges({
			wantedTradeType: type,
			wantedTradePrice: price,
			wantedTradeBuyAmount: buyAmount,
			wantedTradeState: 'SUBMIT'
		});

		return true;
	}

	cancelOffer(offerID) {
		this.sendRemoteChanges({
			wantedTradeCancelOfferID: offerID,
			wantedTradeState: 'CANCEL',
		});

		return true;
	}

	stop() {
		this.forkedProcess.kill();
		this.botList.removeBotByID(this.ID);

		console.log('Bot stopped normally.');

		return true;
	}

	stopWithError(error) {
		this.forkedProcess.kill();
		this.botList.removeBotByID(this.ID);

		console.log('Bot stopped with error: ' + error);
	}

	async restartWithError(error) {
		this.forkedProcess.kill();
		this.botList.removeBotByID(this.ID);

		console.log('Bot (' + this.ID + ') stopped with error: ' + error);
		console.log('Trying to restart bot after a delay.');

		let botInstance = await BotInstance.findOne({remoteID: this.ID});

		if (botInstance) {
			botInstance.state = 'CRASHED';
			await botInstance.save();

			this.sendChangesToWebserver({state: botInstance.state });
		}

		this.botList.addAndStartBotByRemoteID(this.ID, 10);
	}
}

module.exports = BotFork
