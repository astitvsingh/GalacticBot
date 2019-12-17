"use strict";

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const request = require('request');
const logger = require('morgan');

const BotList = require('./BotList.js');
const BotInstance = require('./schemas/BotSchema')
const BotOffer = require('./schemas/BotOfferSchema')
const AccountInfo = require('./schemas/AccountInfoSchema');
const Price = require('./schemas/PriceSchema')

const mongoose = require('mongoose');
const sha1 = require('sha1')

const botList = new BotList();

const Config = require('../webserver/Config.js');
const Utils = require('../webserver/Utils.js');

var config = new Config().getInstance();

mongoose.connect('mongodb://localhost:27017/galacticbot', { useNewUrlParser: true })
const db = mongoose.connection;

db.on('error', function(error) { console.log("Cannot connect to database."); process.exit(); });
db.once('open', () => {
	console.log('Connected to database.');
	
	// resumeBots();

	fetchMasterPassword();
})

app.use(bodyParser());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.post('/bot/:botID/start', async function (req, res) {
	var result = await botList.addAndStartBotByRemoteID(req.params.botID, 0, req.body.data);	  
	res.json({success: result});
})

app.post('/bot/:botID/changes', async function (req, res) {
	let success = false;

	let bot = botList.getBotByID(req.params.botID);

	if (!bot) {
		console.log('Bot isn\'t forked yet. Forking now.');

		await startBotByRemoteID(req.params.botID);
	}

	bot = botList.getBotByID(req.params.botID);

	if (bot) {
		bot.sendRemoteChanges(req.body.changes);
		success = true;
	}

	res.json({success: success});
})

app.post('/bot/:botID/submit-trade', async function (req, res) {
	let success = false;
	
	let bot = botList.getBotByID(req.params.botID);

	if (!bot) {
		console.log('Bot isn\'t forked yet. Forking now.');

		await startBotByRemoteID(req.params.botID);
	}

	bot = botList.getBotByID(req.params.botID);

	if (bot) {
		success = bot.submitTrade(req.body.type, req.body.price, req.body.buyAmount);
	}

	res.json({success: success});
})

app.post('/bot/:botID/cancel-offer', async function (req, res) {
	let success = false;
	
	let bot = botList.getBotByID(req.params.botID);

	if (!bot) {
		console.log('Bot isn\'t forked yet. Forking now.');

		await startBotByRemoteID(req.params.botID);
	}

	bot = botList.getBotByID(req.params.botID);

	if (bot) {
		const offer = await BotOffer.findById(req.body.offerID);

		if (offer)
			success = bot.cancelOffer(offer.offerID);
	}

	res.json({success: success});
})

app.post('/bot/:botID/get-price-and-holdings', async function (req, res) {
	let currentPrice = null;
	let bot = botList.getBotByID(req.params.botID);
	let data = null;

	if (!bot) {
		console.log('Bot isn\'t forked yet. Forking now.');

		await startBotByRemoteID(req.params.botID);
	}

	bot = botList.getBotByID(req.params.botID);

	if (bot) {
		let instance = await BotInstance.findOne({ remoteID: req.params.botID });
		let baseAsset = instance.live ? Utils.assetInfoToAsset(instance.liveBaseassetType, instance.liveBaseassetIssuer) : Utils.assetInfoToAsset(instance.testnetBaseassetType, instance.testnetBaseassetIssuer);
		let counterAsset = instance.live ? Utils.assetInfoToAsset(instance.liveCounterassetType, instance.liveCounterassetIssuer) : Utils.assetInfoToAsset(instance.testnetCounterassetType, instance.testnetCounterassetIssuer);
		currentPrice = await Price.getCurrentPrice(instance.live, baseAsset, counterAsset);

		let accountInfo = await AccountInfo.findOne({ publicKey: instance.live ? instance.liveWalletPublic : instance.testnetWalletPublic });

		data = {
			price: currentPrice,
			baseAssetBalance: accountInfo ? accountInfo.getBalanceForAsset(baseAsset) : null,
			counterAssetBalance: accountInfo ? accountInfo.getBalanceForAsset(counterAsset) : null,
		};
	} else {
		return res.json({success: false});
	}

	res.json({success: true, data: data});
})

app.get('/bot/:botID/stop', function (req, res) {
	var ID = req.params.botID;

	if (botList.getBotByID(ID)) {
		botList.stopBotByID(ID);
		res.json({success: true});
		return;
	}
	
	res.json({success: false, error: `Bot with ID '${ID}' not found.`});
})

async function startBotByRemoteID(remoteID, delay) {
	console.log('Start bot #' + remoteID + ', after a delay of ' + (delay ? delay : 0) + ' seconds.');
	await botList.addAndStartBotByRemoteID(remoteID, delay);
}

function resumeBots() {
	try {
		let startedBotsByID = {};

		// don't start all the bots at the same time
		// (poor man's attempt at spreading the load of the bots)
		let delay = 0;
		const interval = 1;

		BotInstance.find(
			{},
			async function(err, botInstances) {
				if (botInstances) {
					for(var i in botInstances) {
						var shouldStartBot = botInstances[i].wantedState == 'RUNNING';
						
						if (!shouldStartBot && botInstances[i].botInstanceOfferID) {
							var currentOffer = await BotOffer.findById(botInstances[i].botInstanceOfferID);
							
							if (currentOffer && currentOffer.state == BotOffer.STATE_OPEN) {
								shouldStartBot = true;
							}						
						}

						if (shouldStartBot) {
							console.log('Resuming bot ' + botInstances[i].remoteID + ' - ' + botInstances[i].name);
							
							startBotByRemoteID(botInstances[i].remoteID, delay);

							startedBotsByID[botInstances[i].remoteID] = true;

							delay += interval;
						}
					}
				}
			}
		);
	} catch (err) {
		console.log(err.message);
	}
}

function fetchMasterPassword() {
	let config = new Config().getInstance();
	config.load();

	request.get(
		{
			"rejectUnauthorized": false, // temp to make ssl 'work'
			uri: config.getWebserverURL() + '/api/botserver/get-master-password',
			form: {
				demoModePassword: new Config().getInstance().getDemoModePassword(),
				salt: sha1(config.getSalt())
			},
			json: true
		},
		(err, res, body) => {
			if (err || (!body || !body.master)) { 
				console.log('Cant get master password. Retrying in a few seconds.'); 

				setTimeout(function() { fetchMasterPassword(); }, 2000);
			} else {
				console.log('Got master password.');

				
				config.load();
				config.setMasterPassword(body.master);

				resumeBots();
			}
		}
	);
 }

module.exports = app