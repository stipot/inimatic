import { Component } from '@angular/core'
import {
	IonApp,
	IonRouterOutlet,
	IonTabButton,
	IonTabs,
	IonTabBar,
	IonHeader,
	IonTitle,
	IonToolbar,
	IonIcon,
} from '@ionic/angular/standalone'
import { addIcons } from 'ionicons'
import {
	lockClosedOutline,
	people,
	phonePortrait,
	settings,
} from 'ionicons/icons'
import { Platform } from '@ionic/angular'

@Component({
	selector: 'app-root',
	templateUrl: 'app.component.html',
	styleUrls: ['app.component.scss'],
	standalone: true,
	imports: [
		IonIcon,
		IonToolbar,
		IonTitle,
		IonHeader,
		IonTabBar,
		IonTabs,
		IonTabButton,
		IonApp,
	],
})
export class AppComponent {
	isAndroid: boolean
	constructor(private plt: Platform) {
		addIcons({ lockClosedOutline, people, phonePortrait, settings })
		this.isAndroid =
			this.plt.platforms().includes('mobile') &&
			!this.plt.platforms().includes('mobileweb')
	}
}
