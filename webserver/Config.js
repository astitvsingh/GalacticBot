var process = require('process');
const fs = require('fs');
var sha1 = require('sha1');
let crypto;

try {
	crypto = require('crypto');
} catch (err) {
	console.log('Crypto support is unavailable!');
	process.exit();
}

class Config {
	constructor() {
		this.config = null;
		this.masterpassword = null;
	}

	getHorizonServerURL(onLive) {
		return onLive ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org';
	}

	setMasterPassword(password) {
		if (!this.masterpassword && !this.config.setup.mph) {
			this.masterpassword = password;

			if (this.getSetupStep() <= 0 || !this.getSetupStep()) {
				this.config.setup.step = 1;
				this.config.setup.mph = sha1(password);
				this.save();
			}

			return true;
		} else if (password && this.config.setup.mph == sha1(password)) {
			this.masterpassword = password;
			return true;
		}
		
		return false;
	}

	hasMasterPasswordInMemory() {
		return this.masterpassword ? true : false;
	}

	hadMasterPasswordSet() {
		return this.config.setup.mph && this.config.setup.step >= 1;
	}

	getSetupStep() {
		return parseInt(this.config.setup.step) ? parseInt(this.config.setup.step) : 0;
	}

	getSSLSettings() {
		return this.config.ssl;
	}

	getWebserverURL() {
		return this.config.ssl.enabled ? 'https://galacticbot.com:3000' : 'http://localhost:3000';
	}

	load() {
		let rawdata = null;
		try {
			rawdata = fs.readFileSync(__dirname + '/../config.json');
		} catch(e) {
			rawdata = fs.readFileSync(__dirname + '/../config.example.json');
		}
		
		this.config = JSON.parse(rawdata);
		
		if (!this.config.crypto.salt) {
			this.config.crypto.salt = crypto.randomBytes(16).toString('hex');
		}

		if (!this.config.setup)
			this.config.setup = {};

		if (!this.config.ssl)
			this.config.ssl = {};

		if (this.config.mph) {
			console.log('********** Master password is set in config. Use this at your own risk. **********');
			this.setMasterPassword(this.config.mph);
		}

		this.save();
	}

	getSalt() {
		return this.config.crypto.salt;
	}

	getDemoModePassword() {
		return this.config.demoModePassword;
	}

	getIsDemoModeEnabled() {
		return this.config.demoModePassword ? true : false;
	}

	save() {
		let data = JSON.stringify(this.config);
		fs.writeFileSync(__dirname + '/../config.json', data);

		// Create a copy of the config without the encryption salt so we keep the example config up to date
		var configCopy = JSON.parse(JSON.stringify(this.config));
		configCopy.crypto.salt = '';
		configCopy.setup.step = '';
		configCopy.setup.mph = '';
		configCopy.mph = '';
		configCopy.demoModePassword = '';
		configCopy.ssl.enabled = false;
		configCopy.ssl.keyFile = '';
		configCopy.ssl.certificateFile = '';
		
		data = JSON.stringify(configCopy);
		fs.writeFileSync(__dirname + '/../config.example.json', data);
	}

	encryptString(str) {
		const key = crypto.scryptSync(this.masterpassword, this.config.crypto.salt, 24);
		const iv = Buffer.alloc(16, 0);
		const cipher = crypto.createCipheriv(this.config.crypto.algorithm, key, iv);

		let encrypted = cipher.update(str, 'utf8', 'hex');
		encrypted += cipher.final('hex');
		return encrypted;
	}

	decryptString(encrypted) {
		if (!encrypted)
			return encrypted;

		try {
			const key = crypto.scryptSync(this.masterpassword, this.config.crypto.salt, 24);
			const iv = Buffer.alloc(16, 0);
			const decipher = crypto.createDecipheriv(this.config.crypto.algorithm, key, iv);
			
			let decrypted = decipher.update(encrypted, 'hex', 'utf8');
			decrypted += decipher.final('utf8');
			return decrypted;
		} catch(e) {
			console.log('Failed to decrypt: ', encrypted);
			return null;
		}
	}
}

class Singleton {
	constructor() {
	    if (!Singleton.instance) {
		   Singleton.instance = new Config();
	    }
	}
   
	getInstance() {
	    return Singleton.instance;
	}
 }
   
module.exports = Singleton;