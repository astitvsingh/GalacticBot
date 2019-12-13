class BotLogicVariable {

	constructor(value, type, options) {
		this.value = value;
		this.type = type;
		this.options = options;
	}

	changeValue(value) {
		this.value = value;
	}

	getFloat() {
		return parseFloat(this.value);
	}

	getString() {
		return new String(this.value);
	}
}

BotLogicVariable.getFloat = function(v) {
	console.log('v = ', v);
	
	if (v == null)
		return 0;
	else if (typeof v == 'object' && v.constructor == 'BotLogicVariable')
		return v.getFloat();

	return parseFloat(v);
}

BotLogicVariable.getString = function(v) {
	if (v == null)
		return "";
	else if (typeof v == 'object' && v.constructor == 'BotLogicVariable')
		return v.getString();
	
	return new String(v);
}

BotLogicVariable.TYPE_STATIC = "TYPE_STATIC";
BotLogicVariable.TYPE_CONST = "TYPE_CONST";
BotLogicVariable.TYPE_ASSET = "TYPE_ASSET";

module.exports = BotLogicVariable;