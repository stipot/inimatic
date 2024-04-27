import { Component } from '@angular/core'
import { IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/angular/standalone'
import { QRCodeModule } from 'angularx-qrcode'

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, QRCodeModule],
})
export class HomePage {
  sessionID = "090988"
  constructor() {}
}
