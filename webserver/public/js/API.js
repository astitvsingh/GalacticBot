
function API() {
}

API.prototype.list = function(what, callback) {
	var data = {demoModePassword: demoModePassword};

	$.getJSON(
		'/api/' + what + '/list',
		data,
		function(result) {
			if (!result.error)
				callback(result.data);
			else
				alert(result.error);
		}
	)
}

API.prototype.create = function(what, data, callback) {
	if (!data)
		data = {};
	data.demoModePassword = demoModePassword;

	$.post(
		'/api/' + what + '/create',
		data,
		function(result) {
			if (!result.error)
				callback(result.data);
			else
				alert(result.error);
		},
		'json'
	)
}

API.prototype.post = function(what, id, data, callback) {
	return this.perform(what, id, 'save', data, callback);
}

API.prototype.perform = function(what, id, action, data, callback) {
	if (!data)
		data = {};
	data.demoModePassword = demoModePassword;
	
	$.post(
		'/api/' + what +  '/' + id + '/' + action,
		data,
		function(result) {
			if (!result.error)
				callback(result.data);
			else
				alert(result.error);
		},
		'json'
	).fail(function(jqXHR, textStatus, errorThrown){
		callback(null);
	});;
}

API.prototype.get = function(what, id, action, data, callback) {
	if (!data)
		data = {};
	data.demoModePassword = demoModePassword;

	$.get(
		'/api/' + what +  '/' + id + '/' + action,
		data,
		function(result) {
			if (!result.error)
				callback(result.data);
			else
				alert(result.error);
		},
		'json'
	);
}
