const StellarSdk = require('stellar-sdk');

class Utils {

}

Utils.assetToString = function(asset) {
	return asset.getCode() + '-' + (asset.getIssuer() ? asset.getIssuer() : '');
}

Utils.zeroPad = function(n, width, z) {
	z = z || '0';
	n = n + '';
	return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

Utils.assetInfoToAsset = function(type, issuer) {
	issuer = new String(issuer).trim();

	if (type == 'XLM' && issuer.length == 0)
		return new StellarSdk.Asset.native();
	else if (type && issuer)
		return new StellarSdk.Asset(type, issuer);
	
	return null;
}

Utils.getSortedAssetCombo = function(live, baseAsset, counterAsset) {
	var asset1Name = baseAsset.getCode() + '-' + (baseAsset.getIssuer() ? baseAsset.getIssuer() : '');
	var asset2Name = counterAsset.getCode() + '-' + (counterAsset.getIssuer() ? counterAsset.getIssuer() : '');
	var assetNames = [asset1Name, asset2Name].sort();
	return {
		ID: (live ? 'live-' : 'test-') + assetNames[0] + '-' + assetNames[1],
		firstAsset: assetNames[0] == asset1Name ? baseAsset : counterAsset,
		secondAsset: assetNames[1] == asset2Name ? counterAsset : baseAsset,
	};
}

Utils.modelToArray = function(model) {
	let data = {};

	for(var i in model.schema.paths) {
		if (i != '_id' && i != '__v')
			data[i] = model[i];
	}

	return data;
}

module.exports = Utils