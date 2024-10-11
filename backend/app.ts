import express from 'express'
import http from 'http'
import { v4 as uuidv4 } from 'uuid'
import { Server } from 'socket.io'

type FollowerData = {
	follower: string
	sessionId: string
}

type SessionData = {
	initiator: string
	initiatorSocketId: string
	follower: string
	timestamp: Date
}

type Storage = {
	[guid: string]: SessionData
}

const app = express()

app.use((req, res) => {
	res.status(404).send('Resource not found')
})

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

const dataStore: Storage = {}

function isValidGuid(guid: string) {
	return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
		guid
	)
}

io.on('connect', (socket) => {
	socket.on('add_initiator', (initiatorSignalingData) => {
		const guid = uuidv4()
		// save in redis in the future
		dataStore[guid] = {
			initiator: initiatorSignalingData,
			initiatorSocketId: socket.id,
			follower: '',
			timestamp: new Date(),
		}
		socket.emit('session_id', guid)
	})

	socket.on('get_initiator', (sessionId) => {
		if (!isValidGuid(sessionId)) return

		socket.emit('initiator_data', dataStore[sessionId].initiator)
	})

	socket.on('add_follower', (followerData) => {
		const { follower, sessionId }: FollowerData = JSON.parse(followerData)
		if (!isValidGuid(sessionId)) return
		// save in redis in the future
		dataStore[sessionId] = { ...dataStore[sessionId], follower: follower }
		io.to(dataStore[sessionId].initiatorSocketId).emit(
			'follower_data',
			follower
		)
	})
})

const PORT = parseInt(process.env['PORT'] || '3000')
const HOST = process.env['HOST'] || '0.0.0.0'
server.listen(3000, HOST, () =>
	console.log(`Started on http://localhost:${PORT} ...`)
)
