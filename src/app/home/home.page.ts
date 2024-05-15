import { Component, NgModule, ViewChild, ElementRef } from '@angular/core'
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Make sure this import is included
import { ToastController, LoadingController, Platform } from '@ionic/angular';
import jsQR, { QRCode } from 'jsqr-es6';
import { addIcons } from "ionicons";
import { close, camera } from 'ionicons/icons';

import { IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon, IonCard, IonCardContent, IonCardHeader, IonCardTitle } from '@ionic/angular/standalone'
import { QRCodeModule } from 'angularx-qrcode'
import * as SimplePeer from 'simple-peer';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, QRCodeModule, FormsModule, CommonModule, IonButton, IonIcon, IonCard, IonCardContent, IonCardHeader, IonCardTitle],
})
export class HomePage {
  @ViewChild('video', { static: false }) video?: ElementRef;
  @ViewChild('canvas', { static: false }) canvas?: ElementRef;
  @ViewChild('fileinput', { static: false }) fileinput?: ElementRef;
  canvasElement: any;
  videoElement: any;
  canvasContext: any;
  scanActive = false;
  scanResult: string | undefined = undefined;
  loading: HTMLIonLoadingElement | null = null;

  sessionID = "090988"
  private peer: SimplePeer.Instance;
  outgoingSignal: string = "";
  incomingSignal: string = "tester";
  isInitiator
  constructor(private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private plt: Platform) {
    addIcons({ close, camera });
    const isInStandaloneMode = () =>
      'standalone' in window.navigator && window.navigator['standalone'];
    if (this.plt.is('ios') && isInStandaloneMode()) {
      console.log('I am a an iOS PWA!');
      // E.g. hide the scan functionality!
    }
    this.isInitiator = location.hash !== '#init';
    console.log('Setting up peer, initiator:', this.isInitiator);
    this.peer = new SimplePeer({ initiator: this.isInitiator, trickle: false });

    this.peer.on('signal', (data: SimplePeer.SignalData) => {
      // This data needs to be sent to the other peer
      console.log('outgoingSignal:', JSON.stringify(data));
      this.outgoingSignal = JSON.stringify(data);
    });

    this.peer.on('data', (data: any) => {
      console.log('Received message:', data.toString());
    });

    this.peer.on('signal', (data: SimplePeer.SignalData) => {
      console.log('Signal data:', JSON.stringify(data));
      this.outgoingSignal = JSON.stringify(data);
    });

    this.peer.on('error', (error: any) => {
      console.error('Peer connection error:', error);
    });

    this.peer.on('icecandidate', (candidate: any) => {
      if (candidate) {
        console.log('ICE Candidate:', JSON.stringify(candidate));
        // Send this candidate to the other peer
      }
    });

  }

  ngAfterViewInit() {
    this.canvasElement = this.canvas?.nativeElement;
    this.canvasContext = this.canvasElement.getContext('2d');
    this.videoElement = this.video?.nativeElement;
  }

  // Helper functions
  async showQrToast() {
    const toast = await this.toastCtrl.create({
      message: `Open ${this.scanResult}?`,
      position: 'top',
      buttons: [
        {
          text: 'Open',
          handler: () => {
            window.open(this.scanResult, '_system', 'location=yes');
          }
        }
      ]
    });
    toast.present();
  }

  reset() {
    this.scanResult = undefined;
  }

  stopScan() {
    this.scanActive = false;
    const stream = this.videoElement.srcObject;
    const tracks = stream.getTracks();
    tracks.forEach(function (track: any) {
      track.stop();
    });

    this.videoElement.srcObject = null;
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
  async startScan() {
    // Not working on iOS standalone mode!
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });

    this.videoElement.srcObject = stream;
    // Required for Safari
    this.videoElement.setAttribute('playsinline', true);

    this.loading = await this.loadingCtrl.create({});
    await this.loading.present();

    this.videoElement.play();
    requestAnimationFrame(this.scan.bind(this));
  }

  async scan() {
    // console.log("Scan started", this.videoElement.readyState, this.videoElement.HAVE_ENOUGH_DATA, this.videoElement)
    if (this.videoElement.readyState === this.videoElement.HAVE_ENOUGH_DATA) {
      // console.log(this.loading)
      if (this.loading) {
        await this.loading.dismiss();
        this.loading = null;
        this.scanActive = true;
        // console.log(this.scanActive)
      }

      this.canvasElement.height = this.videoElement.videoHeight;
      this.canvasElement.width = this.videoElement.videoWidth;

      this.canvasContext.drawImage(
        this.videoElement,
        0,
        0,
        this.canvasElement.width,
        this.canvasElement.height
      );
      const imageData = this.canvasContext.getImageData(
        0,
        0,
        this.canvasElement.width,
        this.canvasElement.height
      );
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code) {
        this.scanActive = false;
        this.scanResult = code.data;
        this.showQrToast();
      } else {
        if (this.scanActive) {
          requestAnimationFrame(this.scan.bind(this));
        }
      }
    } else {
      requestAnimationFrame(this.scan.bind(this));
    }
  }
  captureImage() {
    this.fileinput?.nativeElement.click();
  }

  handleFile(event: Event) {
    const input = event.target as HTMLInputElement
    if (!input.files?.length) {
      return;
    }

    const file = input.files[0];

    var img = new Image();
    img.onload = () => {
      this.canvasContext.drawImage(img, 0, 0, this.canvasElement.width, this.canvasElement.height);
      const imageData = this.canvasContext.getImageData(
        0,
        0,
        this.canvasElement.width,
        this.canvasElement.height
      );
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code) {
        this.scanResult = code.data;
        this.showQrToast();
      }
    };
    img.src = URL.createObjectURL(file);
  }
}
