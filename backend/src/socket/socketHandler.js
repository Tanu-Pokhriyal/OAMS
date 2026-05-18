const socketHandler = (io) => {
  io.on('connection', (socket) => {
    socket.on('join', (userId) => {
      if (userId) socket.join(`user_${userId}`);
    });
    socket.on('disconnect', () => {});
  });
};

module.exports = socketHandler;
