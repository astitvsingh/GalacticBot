class BotLogicTradeAction {
	constructor(type, price) {
		this.type = type;
		this.price = price;
	}
}

BotLogicTradeAction.TYPE_CANCEL = "TYPE_CANCEL";
BotLogicTradeAction.TYPE_BUY = "TYPE_BUY";
BotLogicTradeAction.TYPE_SELL = "TYPE_SELL";

module.exports = BotLogicTradeAction;