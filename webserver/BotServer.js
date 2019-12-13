const request = require('request-promise-native');

class BotServer {
	constructor() {
	}

	async startBot(bot, withWantedState) {
		let data = {};

		for(var i in bot.schema.paths) {
			if (i != 'state' && i != 'wantedState' && i != 'lastChangedOn' && i != '_id' && i != '__v')
				data[i] = bot[i];
		}

		if (withWantedState)
			data['wantedState'] = withWantedState;

		await request.post(
			{
				uri: 'http://localhost:3001/bot/' + bot._id + '/start',
				form: {
					data: data
				},
				json: true
			},
			(err, res, body) => {
				if (err) { 
					return console.log(err); 
				} else {
					console.log('body = ', body);
				}
			}
		);

		return true;
	}

	async sendBotChanges(botID, changes) {
		console.log('Sending bot changes = ', changes);
		var result = true;

		await request.post(
			{
				uri: 'http://localhost:3001/bot/' + botID + '/changes',
				form: {
					changes: changes
				},
				json: true
			},
			(err, res, body) => {
				if (err) { 
					console.log('got error: ', err); 
					result = false;
				} else {
					//console.log('body = ', body);
				}
			}
		);

		return result;
	}

	async getPriceAndHoldings(botID) {
		var result = false;

		await request.post(
			{
				uri: 'http://localhost:3001/bot/' + botID + '/get-price-and-holdings',
				form: {
				},
				json: true
			},
			(err, res, body) => {
				if (err) { 
					//console.log(err); 
				} else {
					console.log('body = ', body);
					result = body;
				}
			}
		);

		return result;
	}

	async submitTrade(botID, type, price, buyAmount) {
		var result = false;

		console.log('\n\n\n\n\n\n\n **** buyAmount = ', buyAmount);

		try {
			await request.post(
				{
					uri: 'http://localhost:3001/bot/' + botID + '/submit-trade',
					form: {
						type: type,
						price: price,
						buyAmount: buyAmount
					},
					json: true
				},
				(err, res, body) => {
					if (err) { 
						//console.log(err); 
					} else {
						console.log('body = ', body);
						result = body;
					}
				}
			);
		} catch(e) {
			result = false;
		}

		return result;
	}

	async cancelOffer(botID, offerID) {
		var result = false;

		console.log('\n\n\n\n\n\n\n **** cancelOffer = ', offerID);

		try {
			await request.post(
				{
					uri: 'http://localhost:3001/bot/' + botID + '/cancel-offer',
					form: {
						offerID: offerID
					},
					json: true
				},
				(err, res, body) => {
					if (err) { 
						//console.log(err); 
					} else {
						console.log('body = ', body);
						result = body;
					}
				}
			);
		} catch(e) {
			result = false;
		}

		return result;
	}

	

}

module.exports = BotServer;