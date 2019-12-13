const BotInstance = require('./schemas/BotSchema')
const Price = require('./schemas/PriceSchema');
const StellarSdk = require('stellar-sdk');
const Config = require('../webserver/Config.js');
const Utils = require('../webserver/Utils.js');
const numeral = require('numeral')
const BotOffer = require('./schemas/BotOfferSchema')
const BigNumber = require('bignumber.js');

class PriceWatcherAssetPair {
	constructor(onLive, baseAsset, counterAsset) {
		this.onLive = onLive;
		this.baseAsset = baseAsset;
		this.counterAsset = counterAsset;
		this.bots = {};
		this.stream = null;
	}

	addBotWithRemoteID(remoteID) {
		this.bots[remoteID] = remoteID;
	}

	removeBotWithRemoteID(remoteID) {
		let newList = {};

		for(var ID in this.bots) {
			if (ID != remoteID) {
				newList[ID] = this.bots[ID];
			}
		}

		this.bots = newList;
	}

	getBotCount() {
		var count = 0;
		for(var i in this.bots)
			count++;

		return count;
	}

	stopStream() {
		if (this.stream) {
			console.log("****** STOPPING STREAM");
			this.stream();
			this.stream = null;
		}
	}

	deductFromList(list, price, amount, invert) {
		var price = invert ? new BigNumber(1).div(price) : new BigNumber(price);
		price = numeral(price.toString()).format('0.0000000');
		var amount = new BigNumber(amount);

		if (invert)
			amount = amount.multipliedBy(price);

		for(var i in list) {
			var offer = list[i];
			var offerPrice = numeral(offer.price).format('0.0000000');

			if (price == offerPrice) {
				var offerAmount = new BigNumber(offer.amount);

				offerAmount = offerAmount.minus(amount);

				list[i].amount = offerAmount.toString();
			}
		}
		return list;
	}

	startStream() {
		const self = this;
		const server = new StellarSdk.Server(new Config().getInstance().getHorizonServerURL(this.onLive));
		this.stream = server.orderbook(this.baseAsset, this.counterAsset)
			.cursor('now')
			.stream({
				onmessage: async function (message) {
				
				if (message) {
					var firstBid = null, firstAsk = null;

					var bids = message.bids, asks = message.asks;
					var bots = await BotInstance.find();

					if (bots) {
						for(var i in bots) {
							const bot = bots[i];
							var currentOffer = bot.botInstanceOfferID ? await BotOffer.findById(bot.botInstanceOfferID) : null;

							if (currentOffer && currentOffer.state == 'OPEN') {

								if (currentOffer.baseAsset == Utils.assetToString(self.baseAsset) && currentOffer.counterAsset == Utils.assetToString(self.counterAsset)) {

									asks = self.deductFromList(asks, currentOffer.price, currentOffer.amount, false);
									bids = self.deductFromList(bids, currentOffer.price, currentOffer.amount, false);
								} if (currentOffer.counterAsset == Utils.assetToString(self.baseAsset) && currentOffer.baseAsset == Utils.assetToString(self.counterAsset)) {

									asks = self.deductFromList(asks, currentOffer.price, currentOffer.amount, true);
									bids = self.deductFromList(bids, currentOffer.price, currentOffer.amount, true);
								}
							}
						}
					}

					while(!firstBid && bids.length) {
						var bid = bids.shift();
						var amount = new BigNumber(bid.amount);

						if (amount.isPositive())
							firstBid = bid;
					}
					
					while(!firstAsk && asks.length) {
						var bid = asks.shift();
						var amount = new BigNumber(bid.amount);

						if (amount.isPositive())
							firstAsk = bid;
					}
					
					if (firstBid && firstAsk) {
						var currentPrice = (parseFloat(firstBid.price) + parseFloat(firstAsk.price))/2;
						currentPrice = numeral(currentPrice).format('0.0000000');
						
						var now = new Date();
						now.setSeconds(0);

						var date = new Date();
						
						var price = await Price.findOne({
							date: date,
							baseAsset: Utils.assetToString(self.baseAsset),
							counterAsset: Utils.assetToString(self.counterAsset),
							onLive: self.onLive
						});

						if (!price) {
							price = new Price({
								date: date,
								baseAsset: Utils.assetToString(self.baseAsset),
								counterAsset: Utils.assetToString(self.counterAsset),
								onLive: self.onLive,
								price: currentPrice,
							});
						} else {
							price.price = currentPrice;
						}

						await price.save();
					}
				}
			}
		})
	}
}

class PriceWatcher {

	constructor() {
		this.assetPairs = {};
	}

	async stopAllForBotWithRemoteID(remoteID) {
		var newList = {};

		for(var i in this.assetPairs) {
			this.assetPairs[i].removeBotWithRemoteID(remoteID);
		}

		this.assetPairs = newList;
	}

	async stopUnusedStreams() {
		var newList = {};

		for(var i in this.assetPairs) {
			if (this.assetPairs[i].getBotCount() > 0) {
				newList[i] = this.assetPairs[i];
			} else {
				this.assetPairs[i].stopStream();
			}
		}

		this.assetPairs = newList;
	}

	async workForBotWithRemoteID(remoteID) {
		this.stopAllForBotWithRemoteID(remoteID);

		let botInstance = await BotInstance.findOne({remoteID: remoteID});

		if (botInstance) {
			if ( botInstance.getBaseAsset() != null &&  botInstance.getBaseAsset() != null) {
				this.watchAssetComboForRemoteID(botInstance.live ? true : false, botInstance.getBaseAsset(), botInstance.getCounterAsset(), remoteID);
			}
		}

		this.stopUnusedStreams();
	}

	watchAssetComboForRemoteID(onLive, baseAsset, counterAsset, remoteID) {
		var assetCombo = Utils.getSortedAssetCombo(onLive, baseAsset, counterAsset);

		console.log('Watching for assetCombo = ', assetCombo.ID);
		console.log('Watching for remoteID = ', remoteID);

		var startStream = false;

		if (!this.assetPairs[assetCombo.ID]) {
			this.assetPairs[assetCombo.ID] = new PriceWatcherAssetPair(
				onLive,
				assetCombo.firstAsset,
				assetCombo.secondAsset,
			);
			
			startStream = true;
		}

		this.assetPairs[assetCombo.ID].addBotWithRemoteID(remoteID);

		if (startStream)
			this.assetPairs[assetCombo.ID].startStream();
	}

}

class Singleton {
	constructor() {
	    if (!Singleton.instance) {
		   Singleton.instance = new PriceWatcher();
	    }
	}
   
	getInstance() {
	    return Singleton.instance;
	}
 }
   
module.exports = Singleton;
