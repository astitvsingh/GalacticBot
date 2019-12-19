const mongoose = require('mongoose')
const Utils = require('../../webserver/Utils.js');
const StellarSdk = require('stellar-sdk');
const numeral = require('numeral')

const PriceSchema = new mongoose.Schema({
	baseAsset: {
		type: String,
		required: true
	},
	counterAsset: {
		type: String,
		required: true
	},
	price: {
		type: Number,
		required: true
	},
	onLive: {
		type: Boolean,
		required: true,
		tags: { type: [Boolean], index: true }
	},
	date: {
		type: Date,
		required: false,
		default: 0,
		tags: { type: [Number], index: true }
	},
	lastChangedOn: {
		type: Number,
		required: false,
		default: 0,
		tags: { type: [Number], index: true }
	}
})

PriceSchema.pre(
	"save",
	function(next) {
		this.lastChangedOn = new Date().getTime();

		next();
	}
);

PriceModel = mongoose.model('PriceSchema', PriceSchema)

PriceModel.getPriceAtSecondsAgo = async function(onLive, baseAsset, counterAsset, secondsAgo) {
	if (!baseAsset || !counterAsset)
		return null;

	var combo = Utils.getSortedAssetCombo(onLive, baseAsset, counterAsset)
	
	var now = new Date();
	now.setSeconds(0);
	var atTime = now.getTime();
	atTime -= secondsAgo * 1000;

	var price = await PriceModel.findOne({
		baseAsset: Utils.assetToString(combo.firstAsset),
		counterAsset: Utils.assetToString(combo.secondAsset),
		onLive: onLive,
		date: { $lte: atTime },
	}).sort({date: -1});

	if (price) {
		if (baseAsset == combo.firstAsset)
			return price.price;
		else
			return numeral(1/price.price).format('0.0000000');;
	}

	return null;
}

PriceModel.getCurrentPrice = async function(onLive, baseAsset, counterAsset) {
	return this.getPriceAtSecondsAgo(onLive, baseAsset, counterAsset, 0);
}

module.exports = PriceModel