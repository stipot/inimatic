// chrome.tabs.create({ url: 'https://ya.ru' })
// chrome.cookies.set({
// 	url: 'https://ya.ru',
// 	// domain: 'ya.ru',
// 	name: 'test_kuka1111',
// 	value: 'cookie_value',
// })

console.log(chrome.runtime.id)

chrome.runtime.onMessage.addListener(({ type, body }) => {
	console.log(type, body)
	if (type === 'set_session') {
		console.log(body)
		const cookies = JSON.parse(body.cookies)

		removeCookies(body.url)
			.then(() => setCookies(body.url, cookies))
			.then(() => chrome.tabs.create({ url: body.url }))
			.then(() => setCookies(body.url, cookies))
	}
})

function removeCookies(url) {
	const parsedURL = new URL(url)
	const promisses = []
	console.log(parsedURL.hostname)

	return chrome.cookies
		.getAll({ domain: parsedURL.hostname })
		.then((cookies) => {
			console.log(cookies)

			for (let i = 0; i < cookies.length; i++) {
				console.log(
					parsedURL.protocol +
						'//' +
						parsedURL.hostname +
						cookies[i].path
				)

				promisses.push(
					chrome.cookies.remove({
						url:
							parsedURL.protocol +
							'//' +
							parsedURL.hostname +
							cookies[i].path,
						name: cookies[i].name,
					})
				)
			}
			console.log('remove cookies:', promisses.length)
			return Promise.all(promisses)
		})
}

function setCookies(url, cookies) {
	const promisses = []

	for (let cookieName in cookies) {
		const domain = '.' + new URL(url).hostname
		const now = new Date()
		const future = new Date(now)
		future.setFullYear(now.getFullYear() + 1)
		const cookieParams = {
			name: cookieName,
			value: cookies[cookieName].value,
			url: url,
			domain: domain,
			expirationDate: Math.floor(future.getTime() / 1000),
		}
		console.log(cookieName, cookies[cookieName])

		// if ('domain' in cookies[cookieName]) {
		// 	cookieParams['domain'] = cookies[cookieName].domain
		// }
		if ('path' in cookies[cookieName]) {
			cookieParams['path'] = cookies[cookieName].path
		}
		// if ('secure' in cookies[cookieName]) {
		// 	cookieParams['secure'] = cookies[cookieName].secure === 'true'
		// }
		if ('httpOnly' in cookies[cookieName]) {
			cookieParams['httpOnly'] = cookies[cookieName].httpOnly === 'true'
		}

		promisses.push(chrome.cookies.set(cookieParams))
	}
	console.log('set cookies:', promisses.length)

	return Promise.all(promisses)
}
