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
	followerSocketId: string
	follower: string
	timestamp: Date
}

type CommunicationData = {
	isInitiator: boolean
	sessionId: string
	data: string
}

const app = express()

app.use((req, res) => {
	res.status(404).send('Resource not found')
})

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

const url = `redis://${process.env['PRODUCTION'] ? 'redis' : 'localhost'}:6379`
const redisClient = await createClient({ url })
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
			followerSocketId: '',
			follower: '',
			timestamp: new Date(),
		}
		await redisClient.set(guid, JSON.stringify(sessionData))
		await redisClient.expire(guid, 3600)

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

		const sessionData: SessionData = JSON.parse(
			(await redisClient.get(sessionId))!
		)
		sessionData.follower = follower
		sessionData.followerSocketId = socket.id

		await redisClient.set(sessionId, JSON.stringify(sessionData))

		io.to(sessionData.initiatorSocketId).emit('follower_data', follower)
	})

	socket.on('conductor', async (data) => {
		const receivedData: CommunicationData = JSON.parse(data)

		const sessionData: SessionData = JSON.parse(
			(await redisClient.get(receivedData.sessionId))!
		)

		if (receivedData.isInitiator) {
			io.to(sessionData.followerSocketId).emit(
				'connection',
				receivedData.data
			)
		} else {
			io.to(sessionData.initiatorSocketId).emit(
				'connection',
				receivedData.data
			)
		}
	})
})

const PORT = parseInt(process.env['PORT'] || '3030')
const HOST = process.env['HOST'] || '0.0.0.0'
server.listen(PORT, HOST, () =>
	console.log(`Started on http://localhost:${PORT} ...`)
)
