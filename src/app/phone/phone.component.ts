import {
	Component,
	ViewChild,
	ElementRef,
	AfterViewInit,
	signal,
	ChangeDetectorRef,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms' // Make sure this import is included
import { LoadingController, Platform } from '@ionic/angular'
import jsQR from 'jsqr-es6'
import { addIcons } from 'ionicons'
import { close, camera, refresh } from 'ionicons/icons'
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
import SimplePeer from 'simple-peer'
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
	loading: HTMLIonLoadingElement | null = null

	sessionID = '-'
	private peer: SimplePeer.Instance
	outgoingSignal = ''
	incomingSignal = 'tester'
	isInitiator = true
	isConnected = signal(false)
	initiatorSignalData = ''
	followerSignalData = ''
	message = ''
	socket: Socket
	file: File | null = null
	writableStream: WritableStream | null = null
	writer: WritableStreamDefaultWriter<any> | null = null
	fileData: Data | null = null
	messagesLog: string[] = []
	constructor(
		private loadingCtrl: LoadingController,
		private plt: Platform,
		private cdr: ChangeDetectorRef
	) {
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

		console.log('Setting up peer, initiator:', this.isInitiator)
		this.peer = new SimplePeer({
			initiator: this.isInitiator,
			trickle: false,
		})

		this.peer.on('signal', (data: SimplePeer.SignalData) => {
			// This data needs to be sent to the other peer
			console.log('outgoingSignal:', JSON.stringify(data))
			this.outgoingSignal = JSON.stringify(data)
			if (this.isInitiator) {
				this.initiatorSignalData = JSON.stringify(data)
				this.socket.emit('add_initiator', this.initiatorSignalData)
			} else {
				this.followerSignalData = JSON.stringify(data)
				this.socket.emit(
					'add_follower',
					JSON.stringify({
						follower: this.followerSignalData,
						sessionId: this.sessionID,
					})
				)
			}
		})

		this.peer.on('connect', () => {
			this.isConnected.set(true)
			console.log('CONNECT')
			this.cdr.detectChanges()
			this.stopScan()
		})

		this.peer.on('data', async (data: any) => {
			const receivedData: Data = JSON.parse(data)
			if (receivedData.type === 'transferFile') {
				this.receiveFile(receivedData)
			} else if (receivedData.type === 'sendMessage') {
				this.receiveMessage(receivedData)
			}
		})

		this.peer.on('error', (error: any) => {
			console.error('Peer connection error:', error)
			this.isConnected.set(false)
			cdr.detectChanges()
		})

		this.peer.on('icecandidate', (candidate: any) => {
			if (candidate) {
				console.log('ICE Candidate:', JSON.stringify(candidate))
				// Send this candidate to the other peer
			}
		})

		this.socket.on('session_id', (data) => (this.sessionID = data))

		this.socket.on('follower_data', (data) => {
			this.followerSignalData = data
			this.peer.signal(this.followerSignalData)
		})

		this.socket.on('initiator_data', (data) => {
			this.initiatorSignalData = data
			this.peer.signal(this.initiatorSignalData)
		})
	}

	// Если инициатор.
	/*
	 * После получения параметров розетка отправить их на сервер и получить идентификатор
	 * Отобразить QR https://inimatic.com?node=user&cid=____
	 * Ожидать подключения через розетку
	 * Варианты запросов через розетку:
	 * 1. type: "verify", content: img_base64
	 * Вместо QR показать img
	 * Ждать следующего запроса
	 * 2. type: "confirmed", content: "User name"
	 * Вместо картинки пишем: Добрый день, username! Жду указаний
	 * 3. type: "openURL", content: "url", cookie: data
	 * Если cookie - сохранить
	 * Открыть ссылку в именованном окне
	 * 4. type: "transferFile", content: data, type: type
	 * После получения data сохранить их на диск
	 */
	/*
	Я пишу сервер для установки socket соединения между двумя веб страницами.
	* Напиши typescript сервер со следующим API
	1. Подключение к базе данных
	2. https://inimatic.com/api?oper:getcid&params={first socket data}
	- Сохраняем в базу данных first socket data с ключем случайного GUID, время записи
	- в ответ отправляем guid записи
	3. https://inimatic.com/api?oper:getparams&cid=guid
	- проверяем наличие запиши в БД, если прошло времени меньше заданного, возвращаем параметры  socket соединения. Иначе сообщение об ошибке: запись отсутствует, запись устарела соответствующими кодами.
	*/
	ngAfterViewInit() {
		if (this.isInitiator) return

		this.canvasElement = this.canvas?.nativeElement
		this.canvasContext = this.canvasElement.getContext('2d')
		this.videoElement = this.video?.nativeElement
	}

	reset() {
		this.scanResult = undefined
	}

	stopScan() {
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
			this.socket.emit('get_initiator', this.sessionID)
		}
	}

	send() {
		if (this.peer.connected) {
			this.peer.send(
				JSON.stringify({ type: 'sendMessage', message: this.message })
			)
		} else {
			console.log('Peer not connected.')
			// Optionally, handle reconnection or display a message to the user
		}
	}

	async startScan() {
		// Not working on iOS standalone mode!
		const stream = await navigator.mediaDevices.getUserMedia({
			video: { facingMode: 'environment' },
		})
		this.videoElement.srcObject = stream
		// Required for Safari
		console.log(this.videoElement)
		this.videoElement.setAttribute('playsinline', true)

		this.loading = await this.loadingCtrl.create({})
		await this.loading.present()

		this.videoElement.play()
		requestAnimationFrame(this.scan.bind(this))
	}

	async scan() {
		// console.log("Scan started", this.videoElement.readyState, this.videoElement.HAVE_ENOUGH_DATA, this.videoElement)
		if (
			this.videoElement.readyState === this.videoElement.HAVE_ENOUGH_DATA
		) {
			// console.log(this.loading)
			if (this.loading) {
				await this.loading.dismiss()
				this.loading = null
				this.scanActive = true
				// console.log(this.scanActive)
			}

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
				this.scanActive = false
				this.scanResult = code.data
				this.sessionID = this.scanResult!
				this.connectToSession()
			} else {
				if (this.scanActive) {
					requestAnimationFrame(this.scan.bind(this))
				}
			}
		} else {
			requestAnimationFrame(this.scan.bind(this))
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
				this.sessionID = this.scanResult!
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
		this.peer.send(
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

		this.peer.send(
			JSON.stringify({
				type: 'transferFile',
				fileName: this.file!.name,
				size: this.file!.size,
				end: true,
			})
		)
	}

	async sendChunk(value: Uint8Array) {
		while (this.peer.bufferSize + value.byteLength > 1024 * 1024) {
			await new Promise((resolve) => setTimeout(resolve, 50))
		}

		this.peer.send(
			JSON.stringify({
				type: 'transferFile',
				fileName: this.file!.name,
				size: this.file!.size,
				content: Array.from(value),
			})
		)
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
}
