var exec = require('cordova/exec')

module.exports = {
	login: function (url, checkLoginJs, success, failure) {
		console.log('before')
		exec(success, failure, 'LoginWV', 'login', [url, checkLoginJs])
		console.log('after')
	},
}
