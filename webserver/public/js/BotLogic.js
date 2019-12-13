
function arrayRemove(arr, value) {
	return arr.filter(function(ele){
		return ele != value;c
	});
}

if (typeof module != 'undefined') {
	function $() { return new fakeQuery(); }

	function fakeQuery() {}
	fakeQuery.prototype.appendTo = function() {return this;}
	fakeQuery.prototype.remove = function() {return this;}
	fakeQuery.prototype.find = function() {return this;}
	fakeQuery.prototype.val = function(v) { if (v == undefined) { return this.value; } else { this.value = v; return this; }}
	fakeQuery.prototype.attr = function() {return this;}
	fakeQuery.prototype.data = function() {return this;}
	fakeQuery.prototype.first = function() {return this;}
	fakeQuery.prototype.bind = function() {return this;}
	fakeQuery.prototype.focus = function() {return this;}
	fakeQuery.prototype.blur = function() {return this;}
	fakeQuery.prototype.change = function() {return this;}
	fakeQuery.prototype.text = function() {return this;}
	fakeQuery.prototype.html = function() {return this;}
	fakeQuery.prototype.css = function() {return this;}
	fakeQuery.prototype.show = function() {return this;}
	fakeQuery.prototype.hide = function() {return this;}
	fakeQuery.prototype.mouseout = function() {return this;}
	fakeQuery.prototype.mouseover = function() {return this;}
	fakeQuery.prototype.click = function() {return this;}
	fakeQuery.prototype.addClass = function() {return this;}
	fakeQuery.prototype.hasClass = function() {return this;}
	fakeQuery.prototype.removeClass = function() {return this;}
}

function BotLogicArgument(name, type, optional, hint) {
	this.name = name;
	this.type = type;
	this.optional = optional;
	this.hint = hint;
}

class BotLogic {
	constructor(inputsElement, logicElement) {
		this.inputsElement = inputsElement;
		this.logicElement = logicElement;
		this.updateJSONFromChanges = true;
	}

	loadFromJSON(inputString, logicString) {
		this.updateJSONFromChanges = false;

		//console.log('from json - inputString = ', inputString);
		//console.log('from json - logicString = ', logicString);

		if (this.inputRoot) {
			this.inputRoot.destroy();
			delete this.inputRoot;
		}

		if (this.root) {
			this.root.destroy();
			delete this.root;
		}

		this.inputsElement.empty();
		this.logicElement.empty();
				
		this.inputRoot = BotLogicElement.createFromJSONString(this, inputString);
		
		if (!this.inputRoot) {
			this.inputsElement.empty();
			this.inputRoot = new BotLogicElement(this, BotLogic.TYPE_INPUTS_ROOT);
		}		

		this.root = BotLogicElement.createFromJSONString(this, logicString);

		if (!this.root) {
			this.logicElement.empty();
			this.root = new BotLogicElement(this, BotLogic.TYPE_ROOT);
		}

		this.updateJSONFromChanges = true;

		this.onChangeTimed();
	}

	getInputs() {
		if (!this.inputRoot)
			return [];

		var inputElements = this.inputRoot.getDefinedInputs();
		var inputs = {};

		for(var i in inputElements) {
			var inputElement = inputElements[i];
			var name = inputElement.getInputValue();

			inputs[name] = inputElement;
		}

		return inputs;
	}

	onChange() {
		if (!this.updateJSONFromChanges)
			return;

		var self = this;

		clearTimeout(this.onChangeTimer);

		this.onChangeTimer = setTimeout(function() {
			self.onChangeTimed();
		}, 100);
	}

	onChangeTimed() {
		if (!this.updateJSONFromChanges)
			return;

		if (typeof module != 'undefined')
			return;

		$('#bot-inputs-code').val(this.inputRoot.toCode());
		$('#bot-inputs-json').val(JSON.stringify(this.inputRoot.toJson()));

		$('#bot-logic-code').val(this.root.toCode());
		$('#bot-logic-json').val(JSON.stringify(this.root.toJson()));
	}

	getInputJSON() {
		return this.inputRoot.toJson();
	}

	getLogicJSON() {
		return this.root.toJson();
	}

	static defineType(type, ID, label, args, returnType, forInputs) {
		BotLogic.types[ID] = {
			type: type,
			ID: ID,
			label: label,
			arguments: args,
			returnType: returnType,
			forInputs: forInputs
		};
	}
	
	static getTypeByID(ID) {
		return BotLogic.types[ID];
	}
	
}

BotLogic.TYPE_ROOT = "TYPE_ROOT";
BotLogic.TYPE_INPUTS_ROOT = "TYPE_INPUTS_ROOT";

BotLogic.TYPE_EMPTY = "TYPE_EMPTY";

BotLogic.TYPE_IF = "TYPE_IF";
BotLogic.TYPE_ELSE = "TYPE_ELSE";
BotLogic.TYPE_ELSEIF = "TYPE_ELSEIF";
BotLogic.TYPE_AND = "TYPE_AND";
BotLogic.TYPE_OR = "TYPE_OR";

BotLogic.TYPE_E = "TYPE_E";
BotLogic.TYPE_NE = "TYPE_NE";
BotLogic.TYPE_LE = "TYPE_LE";
BotLogic.TYPE_L = "TYPE_L";
BotLogic.TYPE_GE = "TYPE_GE";
BotLogic.TYPE_G = "TYPE_G";

BotLogic.TYPE_DELETE = "TYPE_DELETE";

BotLogic.TYPE_INPUT = "TYPE_INPUT";
BotLogic.TYPE_ARGUMENT = "TYPE_ARGUMENT";
BotLogic.TYPE_VARIABLE = "TYPE_VARIABLE";

BotLogic.TYPE_FUNCTION = "TYPE_FUNCTION";

BotLogic.TYPE_NUMBER = "TYPE_NUMBER";
BotLogic.TYPE_BOOLEAN = "TYPE_BOOLEAN";
BotLogic.TYPE_PERCENTAGE = "TYPE_PERCENTAGE";
BotLogic.TYPE_STRING = "TYPE_STRING";
BotLogic.TYPE_INPUT_NAME = "TYPE_INPUT_NAME";
BotLogic.TYPE_VOID = "TYPE_VOID";

BotLogic.ERROR_LEVEL_SELF = 1;
BotLogic.ERROR_LEVEL_SYNTAX = 10;

BotLogic.types = [];

class BotLogicArgumentElement {

	constructor(botLogicElement, info, chosenElement) {
		this.info = info;

		this.botLogicElement = botLogicElement;

		this.element =  $('<div class="logic-element argument"><div class="box argument"><div class="label name"></div></div><div class="value"></div></div>');
		this.element.appendTo(this.botLogicElement.argumentsElement);

		if (typeof info.name == 'object')
			info.name.appendTo(this.element.find('.label.name'));
		else
			this.element.find('.label.name').text(info.name);

		this.valueElement = null;

		this.resetValueElement(chosenElement);
	}

	resetValueElement(withChosenElement) {
		if (this.valueElement) {
			this.valueElement.destroy();
			this.valueElement = null;
		}

		var type = this.info.type ? this.info.type : BotLogic.TYPE_ARGUMENT;

		if (withChosenElement) {
			type = withChosenElement.type;
		}
		
		console.log('withChosenElement = ', withChosenElement);

		if (withChosenElement) {
			//debugger;
		} {
			this.valueElement = new BotLogicElement(this.botLogicElement.botLogic, type);
			this.valueElement.element.appendTo(this.element.find('.value'));
		}
	
		if (this.info.type && this.info.type != BotLogic.TYPE_VARIABLE)
			this.valueElement.disableTypeSelector();

		if (this.info.hint)
			this.valueElement.setHint(this.info.hint);

		this.valueElement.argumentInfo = this.info;

		if (withChosenElement)
			this.valueElement.setInputValue(withChosenElement.inputValue);

		if (withChosenElement)
			this.valueElement.setInputName(withChosenElement.inputName);

		this.valueElement.setParent(this.botLogicElement);
	}

}

class BotLogicElement {
	constructor(botLogic, type, label, args, returnType) {
		var self = this;

		if (botLogic.constructor.name != 'BotLogic')
			debugger;

		this.parent = null;
		this.botLogic = botLogic;
		this.type = type;
		this.label = label || '';
		this.arguments = args;
		this.returnType = returnType;
		this.isFirstInLine = false;
		this.isSibling = false;

		this.functionType = null;
		this.inputName = null;

		this.children = [];
		this.thenElements = [];
		this.siblings = [];
		this.arguments = [];
		this.errorsByLevel = [];

		//$('textarea').hide();

		if (type == BotLogic.TYPE_ROOT) {
			this.element = $('<div class="logic-element"><div class="box"><div class="label name"></div><div class="input"><input type="" /></div><div class="down"><i class="fas fa-angle-down"></i></div></div><div class="arguments"></div><div class="children"></div><div class="then"></div><div class="siblings"></div></div>');
			this.element.appendTo(this.botLogic.logicElement);
		} else if (type == BotLogic.TYPE_INPUTS_ROOT) {
			this.element = $('<div class="logic-element"><div class="box"><div class="label name"></div><div class="input"><input type="" /></div><div class="down"><i class="fas fa-angle-down"></i></div></div><div class="arguments"></div><div class="children"></div><div class="then"></div><div class="siblings"></div></div>');
			this.element.appendTo(this.botLogic.inputsElement);
		} else {
			this.element = $('<div class="logic-element"><div class="box"><div class="error-circle"><i class="fas fa-exclamation-triangle"></i></div><div class="label name"></div><div class="input"><input type="" /></div><div class="down"><i class="fas fa-angle-down"></i></div></div><div class="arguments"></div><div class="children"></div><div class="then"></div><div class="siblings"></div></div>');
		}

		this.childrenElement = this.element.find('.children').first();
		this.thenElement = this.element.find('.then').first();
		this.argumentsElement = this.element.find('.arguments').first();
		this.siblingsElement = this.element.find('.siblings').first();
		this.inputElement = this.element.find('.input').first();

		this.element.addClass(this.type.toLowerCase().replace(/_/sm, '-'));
		this.element.find('.box').addClass(this.type.toLowerCase().replace(/_/sm, '-'));

		this.boxElement = this.element.find('.box');
		this.labelElement = this.element.find('.label.name');
		this.downElement = this.element.find('.down');

		this.inputElement.find('input').focus(function() { self.boxElement.addClass('focus'); console.log('focus') });
		this.inputElement.find('input').blur(function() { self.boxElement.removeClass('focus'); });
		this.inputElement.find('input').change(function() { self.setInputValue($(this).val()); self.onUpdate(); self.validateInput(); });

		this.errorElement = this.element.find('.error-circle');
		this.errorElement.mouseover(function() { self.showError(); });
		this.errorElement.mouseout(function() { self.hideError(); });
	
		this.boxElement.click(function(e){
			if (!$(e.target).is('input'))
				self.showSelectDialog();
		});

		this.mainElement = this.element;

		this.setIsSibling(false);

		if (type == BotLogic.TYPE_ROOT || type == BotLogic.TYPE_INPUTS_ROOT) {
			this.setIsFirstInLine();

			this.boxElement.hide();
			this.thenElement.hide();
			this.childrenElement.hide();
			this.argumentsElement.hide();
		} else {
			this.setIsFirstInLine(false);
		}

		this.validateInput();
	}

	disableTypeSelector() {
		if (this.type == BotLogic.TYPE_INPUT) {
			if (this.isTypeSelectorDisabled) {
				this.isTypeSelectorDisabled = false;
				this.boxElement.removeClass('disabled-type-selector');
			}
 		} else {
			this.isTypeSelectorDisabled = true;
			this.boxElement.addClass('disabled-type-selector');
		}
	}

	setHint(hint) {
		this.inputElement.find('input').attr('placeholder', hint);
	}

	toCode(depthString) {
		var code = '';
		depthString = depthString || '';

		switch(this.type) {
			case BotLogic.TYPE_ROOT:
			case BotLogic.TYPE_INPUTS_ROOT:
				break;

			case BotLogic.TYPE_EMPTY:			/*code = '/* e *'+'/';*/ break;
			
			case BotLogic.TYPE_IF:				code = '\n' + depthString + 'if ('; break;
			case BotLogic.TYPE_ELSEIF:			code = depthString + 'else if ('; break;
			case BotLogic.TYPE_ELSE:				code = depthString + 'else'; break;

			case BotLogic.TYPE_E:				code = '=='; break;
			case BotLogic.TYPE_NE:				code = '!='; break;
			case BotLogic.TYPE_L:				code = '<'; break;
			case BotLogic.TYPE_LE:				code = '<='; break;
			case BotLogic.TYPE_G:				code = '>'; break;
			case BotLogic.TYPE_GE:				code = '>='; break;

			case BotLogic.TYPE_AND:				code = '&&'; break;
			case BotLogic.TYPE_OR:				code = '||'; break;

			case BotLogic.TYPE_STRING:			code = JSON.stringify(this.getInputValue(BotLogic.TYPE_STRING)); break;
			case BotLogic.TYPE_INPUT_NAME:		code = JSON.stringify(this.getInputValue(BotLogic.TYPE_INPUT_NAME)); break;
			case BotLogic.TYPE_NUMBER:			code = JSON.stringify(this.getInputValue(BotLogic.TYPE_NUMBER)); break;
			case BotLogic.TYPE_BOOLEAN:			code = JSON.stringify(this.getInputValue(BotLogic.TYPE_BOOLEAN)); break;
			case BotLogic.TYPE_PERCENTAGE:		code = JSON.stringify(this.getInputValue(BotLogic.TYPE_PERCENTAGE)/100); break;

			case BotLogic.TYPE_INPUT:			code = this.inputName; break;
			
			case BotLogic.TYPE_ARGUMENT:			code = 'null'; break;
			case BotLogic.TYPE_VARIABLE:			code = 'null'; break;

			case BotLogic.TYPE_FUNCTION:			
					code = depthString + 'this.' + (this.functionType ? this.functionType.ID : 'undefined') + '(';
					var count = 0;
					
					for (var i in this.arguments) {
						if (count > 0)
							code += ', ';

						code += this.arguments[i].valueElement.toCode();

						count++;
					}

					code += ')';

					if (this.children.length == 0)
						code += ';';
				break;
			
			default:
				code += depthString + this.type;
				break;
		}

		for(var i in this.children) {
			code += ' ' + this.children[i].toCode();
		}

		switch(this.type) {
			case BotLogic.TYPE_IF:				code += ') {'; break;
			case BotLogic.TYPE_ELSEIF:			code += ') {'; break;
			case BotLogic.TYPE_ELSE:				code += '{'; break;
		}

		for(var i in this.thenElements) {
			code += '\n' + this.thenElements[i].toCode(depthString + '\t');
		}

		switch(this.type) {
			case BotLogic.TYPE_IF:				code += '\n' + depthString + '}'; break;
			case BotLogic.TYPE_ELSEIF:			code += '\n' + depthString +'}'; break;
			case BotLogic.TYPE_ELSE:				code += '\n' + depthString +'}'; break;
		}

		for(var i in this.siblings) {
			code += '\n' + this.siblings[i].toCode(depthString);
		}

		return code;
	}

	destroy() {
		console.log('destroying : ', this.type);

		this.element.remove();
		this.mainElement.remove();

		for(var i in this.arguments) {
			this.arguments[i].valueElement.destroy();
		}

		for(var i in this.children) {
			this.children[i].destroy();
		}

		for(var i in this.siblings) {
			this.siblings[i].destroy();
		}
	}

	toJson() {
		if (this.type == BotLogic.TYPE_EMPTY)
			return null;

		var json = {
			type: this.type,
			label: this.label,
			functionTypeID: this.functionType ? this.functionType.ID : null,
			inputName: this.inputName,
			inputValue: this.getInputValue(),
			arguments: [],
			then: [],
			children: [],
			siblings: []
		};

		for(var i in this.arguments) {
			if (this.arguments[i].valueElement.toJson())
				json.arguments[i] = this.arguments[i].valueElement.toJson();
		}

		for(var i in this.children) {
			if (this.children[i].toJson())
				json.children[i] = this.children[i].toJson();
		}

		for(var i in this.thenElements) {
			if (this.thenElements[i].toJson())
				json.then[i] = this.thenElements[i].toJson();
		}

		for(var i in this.siblings) {
			if (this.siblings[i].toJson())
				json.siblings[i] = this.siblings[i].toJson();
		}

		return json;
	}

	static createFromJSONString(botLogic, jsonString) {
		if (!jsonString)
			return null;
		
		try {
			var info = JSON.parse(jsonString);
			return this.createFromInfo(botLogic, info);
		} catch(e) {
			console.log('Error while parsing json: ', e);
			console.log('jsonString = ', jsonString);
		}

		return null;
	}

	static createFromInfo(botLogic, info) {
		if (!info)
			return null;

		var o = new BotLogicElement(botLogic, info.type, info.label, null, info.returnType);

		if (info.functionTypeID) {
			console.log('van functie: ',info.functionTypeID);
			o.setByDefinitionTypeID(info.functionTypeID, info.arguments);
		}
			
		if (info.inputValue)
			o.setInputValue(info.inputValue);
	
		if (info.inputName)
			o.setInputName(info.inputName);

		//var oldArguments = o.arguments;
		//o.removeArguments();

		for(var i in info.children) {
			var child = this.createFromInfo(botLogic, info.children[i]);

			if (child)
				o.addChild(child);
		}

		for(var i in info.siblings) {
			var sibling = this.createFromInfo(botLogic, info.siblings[i]);
			
			if (sibling)
				o.addSibling(sibling);
		}

		for(var i in info.then) {
			var then = this.createFromInfo(botLogic, info.then[i]);
			
			if (then)
				o.addThen(then);
		}

		for(var i in info.arguments) {
			var argument = this.createFromInfo(botLogic, info.arguments[i]);
			//o.addChild(argument);
			//o.addArgument(new BotLogicArgumentElement(o, oldArguments[i].info, argument)); // hier
			o.arguments[i].valueElement.destroy();

			o.arguments[i].valueElement = argument;
			o.arguments[i].valueElement.element.appendTo(o.arguments[i].element);

			o.arguments[i].valueElement.setParent(o);
		}
	
		return o;
	}

	setIsFirstInLine(visible) {
		this.isFirstInLine = visible == undefined ? true : visible;
		this.onUpdate();
	}

	setIsSibling(isSibling) {
		this.isSibling = isSibling == undefined ? true : isSibling;
		this.onUpdate();
	}

	setParent(parentElement) {
		this.parent = parentElement;
		this.onUpdate();
		this.validateInput();
	}

	getInputValue(castToType) {
		var value = this.inputValue;

		switch(castToType) {
			case BotLogic.TYPE_STRING:
			case BotLogic.TYPE_INPUT_NAME:		break;
			case BotLogic.TYPE_NUMBER:			value = parseFloat(value); break;
			case BotLogic.TYPE_BOOLEAN:			value = value == 'true' || value == '1'; break;
			case BotLogic.TYPE_PERCENTAGE:		value = parseFloat(value); break;
		}

		return value;
	}

	setInputValue(value) {
		this.inputValue = value;
		this.inputElement.find('input').val(value);
		this.validateInput();
	}

	setInputName(value) {
		this.inputName = value;
		this.setLabel(value);
		this.validateInput();
	}

	validateInput() {
		var error = null;
		var required = true;
		var value = this.getInputValue();

		if (this.type == BotLogic.TYPE_INPUT)
			value = this.inputName;

		if (this.parent && this.parent.type == BotLogic.TYPE_FUNCTION) {
			if (this.argumentInfo && this.argumentInfo.optional)
				required = false;
		}

		switch(this.type) {
			case BotLogic.TYPE_NUMBER:
			case BotLogic.TYPE_BOOLEAN:
			case BotLogic.TYPE_PERCENTAGE:
			case BotLogic.TYPE_INPUT_NAME:
			case BotLogic.TYPE_INPUT:
			case BotLogic.TYPE_STRING:
			case BotLogic.TYPE_VARIABLE:
					if (!value && required)
						error = "A value is required for this field.";
				break;
		}

		//console.log('this.type = ', this.type, ' inputName ', this.inputName , ' error = ', error)

		if (!error) {
			switch(this.type) {
				case BotLogic.TYPE_BOOLEAN:
						if (!(value == '0' || value == '1' || value == 'true' || value == 'false')) {
							error = "Invalid boolean value (must be any of: 0, 1, true or false).";
						}							
					break;
			}
		}

		//console.log('error = ', error);

		//this.setErrorOnLevel(BotLogic.ERROR_LEVEL_SYNTAX, 'Syntax error');
		this.setErrorOnLevel(BotLogic.ERROR_LEVEL_SELF, error);
	}

	showError() {
		if (this.errorPopover)
			this.errorPopover.destroy();

		this.errorPopover = new Popover({
			type: Popover.TYPE_TOOLTIP,
			preferedPosition: Popover.PREFERED_POSITION_RIGHT,
			text: this.currentError
		});

		this.errorPopover.showForElement(this.errorElement);
	}

	hideError() {
		if (!this.errorPopover)
			return;

		this.errorPopover.destroy();

		this.errorPopover = null;
	}

	setErrorOnLevel(level, error) {
		if (error)
			this.errorsByLevel[level] = error;
		else if (this.errorsByLevel[level])
			this.errorsByLevel = arrayRemove(this.errorsByLevel, this.errorsByLevel[level]);

		var maxLevel = -1;
		var error = null;

		for(var level in this.errorsByLevel) {
			if (level > maxLevel) {
				maxLevel = level;
				error = this.errorsByLevel[level];
			}
		}

		this.currentError = error;
			
		if (maxLevel != -1) {
			this.boxElement.addClass('got-error');
		} else {
			this.boxElement.removeClass('got-error');
		}
	}

	onUpdate() {
		switch(this.type) {
			case BotLogic.TYPE_IF:
				this.label = 'IF';
			break;
			case BotLogic.TYPE_ELSE:
				this.label = 'ELSE';
			break;
			case BotLogic.TYPE_ELSEIF:
				this.label = 'ELSE IF';
			break;
			case BotLogic.TYPE_AND:
				this.label = 'AND';
			break;
			case BotLogic.TYPE_OR:
				this.label = 'OR';
			break;

			case BotLogic.TYPE_E:
				this.label = 'Equals';
			break;
			case BotLogic.TYPE_NE:
				this.label = 'Not equal to';
			break;
			case BotLogic.TYPE_LE:
				this.label = 'Less or equal to';
			break;
			case BotLogic.TYPE_LE:
				this.label = 'Less or equal to';
			break;
			case BotLogic.TYPE_L:
				this.label = 'Less than';
			break;
			case BotLogic.TYPE_GE:
				this.label = 'Greater or equal than';
			break;
			case BotLogic.TYPE_G:
				this.label = 'Greater than';
			break;

			case BotLogic.TYPE_NUMBER:
				this.label = 'Number:';
			break;
			case BotLogic.TYPE_BOOLEAN:
				this.label = 'Boolean:';
			break;
			case BotLogic.TYPE_PERCENTAGE:
				this.label = 'Percentage:';
			break;
			case BotLogic.TYPE_STRING:
				this.label = 'String:';
			break;
			case BotLogic.TYPE_INPUT_NAME:
				this.label = 'Name:';
			break;
		} 
		
		if (this.boxElement) {
			if (this.isFirstInLine)
				this.boxElement.addClass('first-in-line');
			else
				this.boxElement.removeClass('first-in-line');
		}

		if (this.type == BotLogic.TYPE_EMPTY) {
			this.labelElement.html('<i class="fas fa-plus-circle"></i>');
			this.downElement.hide();
		} else {
			this.labelElement.text(this.label);

			if (!this.isTypeSelectorDisabled)
				this.downElement.show();
		}

		//console.log('');
		//console.log('this.isFirstInLine = ', this.isFirstInLine, 'this.type = ', this.type, 'this.emptySiblingElement = ', this.emptySiblingElement ? this.emptySiblingElement.element.text() : null);

		var shouldHaveEmptySibling = false;

		if (this.type == BotLogic.TYPE_IF /*|| this.type == BotLogic.TYPE_FUNCTION*/) {
			if (this.isFirstInLine) {
				if (this.type == BotLogic.TYPE_FUNCTION && this.isSibling) {
				} else {
					shouldHaveEmptySibling = true;
				}
			}
		}

		if (this.type == BotLogic.TYPE_IF) {
			for(var i in this.siblings) {
				if (this.siblings[i].type == BotLogic.TYPE_ELSE) {
					shouldHaveEmptySibling = false;
				}
			}
		}

		if (this.type == BotLogic.TYPE_ROOT || this.type == BotLogic.TYPE_INPUTS_ROOT) {
			shouldHaveEmptySibling = true;
		}

		if (shouldHaveEmptySibling) {
			if (!this.emptySiblingElement) {
				var emptySiblingElement = new BotLogicElement(this.botLogic, BotLogic.TYPE_EMPTY);
				this.addSibling(emptySiblingElement);
				this.emptySiblingElement = emptySiblingElement;
			}
		} else if (this.emptySiblingElement) {
			this.removeSibling(this.emptySiblingElement);
			this.emptySiblingElement = null;
		}

		var shouldHaveEmptyChild = false;

		if (this.type == BotLogic.TYPE_FUNCTION && this.isFirstInLine) {
			shouldHaveEmptyChild = false;
		} else if (this.type == BotLogic.TYPE_ROOT || this.type == BotLogic.TYPE_INPUTS_ROOT) {
			shouldHaveEmptyChild = false;
		} else if (this.type != BotLogic.TYPE_EMPTY) {
			shouldHaveEmptyChild = true;
		}

		var hasNonEmptyChildren = false;
		for(var i in this.children)
			if (this.children[i].type != BotLogic.TYPE_EMPTY)
				hasNonEmptyChildren = true;

		if (hasNonEmptyChildren)
			shouldHaveEmptyChild = false;

		if (this.type == BotLogic.TYPE_ELSE)
			shouldHaveEmptyChild = false;

		if (shouldHaveEmptyChild && !this.emptyChildrenElement) {
			var emptyElement = new BotLogicElement(this.botLogic, BotLogic.TYPE_EMPTY);
			this.addChild(emptyElement);

			this.emptyChildrenElement = emptyElement;
		} else if (!shouldHaveEmptyChild && this.emptyChildrenElement) {
			this.removeChild(this.emptyChildrenElement);
			this.emptyChildrenElement = null;
		}

		var shouldHaveEmptyThenElement = false;

		if (this.type == BotLogic.TYPE_IF || this.type == BotLogic.TYPE_ELSE || this.type == BotLogic.TYPE_ELSEIF) {
			shouldHaveEmptyThenElement = true;
		}

		if (shouldHaveEmptyThenElement && !this.emptyThenElement) {
			this.emptyThenElement = new BotLogicElement(this.botLogic, BotLogic.TYPE_EMPTY);
			this.addThen(this.emptyThenElement);
		} else if (!shouldHaveEmptyThenElement && this.emptyThenElement) {
			this.removeThen(this.emptyThenElement);
			this.emptyThenElement = null;
		}

		if (this.type == BotLogic.TYPE_NUMBER || this.type == BotLogic.TYPE_BOOLEAN || this.type == BotLogic.TYPE_PERCENTAGE || this.type == BotLogic.TYPE_STRING || this.type == BotLogic.TYPE_INPUT_NAME)
			this.inputElement.addClass('enabled');
		else
			this.inputElement.removeClass('enabled');

		if (this.botLogic)
			this.botLogic.onChange();

		var count = 0;

		for(var i in this.thenElements)
			count++;

		if (count > 0) {
			var newList = [];

			for(var i in this.thenElements) {
				var sibling = this.thenElements[i];

				if (sibling.type != BotLogic.TYPE_EMPTY)
					newList.push(sibling);
			}

			for(var i in this.thenElements) {
				var sibling = this.thenElements[i];
				
				if (sibling.type == BotLogic.TYPE_EMPTY) {
					this.addThen(sibling);
					newList.push(sibling);	
				}
			}

			this.thenElements = newList;
		}

		var count = 0;

		for(var i in this.siblings)
			count++;

		if (count > 0) {
			var newList = [];

			for(var i in this.siblings) {
				var sibling = this.siblings[i];

				if (sibling.type != BotLogic.TYPE_EMPTY)
					newList.push(sibling);
			}

			for(var i in this.siblings) {
				var sibling = this.siblings[i];
				
				if (sibling.type == BotLogic.TYPE_EMPTY) {
					this.addSibling(sibling);
					newList.push(sibling);	
				}
			}

			this.siblings = newList;
		}
	}

	onHideSelectDialog() {
		this.boxElement.removeClass('selecting');
	}

	countNonEmptyChildren() {
		var nonEmptyCount = 0;

		for(var i in this.children)
			if (this.children[i].type != BotLogic.TYPE_EMPTY)
				nonEmptyCount++;
		
		return nonEmptyCount;
	}

	getStartOfLine() {
		if (this.isFirstInLine)
			return this;
		
		if (this.parent)
			return this.parent.getStartOfLine();

		return null;
	}

	getDirectChildren() {
		var list = [this];

		for(var i in this.children) {
			var items = this.children[i].getDirectChildren();

			for(var j in items) {
				if (items[j].type != BotLogic.TYPE_EMPTY)
					list.push(items[j]);
			}
		}

		return list;
	}

	getDefinedInputs() {
		var list = [];

		if (this.type == BotLogic.TYPE_INPUT_NAME)
			list.push(this);

		for(var i in this.arguments) {
			var items = this.arguments[i].valueElement.getDefinedInputs();

			for(var j in items) {
				list.push(items[j]);
			}
		}

		for(var i in this.siblings) {
			var items = this.siblings[i].getDefinedInputs();

			for(var j in items) {
				list.push(items[j]);
			}
		}

		return list;
	}

	getFullLine() {
		var startOfLine = this.getStartOfLine();
		var list = startOfLine.getDirectChildren();
		return list;
	}

	isTypeAllowedAsType(type, childType, typeID) {
		var fullLine = this.getFullLine();
		var path = '';

		for(var i in fullLine)
			path += fullLine[i].type + ' ';

		//console.log('I am a: ', this.type, '. Is \'' , childType , '\' allowed as '+type+'? Path: ' + path);

		var typeDefinition = BotLogic.types[typeID];

		if (type == 'CHILD')
			return this.isTypeAllowedAsChild(childType, fullLine, typeDefinition);
		else if (type == 'THEN')
			return this.isTypeAllowedAsThen(childType, fullLine, typeDefinition);
		else if (type == 'SIBLING')
			return this.isTypeAllowedAsSibling(childType, fullLine, typeDefinition);
		else if (type == 'ARGUMENT')
			return this.isTypeAllowedAsArgument(childType, fullLine, typeDefinition);

		console.log('Unknown type: ' + type);

		return false;
	}

	isTypeAllowedAsArgument(childType, fullLine, typeDefinition) {
		if (typeDefinition && this.type == BotLogic.TYPE_FUNCTION && childType == BotLogic.TYPE_FUNCTION) {
			if (typeDefinition.returnType == BotLogic.TYPE_VOID)
				return false;
		}

		switch(this.type) {
			case BotLogic.TYPE_FUNCTION:
					switch(childType) {
						case BotLogic.TYPE_FUNCTION:
						case BotLogic.TYPE_INPUT:
						case BotLogic.TYPE_BOOLEAN:
						case BotLogic.TYPE_NUMBER:
						case BotLogic.TYPE_PERCENTAGE:
						case BotLogic.TYPE_STRING:
						case BotLogic.TYPE_INPUT_NAME:
							return true;
					}
				break;
		}

		return false;
	}

	isTypeAllowedAsSibling(childType, fullLine, typeDefinition) {
		switch(this.type) {
			case BotLogic.TYPE_ROOT:
					switch(childType) {
						case BotLogic.TYPE_IF:
						case BotLogic.TYPE_FUNCTION:
							return true;
					}
				break;
			case BotLogic.TYPE_INPUTS_ROOT:
					switch(childType) {
						case BotLogic.TYPE_FUNCTION:
							return true;
					}
				break;
			case BotLogic.TYPE_IF:
					switch(childType) {
						case BotLogic.TYPE_ELSE:
						case BotLogic.TYPE_ELSEIF:
							return true;
					}
				break;
		}

		return false;
	}

	isTypeAllowedAsThen(childType, fullLine, typeDefinition) {
		switch(this.type) {
			case BotLogic.TYPE_IF:
			case BotLogic.TYPE_ELSE:
			case BotLogic.TYPE_ELSEIF:
					switch(childType) {
						case BotLogic.TYPE_IF:
						case BotLogic.TYPE_FUNCTION:
							return true;
					}
				break;
		}

		return false;
	}

	lineContainsType(line, type) {
		for(var i in line) {
			if (line[i].type == type) {
				return true;
			}
		}

		return false;
	}

	isTypeAllowedAsChild(childType, fullLine, typeDefinition) {
		if (typeDefinition && childType == BotLogic.TYPE_FUNCTION) {
			if (typeDefinition.returnType == BotLogic.TYPE_VOID)
				return false;
		}

		switch(childType) {
			case BotLogic.TYPE_OR:
					if (this.lineContainsType(fullLine, BotLogic.TYPE_AND))
						return false;
				break;
			case BotLogic.TYPE_AND:
					if (this.lineContainsType(fullLine, BotLogic.TYPE_OR))
						return false;
				break;
		}

		switch(this.type) {
			case BotLogic.TYPE_FUNCTION:
			case BotLogic.TYPE_INPUT:
			case BotLogic.TYPE_BOOLEAN:
			case BotLogic.TYPE_NUMBER:
			case BotLogic.TYPE_PERCENTAGE:
			case BotLogic.TYPE_STRING:
			case BotLogic.TYPE_INPUT_NAME:
					switch(childType) {
						case BotLogic.TYPE_E:
						case BotLogic.TYPE_NE:
						case BotLogic.TYPE_LE:
						case BotLogic.TYPE_L:
						case BotLogic.TYPE_GE:
						case BotLogic.TYPE_G:

						case BotLogic.TYPE_OR:
						case BotLogic.TYPE_AND:
							return true;
					}
				break;

			case BotLogic.TYPE_ROOT:
					switch(childType) {
						case BotLogic.TYPE_FUNCTION:
						case BotLogic.TYPE_IF:
							return true;	
					}
				break;

			case BotLogic.TYPE_INPUTS_ROOT:
					switch(childType) {
						case BotLogic.TYPE_FUNCTION:
							return true;	
					}
				break;

			case BotLogic.TYPE_IF:
			case BotLogic.TYPE_ELSEIF:
			case BotLogic.TYPE_E:
			case BotLogic.TYPE_NE:
			case BotLogic.TYPE_LE:
			case BotLogic.TYPE_L:
			case BotLogic.TYPE_GE:
			case BotLogic.TYPE_G:

			case BotLogic.TYPE_OR:
			case BotLogic.TYPE_AND:
					switch(childType) {
						case BotLogic.TYPE_FUNCTION:
						case BotLogic.TYPE_INPUT:
						case BotLogic.TYPE_BOOLEAN:
						case BotLogic.TYPE_NUMBER:
						case BotLogic.TYPE_PERCENTAGE:
						case BotLogic.TYPE_STRING:
						case BotLogic.TYPE_INPUT_NAME:
							return true;	
					}
				break;
		}

		return false;
	}

	isThenChild(element) {
		for(var i in this.thenElements)
			if (this.thenElements[i] == element)
				return true;

		return false;
	}

	isSiblingChild(element) {
		for(var i in this.siblings)
			if (this.siblings[i] == element)
				return true;

		return false;
	}

	isArgumentChild(element) {
		for(var i in this.arguments) {
			if (this.arguments[i].valueElement == element) {
				return true;
			}
		}

		return false;
	}

	getRoot() {
		if (this.type == BotLogic.TYPE_ROOT || this.type == BotLogic.TYPE_INPUTS_ROOT)
			return this;
		else if (this.parent)
			return this.parent.getRoot();

		return null;
	}

	showSelectDialog() {
		if (this.isTypeSelectorDisabled)
			return;

		var self = this;

		this.boxElement.addClass('selecting');

		var p = new Popover({
			type: Popover.TYPE_MENU,
			preferedPosition: Popover.PREFERED_POSITION_RIGHT,
			showSelectionIcon: false,
			onHideCallback: function() { self.onHideSelectDialog(); },
			size: Popover.SIZE_SMALL
		});

		if (!(this.type == BotLogic.TYPE_EMPTY || this.type == BotLogic.TYPE_ARGUMENT))
			p.addOption(BotLogic.TYPE_DELETE, $('<span><i class="fas fa-times-circle"></i>&nbsp;&nbsp;Delete this element</span>'), false, { depth: 0 });

		var addAs = 'CHILD';

		if (this.parent.isThenChild(this))
			addAs = 'THEN';
		else if (this.parent.isSiblingChild(this))
			addAs = 'SIBLING';
		else if (this.parent.isArgumentChild(this))
			addAs = 'ARGUMENT';

		console.log('addAs: ', addAs);

		var ifAllowed = this.parent.isTypeAllowedAsType(addAs, BotLogic.TYPE_IF);
		var elseAllowed = this.parent.isTypeAllowedAsType(addAs, BotLogic.TYPE_ELSE);
		var elseIfAllowed = this.parent.isTypeAllowedAsType(addAs, BotLogic.TYPE_ELSEIF);

		if (ifAllowed || elseAllowed || elseIfAllowed) {
			p.addOption(null, 'Logic', false, { disabled: true });
		}

		if (ifAllowed) {
			p.addOption(BotLogic.TYPE_IF, 'If', false, { depth: 1 });
		}
			
		if (elseAllowed) {
			p.addOption(BotLogic.TYPE_ELSE, 'Else', false, { depth: 1 });
		}
			
		if (elseIfAllowed) {
			p.addOption(BotLogic.TYPE_ELSEIF, 'Else if', false, { depth: 1 });
		}
			
		if (this.parent.isTypeAllowedAsType(addAs, BotLogic.TYPE_AND) || this.parent.isTypeAllowedAsType(addAs, BotLogic.TYPE_OR)) {
			p.addOption(null, 'Logic', false, { disabled: true });

			if (this.parent.isTypeAllowedAsType(addAs, BotLogic.TYPE_AND))
				p.addOption(BotLogic.TYPE_AND, 'And', false, { depth: 1 });

			if (this.parent.isTypeAllowedAsType(addAs, BotLogic.TYPE_OR))
				p.addOption(BotLogic.TYPE_OR, 'Or', false, { depth: 1 });
		}

		var inputs = this.botLogic.getInputs();
		var inputCount = 0;

		for(var i in inputs) { inputCount++; }

		if (this.parent.isTypeAllowedAsType(addAs, BotLogic.TYPE_INPUT)) {
			p.addOption(null, 'Inputs', false, { disabled: true });

			p.addOption(BotLogic.TYPE_INPUT + '_' + 'currentPrice', 'currentPrice', false, { depth: 1 });

			for(var name in inputs)
				p.addOption(BotLogic.TYPE_INPUT + '_' + name, name, false, { depth: 1 });
			
		}

		if (this.parent.isTypeAllowedAsType(addAs, BotLogic.TYPE_NUMBER)) {
			p.addOption(null, 'Values', false, { disabled: true });

			p.addOption(BotLogic.TYPE_NUMBER, 'Number', false, { depth: 1 });
			p.addOption(BotLogic.TYPE_BOOLEAN, 'Boolean', false, { depth: 1 });
			p.addOption(BotLogic.TYPE_PERCENTAGE, 'Percentage', false, { depth: 1 });
			p.addOption(BotLogic.TYPE_STRING, 'String', false, { depth: 1 });
		}

		var functions = [];

		for(var ID in BotLogic.types) {
			if (BotLogic.types[ID].type == BotLogic.TYPE_FUNCTION) {
				if (this.parent.isTypeAllowedAsType(addAs, BotLogic.TYPE_FUNCTION, ID)) {
					if (this.getRoot().type == BotLogic.TYPE_ROOT && !BotLogic.types[ID].forInputs) {
						functions.push({
							ID: BotLogic.TYPE_FUNCTION + '_' + ID,
							label: BotLogic.types[ID].label
						});					
					}						
					else if (this.getRoot().type == BotLogic.TYPE_INPUTS_ROOT && BotLogic.types[ID].forInputs) {
						functions.push({
							ID: BotLogic.TYPE_FUNCTION + '_' + ID,
							label: BotLogic.types[ID].label
						});
					}
				}				
			}
		}
		
		if (functions.length > 0) {
			p.addOption(null, 'Functions', false, { disabled: true });

			for(var i in functions) {				
				p.addOption(functions[i].ID, functions[i].label, false, { depth: 1 });
			}
		}
		
		if (this.parent.isTypeAllowedAsType(addAs, BotLogic.TYPE_E)) {
			p.addOption(null, 'Comparators', false, { disabled: true });
		
			p.addOption(BotLogic.TYPE_E, 'Equals to', false, { depth: 1 });
			p.addOption(BotLogic.TYPE_NE, 'Not equal to', false, { depth: 1 });
			p.addOption(BotLogic.TYPE_L, 'Less than', false, { depth: 1 });
			p.addOption(BotLogic.TYPE_LE, 'Less than or equal to', false, { depth: 1 });
			p.addOption(BotLogic.TYPE_G, 'Greater than', false, { depth: 1 });
			p.addOption(BotLogic.TYPE_GE, 'Greater than or equal to', false, { depth: 1 });
		}
		
		p.setOptionSelectCallback(function(optionID) {
			p.hide();

			self.onHideSelectDialog();

			if (self.parent) {
				var newType = optionID;
				var functionID = null;
				var inputName = null;

				if (optionID.match(new RegExp(BotLogic.TYPE_FUNCTION, 'smg'))) {
					functionID = optionID.replace(new RegExp(BotLogic.TYPE_FUNCTION + '_', 'smg'), '');
					newType = BotLogic.TYPE_FUNCTION;
				} else if (optionID.match(new RegExp(BotLogic.TYPE_INPUT, 'smg'))) {
					inputName = optionID.replace(new RegExp(BotLogic.TYPE_INPUT + '_', 'smg'), '');
					newType = BotLogic.TYPE_INPUT;
				}

				if (optionID == BotLogic.TYPE_DELETE) {
					if (self.parent.isArgumentChild(self))
						self.parent.resetArgument(self);
					else if (self.parent.isSiblingChild(self)) {
						self.parent.removeSibling(self);
					} else if (self.parent.isThenChild(self)) {
						self.parent.removeThen(self);
					} else {
						self.parent.removeChild(self);
						
					}

					self.parent.onUpdate();
				} else if (self.type == BotLogic.TYPE_EMPTY) {
					var newElement = null;

					if (functionID) {
						newElement = BotLogicElement.newForDefinitionTypeID(self.botLogic, functionID);
					} else {
						newElement = new BotLogicElement(self.botLogic, newType);

						if (newType == BotLogic.TYPE_INPUT) {
							newElement.inputName = inputName;
							newElement.setLabel(inputName);
							newElement.validateInput();
						}					
					}

					if (addAs == 'CHILD')
						self.parent.addChild(newElement);
					else if (addAs == 'THEN')
						self.parent.addThen(newElement);
					else if (addAs == 'SIBLING')
						self.parent.addSibling(newElement);
					
				} else {
					self.changeTo(newType, functionID, inputName);
				}

				self.parent.onUpdate();
			}
		});

		p.showForElement(this.boxElement);
	}

	changeTo(typeID, functionID, inputName) {
		this.element.first().removeClass(this.type.toLowerCase().replace(/_/sm, '-'));
		this.boxElement.removeClass(this.type.toLowerCase().replace(/_/sm, '-'));

		for(var i in this.arguments)
			this.arguments[i].element.remove();
		
		this.arguments = [];

		this.type = typeID;

		this.element.first().addClass(this.type.toLowerCase().replace(/_/sm, '-'));
		this.boxElement.addClass(this.type.toLowerCase().replace(/_/sm, '-'));

		if (functionID)
			this.setByDefinitionTypeID(functionID);

		if (inputName) {
			this.inputName = inputName;
			this.setLabel(inputName);
		}

		this.onUpdate();
		this.validateInput();
	}
	
	setLabel(label) {
		if (label == 'currentPrice') {
			label = 'currentPrice of 1 {base} in {counter}';
		}
		label = new String(label).replace(/\{base\}/smg, this.botLogic.baseAsset);
		label = new String(label).replace(/\{counter\}/smg, this.botLogic.counterAsset);
		this.label = label;
		this.onUpdate();
	}

	remove() {
		this.element.remove();

		this.removeChildren();
	}

	removeChildren() {
		for(var i in this.children)
			this.children[i].remove();

		this.children = [];

		this.onUpdate();
	}

	isChild(element) {
		for(var i in this.children)
			if (this.children[i] == element)
				return true;

		return false;
	}

	removeChild(element) {
		element.remove();

		this.children = arrayRemove(this.children, element);
	}

	addChild(element) {
		if (this.type == BotLogic.TYPE_ROOT || this.type == BotLogic.TYPE_INPUTS_ROOT)
			debugger;

		if (this.emptyChildrenElement) {
			this.removeChild(this.emptyChildrenElement);
			this.emptyChildrenElement = null;
		}

		element.element.appendTo(this.childrenElement);
		element.setParent(this);

		if (this.children.length == 0 && (this.type == BotLogic.TYPE_ROOT || this.type == BotLogic.TYPE_INPUTS_ROOT))
			element.setIsFirstInLine(true);

		this.children.push(element);

		return element;
	}

	removeThen(element) {
		element.remove();

		this.thenElements = arrayRemove(this.thenElements, element);
	}
	
	addThen(element) {
		if (element.mainElement && !element.mainElement.hasClass('then-element')) {
			var then = $('<div class="then-element"></div>');
			then.appendTo(this.thenElement);
			element.element.appendTo(then);

			element.mainElement = then;
		} else {
			element.element.appendTo(this.thenElement);
		}		

		this.thenElements.push(element);

		element.setIsFirstInLine();
		element.setParent(this);

		//

		this.thenElement.addClass('visible');
	
		return element;
	}

	removeSibling(element) {
		//element.element.text('weg');
		element.element.remove();

		this.siblings = arrayRemove(this.siblings, element);
	}

	removeSiblings() {
		for(var i in this.siblings)
			this.removeSibling(this.siblings[i]);
	}

	removeEmptySiblings() {
		for(var i in this.siblings)
			if (this.siblings[i].type == BotLogic.TYPE_EMPTY)
				this.removeSibling(this.siblings[i]);
	}

	addSibling(element) {
		if (element == undefined)
			debugger;

		var sibling = $('<div class="sibling"></div>');
		sibling.appendTo(this.siblingsElement);
		element.element.appendTo(sibling);

		element.mainElement = sibling;

		if (this.type == BotLogic.TYPE_ROOT || this.type == BotLogic.TYPE_INPUTS_ROOT)
			element.mainElement.addClass('type-root');

		this.siblings.push(element);

		if (this.emptySiblingElement) {
			this.emptySiblingElement.mainElement.appendTo(this.siblingsElement);
		}

		element.setParent(this);
		element.setIsSibling(true);
		element.setIsFirstInLine(true);

		return element;
	}

	addArgument(argument, chosenElement) {
		var a = new BotLogicArgumentElement(this, argument, chosenElement);
		this.element.addClass('with-arguments');

		this.arguments.push(a);
	}

	resetArgument(argument) {
		for(var i in this.arguments) {
			if (this.arguments[i].valueElement == argument || this.arguments[i] == argument) {
				this.arguments[i].resetValueElement();
			}
		}
	}

	removeArguments() {
		for(var i in this.arguments) {
			this.arguments[i].element.remove();
			this.arguments[i].valueElement.destroy();
		}

		this.arguments = [];
	}

	setByDefinitionTypeID(ID, chosenElements) {
		var type = BotLogic.getTypeByID(ID);

		if (!type) {
			console.log("Invalid definition type ID: " + ID);
		}

		if (type.type == BotLogic.TYPE_FUNCTION) {
			for(var i in type.arguments) {
				var argument = type.arguments[i];
				this.addArgument(argument, chosenElements ? chosenElements[i] : null);
			}
		}

		this.setLabel(type.label);
		this.functionType = type;

		this.onUpdate();
	}

	static newForDefinitionTypeID(botLogic, ID) {
		var type = BotLogic.getTypeByID(ID);

		var element = new BotLogicElement(botLogic, type.type);
		element.setByDefinitionTypeID(ID);
		return element;
	}
}

// Functions for inputs editor

BotLogic.defineType(
	BotLogic.TYPE_FUNCTION,
	"defineVariable_const",
	"Define constant",
	[ new BotLogicArgument("name", BotLogic.TYPE_INPUT_NAME, false), new BotLogicArgument("value", BotLogic.TYPE_VARIABLE, false) ],
	BotLogic.TYPE_VOID,
	true
);

BotLogic.defineType(
	BotLogic.TYPE_FUNCTION,
	"defineVariable_static",
	"Define static variable",
	[ new BotLogicArgument("name", BotLogic.TYPE_INPUT_NAME, false), new BotLogicArgument("initial value", BotLogic.TYPE_VARIABLE, true) ],
	BotLogic.TYPE_VOID,
	true
);

BotLogic.defineType(
	BotLogic.TYPE_FUNCTION,
	"defineVariable_assetPair",
	"Define asset pair variable",
	[
		new BotLogicArgument("name", BotLogic.TYPE_INPUT_NAME, false),
		new BotLogicArgument("Base asset code", BotLogic.TYPE_STRING, false, 'e.g. XLM'),
		new BotLogicArgument("Base asset issuer", BotLogic.TYPE_STRING, false, 'Leave empty for native (XLM)'),
		new BotLogicArgument("Counter asset code", BotLogic.TYPE_STRING, false, 'e.g. SLT'),
		new BotLogicArgument("Counter asset issuer", BotLogic.TYPE_STRING, false, 'Leave empty for native (XLM)')
	],
	BotLogic.TYPE_VOID,
	true
);

// Functions for logic editor

BotLogic.defineType(
	BotLogic.TYPE_FUNCTION,
	"setVariable",
	"Set variable",
	[ new BotLogicArgument("variable", BotLogic.TYPE_INPUT, false), new BotLogicArgument("value", BotLogic.TYPE_VARIABLE, false) ],
	BotLogic.TYPE_VOID
);

BotLogic.defineType(
	BotLogic.TYPE_FUNCTION,
	"mathAdd",
	"Add",
	[ new BotLogicArgument("", BotLogic.TYPE_VARIABLE, false), new BotLogicArgument($('<i class="fas fa-plus"></i>'), BotLogic.TYPE_VARIABLE, false) ],
	BotLogic.TYPE_BOOLEAN
);

BotLogic.defineType(
	BotLogic.TYPE_FUNCTION,
	"mathSubtract",
	"Subtract",
	[ new BotLogicArgument("", BotLogic.TYPE_VARIABLE, false), new BotLogicArgument($('<i class="fas fa-minus"></i>'), BotLogic.TYPE_VARIABLE, false) ],
	BotLogic.TYPE_BOOLEAN
);

BotLogic.defineType(
	BotLogic.TYPE_FUNCTION,
	"mathDivide",
	"Divide",
	[ new BotLogicArgument("", BotLogic.TYPE_VARIABLE, false), new BotLogicArgument($('<i class="fas fa-divide"></i>'), BotLogic.TYPE_VARIABLE, false) ],
	BotLogic.TYPE_BOOLEAN
);

BotLogic.defineType(
	BotLogic.TYPE_FUNCTION,
	"mathMultiply",
	"Multiply",
	[ new BotLogicArgument("", BotLogic.TYPE_VARIABLE, false), new BotLogicArgument($('<i class="fas fa-times"></i>'), BotLogic.TYPE_VARIABLE, false) ],
	BotLogic.TYPE_BOOLEAN
);

BotLogic.defineType(
	BotLogic.TYPE_FUNCTION,
	"mathMax",
	"Max",
	[ new BotLogicArgument("a", BotLogic.TYPE_VARIABLE, false), new BotLogicArgument("b", BotLogic.TYPE_VARIABLE, false) ],
	BotLogic.TYPE_BOOLEAN
);

BotLogic.defineType(
	BotLogic.TYPE_FUNCTION,
	"mathMin",
	"Min",
	[ new BotLogicArgument("a", BotLogic.TYPE_VARIABLE, false), new BotLogicArgument("b", BotLogic.TYPE_VARIABLE, false) ],
	BotLogic.TYPE_BOOLEAN
);

BotLogic.defineType(
	BotLogic.TYPE_FUNCTION,
	"strAppend",
	"String append",
	[ new BotLogicArgument("a", BotLogic.TYPE_VARIABLE, false), new BotLogicArgument("b", BotLogic.TYPE_VARIABLE, false) ],
	BotLogic.TYPE_STRING
);

BotLogic.defineType(
	BotLogic.TYPE_INPUT,
	"current-price",
	"Current price",
	[],
	BotLogic.TYPE_NUMBER
);

BotLogic.defineType(
	BotLogic.TYPE_FUNCTION,
	"gotMoreBaseThanCounter",
	"Got more {base} than {counter}?",
	[],
	BotLogic.TYPE_BOOLEAN
);

BotLogic.defineType(
	BotLogic.TYPE_FUNCTION,
	"gotMoreCounterThanBase",
	"Got more {counter} than {base}?",
	[],
	BotLogic.TYPE_BOOLEAN
);

BotLogic.defineType(
	BotLogic.TYPE_FUNCTION,
	"hasOpenOffer",
	"Got open offer?",
	[],
	BotLogic.TYPE_BOOLEAN
);

BotLogic.defineType(
	BotLogic.TYPE_FUNCTION,
	"priceChangeSinceLastBuyPercentage",
	"Price change since last buy %",
	[],
	BotLogic.TYPE_PERCENTAGE
);

BotLogic.defineType(
	BotLogic.TYPE_FUNCTION,
	"buyAtPrice",
	"Buy offer {counter} at price",
	[ new BotLogicArgument("price", BotLogic.TYPE_VARIABLE, false) ],
	BotLogic.TYPE_VOID
);

BotLogic.defineType(
	BotLogic.TYPE_FUNCTION,
	"sellAtPrice",
	"Sell offer {counter} at price",
	[ new BotLogicArgument("price", BotLogic.TYPE_VARIABLE, false) ],
	BotLogic.TYPE_VOID
);

BotLogic.defineType(
	BotLogic.TYPE_FUNCTION,
	"cancelCurrentOpenOffer",
	"Cancel current open offer",
	[],
	BotLogic.TYPE_VOID
);

BotLogic.defineType(
	BotLogic.TYPE_FUNCTION,
	"logVerbose",
	"Log verbose",
	[ new BotLogicArgument("what", BotLogic.TYPE_VARIABLE, false) ],
	BotLogic.TYPE_VOID
);

BotLogic.defineType(
	BotLogic.TYPE_FUNCTION,
	"logError",
	"Log error",
	[ new BotLogicArgument("what", BotLogic.TYPE_VARIABLE, false) ],
	BotLogic.TYPE_VOID
);

if (typeof module != 'undefined') {
	module.exports = { BotLogic, BotLogicElement };
}	
