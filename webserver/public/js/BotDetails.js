
function BotDetails() {
	var self = this;

	this.data = {};
	this.listElement = null;
	this.element = $('#bot-detail');

	this.entryElementParent = this.element.find('.pane.log .log');
	this.entryElement = this.element.find('.pane.log .log .entry').removeClass('hidden').remove();
	
	this.offersElementParent = this.element.find('.pane.buysell .offers ul');
	this.offersElement = this.element.find('.pane.buysell ul li').removeClass('hidden').remove();
	
	this.element.find('.tab-button').click(function() {
		self.selectTab($(this).data('tab-name'), true);
	});

	this.element.find('#action-bot-state-start').click(function() {
		self.start();
	});

	this.element.find('#action-bot-state-stop').click(function() {
		self.stop();
	});

	this.element.find('#action-bot-settings-save').click(function() {
		self.saveSettings($(this));
	});

	this.element.find('#action-bot-logic-save').click(function() {
		self.saveLogic($(this));
	});

	this.element.find('#action-bot-settings-wallet-live-create').click(function() {
		self.createWallet(true);
	});

	this.element.find('#action-bot-settings-wallet-testnet-create').click(function() {
		self.createWallet(false);
	});

	this.element.find('#action-bot-trade-buy').click(function() {
		self.showBuySellDialog(true);
	});

	this.element.find('#action-bot-trade-sell').click(function() {
		self.showBuySellDialog(false);
	});

	this.element.find('a.strategy.copy').click(function() {
		self.showCopyStrategyDialog(false);
	});

	this.element.find('a.strategy.paste').click(function() {
		self.showPasteStrategyDialog(false);
	});

	this.element.find('#bot-setting-mode').change(function() {
		self.change(null);
	});

	this.logic = new BotLogic($('#bot-tab-logic-inputs'), $('#bot-tab-logic-editor'));

	disableDemoModeButtons();
}

BotDetails.prototype.start = function() {
	var self = this;

	api.perform(
		'bot',
		this.data._id,
		'start',
		{
		},
		function(r) {
			if (r) {
				self.entryElementParent.find('.entry').remove();
				self.offersElementParent.find('li').remove();
				onBotDataChange(r._id, r);
			} else
				showNoticeError('Failed to start bot.');
		}
	);
}

BotDetails.prototype.stop = function() {
	var self = this;

	api.perform(
		'bot',
		this.data._id,
		'stop',
		{
		},
		function(r) {
			if (r)
				onBotDataChange(r._id, r);
			else
				showNoticeError('Failed to stop bot.');
		}
	);
}

BotDetails.prototype.showCopyStrategyDialog = function() {
	var self = this;

	var popover = new Popover({
		type: Popover.TYPE_MODAL,
		title: 'Copy strategy',
		onCreateCallback: function(popover, contentElement) {
			popover.setHTML(`
				<div class="form">
					<textarea class="mono" style="width: 420px; height: 320px; white-space: normal; font-size: 9px;"></textarea>
				</div>
			`);

			var input = self.logic.getInputJSON();
			var logic = self.logic.getLogicJSON();

			contentElement.find('textarea').val('GalacticBot.com-Strategy-' + btoa(JSON.stringify({input: input, logic: logic})));
		}
	});

	popover.addButton(Popover.BUTTON_TYPE_OK);
	
	
	popover.showModal();
}

BotDetails.prototype.showPasteStrategyDialog = function() {
	var self = this;

	var popover = new Popover({
		type: Popover.TYPE_MODAL,
		title: 'Paste strategy',
		onCreateCallback: function(popover, contentElement) {
			popover.setHTML(`
				<div class="form">
					<div class="error"></div>
					<textarea style="width: 420px; height: 320px; white-space: normal;"></textarea>
				</div>
			`);
			popover.getContentElement().find('.error').hide();
			contentElement.find('textarea').val('');
		}
	});
	
	popover.addButton(Popover.BUTTON_TYPE_CANCEL);
	popover.addButton(
		Popover.BUTTON_TYPE_OK,
		null,
		'Save',
		function() {
			popover.setIsLoading();
			popover.getContentElement().find('.error').hide();

			try {
				var text = popover.getContentElement().find('textarea').val();
				text = text.replace(/^GalacticBot\.com\-Strategy\-/sgi, "");
				var code = atob(text);
				var o = JSON.parse(code);
				self.logic.loadFromJSON(JSON.stringify(o.input), JSON.stringify(o.logic));
				popover.hide();
			} catch(e) {
				console.log('error while parsing logic: ', e);
				popover.setIsDoneLoading();
				popover.getContentElement().find('.error').show().text('Invalid code.');
			}
 		});
	
	popover.showModal();
}

BotDetails.prototype.showBuySellDialog = function(buyMode) {
	var self = this;

	var baseAsset = (this.data.live ? this.data.liveBaseassetType : this.data.testnetBaseassetType);
	var counterAsset = (this.data.live ? this.data.liveCounterassetType : this.data.testnetCounterassetType);

	function loadprice(popover) {
		popover.setIsLoading();
		popover.getContentElement().find('.form').addClass('disabled');
		popover.removeButtons();
		popover.addButton(Popover.BUTTON_TYPE_CANCEL);
		popover.getContentElement().find('.error').text('').parent().addClass('hidden');

		api.perform(
			'bot',
			self.data._id,
			'get-price-and-holdings',
			{
			},
			function(r) {
				console.log('heb antwoord: ', r);

				if (r && r.success) {
					setPrice(popover, r.data);
				} else {
					setError(popover, 'Failed loading current price. Please try again later.');
				}				
			}
		);
	}

	function setError(popover, error) {
		popover.getContentElement().find('.form').removeClass('disabled');
		popover.setIsDoneLoading();
		popover.removeButtons();
		
		addTradeButtons(popover);

		popover.getContentElement().find('.error').text(error).parent().removeClass('hidden');
	}

	function recalculate(popover) {
		var contentElement = popover.getContentElement();

		var price = parseFloat(contentElement.find('input[name=price]').val());
		var selling = parseFloat(contentElement.find('input[name=first]').val());
		var buying = (buyMode ? price : 1/price) * selling;
		buying = formatAmount(buying);
		contentElement.find('input[name=second]').val(buying);
	}

	function submitTrade(popover) {
		popover.setIsLoading();
		popover.getContentElement().find('.form').addClass('disabled');
		popover.removeButtons();
		popover.addButton(Popover.BUTTON_TYPE_CANCEL);
		popover.getContentElement().find('.error').text('').parent().addClass('hidden');

		var contentElement = popover.getContentElement();

		var price = parseFloat(contentElement.find('input[name=price]').val());
		var sellAmount = parseFloat(contentElement.find('input[name=first]').val());
		var buyAmount = parseFloat(contentElement.find('input[name=second]').val());

		var trade = {
			type: buyMode ? 'BUY' : 'SELL',
			price: price,
			buyAmount: buyMode ? buyAmount : sellAmount
		}
		
		console.log('submitTrade = ', trade);

		//return;

		api.perform(
			'bot',
			self.data._id,
			'submit-trade',
			trade,
			function(r) {
				console.log('heb antwoord: ', r);

				if (r && r.success) {
					//setPrice(popover, r.data);
					popover.setIsDoneLoading();
					popover.removeButtons();
					popover.setHTML("Trade submitted to the network. It could take a moment for the trade to show up in the trade list.");
					popover.addButton(Popover.BUTTON_TYPE_OK);
				} else {
					setError(popover, 'Failed submit trade. Please try again later.');
				}				
			}
		);
	}

	function addTradeButtons(popover) {
		popover.addButton(Popover.BUTTON_TYPE_CANCEL);
		
		if (buyMode)
			popover.addButton(Popover.BUTTON_TYPE_BUY, undefined, 'Buy ' + counterAsset, function() { submitTrade(popover); });
		else
			popover.addButton(Popover.BUTTON_TYPE_SELL, undefined, 'Sell ' + counterAsset, function() { submitTrade(popover); });
	}

	function setPrice(popover, data) {
		popover.getContentElement().find('.form').removeClass('disabled');
		popover.setIsDoneLoading();
		popover.removeButtons();
		
		addTradeButtons(popover);
		
		var contentElement = popover.getContentElement();

		contentElement.find('input[name=price]').val(data.price);
		contentElement.find('input[name=first]').val(buyMode ? data.baseAssetBalance : data.counterAssetBalance);

		recalculate(popover);
	}

	var popover = new Popover({
		type: Popover.TYPE_MODAL,
		title: (buyMode ? 'Buy ' + counterAsset + ' with ' : 'Sell ' + counterAsset + ' for ') + baseAsset,
		onCreateCallback: function(popover, contentElement) {
			popover.setHTML(`
				<div class="form disabled">
					<div class="hidden"><div class="error">Error</div></div>
					<div class="input"><div class="label">Price of one ` + baseAsset + ` in ` + counterAsset + `<div class="button refresh"><div class="icon"><i class="fas fa-sync"></i></div><div class="label">Refresh</div></div></div><input name="price" /></div>
					<div class="input disabled"><div class="label">` + ('Selling') + ` ` + (buyMode ? baseAsset : counterAsset) + ` amount</div><input name="first" /></div>
					<div class="input disabled"><div class="label">` + ('Buying') + ` ` + (buyMode ? counterAsset : baseAsset) + ` amount</div><input name="second" /></div>
				</div>
			`);
			contentElement.find('.refresh').click(function(e) { e.preventDefault(); loadprice(popover); });
			contentElement.find('input[name=price]').bind('change keyup', function(e) { e.preventDefault(); recalculate(popover); });

			loadprice(popover);
		}
	});
	
	popover.showModal();
}

BotDetails.prototype.createWallet = function(onLive) {
	var self = this;

	var popover = new Popover({
		type: Popover.TYPE_MODAL,
		title: 'Create new ' + (onLive ? 'live' : 'testnet') + ' wallet',
		onCreateCallback: function(popover, contentElement) {
			contentElement.text('Generating new keypair to use as this bot\'s wallet.');
		}
	});
	popover.setIsLoading();
	popover.showModal();

	var data = {};

	if (onLive)
		data['liveWalletSecret'] = 'CREATE';
	else
		data['testnetWalletSecret'] = 'CREATE';

	//  self.showCreateWalletResult(onLive);
	var interval = setInterval(
		function() {
			var value = onLive ? self.data.liveWalletSecretOnce : self.data.testnetWalletSecretOnce;

			console.log('result = ', self.data);

			if (value) {
				clearInterval(interval);

				popover.destroy();

				self.showCreateWalletResult(onLive);
			}
		},
		500
	);

	api.post(
		'bot',
		this.data._id,
		data,
		function(r) {
			onBotDataChange(r._id, r);
		}
	);
}

BotDetails.prototype.showCreateWalletResult = function(onLive) {
	var self = this;

	var popover = new Popover({
		type: Popover.TYPE_MODAL,
		title: 'New ' + (onLive ? 'live' : 'testnet') + ' wallet created',
		onCreateCallback: function(popover, contentElement) {
			contentElement.html('The keypair has been generated for this bot and stored in the database and is encrypted with a randomly generated key.<br /><br />You can now deposit your prefered base currency to the public address shown in the settings tab of this bot.<br /><br /><b class="yellow"><i class="fas fa-exclamation-triangle"></i> Stellar account secret key (only shown ONCE, please save)</b><br /><span class="secret-key">secret</span><br /><br /><div class="note yellow"><i class="fas fa-exclamation-triangle"></i> Please save the secret key to be able to manually access this bot\'s wallet.</div>');

			var value = onLive ? self.data.liveWalletSecretOnce : self.data.testnetWalletSecretOnce;
			contentElement.find('span.secret-key').css('white-space', 'normal').text(value);
		}
	});
	popover.setWidth(650);
	popover.addButton(Popover.BUTTON_TYPE_OK);
	popover.showModal();
}

BotDetails.prototype.saveLogic = function(button) {
	var self = this;
	button.addClass('disabled');
	setTimeout(function() { self.saveLogic4Real(button); }, 500);
}

BotDetails.prototype.saveLogic4Real = function(button) {
	var self = this;

	this.logic.onChangeTimed();

	var data = {
		inputTree: $('#bot-inputs-json').val(),
		logicTree: $('#bot-logic-json').val(),
	};

	api.post(
		'bot',
		this.data._id,
		data,
		function(r) {
			button.removeClass('disabled');

			if (r) {
				onBotDataChange(r._id, r);

				showNoticeSuccess('Logic have been saved and sent to the bot server.');
			} else {
				showNoticeError('Cannot save logic. Make sure both servers are running.');
			}
		}
	);
}

BotDetails.prototype.saveSettings = function(button) {
	var self = this;
	button.addClass('disabled');
	setTimeout(function() { self.saveSettings4Real(button); }, 500);
}

BotDetails.prototype.saveSettings4Real = function(button) {
	var self = this;

	var data = {
		name: $('#bot-setting-name').val(),
		interval: $('#bot-setting-interval').val(),
		live: $('#bot-setting-mode').prop('checked') ? true : false,

		liveBaseassetType: $('#bot-setting-live-baseasset-type').val(),
		liveBaseassetIssuer: $('#bot-setting-live-baseasset-issuer').val(),
		liveCounterassetType: $('#bot-setting-live-counterasset-type').val(),
		liveCounterassetIssuer: $('#bot-setting-live-counterasset-issuer').val(),

		testnetBaseassetType: $('#bot-setting-testnet-baseasset-type').val(),
		testnetBaseassetIssuer: $('#bot-setting-testnet-baseasset-issuer').val(),
		testnetCounterassetType: $('#bot-setting-testnet-counterasset-type').val(),
		testnetCounterassetIssuer: $('#bot-setting-testnet-counterasset-issuer').val(),
	};

	api.post(
		'bot',
		this.data._id,
		data,
		function(r) {
			button.removeClass('disabled');

			if (r) {
				onBotDataChange(r._id, r);

				showNoticeSuccess('Settings have been saved.');
			} else {
				showNoticeError('Cannot save settings. Make sure both servers are running.');
			}
		}
	);
}

BotDetails.prototype.getID = function() {
	return this.data._id;
}

BotDetails.prototype.load = function(listElement, data) {
	var self = this;
	var delay = 0;

	this.data = {};
	this.element.find('input').val('');
	this.entryElementParent.find('.entry').remove();
	this.offersElementParent.find('li').remove();

	if (this.listElement) {
		this.listElement.element.removeClass('selected');

		var delay = 0;

		var elements = [];
		this.element.find('h2, .tabs .tab-button, .tab.visible .pane').each(function() {
			elements.push($(this));
		});
		elements = elements.reverse();
		$(elements).each(function() {
			$(this).stop(true).delay(delay).animate({opacity: 0}, 50);
			delay += 25;
		});

		delay += 100;
	}

	this.listElement = listElement;
	this.listElement.element.addClass('selected');
		
	setTimeout(function() { self.loadTimed(listElement, data); /* self.createWallet(true); */ }, delay);
}

BotDetails.prototype.onLogEntry = function(entry) {
	if (entry.botID != this.data._id)
		return;

	var element = this.entryElementParent.find('.entry#entry-' + entry._id);

	if (element[0])
		return;
	
	element = this.entryElement.clone();
	element.find('.date').text(moment(entry.date).format('MM/DD/YYYY hh:mm:ss A'));
	element.find('.type').text('['+entry.type.substr(0, 1)+']');
	element.find('.message').text(entry.message);
	element.addClass('type-' + entry.type);
	element.attr('id', 'entry-' + entry._id);
	element.data('timestamp', moment(entry.date).format('x'));
	element.prependTo(this.entryElementParent);

	this.entryElementParent.find('.entry').sort(function(a, b) {
		return $(b).data('timestamp') - $(a).data('timestamp');;
	}).appendTo(this.entryElementParent);
}

BotDetails.prototype.onOffer = function(entry) {
	if (entry.botID != this.data._id)
		return;

	var self = this;
	var element = this.offersElementParent.find('li#offer-' + entry._id);

	if (!element[0]) {
		element = this.offersElement.clone();
		element.addClass('type-' + entry.type);
		element.attr('id', 'offer-' + entry._id);
		element.data('timestamp', moment(entry.createdOn).format('x'));
		element.find('.date span').text(moment(entry.createdOn).format('MM/DD/YYYY hh:mm:ss A'));
		element.prependTo(this.offersElementParent);
		
		element.find('.cancel-offer').data('remoteOfferID', entry.remoteOfferID).click(function(e) {
			e.preventDefault();
			$(this).addClass('disabled');
			
			api.perform(
				'bot',
				self.data._id,
				'cancel-offer',
				{
					offerID: $(this).data('remoteOfferID')
				},
				function(r) {
					console.log('heb antwoord: ', r);
				}
			);
		});

		this.offersElementParent.find('li').sort(function(a, b) {
			return $(b).data('timestamp') - $(a).data('timestamp');;
		}).appendTo(this.offersElementParent);
	}
		
	var state = entry.state;

	element.removeClass('state-open').removeClass('state-partial').removeClass('state-cancelled').removeClass('state-filled');
	element.addClass('state-' + entry.state.toLowerCase());

	var w = element.width();
	var v = parseFloat(entry.fillPercentage)/100;
	
	if (isNaN(v))
		v = 0;

	var fill = v;
	v = Math.round(v*w);

	if (state == 'OPEN')
		state = 'Open';
	else if (state == 'PARTIAL')
		state = 'Filling (' + (Math.round(fill*100*100)/100) + '%)';
	else if (state == 'CANCELLED')
		state = 'Cancelled';
	else if (state == 'OPEN')
		state = 'Open';

	var counterAsset = (this.data.live ? this.data.liveCounterassetType : this.data.testnetCounterassetType);
	
	element.find('.type span').text((entry.type == 'BUY' ? 'Buy' : 'Sell') + ' ' + counterAsset);

	if (entry.type == 'SELL')
		element.find('.type i').removeClass('fa-shopping-cart').addClass('fa-times-circle');

	element.find('.price span').text(entry.price);
	element.find('.state span').text(state);

	//element.find('.black').width(v);
	element.find('.white').width(v);
}

BotDetails.prototype.setData = function(data) {
	var self = this;
	
	this.element.find('#bot-details-lastrun, #bot-details-total-holdings, #bot-details-total-profit, #bot-details-resources-cpu, #bot-details-resources-memory').text('...');

	for(var key in data)
		this.change(key, data[key]);

	api.get(
		'bot',
		this.data._id,
		'get-data',
		{}, 
		function(r) {
			for(var i in r.log)
				self.onLogEntry(r.log[i]);
			for(var i in r.offers)
				self.onOffer(r.offers[i]);
		}
	);


	var baseAsset = (this.data.live ? this.data.liveBaseassetType : this.data.testnetBaseassetType);
	var counterAsset = (this.data.live ? this.data.liveCounterassetType : this.data.testnetCounterassetType);

	this.logic.baseAsset = baseAsset;
	this.logic.counterAsset = counterAsset;
	this.logic.loadFromJSON(data.inputTree, data.logicTree);
}

BotDetails.prototype.change = function(key, value) {
	this.data[key] = value;

	console.log('key ' + key, 'value['+value+']');

	switch (key) {
		case "name":
				this.element.find('#bot-setting-name').val(value);
				this.element.find('h2 span').text(value);			
			break;
		case "interval":
				value = parseInt(value);
				this.element.find('#bot-setting-interval').val(isNaN(value) ? 60 : value);		
			break;
		case "lastRunTimestamp":
				var date = value ? moment(new Date(value * 1000)) : null;
				this.element.find('#bot-details-lastrun').text(date ? date.format('YYYY/MM/DD h:mm:ss A') : 'Has not run yet.');
			break;
			
		case "baseAssetBalance":				this.element.find('#bot-details-base-holdings').text(value); break;
		case "counterAssetBalance":			this.element.find('#bot-details-counter-holdings').text(value); break;
		
		case "totalAssetBalance":			this.element.find('#bot-details-total-holdings').text(value); break;
		case "currentProfit":				this.element.find('#bot-details-total-profit').text(value); break;
		case "systemResourcesCPUUsage":		this.element.find('#bot-details-resources-cpu').text(value); break;
		case "systemResourcesMemoryUsage":		this.element.find('#bot-details-resources-memory').text(value); break;

		case "live":
				this.element.find('#bot-setting-mode').prop('checked', value).change();
			break;
		case "state":
				this.element.removeClass('state-stopped').removeClass('state-starting').removeClass('state-running').removeClass('state-crashed');
				this.element.addClass('state-' + value.toLowerCase());		
			break;

		// Live
		case "liveWalletPublic":
				this.element.find('#bot-setting-wallet-live-public').val(value);	
			break;
		case "liveBaseassetType":
				this.element.find('span.base-asset').text(value);
				this.element.find('#bot-setting-live-baseasset-type').val(value);		
			break;
		case "liveBaseassetIssuer":
				this.element.find('#bot-setting-live-baseasset-issuer').val(value);		
			break;
		case "liveCounterassetType":
				this.element.find('span.counter-asset').text(value);
				this.element.find('#bot-setting-live-counterasset-type').val(value);		
			break;
		case "liveCounterassetIssuer":
				this.element.find('#bot-setting-live-counterasset-issuer').val(value);		
			break;
	
		// Testnet - Base asset
		case "testnetWalletPublic":
				this.element.find('#bot-setting-wallet-testnet-public').val(value);	
			break;
		case "testnetBaseassetType":
				this.element.find('#bot-setting-testnet-baseasset-type').val(value);		
			break;
		case "testnetBaseassetIssuer":
				this.element.find('#bot-setting-testnet-baseasset-issuer').val(value);		
			break;
		case "testnetCounterassetType":
				this.element.find('#bot-setting-testnet-counterasset-type').val(value);		
			break;
		case "testnetCounterassetIssuer":
				this.element.find('#bot-setting-testnet-counterasset-issuer').val(value);		
			break;
	}

	this.element.removeClass('state-changing');

	if (this.data.state && this.data.wantedState && this.data.state != this.data.wantedState)
		this.element.addClass('state-changing');

	if (this.data.liveWalletPublic)
		this.element.find('.pane.wallet.mode-live').removeClass('nowallet-live').addClass('gotwallet-live');
	else
		this.element.find('.pane.wallet.mode-live').addClass('nowallet-live').removeClass('gotwallet-live');

	if (this.data.testnetWalletPublic)
		this.element.find('.pane.wallet.mode-testnet').removeClass('nowallet-testnet').addClass('gotwallet-testnet');
	else
		this.element.find('.pane.wallet.mode-testnet').addClass('nowallet-testnet').removeClass('gotwallet-testnet');

	this.element.removeClass('testnet').removeClass('live');
	this.element.addClass($('#bot-setting-mode').prop('checked') ? 'live' : 'testnet');
}

BotDetails.prototype.loadTimed = function(listElement, data) {
	var delay = 100;

	this.setData(data);
	
	this.element.find('.tabs').removeClass('disabled').css({opacity:1});
	this.element.find('.tabs .tab-button').removeClass('hidden').removeClass('selected');

	this.selectTab('bot-tab-status', false);
	// this.selectTab('bot-tab-logic', false); //-- hier

	this.element.find('h2, .tabs .tab-button, .tab.visible .pane').css({opacity:0}).each(function() {
		$(this).stop(true).delay(delay).animate({opacity: 1}, 50);
		delay += 25;
	});
}

BotDetails.prototype.selectTab = function(name, fadeInPanes) {
	this.element.find('.tab-button.selected').removeClass('selected');

	var tabButton = $('#' + name + '-button');
	tabButton.addClass('selected');

	var visibleTab = this.element.find('.tab.visible');
	var delay = 0;

	if (visibleTab[0]) {
		visibleTab.stop(true).removeClass('visible').animate({opacity: 0}, 25, function() { $(this).addClass('hidden'); });
		delay += 25;
	}

	var tab = $('#' + name).addClass('hidden').addClass('visible');
	tab.css({opacity: 0}).stop(true);

	clearTimeout(this.tabFadeInTimeout);

	this.tabFadeInTimeout = setTimeout(function() {
		tab.removeClass('hidden').animate({opacity: 1});

		if (fadeInPanes) {
			tab.find('.pane').stop(true).animate({opacity: 1}, 25);
		}
	}, delay);
}
