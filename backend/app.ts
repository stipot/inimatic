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
	initiatorId: string
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

io.on('connect', (socket) => {
	socket.on('create_session', (initiatorData) => {
		const guid = uuidv4()
		// save in redis in the future
		dataStore[guid] = {
			initiator: initiatorData,
			initiatorId: socket.id,
			follower: '',
			timestamp: new Date(),
		}
		socket.emit('session_id', guid)
	})

	socket.on('connect_to_session', (followerData) => {
		const { follower, sessionId }: FollowerData = JSON.parse(followerData)
		const guid = uuidv4()
		// save in redis in the future
		dataStore[guid] = { ...dataStore[guid], follower: follower }
		io.to(dataStore[guid].initiatorId).emit('follower_data', follower)
		socket.emit('initiator_data', dataStore[guid].initiator)
	})
})

server.listen(3000, '0.0.0.0', () =>
	console.log(`Started on http://localhost:${3000} ...`)
)
