
var botDataStore = {};

function onBotLog(ID, entry) {
	if (botDetails && botDetails.data && botDetails.data._id == ID) {
		botDetails.onLogEntry(entry);
	}
}

function onBotOffer(ID, entry) {
	if (botDetails && botDetails.data && botDetails.data._id == ID) {
		botDetails.onOffer(entry);
	}
}

function onBotDataChange(ID, data) {
	var instance = $('.option.bot[id=bot-' + ID + ']').data('instance');
	var details = botDetails.getID() == ID ? botDetails : null;

	if (!botDataStore[ID])
		botDataStore[ID] = {};

	for(var key in data) {
		var value = data[key];

		//console.log(ID, " <- ID", key, '=', data[key], 'in store:', botDataStore[ID][key]);

		if (botDataStore[ID][key] != value) {
			if (details)
				details.change(key, value);

			if (instance)
				instance.change(key, value);

			botDataStore[ID][key] = value;
		}
	}
}

function Updater() {
	var self = this;

	self.cpuUsagePerInstance = {};
	self.memoryUsagePerInstance = {};
	self.botServerStats = null;
	
	self.since = new Date().getTime()-2;
	setInterval(function() { self.update(); }, 5000);
	self.update();
}

Updater.prototype.updateCPUUsage = function() {
	var usage = 0;
	var memory = 0;
	var countCPU = 0;
	var countMem = 0;
	var self = this;

	for(var ID in self.cpuUsagePerInstance) {
		usage += self.cpuUsagePerInstance[ID];
		countCPU++;
	}

	for(var ID in self.memoryUsagePerInstance) {
		memory += self.memoryUsagePerInstance[ID];
		countMem++;
	}

	var count = Math.max(countMem, countCPU);

	usage = Math.round(100*usage)/100;
	memory = Math.round(100*memory)/100;

	$('#system-cpu-usage').text(count ? usage : '...');
	$('#system-memory-usage').text(count ? memory : '...');

	if (this.botServerStats) {
		this.botServerStats.botProccessCount = 2;
		$('#system-bot-count').text(parseInt(this.botServerStats.botProccessCount) == 1 ? "1 bot" : parseInt(this.botServerStats.botProccessCount) + " bots");
	}
}

Updater.prototype.update = function() {
	var self = this;

	if (self.updating)
		return;

	self.updating = true;

	$.getJSON(
		'/api/bot/changes/' + self.since,
		function(result) {
			if (!result.error) {
				self.botServerStats = result.botServerStats;

				for(var i in result.data.list) {
					onBotDataChange(result.data.list[i]._id, result.data.list[i]);

					if (result.data.list[i].state == 'CRASHED' || result.data.list[i].state == 'STOPPED') {
						self.cpuUsagePerInstance[result.data.list[i]._id] = 0;
						self.memoryUsagePerInstance[result.data.list[i]._id] = 0;
					} else {
						if (result.data.list[i].systemResourcesCPUUsage) {
							self.cpuUsagePerInstance[result.data.list[i]._id] = parseFloat(result.data.list[i].systemResourcesCPUUsage);
						}
						if (result.data.list[i].systemResourcesMemoryUsage) {
							self.memoryUsagePerInstance[result.data.list[i]._id] = parseFloat(result.data.list[i].systemResourcesMemoryUsage);
						}
					}
				}

				for(var i in result.data.log) {
					onBotLog(result.data.log[i].botID, result.data.log[i]);
				}

				for(var i in result.data.offers) {
					onBotOffer(result.data.offers[i].botID, result.data.offers[i]);
				}

				self.since = parseInt(result.data.since);

				self.updateCPUUsage();
			} else {
				alert(result.error);
			}
				
			self.updating = false;
		}
	).fail(function(jqXHR, textStatus, errorThrown) {
		self.updating = false;

		console.log("Error while fetching updates. Will try again later.");
	});
}

