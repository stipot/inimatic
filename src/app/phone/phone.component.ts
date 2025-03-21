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
import { Data, TransferFileData, SendMessageData } from 'src/types'
import * as tf from '@tensorflow/tfjs'
interface Point {
	x: number
	y: number
}
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
	verifImageCanvas = document.createElement('canvas')
	verifImageCanvasCtx = this.verifImageCanvas.getContext('2d')
	cropCanvas = document.createElement('canvas')
	cropCanvasCtx = this.cropCanvas.getContext('2d')
	resizedCanvas = document.createElement('canvas')
	resizedCtx = this.resizedCanvas.getContext('2d')

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
	model: tf.GraphModel | null = null
	verificationStep = false
	predictedDigits: string[] = []
	digits: string[] = []
	croppedImage = ''

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
			this.receiveData(data)
		})

		tf.loadGraphModel('assets/model/model.json').then((tfModel) => {
			this.model = tfModel
			if (this.route.snapshot.queryParamMap.get('sessionId')) {
				this.sessionID =
					this.route.snapshot.queryParamMap.get('sessionId')!
				this.enterToSession()
				this.sendVerifImage()
				this.startScan()
			}
		})
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

	enterToSession() {
		if (!this.isInitiator && this.sessionID) {
			this.socket.emit('add_follower', {
				sessionId: this.sessionID,
				followerName: this.followerName,
			})
		}
	}

	connectToSession() {
		this.socket.emit('session_connect', this.sessionID)
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
		// console.log(this.videoElement)
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

			if (this.verificationStep) {
				const imageData = this.handleVerifImage(
					this.videoElement,
					this.videoElement.videoWidth,
					this.videoElement.videoHeight
				)

				if (imageData) {
					this.predictedDigits = this.predictDigits(imageData)
					if (
						JSON.stringify(this.digits) ===
						JSON.stringify(this.predictedDigits)
					) {
						this.stopScan()
						this.verificationStep = false
						this.reset()
						this.connectToSession()
						this.showConnectedStage()
					}
				}
			} else {
				const code = jsQR(
					imageData.data,
					imageData.width,
					imageData.height,
					{
						inversionAttempts: 'dontInvert',
					}
				)

				if (code && !this.scanResult) {
					this.scanResult = code.data
					this.sessionID = this.scanResult!.split('sessionId=')[1]
					this.enterToSession()
					this.sendVerifImage()
				}
			}

			if (this.scanActive) {
				this.animationRequest = requestAnimationFrame(
					this.scan.bind(this)
				)
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
			if (!this.verificationStep) {
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
					this.enterToSession()
					this.sendVerifImage()
				}
			} else {
				const imgData = this.handleVerifImage(
					img,
					img.width,
					img.height
				)
				if (imgData) {
					this.predictedDigits = this.predictDigits(imgData)
					console.log(this.digits, this.predictedDigits)
					if (
						JSON.stringify(this.digits) ===
						JSON.stringify(this.predictedDigits)
					) {
						this.verificationStep = false
						this.reset()
						this.connectToSession()
						this.showConnectedStage()
					}
				}
			}
		}
		img.src = URL.createObjectURL(file)
	}

	handleVerifImage(
		img: OffscreenCanvas | CanvasImageSource,
		width: number,
		height: number
	) {
		this.verifImageCanvas.width = width / 1.5
		this.verifImageCanvas.height = height / 1.5
		this.verifImageCanvasCtx!.drawImage(
			img,
			0,
			0,
			width / 1.5,
			height / 1.5
		)

		let imgData = this.verifImageCanvasCtx!.getImageData(
			0,
			0,
			this.verifImageCanvas.width,
			this.verifImageCanvas.height
		)

		const rect = this.cropImage(imgData)
		// console.log(rect, verifImageCanvas.width, verifImageCanvas.height)
		if (rect)
			console.log(
				Math.abs(rect.width - rect.height),
				(Math.min(rect.width, rect.height) / 100) * 5,
				rect.width,
				rect.height
			)

		if (
			!rect ||
			(rect.width < 10 && rect?.height < 10) ||
			Math.abs(rect.width - rect.height) >
				(Math.min(rect.width, rect.height) / 100) * 5
		)
			return null

		this.cropCanvas.width = rect.width
		this.cropCanvas.height = rect.height
		this.cropCanvasCtx!.drawImage(
			this.verifImageCanvas,
			rect.minX,
			rect.minY,
			rect.width,
			rect.height,
			0,
			0,
			rect.width,
			rect.height
		)
		// this.croppedImage = this.cropCanvas.toDataURL()

		this.resizedCanvas.width = 200
		this.resizedCanvas.height = 200
		this.resizedCtx!.drawImage(this.cropCanvas, 0, 0, 200, 200)

		imgData = this.resizedCtx!.getImageData(0, 0, 200, 200)
		this.toGrayscale(imgData)
		this.resizedCtx!.putImageData(imgData, 0, 0)
		this.croppedImage = this.resizedCanvas.toDataURL()

		return imgData
	}

	toGrayscale(imageData: ImageData) {
		for (var i = 0; i < imageData.data.length; i += 4) {
			let lightness = Math.floor(
				imageData.data[i] * 0.299 +
					imageData.data[i + 1] * 0.587 +
					imageData.data[i + 2] * 0.114
			)
			imageData.data[i] = lightness
			imageData.data[i + 1] = lightness
			imageData.data[i + 2] = lightness
		}
	}

	predictDigits(imageData: ImageData) {
		// @ts-ignore
		const predict: tf.Tensor<tf.Rank>[] = this.model?.predict(
			tf.browser.fromPixels(imageData, 1).expandDims(0).asType('float32')
		)
		const digits = predict.map((tensor) =>
			String(tf.argMax(tensor.dataSync()).dataSync()[0])
		)
		return [digits[0], digits[3], digits[1], digits[2]]
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

		const fontSize = imageSize / 2 + 3
		ctx.font = `${fontSize}px Aileron`
		ctx.fillStyle = 'black'

		// const textMetrics = ctx.measureText('8')
		const offsetY = 67

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

	waveTransform(
		imgData: ImageData,
		waveLen: number = 40,
		step: number = 2
	): ImageData {
		const width = imgData.width
		const height = imgData.height
		const data = imgData.data

		const newData = new Uint8ClampedArray(data.length)

		let counter = step
		let flag = true
		let rowHeight = 2

		for (let i = 0; i < height; i++) {
			if (i % rowHeight == 0) {
				if (counter === step) {
					flag = true
				}
				if (counter === waveLen) {
					flag = false
				}
				counter = flag ? counter + step : counter - step
			}

			let newIndex = i * width * 4
			let oldIndex = i * width * 4
			for (let j = 0; j < width * rowHeight; j++) {
				if (j < counter) {
					newData[newIndex] = 255 // R
					newData[newIndex + 1] = 255 // G
					newData[newIndex + 2] = 255 // B
					newData[newIndex + 3] = 255 // A
				} else {
					newData[newIndex] = data[oldIndex]
					newData[newIndex + 1] = data[oldIndex + 1]
					newData[newIndex + 2] = data[oldIndex + 2]
					newData[newIndex + 3] = data[oldIndex + 3]
					oldIndex += 4
				}
				newIndex += 4
			}
		}

		return new ImageData(newData, width, height)
	}

	generateTransformedImage() {
		const digits = this.getRandomDigits(4)
		this.digits = digits
		const canvas = this.generateImage(digits)
		const ctx = canvas.getContext('2d')

		if (!ctx) {
			throw new Error('Не удалось получить контекст рисования')
		}

		const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
		const transformedImgData = this.waveTransform(imgData)

		ctx.putImageData(transformedImgData, 0, 0)
		return canvas.toDataURL('image/jpeg')
	}

	async sendVerifImage() {
		const imageURL = this.generateTransformedImage()
		await new Promise((resolve) => {
			this.socket.emit(
				'conductor',
				{
					sessionId: this.sessionID,
					isInitiator: this.isInitiator,
					data: { type: 'verify', content: imageURL },
				},
				() => {
					this.verificationStep = true
					resolve(true)
				}
			)
		})
	}

	cropImage(imgData: ImageData) {
		const threshold = 100
		const pixelsSet = new Set<string>()
		const data = imgData.data

		for (let y = 0; y < imgData.height; y++) {
			for (let x = 0; x < imgData.width; x++) {
				const index = (y * imgData.width + x) * 4
				const r = data[index]
				const g = data[index + 1]
				const b = data[index + 2]

				if (r < threshold && g < threshold && b > threshold) {
					pixelsSet.add(`${x},${y}`)
				}
			}
		}

		const contours = []
		const visited = new Set<string>()

		for (const pixelStr of pixelsSet) {
			const [x, y] = pixelStr.split(',').map(Number)
			const key = `${x},${y}`

			if (!visited.has(key)) {
				const contour: Point[] = []
				const stack: [number, number][] = [[x, y]]
				visited.add(key)

				while (stack.length > 0) {
					const [currentX, currentY] = stack.pop()!
					contour.push({ x: currentX, y: currentY })

					const directions = [
						{ dx: -1, dy: 0 },
						{ dx: 1, dy: 0 },
						{ dx: 0, dy: -1 },
						{ dx: 0, dy: 1 },
					]

					for (const dir of directions) {
						const nx = currentX + dir.dx
						const ny = currentY + dir.dy
						const neighborKey = `${nx},${ny}`

						if (
							nx >= 0 &&
							nx < imgData.width &&
							ny >= 0 &&
							ny < imgData.height &&
							pixelsSet.has(neighborKey) &&
							!visited.has(neighborKey)
						) {
							visited.add(neighborKey)
							stack.push([nx, ny])
						}
					}
				}

				contours.push(contour)
			}
		}

		let largestRectangle = null
		let maxArea = 0

		for (const contour of contours) {
			const minX = Math.min(...contour.map((p) => p.x))
			const maxX = Math.max(...contour.map((p) => p.x))
			const minY = Math.min(...contour.map((p) => p.y))
			const maxY = Math.max(...contour.map((p) => p.y))

			const width = maxX - minX
			const height = maxY - minY
			const area = width * height

			if (area > maxArea) {
				maxArea = area
				largestRectangle = { minX, minY, width, height }
			}
		}
		return largestRectangle
	}
}
