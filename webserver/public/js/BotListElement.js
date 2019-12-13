
function BotListElement(botList, element, data) {
	var self = this;

	this.botList = botList;
	this.element = element;
	this.element.data('instance', this);

	this.data = {};
	this.setData(data);

	element.attr('id', 'bot-' + data._id)

	this.element.click(function(e) {
		e.preventDefault();
		self.select();
	})
}

BotListElement.prototype.setData = function(data) {
	for(var key in data)
		this.change(key, data[key]);
}

BotListElement.prototype.change = function(key, value) {
	this.data[key] = value;

	switch (key) {
		case "name":
				this.element.find('.label').text(this.data.name);		
				this.botList.sortList();
			break;
		case "live":
				this.element.removeClass('testnet').removeClass('live');
				this.element.addClass(this.data.live ? 'live' : 'testnet');		
			break;
		case "state":
				this.element.removeClass('state-stopped').removeClass('state-starting').removeClass('state-running');
				this.element.addClass('state-' + this.data.state.toLowerCase());
			break;
	}

	this.element.removeClass('state-changing');

	if (this.data.state != this.data.wantedState) {
		this.element.addClass('state-changing');
	}

	this.botList.sortList();
}

BotListElement.prototype.select = function() {
	botDetails.load(this, this.data);
}
