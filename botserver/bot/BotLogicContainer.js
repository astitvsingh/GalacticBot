const BotLogicVariable = require('./BotLogicVariable.js');
const BotLogicTradeAction = require('./BotLogicTradeAction.js');
const BigNumber = require('bignumber.js');

class BotLogicContainer {
	constructor() {
		this.variables = {};
		this.tradeAction = null;
	}

	run(bot, inputTree, logicTree) {
		this.bot = bot;

		var inputsCode = inputTree.toCode();
		var logicCode = logicTree.toCode();
		var error = false;

		try {
			eval(inputsCode);
		} catch(e) {
			bot.logError('Error while trying to satisfy inputs: ' + e);
			console.log('Code = ', inputsCode);
			error = e;
		}

		console.log(this.toArray());
				
		if (!error) {
			for(var name in this.variables) {
				logicCode = 'var ' + name + ' = this.variables[' + JSON.stringify(name) + ']\n' + logicCode;
			}

			try {
				//console.log('Code = ', logicCode);
				eval(logicCode);
			} catch(e) {
				bot.logError('Error while trying to execute logic: ' + e);
				console.log('Code = ', logicCode);
				error = e;
			}
		}

		console.log(this.toArray());
								
		//this.logicContainer.run(this, this.inputTree, this.logicTree);
	}

	buyAtPrice(price) {
		this.tradeAction = new BotLogicTradeAction(BotLogicTradeAction.TYPE_BUY, price);
	}

	sellAtPrice(price) {
		this.tradeAction = new BotLogicTradeAction(BotLogicTradeAction.TYPE_SELL, price);
	}

	cancelCurrentOpenOffer(price) {
		this.tradeAction = new BotLogicTradeAction(BotLogicTradeAction.TYPE_CANCEL);
	}

	gotMoreBaseThanCounter() {
		const baseAssetBalance = new BigNumber(this.bot.instance.baseAssetBalance);
		const currentPrice = new BigNumber(this.bot.instance.currentPrice);
		const counterAssetBalanceInBase = new BigNumber(this.bot.instance.counterAssetBalance).dividedBy(currentPrice);
		
		return baseAssetBalance >= counterAssetBalanceInBase;
	}

	gotMoreCounterThanBase() {
		return !this.gotMoreBaseThanCounter();
	}

	priceChangeSinceLastBuyPercentage() {
		return  this.bot.priceChangeSinceLastBuyPercentage / 100;
	}

	hasOpenOffer() {
		return this.bot.currentBotInstanceOffer && (this.bot.currentBotInstanceOffer.state == BotOfferModel.STATE_OPEN || this.bot.currentBotInstanceOffer.state == BotOfferModel.STATE_PARTIAL) ? true : false;
	}

	logVerbose(what) {
		this.bot.logVerbose(typeof what == 'object' ? what.value : what);
	}

	logError(what) {
		this.bot.logError(typeof what == 'object' ? what.value : what);
	}

	toArray() {
		var data = {};

		for(var name in this.variables)
			data[name] = this.variables[name].value;
		
		return data;
	}

	setVariable(name, value) {
		name.changeValue(value);
	}

	mathAdd(a, b) {
		a = BotLogicVariable.getFloat(a);
		b = BotLogicVariable.getFloat(b);
		
		return a + b;
	}

	mathMultiply(a, b) {
		a = BotLogicVariable.getFloat(a);
		b = BotLogicVariable.getFloat(b);
		
		return a * b;
	}

	mathSubtract(a, b) {
		a = BotLogicVariable.getFloat(a);
		b = BotLogicVariable.getFloat(b);
		
		return a -  b;
	}

	mathDivide(a, b) {
		a = BotLogicVariable.getFloat(a);
		b = BotLogicVariable.getFloat(b);

		if (b == 0)
			return 0;
		
		return a / b;
	}

	mathMax(a, b) {
		a = BotLogicVariable.getFloat(a);
		b = BotLogicVariable.getFloat(b);
		
		return Math.max(a, b);
	}

	mathMin(a, b) {
		a = BotLogicVariable.getFloat(a);
		b = BotLogicVariable.getFloat(b);
		
		return Math.min(a, b);
	}

	strAppend(a, b) {
		a = BotLogicVariable.getString(a);
		b = BotLogicVariable.getString(b);
		
		return new String(a) + ' ' + new String(b);
	}

	defineVariable_static(name, value) {
		if (!this.variables[name])
			this.variables[name] = new BotLogicVariable(value, BotLogicVariable.TYPE_STATIC);
	}

	defineVariable_const(name, value) {
		this.variables[name] = new BotLogicVariable(value, BotLogicVariable.TYPE_CONST);
	}

	defineVariable_assetPair(name, baseAssetCode, baseAssetIssuer, counterAssetCode, counterAssetIssuer) {
		this.variables[name] = new BotLogicVariable(value, BotLogicVariable.TYPE_ASSET, {
			baseAssetCode: baseAssetCode,
			baseAssetIssuer: baseAssetIssuer,
			counterAssetCode: counterAssetCode,
			counterAssetIssuer: counterAssetIssuer,
		});
	}
}

module.exports = BotLogicContainer;