const { GameBase } = require("./GameBase");
const { Player } = require("./Player");

class PracticeGame extends GameBase {
    constructor(gameInfo, player, mode) {
        super(gameInfo, player, mode);
        console.log("This is the practice game class. ");
        this.whitePlayer = mode == "review" ? new Player(null, gameInfo.whitePlayer) : player;
        this.blackPlayer = mode == "review" ? new Player(null, gameInfo.blackPlayer) : player;
    }

    init() {
        console.log("initialize Practice base");
    }
}

module.exports = { PracticeGame };