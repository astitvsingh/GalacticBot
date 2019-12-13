
var api = null;
var botList = null;
var botDetails = null;
var updater = null;

var flash = false;

var currentNotice = null, currentNoticeTimer = null;

function showNotice(type, text) {
	if (currentNotice)
		hideNotice();

	var element = $('<div class="notice"><div class="text"><div class="icon"><i class="fas fa-check-circle"></i><i class="fas fa-times"></i></div><div class="message"></div></div></div>');
	element.find('.text .message').text(text);
	element.addClass(type);
	element.click(function() { hideNotice(); });
	element.appendTo(document.body);

	element.css({opacity: 0, marginBottom: -_GRID_JS(4) }).animate({opacity: 1, marginBottom: 0 }, 200);

	clearTimeout(currentNoticeTimer);

	currentNoticeTimer = setTimeout(function() { hideNotice(); }, 1500);

	currentNotice = element;
}

function hideNotice() {
	if (!currentNotice)
		return;

	currentNotice.stop().animate({opacity: 0, marginBottom: -_GRID_JS(4) }, 1000, function() { $(this).remove(); });
	currentNotice = null;
}

function showNoticeSuccess(text) {
	return showNotice('success', text);
}

function showNoticeError(text) {
	return showNotice('error', text);
}

function onResize() {

	/*$('#bot-tab-logic .pane.editor .block .editor, #bot-tab-logic .pane.inputs .block .editor').hide();
	var w = $('#bot-tab-logic').innerWidth();
	w -= _GRID_JS(4);
	w -= parseInt($('#app .row .column#bot-detail .inner').css('padding-right'));
	$('#bot-tab-logic .pane.editor .block .editor, #bot-tab-logic .pane.inputs .block .editor').show().width(w);*/

	var w = $(window).width();
	w -= _GRID_JS(28);
	$('#bot-tab-logic .pane.editor .block .editor, #bot-tab-logic .pane.inputs .block .editor').css('max-width', w);
	
	var header = $('.row.heading').height();
	var h = $(window).height()-header;

	//$('#app').height(h).css('max-height', h);
	$('#bot-detail .inner').first().height(h);

}

function formatAmount(amount) {
	amount = parseFloat(amount);

	if (isNaN(amount))
		return "NaN";

	return amount.toFixed(7);
}

$(window).resize(function() {
	onResize();
});

function Launcher() {
	this.test(true);
}

var isDemoMode = false, demoModePassword = null;

function getUrlVars() {
	var vars = {};
	var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
		vars[key] = value;
	});
	return vars;
}

function getUrlParam(parameter, defaultvalue){
	var urlparameter = defaultvalue;
	
	if(window.location.href.indexOf(parameter) > -1){
		urlparameter = getUrlVars()[parameter];
	}
	
	return urlparameter;
}

function disableDemoModeButtons() {
	if (!isDemoMode)
		return;

	$('.action').addClass('disabled-demo-mode').unbind('click').click(function() {
		showNoticeError('Disabled in demo mode.');
	});
}

Launcher.prototype.test = function(noDelay) {
	var self = this;

	$.post(
		'/api/test',
		{},
		function(r) {
			if (r) {
				if (r && r.setupStep == 1 && r.gotPassword) {
					demoModePassword = getUrlParam('demoModePassword');

					if (r.demoMode && !demoModePassword) {
						isDemoMode = true;
						disableDemoModeButtons();
					}
					self.onComplete(noDelay ? 0 : 200);
				} else {
					$('#master-password').show().animate({opacity: 1});

					setTimeout(function(){
						if (r && r.setupStep == 1) {
							self.showLogin();
						} else {
							self.showSetup();
						}
					}, 1000);
				}
			}
		},
		'json'
	);
}

Launcher.prototype.onComplete = function(delay) {
	var self = this;
	
	$('#master-password').stop().animate({opacity: 0}, function() { $(this).hide(); });

	setTimeout(() => {
		$('#app').removeClass('loading').stop().animate({opacity: 1}, 500);
		
		self.onCompleteTimed();
	}, delay);
}

Launcher.prototype.onCompleteTimed = function() {
	botList = new BotList();

	botDetails = new BotDetails();

	updater = new Updater();
}

Launcher.prototype.showSetup = function() {
	var self = this;

	var popover = new Popover({
		type: Popover.TYPE_MODAL,
		title: 'Welcome to your Galactic Bot server',
		onCreateCallback: function(popover, contentElement) {
			contentElement.html(`
			<form>
				<div class="form">
					<div class="error"></div>
					<div>
						<p>You must provide a master password to complete the setup of your Galactic Bot Server. This password is used to encrypt important data (like your Stellar account secrets) in the local bot database and start up your server.</p>
						<br />
						<p class="yellow"><i class="fas fa-exclamation-triangle"></i> Important: keep this password safe. If you lose this password you lose access to your bot and funds.</p>
						<br />
					</div>
					<div class="input"><input type="password" placeholder="A new master password" class="p1" /></div>
					<div class="input"><input type="password" placeholder="Confirm your master password" class="p2" /></div>
				</div>
				<input type="submit" />
			</form>
			`);
			popover.getContentElement().find('.error').hide();
			popover.getContentElement().find('form').submit(function(e) { e.preventDefault(); submit(); });
		}
	});

	function submit() {
		popover.setIsLoading();
		popover.getContentElement().find('.error').hide();
		popover.getContentElement().find('.form').addClass('disabled');
		
		$.post(
			'/api/test',
			{
				p1: popover.getContentElement().find('input.p1').val(),
				p2: popover.getContentElement().find('input.p2').val(),
			},
			function(r) {
				console.log('r = ', r);

				if (r.error) {
					popover.setIsDoneLoading();
					popover.getContentElement().find('.error').show().text(r.error);
					popover.getContentElement().find('.form').removeClass('disabled');
				} else {
					popover.destroy();
					self.test();
				}
			},
			'json'
		);
	}

	popover.addButton(
		Popover.BUTTON_TYPE_OK,
		null,
		'Set master password',
		function() {
			submit();
		 }
	);

	popover.showModal();
}

Launcher.prototype.showLogin = function() {
	var self = this;

	var popover = new Popover({
		type: Popover.TYPE_MODAL,
		title: 'Welcome to your Galactic Bot server',
		onCreateCallback: function(popover, contentElement) {
			popover.setHTML(`
			<form>
				<div class="form">
					<div class="error"></div>
					<div>
						<p>Please provide your master password to start the server.</p>
						<br />
					</div>
					<div class="input"><input type="password" placeholder="Your master password" class="p" /></div>
				</div>
				<input type="submit" />
			</form>
			`);
			popover.getContentElement().find('.error').hide();
			popover.getContentElement().find('form').submit(function(e) { e.preventDefault(); submit(); });
		}
	});

	function submit() {
		popover.setIsLoading();
		popover.getContentElement().find('.error').hide();
		popover.getContentElement().find('.form').addClass('disabled');
		
		$.post(
			'/api/test',
			{
				p: popover.getContentElement().find('input.p').val(),
			},
			function(r) {
				console.log('r = ', r);

				if (r.error) {
					popover.setIsDoneLoading();
					popover.getContentElement().find('.error').show().text(r.error);
					popover.getContentElement().find('.form').removeClass('disabled');
				} else {
					popover.destroy();
					self.test();
				}
			},
			'json'
		);
	}

	popover.addButton(
		Popover.BUTTON_TYPE_OK,
		null,
		'Login',
		function() {
			submit();
		 }
	);

	popover.showModal();
}

$(document).ready(function() {
	Disabler.setup();

	onResize();

	api = new API();

	var launcher = new Launcher();

	setInterval(function() {
		flash = !flash;

		if (flash)
			$('#app').removeClass('flash-a').addClass('flash-b');
		else
			$('#app').removeClass('flash-b').addClass('flash-a');
	}, 250);

	$('#action-add-bot').click(function(e) {
		e.preventDefault();

		api.create(
			'bot',
			{},
			function(bot) {
				var item = botList.add(bot);
				item.select();
			}
		);
	})

	$('.block.toggle').each(function() {
		var input = $(this).find('input');
		var self = $(this);

		function update() {
			if (input.prop('checked'))
				$(self).find('.toggle').addClass('on').removeClass('off');
			else
				$(self).find('.toggle').addClass('off').removeClass('on');
		}

		input.change(function() {
			update();	
		});

		$(this).click(function() {
			var isOn = !input.prop('checked');
			input.prop('checked', isOn).change();
		});
	});

	onResize();
});