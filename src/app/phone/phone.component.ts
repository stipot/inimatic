import {
	Component,
	ViewChild,
	ElementRef,
	AfterViewInit,
	ChangeDetectorRef,
} from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms' // Make sure this import is included
import { Platform } from '@ionic/angular'
import jsQR from 'jsqr-es6'
import { addIcons } from 'ionicons'
import { close, camera, refresh, image } from 'ionicons/icons'
import { RouterLinkWithHref } from '@angular/router'
import {
	IonHeader,
	IonToolbar,
	IonTitle,
	IonContent,
	IonButton,
	IonIcon,
} from '@ionic/angular/standalone'
import { QRCodeModule } from 'angularx-qrcode'
import { io, Socket } from 'socket.io-client'
import { environment } from 'src/environments/environment'
import streamSaver from 'streamsaver'
import { Data, TransferFileData, VerifyData, SendMessageData } from 'src/types'

@Component({
	selector: 'app-phone',
	templateUrl: './phone.component.html',
	styleUrls: ['./phone.component.scss'],
	standalone: true,
	imports: [
		IonHeader,
		IonToolbar,
		IonTitle,
		IonContent,
		QRCodeModule,
		FormsModule,
		CommonModule,
		IonButton,
		IonIcon,
		RouterLinkWithHref,
	],
})
export class PhoneComponent implements AfterViewInit {
	@ViewChild('video', { static: false }) video?: ElementRef
	@ViewChild('canvas', { static: false }) canvas?: ElementRef
	@ViewChild('fileinput', { static: false }) fileinput?: ElementRef
	canvasElement: any
	videoElement: any
	canvasContext: any
	scanActive = false
	scanResult: string | undefined = undefined
	animationRequest = 0

	sessionID = '-'
	followerName = this.getDeviceId()
	isInitiator = true
	isConnected = false
	message = ''
	socket: Socket
	file: File | null = null
	writableStream: WritableStream | null = null
	writer: WritableStreamDefaultWriter<any> | null = null
	fileData: Data | null = null
	messagesLog: string[] = []

	constructor(
		private plt: Platform,
		private cdr: ChangeDetectorRef,
		private route: ActivatedRoute
	) {
		addIcons({ image, camera, refresh, close })
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

		this.socket.on('initiator_disconnect', async () => {
			if (this.writer) {
				this.writer.releaseLock()
				this.writer = null
			}

			if (this.writableStream) {
				await this.writableStream.abort()
				this.writableStream = null
			}

			this.isConnected = false
			this.cdr.detectChanges()
			this.initVideoElements()
		})

		this.socket.on('connection', (data) => {
			if (data === 'connect') {
				this.reset()
				return this.showConnectedStage()
			}

			this.receiveData(data)
		})

		if (this.route.snapshot.queryParamMap.get('sessionId')) {
			this.sessionID = this.route.snapshot.queryParamMap.get('sessionId')!
			this.connectToSession()
		}
	}

	getDeviceId() {
		let deviceId = localStorage.getItem('deviceId')

		if (!deviceId) {
			deviceId = crypto.randomUUID().slice(0, 11)
			localStorage.setItem('deviceId', deviceId)
		}

		return deviceId
	}

	async send(data: any) {
		if (!this.isConnected) {
			console.log('Peer not connected.')
			return
		}

		await new Promise((resolve) => {
			this.socket.emit(
				'conductor',
				{
					sessionId: this.sessionID,
					isInitiator: this.isInitiator,
					data: data,
				},
				() => resolve(true)
			)
		})
	}

	ngAfterViewInit() {
		if (this.isInitiator) return

		this.initVideoElements()
	}

	initVideoElements() {
		this.canvasElement = this.canvas?.nativeElement
		this.canvasContext = this.canvasElement.getContext('2d')
		this.videoElement = this.video?.nativeElement
	}

	reset() {
		this.scanResult = undefined
	}

	stopScan() {
		cancelAnimationFrame(this.animationRequest)
		this.scanActive = false
		const stream = this.videoElement.srcObject
		const tracks = stream.getTracks()
		tracks.forEach(function (track: any) {
			track.stop()
		})

		this.videoElement.srcObject = null
	}

	connectToSession() {
		if (!this.isInitiator && this.sessionID) {
			this.socket.emit('add_follower', {
				sessionId: this.sessionID,
				followerName: this.followerName,
			})
		}
	}

	showConnectedStage() {
		this.isConnected = true
		console.log('CONNECT')
		this.cdr.detectChanges()
	}

	async sendMessage() {
		await this.send({ type: 'sendMessage', message: this.message })
	}

	disconnect() {
		this.socket.emit('disconnect_follower', {
			sessionId: this.sessionID,
			isInitiator: this.isInitiator,
			followerName: this.followerName,
		})
	}

	async startScan() {
		if (this.scanActive) {
			this.stopScan()
		}
		// Not working on iOS standalone mode!
		const stream = await navigator.mediaDevices.getUserMedia({
			video: { facingMode: 'environment' },
		})
		this.videoElement.srcObject = stream
		// Required for Safari
		console.log(this.videoElement)
		this.videoElement.setAttribute('playsinline', true)

		this.videoElement.play()
		this.animationRequest = requestAnimationFrame(this.scan.bind(this))
	}

	async scan() {
		// console.log("Scan started", this.videoElement.readyState, this.videoElement.HAVE_ENOUGH_DATA, this.videoElement)
		if (
			this.videoElement.readyState === this.videoElement.HAVE_ENOUGH_DATA
		) {
			this.scanActive = true

			this.canvasElement.height = this.videoElement.videoHeight
			this.canvasElement.width = this.videoElement.videoWidth

			this.canvasContext.drawImage(
				this.videoElement,
				0,
				0,
				this.canvasElement.width,
				this.canvasElement.height
			)
			const imageData = this.canvasContext.getImageData(
				0,
				0,
				this.canvasElement.width,
				this.canvasElement.height
			)
			const code = jsQR(
				imageData.data,
				imageData.width,
				imageData.height,
				{
					inversionAttempts: 'dontInvert',
				}
			)

			if (code) {
				this.stopScan()
				this.scanActive = false
				this.scanResult = code.data
				this.sessionID = this.scanResult!.split('sessionId=')[1]
				this.connectToSession()
			} else {
				if (this.scanActive) {
					this.animationRequest = requestAnimationFrame(
						this.scan.bind(this)
					)
				}
			}
		} else {
			this.animationRequest = requestAnimationFrame(this.scan.bind(this))
		}
	}

	captureImage() {
		this.fileinput?.nativeElement.click()
	}

	handleFile(event: Event) {
		const input = event.target as HTMLInputElement
		if (!input.files?.length) {
			return
		}

		const file = input.files[0]

		const img = new Image()
		img.onload = () => {
			this.canvasContext.drawImage(
				img,
				0,
				0,
				this.canvasElement.width,
				this.canvasElement.height
			)
			const imageData = this.canvasContext.getImageData(
				0,
				0,
				this.canvasElement.width,
				this.canvasElement.height
			)
			const code = jsQR(
				imageData.data,
				imageData.width,
				imageData.height,
				{
					inversionAttempts: 'dontInvert',
				}
			)

			if (code) {
				this.scanResult = code.data
				this.sessionID = this.scanResult!.split('sessionId=')[1]
				this.connectToSession()
			}
		}
		img.src = URL.createObjectURL(file)
	}

	uploadFile(event: Event) {
		const target = event.target as HTMLInputElement
		if (!target.files || target.files.length === 0) return
		this.file = target.files[0]
	}

	async transferFile() {
		await this.send({
			type: 'transferFile',
			fileName: this.file?.name,
			size: this.file?.size,
		})

		const chunksize = 64 * 1024
		let offset = 0
		while (offset < this.file!.size) {
			const chunkfile = this.file!.slice(offset, offset + chunksize)
			const chunk = await chunkfile.arrayBuffer()
			await this.sendChunk(new Uint8Array(chunk))
			offset += chunksize
		}

		await this.send({
			type: 'transferFile',
			fileName: this.file!.name,
			size: this.file!.size,
			end: true,
		})
	}

	async sendChunk(value: Uint8Array) {
		await this.send({
			type: 'transferFile',
			fileName: this.file!.name,
			size: this.file!.size,
			content: Array.from(value),
		})
		setTimeout(() => {}, 0)
	}

	receiveData(data: any) {
		const receivedData: Data = data
		if (receivedData.type === 'transferFile') {
			this.receiveFile(receivedData)
		} else if (receivedData.type === 'sendMessage') {
			this.receiveMessage(receivedData)
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

	getRandomDigits(n: number) {
		return Array.from({ length: n }, () =>
			Math.floor(Math.random() * 10).toString()
		)
	}

	generateImage(
		digits: string[],
		imageSize: number = 400
	): HTMLCanvasElement {
		const canvas = document.createElement('canvas')
		canvas.width = imageSize
		canvas.height = imageSize
		const ctx = canvas.getContext('2d')

		if (!ctx) throw new Error()

		ctx.fillStyle = 'white'
		ctx.fillRect(0, 0, imageSize, imageSize)

		const fontSize = imageSize / 2
		ctx.font = `${fontSize}px sans-serif`
		ctx.fillStyle = 'black'

		// const textMetrics = ctx.measureText('8')
		const offsetY = 53

		const x1 = imageSize / 10
		const y1 = -offsetY / 2
		const x2 = (imageSize / 10) * 6
		const y2 = imageSize / 2 - offsetY / 2

		ctx.fillText(digits[0], x1, y1 + fontSize)
		ctx.fillText(digits[1], x2, y1 + fontSize)
		ctx.fillText(digits[2], x1, y2 + fontSize)
		ctx.fillText(digits[3], x2, y2 + fontSize)

		return canvas
	}

	convertImageToBase64() {
		return new Promise((resolve) => {
			let canvas = document.createElement('canvas')
			let img = document.createElement('img')
			img.src = 'assets/images/stub.png'
			img.onload = () => {
				canvas.height = img.height
				canvas.width = img.width
				let ctx = canvas.getContext('2d')
				ctx!.drawImage(img, 0, 0)
				resolve(canvas.toDataURL('image/png'))
			}
		})
	}

	// async sendVerificationImage() {
	// 	const imageURL = await this.convertImageToBase64()
	// 	this.peer.send(JSON.stringify({ type: 'verify', content: imageURL }))
	// }
}
