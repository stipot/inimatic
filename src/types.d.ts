export type TransferFileData = {
	type: 'transferFile'
	fileName: string
	size: number
	content?: Array<number>
	part?: number
	end?: boolean
}

export type SendMessageData = {
	type: 'sendMessage'
	message: string
}

export type VerifyData = {
	type: 'verify'
	content: string
}

export type ConfirmationData = {
	type: 'confirmation'
	confirmed: boolean
}

export type Data =
	| TransferFileData
	| SendMessageData
	| VerifyData
	| ConfirmationData

export type ConnectionType = 'WebRTC' | 'WebSocket' | null
