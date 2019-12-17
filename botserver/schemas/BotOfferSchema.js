const mongoose = require('mongoose')
const BigNumber = require('bignumber.js');

const BotOfferSchema = new mongoose.Schema({
	remoteID: {
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
	paidPrice: {
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
	amountSold: {
		type: Number,
		required: false,
		default: 0,
	},	
	fillPercentage: {
		type: Number,
		required: false,
		default: 0,
	},
	hash: {
		type: String,
		required: true
	},
	envelope_xdr: {
		type: String,
		required: true
	},
	result_xdr: {
		type: String,
		required: true
	},
	result_meta_xdr: {
		type: String,
		required: true
	},
	offerResults: {
		type: Array,
		required: true
	},
	parsedClaimedOffers: {
		type: Array,
		required: true
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
	lastSyncOn: {
		type: Number,
		required: false,
		default: 0,
		tags: { type: [Number], index: true }
	},
})

BotOfferSchema.pre(
	"save",
	function(next) {
		if (!this.createdOn)
			this.createdOn = new Date().getTime();
			
		if (BotOfferModel.updateLastChangedOn)
			this.lastChangedOn = new Date().getTime();

		next();
	}
);

BotOfferModel = mongoose.model('BotOfferSchema', BotOfferSchema)

BotOfferModel.updateLastChangedOn = true;

BotOfferModel.TYPE_BUY = "BUY";
BotOfferModel.TYPE_SELL = "SELL";

BotOfferModel.STATE_OPEN = "OPEN";
BotOfferModel.STATE_PARTIAL = "PARTIAL";
BotOfferModel.STATE_CANCELLED = "CANCELLED";
BotOfferModel.STATE_FILLED = "FILLED";

BotOfferModel.prototype.getAgeInSeconds = function() {
	const lastUpdatedOn = this.createdOn;
	const now = new Date().getTime();
	const delta = (now - lastUpdatedOn) / 1000;
	return delta;
}

BotOfferModel.prototype.updateFromResults = async function() {
	if (!this.offerID) {
		for(var i in this.offerResults) {
			var result = this.offerResults[i];
			
			if (result.currentOffer) {
				this.offerID = result.currentOffer.offerId;
				await this.save();
			} else if (result.offersClaimed) {
				for(var i in result.offersClaimed) {
					this.offerID = result.offersClaimed[i].offerId;
					await this.save();
				}
			}
		}

	}

	if (this.state == BotOfferModel.STATE_OPEN || this.state == BotOfferModel.STATE_PARTIAL) {
		for(var i in this.offerResults) {
			var result = this.offerResults[i];	

			if (result.offersClaimed) {
				for(var i in result.offersClaimed) {
					await this.parseClaimedOffer(result.offersClaimed[i]);
				}
			}
		}
	}
	
	//console.log('hier = ', this.offerResults);
}

BotOfferModel.prototype.updateFillState = async function() {
	if (this.state == BotOfferModel.STATE_FILLED)
		return;

	var amountBought = new BigNumber(0);
	var amountSold = new BigNumber(0);
	var paidPrice = new BigNumber(0);
	var amountRemaining = new BigNumber(this.amount);
	var amountTotal = new BigNumber(this.amount);

	for(var i in this.parsedClaimedOffers) {
		var offer = this.parsedClaimedOffers[i];
		var buyAmount = new BigNumber(this.type == BotOfferModel.TYPE_BUY ? offer.amountSold : offer.amountBought);
		var sellAmount = new BigNumber(this.type == BotOfferModel.TYPE_BUY ? offer.amountBought : offer.amountSold);

		console.log('buyAmount = ', buyAmount.toString());
		console.log('sellAmount = ', sellAmount.toString());

		amountBought = amountBought.plus(buyAmount);
		amountRemaining = amountRemaining.minus(buyAmount);

		amountSold = amountSold.plus(sellAmount);
	}

	var fillPercentage = amountBought.isZero() ? new BigNumber(0) : amountTotal.div(amountBought);
	fillPercentage = Math.round(100*100*fillPercentage)/100;

	if (!amountSold.isZero())
		paidPrice = amountBought.div(amountSold);

	console.log('amountBought = ', amountBought.toString());
	console.log('amountRemaining = ', amountRemaining.toString());	
	console.log('fillPercentage = ', fillPercentage);	
	console.log('paidPrice = ', paidPrice.toString());	

	this.amountFilled = amountBought.toString();
	this.amountSold = amountSold.toString();
	this.paidPrice = paidPrice.toString();
	this.fillPercentage = fillPercentage;

	if (this.type == 'SELL') {
		//console.log('sell checken ...');
	}

	if (this.fillPercentage >= 100.1) {
		console.log('Todo: check if we calculated the fill percentage correctly ...');
	} else if (this.fillPercentage == 100) {
		this.state = BotOfferModel.STATE_FILLED;
		await this.save();
	} else if (this.fillPercentage > 0) {
		this.state = BotOfferModel.STATE_PARTIAL;
		await this.save();
	}
}

BotOfferModel.prototype.parseClaimedOffer = async function(claimedOffer) {
	claimedOffer.localID = claimedOffer.sellerId + '_' + claimedOffer.offerId + '_' + (claimedOffer.amountBought ? claimedOffer.amountBought : claimedOffer.amountSold);

	var isNewOffer = true;

	for(var i in this.parsedClaimedOffers) {
		if (this.parsedClaimedOffers[i].localID == claimedOffer.localID) {
			isNewOffer = false;
		}
	}

	if (isNewOffer) {
		this.parsedClaimedOffers.push(claimedOffer);
		await this.save();
	}

	await this.updateFillState();
}

/*
BotOfferModel.log = async function(remoteID, date, type, message) {
	try {
		var o = new BotLogModel({
			remoteID: remoteID,
			type: type,
			message: message,
			date: date
		});
	
		await o.save();

		//console.log("Logged: ", o)
	} catch(e) {
		console.log("Error while saving log entry.", e)
	}
	
}
*/

module.exports = BotOfferModel