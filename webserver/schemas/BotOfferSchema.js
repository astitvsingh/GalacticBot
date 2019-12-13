const mongoose = require('mongoose')

const BotOfferSchema = new mongoose.Schema({
	botID: {
		type: String,
		required: true
	},
	remoteOfferID: {
		type: String,
		required: true
	},
	offerID: {
		type: String,
		required: false
	},
	type: {
		type: String,
		required: true
	},
	state: {
		type: String,
		required: true
	},
	baseAsset: {
		type: String,
		required: true
	},
	price: {
		type: Number,
		required: true
	},
	counterAsset: {
		type: String,
		required: true
	},
	amount: {
		type: Number,
		required: true
	},
	amountFilled: {
		type: Number,
		required: false,
		default: 0,
	},
	fillPercentage: {
		type: Number,
		required: false,
		default: 0,
	},
	createdOn: {
		type: Number,
		required: true,
		default: 0,
		tags: { type: [Number], index: true }
	},
	lastChangedOn: {
		type: Number,
		required: true,
		default: 0,
		tags: { type: [Number], index: true }
	},
})

BotOfferSchema.pre(
	"save",
	function(next) {
		this.lastChangedOn = new Date().getTime();

		next();
	}
);

BotOfferModel = mongoose.model('BotOfferSchema', BotOfferSchema)

module.exports = BotOfferModel