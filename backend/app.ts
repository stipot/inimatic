import express from 'express'
import http from 'http'
import { v4 as uuidv4 } from 'uuid'
import { Server } from 'socket.io'
import { createClient } from 'redis'

type FollowerData = {
	followerName: string
	sessionId: string
}

type Follower = {
	[followerSocketId: string]: string
}

type SessionData = {
	initiatorSocketId: string
	followers: Follower
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
const io = new Server(server, {
	cors: { origin: '*' },
	pingTimeout: 10000,
	pingInterval: 10000,
})

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
	socket.on('disconnecting', async () => {
		const rooms = Array.from(socket.rooms).filter(
			(roomId) => roomId != socket.id
		)
		if (!rooms.length) return

		const sessionId = rooms[0]
		console.log('disconnect', socket.id, socket.rooms, sessionId)
		const sessionData: SessionData = JSON.parse(
			(await redisClient.get(sessionId))!
		)
		let isInitiator = sessionData.initiatorSocketId === socket.id
		if (isInitiator) {
			socket.to(sessionId).emit('initiator_disconnect')
		} else {
			io.to(sessionData.initiatorSocketId).emit(
				'follower_disconnect',
				sessionData.followers[socket.id]
			)
		}
	})

	socket.on('add_initiator', async () => {
		const guid = uuidv4()
		const sessionData: SessionData = {
			initiatorSocketId: socket.id,
			followers: {},
			timestamp: new Date(),
		}
		await redisClient.set(guid, JSON.stringify(sessionData))
		await redisClient.expire(guid, 3600)

		socket.join(guid)
		socket.emit('session_id', guid)
	})

	socket.on('add_follower', async (data) => {
		// возможно, стоит проверять наличие других комнат у сокета,
		// чтоб не было лишних подключений
		const { followerName, sessionId }: FollowerData = data
		if (!isValidGuid(sessionId)) return

		const sessionData: SessionData = JSON.parse(
			(await redisClient.get(sessionId))!
		)
		if (sessionData === null) return

		sessionData.followers[socket.id] = followerName
		socket.join(sessionId)

		await redisClient.set(sessionId, JSON.stringify(sessionData))

		// io.to(sessionData.initiatorSocketId).emit('follower_data', followerName)
	})

	socket.on('session_connect', async (sessionId) => {
		// if (data.isInitiator) return
		console.log(sessionId)

		const sessionData: SessionData = JSON.parse(
			(await redisClient.get(sessionId))!
		)
		const followerName = sessionData.followers[socket.id]
		io.to(sessionData.initiatorSocketId).emit(
			'connect_follower',
			followerName
		)
	})

	socket.on('disconnect_follower', async (data) => {
		const { followerName, sessionId, isInitiator } = data
		if (!isValidGuid(sessionId)) return

		const sessionData: SessionData = JSON.parse(
			(await redisClient.get(sessionId))!
		)

		if (isInitiator) {
			const socketIds = Object.keys(sessionData.followers).filter(
				(followerSocketId) =>
					sessionData.followers[followerSocketId] === followerName
			)
			console.log(socketIds)

			if (socketIds.length === 1) {
				delete sessionData.followers[socketIds[0]]
				await redisClient.set(sessionId, JSON.stringify(sessionData))
				const sockets = await io.sockets.fetchSockets()
				const followerSocket = sockets.filter(
					(socket) => socket.id === socketIds[0]
				)[0]
				followerSocket.leave(sessionId)
				followerSocket.emit('initiator_disconnect')
				socket.emit('follower_disconnect', followerName)
			}
		} else {
			socket.leave(sessionId)
			socket.emit('initiator_disconnect')
			io.to(sessionData.initiatorSocketId).emit(
				'follower_disconnect',
				followerName
			)
		}
	})

	socket.on('conductor', async (data, fn) => {
		const receivedData: CommunicationData = data

		const sessionData: SessionData = JSON.parse(
			(await redisClient.get(receivedData.sessionId))!
		)

		if (receivedData.isInitiator) {
			socket
				.to(receivedData.sessionId)
				.emit('connection', receivedData.data)
		} else {
			io.to(sessionData.initiatorSocketId).emit(
				'connection',
				receivedData.data
			)
		}

		if (fn) {
			fn(1)
		}
	})
})

const PORT = parseInt(process.env['PORT'] || '3030')
const HOST = process.env['HOST'] || '0.0.0.0'
server.listen(PORT, HOST, () =>
	console.log(`Started on http://${HOST}:${PORT} ...`)
)
