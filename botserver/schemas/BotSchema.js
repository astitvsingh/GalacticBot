const mongoose = require('mongoose')
const StellarSdk = require('stellar-sdk');
const Utils = require('../../webserver/Utils.js');

const BotSchema = new mongoose.Schema({
	remoteID: {
		type: mongoose.Schema.Types.ObjectId,
		required: true,
		tags: { type: [mongoose.Schema.Types.ObjectId], index: true }
	},
	name: {
		type: String,
		required: false
	},
	state: {
		type: String,
		required: false,
		default: 'STOPPED'
	},
	wantedState: {
		type: String,
		required: false,
		default: 'STOPPED'
	},

	inputTree: {
		type: String,
		required: false
	},
	logicTree: {
		type: String,
		required: false
	},

	tradeState: {
		type: String,
		required: false
	},
	botInstanceOfferID: {
		type: String,
		required: false
	},
	tradeType: {
		type: String,
		required: false
	},
	tradePrice: {
		type: Number,
		required: false
	},
	tradeBuyAmount: {
		type: Number,
		required: false
	},
	wantedTradeState: {
		type: String,
		required: false
	},
	wantedTradeCancelOfferID: {
		type: String,
		required: false
	},	
	wantedTradeType: {
		type: String,
		required: false
	},
	wantedTradePrice: {
		type: Number,
		required: false
	},
	wantedTradeBuyAmount: {
		type: Number,
		required: false
	},
	
	liveWalletPublic: {
		type: String,
		required: false
	},
	liveWalletSecret: {
		type: String,
		required: false
	},
	liveBaseassetType: {
		type: String,
		required: false
	},
	liveBaseassetIssuer: {
		type: String,
		required: false
	},
	liveCounterassetType: {
		type: String,
		required: false
	},
	liveCounterassetIssuer: {
		type: String,
		required: false
	},
	testnetWalletPublic: {
		type: String,
		required: false
	},
	testnetWalletSecret: {
		type: String,
		required: false
	},
	testnetBaseassetType: {
		type: String,
		required: false
	},
	testnetBaseassetIssuer: {
		type: String,
		required: false
	},
	testnetCounterassetType: {
		type: String,
		required: false
	},
	testnetCounterassetIssuer: {
		type: String,
		required: false
	},
	live: {
		type: Boolean,
		required: false,
		default: false
	},
	interval: {
		type: Number,
		required: false,
		default: 60
	},
	lastRunTimestamp: {
		type: Number,
		required: false
	},
	lastUpdateAccountTimestamp: {
		type: Number,
		required: false
	},
	baseAssetBalance: {
		type: Number,
		required: false,
		default: 0
	},
	counterAssetBalance: {
		type: Number,
		required: false,
		default: 0
	},
	startTotalAssetBalance: {
		type: Number,
		required: false,
		default: 0
	},
	totalAssetBalance: {
		type: Number,
		required: false,
		default: 0
	},
	currentPrice: {
		type: Number,
		required: false
	},
	priceAtStart: {
		type: Number,
		required: false
	},
	currentProfit: {
		type: Number,
		required: false,
		default: 0
	},
	systemResourcesCPUUsage: {
		type: Number,
		required: false,
		default: 0
	},
	systemResourcesMemoryUsage: {
		type: Number,
		required: false,
		default: 0
	},
	lastStreamCursor: {
		type: Number,
		required: false,
	},
	lastChangedOn: {
		type: Number,
		required: false,
		default: 0,
		tags: { type: [Number], index: true }
	}
})

BotSchema.pre(
	"save",
	function(next) {
		this.lastChangedOn = new Date().getTime();

		next();
	}
);

BotModel = mongoose.model('BotSchema', BotSchema)

BotModel.prototype.getBaseAsset = function() {
	return this.live ? Utils.assetInfoToAsset(this.liveBaseassetType, this.liveBaseassetIssuer) : Utils.assetInfoToAsset(this.testnetBaseassetType, this.testnetBaseassetIssuer);
}

BotModel.prototype.getCounterAsset = function() {
	return this.live ? Utils.assetInfoToAsset(this.liveCounterassetType, this.liveCounterassetIssuer) : Utils.assetInfoToAsset(this.testnetCounterassetType, this.testnetCounterassetIssuer);
}

module.exports = BotModel