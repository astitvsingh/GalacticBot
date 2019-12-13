const mongoose = require('mongoose')

const BotSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true
	},
	state: {
		type: String,
		required: true,
		default: 'STOPPED'
	},
	wantedState: {
		type: String,
		required: true,
		default: 'STOPPED'
	},

	liveWalletSecretSent: {
		type: String,
		required: false
	},
	testnetWalletSecretSent: {
		type: String,
		required: false
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
	
	live: {
		type: Boolean,
		required: true,
		default: false
	},
	liveWalletSecret: {
		type: String,
		required: false
	},
	liveWalletPublic: {
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
	testnetWalletSecret: {
		type: String,
		required: false
	},
	testnetWalletPublic: {
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
	interval: {
		type: Number,
		required: false,
		default: 60
	},
	lastRunTimestamp: {
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
	lastChangedOn: {
		type: Number,
		required: true,
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

module.exports = mongoose.model('BotSchema', BotSchema)