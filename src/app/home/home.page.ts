import { Component, ChangeDetectorRef } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms' // Make sure this import is included
import { Platform } from '@ionic/angular'
import { addIcons } from 'ionicons'
import { close, camera, refresh, closeOutline } from 'ionicons/icons'
import { RouterLinkWithHref } from '@angular/router'
import {
	IonHeader,
	IonToolbar,
	IonTitle,
	IonContent,
	IonButton,
	IonCard,
	IonCardContent,
	IonCardTitle,
} from '@ionic/angular/standalone'
import { QRCodeModule } from 'angularx-qrcode'
import { io, Socket } from 'socket.io-client'
import { environment } from 'src/environments/environment'
import streamSaver from 'streamsaver'
import {
	Data,
	TransferFileData,
	SendMessageData,
	VerifyData,
	ConfirmationData,
} from 'src/types'

@Component({
	selector: 'app-home',
	templateUrl: 'home.page.html',
	styleUrls: ['home.page.scss'],
	standalone: true,
	imports: [
		IonCardTitle,
		IonCard,
		IonHeader,
		IonToolbar,
		IonTitle,
		IonContent,
		QRCodeModule,
		FormsModule,
		CommonModule,
		IonButton,
		RouterLinkWithHref,
	],
})
export class HomePage {
	sessionID = '-'
	incomingSignal = 'tester'
	isInitiator = true
	verificationStep = false
	isConnected = false
	followers: string[] = []
	message = ''
	socket: Socket
	verificationImage = ''
	file: File | null = null
	writableStream: WritableStream | null = null
	writer: WritableStreamDefaultWriter<any> | null = null
	fileData: Data | null = null
	messagesLog: string[] = []

	constructor(private plt: Platform, private cdr: ChangeDetectorRef) {
		addIcons({ camera, refresh, close })
		const isInStandaloneMode = () =>
			'standalone' in window.navigator && window.navigator['standalone']

		if (this.plt.is('ios') && isInStandaloneMode()) {
			console.log('I am a an iOS PWA!')
			// E.g. hide the scan functionality!
		}

		this.socket = io(environment.app_server_url, { secure: true })

		this.isInitiator = location.pathname !== '/follower'

		// mobile device detection
		// const regexp = new RegExp(/android|iphone|kindle|ipad/i)
		// this.isInitiator = !regexp.test(navigator.userAgent)
		this.socket.emit('add_initiator')

		this.socket.on('session_id', (data) => (this.sessionID = data))

		this.socket.on('follower_data', (data) => {
			this.followers.push(data)
			this.connect()
			this.showConnectedStage()
		})

		this.socket.on('follower_disconnect', (follower) => {
			this.followers = this.followers.filter(
				(followerName) => followerName !== follower
			)

			if (!this.followers.length) {
				this.isConnected = false
			}

			this.cdr.detectChanges()
		})

		this.socket.on('connection', (data) => {
			this.receiveData(data)
		})
	}

	send(data: any) {
		if (!this.isConnected) {
			console.log('socket not connected.')
			return
		}

		this.socket.emit(
			'conductor',
			JSON.stringify({
				sessionId: this.sessionID,
				isInitiator: this.isInitiator,
				data: data,
			})
		)
	}

	connect() {
		this.socket.emit(
			'conductor',
			JSON.stringify({
				sessionId: this.sessionID,
				isInitiator: this.isInitiator,
				data: 'connect',
			})
		)
	}

	showConnectedStage() {
		this.isConnected = true
		console.log('CONNECT')
		this.cdr.detectChanges()
	}

	sendMessage() {
		this.send(
			JSON.stringify({ type: 'sendMessage', message: this.message })
		)
	}

	uploadFile(event: Event) {
		const target = event.target as HTMLInputElement
		if (!target.files || target.files.length === 0) return
		this.file = target.files[0]
	}

	async transferFile() {
		this.send(
			JSON.stringify({
				type: 'transferFile',
				fileName: this.file?.name,
				size: this.file?.size,
			})
		)

		const chunksize = 64 * 1024
		let offset = 0
		while (offset < this.file!.size) {
			const chunkfile = this.file!.slice(offset, offset + chunksize)
			const chunk = await chunkfile.arrayBuffer()
			await this.sendChunk(new Uint8Array(chunk))
			offset += chunksize
		}

		this.send(
			JSON.stringify({
				type: 'transferFile',
				fileName: this.file!.name,
				size: this.file!.size,
				end: true,
			})
		)
	}

	async sendChunk(value: Uint8Array) {
		this.send(
			JSON.stringify({
				type: 'transferFile',
				fileName: this.file!.name,
				size: this.file!.size,
				content: Array.from(value),
			})
		)
	}

	receiveData(data: any) {
		const receivedData: Data = JSON.parse(data)

		if (receivedData.type === 'transferFile') {
			this.receiveFile(receivedData)
		} else if (receivedData.type === 'sendMessage') {
			this.receiveMessage(receivedData)
		} else if (receivedData.type === 'verify') {
			this.receiveVerificationImage(receivedData)
		} else if (receivedData.type === 'confirmation') {
			this.receiveConfirmationData(receivedData)
		}
	}

	receiveFile(receivedData: TransferFileData) {
		if (this.writableStream === null) {
			this.writableStream = streamSaver.createWriteStream(
				receivedData.fileName,
				{
					size: receivedData.size,
				}
			)
			this.writer = this.writableStream.getWriter()
			return
		}

		if (receivedData.end) {
			console.log('end')
			this.writer!.close()
			this.writableStream = null
			this.writer = null
			return
		}

		this.writer!.write(new Uint8Array(receivedData.content!))
	}

	receiveMessage(receivedData: SendMessageData) {
		console.log(receivedData.message)
		this.messagesLog = this.messagesLog.concat([receivedData.message])
	}

	receiveVerificationImage(receivedData: VerifyData) {
		this.verificationStep = true
		this.verificationImage = receivedData.content
		this.cdr.detectChanges()
	}

	receiveConfirmationData(receivedData: ConfirmationData) {
		if (receivedData.confirmed) {
			this.showConnectedStage()
		}
	}
}
