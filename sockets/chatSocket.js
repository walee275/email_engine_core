
const socketIo = require('socket.io');

function configureSockets(server) {
  const io = socketIo(server);

  io.on('connection', (socket) => {
    console.log('A user connected');

    // Handle events like recieved messages, user connections, etc.


    socket.on('disconnect', () => {
      console.log('A user disconnected');
    });
  });
}

module.exports = configureSockets;
