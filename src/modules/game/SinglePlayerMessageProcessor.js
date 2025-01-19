
const { MessageProcessor } = require("./MessageProcessor");

class SinglePlayerMessageProcessor extends MessageProcessor {
    onInfoReceived(game, msg) {
        console.log("onInfoReceived in Single MessageProcessor");
        super.onInfoReceived(game, msg);
        switch (msg.info) {
            case "rematch":
                //   game.sendMessageToOpponent(msg, msg.isWhite);
                break;
            case "resign":
                game.resign(msg.isWhite);
                msg.info = "Opponent resigned";
                //  game.sendMessageToOpponent(msg, msg.isWhite);
                break;
            case "offer draw":
                break;
            case "move accepted":
                break;
            case "draw accepted":
                break;
            case "draw declined":
                break;
            case "rematch declined":
                break;
            case "rematch accepted":

                //all gamess
                //let newGameId = await createRemtach(previousGame, gameDoc, userId, username);

                game.createRemtach(msg.isWhite);
                msg.gameId = game.gameId;

                //online game
                //     game.sendMessageToOpponent(msg, msg.isWhite)
                game.sendMessage(msg, msg.isWhite);

                break;
            case "outOfTime":
                break;
            default:
                console.log("Unknown info omessage");
                break;
        }
    }

    async onMoveReceived(game, msg) {

        if (!game.startedOn) {
            game.startedOn = new Date().getTime();
        }
        game.lastMoveOn = new Date().getTime();

        const move = await game.handleMove(msg.isWhite, msg.data, "player");

        if (move.valid) {
            const message = { type: "info", info: 'move validated successfully', gameId: msg.gameId };
            game.sendMessage(message, msg.isWhite);
            game.makeBrainMove(!msg.isWhite);
        }
        else {
            const message = { type: "info", info: 'move validation failed', gameId: msg.gameId };
            game.sendMessage(message, msg.isWhite);
            console.log("move validation failed");

        }


    }


}

module.exports = { SinglePlayerMessageProcessor };