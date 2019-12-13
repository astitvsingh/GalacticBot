var express = require('express');
var sha1 = require('sha1');
var router = express.Router();
const Bot = require('../schemas/BotSchema')
const BotLog = require('../schemas/BotLogSchema');
const BotServer = require('../BotServer')
const Utils = require('../Utils.js')
const BotOffer = require('../schemas/BotOfferSchema');
const passwordValidator = require('password-validator');

var Config = require('../Config.js');
var botServerStats = null;

// needed for testing/faking slow connection
function sleep(ms){
	return new Promise(resolve=>{
		setTimeout(resolve,ms)
	})
}

router.use(function (req, res, next) {
	let config = new Config().getInstance();

	console.log(req.originalUrl);

	const testRequest = req.originalUrl == '/api/test';

	var requestAllowed = config.getSetupStep() >= 1 && config.hasMasterPasswordInMemory();
	requestAllowed = requestAllowed || testRequest;

	if (config.getIsDemoModeEnabled() && !testRequest && req.method == 'POST') {
		if (req.body.demoModePassword == config.getDemoModePassword()) {
		} else {
			requestAllowed = false;
			console.log('*** invalid demo mode password: ', req.body.demoModePassword);
		}
	}

	if (requestAllowed) {
		next();
	} else {
		res.status(403).json({success: false});
	}
})

router.post('/test', async function(req, res, next) {
	let config = new Config().getInstance();
	var error = null;

	if (config.getSetupStep() <= 0 || !config.getSetupStep()) {
		const p1 = req.body.p1;
		const p2 = req.body.p2;
	
		if (!p1 || !p2) {
			error = "Please fill in both password fields.";
		} else if (p1 != p2) {
			error = "Please fill in the same password twice.";
		} else {
			var lengthSchema = new passwordValidator();
			var charSchema = new passwordValidator();
			
			lengthSchema
			.is().min(6)
			.is().max(100)
			.has().not().spaces();
			
			charSchema
			.has().symbols()
			.has().digits()
			.has().not().spaces();
			
			if (!lengthSchema.validate(p1)) {
				error = "Password must be at least 6 characters.";
			} else if (!charSchema.validate(p1)) {
				error = "Password must be include symbols and digits.";
			} else if (!config.setMasterPassword(p1)) {
				error = "Cannot set master password.";
			}
		}
	} else if (config.getSetupStep() == 1) {
		const p = req.body.p;

		if (p && config.setMasterPassword(p)) {
		} else if (typeof p == 'string') {
			error = "Please provide your master password.";
		}

		console.log('p = ', typeof p);
	}
	
	res.json({success: true, error: error, demoMode: config.getIsDemoModeEnabled(), gotPassword: config.hasMasterPasswordInMemory(), setupStep: config.getSetupStep()});
});

router.post('/botserver/get-master-password', async function(req, res, next) {
	let config = new Config().getInstance();
	
	try {
		if (req.body.salt == sha1(config.getSalt()))
			res.json({master: config.masterpassword})
		else
			res.status(500).json({error: 'Bye bye zwaai zwaai.'})
	} catch (err) {
		res.status(500).json({error: err.message})
	}
});

router.get('/botserver/get-master-password', async function(req, res, next) {
	let config = new Config().getInstance();
	
	try {
		if (req.body.salt == sha1(config.getSalt()))
			res.json({master: config.masterpassword})
		else
			res.status(500).json({error: 'Bye bye zwaai zwaai.'})
	} catch (err) {
		res.status(500).json({error: err.message})
	}
});

router.post('/botserver/update', async function(req, res, next) {
	try {
		botServerStats = req.body;

		res.json({success: true})
	} catch (err) {
		res.status(500).json({error: err.message})
	}
});

router.get('/bot/list', async function(req, res, next) {
	try {
		const bots = await Bot.find()
		res.json({data: bots})
	} catch (err) {
		res.status(500).json({error: err.message})
	}
});

router.post('/bot/create', async function(req, res, next) {
	const bot = new Bot({
		name: "New bot"
	});
	
	try {
		const newBot = await bot.save()
    		res.status(201).json({data: newBot})
	} catch (err) {
		res.status(500).json({error: err.message})
	}
});

router.post('/bot/:id/get-price-and-holdings', async function(req, res, next) {
	//await sleep(2000);

	const botServer = new BotServer();
	let data = await botServer.getPriceAndHoldings(req.params.id);

	res.status(201).json({data: data});
});

router.post('/bot/:id/submit-trade', async function(req, res, next) {
	//await sleep(2000);

	const botServer = new BotServer();
	let data = await botServer.submitTrade(req.params.id, req.body.type, req.body.price, req.body.buyAmount);

	res.status(201).json({data: data});
});

router.post('/bot/:id/cancel-offer', async function(req, res, next) {
	//await sleep(2000);

	const botServer = new BotServer();
	let data = await botServer.cancelOffer(req.params.id, req.body.offerID);

	res.status(201).json({data: data});
});

router.post('/bot/:id/save', async function(req, res, next) {
	try {
		const bot = await Bot.findById(req.params.id)
		
		const botServer = new BotServer();
		const result = await botServer.sendBotChanges(bot._id, req.body);
		
		for(var name in req.body) {
			var value = req.body[name];
			bot[name] = value;
		}

		await bot.save();

		res.status(201).json({data: bot})
	} catch (err) {
		res.status(500).json({error: err.message})
	}
});

router.post('/bot/:id/start', async function(req, res, next) {
	try {
		const bot = await Bot.findById(req.params.id)
		bot.wantedState = 'RUNNING';
		await bot.save();
		
		if (bot.state != bot.wantedState) {
			await BotOffer.find({botID: bot._id, state: "CANCELLED"}).deleteMany();
			await BotOffer.find({botID: bot._id, state: "FILLED"}).deleteMany();
			await BotLog.find({botID: bot._id}).deleteMany();
		}

		const botServer = new BotServer();
		await botServer.startBot(bot, bot.wantedState);

		res.status(201).json({data: bot})
	} catch (err) {
		console.log(err.message);
		res.status(500).json({error: err.message})
	}
});

router.post('/bot/:id/stop', async function(req, res, next) {
	try {
		const bot = await Bot.findById(req.params.id)
		bot.wantedState = 'STOPPED';
		await bot.save();

		const botServer = new BotServer();
		await botServer.startBot(bot, bot.wantedState);
		
		res.status(201).json({data: bot})
	} catch (err) {
		console.log(err.message);
		res.status(500).json({error: err.message})
	}
});

router.get('/bot/:id/get-data', async function(req, res, next) {
	try {
		const log = await BotLog.find({botID: req.params.id}).sort({date: -1}).limit(100);
		const offers = await BotOffer.find({botID: req.params.id}).sort({date: -1}).limit(100);
		res.status(201).json({success: true, data: {log: log, offers: offers}})
	} catch (err) {
		console.log(err.message);
		res.status(500).json({error: err.message})
	}
});

// hacky solution, would be better to track individual field changes
var sentChangesPerBot = {};

router.get('/bot/changes/:since', async function(req, res, next) {
	try {
		var since = req.params.since;

		const changedBots = await Bot.find({}).where('lastChangedOn').gte(req.params.since);
		let config = new Config().getInstance();

		var changesPerBot = {};
		var changeCount = 0;

		if (changedBots) {
			for(var i in changedBots) {
				since = Math.max(since, changedBots[i].lastChangedOn);

				var bot = Utils.modelToArray(changedBots[i]);
				var botID = changedBots[i]._id;

				bot['_id'] = botID;

				if (!sentChangesPerBot[botID])
					sentChangesPerBot[botID] = {}

				changesPerBot[botID] = {};

				for(var name in bot) {
					if (sentChangesPerBot[botID][name] != bot[name]) {
						sentChangesPerBot[botID][name] = bot[name];

						changesPerBot[botID][name] = bot[name];

						if (name == "liveWalletSecret" || name == "testnetWalletSecret") {
							var botInstance = changedBots[i];
							var sentName = name + 'Sent';

							try {
								if (botInstance[sentName] != bot[name]) {
									changesPerBot[botID][name + 'Once'] = config.decryptString(bot[name]);
									
									botInstance[sentName] = bot[name];
									await botInstance.save();
								}
							} catch(e) {
								console.log('failed to decrypt: ', e);
							}
						}

						changeCount++;
					}
				}
			}
		}

		let botLog = await BotLog.find().where('createdOn').gte(req.params.since);;

		let botOffers = await BotOffer.find().where('lastChangedOn').gte(req.params.since);

		since = Math.max(since, new Date().getTime() - 3000);

		res.status(201).json({botServerStats: botServerStats, data: {list: changesPerBot, since: since, log: botLog, offers: botOffers}})
	} catch (err) {
		console.log(err.message);
		res.status(500).json({error: err.message})
	}
});

router.post('/bot/:id/remote-changes', async function(req, res, next) {
	try {
		const bot = await Bot.findById(req.params.id)
		let gotChanges = false;

		for(var key in req.body.changes) {
			if (key != 'lastChangedOn') {
				if (bot[key] != req.body.changes[key]) {
					bot[key] = req.body.changes[key];
					
					//console.log('Got change from bot: ' + key + ': ' + bot[key]);
					
					gotChanges = true;
				}			
			}
		}

		if (gotChanges)
			await bot.save();

		for(var i in req.body.offers) {
			var offer = req.body.offers[i];
			offer.remoteOfferID = offer._id;
			offer.botID = offer.remoteID;

			var offerData = {};

			for(var name in offer)
				if (name != '_id' && name != 'remoteID')
					offerData[name] = offer[name];

			var botOffer = await BotOffer.findOne({remoteOfferID: offerData.remoteOfferID});

			if (!botOffer) {
				botOffer = new BotOffer(offerData);
			} else {
				for(var name in offerData)
					botOffer[name] = offerData[name];
			}

			await botOffer.save();
		}

		res.status(201).json({data: {success: true}})
	} catch (err) {
		console.log(err.message);
		res.status(500).json({error: err.message})
	}
});

router.post('/bot/:id/remote-log', async function(req, res, next) {
	try {
		let receivedEntries = [];

		for(var i in req.body.logEntries) {
			var data = req.body.logEntries[i];

			var logEntry = await BotLog.findOne({botID: req.params.id, referenceID: data.referenceID})
			
			if (!logEntry) {
				logEntry = new BotLog({
					botID: req.params.id,
					referenceID: data.referenceID,
					type: data.type,
					date: data.date,
					message: data.message
				});
	
				await logEntry.save();		
			}

			//console.log('logEntry = ', logEntry);

			receivedEntries.push(data.referenceID);	
		}

		res.status(201).json({data: {success: true, receivedEntries: receivedEntries}})
	} catch (err) {
		console.log(err.message);
		res.status(500).json({error: err.message})
	}
});

module.exports = router;
