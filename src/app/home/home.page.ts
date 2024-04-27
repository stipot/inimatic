import { Component, NgModule } from '@angular/core'
import { FormsModule } from '@angular/forms'; // Make sure this import is included

import { IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/angular/standalone'
import { QRCodeModule } from 'angularx-qrcode'
import * as SimplePeer from 'simple-peer';


@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, QRCodeModule, FormsModule],
})
export class HomePage {
  sessionID = "090988"
  private peer: SimplePeer.Instance;
  outgoingSignal: string = "";
  incomingSignal: string = "tester";
  constructor() {
    const isInitiator = location.hash === '#init';
    console.log('Setting up peer, initiator:', isInitiator);
    this.peer = new SimplePeer({ initiator: isInitiator, trickle: false });

    this.peer.on('signal', (data: SimplePeer.SignalData) => {
      // This data needs to be sent to the other peer
      console.log('outgoingSignal:', JSON.stringify(data));
      this.outgoingSignal = JSON.stringify(data);
    });

    this.peer.on('data', data => {
      console.log('Received message:', data.toString());
    });

    this.peer.on('signal', (data: SimplePeer.SignalData) => {
      console.log('Signal data:', JSON.stringify(data));
      this.outgoingSignal = JSON.stringify(data);
    });

    this.peer.on('error', error => {
      console.error('Peer connection error:', error);
    });

    this.peer.on('icecandidate', candidate => {
  if (candidate) {
    console.log('ICE Candidate:', JSON.stringify(candidate));
    // Send this candidate to the other peer
  }
});


  }


  connect() {
    if (this.incomingSignal) {
      console.log('Incoming signal data:', this.incomingSignal);
      try {
        const signal = JSON.parse(this.incomingSignal) as SimplePeer.SignalData;
        this.peer.signal(signal);
      } catch (error) {
        console.error('Error parsing incoming signal data:', error);
      }
    }
  }

  send() {
    if (this.peer.connected) {
      this.peer.send('Hello again!');
    } else {
      console.log('Peer not connected.');
      // Optionally, handle reconnection or display a message to the user
    }
  }


  copyToClipboard(data: string) {
    navigator.clipboard.writeText(data).then(
      () => console.log('Copying to clipboard was successful!', data),
      (err) => console.error('Could not copy text: ', err)
    );
  }

}
