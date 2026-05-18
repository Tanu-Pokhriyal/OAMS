const Notification = require('../models/Notification');

let io = null;

const setIO = (socketIO) => { io = socketIO; };

const notify = async ({ userId, title, message, type, referenceId, referenceModel }) => {
  const notification = await Notification.create({
    userId, title, message, type, referenceId, referenceModel,
  });
  if (io) {
    io.to(`user_${userId.toString()}`).emit('notification', notification);
  }
  return notification;
};

module.exports = { setIO, notify };
