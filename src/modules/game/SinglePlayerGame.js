

const { GameBase } = require("./GameBase");
const { Player } = require("./Player");
const { Brain } = require('./../../brain');
const { SinglePlayerMessageProcessor } = require("./SinglePlayerMessageProcessor");

class SinglePlayerGame extends GameBase {
    brain;

    constructor(gameInfo, player, mode) {
        super(gameInfo, player, mode);
        this.whitePlayer = mode == "review" ? new Player(null, gameInfo.whitePlayer) : player;
        this.blackPlayer = mode == "review" ? new Player(null, gameInfo.blackPlayer) : new Player(null, "AI");
        this.messageProcessor = new SinglePlayerMessageProcessor();
    }

    init(ws, userId) {
        super.init(ws, userId);
        this.chessGame.startNewGame(true); // for now, online game are always white view. might be changed in the future
        this.status = "in progress";
        if (this.OnGameStateChanged) {
            this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
        }
    }
    s;

    /**
     * 
     * @param {string} gameId - A unique number identified the game
     * @param {boolean} isWhite - Wheathe the AI player, plays with white piece set
     */
    makeBrainMove = async (brainPlaysAsWhite) => {

        const chessGame = this.chessGame;

        const brain = new Brain();

        try {
            const brainMove = await brain.nextMove(chessGame);
            console.log("Brain suggested a move: " + chessGame.MoveStr(brainMove));
            const move = await this.handleMove(brainPlaysAsWhite, brainMove, "brain");
            if (move.valid) {
                this.sendMoveToOpponenet(brainPlaysAsWhite, brainMove);

            }
            else {
                console.log("Brain created an invalid move");
            }

        } catch (err) {
            console.log(err);
        }
    };
}


module.exports = { SinglePlayerGame };