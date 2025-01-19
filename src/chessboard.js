/*global axios, ChessGame*/

//const { ChessGame } = require("./ChessGame");


// Globals
let promotionCallback = null;
let lastMove = null;
let drag = false;
let game;
let alertMode;
let promotingMode;
let dialogOn;
let gameType = 0;
let gameInfo;
let currentPlayerIsWhite;
let webSocket;
let whiteTimer, blackTimer;
let whiteHandle, blackHandle;
let disconnectionTimer, disconnectionTimerHandle, rejoined;
let moveHandle;
let moveIndex = 0;
const buttonsState = [];
let gameMoves = { moves: [] };
let autoCompletePromotion = false;
let animating = false;
let pause = false;
let draggedImage, offsetX, offsetY, chessboard, coordX, coordY, sourcePosition, targetPosition;

const guiBoard = [
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null]
];


window.onload = function () {
    console.log(window.location.pathname);
    if (window.location.pathname == "/game" ||
        window.location.pathname == "/review") {

        setDefaultTheme(blueTheme);
        setDefaultTheme(pinkTheme);
        setDefaultTheme(lightGreenTheme);
        setDefaultTheme(colorfullTheme);
        setDefaultTheme(niceTheme);

        game = new ChessGame();


        createGUIBoard();
        addOptionsButtons();
        generateMoveButtons();
        registerWindowEvents();
        startGame();
    }
};

function startWebSockets(username, isWhite) {
    console.log("starting web sockets");
    const connection = `ws://${window.location.hostname}:8080`;
    webSocket = new WebSocket(connection, "protocolOne");


    webSocket.onopen = async () => {
        console.log("connection opened");
        const gameConnectData = {
            username: username, isWhite: isWhite,
            gameId: gameInfo.id, creatorId: gameInfo.creatorId, userId: gameInfo.userId
        };
        const message = {
            type: "connection",
            data: gameConnectData
        };
        await sendMessage(message);
    };

    webSocket.onmessage = async (event) => {
        const message = JSON.parse(event.data);

        if (message.type == "move") {
            if (game.GameOver)
                return;
            console.log("opponent made a move");
            const move = message.data;
            let moveObj;


            if (move.promotion) {
                if (!move.selectedPiece) {
                    return;
                }
                else {
                    await animateMove(move);
                    moveObj = game.makeMove(move.source, move.target);
                    game.completePromotion(move);
                }
            }
            else {
                await animateMove(move);
                moveObj = game.makeMove(move.source, move.target);
            }

            lastMove = moveObj;
            moveAccepted(move);
            switchClocks();
        };

        if (message.type == "info") {
            const info = message.info;
            if (info == "Opponenet left the game") {
                const player = currentPlayerIsWhite ? "White" : "Black";
                //displayMessage(`The opponent left,  ${player} wins`);
                game.resign(player);
                clearInterval(whiteHandle);
                clearInterval(blackHandle);
            }

            if (info == "Opponent disconnected") {
                //displayMessage(`The opponent disconnected`);
                const opponentStatus = currentPlayerIsWhite ?
                    document.getElementById("blackPlayerStatus") :
                    document.getElementById("whitePlayerStatus");
                opponentStatus.style.background = "var(--error-color)";
                clearInterval(whiteHandle);
                clearInterval(blackHandle);
                startDisconnectionTimer();
            }

            if (info == "Opponent failed to reconnect") {
                displayMessage(UserMessages.OPPONENT_RECONNCETION_FAILED);

                const opponentStatus = currentPlayerIsWhite ?
                    document.getElementById("blackPlayerStatus") :
                    document.getElementById("whitePlayerStatus");
                opponentStatus.style.background = "var(--offline-color)";
                const player = currentPlayerIsWhite ? "White" : "Black";
                game.resign(player);
            }


            if (info == "Opponent resigned") {
                const player = currentPlayerIsWhite ? "White" : "Black";
                displayMessage(`The opponent resigned, ${player} wins `);
                game.resign(player);
                disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
                document.getElementById("rematchBtn").classList.remove("btnDisabled");
                gameMoves = await getGameMoves();
                updateMovesTable(gameMoves.moves);

            }

            if (info == "opponent joined") {
                //displayMessage(`An opponent joined`);
                const opponentStatus = currentPlayerIsWhite ?
                    document.getElementById("blackPlayerStatus") :
                    document.getElementById("whitePlayerStatus");
                opponentStatus.style.background = "var(--online-color)";

                const opponentName = currentPlayerIsWhite ?
                    document.getElementById("blackPlayerName") :
                    document.getElementById("whitePlayerName");
                opponentName.innerText = message.data;

                removeCloak();
                enableButtons(["resignBtn", "drawBtn", "lastMoveBtn"]);
            }

            if (info == "opponent rejoined") {
                //  displayMessage(`The opponent rejoined`);
                const opponentStatus = currentPlayerIsWhite ?
                    document.getElementById("blackPlayerStatus") :
                    document.getElementById("whitePlayerStatus");
                opponentStatus.style.background = "var(--online-color)";
                rejoined = true;
                switchClocks();
            }

            if (info == "offer rematch") {
                displayMessage("");
                if (gameInfo.gameType == 'OnlineGame') // Online
                    messageBox("Opponenet offer a rematch, agree?", acceptRematch, declineRematch);

                else if (gameInfo.gameType == 'SinglePlayerGame') // One player
                {
                    messageBox("New game?", acceptRematch, declineRematch);
                }
            }

            if (info == "rematch accepted") {


                // Online
                if (gameInfo.gameType == 'OnlineGame') {
                    displayMessage(`Rematch offer accepted`);
                    enableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
                    document.getElementById("rematchBtn").classList.add("btnDisabled");
                }
                else if (gameInfo.gameType == 'SinglePlayerGame') {
                    enableButtons(["resignBtn"]);
                }

                console.log("rematch accepted. Chaging game ID from:" + gameInfo.id + " to: " + message.gameId);
                gameInfo.id = message.gameId; // update with the new game id
                await setRematchGameId(gameInfo.id);
                startGame(true);


            }

            if (info == "rematch declined") {
                if (gameInfo.gameType == 'OnlineGame') {
                    displayMessage(`Rematch offer declined`);
                }
                disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
                document.getElementById("rematchBtn").classList.remove("btnDisabled");
            }

            if (info == "offer draw") {
                displayMessage("");
                messageBox("Opponent sent a draw offer, accept?", acceptDraw, declineDraw);
            }

            if (info == "draw accepted") {

                const offerBy = message.isWhite ? "black" : "white";
                displayMessage(`Draw offer accepted`);
                game.drawOfferAccepted(offerBy);
                disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
                document.getElementById("rematchBtn").classList.remove("btnDisabled");

                gameMoves = await getGameMoves();
                updateMovesTable(gameMoves.moves);
            }

            if (info == "draw declined") {
                displayMessage(`Draw offer declined`);
                enableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
            }

        }

        if (message.type == "cmd") {
            const info = message.data;
            if (info == "undo") {
                game.undo();
            }
        }
        //console.log("events registered")

        // webSocket.send("Hello")
    };

}

/**
 * Registers to window events such as onmouseup, onmousedown, click, keydown, etc
 *
 
 * @example
 *
 *     registerWindowEvents()
 */
function registerWindowEvents() {
    document.onmousedown = startDrag;
    document.onmouseup = stopDrag;

    const menuButton = document.getElementById("menuButton");
    const lastMoveBtn = document.getElementById("lastMoveBtn");
    document.addEventListener('click', (event) => {
        if (menuButton && !menuButton.contains(event.target)) {
            closeMenu();
        }
        if (lastMoveBtn && !lastMoveBtn.contains(event.target)) {
            removeArrow();
        }

    });

    document.addEventListener('contextmenu', event => {
        event.preventDefault();
    });

    document.addEventListener('keydown', OnKeyPressEventHandler);

    registerButtonEvents();
}

function registerButtonEvents() {

    const buttons = document.querySelectorAll(".button");
    for (const button of buttons) {
        button.removeEventListener("mousedown", onButtonMouseDown);
        button.removeEventListener("mouseup", onButtonMouseUp);
        button.removeEventListener("mouseleave", onButtonMouseUp);
        button.addEventListener("mousedown", onButtonMouseDown);
        button.addEventListener("mouseup", onButtonMouseUp);
        button.addEventListener("mouseleave", onButtonMouseUp);
    }

    const reviewButtons = document.querySelectorAll(".reviewButtons");
    for (const button of reviewButtons) {
        button.removeEventListener("mousedown", onReviewButtonMouseDown);
        button.removeEventListener("mouseup", onReviewButtonMouseUp);
        button.removeEventListener("mouseleave", onReviewButtonMouseUp);
        button.addEventListener("mousedown", onReviewButtonMouseDown);
        button.addEventListener("mouseup", onReviewButtonMouseUp);
        button.addEventListener("mouseleave", onReviewButtonMouseUp);
    }


}

function onButtonMouseDown(e) {
    if (e.target.classList.contains("btnDisabled"))
        return;
    e.target.classList.add("buttonPress");
}

function onButtonMouseUp(e) {
    e.target.classList.remove("buttonPress");
}

function onReviewButtonMouseDown(e) {
    if (e.target.classList.contains("btnDisabled"))
        return;
    e.target.classList.add("reviewButtonPress");
}

function onReviewButtonMouseUp(e) {
    e.target.classList.remove("reviewButtonPress");
}


/**
 *  Resets all GUI elements and starts a new game
 *
 
 * @example
 *
 *     startGame()
 */
async function startGame(isRematch) {


    gameInfo = await getGameInfo(isRematch);
    gameType = gameInfo.gameType;
    currentPlayerIsWhite = gameInfo.username == gameInfo.whitePlayerName;

    registerGameEvents();
    resetAlerts();
    resetButtons();
    resetSqaureColor();
    resetMovesList();
    displayMessage("");

    updateRowOrder();
    updateLegend();
    const gameState = gameInfo.gameState;
    let isRejoined = false;
    if (gameState) {
        isRejoined = true;
        game.loadGame(JSON.stringify(gameState));
        game.WhitePlayerView = currentPlayerIsWhite;
        gameMoves = await getGameMoves();
        updateMovesTable(gameMoves.moves);
        switchClocks();
        console.log("game loaded");
    }
    else {
        game.startNewGame(currentPlayerIsWhite);
        gameMoves = await getGameMoves();
        updateMovesTable(gameMoves.moves);
        resetClocks();
    }

    if (gameInfo.mode == "review") {
        if (gameInfo.reviewType == "pgn")
            currentPlayerIsWhite = true;
        game.startNewGame(currentPlayerIsWhite);
        moveIndex = 0;
        const blackPlayerInfoDiv = document.getElementById("blackPlayerName");
        blackPlayerInfoDiv.innerText = gameInfo.blackPlayerName;

        const whitePlayerInfoDiv = document.getElementById("whitePlayerName");
        whitePlayerInfoDiv.innerText = gameInfo.whitePlayerName;

        disableButtons(["rematchBtn", "resignBtn", "drawBtn", "undoBtn", "redoBtn"]);
        enableButtons(["lastMoveBtn", "lobbyBtn"]);
    }
    else {
        switch (gameType) {
            case 'PracticeGame':
                initPracticeGame(gameInfo, currentPlayerIsWhite);
                break;
            case 'OnlineGame':
                initOnlineGame(gameInfo, currentPlayerIsWhite, isRematch, isRejoined);
                break;
            case 'SinglePlayerGame':
                initSinglePlayerGame(gameInfo, currentPlayerIsWhite, isRematch);
                break;

            default:
                break;
        }
    }
}

function initPracticeGame(gameInfo) {
    const whitePlayerInfoDiv = document.getElementById("whitePlayerName");
    const blackPlayerInfoDiv = document.getElementById("blackPlayerName");
    whitePlayerInfoDiv.innerText = gameInfo.whitePlayerName;
    blackPlayerInfoDiv.innerText = gameInfo.blackPlayerName;

    disableButtons(["rematchBtn", "resignBtn", "drawBtn"]);
    enableButtons(["redoBtn", "undoBtn", "lastMoveBtn"]);
}


function initOnlineGame(gameInfo, currentPlayerIsWhite, isRematch, isRejoined) {
    if (!isRematch && gameInfo.mode != "review") {
        startWebSockets(gameInfo.username, currentPlayerIsWhite);
        if (currentPlayerIsWhite && !isRejoined && !isRematch)
            putCloak();
    }

    if (currentPlayerIsWhite) {
        const whitePlayerInfoDiv = document.getElementById("whitePlayerName");
        whitePlayerInfoDiv.innerText = gameInfo.whitePlayerName;

        const blackPlayerInfoDiv = document.getElementById("blackPlayerName");
        blackPlayerInfoDiv.innerText = (isRematch || isRejoined) ? gameInfo.blackPlayerName : "looking for opponent...";
        const opponentStatus = document.getElementById("blackPlayerStatus");
        opponentStatus.style.background = (isRematch || isRejoined) ? "var(--online-color)" : "var(--offline-color)";

        disableButtons(["redoBtn", "undoBtn", "rematchBtn"]);
        enableButtons(["resignBtn", "drawBtn", "lastMoveBtn"]);
    }
    else {
        const blackPlayerInfoDiv = document.getElementById("blackPlayerName");
        blackPlayerInfoDiv.innerText = gameInfo.username;
        const whitePlayerInfoDiv = document.getElementById("whitePlayerName");
        whitePlayerInfoDiv.innerText = gameInfo.whitePlayerName;

        disableButtons(["redoBtn", "undoBtn", "rematchBtn"]);
        enableButtons(["resignBtn", "drawBtn", "lastMoveBtn"]);
    }


    if (gameInfo.whiteTimer) {

        whiteTimer = gameInfo.whiteTimer;
        const whiteClock = document.getElementById("whiteClockTimeText");
        whiteClock.innerText = timerToText(whiteTimer);
    }

    if (gameInfo.blackTimer) {

        blackTimer = gameInfo.blackTimer;
        const blackClock = document.getElementById("blackClockTimeText");
        blackClock.innerText = timerToText(blackTimer);
    }
}


function putCloak() {
    const chessboardDiv = document.getElementById("chessboard");
    const cloakDiv = createCloak();
    chessboardDiv.appendChild(cloakDiv);
    cloakDiv.style.visibility = "visible";
    cloakDiv.style.opacity = "1";
}

function removeCloak() {
    const chessboardDiv = document.getElementById("chessboard");
    const cloakDiv = document.getElementById("cloak");
    if (cloakDiv) {
        cloakDiv.style.visibility = "hidden";
        cloakDiv.style.opacity = "0";
        chessboardDiv.removeChild(cloakDiv);
    }
}

function initSinglePlayerGame(gameInfo, currentPlayerIsWhite, isRematch) {
    if (!isRematch && gameInfo.mode != "review") {
        startWebSockets(gameInfo.username, currentPlayerIsWhite);
    }


    const whitePlayerInfoDiv = document.getElementById("whitePlayerName");
    whitePlayerInfoDiv.innerText = gameInfo.whitePlayerName;

    const blackPlayerInfoDiv = document.getElementById("blackPlayerName");
    blackPlayerInfoDiv.innerText = gameInfo.blackPlayerName;

    const opponentStatus = document.getElementById("blackPlayerStatus");
    opponentStatus.style.background = "var(--online-color)";

    disableButtons(["rematchBtn", "redoBtn", "undoBtn", "drawBtn"]);
    enableButtons(["resignBtn", "lastMoveBtn", "lobbyBtn"]);

}

/**
 *  Register to the game's event such as Check, Checkmate, Draw, Promotion, etc.
 *
 
 * @example
 *
 *     registerGameEvents()
 */
function registerGameEvents() {
    game.OnUpdate = onUpdateReceivedEventHandler;
    game.OnCheck = checkEventHandler;
    game.OnCheckmate = checkmateEventHandler;
    game.OnPromotion = promotionEventHandler;
    game.OnDraw = drawEventHandler;
    game.OnUndo = undoEventHandler;
}



function updateMovesTable(moves) {
    const movesDiv = document.getElementById("movesDiv");
    movesDiv.innerHTML = "";
    const table = document.createElement("table");
    table.classList.add("movesTable");
    const trh = document.createElement("tr");
    const th_num = document.createElement("th");
    th_num.innerHTML = "#";
    const th_white = document.createElement("th");
    th_white.innerHTML = "White";
    const th_black = document.createElement("th");
    th_black.innerHTML = "Black";
    trh.appendChild(th_num);
    trh.appendChild(th_white);
    trh.appendChild(th_black);
    table.appendChild(trh);

    for (let i = 0; i < moves.length; i += 2) {
        const whiteMove = moves[i];
        const blackMove = ((i + 1) < moves.length) ? moves[i + 1] : { moveStr: "" };
        const tr = document.createElement("tr");
        const td_num = document.createElement("td");
        td_num.innerHTML = (i / 2) + 1;
        const td_white = document.createElement("td");
        td_white.innerHTML = whiteMove.moveStr;
        td_white.id = "td_move" + (i + 1);
        td_white.onclick = loadMove;
        td_num.onclick = loadMove;
        const td_black = document.createElement("td");
        td_black.id = "td_move" + (i + 2);
        td_black.innerHTML = blackMove ? blackMove.moveStr : "";
        td_black.onclick = loadMove;
        tr.appendChild(td_num);
        tr.appendChild(td_white);
        tr.appendChild(td_black);
        table.appendChild(tr);
    }
    movesDiv.appendChild(table);

}



/**
 *  Creates the HTML DOM Elements that assemblies the Chess board.
 *
 
 * @example
 *
 *     createGUIBoard()
 */
function createGUIBoard() {
    const div = document.getElementById("chessboard");
    if (!div) return;
    div.innerHTML = "";
    const chessboard_horizontal_stack = document.createElement("div");
    chessboard_horizontal_stack.setAttribute("class", "chessboard_horizontal_stack");

    chessboard_horizontal_stack.appendChild(createSide());
    chessboard_horizontal_stack.appendChild(createBoard());
    chessboard_horizontal_stack.appendChild(createSide("right"));

    div.appendChild(chessboard_horizontal_stack);
    //div.appendChild(createPromotionBox())
    div.appendChild(createLoadGamePanel());


    const canvas = document.createElement("canvas");
    canvas.setAttribute("class", "arrowsCanvas");
    canvas.setAttribute("id", "arrowsCanvas");
    div.appendChild(canvas);

    chessboard = document.getElementById("innerBoard");
}

/**
 *  Creates the HTML DOM Elements that assemblies the Chess board's side including the row numbers.
 *
 * @param {boolean} isRight - determines if the side is the right side. default is left
 * @return {HTMLDivElement} the div Element containing the side
 * @example
 *
 *     createSide(true)  // right
 * createSide(false) // left
 * createSide()      // left
 */
function createSide(isRight) {

    const whitePlayView = game ? game.WhitePlayerView : true;
    const right = (isRight) ? "right" : "";
    const leftside = document.createElement("div");
    leftside.setAttribute("class", "side_vertical_stack");

    const leftUpperCorner = document.createElement("div");
    leftUpperCorner.setAttribute("class", "frame corner");
    leftside.appendChild(leftUpperCorner);

    const leftSideLegend = document.createElement("div");
    leftSideLegend.setAttribute("class", "side_squares");


    for (let i = game.BOARD_ROWS; i > 0; i--) {
        const square = document.createElement("div");
        square.setAttribute("class", "frame square " + right);
        square.innerText = whitePlayView ? i : game.BOARD_ROWS - i + 1;
        square.setAttribute("id", "row" + square.innerText + right);
        leftSideLegend.appendChild(square);
    }

    leftside.appendChild(leftSideLegend);

    const leftBottomCorner = document.createElement("div");
    leftBottomCorner.setAttribute("class", "frame corner");
    leftside.appendChild(leftBottomCorner);
    return leftside;
}

/**
 *  Creates the HTML DOM Elements that assemblies the main Chess board including the top and bottom legends.
 *
 * @param {boolean} isWhitePlayerView - determines if the board should be set as a white player view or not
 * @return {HTMLDivElement} The div Element containing the main board part
 * @example
 *
 *     createBoard(true)  // White player View
 * createBoard(false) // Black Player View
 */
function createBoard(isWhitePlayerView) {

    const mainBoard = document.createElement("div");
    mainBoard.setAttribute("class", "chessboard_vertical_stack");

    const topLegend = createLegend(true);
    mainBoard.appendChild(topLegend);

    const squares = createSquares(isWhitePlayerView);
    mainBoard.appendChild(squares);

    const bottomLegend = createLegend(false);
    mainBoard.appendChild(bottomLegend);

    return mainBoard;
}

/**
 *  Creates the HTML DOM Elements that assemblies the legend of the main Chess board. 
 * The legend is the frame part that shows the columns letters at the top and bottom of the board.
 *
 * @param {boolean} isTop - Determines if the request is to create a top legend or a bottom legend.
 * @return {HTMLDivElement} The div Element containing a legend part
 * @example
 *
 *     createLegend(true)  // top
 * createLegend(false) // Bottom
 */
function createLegend(isTop) {
    const top = (isTop) ? "top" : "";
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const legendTop = document.createElement("div");
    legendTop.setAttribute("class", "frame legend " + top);
    for (let i = 0; i < game.BOARD_COLUMNS; i++) {
        const square = document.createElement("div");
        square.setAttribute("class", "frame square");
        square.innerText = letters[i];
        square.setAttribute("id", "col" + letters[i] + top);
        legendTop.appendChild(square);
    }
    return legendTop;
}

/**
 *  Creates the HTML DOM Elements that assemblies the squares of the main Chess board. 
 *
 * @return {HTMLDivElement} The div Element containing a squares part of the board
 * @example
 *
 *     createSquares()  
 */
function createSquares() {
    const squares = document.createElement("div");
    squares.setAttribute("class", "squares");
    squares.setAttribute("id", "innerBoard");

    for (let i = 0; i < game.BOARD_ROWS; i++) {
        for (let j = 0; j < game.BOARD_COLUMNS; j++) {
            const square = document.createElement("div");
            const className = `square ${((i + j) % 2) === 0 ? "white" : "black"}`;
            square.setAttribute("class", className);
            squares.appendChild(square);
            guiBoard[i][j] = square;
        }
    }
    return squares;
}


function createCloak() {
    const cloakDiv = document.createElement("div");
    cloakDiv.setAttribute("class", "cloak");
    cloakDiv.setAttribute("id", "cloak");
    return cloakDiv;
}

/**
 *  Creates the HTML DOM Element that assemblies the promotion dialog pop ups when a pawn promotes, allowing the user to pick a piece (queen, rook, bishop, or knight). 
 *
 * @return {HTMLDivElement} The div Element containing the promotion dialog
 * @example
 *
 *     createPromotionBox()  
 */
function createPromotionBox() {


    const promotionDivSelection = document.createElement("div");
    promotionDivSelection.setAttribute("class", "promotionSelectionBox");
    promotionDivSelection.setAttribute("id", "promotionSelectionBox");
    for (let i = game.KNIGHT; i <= game.QUEEN; i++) {
        const piece = createPiece(whitePiecesURL[i]);
        piece.setAttribute("class", "promotionPiece");
        piece.setAttribute("alt", i);
        piece.onclick = promotionSelected;
        promotionDivSelection.appendChild(piece);
    }

    // cloakDiv.appendChild(promotionDivSelection);
    return promotionDivSelection;
}

/**
 *  Creates the HTML DOM Element that assemblies the Load Game dialog . 
 *
 * @return {HTMLDivElement} The div Element containing the load game dialog
 * @example
 *
 *     createLoadGamePanel()  
 */
function createLoadGamePanel() {
    const loadGamePanel = document.createElement("div");
    loadGamePanel.setAttribute("class", "loadGamePanel");
    loadGamePanel.setAttribute("id", "loadGamePanel");


    const loadGameCaption = document.createElement("div");
    loadGameCaption.innerText = Labels.LOAD_GAME;
    loadGameCaption.setAttribute("class", "loadGameCaption");
    loadGameCaption.setAttribute("id", "loadGameCaption");
    loadGamePanel.appendChild(loadGameCaption);

    const loadGameText = document.createElement("textArea");
    loadGameText.setAttribute("class", "loadGameText");
    loadGameText.setAttribute("id", "loadGameText");
    loadGameText.setAttribute("placeholder", Labels.ENTER_GAME_STATE);

    loadGamePanel.appendChild(loadGameText);

    const buttonsArea = document.createElement("div");
    buttonsArea.setAttribute("class", "loadGameButtons");
    buttonsArea.setAttribute("id", "loadGameButtons");


    const loadGameButton = document.createElement("Button");
    loadGameButton.setAttribute("class", "loadGameButton");
    loadGameButton.setAttribute("id", "loadGameButton");
    loadGameButton.innerText = Labels.LOAD;
    loadGameButton.addEventListener("click", loadGameButtonEventHandler);
    buttonsArea.appendChild(loadGameButton);


    const cancelLoadGameButton = document.createElement("Button");
    cancelLoadGameButton.setAttribute("class", "loadGameButton");
    cancelLoadGameButton.setAttribute("id", "cancelLoadGameButton");
    cancelLoadGameButton.innerText = Labels.CANCEL;
    cancelLoadGameButton.addEventListener("click", closeDialogs);
    buttonsArea.appendChild(cancelLoadGameButton);

    loadGamePanel.appendChild(buttonsArea);

    return loadGamePanel;
}


function createMessageBox(text, yesCallback, noCallback) {
    const messageBoxPanel = document.createElement("div");
    messageBoxPanel.setAttribute("class", "messageBoxPanel");
    messageBoxPanel.setAttribute("id", "messageBoxPanel");

    const messageBoxText = document.createElement("div");
    messageBoxText.innerText = text;
    messageBoxText.setAttribute("class", "messageBoxText");
    messageBoxText.setAttribute("id", "messageBoxText");
    messageBoxPanel.appendChild(messageBoxText);

    const buttonsArea = document.createElement("div");
    buttonsArea.setAttribute("class", "loadGameButtons");
    buttonsArea.setAttribute("id", "loadGameButtons");

    const yesButton = document.createElement("div");
    yesButton.setAttribute("class", "button");
    yesButton.setAttribute("id", "yesButton");
    yesButton.innerText = Labels.YES;
    yesButton.addEventListener("click", () => { hideMessageBox(); yesCallback(); }, { once: true });
    buttonsArea.appendChild(yesButton);

    const noButton = document.createElement("div");
    noButton.setAttribute("class", "button");
    noButton.setAttribute("id", "noButton");
    noButton.innerText = Labels.NO;
    noButton.addEventListener("click", () => { hideMessageBox(); noCallback(); }, { once: true });
    buttonsArea.appendChild(noButton);
    messageBoxPanel.appendChild(buttonsArea);
    return messageBoxPanel;
}

/**
 *  Resets the speacial events alerts, such as Check, CheckMate or Draw 
 *
 * @example
 *
 *     resetAlerts()  
 */
function resetAlerts() {
    const frame = document.getElementsByClassName("frame");
    for (const el of frame) {
        el.classList.remove("checkAlert");
        el.classList.remove("checkmateAlert");
        el.classList.remove("drawAlert");
    }
}

function resetButtons() {
    const buttons = document.getElementsByClassName("button");
    for (const button of buttons) {
        button.classList.remove("btnDisabled");
    }
    document.getElementById("rematchBtn").classList.add("btnDisabled");
}


function resetClocks() {
    clearInterval(whiteHandle);
    clearInterval(blackHandle);
    blackTimer = 90 * 60;
    whiteTimer = 90 * 60;
    const whiteClock = document.getElementById("whiteClockTimeText");
    whiteClock.innerText = timerToText(whiteTimer);
    const blackClock = document.getElementById("blackClockTimeText");
    blackClock.innerText = timerToText(blackTimer);

}

/**
 *  Resets the colors of the squares to the default 
 *
 * @example
 *
 *     resetSqaureColor()  
 */
function resetSqaureColor() {
    if (guiBoard[0][0] == null) return;
    for (let i = 0; i < game.BOARD_ROWS; i++) {
        for (let j = 0; j < game.BOARD_COLUMNS; j++) {
            const className = `square ${((i + j) % 2) === 0 ? "white" : "black"}`;
            guiBoard[i][j].setAttribute("class", className);
        }
    }
}


/**
 *  Resets the list of moves displayed to the user 
 *
 * @example
 *
 *     resetMovesList()  
 */
function resetMovesList() {
    const messages = document.getElementById("messages");
    messages.innerHTML = "";
}

/**
 *  Displays a message to the user on special events.
 * An Empty string, clears the message
 *
 *  @param {string} message - The message to show to the user.
 * 
 * @example
 *
 *     displayMessage("Check!")  
 * displayMessage("")  
 */
function displayMessage(message) {
    const statusBarDiv = document.getElementById("statusBar");
    const messagesDiv = document.getElementById("statusMessage");
    if (messagesDiv) {
        if (message) {
            messagesDiv.innerText = message;
            statusBarDiv.style.visibility = "visible";
            statusBarDiv.style.opacity = "1";
        }
        else {
            statusBarDiv.style.visibility = "hidden";
            statusBarDiv.style.opacity = "0";
        }
    }
}

function hideMessageBox() {

    const messageBoxPanel = document.getElementById("messageBoxPanel");
    const chessboardDiv = document.getElementById("chessboard");
    messageBoxPanel.classList.add("hide");
    const cloakDiv = document.getElementById("cloak");
    if (cloakDiv) {
        cloakDiv.style.visibility = "hidden";
        cloakDiv.style.opacity = "0";
        chessboardDiv.removeChild(cloakDiv);
        chessboardDiv.removeChild(messageBoxPanel);
    }
    // enableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
    restoreButtonsState();



    dialogOn = false;
}

function messageBox(text, yesCallback, noCallback) {

    dialogOn = true;
    const chessboardDiv = document.getElementById("chessboard");
    const cloakDiv = createCloak();
    chessboardDiv.appendChild(cloakDiv);
    cloakDiv.style.visibility = "visible";
    cloakDiv.style.opacity = "1";
    chessboardDiv.appendChild(createMessageBox(text, yesCallback, noCallback));
    registerButtonEvents();
    saveButtonsState();
    disableButtons(["rematchBtn", "resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
}


/**
 *  An event handler triggered when the game needs to update on a new state in the game 
 *
 *  @param {object} gameState - The message to show to the user.
 * 
 * @example
 *
 *     onUpdateReceivedEventHandler(state)  
 */
async function onUpdateReceivedEventHandler(gameState) {
    drag = false;
    const { board, capturedPiecesList } = gameState;
    drawBoard(board);
    updateCaptureLists(capturedPiecesList);

    if (gameInfo.mode != "review") {
        if (gameInfo.gameType != 'PracticeGame')
            gameMoves = await getGameMoves();
        updateMovesTable(gameMoves.moves);
        moveIndex = gameMoves.moves.length;
        const turnStr = "td_move" + moveIndex;
        const td = document.getElementById(turnStr);
        if (td) {
            td.scrollIntoView({ behavior: "smooth", block: "end" });
        }

    }
    // displayAlgebricNotation(algebricNotation)


    if (gameState.check) {
        await checkEventHandler(game.Turn);
    }

    if (gameState.checkmate) {
        await checkmateEventHandler(game.Turn);
    }

    if (gameState.draw) {
        await drawEventHandler(game.DrawReason);
    }

    //we were in check but not anymore
    if (alertMode && !gameState.check && !gameState.checkmate && !gameState.draw) {

        alertMode = false;
        resetAlerts();
        displayMessage("");
    }
    if (game.GameOver) {
        document.getElementById("rematchBtn").classList.remove("btnDisabled");
    }
}


/**
 *  Draws the entire board.
 *
 *  @param {number[][]} board - A 2D Array with the board content to display.
 * 
 * @example
 *
 *     drawBoard(gameState.board);
 */
function drawBoard(board) {
    for (let i = 0; i < game.BOARD_ROWS; i++) {
        for (let j = 0; j < game.BOARD_COLUMNS; j++) {
            const div = findSquareDivElement(i, j);
            div.innerHTML = "";
            const piece = board[i][j];
            const url = getImageUrl(piece);
            if (url) {
                placePiece(url, i, j);
            }
        }
    }
}


/**
 *  Finds and returns the div elelemt of a square at the requested position.
 *
 *  @param {number} row - The row of the square.
 *  @param {number} col - The column of the square.
 * 
 * @example
 *
 *     findSquareDivElement(0,0);
 */
function findSquareDivElement(row, col) {
    return guiBoard[row][col];
}

/**
 *  Gets the URL for the image of the request piece. 
 *
 *  @param {object} piece - The piece object containing the piece color and type.
 *  @return {string} The URL for the image of the request piece. Returns null if parameter is null.
 * 
 * @example
 *
 *     getImageUrl(piece);
 */
function getImageUrl(piece) {
    if (piece)
        return (piece.color == "white") ? whitePiecesURL[piece.pieceType] : blackPiecesURL[piece.pieceType];
    return null;

}

/**
 *  Creating a piece GUI element and places it on the board. 
 *
 *  @param {string} url - The URL for the image of the request piece.
 *  @param {number} row - The row of the square.
 *  @param {number} col - The column of the square.
 * 
 * @example
 *
 *     placePiece(url, row, col);
 */
function placePiece(url, row, col) {

    guiBoard[row][col].appendChild(createPiece(url));
}

/**
 *  Creates a new HTML Image Element
 *
 *  @param {string} url - The URL for the image of the request piece.
 *  @return {HTMLImageElement} The created image
 * 
 * @example
 *
 *     createPiece(url);
 */
function createPiece(url) {
    const img = document.createElement("img");
    img.setAttribute("src", url);
    // img.setAttribute("width", 100) // default size.
    img.setAttribute("class", "draggable");

    if (gameType != 'PracticeGame') {
        if (currentPlayerIsWhite && img.src.indexOf("black") != -1 ||
            !currentPlayerIsWhite && img.src.indexOf("white") != -1) {
            img.setAttribute("class", "nondraggable");
        }
    }
    if (gameInfo.mode == "review")
        img.setAttribute("class", "nondraggable");

    return img;
}

/**
 *  Update the box with the captured pieces
 *
 *  @param {Array} captured - The list of captured pieces
 * 
 * @example
 *
 *     updateCaptureLists(captured);
 */
function updateCaptureLists(captured) {
    const divWhite = document.getElementById("whiteCapturedPiece");
    const divBlack = document.getElementById("blackCapturedPiece");

    divWhite.innerHTML = "";
    divBlack.innerHTML = "";

    for (let i = 0; i < captured.length; i++) {
        const element = captured[i];
        if (element.color == "white") {
            addPiecesImages(divWhite, element);
        }
        else {
            addPiecesImages(divBlack, element);
        }
    }
}

/**
 *  Adds a piece to the captured pieces box
 *
 *  @param {HTMLDivElement} div - The div element contianing the captured pieces
 *  @param {object} pieceObj - The pieces to add
 * 
 * @example
 *
 *     addPiecesImages(divWhite, element);
 */
function addPiecesImages(div, pieceObj) {
    const img = document.createElement("img");
    const url = getImageUrl(pieceObj);
    img.setAttribute("src", url);
    img.setAttribute("class", "draggable captured");
    div.appendChild(img);
}

/**
 *  Display the algebric notation of the games moves
 *
 *  @param {string} movesStr - the algebric notation of the games moves
 * 
 * @example
 *
 *     displayAlgebricNotation(gameState.algebricNotation)
 */
// function displayAlgebricNotation(movesStr) {
//     let messages = document.getElementById("messages");
//     messages.innerText = movesStr;
// }


function updateRowOrder() {
    for (let i = game.BOARD_ROWS; i > 0; i--) {
        const rightLegendSquare = document.getElementById("row" + i + "right");
        const leftLegendSquare = document.getElementById("row" + i);
        rightLegendSquare.innerText = game.WhitePlayerView ? i : game.BOARD_ROWS - i + 1;
        leftLegendSquare.innerText = game.WhitePlayerView ? i : game.BOARD_ROWS - i + 1;
    }
}

function updateLegend() {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    for (let i = 0; i < game.BOARD_COLUMNS; i++) {
        const topLegendSquare = document.getElementById("col" + letters[i] + "top");
        const bottomLegendSquare = document.getElementById("col" + letters[i]);
        topLegendSquare.innerText = game.WhitePlayerView ? letters[i] : letters[game.BOARD_COLUMNS - i - 1];
        bottomLegendSquare.innerText = game.WhitePlayerView ? letters[i] : letters[game.BOARD_COLUMNS - i - 1];
    }
}

function loadGameButtonEventHandler() {

    const textArea = document.getElementById("loadGameText");
    game.loadGame(textArea.value);
    const loadGamePanel = document.getElementById("loadGamePanel");
    loadGamePanel.style.visibility = "hidden";
    dialogOn = false;
}


function checkEventHandler(turn) {
    alertMode = true;
    console.log(`Check! ${game.colorName(turn)} under attack`);
    displayMessage(`Check!`);
    const frame = document.getElementsByClassName("frame");
    for (const el of frame)
        el.classList.add("checkAlert");
}

async function checkmateEventHandler(turn) {
    alertMode = true;
    displayMessage(`Checkmate! ${game.colorName(turn)} wins!`);
    const frame = document.getElementsByClassName("frame");
    for (const el of frame) {
        el.classList.remove("checkAlert");
        el.classList.add("checkmateAlert");
    }
    window.clearInterval(whiteHandle);
    window.clearInterval(blackHandle);
    disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
    document.getElementById("rematchBtn").classList.remove("btnDisabled");
    gameMoves = await getGameMoves();
    updateMovesTable(gameMoves.moves);
}

async function drawEventHandler(reason) {
    clearInterval(whiteHandle);
    clearInterval(blackHandle);
    alertMode = true;
    displayMessage(`Draw! ${reason}`);
    const frame = document.getElementsByClassName("frame");
    for (const el of frame)
        el.classList.add("drawAlert");
    disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
    document.getElementById("rematchBtn").classList.remove("btnDisabled");
    gameMoves = await getGameMoves();
    updateMovesTable(gameMoves.moves);
}

function undoEventHandler(moves) {
    animating = true;
    const speed = 50;
    const move = moves[moves.length - 1];
    if (move) {
        clearArrows();

        const divMoveTarget = findSquareDivElement(move.target.row, move.target.col);
        const img = divMoveTarget.childNodes[0];
        if (!img) {
            animating = false;
            game.forceUpdate();
            return;

        }
        console.log(divMoveTarget.style.width);
        const squareWidth = divMoveTarget.offsetWidth;
        const squareHeight = divMoveTarget.offsetWidth;
        const horizontalDistance = (move.source.col - move.target.col) * squareWidth;
        const verticallDistance = (move.source.row - move.target.row) * squareHeight;
        const verticalSteps = verticallDistance / speed;
        const horizontalSteps = horizontalDistance / speed;

        let left = 0;
        let top = 0;

        img.style.zIndex = "2";
        img.style.position = "absolute";

        const interval = setInterval(() => {
            //let left = parseInt(img.style.left);
            left += horizontalSteps;
            top += verticalSteps;
            img.style.marginLeft = left + "px";
            img.style.marginTop = top + "px";

            if (Math.abs(left - horizontalDistance * 2) < 1
                && Math.abs(top - verticallDistance * 2) < 1) {
                clearInterval(interval);
                img.style.position = "relative";
                img.style.marginLeft = "0px";
                img.style.marginTop = "0px";
                animating = false;
                game.forceUpdate();
            }
        }
            , 2);
    }
    else { animating = false; console.log("error"); }
}



async function animateMove(move) {

    return new Promise((resolve, reject) => {
        animating = true;
        const speed = 50;

        if (move) {
            clearArrows();

            const divMoveTarget = findSquareDivElement(move.source.row, move.source.col);
            const img = divMoveTarget.childNodes[0];
            if (!img) {
                game.forceUpdate();
                reject();
                animating = false;
                return;

            }
            const squareWidth = divMoveTarget.offsetWidth;
            const squareHeight = divMoveTarget.offsetWidth;
            const horizontalDistance = (move.target.col - move.source.col) * squareWidth;
            const verticallDistance = (move.target.row - move.source.row) * squareHeight;
            const verticalSteps = verticallDistance / speed;
            const horizontalSteps = horizontalDistance / speed;

            let left = 0;
            let top = 0;

            img.style.zIndex = "2";
            img.style.position = "absolute";

            const interval = setInterval(() => {
                //let left = parseInt(img.style.left);
                left += horizontalSteps;
                top += verticalSteps;
                img.style.marginLeft = left + "px";
                img.style.marginTop = top + "px";

                if (Math.abs(left - horizontalDistance * 2) < 1
                    && Math.abs(top - verticallDistance * 2) < 1) {
                    clearInterval(interval);
                    img.style.position = "relative";
                    img.style.marginLeft = "0px";
                    img.style.marginTop = "0px";
                    game.forceUpdate();
                    animating = false;
                    resolve();
                }
            }
                , 2);
        }
        else {
            animating = false;
            reject("error");
        }
    });
}


function startDrag(e) {

    if (gameInfo.mode == "review")
        return;

    if (window.location.pathname != "/game") return;

    if (e.target.type != "textarea" && e.target.type != "input")
        if (e.preventDefault)
            e.preventDefault();

    draggedImage = e.target;
    if (draggedImage.className != 'draggable') { return; };

    if (gameType != 'PracticeGame' &&
        currentPlayerIsWhite && draggedImage.src.indexOf("black") != -1 ||
        !currentPlayerIsWhite && draggedImage.src.indexOf("white") != -1) {
        return;
    }

    // if (game.GameOver) {
    //     return
    // }

    offsetX = e.clientX;
    offsetY = e.clientY;

    if (!draggedImage.style.left) {
        draggedImage.style.position = 'relative';
        draggedImage.style.left = '0px';
    };
    if (!draggedImage.style.top) {
        draggedImage.style.position = 'relative';
        draggedImage.style.top = '0px';
    };

    draggedImage.style.zIndex = '1';


    coordX = parseInt(draggedImage.style.left);
    coordY = parseInt(draggedImage.style.top);
    drag = true;
    sourcePosition = findPosition();
    document.onmousemove = onDragging;


    targetPosition = findPosition();

    const options = game.possibleMoves(sourcePosition);
    for (const option of options) {
        guiBoard[option.target.row][option.target.col].setAttribute("class", "option");
    }


    return false;

}

function onDragging(e) {

    if (!drag) {
        return;
    };
    //sconsole.log("onDragging")
    draggedImage.style.left = coordX + e.clientX - offsetX + 'px';
    draggedImage.style.top = coordY + e.clientY - offsetY + 'px';
    draggedImage.style.cursor = 'grabbing';

    return false;
}

async function stopDrag() {
    if (!drag) {
        return;
    };

    draggedImage.style.cursor = 'grab';
    drag = false;

    targetPosition = findPosition();
    let moveObj = game.validateMove(sourcePosition, targetPosition, game.Turn);
    if (moveObj.valid) {
        moveObj = game.makeMove(sourcePosition, targetPosition);
        lastMove = moveObj;
        switchClocks();
        if (gameType != 'PracticeGame') {
            console.log("sending move:");
            console.log(moveObj);
            await sendMove(moveObj);//, targetPosition);
        }
        else {
            gameMoves.moves.push(moveObj);
            updateMovesTable(gameMoves.moves);
        }
    }
    else {
        // move piece back to source location       
        movePieceOnBoardTo(moveObj.source);
    }

    document.onmousemove = null;
    resetSqaureColor();

}



async function promotionEventHandler(turn) {

    if (gameInfo.mode == "review")
        return;

    const opponenetMove = (currentPlayerIsWhite && turn == 'black') ||
        (!currentPlayerIsWhite && turn == 'white');

    if (gameType == 'SinglePlayerGame' && opponenetMove)
        return;

    if (gameType == 'OnlineGame' && opponenetMove)
        return;

    // if (gameType == 'SinglePlayerGame' && !humanMove)
    //     return // no need to show promotion dialog if promotion happaned for other non human player on server

    if (autoCompletePromotion)
        return;

    return new Promise((resolve) => {

        displayMessage("Promotion!");
        promotingMode = true;
        dialogOn = true;
        showPromotionDialog((selectedPiece) => {
            lastMove.selectedPiece = selectedPiece;
            game.completePromotion(lastMove);
            if (gameType == 'OnlineGame') {
                sendMove(lastMove);
            }
            console.log("promotion completed:");
            console.log(lastMove);
            promotingMode = false;
            resolve();
        });
    });
}


function promotionSelected(e) {
    const selectedPiece = parseInt(e.target.alt);
    console.log(game.pieceName(selectedPiece));
    const chessboardDiv = document.getElementById("chessboard");
    const cloakDiv = document.getElementById("cloak");
    const promotionSelectionBox = document.getElementById("promotionSelectionBox");
    cloakDiv.removeChild(promotionSelectionBox);
    chessboardDiv.removeChild(cloakDiv);
    dialogOn = false;
    displayMessage("");
    promotionCallback(selectedPiece);
}


function showPromotionDialog(callback) {

    const chessboardDiv = document.getElementById("chessboard");
    const cloakDiv = createCloak();
    const promotionBox = createPromotionBox();
    cloakDiv.appendChild(promotionBox);
    chessboardDiv.appendChild(cloakDiv);

    cloakDiv.style.visibility = "visible";
    cloakDiv.style.opacity = "1";
    promotionCallback = callback;
}

function showLoadGameDialog() {

    const loadGamePanelDiv = document.getElementById("loadGamePanel");
    loadGamePanelDiv.style.visibility = "visible";
    dialogOn = true;
}










function movePieceOnBoardTo(position) {

    const div = findSquareDivElement(position.row, position.col);
    if (div) {
        div.innerHTML = "";
        div.appendChild(draggedImage);
        draggedImage.style.left = "0px";
        draggedImage.style.top = "0px";
        draggedImage.style.zIndex = '0';
    }
}



function findPosition() {
    var left = draggedImage.getBoundingClientRect().x - chessboard.getBoundingClientRect().x;
    var top = draggedImage.getBoundingClientRect().y - chessboard.getBoundingClientRect().y;
    const totalWidth = chessboard.getBoundingClientRect().width;
    const totalHeight = chessboard.getBoundingClientRect().height;
    const SquareWidth = totalWidth / 8;
    const SquareHeight = totalHeight / 8;
    const col = Math.round((left / SquareWidth));
    const row = Math.round((top / SquareHeight));
    return { row: row, col: col };
}




function removeArrow() {
    const canvas = document.getElementById("arrowsCanvas");
    canvas.style.visibility = "hidden";
}

function closeMenu() {

    const mainMenu = document.getElementById("mainMenu");

    if (mainMenu.style.visibility != "hidden") {
        mainMenu.style.visibility = "hidden";
        mainMenu.style.opacity = "0";
    }
}

function viewLastMove() {


    if (isButtonDisabled("lastMoveBtn"))
        return;



    const moves = game.Moves;
    if (moves.length == 0) {
        return;
    }
    const lastMove = moves[moves.length - 1];

    const canvas = document.getElementById("arrowsCanvas");
    if (canvas.style.visibility == "visible") {
        clearArrows();
        return;
    }
    const divMoveTarget = findSquareDivElement(lastMove.target.row, lastMove.target.col);
    const squareWidth = divMoveTarget.offsetWidth;

    canvas.style.visibility = "visible";
    chessboard = document.getElementById("innerBoard");
    canvas.setAttribute("width", chessboard.offsetWidth);
    canvas.setAttribute("height", chessboard.offsetWidth);
    const ctx = canvas.getContext('2d');
    let x1, y1, x2, y2;
    if (lastMove.whitePlayerView == game.WhitePlayerView) {
        x1 = lastMove.source.col * squareWidth + squareWidth / 2;
        y1 = lastMove.source.row * squareWidth + squareWidth / 2;
        x2 = lastMove.target.col * squareWidth + squareWidth / 2;
        y2 = lastMove.target.row * squareWidth + squareWidth / 2;
    }
    else {
        x1 = (game.BOARD_COLUMNS - lastMove.source.col - 1) * squareWidth + squareWidth / 2;
        y1 = (game.BOARD_ROWS - lastMove.source.row - 1) * squareWidth + squareWidth / 2;
        x2 = (game.BOARD_COLUMNS - lastMove.target.col - 1) * squareWidth + squareWidth / 2;
        y2 = (game.BOARD_ROWS - lastMove.target.row - 1) * squareWidth + squareWidth / 2;
    }
    drawArrow(ctx, x1, y1, x2, y2, chessboard.offsetWidth / 40, "#33a033");
}


function drawArrow(ctx, fromx, fromy, tox, toy, arrowWidth, color) {
    //variables to be used when creating the arrow
    var headlen = arrowWidth / 2;
    var angle = Math.atan2(toy - fromy, tox - fromx);

    ctx.save();
    ctx.strokeStyle = color;

    //starting path of the arrow from the start square to the end square
    //and drawing the stroke
    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(tox, toy);
    ctx.lineWidth = arrowWidth;
    ctx.stroke();

    //starting a new path from the head of the arrow to one of the sides of
    //the point
    ctx.beginPath();
    ctx.moveTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6),
        toy - headlen * Math.sin(angle - Math.PI / 6));

    //path from the side point of the arrow, to the other side point
    ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6),
        toy - headlen * Math.sin(angle + Math.PI / 6));

    //path from the side point back to the tip of the arrow, and then
    //again to the opposite side point
    ctx.lineTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6),
        toy - headlen * Math.sin(angle - Math.PI / 6));

    //draws the paths created above
    ctx.stroke();
    ctx.restore();

}

function clearArrows() {
    const canvas = document.getElementById("arrowsCanvas");
    if (!canvas) return;
    canvas.style.visibility = "hidden";
}


function closeDialogs() {
    const clearArrows = document.getElementById("loadGamePanel");
    clearArrows.style.visibility = "hidden";

    const cloak = document.getElementById("cloak");
    cloak.style.visibility = "hidden";
    cloak.style.opacity = "0";
    dialogOn = false;
}



function OnKeyPressEventHandler(event) {

    if (event.key === "Escape") {
        clearArrows();
        closeDialogs();
    }

    if (dialogOn)
        return;

    if (event.key.toLowerCase() == 'z' && event.ctrlKey) {
        menuUndo();
    }
    if (event.key.toLowerCase() == 'u') {
        game.forceUpdate();
    }
    if (event.key.toLowerCase() == 'b') {
        game.WhitePlayerView = false;
        clearArrows();
        updateRowOrder();
        updateLegend();
    }
    if (event.key.toLowerCase() == 'w') {
        game.WhitePlayerView = true;
        clearArrows();
        updateRowOrder();
        updateLegend();
    }
    if (event.key.toLowerCase() == 'f') {
        game.WhitePlayerView = !game.WhitePlayerView;
        clearArrows();
        updateRowOrder();
        updateLegend();
    }

    if (event.key.toLowerCase() == 'n') {
        // gameType = 2
        startGame();
    }



    if (event.key.toLowerCase() == 'c') {
        //    gameType = 1 //
        startGame();
    }



    if (event.key.toLowerCase() == 'v' && !event.ctrlKey) {
        viewLastMove();
    }

    if (event.key == 'F3') {
        menuLoadEventHandler();
    }

    if (event.key == 'F2') {
        menuSaveEventHandler();
    }
}

function menuLoadEventHandler() {
    showLoadGameDialog();
}




async function declineDraw() {
    if (gameInfo.gameType == 'SinglePlayerGame' || gameInfo.gameType == 'OnlineGame') {
        const message = {
            type: "info",
            info: "draw declined",
            gameId: gameInfo.id,
            userId: gameInfo.userId,
            username: gameInfo.username,
            isWhite: currentPlayerIsWhite

        };
        await sendMessage(message);

        displayMessage(`Draw offer declined`);
    }

    displayMessage(`Draw offer declined`);
    enableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);

}

async function declineRematch() {

    if (gameInfo.gameType == 'SinglePlayerGame' || gameInfo.gameType == 'OnlineGame') {
        const message = {
            type: "info",
            info: "rematch declined",
            gameId: gameInfo.id,
            userId: gameInfo.userId,
            username: gameInfo.username,
            isWhite: currentPlayerIsWhite
        };
        await sendMessage(message);
    }
}

async function moveAccepted(move) {
    if (gameInfo.gameType == 'SinglePlayerGame') {
        const message = {
            type: "info",
            info: "move accepted",
            gameId: gameInfo.id,
            userId: gameInfo.userId,
            username: gameInfo.username,
            isWhite: currentPlayerIsWhite,
            moveTime: currentPlayerIsWhite ? whiteTimer : blackTimer,
            moveStr: move.moveStr,

        };
        await sendMessage(message);
    }
}

async function acceptRematch() {
    if (gameInfo.gameType == 'SinglePlayerGame' || gameInfo.gameType == 'OnlineGame') {
        const message = {
            type: "info",
            info: "rematch accepted",
            gameId: gameInfo.id,
            userId: gameInfo.userId,
            username: gameInfo.username,
            isWhite: currentPlayerIsWhite

        };
        await sendMessage(message);
    }
}

async function acceptDraw() {
    if (gameInfo.gameType == 'SinglePlayerGame' || gameInfo.gameType == 'OnlineGame') {
        const message = {
            type: "info",
            info: "draw accepted",
            gameId: gameInfo.id,
            userId: gameInfo.userId,
            username: gameInfo.username,
            isWhite: currentPlayerIsWhite

        };
        await sendMessage(message);
    }

    const offerBy = currentPlayerIsWhite ? "black" : "white";

    displayMessage(`Draw offer accepted`);
    game.drawOfferAccepted(offerBy);

    gameMoves = await getGameMoves();
    updateMovesTable(gameMoves.moves);

    disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
    document.getElementById("rematchBtn").classList.remove("btnDisabled");
}

async function offerDraw() {
    if (gameInfo.gameType == 'SinglePlayerGame' || gameInfo.gameType == 'OnlineGame') {
        const message = {
            type: "info",
            info: "offer draw",
            gameId: gameInfo.id,
            userId: gameInfo.userId,
            username: gameInfo.username,
            isWhite: currentPlayerIsWhite

        };
        await sendMessage(message);

        displayMessage(`Draw offer sent`);
    }
    else if (gameInfo.gameType == 'PracticeGame') {
        messageBox("Opponenet sent a draw offer, accept?", acceptDraw, declineDraw);
    }
}


function offerCanceled() {
    displayMessage(``);
}

function isButtonDisabled(button) {
    const drawButton = document.getElementById(button);
    if (drawButton.classList.contains("btnDisabled"))
        return true;
    return false;
}

function menuOfferDrawEventHandler() {

    if (isButtonDisabled("drawBtn"))
        return;

    if (game.GameOver || dialogOn)
        return;

    messageBox("Offer a Draw?", offerDraw, offerCanceled);
}


async function menuRematchEventHandler() {

    if (isButtonDisabled("rematchBtn"))
        return;

    if (!game.GameOver || dialogOn)
        return;

    if (gameType == 'SinglePlayerGame' || gameType == 'OnlineGame') // AI or Online
    {
        const message = {
            type: "info",
            info: "offer rematch",
            gameId: gameInfo.id,
            userId: gameInfo.userId,
            username: gameInfo.username,
            isWhite: currentPlayerIsWhite

        };
        await sendMessage(message);

        displayMessage(`Rematch offer sent`);
        disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
        document.getElementById("rematchBtn").classList.remove("btnDisabled");
    }
}


function saveButtonsState() {
    const buttons = document.getElementsByClassName("button");
    for (const button of buttons) {
        const id = button.id;
        const isDisabled = button.classList.contains("btnDisabled");
        const entry = { id, isDisabled };
        buttonsState.push(entry);
    }
}

function restoreButtonsState() {
    while (buttonsState.length > 0) {
        const entry = buttonsState.pop();

        const element = document.getElementById(entry.id);
        if (element) {
            if (entry.isDisabled) {
                element.classList.add("btnDisabled");
            }
            else {
                element.classList.remove("btnDisabled");
            }
        }
    }
}


async function sendOutOfTime(loser) {
    if (gameInfo.gameType == 'SinglePlayerGame' || gameInfo.gameType == 'OnlineGame') {
        const message = {
            type: "info",
            info: "outOfTime",
            gameId: gameInfo.id,
            userId: gameInfo.userId,
            username: gameInfo.username,
            isWhite: currentPlayerIsWhite,
            loser: loser,
        };
        await sendMessage(message);
    }
}


function disableButtons(btnList) {

    for (const btnName of btnList) {
        const button = document.getElementById(btnName);
        if (button)
            button.classList.add("btnDisabled");
    }
}

function enableButtons(btnList) {

    for (const btnName of btnList) {
        const button = document.getElementById(btnName);
        if (button)
            button.classList.remove("btnDisabled");
    }
}

async function menuResignEventHandler() {
    if (isButtonDisabled("resignBtn"))
        return;

    if (game.GameOver)
        return;

    disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
    document.getElementById("rematchBtn").classList.remove("btnDisabled");

    const message = {
        type: "info",
        info: "resign",
        gameId: gameInfo.id,
        userId: gameInfo.userId,
        username: gameInfo.username,
        isWhite: currentPlayerIsWhite,
        moveTime: currentPlayerIsWhite ? whiteTimer : blackTimer,
    };
    await sendMessage(message);
    const player = currentPlayerIsWhite ? "White" : "Black";
    game.resign(player);

    gameMoves = await getGameMoves();
    updateMovesTable(gameMoves.moves);

    displayMessage(`You resigned, ${!currentPlayerIsWhite ? "White" : "Black"} wins `);
}

function menuSaveEventHandler() {
    const state = game.GameState;
    const str = JSON.stringify(state);
    console.log(str);
}



function menuUndo() {

    if (isButtonDisabled("undoBtn"))
        return;

    if (game.GameOver)
        return;

    if (dialogOn)
        return;

    if (promotingMode)
        return;

    if (gameInfo.gameType == 'OnlineGame') {
        sendCommand("undo");
        game.undo();
    }
    else if (gameInfo.gameType == 'SinglePlayerGame') {

        if (game.Turn == "white") {
            sendCommand("undo");
        }
    }
    else if (gameInfo.gameType == 'PracticeGame') {
        game.undo();
    }
}

function menuRedo() {

    if (isButtonDisabled("redoBtn"))
        return;

    if (game.GameOver)
        return;

    if (dialogOn)
        return;

    if (promotingMode)
        return;

    game.redo();
}

/*
function jsInclude(file) {

    const module = document.createElement("script");
    module.src = file;
    module.async = true;
    document.head.appendChild(module);

}


*/

async function getServerInfo(path) {

    try {
        const response = await axios.get(path);
        return response.data;

    } catch (error) {
        console.error(error);
    }
}

async function postServerInfo(path, param) {

    try {
        const response = await axios.post(path, param);
        return response.data;

    } catch (error) {
        console.error(error);
    }

}

async function getGameInfo(isRematch) {
    if (isRematch) {
        return await getServerInfo('/gameInfo?id=' + gameInfo.id);
    }
    else {
        return await getServerInfo('/gameInfo');
    }
}



async function setRematchGameId(newGameID) {
    const response = await postServerInfo('/rematch', { id: newGameID });
    console.log(response);
}

async function getGameMoves() {
    const moves = await getServerInfo('/gameMoves');
    return moves;
}



async function sendMove(moveObj) {
    moveObj.moveTime = currentPlayerIsWhite ? whiteTimer : blackTimer;

    const message = {
        type: "move",
        data: moveObj,
        gameId: gameInfo.id,
        username: gameInfo.username,
        isWhite: currentPlayerIsWhite,
    };

    await sendMessage(message);
}

function timerToText(timer) {
    var d = new Date(1970, 0, 1);
    d.setSeconds(timer);
    var text = d.toLocaleTimeString('eo', { hour12: false });
    return text;
}


function startDisconnectionTimer() {
    const playerDiconnectionTimer = currentPlayerIsWhite ?
        document.getElementById("blackPlayerDiconnectionTimer") :
        document.getElementById("whitePlayerDiconnectionTimer");

    disconnectionTimer = 59;
    playerDiconnectionTimer.classList.toggle("hide");
    disconnectionTimerHandle = setInterval(() => {
        playerDiconnectionTimer.innerText = `(${disconnectionTimer})`;
        if (rejoined) {
            rejoined = false; // for next time
            clearInterval(disconnectionTimerHandle);
            playerDiconnectionTimer.classList.toggle("hide");
        }
        if (game.GameOver) {
            document.getElementById("rematchBtn").classList.remove("btnDisabled");
            clearInterval(disconnectionTimerHandle);
            playerDiconnectionTimer.classList.toggle("hide");
        }
        if (disconnectionTimer <= 0) {
            clearInterval(disconnectionTimerHandle);
            playerDiconnectionTimer.classList.toggle("hide");
        }
        disconnectionTimer--;
    }, 1000);
}

function switchClocks() {

    if (gameInfo.mode == "review")
        return;

    if (game.Turn == "black") {

        const whiteTurnClock = document.getElementById("whiteTurnClock");
        whiteTurnClock.classList.add("unvisible");
        const blackTurnClock = document.getElementById("blackTurnClock");
        blackTurnClock.classList.remove("unvisible");
        if (whiteTimer)
            clearInterval(whiteHandle);

        blackHandle = setInterval(() => {
            blackTimer--;
            const blackClock = document.getElementById("blackClockTimeText");
            blackClock.innerText = timerToText(blackTimer);
            if (game.GameOver) {
                document.getElementById("rematchBtn").classList.remove("btnDisabled");
                clearInterval(whiteHandle);
                clearInterval(blackHandle);
            }
            if (blackTimer <= 0) {
                clearInterval(whiteHandle);
                clearInterval(blackHandle);
                outOfTime();
            }
        }, 1000);
    }


    if (game.Turn == "white") {

        const whiteTurnClock = document.getElementById("whiteTurnClock");
        whiteTurnClock.classList.remove("unvisible");
        const blackTurnClock = document.getElementById("blackTurnClock");
        blackTurnClock.classList.add("unvisible");
        if (blackTimer)
            clearInterval(blackHandle);

        whiteHandle = setInterval(() => {
            whiteTimer--;
            const whiteClock = document.getElementById("whiteClockTimeText");
            whiteClock.innerText = timerToText(whiteTimer);
            if (game.GameOver) {
                document.getElementById("rematchBtn").classList.remove("btnDisabled");
                clearInterval(whiteHandle);
                clearInterval(blackHandle);
            }
            if (whiteTimer <= 0) {
                clearInterval(whiteHandle);
                clearInterval(blackHandle);
                outOfTime();
            }
        }, 1000);

    }
}

function outOfTime() {

    displayMessage(`Time's up! ${game.Turn} lost`);
    game.OutOfTime = game.Turn;
    sendOutOfTime(game.Turn);
}


/*function setColors() {
    var r = document.querySelector(':root');

    // Create a function for getting a variable value
    function myFunction_get() {
        // Get the styles (properties and values) for the root
        var rs = getComputedStyle(r);
        // Alert the value of the --blue variable
        alert("The value of --darker is: " + rs.getPropertyValue('--darker'));
    }

    // Create a function for setting a variable value
    function myFunction_set() {
        // Set the value of variable --blue to another value (in this case "lightblue")
        r.style.setProperty('--darker', 'black');
    }

    myFunction_get();
    myFunction_set();
}*/

const blueTheme = {
    "--darker": "#293241",
    "--dark": "#3d5a80",
    "--semiDark": "#668ea5",
    "--semiLight": "#98c1d9",
    "--light": "#e0fbfc",
};

const lightGreenTheme = {
    "--darker": "#6B9080",
    "--dark": "#A4C3B2",
    "--semiDark": "#CCE3DE",
    "--semiLight": "#EAF4F4",
    "--light": "#F6FFF8",
};


const pinkTheme = {
    "--darker": "#9C89B8",
    "--dark": "#F0A6CA",
    "--semiDark": "#B8BEDD",
    "--semiLight": "#EFC3E6",
    "--light": "#F0E6EF",
};


const colorfullTheme = {
    "--darker": "#3A0CA3",
    "--dark": "#7209B7",
    "--semiDark": "#F72585",
    "--semiLight": "#4361EE",
    "--light": "#4CC9F0",
};

const niceTheme = {
    "--darker": "#3F403F",
    "--dark": "#475841",
    "--semiDark": "#9FB8AD",
    "--semiLight": "#CED0CE",
    "--light": "#E6E8E6",
};



function setDefaultTheme(theme) {
    var r = document.querySelector(':root');
    Object.entries(theme).forEach(([key, value]) => {
        r.style.setProperty(key, value);
    });
}

function moveEnd() {

    if (animating) {
        movePause();
    };

    //wait until animation completes
    const temp = setInterval(() => {

        if (!animating) {
            for (let i = 0; i < gameMoves.moves.length; i++) {

                showMoveForReview(gameMoves.moves[moveIndex], false);
                moveIndex++;
                const movesTDList = document.querySelectorAll("[id ^= 'td_move']");
                movesTDList.forEach(td => td.classList.remove("selectedMove"));
                const turnStr = "td_move" + moveIndex;
                const td = document.getElementById(turnStr);
                if (!td) return;
                td.classList.toggle("selectedMove");
                td.scrollIntoView({ behavior: "smooth", block: "end" });
            }
            clearInterval(temp);
        }
    }, 100);

}

function movePause() {

    pause = true;
    const temp = setInterval(() => {
        if (!animating) {
            const movePlay = document.getElementById("movePlay");
            movePlay.classList.remove("hide");
            const movePause = document.getElementById("movePause");
            movePause.classList.add("hide");
            clearInterval(temp);
        }
    }, 100);


}

function movePlay() {
    if (animating) return;
    if (dialogOn) return;

    const movePlay = document.getElementById("movePlay");
    movePlay.classList.add("hide");
    const movePause = document.getElementById("movePause");
    movePause.classList.remove("hide");

    moveHandle = setInterval(() => {

        if (pause) {
            pause = false;
            animating = false;
            clearInterval(moveHandle);
            return;
        }
        if (moveIndex < gameMoves.moves.length) {
            showMoveForReview(gameMoves.moves[moveIndex], true);
            moveIndex++;
            const movesTDList = document.querySelectorAll("[id ^= 'td_move']");
            movesTDList.forEach(td => td.classList.remove("selectedMove"));
            const turnStr = "td_move" + moveIndex;
            const td = document.getElementById(turnStr);
            if (!td) return;
            td.classList.toggle("selectedMove");
            td.scrollIntoView({ behavior: "smooth", block: "center" });
        }

        else
            clearInterval(moveHandle);
    }, 800);
}

async function moveStart() {

    if (animating) {
        movePause();
    };
    const temp = setInterval(() => {

        if (!animating) {
            resetClocks();
            game.startNewGame(currentPlayerIsWhite);
            moveIndex = 0;
            const turnStr = "td_move1";
            const td = document.getElementById(turnStr);
            td.scrollIntoView({ behavior: "smooth", block: "end" });
            const movesTDList = document.querySelectorAll("[id ^= 'td_move']");
            movesTDList.forEach(td => td.classList.remove("selectedMove"));
            clearInterval(temp);
        }

    }, 100);

}


async function moveNext() {

    if (animating) return;
    if (moveIndex < gameMoves.moves.length) {
        const move = gameMoves.moves[moveIndex];
        showMoveForReview(move, true);
        moveIndex++;
        const movesTDList = document.querySelectorAll("[id ^= 'td_move']");
        movesTDList.forEach(td => td.classList.remove("selectedMove"));
        const turnStr = "td_move" + moveIndex;
        const td = document.getElementById(turnStr);
        if (!td) return;
        td.classList.toggle("selectedMove");
        td.scrollIntoView({ behavior: "smooth", block: "end" });
    }
}

async function movePrev() {
    if (animating) return;
    if (moveIndex > 0) {
        game.undo();
        moveIndex--;
        const movesTDList = document.querySelectorAll("[id ^= 'td_move']");
        movesTDList.forEach(td => td.classList.remove("selectedMove"));
        const turnStr = "td_move" + moveIndex;
        const td = document.getElementById(turnStr);
        if (!td) return;
        if (td) td.classList.toggle("selectedMove");
        td.scrollIntoView({ behavior: "smooth", block: "end" });
    }
}

async function showMoveForReview(move, animnate) {

    if (!move)
        return;
    if (game.isResultMove(move))
        return;

    if (gameMoves.type == "pgn")
        move = game.convertPGNMove(move);

    if (animnate)
        await animateMove(move);

    game.makeMove(move.source, move.target);
    if (move.promotion) {
        game.completePromotion(move);
    }

    const clock = moveIndex % 2 == 0 ?
        document.getElementById("whiteClockTimeText") :
        document.getElementById("blackClockTimeText");
    if (move.moveTime) {
        clock.innerText = timerToText(move.moveTime);
    }
    else {
        clock.innerText = "";
    }

    lastMove = move;
}


function movesExport() {

    const arr = [];
    for (let i = 0; i < gameMoves.moves.length; i++) {
        if (i % 2 == 0) {
            arr.push((i / 2) + 1 + ".");
        }
        arr.push(gameMoves.moves[i].moveStr);
    }


    navigator.clipboard.writeText(arr.join(" "));
}



async function loadMove(e) {
    if (gameInfo.gameType == 'OnlineGame' && gameInfo.mode != "review") return;
    if (animating) return;
    if (dialogOn) return;
    autoCompletePromotion = true;
    resetClocks();
    game.startNewGame(currentPlayerIsWhite);
    const moves = [...gameMoves.moves];

    moveIndex = 0;
    for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        showMoveForReview(move, false);

        if (e.target.id == "td_move" + (i + 1)) {
            moveIndex = i + 1;
            break;
        }
    }

    const movesTDList = document.querySelectorAll("[id ^= 'td_move']");
    movesTDList.forEach(td => td.classList.remove("selectedMove"));
    const turnStr = "td_move" + moveIndex;
    const td = document.getElementById(turnStr);
    if (!td) return;
    td.classList.add("selectedMove");
    //td.scrollIntoView({ behavior: "smooth", block: "end" });
    td.scrollIntoView({ behavior: "smooth" });


    autoCompletePromotion = false;
}


async function sendCommand(cmd, moveIndex) {
    const message = {
        type: "cmd",
        data: cmd,
        gameId: gameInfo.id,
        userId: gameInfo.userId,
        username: gameInfo.username,
        isWhite: currentPlayerIsWhite,
        moveNum: moveIndex,
    };
    await sendMessage(message);
}

async function sendMessage(message) {
    if (webSocket && webSocket.readyState == WebSocket.OPEN) {
        const messageStr = JSON.stringify(message);
        await webSocket.send(messageStr);
    }
}



async function backToLobby() {

    if (isButtonDisabled("lobbyBtn"))
        return;

    //todo: Add are you sure AND a resign notice
    await menuResignEventHandler();
    window.location = "/Lobby";
}


function addOptionsButtons() {
    const buttons = [
        { id: 'rematchBtn', onclick: menuRematchEventHandler, text: Labels.REMATCH },
        { id: 'resignBtn', onclick: menuResignEventHandler, text: Labels.RESIGN },
        { id: 'drawBtn', onclick: menuOfferDrawEventHandler, text: Labels.DRAW },
        { id: 'undoBtn', onclick: menuUndo, text: Labels.UNDO },
        { id: 'redoBtn', onclick: menuRedo, text: Labels.REDO },
        { id: 'lastMoveBtn', onclick: viewLastMove, text: Labels.LAST_MOVE },
        { id: 'lobbyBtn', onclick: backToLobby, text: Labels.LOBBY }
    ];

    const optionsSection = document.getElementById('options');

    if (optionsSection) {
        buttons.forEach(buttonInfo => {
            const buttonElement = document.createElement('div');
            buttonElement.id = buttonInfo.id;
            buttonElement.className = 'button';
            buttonElement.innerText = buttonInfo.text;
            buttonElement.onclick = buttonInfo.onclick;
            optionsSection.appendChild(buttonElement);
        });
    }
}

function addMoveButton(buttonConfig) {
    const moveButton = document.createElement('div');
    moveButton.id = buttonConfig.id;
    moveButton.classList.add('reviewButtons');
    if (buttonConfig.hidden) {
        moveButton.classList.add('hide');
    }

    if (buttonConfig.src) {
        const imgElement = document.createElement('img');
        imgElement.src = buttonConfig.src;
        imgElement.height = buttonConfig.height;
        moveButton.appendChild(imgElement);
    }

    if (buttonConfig.onclick) {
        moveButton.onclick = buttonConfig.onclick;
    }

    const gameNavDiv = document.getElementById("gameNav");
    if (gameNavDiv) {
        gameNavDiv.appendChild(moveButton);
    }
}

function generateMoveButtons() {
    const gameNavDiv = document.getElementById("gameNav");
    if (gameNavDiv) {
        gameNavDiv.innerHTML = '';

        const buttons = [
            { id: 'moveStart', src: '/Images/start.png', height: 20, onclick: moveStart },
            { id: 'movePrev', src: '/Images/prev.png', height: 20, onclick: movePrev },
            { id: 'movePlay', src: '/Images/play.png', height: 16, onclick: movePlay },
            { id: 'movePause', src: '/Images/pause.png', height: 16, onclick: movePause, hidden: true },
            { id: 'moveNext', src: '/Images/next.png', height: 20, onclick: moveNext },
            { id: 'moveEnd', src: '/Images/end.png', height: 20, onclick: moveEnd },
            { id: 'movesExport', src: '/Images/export.png', height: 16, onclick: movesExport }
        ];

        buttons.forEach(addMoveButton);
    }
}


const UserMessages = {
    OPPONENT_RECONNCETION_FAILED: "Opponent failed to reconnect",
};




const Labels = {
    LOAD_GAME: "Load Game",
    LOAD: "Load",
    ENTER_GAME_STATE: "Paste game state here...",
    CANCEL: "Cancel",
    YES: "Yes",
    NO: "No",
    REMATCH: "Rematch",
    RESIGN: "Resign",
    DRAW: "Draw Offer",
    UNDO: "Undo",
    REDO: "Redo",
    LAST_MOVE: "Last Move",
    LOBBY: "Lobby",



};


const WhitePawnUrl = "images/3409_white-pawn.png";
const WhiteRookUrl = "images/3406_white-rook.png";
const WhiteBishopUrl = "images/3407_white-bishop.png";
const WhiteKnightUrl = "images/3408_white-knight.png";
const WhiteKingUrl = "images/3404_white-king.png";
const WhiteQueenUrl = "images/3405_white-queen.png";

const BlackPawnUrl = "images/3403_black-pawn.png";
const BlackRookUrl = "images/3400_black-rook.png";
const BlackBishopUrl = "images/3401_black-bishop.png";
const BlackKnightUrl = "images/3402_black-knight.png";
const BlackKingUrl = "images/3398_black-king.png";
const BlackQueenUrl = "images/3399_black-queen.png";


const whitePiecesURL = [WhitePawnUrl, WhiteKingUrl, WhiteKnightUrl, WhiteBishopUrl, WhiteRookUrl, WhiteQueenUrl];
const blackPiecesURL = [BlackPawnUrl, BlackKingUrl, BlackKnightUrl, BlackBishopUrl, BlackRookUrl, BlackQueenUrl];
