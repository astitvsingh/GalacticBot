
function _GRID_JS(s) {
	return s * 16;
}

function Popover(options) {
	var self = this;

	this.options = options;

	this.buttons = [];

	this.type = this.paramRequire('type', Popover.PARAMETER_TYPE_ENUM, [Popover.TYPE_MODAL, Popover.TYPE_MENU, Popover.TYPE_TOOLTIP]);
	
	if (this.type == Popover.TYPE_MODAL) {
		this.title = this.paramRequire('title', Popover.PARAMETER_TYPE_STRING);
		this.onCreateCallback = this.paramRequire('onCreateCallback', Popover.PARAMETER_TYPE_CALLBACK);
	} else if (this.type == Popover.TYPE_MENU) {
		this.preferedPostion = this.paramOptional('preferedPosition', Popover.PARAMETER_TYPE_ENUM, [Popover.PREFERED_POSITION_LEFT, Popover.PREFERED_POSITION_RIGHT], Popover.PREFERED_POSITION_LEFT);
		this.size = this.paramOptional('size', Popover.PARAMETER_TYPE_ENUM, [Popover.SIZE_NORMAL, Popover.SIZE_SMALL], Popover.SIZE_NORMAL);
		this.showSelectionIcon = this.paramOptional('showSelectionIcon', Popover.PARAMETER_TYPE_BOOLEAN, null, true);
	} else if (this.type == Popover.TYPE_TOOLTIP) {
		this.preferedPostion = this.paramOptional('preferedPosition', Popover.PARAMETER_TYPE_ENUM, [Popover.PREFERED_POSITION_LEFT, Popover.PREFERED_POSITION_RIGHT], Popover.PREFERED_POSITION_LEFT);
		this.text = this.paramRequire('text', Popover.PARAMETER_TYPE_STRING);
	}

	this.onHideCallback = this.paramOptional('onHideCallback', Popover.PARAMETER_TYPE_CALLBACK);

	this.slingelElement = $('<div class="popover-slingel"></div>');
	this.slingelElement.appendTo(document.body);

	this.element = $('<div class="popover"><div class="popover-heading"><div class="popover-heading-title">Title</div><i class="fas fa-sync-alt fa-spin"></i></div><div class="popover-content"></div><div class="popover-footer"></div></div>');
	this.element.addClass('type-' + this.type.toLowerCase().replace(/type_/si, '')).hide().css({opacity: 0});
	this.element.appendTo(document.body);

	if (this.type == Popover.TYPE_MODAL) {
		this.setupModal();
	} else if (this.type == Popover.TYPE_MENU) {
		this.element.addClass(this.size.toLowerCase().replace(/_/g, '-'));
	} else if (this.type == Popover.TYPE_TOOLTIP) {
		this.element.find('.popover-content').text(this.text);
	}

	if (this.preferedPostion == Popover.PREFERED_POSITION_LEFT) {

	} else if (this.preferedPostion == Popover.PREFERED_POSITION_RIGHT) {
		this.slingelElement.addClass('position-right');
	}

	this.uniqueID = null;

	this.optionSelectCallback = null;

	if (!Popover.mainClickHandlerActive) {
		Popover.mainClickHandlerActive = true;

		$(window).click(function(e) {
			if (!Popover.activePopover)
				return;

			if (Popover.activePopover.type == Popover.TYPE_TOOLTIP) {				
				Popover.activePopover.hide();
				return;
			}

			if (jQuery.contains(Popover.activePopover.element[0], $(e.target)[0])) {
				// keep
				console.log('keep');
			} else if (Popover.activePopover.element[0] == $(e.target)[0]) {
				// keep
				console.log('keep');
			} else {
				Popover.activePopover.hide();
			}
		});
	}
}

Popover.TYPE_MODAL = "TYPE_MODAL";
Popover.TYPE_MENU = "TYPE_MENU";
Popover.TYPE_TOOLTIP = "TYPE_TOOLTIP";

Popover.SIZE_NORMAL = "SIZE_NORMAL";
Popover.SIZE_SMALL = "SIZE_SMALL";

Popover.PREFERED_POSITION_LEFT = "PREFERED_POSITION_LEFT";
Popover.PREFERED_POSITION_RIGHT = "PREFERED_POSITION_RIGHT";

Popover.BUTTON_TYPE_OK = "BUTTON_TYPE_OK";
Popover.BUTTON_TYPE_CANCEL = "BUTTON_TYPE_CANCEL";
Popover.BUTTON_TYPE_BUY = "BUTTON_TYPE_BUY";
Popover.BUTTON_TYPE_SELL = "BUTTON_TYPE_SELL";

Popover.PARAMETER_TYPE_STRING = "PARAMETER_TYPE_STRING";
Popover.PARAMETER_TYPE_ENUM = "PARAMETER_TYPE_ENUM";
Popover.PARAMETER_TYPE_CALLBACK = "PARAMETER_TYPE_CALLBACK";

Popover.byUniqueID = new Array();
Popover.mainClickHandlerActive = false;
Popover.activePopover = null;

$(window).resize(function() {
	if (Popover.activePopover)
		Popover.activePopover.reposition();
});

Popover.prototype.setIsLoading = function() {
	this.element.find('.popover-heading i').stop().animate({opacity: 1});
}

Popover.prototype.setIsDoneLoading = function() {
	this.element.find('.popover-heading i').stop().animate({opacity: 0});
}

Popover.prototype.setHTML = function(html) {
	this.element.find('.popover-content').html(html);
	this.reposition();
}

Popover.prototype.getContentElement = function() {
	return this.element.find('.popover-content');
}

Popover.prototype.paramOptional = function(name, type, options, defaultValue) {
	return this.paramRequire(name, type, options, true, defaultValue);
}

Popover.prototype.paramRequire = function(name, type, options, notRequired, defaultValue) {
	var required = !notRequired;

	if (typeof this.options[name] == 'undefined') {
		if (!required)
			return defaultValue;

		throw "Missing required parameter '" + name + "' in newly constructed popover.";
	}

	if (type == Popover.PARAMETER_TYPE_ENUM) {
		var found = false;
		for(var i in options)
			if (options[i] == this.options[name])
				found = true;
		
		if (!found)
			throw "Invalid value '" + this.options[name] + "' for parameter '" + name + "' in newly constructed popover. Value must be any of: " + options.join(', ') + ".";
	} else if (type == Popover.PARAMETER_TYPE_CALLBACK) {
		if (typeof this.options[name] != 'function')
			throw "Invalid value '" + this.options[name] + "' for parameter '" + name + "' in newly constructed popover. Value must be a function.";
	}

	return this.options[name];
}

Popover.prototype.removeButtons = function() {
	// do not really remove them, just hide - otherwise the global onclick check will not find the button attached to a popover
	this.element.find('.popover-footer .button').addClass('hidden');
}

Popover.prototype.addButton = function(type, icon, label, callback) {
	var self = this;
	var element = $('<div class="button"><div class="icon"><i class="fas"></i></div><div class="label"></div></div>');

	if (!label && type == Popover.BUTTON_TYPE_OK)
		label = 'OK';
	else if (!label && type == Popover.BUTTON_TYPE_CANCEL)
		label = 'Cancel';
	else if (!label && type == Popover.BUTTON_TYPE_BUY)
		label = 'Buy';
	else if (!label && type == Popover.BUTTON_TYPE_SELL)
		label = 'Sell';

	if (!icon && type == Popover.BUTTON_TYPE_OK)
		icon = 'fa-check';
	else if (!icon && type == Popover.BUTTON_TYPE_CANCEL)
		icon = 'fa-times';
	else if (!icon && type == Popover.BUTTON_TYPE_BUY)
		icon = 'fa-shopping-cart';
	else if (!icon && type == Popover.BUTTON_TYPE_SELL)
		icon = 'fa-times-circle';

	if (!callback && type == Popover.BUTTON_TYPE_OK)
		callback = function() { self.destroy(); };
	else if (!callback && type == Popover.BUTTON_TYPE_CANCEL)
		callback = function() { self.destroy(); };

	element.find('.icon i').addClass(icon);
	element.find('.label').text(label);

	element.appendTo(this.element.find('.popover-footer'));
	this.element.addClass('with-footer');

	element.click(function(e) { e.preventDefault(); callback(); });

	this.buttons.push({
		index: this.buttons.length,
		element: element,
		type: type,
		label: label,
		callback: callback
	});
}

Popover.prototype.addOption = function(value, label, selected, options) {
	var self = this;

	options = options || {};
	options.disabled |= false;
	options.depth |= 0;

	//console.log('options = ', options);

	var option = $('<div class="option"><div class="option-icon"><i class="fas fa-check"></i></div><div class="option-label"></div></div>');
	option.data('value', value);

	if (typeof label == 'object')
		label.appendTo(option.find('.option-label'));
	else
		option.find('.option-label').text(label);

	option.appendTo(this.element.find('div.popover-content'));

	option.click(function(e) {
		e.preventDefault();
		self.selectOptionByValue($(this).data('value'), true);
	})

	if (this.showSelectionIcon)
		option.addClass('with-icon');

	if (options.disabled)
		option.addClass('disabled');

		option.addClass('depth-' + options.depth);

	if (selected)
		this.selectOptionByValue(value);
}

Popover.prototype.setUniqueID = function(uniqueID) {
	this.uniqueID = uniqueID;
}

Popover.prototype.setText = function(text) {
	this.element.find('.popover-content').text(text);
}

Popover.prototype.setWidth = function(width) {
	this.element.width(width).css('max-width', width);
}

Popover.prototype.selectOptionByValue = function(value, triggerCallback) {
	this.element.find('.popover-content .option').removeClass('selected').each(function() {
		if (value == $(this).data('value'))
			$(this).addClass('selected');
	})

	if (triggerCallback) {
		this.optionSelectCallback(value);
	}
}

Popover.prototype.destroy = function() {
	var self = this;

	this.hide(function() {
		self.element.remove();
	})
}

Popover.prototype.hide = function(onCompleteCallback) {
	if (Popover.activePopover == this)
		Popover.activePopover = null;

	if (this.onHideCallback) {
		this.onHideCallback();
	}

	var self = this;

	if (this.type == Popover.TYPE_MODAL) {
		Disabler.hide(function() {self.element.animate({opacity: 0}, function() { $(this).hide(); if (onCompleteCallback) { onCompleteCallback(); }}); });
	} else {
		self.slingelElement.animate({opacity: 0}, function() { $(this).hide(); });
		self.element.animate({opacity: 0}, function() { $(this).hide(); if (onCompleteCallback) { onCompleteCallback(); }});
	}	
}

Popover.prototype.setupModal = function() {
	this.element.find('.popover-heading-title').text(this.title);

	this.onCreateCallback(this, this.element.find('.popover-content'));
}

Popover.prototype.showModal = function() {
	var self = this;

	if (Popover.activePopover)
		Popover.activePopover.hide();

	Disabler.show(
		function() {
			// show delayed so we can't be interrupted by the auto hide handler
			setTimeout(function() { self.showModal4real(); }, 100);
		}
	)
}

Popover.prototype.reposition = function() {
	var w = $(window).width();
	var h = $(window).height();

	// offset slightly higher when the window is large enough,
	// center when the dialog height is close to the window height
	var diff = h - this.element.height();
	var offset = Math.min(1, diff/200) * 0.2;
	h /= (2+offset);

	var left = (w/2) - (this.element.width()/2);
	var top = h - (this.element.height()/2);

	if (this.type == Popover.TYPE_MODAL) {
		this.element.css({left: left, top: top}).show().animate({opacity: 1});
	}
}

Popover.prototype.showModal4real = function() {
	if (this.uniqueID) {
		if (Popover.byUniqueID[this.uniqueID])
			Popover.byUniqueID[this.uniqueID].destroy();

		Popover.byUniqueID[this.uniqueID] = this;
	}

	Popover.activePopover = this;

	this.reposition();
}

Popover.prototype.showForElement = function(forElement) {
	var self = this;

	// show delayed so we can't be interrupted by the auto hide handler
	setTimeout(function() { self.showForElement4Real(forElement); }, 100);
}

Popover.prototype.showForElement4Real = function(forElement) {
	if (this.uniqueID) {
		if (Popover.byUniqueID[this.uniqueID])
			Popover.byUniqueID[this.uniqueID].destroy();

		Popover.byUniqueID[this.uniqueID] = this;
	}

	Popover.activePopover = this;

	var left = forElement.offset().left;
	var right = left + forElement.width();
	var x = 0;
	var top = forElement.offset().top;

	if (this.preferedPostion == Popover.PREFERED_POSITION_LEFT) {
		x = left - this.element.width() + _GRID_JS(1);

	} else if (this.preferedPostion == Popover.PREFERED_POSITION_RIGHT) {
		x = right + _GRID_JS(0);

		if (this.type == Popover.TYPE_TOOLTIP) {
			x += _GRID_JS(1);
		}
	}
	
	top += (forElement.height()/2) - (this.element.height()/2);
	top -= 2;

	this.element.css({left: x, top: top}).show().animate({opacity: 1}, 100);

	x = x;
	top = top + this.element.height()/2;

	top -= 12;

	if (this.preferedPostion == Popover.PREFERED_POSITION_LEFT)
		x += this.element.width();
	else if (this.preferedPostion == Popover.PREFERED_POSITION_RIGHT)
		x -= 10;

	this.slingelElement.show().css({left: x, top: top, opacity: 0}).animate({opacity: 1}, 100);
	
	/*
	var top = (this.element.height()/2) - (this.element.find('.slingel').height()/2);
	top += 2;
	this.element.find('.slingel').css({top: top});

	if (this.preferedPostion == Popover.PREFERED_POSITION_RIGHT) {
		this.element.find('.slingel').css({left: -10});
	}*/
}

Popover.prototype.setOptionSelectCallback = function(callback) {
	this.optionSelectCallback = callback;
}
