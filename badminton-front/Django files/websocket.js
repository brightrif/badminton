export const connectWebSocket = (matchId, onScoreUpdate) => {
  const ws = new WebSocket(`ws://localhost:8000/ws/match/${matchId}/`);
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onScoreUpdate(data.score);
  };
  ws.onclose = () => console.log('WebSocket closed');
  return ws;
};