const mongoose = require('mongoose')
const Utils = require('../../webserver/Utils.js');
const StellarSdk = require('stellar-sdk');
const numeral = require('numeral')
const BigNumber = require('bignumber.js');

const AccountInfoSchema = new mongoose.Schema({
	publicKey: {
		type: String,
		required: true
	},
	sequence: {
		type: String,
		required: true
	},
	balances: {
		type: Array,
		required: true
	},
	signers: {
		type: Array,
		required: true
	},
	data: {
		type: Array,
		required: false
	},
	lastChangedOn: {
		type: Number,
		required: false,
		default: 0,
		tags: { type: [Number], index: true }
	}
})

AccountInfoSchema.pre(
	"save",
	function(next) {
		this.lastChangedOn = new Date().getTime();

		next();
	}
);

AccountInfoModel = mongoose.model('AccountInfoSchema', AccountInfoSchema)

AccountInfoModel.prototype.getBalanceForAsset = function(asset, doNotSubtractMiniumReserve) {
	if (!asset)
		return 0;
		
	var balance = new BigNumber(0);
	
	const subtractMiniumReserve = !doNotSubtractMiniumReserve;

	if (this.balances) {
		for(var i in this.balances) {
			var balanceAsset = this.balances[i];
			
			if (balanceAsset.asset_type == 'native' && asset.code == 'XLM' && !asset.issuer) {
				balance = balance.plus(new BigNumber(balanceAsset.balance));

				if (subtractMiniumReserve)
				balance = balance.minus(new BigNumber(this.getMinimumXLMReserve()));
			} else if (balanceAsset.asset_code == asset.code && balanceAsset.asset_issuer == asset.issuer) {
				balance = balance.plus(new BigNumber(balanceAsset.balance));
			} 				
		}
	}

	balance = parseFloat(balance.decimalPlaces(7).toString());

	//process.exit();

	return balance;
}

AccountInfoModel.prototype.getMinimumXLMReserve = function() {
	let minimumXLMReserve = 1;

	// some extra so we can keep submitting transactions to the network
	minimumXLMReserve += 0.5;

	if (this.balances)
		for(var i in this.balances)
			if (this.balances[i].asset_type != 'native')
				minimumXLMReserve += 0.5;

	if (this.signers)
		for(var i in this.signers)
			minimumXLMReserve += 0.5;
		
	if (this.data)
		for(var i in this.data)
			minimumXLMReserve += 0.5;

	return minimumXLMReserve;
}

AccountInfoModel.prototype.doesAcceptAsset = function(asset) {
	if (!asset)
		return false;
	
	if (asset.code == 'XLM' && !asset.issuer)
		return true;

	if (this.balances) {
		for(var i in this.balances) {
			var balanceAsset = this.balances[i];

			if (balanceAsset.asset_code == asset.code && balanceAsset.asset_issuer == asset.issuer) {
				return true;
			}
		}
	}
	
	return false;
}

module.exports = AccountInfoModel