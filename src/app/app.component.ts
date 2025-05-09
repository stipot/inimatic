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
	library,
	playCircle,
	radio,
	search,
	lockClosedOutline,
	people,
	phonePortrait,
	settings,
} from 'ionicons/icons'

@Component({
	selector: 'app-root',
	templateUrl: 'app.component.html',
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
	constructor() {
		addIcons({ lockClosedOutline, people, phonePortrait, settings })
	}
}
