function BotList() {
	this.listElements = {};
	this.template = $('.bot.template').clone().removeClass('template');
	$('.bot.template').remove();

	this.firstLoad = true;
	
	this.load();
}

BotList.prototype.load = function() {
	var self = this;

	api.list(
		'bot',
		function(list) {
			for(var i in list) {
				var item = self.add(list[i]);
			}

			if (self.firstLoad) {
				self.firstLoad = false;

				var instance = $('#navigation .bot').first().data('instance');

				if (instance)
					instance.select();
			}
		}
	);
}

BotList.prototype.sortList = function() {
	var elements = $('#navigation .bot.live');
	
	elements.sort(function(a, b) {
		a = $(a).find(".label").text();
		b = $(b).find(".label").text();
		
		return a.localeCompare(b);
	 });

	 elements.insertAfter($('#section-bots-live'));

	 var elements = $('#navigation .bot.testnet');
	
	elements.sort(function(a, b) {
		a = $(a).find(".label").text();
		b = $(b).find(".label").text();
		
		return a.localeCompare(b);
	 });

	 elements.insertAfter($('#section-bots-testnet'));
}

BotList.prototype.add = function(data) {
	var element = this.template.clone().insertAfter(data.live ? $('#section-bots-live') : $('#section-bots-testnet'));
	this.listElements[data._id] = new BotListElement(this, element, data);

	this.sortList();

	return this.listElements[data._id];
}
