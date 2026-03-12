const supabase = require('./supabase');

module.exports = function (io) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Token manquant'));
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return next(new Error('Token invalide'));
    socket.userId = user.id;
    next();
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);

    socket.on('join_mission', (missionId) => {
      socket.join(`mission:${missionId}`);
    });

    socket.on('send_message', async ({ missionId, content }) => {
      if (!content?.trim()) return;
      const { data, error } = await supabase
        .from('messages')
        .insert({ mission_id: missionId, sender_id: socket.userId, content: content.trim() })
        .select('*, sender:profiles(name, avatar)')
        .single();
      if (!error && data) {
        io.to(`mission:${missionId}`).emit('new_message', data);
      }
    });

    socket.on('typing', ({ missionId }) => {
      socket.to(`mission:${missionId}`).emit('user_typing', { userId: socket.userId });
    });

    socket.on('disconnect', () => {
      console.log(`Disconnected: ${socket.userId}`);
    });
  });
};
