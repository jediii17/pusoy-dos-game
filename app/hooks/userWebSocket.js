const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export function useWebSocket(roomCode, playerId, onMessage) {
    const wsRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const reconnectTimeoutRef = useRef(null);
    const onMessageRef = useRef(onMessage);

    useEffect(() => {
        onMessageRef.current = onMessage;
    }, [onMessage]);

    const connect = useCallback(() => {
        if (!roomCode || !playerId) return;

        // Build WS URL from backend URL
        const wsProtocol = BACKEND_URL?.startsWith('https') ? 'wss' : 'ws';
        const wsHost = BACKEND_URL?.replace(/^https?:\/\//, '');
        const wsUrl = `${wsProtocol}://${wsHost}/api/ws/${roomCode}/${playerId}`;

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                setConnected(true);
                // Start ping interval
                const pingInterval = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'ping' }));
                    }
                }, 30000);
                ws._pingInterval = pingInterval;
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type !== 'pong') {
                        onMessageRef.current?.(data);
                    }
                } catch (e) {
                    console.error('Failed to parse WS message', e);
                }
            };

            ws.onclose = () => {
                setConnected(false);
                if (ws._pingInterval) clearInterval(ws._pingInterval);
                // Reconnect after 2s
                reconnectTimeoutRef.current = setTimeout(() => {
                    connect();
                }, 2000);
            };

            ws.onerror = (err) => {
                console.error('WebSocket error', err);
            };
        } catch (e) {
            console.error('WebSocket connection failed', e);
        }
    }, [roomCode, playerId]);

    useEffect(() => {
        connect();
        return () => {
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            if (wsRef.current) {
                if (wsRef.current._pingInterval) clearInterval(wsRef.current._pingInterval);
                wsRef.current.close();
            }
        };
    }, [connect]);

    const sendMessage = useCallback((msg) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(msg));
        }
    }, []);

    return { connected, sendMessage };
}