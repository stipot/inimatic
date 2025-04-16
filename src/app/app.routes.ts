import { Routes } from '@angular/router'

export const routes: Routes = [
	{
		path: 'home',
		loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
	},
	{
		path: 'distribution',
		loadComponent: () =>
			import('./distribution/distribution.component').then(
				(m) => m.DistributionComponent
			),
	},
	{
		path: 'follower',
		loadComponent: () =>
			import('./phone/phone.component').then((m) => m.PhoneComponent),
	},
	{
		path: '',
		loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
	},
]
