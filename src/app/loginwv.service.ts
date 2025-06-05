import { Injectable } from '@angular/core'

interface ILoginWV {
	login: (
		url: string,
		checkLoginJs: string,
		success: (result: any) => void,
		failure: (err: any) => void
	) => {}
}

@Injectable({
	providedIn: 'root',
})
export class LoginWVService {
	async openLoginPage(url: string, checkLoginJs: string) {
		let res = await new Promise((resolve, reject) => {
			console.log('login')
			;((window as any).LoginWV as ILoginWV).login(
				url,
				checkLoginJs,
				(cookieString: any) => {
					console.log(cookieString)

					resolve(cookieString)
				},
				(err: any) => {
					reject(err)
				}
			)
		})
		return res
	}
}
