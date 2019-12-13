const mongoose = require('mongoose')

const BotLogSchema = new mongoose.Schema({
	referenceID: {
		type: String,
		required: true,
		tags: { type: [String], index: true }
	},
	botID: {
		type: String,
		required: true
	},
	type: {
		type: String,
		required: true
	},
	message: {
		type: Array,
		required: true
	},
	date: {
		type: Date,
		required: true,
		default: 0,
		tags: { type: [Date], index: true }
	},
	createdOn: {
		type: Number,
		required: false,
		default: 0,
		tags: { type: [Number], index: true }
	}
})

BotLogSchema.pre(
	"save",
	function(next) {
		this.createdOn = new Date().getTime();

		next();
	}
);

BotLogModel = mongoose.model('BotLogSchema', BotLogSchema)

module.exports = BotLogModel