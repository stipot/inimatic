import { Routes } from '@angular/router'

export const routes: Routes = [
	{
		path: 'private',
		loadComponent: () =>
			import('./private-point/private-point.page').then(
				(m) => m.PrivatePointPage
			),
	},
	{
		path: 'public',
		loadComponent: () =>
			import('./public-point/public-point.component').then(
				(m) => m.PublicPointComponent
			),
	},
	{
		path: 'follower',
		loadComponent: () =>
			import('./phone/phone.component').then((m) => m.PhoneComponent),
	},
	{
		path: '',
		redirectTo: '/private',
		pathMatch: 'full',
	},
]
