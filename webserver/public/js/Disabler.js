
/** STATIC METHODS **/

var _disabler = null;

function Disabler() {
	this.showDepth = 0;
	this.element = null;

	this.init();
}

/** STATIC METHODS **/

Disabler.setup = function() {
	if (!_disabler)
		_disabler = new Disabler();
}

Disabler.show = function(callback) {
	_disabler.show(callback);
}

Disabler.hide = function(callback) {
	_disabler.hide(callback);
}

/** NON-STATIC METHODS **/

Disabler.prototype.init = function() {
	this.element = $('<div id="disabler" class="noselect"></div>');
	this.element.appendTo($(document.body));
	this.element.hide().css('opacity', 0);
}

Disabler.prototype.show = function(callback) {
	if (this.showDepth == 0) {
		var app = $('#app');

		this.element.show().stop().animate(
			{
				opacity: 0.75
			},
			{
				easing: 'linear',
				progress: function(elements, complete, remaining, start, tweenValue) {
					var blur = complete * 2.5;
					app.css({filter: 'blur(' + blur + 'px)'});
				}
			}
		);

		// Disable scrollwheel
		$(document.body).addClass('no-scroll');

		window.onwheel = function(e){
			if ($(e.target).closest('.poover')[0]) {
				// allow
			} else {
				e.preventDefault();
				return false;
			}
		};
	}

	if (callback) {
		setTimeout(
			function() { callback(); },
			0.25 * $.fx.speeds._default
		);
	}

	this.showDepth++;
}

Disabler.prototype.hide = function(callback) {
	this.showDepth--;

	var self = this;

	if (this.showDepth == 0) {
		var app = $('#app');

		this.element.stop().animate(
			{
				opacity: 0
			},
			{
				easing: 'linear',
				progress: function(elements, complete, remaining, start, tweenValue) {
					var blur = 1-complete * 1.5;
					app.css({filter: 'blur(' + blur + 'px)'});
				},
				complete: function()
				{
					$(self.element).hide()
					app.css({filter: 'blur(0px)'});
					console.log('complete');
				}
			}
		);

		// Enable scrollwheel again
		$(document.body).removeClass('no-scroll');
		window.onwheel = function(){};
	}

	if (callback) {
		setTimeout(
			function() { callback(); },
			0.5 * $.fx.speeds._default
		);
	}
}
