
const app = require("./src/app.js"); // Import the configured Express app
//const http = require("http");
const { Database } = require('./src/db/database.js');
const enableWs = require('express-ws');
const WebSocketServer = require('ws').Server;
const gameManagerService = require("./src/modules/gamesManager/service.js");
const wss = new WebSocketServer({ port: process.env.WSPORT });

require("dotenv").config();

//const server = http.createServer(app); // Create an HTTP server using the Express app
const PORT = process.env.PORT || 3000;
// Start the server and listen on the specified port





app.listen(PORT, async () => {
    console.log("listening on server. port:" + PORT);

    const db = Database.getInstance();
    db.connect();
    console.log("finish loading games");
    console.log("loading games completed");
});

enableWs(app);

wss.on("close", () => { console.log("server closed"); });
wss.on("error", () => { console.log("server error"); });
wss.on('connection', async (ws) => {
    console.log("ws connection request arrived");
    ws.on('message', async (recivedData) => {
        const msg = JSON.parse(recivedData);

        if (msg.type == "connection") {
            const gameId = msg.data.gameId;

            const game = gameManagerService.getGameById(gameId);
            if (game) {
                game.init(ws, msg.data.userId);

            }
        }
    });

    ws.on('close', async (data) => {
        console.log("ws close connection: " + data);
    });

    console.log("ws connection established");

});





