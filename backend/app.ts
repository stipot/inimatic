import express from 'express'
import http from 'http'
import { v4 as uuidv4 } from 'uuid'
import { Server } from 'socket.io'
import { createClient } from 'redis'

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

const app = express()

app.use((req, res) => {
	res.status(404).send('Resource not found')
})

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

const redisClient = await createClient()
	.on('error', (err) => console.log('Redis Client Error', err))
	.connect()

function isValidGuid(guid: string) {
	return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
		guid
	)
}

io.on('connect', (socket) => {
	socket.on('add_initiator', async (initiatorSignalingData) => {
		const guid = uuidv4()
		const sessionData = {
			initiator: initiatorSignalingData,
			initiatorSocketId: socket.id,
			follower: '',
			timestamp: new Date(),
		}
		await redisClient.set(guid, JSON.stringify(sessionData))

		socket.emit('session_id', guid)
	})

	socket.on('get_initiator', async (sessionId) => {
		if (!isValidGuid(sessionId)) return

		const sessionData: SessionData = JSON.parse(
			(await redisClient.get(sessionId))!
		)
		socket.emit('initiator_data', sessionData.initiator)
	})

	socket.on('add_follower', async (followerData) => {
		const { follower, sessionId }: FollowerData = JSON.parse(followerData)
		if (!isValidGuid(sessionId)) return

		const sessionData = JSON.parse((await redisClient.get(sessionId))!)
		sessionData['follower'] = follower

		await redisClient.set(sessionId, JSON.stringify(sessionData))

		io.to(sessionData.initiatorSocketId).emit('follower_data', follower)
	})
})

const PORT = parseInt(process.env['PORT'] || '3000')
const HOST = process.env['HOST'] || '0.0.0.0'
server.listen(3000, HOST, () =>
	console.log(`Started on http://localhost:${PORT} ...`)
)
