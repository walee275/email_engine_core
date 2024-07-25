const { Server } = require('socket.io');

let io;

function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "*", // Adjust this as necessary for your setup
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('A user connected');

    // Example event emission to the client
    socket.emit('serverEvent', { message: 'Hello from the server!' });

    socket.on('disconnect', () => {
      console.log('User disconnected');
    });
  });

  return io;
}

function getIo() {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
}

module.exports = { initializeSocket, getIo };
